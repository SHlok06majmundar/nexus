const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const PORT = 5000;

app.get('/', (req, res) => {
  res.send('Hello from backend!');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('join', (username) => {
    socket.username = username;
    socket.broadcast.emit('message', { user: 'System', text: `${username} joined the meeting.` });
  });
  socket.on('message', (msg) => {
    io.emit('message', msg);
  });
  socket.on('disconnect', () => {
    if (socket.username) {
      socket.broadcast.emit('message', { user: 'System', text: `${socket.username} left the meeting.` });
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
