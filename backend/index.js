const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
require('dotenv').config();

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ['http://localhost:3000', 'http://localhost:5173'];

console.log(`Starting server in ${NODE_ENV} mode on port ${PORT}`);
console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);

const app = express();

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enable CORS for all routes with configuration from env
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if the request origin is allowed
  if (NODE_ENV === 'development' || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Create HTTP or HTTPS server based on environment
let server;
if (NODE_ENV === 'production' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  try {
    // Use HTTPS in production if SSL certs are available
    const sslOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    };
    server = https.createServer(sslOptions, app);
    console.log('HTTPS server created');
  } catch (error) {
    console.error('Failed to load SSL certificates:', error);
    server = http.createServer(app);
    console.log('Falling back to HTTP server');
  }
} else {
  server = http.createServer(app);
  console.log('HTTP server created');
}

// Configure Socket.IO with enhanced options
const io = new Server(server, {
  cors: {
    origin: NODE_ENV === 'development' ? '*' : ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000, // Increase timeout for better connection stability
  pingInterval: 25000, // Ping interval to keep connection alive
  transports: ['websocket', 'polling'], // Prefer WebSocket
  allowEIO3: true // Allow Socket.IO v3 clients
});

// Data storage
const activeRooms = new Map(); // Track active meeting rooms
const peerConnections = new Map(); // Track WebRTC peer connections
const userActivity = new Map(); // Track user activity for cleanup
const roomMessages = new Map(); // Store recent chat messages for each room

app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

// API route to generate a unique meeting ID
app.get('/api/generate-meeting-id', (req, res) => {
  const meetingId = uuidv4().substring(0, 8); // Generate a shorter UUID
  res.json({ meetingId });
});

  // API route to generate Stream Video token for a user
  const jwt = require('jsonwebtoken');
  app.get('/api/stream-token', async (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }
      const apiKey = process.env.STREAM_API_KEY;
      const apiSecret = process.env.STREAM_API_SECRET;
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: 'Stream API credentials not set' });
      }
      // Stream Video JWT payload (see Stream docs for required claims)
      const payload = {
        user_id: userId,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
        iat: Math.floor(Date.now() / 1000)
      };
      const token = jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
      return res.json({ token });
    } catch (err) {
      console.error('Error generating Stream token:', err);
      return res.status(500).json({ error: 'Failed to generate token' });
    }
  });
app.use(express.json());

// Enhanced socket connection handler
io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || 
                   socket.handshake.address.replace(/^.*:/, '');
                   
  console.log(`User connected: ${socket.id} from ${clientIp}`);
  
  // Update socket data on connection
  socket.lastActivity = Date.now();
  userActivity.set(socket.id, { 
    lastActivity: Date.now(), 
    ip: clientIp
  });
  
  // Handle joining a specific meeting room with improved error handling
  socket.on('join-room', async ({ meetingId, username }) => {
    try {
      console.log(`User ${username} (${socket.id}) joining room: ${meetingId}`);
      
      // Validate inputs with enhanced error handling
      if (!meetingId || typeof meetingId !== 'string') {
        socket.emit('error', { message: 'Invalid meeting ID' });
        return;
      }
      
      if (!username || typeof username !== 'string') {
        username = `Guest-${Math.floor(Math.random() * 1000)}`;
        console.log(`Using generated username: ${username} for user ${socket.id}`);
      }
      
      // Check if already in a room, leave it first
      if (socket.meetingId && socket.meetingId !== meetingId) {
        console.log(`User ${socket.id} already in room ${socket.meetingId}, leaving it before joining ${meetingId}`);
        handleUserLeaving(socket, socket.meetingId);
      }
      
      // Join the socket room
      await socket.join(meetingId);
      socket.username = username;
      socket.meetingId = meetingId;
      
      // Track this user in the room with more metadata
      if (!activeRooms.has(meetingId)) {
        console.log(`Creating new meeting room: ${meetingId}`);
        activeRooms.set(meetingId, new Map());
      }
      
      // Store more information about the user
      activeRooms.get(meetingId).set(socket.id, {
        id: socket.id,
        username,
        hasAudio: true,
        hasVideo: true,
        joinedAt: Date.now(),
        clientAddress: socket.handshake.headers['x-forwarded-for'] || 
                       socket.handshake.address.replace(/^.*:/, ''),
        userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
        connectionCount: 0, // Track reconnections
        lastActivity: Date.now()
      });
      
      // Log room stats with enhanced details
      const roomUsers = activeRooms.get(meetingId);
      console.log(`Room ${meetingId} now has ${roomUsers.size} participants`);
      
      // Log participant details for debugging
      console.log(`Room ${meetingId} participants:`);
      roomUsers.forEach((user, userId) => {
        console.log(`- ${user.username} (${userId}), joined: ${new Date(user.joinedAt).toISOString()}`);
      });
      
      // Notify others in the room with timestamp
      socket.to(meetingId).emit('room-message', { 
        type: 'system', 
        text: `${username} joined the meeting.`,
        timestamp: new Date().toISOString(),
        userId: 'system'
      });
      
      // Send the list of participants to the new joiner
      const participants = Array.from(roomUsers.values()).map(user => ({
        id: user.id,
        username: user.username,
        hasAudio: user.hasAudio,
        hasVideo: user.hasVideo,
        joinedAt: user.joinedAt
      }));
      
      socket.emit('room-users', participants);
      
      // Send recent chat history to the new joiner
      if (roomMessages.has(meetingId)) {
        const recentMessages = roomMessages.get(meetingId);
        if (recentMessages.length > 0) {
          console.log(`Sending ${recentMessages.length} recent messages to new participant ${socket.id}`);
          socket.emit('room-message-history', recentMessages);
        }
      }
      
      // Broadcast to everyone that user list has changed
      io.to(meetingId).emit('room-users-changed', participants);
      
      // Notify others to send their signals to the new participant
      socket.to(meetingId).emit('user-joined', { 
        id: socket.id, 
        username,
        hasAudio: true,
        hasVideo: true,
        timestamp: Date.now()
      });
      
      // Send message history to the new user
      if (roomMessages.has(meetingId)) {
        // Send last 50 messages max
        const messageHistory = roomMessages.get(meetingId).slice(-50);
        if (messageHistory.length > 0) {
          socket.emit('room-message-history', {
            messages: messageHistory,
            roomId: meetingId
          });
          console.log(`Sent ${messageHistory.length} message history items to ${socket.id}`);
        }
      }
      
      // Acknowledge successful join with more details
      socket.emit('joined-room', { 
        success: true, 
        meetingId, 
        participantCount: participants.length,
        yourId: socket.id,
        timestamp: Date.now()
      });
      
      // Log connection success for monitoring
      console.log(`User ${username} (${socket.id}) successfully joined room ${meetingId} with ${participants.length} total participants`);
    } catch (error) {
      console.error(`Error joining room ${meetingId}:`, error);
      socket.emit('error', { 
        message: 'Failed to join meeting room', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
      });
    }
  });
  
  // Enhanced room-specific messages with improved validation, reliability and delivery tracking
  socket.on('room-message', ({ meetingId, text, messageId }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      if (userActivity.has(socket.id)) {
        userActivity.get(socket.id).lastActivity = Date.now();
      }
      
      // Check if user is in a room with better error messaging
      if (!socket.username || !socket.meetingId) {
        socket.emit('error', { 
          message: 'You are not in a meeting room',
          code: 'NOT_IN_ROOM'
        });
        return;
      }
      
      // Ensure meetingId matches the current room
      if (socket.meetingId !== meetingId) {
        socket.emit('error', { 
          message: 'Message cannot be sent to a different room',
          code: 'WRONG_ROOM'
        });
        return;
      }
      
      // Validate message content
      if (!text || typeof text !== 'string') {
        socket.emit('error', { 
          message: 'Invalid message format',
          code: 'INVALID_MESSAGE'
        });
        return;
      }
      
      // Limit message length to prevent abuse
      const maxLength = 2000;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      
      // Generate a consistent message ID if not provided
      const actualMessageId = messageId || `${socket.id}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      
      // Create the message object once to ensure consistency
      const messageObj = {
        id: socket.id,
        messageId: actualMessageId,
        user: socket.username,
        text: truncatedText,
        timestamp: new Date().toISOString(),
        delivered: true
      };
      
      console.log(`Message from ${socket.username} in room ${meetingId} [ID: ${actualMessageId}]: ${truncatedText.substring(0, 40)}${truncatedText.length > 40 ? '...' : ''}`);
      
      // Get count of recipients for delivery tracking
      const roomMembers = io.sockets.adapter.rooms.get(meetingId);
      const recipientCount = roomMembers ? roomMembers.size - 1 : 0; // Exclude sender
      
      // Track successful deliveries
      let deliveryCount = 0;
      
      // Send to everyone else in the room
      if (recipientCount > 0) {
        socket.to(meetingId).emit('room-message', messageObj);
      }
      
      // Log delivery metrics
      console.log(`Message ${actualMessageId} sent to ${recipientCount} recipients`);
      
      // Send acknowledgement to sender with delivery info
      socket.emit('room-message-confirm', {
        ...messageObj,
        recipientCount,
        deliveryCount
      });
      
      // Add a small delay to ensure delivery acknowledgment gets back to client
      setTimeout(() => {
        socket.emit(`room-message-confirm-${actualMessageId}`, {
          ...messageObj,
          recipientCount,
          deliveryCount
        });
      }, 100);
      
      // Store message in room history (optional)
      if (!roomMessages.has(meetingId)) {
        roomMessages.set(meetingId, []);
      }


  
  // Handle typing indicators
  socket.on('user-typing', ({ meetingId, username }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      // Validate input
      if (!meetingId || !username) {
        return;
      }
      
      // Ensure user is in the correct room
      if (socket.meetingId !== meetingId) {
        return;
      }
      
      // Broadcast typing status to others in room
      socket.to(meetingId).emit('user-typing', { username });
      
      console.log(`User ${username} is typing in room ${meetingId}`);
    } catch (error) {
      console.error(`Error handling typing indicator:`, error);
    }
  });
  
  // Handle stopped typing events
  socket.on('user-stopped-typing', ({ meetingId, username }) => {
    try {
      // Validate input
      if (!meetingId || !username) {
        return;
      }
      
      // Ensure user is in the correct room
      if (socket.meetingId !== meetingId) {
        return;
      }
      
      // Broadcast stopped typing status to others in room
      socket.to(meetingId).emit('user-stopped-typing', { username });
      
      console.log(`User ${username} stopped typing in room ${meetingId}`);
    } catch (error) {
      console.error(`Error handling stopped typing indicator:`, error);
    }
  });
  
  // Handle message read receipts
  socket.on('message-read', ({ messageId, meetingId }) => {
    try {
      // Validate input
      if (!messageId || !meetingId) {
        return;
      }
      
      // Ensure user is in the correct room
      if (socket.meetingId !== meetingId) {
        return;
      }
      
      // Find the original sender socket ID from the message ID format: senderId-timestamp-random
      const senderIdMatch = messageId.match(/^([^-]+)-/);
      if (!senderIdMatch) {
        return;
      }
      
      const senderId = senderIdMatch[1];
      
      // Check if the sender is still connected
      const senderSocket = io.sockets.sockets.get(senderId);
      if (senderSocket) {
        // Notify the sender that their message was read
        senderSocket.emit('message-read-receipt', {
          messageId,
          readBy: socket.username || socket.id,
          timestamp: new Date().toISOString()
        });
        
        console.log(`Message ${messageId} was read by ${socket.username || socket.id}`);
      }
    } catch (error) {
      console.error(`Error handling message read receipt:`, error);
    }
  });
      
      // Limit history size
      const history = roomMessages.get(meetingId);
      if (history.length >= 100) {
        history.shift(); // Remove oldest message
      }
      
      // Add to history
      history.push(messageObj);
      
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { 
        message: 'Failed to send message', 
        code: 'MESSAGE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
  
  // WebRTC Signaling with enhanced reliability, monitoring, and error handling
  socket.on('offer', ({ targetId, offer, offererId, offererUsername }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      const actualOffererId = offererId || socket.id;
      const actualUsername = offererUsername || socket.username || 'Unknown User';
      
      console.log(`Offer from ${actualOffererId} (${actualUsername}) to ${targetId}`);
      
      if (!targetId || !offer) {
        socket.emit('error', { message: 'Invalid offer parameters' });
        return;
      }
      
      // Check if target is still connected with better error handling
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        console.warn(`Target ${targetId} not connected, notifying sender`);
        socket.emit('peer-unavailable', { 
          peerId: targetId,
          reason: 'Target peer is not connected'
        });
        return;
      }
      
      // Verify target is in the same room with clearer logging
      if (socket.meetingId && targetSocket.meetingId !== socket.meetingId) {
        console.warn(`Target ${targetId} not in the same room (${targetSocket.meetingId} vs ${socket.meetingId}), notifying sender`);
        socket.emit('peer-unavailable', { 
          peerId: targetId,
          reason: 'Target peer is not in the same room'
        });
        return;
      }
      
      // Log SDP offer details for debugging (truncated)
      if (offer && offer.sdp) {
        const sdpPreview = offer.sdp.substring(0, 100) + '...';
        console.log(`SDP offer from ${actualOffererId} to ${targetId} preview: ${sdpPreview}`);
        
        // Track if this is an ICE restart
        const isIceRestart = offer.sdp.includes('ice-options:renomination') || 
                            offer.sdp.includes('ice-options:trickle');
        if (isIceRestart) {
          console.log(`This is an ICE restart offer from ${actualOffererId} to ${targetId}`);
        }
      }
      
      // Send the offer with enhanced metadata
      socket.to(targetId).emit('offer', {
        offer,
        offererId: actualOffererId,
        offererUsername: actualUsername,
        timestamp: Date.now()
      });
      
      // Send acknowledgement to sender with enhanced information
      socket.emit('signaling-success', {
        type: 'offer',
        targetId,
        timestamp: Date.now(),
        targetUsername: targetSocket.username || 'Unknown User'
      });
      
    } catch (error) {
      console.error('Error handling offer:', error);
      socket.emit('error', { 
        message: 'Failed to send offer', 
        details: process.env.NODE_ENV === 'development' ? error.message : 'Server error processing offer'
      });
    }
  });
  
  socket.on('answer', ({ targetId, answer, answererId, answererUsername }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      const actualAnswererId = answererId || socket.id;
      const actualUsername = answererUsername || socket.username || 'Unknown User';
      
      console.log(`Answer from ${actualAnswererId} (${actualUsername}) to ${targetId}`);
      
      if (!targetId || !answer) {
        socket.emit('error', { message: 'Invalid answer parameters' });
        return;
      }
      
      // Check if target is still connected
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        console.warn(`Target ${targetId} not connected for answer, notifying sender`);
        socket.emit('peer-unavailable', { 
          peerId: targetId,
          reason: 'Target peer is not connected'
        });
        return;
      }
      
      // Send the answer with enhanced metadata
      socket.to(targetId).emit('answer', {
        answer,
        answererId: actualAnswererId,
        answererUsername: actualUsername,
        timestamp: Date.now()
      });
      
      // Send acknowledgement to sender
      socket.emit('signaling-success', {
        type: 'answer',
        targetId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling answer:', error);
      socket.emit('error', { 
        message: 'Failed to send answer', 
        details: NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
  
  socket.on('ice-candidate', ({ targetId, candidate, senderId }) => {
    try {
      // Don't update activity time for ICE candidates as they can be frequent
      
      if (!targetId || !candidate) {
        return; // Silently ignore invalid ICE candidates
      }
      
      const actualSenderId = senderId || socket.id;
      
      // Enhanced logging for different candidate types to help with debugging
      if (candidate.candidate) {
        const candidateStr = candidate.candidate;
        
        // Log different ICE candidate types with different verbosity
        if (candidateStr.includes('typ relay')) {
          // TURN relay candidates are the most important for NAT traversal
          console.log(`TURN relay candidate from ${actualSenderId} to ${targetId}: ${candidateStr}`);
        }
        else if (candidateStr.includes('typ srflx')) {
          // Server reflexive candidates - STUN derived
          console.log(`STUN candidate from ${actualSenderId} to ${targetId} (${candidateStr.split(' ')[4]} ${candidateStr.split(' ')[5]})`);
        }
        else if (candidateStr.includes('typ prflx')) {
          // Peer reflexive candidates - discovered during ICE
          console.log(`Peer reflexive candidate from ${actualSenderId} to ${targetId} (${candidateStr.split(' ')[4]} ${candidateStr.split(' ')[5]})`);
        }
        else if (candidateStr.includes('typ host')) {
          // Host candidates - local interfaces
          // These are very common so we'll use debug level
          if (process.env.DEBUG_ICE) {
            console.log(`Host candidate from ${actualSenderId} to ${targetId} (${candidateStr.split(' ')[4]} ${candidateStr.split(' ')[5]})`);
          }
        }
        
        // Track TCP candidates which can help with restrictive firewalls
        if (candidateStr.includes('tcptype')) {
          console.log(`TCP candidate from ${actualSenderId} to ${targetId}: ${candidateStr}`);
        }
      }
      
      // Check if target is still connected with better handling
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        // If the target is no longer connected, we should notify the sender
        // but only for the first candidate, not for all to avoid spamming
        if (!socket.notifiedMissingPeer || !socket.notifiedMissingPeer[targetId]) {
          // Initialize the tracking object if needed
          if (!socket.notifiedMissingPeer) socket.notifiedMissingPeer = {};
          
          // Mark this peer as notified
          socket.notifiedMissingPeer[targetId] = true;
          
          // Notify sender that peer is gone
          socket.emit('peer-unavailable', { 
            peerId: targetId,
            reason: 'Target peer disconnected during ICE negotiation'
          });
          
          console.log(`Target ${targetId} not available for ICE candidate from ${actualSenderId}, notified sender`);
        }
        return;
      }
      
      // Make sure peers are in the same room
      if (socket.meetingId && targetSocket.meetingId !== socket.meetingId) {
        if (!socket.notifiedWrongRoom || !socket.notifiedWrongRoom[targetId]) {
          if (!socket.notifiedWrongRoom) socket.notifiedWrongRoom = {};
          socket.notifiedWrongRoom[targetId] = true;
          
          socket.emit('peer-unavailable', { 
            peerId: targetId,
            reason: 'Target peer is in a different meeting room'
          });
          
          console.log(`Target ${targetId} in wrong room for ICE candidate from ${actualSenderId}, notified sender`);
        }
        return;
      }
      
      // Send the candidate with enhanced metadata
      socket.to(targetId).emit('ice-candidate', {
        candidate,
        senderId: actualSenderId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      // Don't send error response for ICE candidates to avoid spamming
    }
  });
  
  // Add new event handler for connection status tracking
  socket.on('connection-status', ({ peerId, status, details }) => {
    try {
      // This event is for monitoring/debugging WebRTC connection states
      console.log(`Connection status from ${socket.id} to ${peerId}: ${status}`);
      
      if (status === 'failed' || status === 'disconnected') {
        // Log the connection problem
        console.warn(`WebRTC connection problem between ${socket.id} and ${peerId}: ${status}`, details);
        
        // Notify the peer about the connection status if they're still connected
        const peerSocket = io.sockets.sockets.get(peerId);
        if (peerSocket) {
          peerSocket.emit('peer-connection-status', {
            peerId: socket.id,
            status,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Error handling connection status update:', error);
    }
  });
  
  // Add new event for manual peer reconnection requests
  socket.on('reconnect-peer', ({ targetId }) => {
    try {
      if (!targetId) {
        socket.emit('error', { message: 'Invalid reconnection parameters' });
        return;
      }
      
      console.log(`Reconnection request from ${socket.id} to ${targetId}`);
      
      // Check if target is still connected
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        socket.emit('peer-unavailable', { 
          peerId: targetId,
          reason: 'Target peer is not connected'
        });
        return;
      }
      
      // Notify target to initiate a new connection
      socket.to(targetId).emit('peer-reconnect-requested', {
        peerId: socket.id,
        username: socket.username,
        timestamp: Date.now()
      });
      
      socket.emit('reconnect-peer-requested', {
        peerId: targetId,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling reconnect request:', error);
      socket.emit('error', { message: 'Failed to request reconnection' });
    }
  });
  
  // Media Stream Status Updates with improved handling
  socket.on('media-status-changed', ({ meetingId, hasAudio, hasVideo }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      if (!socket.meetingId || !activeRooms.has(meetingId)) return;
      
      console.log(`Media status update from ${socket.id}: audio=${hasAudio}, video=${hasVideo}`);
      
      // Update user's media status
      const user = activeRooms.get(meetingId).get(socket.id);
      if (user) {
        user.hasAudio = hasAudio;
        user.hasVideo = hasVideo;
        
        // Broadcast updated status to all participants
        io.to(meetingId).emit('user-media-status-changed', {
          userId: socket.id,
          hasAudio,
          hasVideo
        });
      }
    } catch (error) {
      console.error('Error updating media status:', error);
      socket.emit('error', { message: 'Failed to update media status' });
    }
  });
  
  // Handle user requesting current room status
  socket.on('get-room-status', (meetingId, callback) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      if (!meetingId) {
        if (callback) callback({ success: false, error: 'Invalid meeting ID' });
        return;
      }
      
      const roomExists = activeRooms.has(meetingId);
      const participantCount = roomExists ? activeRooms.get(meetingId).size : 0;
      
      if (callback) {
        callback({
          success: true,
          exists: roomExists,
          participantCount,
          active: participantCount > 0
        });
      } else {
        socket.emit('room-status', {
          meetingId,
          exists: roomExists,
          participantCount,
          active: participantCount > 0
        });
      }
    } catch (error) {
      console.error('Error getting room status:', error);
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });
  
  // Handle user leaving a room
  socket.on('leave-room', (meetingId) => {
    try {
      console.log(`User ${socket.id} requested to leave room ${meetingId}`);
      handleUserLeaving(socket, meetingId);
    } catch (error) {
      console.error('Error handling leave-room:', error);
    }
  });
  
  // Connection monitoring - heartbeat to keep connection alive
  socket.on('heartbeat', () => {
    socket.lastActivity = Date.now();
    if (userActivity.has(socket.id)) {
      userActivity.get(socket.id).lastActivity = Date.now();
    }
    socket.emit('heartbeat-ack');
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    try {
      console.log(`User disconnected: ${socket.id} - Reason: ${reason}`);
      
      // Clean up all rooms this user was in
      if (socket.meetingId) {
        handleUserLeaving(socket, socket.meetingId);
      }
      
      // Clean up user activity tracking
      userActivity.delete(socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

/**
 * Handle user leaving a room with enhanced cleanup
 * @param {Object} socket - The socket connection of the leaving user
 * @param {String} meetingId - The ID of the meeting room
 */
function handleUserLeaving(socket, meetingId) {
  if (!socket.username || !meetingId) {
    console.log('Invalid user leaving parameters');
    return;
  }
  
  console.log(`Handling user leaving: ${socket.username} (${socket.id}) from room ${meetingId}`);
  
  // Remove user from tracking
  if (activeRooms.has(meetingId)) {
    const roomUsers = activeRooms.get(meetingId);
    
    // Check if user is actually in this room
    if (roomUsers.has(socket.id)) {
      // Remove the user from the room
      roomUsers.delete(socket.id);
      console.log(`Removed ${socket.id} from room ${meetingId}`);
      
      // If room is empty, remove it
      if (roomUsers.size === 0) {
        console.log(`Room ${meetingId} is now empty, removing it`);
        activeRooms.delete(meetingId);
      } else {
        // Otherwise notify others that the user left
        console.log(`Notifying others about ${socket.username} leaving`);
        
        socket.to(meetingId).emit('room-message', { 
          type: 'system', 
          text: `${socket.username} left the meeting.`,
          timestamp: new Date().toISOString()
        });
        
        // Update the participants list
        const participants = Array.from(roomUsers.values()).map(user => ({
          id: user.id,
          username: user.username,
          hasAudio: user.hasAudio,
          hasVideo: user.hasVideo
        }));
        
        // Notify others to clean up their WebRTC connections
        socket.to(meetingId).emit('user-left', {
          id: socket.id,
          username: socket.username
        });
        
        // Update the participants list for everyone
        io.to(meetingId).emit('room-users-changed', participants);
      }
    } else {
      console.log(`User ${socket.id} not found in room ${meetingId}`);
    }
  } else {
    console.log(`Room ${meetingId} not found`);
  }
  
  // Leave the socket.io room
  socket.leave(meetingId);
  
  // Clear socket properties
  socket.meetingId = null;
}

/**
 * Periodically check for inactive rooms and users
 */
setInterval(() => {
  const now = Date.now();
  const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
  
  // Check for inactive users
  for (const [socketId, data] of userActivity.entries()) {
    if (now - data.lastActivity > inactivityThreshold) {
      console.log(`Removing inactive user: ${socketId}`);
      
      // Get the socket if still connected
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        // Force disconnect
        if (socket.meetingId) {
          handleUserLeaving(socket, socket.meetingId);
        }
        socket.disconnect(true);
      }
      
      userActivity.delete(socketId);
    }
  }
  
  // Log active rooms
  console.log(`Active rooms: ${activeRooms.size}`);
  for (const [roomId, users] of activeRooms.entries()) {
    console.log(`- Room ${roomId}: ${users.size} users`);
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Add server status endpoint
app.get('/api/status', (req, res) => {
  try {
    const status = {
      uptime: process.uptime(),
      activeRooms: activeRooms.size,
      activeUsers: userActivity.size,
      timestamp: new Date().toISOString()
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
