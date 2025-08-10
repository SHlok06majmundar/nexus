import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Container, Box, Typography, Button, TextField, Paper } from '@mui/material';

const socket = io('http://localhost:5000');

function App() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      socket.off('message');
    };
  }, []);

  const handleJoin = () => {
    if (username.trim()) {
      setJoined(true);
      socket.emit('join', username);
    }
  };

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit('message', { user: username, text: input });
      setInput('');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={4} sx={{ width: '100%', padding: 4, borderRadius: 3 }}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h3" fontWeight="bold" color="primary">nexus-meet</Typography>
          <Typography variant="subtitle1" color="text.secondary">Professional, real-time meetings. Responsive for all screens.</Typography>
        </Box>
        {!joined ? (
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField label="Enter your name" value={username} onChange={e => setUsername(e.target.value)} fullWidth />
            <Button variant="contained" size="large" onClick={handleJoin}>Join Meeting</Button>
          </Box>
        ) : (
          <Box>
            <Box mb={2}>
              <Typography variant="h6">Chat</Typography>
              <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: '#f5f5f5', borderRadius: 2, p: 2 }}>
                {messages.map((msg, idx) => (
                  <Typography key={idx} variant="body2"><b>{msg.user}:</b> {msg.text}</Typography>
                ))}
              </Box>
            </Box>
            <Box display="flex" gap={1}>
              <TextField label="Type a message" value={input} onChange={e => setInput(e.target.value)} fullWidth onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <Button variant="contained" onClick={sendMessage}>Send</Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default App;
