import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { 
  useMediaQuery, Box, Avatar, Typography, Paper, Button, 
  Alert, Snackbar, Grid, TextField, IconButton, Tooltip,
  Card, CardContent, Divider, Chip, CircularProgress, List, ListItem,
  Container
} from '@mui/material';

// Import icons
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import HistoryIcon from '@mui/icons-material/History';


export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  
  // States
  const [displayName, setDisplayName] = useState(user?.fullName || user?.username || '');
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [meetingId, setMeetingId] = useState('');
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  // Load preferences from localStorage
  useEffect(() => {
    // Load saved preferences
    const savedName = localStorage.getItem('nexus_displayName');
    const savedMic = localStorage.getItem('nexus_micPreference');
    const savedVideo = localStorage.getItem('nexus_videoPreference');
    const savedRecentMeetings = localStorage.getItem('nexus_recentMeetings');
    
    if (savedName) setDisplayName(savedName);
    if (savedMic !== null) setMicOn(savedMic === 'true');
    if (savedVideo !== null) setVideoOn(savedVideo === 'true');
    
    // Load recent meetings
    if (savedRecentMeetings) {
      try {
        const meetings = JSON.parse(savedRecentMeetings);
        setRecentMeetings(meetings.slice(0, 5)); // Keep last 5 meetings
      } catch (e) {
        console.error('Error loading recent meetings', e);
      }
    }
    
    // Animate entrance
    const timer = setTimeout(() => {
      document.querySelector('.dashboard-container')?.classList.add('visible');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Save preferences whenever they change
  useEffect(() => {
    localStorage.setItem('nexus_displayName', displayName);
    localStorage.setItem('nexus_micPreference', micOn.toString());
    localStorage.setItem('nexus_videoPreference', videoOn.toString());
  }, [displayName, micOn, videoOn]);

  // Generate a secure meeting ID
  const generateMeetingId = async () => {
    try {
      setIsGenerating(true);
      // Get a secure meeting ID from the backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/generate-meeting-id`);
      if (!response.ok) throw new Error('Failed to generate meeting ID');
      const data = await response.json();
      setIsGenerating(false);
      return data.meetingId;
    } catch (error) {
      setIsGenerating(false);
      console.error('Error generating meeting ID:', error);
      
      // Fallback to client-side generation if server fails
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      return Array.from(array, dec => dec.toString(36)).join('').slice(0, 8);
    }
  };

  // Join or create a meeting
  const handleJoinMeeting = async () => {
    let id = meetingId;
    let usedFallback = false;
    if (!id) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:5000'}/api/generate-meeting-id`);
        if (!response.ok) throw new Error('Failed to generate meeting ID');
        const data = await response.json();
        id = data.meetingId;
        setMeetingId(id);
      } catch (err) {
        // Fallback to client-side generation if server fails
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        id = Array.from(array, dec => dec.toString(36)).join('').slice(0, 8);
        setMeetingId(id);
        usedFallback = true;
      }
    }
    // Store meeting info including mic and video preferences
    sessionStorage.setItem('nexus_meeting_info', JSON.stringify({ 
      meetingId: id, 
      username: displayName,
      micEnabled: micOn,
      videoEnabled: videoOn
    }));
    navigate(`/meet/${id}`);
    if (usedFallback) {
      setSnackbar({ open: true, message: 'Warning: Server unavailable, using local meeting ID.', severity: 'warning' });
    }
  };
  
  // Copy meeting ID to clipboard
  const copyMeetingId = (id) => {
    navigator.clipboard.writeText(id);
    setSnackbar({
      open: true,
      message: 'Meeting ID copied to clipboard',
      severity: 'success'
    });
  };
  
  // Join a recent meeting
  const joinRecentMeeting = (id) => {
    setMeetingId(id);
    handleJoinMeeting();
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Format date to relative time
  const formatRelativeTime = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);
      
      if (diffInSeconds < 60) return 'just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    } catch (e) {
      return 'recently';
    }
  };

  return (
    <Box
      className="dashboard-container"
      sx={{ 
        minHeight: '100vh',
        width: '100%',
        background: 'var(--gradient-primary)',
        display: 'flex',
        flexDirection: 'column',
        opacity: 0,
        transition: 'opacity 0.8s ease',
        overflow: 'auto',
        pb: 4,
        '&.visible': {
          opacity: 1,
        }
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          py: { xs: 2, md: 3 },
          px: { xs: 2, md: 4 },
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <Typography 
          className="text-gradient"
          variant={isSmall ? 'h5' : 'h4'} 
          fontWeight="bold"
          sx={{ fontFamily: 'var(--font-secondary)' }}
        >
          Nexus Meet
        </Typography>
        
        {/* User avatar with dropdown menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'var(--text-secondary)',
              display: { xs: 'none', sm: 'block' },
              fontWeight: 500
            }}
          >
            {user?.fullName || user?.username}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton 
              onClick={() => {
                // Using the Clerk signOut method properly
                signOut().then(() => {
                  // Redirect to the home page after successful sign out
                  navigate('/');
                }).catch(error => {
                  console.error('Error signing out:', error);
                  setSnackbar({
                    open: true,
                    message: 'Failed to sign out. Please try again.',
                    severity: 'error'
                  });
                });
              }}
              sx={{ 
                color: 'var(--text-muted)',
                '&:hover': { color: 'var(--color-primary)' }
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Avatar 
            src={user?.imageUrl}
            sx={{ 
              width: 36, 
              height: 36,
              background: 'var(--gradient-accent)',
              color: 'white'
            }}
          >
            {(user?.firstName?.[0] || user?.username?.[0] || 'U')}
          </Avatar>
        </Box>
      </Box>
      
      {/* Main content */}
      <Container maxWidth="xl">
        <Box 
          sx={{ 
            flex: 1,
            width: '100%',
            mx: 'auto',
            px: { xs: 1, sm: 2, md: 3 },
            py: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: { xs: 4, md: 6 },
          }}
        >
          {/* Left column - Start/Join meeting card */}
          <Box sx={{ 
            flex: 1,
            width: '100%',
          }}>
            <Card 
              elevation={2}
              sx={{ 
                borderRadius: 'var(--card-radius)',
                p: { xs: 2, md: 4 },
                mb: 4,
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography 
                    variant="h4" 
                    fontWeight="700"
                    className="text-gradient" 
                    sx={{ mb: 1 }}
                  >
                    {meetingId ? 'Join Meeting' : 'Start New Meeting'}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'var(--text-secondary)' }}>
                    Set up your preferences before starting
                  </Typography>
                </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1, 
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}
                >
                  Your display name in meetings
                </Typography>
                <TextField
                  fullWidth
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  variant="outlined"
                  InputProps={{
                    sx: {
                      borderRadius: 'var(--input-radius)',
                      bgcolor: 'rgba(245, 247, 250, 0.8)',
                      color: 'var(--text-primary)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--color-primary)',
                      }
                    }
                  }}
                />
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1.5, 
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}
                >
                  Device settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid lg={6} md={6} sm={6} xs={6}>
                    <Button
                      fullWidth
                      variant={micOn ? "contained" : "outlined"}
                      onClick={() => setMicOn(!micOn)}
                      startIcon={micOn ? <MicIcon /> : <MicOffIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 'var(--button-radius)',
                        backgroundColor: micOn ? 'var(--color-primary)' : 'transparent',
                        borderColor: micOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.2)',
                        color: micOn ? 'white' : 'var(--color-primary)',
                        '&:hover': {
                          backgroundColor: micOn ? 'var(--color-secondary)' : 'rgba(106,17,203,0.05)',
                        }
                      }}
                    >
                      {micOn ? 'Mic On' : 'Mic Off'}
                    </Button>
                  </Grid>
                  <Grid lg={6} md={6} sm={6} xs={6}>
                    <Button
                      fullWidth
                      variant={videoOn ? "contained" : "outlined"}
                      onClick={() => setVideoOn(!videoOn)}
                      startIcon={videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
                      sx={{
                        py: 1.5,
                        borderRadius: 'var(--button-radius)',
                        backgroundColor: videoOn ? 'var(--color-primary)' : 'transparent',
                        borderColor: videoOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.2)',
                        color: videoOn ? 'white' : 'var(--color-primary)',
                        '&:hover': {
                          backgroundColor: videoOn ? 'var(--color-secondary)' : 'rgba(106,17,203,0.05)',
                        }
                      }}
                    >
                      {videoOn ? 'Video On' : 'Video Off'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
              
              <Box sx={{ mb: 4 }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 1, 
                    color: 'var(--text-secondary)',
                    fontWeight: 600
                  }}
                >
                  {meetingId ? 'Meeting ID' : 'Enter Meeting ID to join or leave blank to create new meeting'}
                </Typography>
                <TextField
                  fullWidth
                  value={meetingId}
                  onChange={e => setMeetingId(e.target.value)}
                  placeholder="Meeting ID"
                  variant="outlined"
                  InputProps={{
                    endAdornment: meetingId ? (
                      <IconButton size="small" onClick={() => copyMeetingId(meetingId)}>
                        <ContentCopyIcon fontSize="small" sx={{ color: 'var(--color-secondary)' }} />
                      </IconButton>
                    ) : null,
                    sx: {
                      borderRadius: 'var(--input-radius)',
                      bgcolor: 'rgba(245, 247, 250, 0.8)',
                      color: 'var(--text-primary)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.1)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--color-primary)',
                      }
                    }
                  }}
                />
              </Box>
              
              <Button 
                fullWidth
                size="large"
                variant="contained"
                disabled={isGenerating}
                onClick={handleJoinMeeting}
                sx={{
                  py: 2,
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  background: 'var(--gradient-accent)',
                  borderRadius: 'var(--button-radius)',
                  boxShadow: 'var(--shadow-glow)',
                  color: 'white',
                  '&:hover': {
                    boxShadow: 'var(--shadow-strong)'
                  },
                  animation: isGenerating ? 'none' : 'pulse 2s infinite'
                }}
              >
                {isGenerating ? (
                  <CircularProgress size={24} color="inherit" />
                ) : meetingId ? (
                  'Join Meeting'
                ) : (
                  'Start New Meeting'
                )}
              </Button>
            </CardContent>
          </Card>
          
          {/* Recent meetings section */}
          {recentMeetings.length > 0 && (
            <Card 
              elevation={2}
              sx={{ 
                borderRadius: 'var(--card-radius)',
                overflow: 'hidden',
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <Box sx={{
                p: 2,
                backgroundColor: 'rgba(106, 17, 203, 0.03)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <HistoryIcon sx={{ color: 'var(--color-primary)', mr: 1 }} />
                <Typography variant="subtitle1" fontWeight="600" color="var(--text-secondary)">
                  Recent Meetings
                </Typography>
              </Box>
              <List sx={{ p: 0 }}>
                {recentMeetings.map((meeting, index) => (
                  <React.Fragment key={meeting.id}>
                    <Box 
                      sx={{ 
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s',
                        '&:hover': {
                          backgroundColor: 'rgba(106, 17, 203, 0.03)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box 
                          sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: '12px', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(106, 17, 203, 0.1)',
                            mr: 2
                          }}
                        >
                          <Typography 
                            variant="body1" 
                            fontFamily="monospace"
                            fontWeight="bold"
                            color="var(--color-primary)"
                          >
                            {meeting.id.substring(0, 2)}
                          </Typography>
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="var(--text-primary)">
                              {meeting.id}
                            </Typography>
                            {meeting.isCreator && (
                              <Chip
                                label="Created by you"
                                size="small"
                                sx={{ 
                                  height: 20, 
                                  fontSize: '0.65rem',
                                  backgroundColor: 'rgba(106, 17, 203, 0.1)',
                                  color: 'var(--color-primary)',
                                  borderRadius: '4px'
                                }}
                              />
                            )}
                          </Box>
                          <Typography variant="caption" color="var(--text-muted)">
                            Joined {formatRelativeTime(meeting.joinedAt)}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Copy meeting ID">
                          <IconButton 
                            size="small"
                            onClick={() => copyMeetingId(meeting.id)}
                            sx={{ color: 'var(--text-muted)' }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => joinRecentMeeting(meeting.id)}
                          sx={{
                            borderRadius: 'var(--button-radius)',
                            borderColor: 'rgba(106, 17, 203, 0.2)',
                            color: 'var(--color-primary)',
                            '&:hover': {
                              borderColor: 'var(--color-primary)',
                              backgroundColor: 'rgba(106, 17, 203, 0.05)',
                            }
                          }}
                        >
                          Join
                        </Button>
                      </Box>
                    </Box>
                    {index < recentMeetings.length - 1 && (
                      <Divider sx={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }} />
                    )}
                  </React.Fragment>
                ))}
              </List>
            </Card>
          )}
        </Box>
        
        {/* Right column - Features and info */}
        <Box sx={{ 
          flex: 1,
          display: { xs: 'none', md: 'block' },
        }}>
          <Card 
            elevation={2}
            sx={{ 
              borderRadius: 'var(--card-radius)',
              p: 4,
              height: '100%',
              background: 'var(--gradient-secondary)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-soft)',
              border: '1px solid rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Decorative elements */}
            <Box sx={{ 
              position: 'absolute',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(106, 17, 203, 0.08) 0%, rgba(255, 255, 255, 0) 70%)',
              top: '-100px',
              right: '-100px',
              zIndex: 0,
            }} />
            
            <Box sx={{ 
              position: 'absolute',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37, 117, 252, 0.06) 0%, rgba(255, 255, 255, 0) 70%)',
              bottom: '-50px',
              left: '-50px',
              zIndex: 0,
            }} />
            
            {/* Content */}
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography 
                variant="h4" 
                className="text-gradient"
                fontWeight="bold"
                sx={{ mb: 3 }}
              >
                Welcome to Nexus Meet
              </Typography>
              
              <Typography variant="body1" color="var(--text-secondary)" sx={{ mb: 4, lineHeight: 1.7 }}>
                Experience seamless real-time meetings with Nexus Meet. Connect with colleagues, friends, 
                or family members with our simple and intuitive interface. Our platform offers:
              </Typography>
              
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {[
                  {
                    title: 'Instant Meetings',
                    description: 'Create a meeting in seconds and invite others with a simple ID'
                  },
                  {
                    title: 'Real-time Chat',
                    description: 'Communicate with all participants through our smooth messaging system'
                  },
                  {
                    title: 'Simple Interface',
                    description: 'Clean, modern design that works on all your devices'
                  },
                  {
                    title: 'Enhanced Security',
                    description: 'Secure meeting IDs and user authentication for peace of mind'
                  }
                ].map((feature, index) => (
                  <Grid lg={6} md={6} sm={6} xs={12} key={index}>
                    <Box sx={{ height: '100%' }}>
                      <Box 
                        sx={{ 
                          p: 3,
                          height: '100%',
                          borderRadius: 'var(--card-radius)',
                          backgroundColor: 'rgba(106, 17, 203, 0.03)',
                          border: '1px solid rgba(106, 17, 203, 0.08)',
                          transition: 'all 0.3s',
                          '&:hover': {
                            backgroundColor: 'rgba(106, 17, 203, 0.05)',
                            transform: 'translateY(-2px)',
                            boxShadow: 'var(--shadow-soft)'
                          }
                        }}
                      >
                        <Typography 
                          variant="h6" 
                          fontWeight="600" 
                          color="var(--color-primary)" 
                          sx={{ mb: 1 }}
                        >
                          {feature.title}
                        </Typography>
                        <Typography variant="body2" color="var(--text-secondary)">
                          {feature.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              
              <Typography variant="body2" color="var(--text-secondary)" sx={{ textAlign: 'center' }}>
                Get started by creating a new meeting or joining an existing one.
                <br />Your recent meetings will appear in your history for quick access.
              </Typography>
            </Box>
          </Card>
        </Box>
        </Box>
      </Container>
      
      {/* Notifications */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
