import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Box, Typography, Paper, Button, TextField, Avatar, 
  Chip, Divider, Alert, Snackbar, List, ListItem, 
  ListItemAvatar, ListItemText, IconButton, Tooltip,
  useMediaQuery, useTheme, Badge
} from '@mui/material';

// Import Material UI icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PersonIcon from '@mui/icons-material/Person';
import ChatIcon from '@mui/icons-material/Chat';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export default function Meet() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State variables
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showMobileChatPanel, setShowMobileChatPanel] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Refs
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (!showMobileChatPanel && isMobile) {
      // If on mobile and chat panel is hidden, count unread messages
      const newMessageCount = messages.length - unreadMessages;
      if (newMessageCount > 0) {
        setUnreadMessages(messages.length);
      }
    } else {
      // Reset unread count when chat panel is visible
      setUnreadMessages(0);
      // Scroll to bottom with a slight delay to ensure rendering is complete
      const scrollTimer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, showMobileChatPanel, isMobile, unreadMessages]);

  useEffect(() => {
    // Get meeting info from session storage (set by Dashboard)
    let meetingInfo = {};
    try {
      const storedInfo = sessionStorage.getItem('nexus_meeting_info');
      if (storedInfo) {
        meetingInfo = JSON.parse(storedInfo);
        
        // Set initial mic/video state from stored preferences
        if (meetingInfo.micEnabled !== undefined) {
          setMicEnabled(meetingInfo.micEnabled);
        }
        
        if (meetingInfo.videoEnabled !== undefined) {
          setVideoEnabled(meetingInfo.videoEnabled);
        }
      }
    } catch (err) {
      console.error('Error loading meeting info:', err);
    }

    // If we don't have a username from session storage, use from localStorage or set default
    const displayName = meetingInfo.username || 
                        localStorage.getItem('nexus_displayName') || 
                        'Guest-' + Math.floor(Math.random() * 1000);
    
    setUsername(displayName);

    // Animation timing
    document.documentElement.style.setProperty('--animate-duration', '0.8s');

    // Connect to socket server with a slight delay for UI to initialize
    const connectionTimer = setTimeout(() => {
      socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        transports: ['websocket'],
        forceNew: true,
      });

      // Socket event listeners
      socketRef.current.on('connect', () => {
        setConnected(true);
        // Join the meeting room with our username
        socketRef.current.emit('join-room', { meetingId, username: displayName });
        
        // Add a system message that we joined
        setMessages([{ 
          type: 'system',
          text: `You joined the meeting as ${displayName}.`,
          timestamp: new Date().toISOString()
        }]);
        
        setSnackbar({
          open: true,
          message: 'Connected to meeting',
          severity: 'success'
        });
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setSnackbar({
          open: true,
          message: 'Failed to connect to meeting server',
          severity: 'error'
        });
      });

      // Handle incoming messages from other users
      socketRef.current.on('room-message', (msg) => {
        setMessages((prev) => [
          ...prev, 
          { 
            ...msg, 
            timestamp: new Date().toISOString() 
          }
        ]);
      });
      
      // Handle confirmation of our own messages
      socketRef.current.on('room-message-confirm', (msg) => {
        // Do nothing, as we've already added this message optimistically
      });

      socketRef.current.on('room-users', (users) => {
        setParticipants(users);
      });

      socketRef.current.on('room-users-changed', (users) => {
        setParticipants(users);
      });
    }, 500); // Small delay for better UX

    return () => {
      // Clean up when component unmounts
      clearTimeout(connectionTimer);
      
      if (socketRef.current) {
        socketRef.current.emit('leave-room', meetingId);
        socketRef.current.off('room-message');
        socketRef.current.off('room-users');
        socketRef.current.off('room-users-changed');
        socketRef.current.off('connect');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
      }
    };
  }, [meetingId]);

  const sendMessage = () => {
    if (input.trim() && socketRef.current && connected) {
      // Create a unique message ID for this message
      const messageId = `${socketRef.current.id}-${Date.now()}`;
      
      // Add our own message to the list immediately (optimistic UI update)
      const newMessage = { 
        id: socketRef.current.id,
        messageId,
        user: username, 
        text: input,
        timestamp: new Date().toISOString(),
        isLocal: true // Mark this as a local message so we don't duplicate it
      };
      
      setMessages((prev) => [...prev, newMessage]);
      
      // Send to server
      socketRef.current.emit('room-message', { 
        meetingId, 
        text: input,
        messageId // Pass the message ID to help with deduplication
      });
      
      setInput('');
    }
  };

  const leaveMeeting = () => {
    // Show confirmation before leaving
    const confirmLeave = window.confirm('Are you sure you want to leave the meeting?');
    if (confirmLeave) {
      navigate('/dashboard');
    }
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    setSnackbar({
      open: true,
      message: 'Meeting ID copied to clipboard',
      severity: 'success'
    });
  };
  
  const toggleMobileChat = () => {
    setShowMobileChatPanel(!showMobileChatPanel);
    // Reset unread count when opening chat
    if (!showMobileChatPanel) {
      setUnreadMessages(0);
    }
  };
  
  const toggleMic = () => {
    setMicEnabled(!micEnabled);
    // In a real app, you would also update the actual audio stream here
  };
  
  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
    // In a real app, you would also update the actual video stream here
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Format message for display with modern styling
  const formatMessage = (msg) => {
    // Format timestamp if available
    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return '';
      }
    };

    // System messages (joins, leaves, etc)
    if (msg.type === 'system') {
      return (
        <Box 
          key={msg.id || `system-${Math.random()}`}
          sx={{ 
            textAlign: 'center', 
            my: 1.5, 
            px: 1,
            animation: 'fadeIn 0.5s ease-out'
          }}
        >
          <Chip
            label={msg.text}
            size="small"
            variant="outlined"
            sx={{ 
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              borderColor: 'rgba(255,255,255,0.1)',
              bgcolor: 'rgba(0,0,0,0.2)',
              px: 1
            }}
          />
        </Box>
      );
    }
    
    // Regular user messages
    const isOwnMessage = msg.id === socketRef.current?.id;
    const messageTime = formatTime(msg.timestamp);
    
    return (
      <Box 
        key={msg.id || Math.random().toString()} 
        className="animate-in"
        sx={{ 
          display: 'flex', 
          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
          mb: 1.5,
          maxWidth: '100%',
        }}
      >
        {!isOwnMessage && (
          <Avatar 
            sx={{ 
              width: 32, 
              height: 32, 
              mr: 1, 
              mt: 0.5,
              bgcolor: 'var(--color-primary)',
              fontSize: '0.9rem',
              display: { xs: 'none', sm: 'flex' }
            }}
          >
            {msg.user && msg.user[0]}
          </Avatar>
        )}
        
        <Box 
          sx={{ 
            maxWidth: '80%',
            position: 'relative'
          }}
        >
          {!isOwnMessage && (
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: '600',
                color: 'var(--color-secondary)',
                ml: { xs: 0, sm: 0 },
                mb: 0.3,
                display: 'block'
              }}
            >
              {msg.user}
            </Typography>
          )}
          
          <Paper 
            elevation={isOwnMessage ? 1 : 0}
            sx={{ 
              py: 1,
              px: 1.5, 
              borderRadius: isOwnMessage 
                ? '18px 18px 4px 18px'
                : '18px 18px 18px 4px',
              bgcolor: isOwnMessage 
                ? 'var(--color-primary)'
                : 'rgba(255, 255, 255, 0.08)',
              color: isOwnMessage 
                ? '#fff' 
                : 'var(--text-secondary)',
              wordBreak: 'break-word',
              backdropFilter: 'blur(10px)',
              border: !isOwnMessage ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
            }}
          >
            <Typography variant="body2">{msg.text}</Typography>
          </Paper>
          
          {messageTime && (
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'var(--text-muted)',
                fontSize: '0.65rem',
                mt: 0.3,
                mr: 0.5,
                textAlign: isOwnMessage ? 'right' : 'left',
                display: 'block'
              }}
            >
              {messageTime}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      minWidth: '100vw',
      background: 'var(--gradient-primary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Header with controls */}
      <Box 
        sx={{ 
          py: { xs: 1.5, md: 2 },
          px: { xs: 2, md: 3 },
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(10, 10, 20, 0.5)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          zIndex: 10
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          <Typography 
            className="text-gradient"
            variant={isSmall ? 'h6' : 'h5'} 
            fontWeight="bold"
            sx={{ 
              mr: 1,
              fontFamily: 'var(--font-secondary)',
            }}
          >
            Nexus Meet
          </Typography>
          
          <Chip
            variant="outlined"
            size={isSmall ? "small" : "medium"}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 'medium', mr: 0.5 }}>
                  ID: {meetingId}
                </Typography>
              </Box>
            }
            deleteIcon={<ContentCopyIcon fontSize="small" />}
            onDelete={copyMeetingId}
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.15)',
              '& .MuiChip-label': {
                px: 1,
                color: 'var(--text-secondary)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'var(--color-secondary)',
                '&:hover': { color: 'var(--color-primary)' }
              }
            }}
          />
        </Box>
        
        {/* Right side controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          {/* Mobile chat toggle button with badge for unread messages */}
          {isMobile && (
            <Badge badgeContent={unreadMessages} color="primary">
              <IconButton 
                color={showMobileChatPanel ? "primary" : "default"}
                onClick={toggleMobileChat}
                sx={{ color: 'white' }}
              >
                <ChatIcon />
              </IconButton>
            </Badge>
          )}
          
          <Button
            variant="contained"
            color="error"
            onClick={leaveMeeting}
            startIcon={!isSmall && <CallEndIcon />}
            sx={{
              ml: { xs: 0.5, sm: 1 },
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.5, sm: 0.75 },
              borderRadius: 'var(--button-radius)',
              boxShadow: 'var(--shadow-soft)',
              backgroundColor: '#f44336',
              '&:hover': {
                backgroundColor: '#d32f2f'
              }
            }}
          >
            {isSmall ? <CallEndIcon fontSize="small" /> : "Leave"}
          </Button>
        </Box>
      </Box>
      
      {/* Main content with responsive layout */}
      <Box sx={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' }, 
        height: { xs: 'calc(100vh - 60px)', md: 'calc(100vh - 76px)' },
        position: 'relative',
      }}>
        {/* Main chat area - hidden on mobile when participant list is shown */}
        <Box sx={{ 
          flex: 3,
          display: { 
            xs: showMobileChatPanel || !isMobile ? 'flex' : 'none', 
            md: 'flex'
          },
          flexDirection: 'column',
          height: '100%',
          position: { xs: 'absolute', md: 'relative' },
          top: 0,
          left: 0,
          width: '100%',
          zIndex: { xs: 5, md: 1 },
          bgcolor: { xs: 'rgba(10, 10, 20, 0.97)', md: 'transparent' },
        }}>
          {/* Chat message container */}
          <Box sx={{ 
            flex: 1,
            overflowY: 'auto',
            p: { xs: 2, md: 3 },
            pb: 2,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgba(15, 15, 25, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: { xs: 0, md: 'var(--card-radius)' },
            m: { xs: 0, md: 2 },
            mb: { xs: 0, md: 1 },
          }}>
            {/* Empty state for no messages */}
            {messages.length === 0 && (
              <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                opacity: 0.6,
              }}>
                <ChatIcon sx={{ fontSize: 48, mb: 2, color: 'var(--color-secondary)' }} />
                <Typography variant="body2" color="var(--text-muted)" textAlign="center">
                  No messages yet. Start the conversation!
                </Typography>
              </Box>
            )}
            
            {/* Messages */}
            {messages.map(formatMessage)}
            <div ref={messagesEndRef} />
          </Box>
          
          {/* Chat input area */}
          <Box sx={{ 
            p: { xs: 2, md: 2 },
            pb: { xs: 3, md: 3 },
            pt: { xs: 2, md: 1 },
            backgroundColor: 'rgba(15, 15, 25, 0.6)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <Box 
              sx={{ 
                display: 'flex',
                gap: 1,
                px: { xs: 0, md: 1 },
                maxWidth: '900px',
                mx: 'auto',
              }}
            >
              <TextField 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                fullWidth
                placeholder="Type a message..." 
                variant="outlined"
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                disabled={!connected}
                multiline
                maxRows={3}
                InputProps={{
                  sx: {
                    borderRadius: 'var(--input-radius)',
                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(5px)',
                    color: 'var(--text-primary)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'var(--color-secondary)',
                    }
                  }
                }}
              />
              <Button 
                variant="contained" 
                onClick={sendMessage}
                disabled={!connected || !input.trim()}
                sx={{ 
                  background: 'var(--gradient-accent)',
                  borderRadius: 'var(--button-radius)',
                  boxShadow: 'var(--shadow-soft)',
                  minWidth: 0,
                  width: { xs: '44px', sm: 'auto' },
                  height: '100%',
                  px: { xs: 0, sm: 2 }
                }}
              >
                <SendIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                <Typography sx={{ ml: 1, display: { xs: 'none', sm: 'block' } }}>Send</Typography>
              </Button>
            </Box>
            
            {/* Meeting controls for future video/audio implementation */}
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center',
              mt: 2,
              gap: { xs: 2, md: 3 },
              maxWidth: '600px',
              mx: 'auto',
              pt: 1,
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <Tooltip title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}>
                <IconButton 
                  onClick={toggleMic}
                  sx={{ 
                    bgcolor: micEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(244, 67, 54, 0.2)',
                    '&:hover': { bgcolor: micEnabled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(244, 67, 54, 0.3)' },
                    color: micEnabled ? 'white' : '#f44336',
                  }}
                >
                  {micEnabled ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
              </Tooltip>
              
              <Tooltip title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}>
                <IconButton 
                  onClick={toggleVideo}
                  sx={{ 
                    bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(244, 67, 54, 0.2)',
                    '&:hover': { bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(244, 67, 54, 0.3)' },
                    color: videoEnabled ? 'white' : '#f44336',
                  }}
                >
                  {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Leave Meeting">
                <IconButton 
                  onClick={leaveMeeting}
                  sx={{ 
                    bgcolor: 'rgba(244, 67, 54, 0.8)',
                    '&:hover': { bgcolor: 'rgba(244, 67, 54, 1)' },
                    color: 'white',
                  }}
                >
                  <CallEndIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
        
        {/* Participants panel - always shown on desktop, conditionally on mobile */}
        <Box sx={{ 
          flex: 1,
          maxWidth: { xs: '100%', md: '320px' },
          display: { 
            xs: !showMobileChatPanel || !isMobile ? 'flex' : 'none', 
            md: 'flex'
          },
          flexDirection: 'column',
          height: '100%',
          bgcolor: 'rgba(15, 15, 25, 0.5)',
          backdropFilter: 'blur(10px)',
          borderLeft: { md: '1px solid rgba(255, 255, 255, 0.05)' },
          boxShadow: { xs: 'none', md: '-5px 0 20px rgba(0, 0, 0, 0.1)' },
          overflow: 'hidden',
          zIndex: { xs: 1, md: 2 }
        }}>
          {/* Participants header */}
          <Box sx={{ 
            px: 2, 
            py: 2, 
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ color: 'var(--color-secondary)' }} />
              <Typography variant="subtitle1" fontWeight="600" color="var(--text-primary)">
                Participants ({participants.length})
              </Typography>
            </Box>
            
            {isMobile && (
              <IconButton 
                size="small" 
                onClick={toggleMobileChat}
                sx={{ color: 'var(--text-secondary)' }}
              >
                <ChatIcon fontSize="small" />
                {unreadMessages > 0 && (
                  <Badge 
                    badgeContent={unreadMessages} 
                    color="primary"
                    sx={{ 
                      position: 'absolute', 
                      top: -2, 
                      right: -2,
                    }}
                  />
                )}
              </IconButton>
            )}
          </Box>
          
          {/* Participants list */}
          <List sx={{ 
            overflowY: 'auto', 
            flex: 1, 
            pt: 0,
            '& .MuiListItem-root': {
              borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
            }
          }}>
            {participants.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Typography variant="body2">
                  No participants yet
                </Typography>
              </Box>
            ) : (
              participants.map((participant) => {
                const isCurrentUser = participant.id === socketRef.current?.id;
                return (
                  <ListItem 
                    key={participant.id}
                    sx={{ 
                      py: 1,
                      bgcolor: isCurrentUser ? 'rgba(106, 17, 203, 0.1)' : 'transparent'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        sx={{ 
                          bgcolor: isCurrentUser ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)',
                          color: isCurrentUser ? 'white' : 'var(--color-secondary)',
                          fontWeight: 'bold'
                        }}
                      >
                        {participant.username[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            color: isCurrentUser ? 'var(--color-secondary)' : 'var(--text-secondary)',
                            fontWeight: isCurrentUser ? 600 : 400
                          }}
                        >
                          {participant.username}
                          {isCurrentUser && ' (You)'}
                        </Typography>
                      }
                    />
                  </ListItem>
                );
              })
            )}
          </List>
          
          {/* User status */}
          <Box sx={{ 
            p: 2, 
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            bgcolor: 'rgba(10, 10, 20, 0.3)'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  bgcolor: 'var(--color-primary)',
                  fontSize: '0.9rem'
                }}
              >
                {username[0]}
              </Avatar>
              <Box>
                <Typography variant="body2" color="var(--text-primary)" fontWeight={500}>
                  {username}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: connected ? 'var(--color-success)' : 'var(--color-error)',
                    }}
                  />
                  <Typography variant="caption" color="var(--text-muted)">
                    {connected ? 'Connected' : 'Disconnected'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      
      {/* Notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ 
            width: '100%',
            borderRadius: 'var(--card-radius)',
            boxShadow: 'var(--shadow-strong)'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
