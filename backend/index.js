const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins (for development)
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = 5000;
const activeRooms = new Map(); // Track active meeting rooms

app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

// API route to generate a unique meeting ID
app.get('/api/generate-meeting-id', (req, res) => {
  const meetingId = uuidv4().substring(0, 8); // Generate a shorter UUID
  res.json({ meetingId });
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle joining a specific meeting room
  socket.on('join-room', ({ meetingId, username }) => {
    socket.join(meetingId);
    socket.username = username;
    socket.meetingId = meetingId;
    
    // Track this user in the room
    if (!activeRooms.has(meetingId)) {
      activeRooms.set(meetingId, new Map());
    }
    activeRooms.get(meetingId).set(socket.id, {
      id: socket.id,
      username
    });
    
    // Notify others in the room
    socket.to(meetingId).emit('room-message', { 
      type: 'system', 
      text: `${username} joined the meeting.` 
    });
    
    // Send the list of participants to the new joiner
    const participants = Array.from(activeRooms.get(meetingId).values()).map(user => ({
      id: user.id,
      username: user.username
    }));
    
    socket.emit('room-users', participants);
    
    // Broadcast to everyone that user list has changed
    io.to(meetingId).emit('room-users-changed', participants);
  });
  
  // Handle room-specific messages
  socket.on('room-message', ({ meetingId, text }) => {
    if (!socket.username) return;
    
    // Create the message object once to ensure consistency
    const messageObj = {
      id: socket.id,
      user: socket.username,
      text
    };
    
    // Send to sender (acknowledgement)
    socket.emit('room-message-confirm', messageObj);
    
    // Send to everyone else in the room
    socket.to(meetingId).emit('room-message', messageObj);
  });
  
  // Handle user leaving a room
  socket.on('leave-room', (meetingId) => {
    handleUserLeaving(socket, meetingId);
  });
  
  socket.on('disconnect', () => {
    if (socket.meetingId) {
      handleUserLeaving(socket, socket.meetingId);
    }
    console.log('User disconnected:', socket.id);
  });
});

function handleUserLeaving(socket, meetingId) {
  if (!socket.username || !meetingId) return;
  
  // Remove user from tracking
  if (activeRooms.has(meetingId)) {
    const roomUsers = activeRooms.get(meetingId);
    roomUsers.delete(socket.id);
    
    // If room is empty, remove it
    if (roomUsers.size === 0) {
      activeRooms.delete(meetingId);
    } else {
      // Otherwise notify others that the user left
      socket.to(meetingId).emit('room-message', { 
        type: 'system', 
        text: `${socket.username} left the meeting.` 
      });
      
      // Update the participants list
      const participants = Array.from(roomUsers.values()).map(user => ({
        id: user.id,
        username: user.username
      }));
      
      io.to(meetingId).emit('room-users-changed', participants);
    }
  }
  
  socket.leave(meetingId);
};

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
