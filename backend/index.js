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
      
      // Validate inputs
      if (!meetingId || typeof meetingId !== 'string') {
        socket.emit('error', { message: 'Invalid meeting ID' });
        return;
      }
      
      if (!username || typeof username !== 'string') {
        username = `Guest-${Math.floor(Math.random() * 1000)}`;
      }
      
      // Join the socket room
      await socket.join(meetingId);
      socket.username = username;
      socket.meetingId = meetingId;
      
      // Track this user in the room
      if (!activeRooms.has(meetingId)) {
        console.log(`Creating new meeting room: ${meetingId}`);
        activeRooms.set(meetingId, new Map());
      }
      
      activeRooms.get(meetingId).set(socket.id, {
        id: socket.id,
        username,
        hasAudio: true,
        hasVideo: true,
        joinedAt: Date.now()
      });
      
      // Log room stats
      console.log(`Room ${meetingId} now has ${activeRooms.get(meetingId).size} participants`);
      
      // Notify others in the room
      socket.to(meetingId).emit('room-message', { 
        type: 'system', 
        text: `${username} joined the meeting.` 
      });
      
      // Send the list of participants to the new joiner
      const participants = Array.from(activeRooms.get(meetingId).values()).map(user => ({
        id: user.id,
        username: user.username,
        hasAudio: user.hasAudio,
        hasVideo: user.hasVideo
      }));
      
      socket.emit('room-users', participants);
      
      // Broadcast to everyone that user list has changed
      io.to(meetingId).emit('room-users-changed', participants);
      
      // Notify others to send their signals to the new participant
      socket.to(meetingId).emit('user-joined', { 
        id: socket.id, 
        username,
        hasAudio: true,
        hasVideo: true
      });
      
      // Acknowledge successful join
      socket.emit('joined-room', { 
        success: true, 
        meetingId, 
        participantCount: participants.length 
      });
    } catch (error) {
      console.error(`Error joining room ${meetingId}:`, error);
      socket.emit('error', { 
        message: 'Failed to join meeting room', 
        details: NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
  
  // Handle room-specific messages with improved validation
  socket.on('room-message', ({ meetingId, text, messageId }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      if (userActivity.has(socket.id)) {
        userActivity.get(socket.id).lastActivity = Date.now();
      }
      
      // Check if user is in a room
      if (!socket.username || !socket.meetingId) {
        socket.emit('error', { message: 'You are not in a meeting room' });
        return;
      }
      
      // Validate message
      if (!text || typeof text !== 'string') {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }
      
      // Filter message text if needed (optional profanity filter)
      const filteredText = text; // Replace with actual filtering if needed
      
      // Create the message object once to ensure consistency
      const messageObj = {
        id: socket.id,
        messageId: messageId || `${socket.id}-${Date.now()}`,
        user: socket.username,
        text: filteredText,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Message from ${socket.username} in room ${meetingId}: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
      
      // Send to sender (acknowledgement)
      socket.emit('room-message-confirm', messageObj);
      
      // Send to everyone else in the room
      socket.to(meetingId).emit('room-message', messageObj);
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // WebRTC Signaling with enhanced reliability
  socket.on('offer', ({ targetId, offer }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      console.log(`Offer from ${socket.id} to ${targetId}`);
      
      if (!targetId || !offer) {
        socket.emit('error', { message: 'Invalid offer parameters' });
        return;
      }
      
      // Check if target is still connected
      const targetSocket = io.sockets.sockets.get(targetId);
      if (!targetSocket) {
        socket.emit('error', { message: 'Target peer is not connected' });
        return;
      }
      
      socket.to(targetId).emit('offer', {
        offer,
        offererId: socket.id,
        offererUsername: socket.username
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      socket.emit('error', { message: 'Failed to send offer' });
    }
  });
  
  socket.on('answer', ({ targetId, answer }) => {
    try {
      // Update last activity time
      socket.lastActivity = Date.now();
      
      console.log(`Answer from ${socket.id} to ${targetId}`);
      
      if (!targetId || !answer) {
        socket.emit('error', { message: 'Invalid answer parameters' });
        return;
      }
      
      socket.to(targetId).emit('answer', {
        answer,
        answererId: socket.id
      });
    } catch (error) {
      console.error('Error handling answer:', error);
      socket.emit('error', { message: 'Failed to send answer' });
    }
  });
  
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    try {
      // Don't update activity time for ICE candidates as they can be frequent
      
      if (!targetId || !candidate) {
        return; // Silently ignore invalid ICE candidates
      }
      
      socket.to(targetId).emit('ice-candidate', {
        candidate,
        senderId: socket.id
      });
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      // Don't send error response for ICE candidates
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
