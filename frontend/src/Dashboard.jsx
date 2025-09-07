import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { 
  useMediaQuery, Box, Avatar, Typography, Paper, Button, 
  Alert, Snackbar, Grid, TextField, IconButton, Tooltip,
  Card, CardContent, Divider, Chip, CircularProgress, List, ListItem,
  Container, Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem,
  ListItemIcon, ListItemText, Fade, Tab, Tabs, ButtonGroup, Collapse
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
import ShareIcon from '@mui/icons-material/Share';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlashOnIcon from '@mui/icons-material/FlashOn';

// Import custom components
import ShareDialog from './components/ShareDialog';


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
  const [isJoining, setIsJoining] = useState(false);
  
  // Sharing states
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingType, setMeetingType] = useState('instant'); // 'instant' or 'scheduled'
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState('60'); // In minutes
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [showScheduleOptions, setShowScheduleOptions] = useState(false);
  const [isMeetingCreated, setIsMeetingCreated] = useState(false);
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
    // Set joining state to true to show loading indicator
    setIsJoining(true);
    
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
    
    try {
      // Store meeting info including mic and video preferences
      sessionStorage.setItem('nexus_meeting_info', JSON.stringify({ 
        meetingId: id, 
        username: displayName,
        micEnabled: micOn,
        videoEnabled: videoOn
      }));
      
      // Add a small delay to show the loading indicator (at least 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate to the meeting page
      navigate(`/meet/${id}`);
      
      if (usedFallback) {
        setSnackbar({ open: true, message: 'Warning: Server unavailable, using local meeting ID.', severity: 'warning' });
      }
    } catch (error) {
      console.error('Error joining meeting:', error);
      setSnackbar({ open: true, message: 'Error joining meeting. Please try again.', severity: 'error' });
      // Reset joining state if there was an error
      setIsJoining(false);
    }
  };
  
  // Get meeting link
  const getMeetingLink = (id) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/meet/${id}`;
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
  
  // Copy meeting link to clipboard
  const copyMeetingLink = (id) => {
    const link = getMeetingLink(id);
    navigator.clipboard.writeText(link);
    setSnackbar({
      open: true,
      message: 'Meeting link copied to clipboard',
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
  
  // Open share dialog for a meeting ID
  const openShareDialog = async (id) => {
    // If no ID provided, generate one
    if (!id) {
      setIsGenerating(true);
      try {
        id = await generateMeetingId();
      } catch (err) {
        console.error('Error generating meeting ID for sharing', err);
        // Fallback to client-side generation
        const array = new Uint32Array(4);
        window.crypto.getRandomValues(array);
        id = Array.from(array, dec => dec.toString(36)).join('').slice(0, 8);
      }
      setIsGenerating(false);
    }
    
    setMeetingId(id);
    setMeetingLink(getMeetingLink(id));
    setIsMeetingCreated(true);
    setShareDialogOpen(true);
  };
  
  // Handle share menu opening
  const handleShareMenuOpen = (event) => {
    setShareMenuAnchor(event.currentTarget);
  };
  
  // Handle share menu closing
  const handleShareMenuClose = () => {
    setShareMenuAnchor(null);
  };
  
  // Create instant meeting
  const createInstantMeeting = async () => {
    setMeetingType('instant');
    setScheduleTitle('Instant Meeting');
    await openShareDialog();
  };
  
  // Create scheduled meeting
  const createScheduledMeeting = () => {
    setMeetingType('scheduled');
    setShowScheduleOptions(true);
    
    // Set default values for scheduled meeting
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    
    const dateStr = nextHour.toISOString().split('T')[0];
    const timeStr = nextHour.toTimeString().split(':').slice(0, 2).join(':');
    
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
    setScheduleDuration('60');
    setScheduleTitle(`Meeting on ${new Date(dateStr + 'T' + timeStr).toLocaleDateString()}`);
  };
  
  // Confirm scheduled meeting creation
  const confirmScheduledMeeting = async () => {
    await openShareDialog();
  };
  
  // Share via different platforms
  const shareViaPlatform = (platform) => {
    const title = encodeURIComponent(meetingType === 'instant' ? 'Join my Nexus Meeting' : scheduleTitle);
    const text = encodeURIComponent(
      meetingType === 'instant' 
        ? `Join my Nexus meeting now: ${meetingLink}`
        : `Join my scheduled Nexus meeting "${scheduleTitle}" on ${new Date(scheduleDate + 'T' + scheduleTime).toLocaleString()}: ${meetingLink}`
    );
    
    let url = '';
    
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${text}`;
        break;
      case 'email':
        const subject = encodeURIComponent(meetingType === 'instant' ? 'Join my Nexus Meeting' : scheduleTitle);
        url = `mailto:?subject=${subject}&body=${text}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(meetingLink)}&quote=${text}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${text}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(meetingLink)}`;
        break;
      case 'copy':
        copyMeetingLink(meetingId);
        return;
    }
    
    if (url) {
      window.open(url, '_blank');
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
              elevation={3}
              sx={{ 
                borderRadius: 'var(--card-radius)',
                p: { xs: 2.5, sm: 3, md: 4 },
                mb: 4,
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                boxShadow: 'var(--shadow-soft)',
                position: 'relative',
                overflow: 'visible',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -2,
                  left: 30,
                  right: 30,
                  height: 4,
                  background: 'var(--gradient-accent)',
                  borderRadius: '4px 4px 0 0',
                  boxShadow: '0 0 8px rgba(106, 17, 203, 0.5)'
                }
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Typography 
                    variant="h4" 
                    fontWeight="700"
                    className="text-gradient" 
                    sx={{ mb: 1.5 }}
                  >
                    {meetingId ? 'Join Meeting' : 'Start New Meeting'}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
                    Set up your preferences before starting
                  </Typography>
                  
                  {!meetingId && !isMeetingCreated && (
                    <Box 
                      sx={{ 
                        mt: 3,
                        mx: 'auto',
                        maxWidth: '550px',
                        p: 2,
                        bgcolor: 'rgba(106, 17, 203, 0.08)',
                        borderRadius: 'var(--card-radius)',
                        border: '1px solid rgba(106, 17, 203, 0.2)',
                        boxShadow: 'inset 0 0 20px rgba(106, 17, 203, 0.05)',
                        position: 'relative',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: '-12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '12px solid transparent',
                          borderRight: '12px solid transparent',
                          borderTop: '12px solid rgba(106, 17, 203, 0.08)'
                        }
                      }}
                    >
                      <Typography 
                        variant="subtitle1" 
                        fontWeight={600} 
                        color="#6A11CB"
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          gap: 1
                        }}
                      >
                        <Box component="span" sx={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: '50%', 
                          bgcolor: 'rgba(106, 17, 203, 0.15)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>?</Box>
                        How would you like to meet?
                      </Typography>
                    </Box>
                  )}
                  
                  {!meetingId && !isMeetingCreated && (
                    <Box sx={{ 
                      mt: 4, 
                      mb: 2,
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' }, 
                      gap: { xs: 2, sm: 3 }, 
                      justifyContent: 'center',
                      width: '100%'
                    }}>
                      <Button
                        fullWidth
                        size="large"
                        variant="contained"
                        onClick={createInstantMeeting}
                        sx={{
                          background: '#6A11CB',
                          borderRadius: 'var(--button-radius)',
                          px: { xs: 2, sm: 3 },
                          py: 1.5,
                          color: 'white',
                          fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(106, 17, 203, 0.4)',
                          textTransform: 'none',
                          fontSize: { xs: '0.95rem', sm: '1rem' },
                          minHeight: '48px',
                          border: '2px solid rgba(255,255,255,0.2)',
                          '&:hover': {
                            boxShadow: '0 6px 16px rgba(106, 17, 203, 0.6)',
                            background: '#5a0eb0'
                          }
                        }}
                      >
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1, 
                          justifyContent: 'center',
                          '& .MuiSvgIcon-root': {
                            color: '#ffc107',
                            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))'
                          }
                        }}>
                          <FlashOnIcon />
                          <span>Instant Meeting</span>
                        </Box>
                      </Button>
                      <Button
                        fullWidth
                        size="large"
                        variant="outlined"
                        onClick={createScheduledMeeting}
                        sx={{
                          borderColor: '#6A11CB',
                          borderWidth: 2,
                          borderRadius: 'var(--button-radius)',
                          px: { xs: 2, sm: 3 },
                          py: 1.5,
                          color: '#6A11CB',
                          fontWeight: 600,
                          textTransform: 'none',
                          fontSize: { xs: '0.95rem', sm: '1rem' },
                          minHeight: '48px',
                          backgroundColor: 'rgba(255, 255, 255, 0.8)',
                          '&:hover': {
                            borderColor: '#5a0eb0',
                            backgroundColor: 'rgba(106, 17, 203, 0.08)',
                            borderWidth: 2
                          },
                          '& .MuiSvgIcon-root': {
                            color: '#6A11CB'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                          <EventAvailableIcon />
                          <span>Schedule Meeting</span>
                        </Box>
                      </Button>
                    </Box>
                  )}
                </Box>
              
              <Collapse in={showScheduleOptions} sx={{ mb: 4 }}>
                <Box 
                  sx={{ 
                    p: { xs: 2, sm: 3 }, 
                    border: '1px solid rgba(106, 17, 203, 0.15)', 
                    borderRadius: 'var(--card-radius)',
                    bgcolor: 'rgba(106, 17, 203, 0.02)',
                    mb: 3,
                    boxShadow: 'var(--shadow-soft)'
                  }}
                >
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      mb: 2.5, 
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontSize: { xs: '1rem', sm: '1.1rem' }
                    }}
                  >
                    <CalendarMonthIcon />
                    Schedule Meeting
                  </Typography>
                  
                  <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Meeting Title"
                        value={scheduleTitle}
                        onChange={e => setScheduleTitle(e.target.value)}
                        variant="outlined"
                        placeholder="Enter a descriptive title for your meeting"
                        InputProps={{
                          sx: {
                            borderRadius: 'var(--input-radius)',
                            backgroundColor: 'rgba(255,255,255,0.8)'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Date"
                        type="date"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          sx: {
                            borderRadius: 'var(--input-radius)',
                            backgroundColor: 'rgba(255,255,255,0.8)'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Time"
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          sx: {
                            borderRadius: 'var(--input-radius)',
                            backgroundColor: 'rgba(255,255,255,0.8)'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Duration (minutes)"
                        type="number"
                        value={scheduleDuration}
                        onChange={e => setScheduleDuration(e.target.value)}
                        variant="outlined"
                        InputProps={{
                          sx: {
                            borderRadius: 'var(--input-radius)',
                            backgroundColor: 'rgba(255,255,255,0.8)'
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ 
                    mt: 3, 
                    pt: 2,
                    display: 'flex', 
                    justifyContent: 'space-between',
                    gap: 2,
                    borderTop: '1px solid rgba(106, 17, 203, 0.1)',
                    flexDirection: { xs: 'column', sm: 'row' }
                  }}>
                    <Button 
                      variant="outlined"
                      fullWidth={isMobile}
                      color="inherit"
                      onClick={() => setShowScheduleOptions(false)}
                      sx={{ 
                        borderRadius: 'var(--button-radius)',
                        borderColor: 'rgba(0, 0, 0, 0.2)',
                        py: 1,
                        order: { xs: 2, sm: 1 }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="contained"
                      fullWidth={isMobile}
                      color="primary"
                      onClick={confirmScheduledMeeting}
                      sx={{ 
                        borderRadius: 'var(--button-radius)',
                        background: 'var(--gradient-accent)',
                        py: 1,
                        boxShadow: 'var(--shadow-soft)',
                        order: { xs: 1, sm: 2 }
                      }}
                    >
                      Create Scheduled Meeting
                    </Button>
                  </Box>
                </Box>
              </Collapse>
              
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
              
              <Box sx={{ mb: 4 }}>
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
                      sx={{
                        py: { xs: 1, sm: 1.5 },
                        borderRadius: 'var(--button-radius)',
                        backgroundColor: micOn ? 'var(--color-primary)' : 'transparent',
                        borderColor: micOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.2)',
                        borderWidth: '2px',
                        color: micOn ? 'white' : 'var(--color-primary)',
                        '&:hover': {
                          backgroundColor: micOn ? 'var(--color-secondary)' : 'rgba(106,17,203,0.05)',
                          borderWidth: '2px'
                        },
                        textTransform: 'none',
                        minHeight: '46px'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, justifyContent: 'center' }}>
                        {micOn ? <MicIcon fontSize={isSmall ? 'small' : 'medium'} /> : <MicOffIcon fontSize={isSmall ? 'small' : 'medium'} />}
                        <span>{micOn ? 'Mic On' : 'Mic Off'}</span>
                      </Box>
                    </Button>
                  </Grid>
                  <Grid lg={6} md={6} sm={6} xs={6}>
                    <Button
                      fullWidth
                      variant={videoOn ? "contained" : "outlined"}
                      onClick={() => setVideoOn(!videoOn)}
                      sx={{
                        py: { xs: 1, sm: 1.5 },
                        borderRadius: 'var(--button-radius)',
                        backgroundColor: videoOn ? 'var(--color-primary)' : 'transparent',
                        borderColor: videoOn ? 'var(--color-primary)' : 'rgba(0,0,0,0.2)',
                        borderWidth: '2px',
                        color: videoOn ? 'white' : 'var(--color-primary)',
                        '&:hover': {
                          backgroundColor: videoOn ? 'var(--color-secondary)' : 'rgba(106,17,203,0.05)',
                          borderWidth: '2px'
                        },
                        textTransform: 'none',
                        minHeight: '46px'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, justifyContent: 'center' }}>
                        {videoOn ? <VideocamIcon fontSize={isSmall ? 'small' : 'medium'} /> : <VideocamOffIcon fontSize={isSmall ? 'small' : 'medium'} />}
                        <span>{videoOn ? 'Video On' : 'Video Off'}</span>
                      </Box>
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
                    fontWeight: 600,
                    transition: 'color 0.3s ease',
                    ...(meetingId && { color: 'var(--color-primary)' })
                  }}
                >
                  {meetingId ? 'Meeting ID' : 'Enter Meeting ID to join or leave blank to create new meeting'}
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    gap: 1,
                    position: 'relative',
                    ...(isMeetingCreated && meetingId && {
                      animation: 'highlight-pulse 2s ease-out',
                      '@keyframes highlight-pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(106, 17, 203, 0)' },
                        '50%': { boxShadow: '0 0 0 8px rgba(106, 17, 203, 0.2)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(106, 17, 203, 0)' }
                      }
                    })
                  }}
                >
                  <TextField
                    fullWidth
                    value={meetingId}
                    onChange={e => setMeetingId(e.target.value)}
                    placeholder="Meeting ID"
                    variant="outlined"
                    InputProps={{
                      endAdornment: meetingId ? (
                        <Tooltip title="Copy Meeting ID">
                          <IconButton size="small" onClick={() => copyMeetingId(meetingId)}>
                            <ContentCopyIcon fontSize="small" sx={{ color: 'var(--color-secondary)' }} />
                          </IconButton>
                        </Tooltip>
                      ) : null,
                      sx: {
                        borderRadius: 'var(--input-radius)',
                        bgcolor: 'rgba(245, 247, 250, 0.8)',
                        color: 'var(--text-primary)',
                        fontFamily: meetingId ? 'monospace' : 'inherit',
                        fontWeight: meetingId ? 600 : 'normal',
                        fontSize: meetingId ? '1.1rem' : 'inherit',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: meetingId ? 'rgba(106, 17, 203, 0.3)' : 'rgba(0, 0, 0, 0.1)',
                          borderWidth: meetingId ? '2px' : '1px'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: meetingId ? 'rgba(106, 17, 203, 0.5)' : 'rgba(0, 0, 0, 0.2)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'var(--color-primary)',
                        }
                      }
                    }}
                  />
                  {meetingId && (
                    <Button
                      variant="contained"
                      onClick={() => openShareDialog(meetingId)}
                      sx={{
                        minWidth: { xs: '50px', sm: '120px' },
                        borderRadius: 'var(--button-radius)',
                        background: '#6A11CB',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(106, 17, 203, 0.4)',
                        height: '100%',
                        border: '2px solid rgba(255,255,255,0.2)',
                        '&:hover': {
                          boxShadow: '0 6px 16px rgba(106, 17, 203, 0.6)',
                          background: '#5a0eb0',
                        },
                        whiteSpace: 'nowrap',
                        animation: isMeetingCreated ? 'share-pulse 1.5s ease infinite' : 'none',
                        '@keyframes share-pulse': {
                          '0%': { transform: 'scale(1)', boxShadow: '0 4px 12px rgba(106, 17, 203, 0.4)' },
                          '50%': { transform: 'scale(1.05)', boxShadow: '0 6px 18px rgba(106, 17, 203, 0.6)' },
                          '100%': { transform: 'scale(1)', boxShadow: '0 4px 12px rgba(106, 17, 203, 0.4)' }
                        }
                      }}
                    >
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 0.5,
                        fontWeight: 600
                      }}>
                        <ShareIcon 
                          fontSize={isSmall ? 'small' : 'medium'} 
                          sx={{ 
                            color: '#fff',
                            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))'
                          }}
                        />
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Share</Box>
                      </Box>
                    </Button>
                  )}
                </Box>
                {isMeetingCreated && meetingId && (
                  <Box 
                    sx={{ 
                      mt: 1, 
                      p: 1.5, 
                      bgcolor: 'rgba(106, 17, 203, 0.05)',
                      borderRadius: 'var(--card-radius)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <LightbulbIcon sx={{ color: 'var(--color-secondary)', fontSize: '1rem' }} />
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                      Your meeting is ready! You can join now or share the link with others.
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Button 
                fullWidth
                size="large"
                variant="contained"
                disabled={isGenerating || isJoining}
                onClick={handleJoinMeeting}
                sx={{
                  py: { xs: 1.5, sm: 2 },
                  fontWeight: 'bold',
                  fontSize: { xs: '1rem', sm: '1.1rem' },
                  background: 'var(--gradient-accent)',
                  borderRadius: 'var(--button-radius)',
                  boxShadow: 'var(--shadow-glow)',
                  color: 'white',
                  minHeight: '56px',
                  '&:hover': {
                    boxShadow: 'var(--shadow-strong)'
                  },
                  animation: (isGenerating || isJoining) ? 'none' : 'pulse 2s infinite',
                  position: 'relative',
                  overflow: 'hidden',
                  textTransform: 'none',
                  '&:disabled': {
                    backgroundColor: 'rgba(106, 17, 203, 0.6)',
                    color: 'white'
                  }
                }}
              >
                {isGenerating || isJoining ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <CircularProgress 
                      size={24} 
                      color="inherit" 
                      sx={{ 
                        animation: 'spin 1.5s linear infinite',
                        '@keyframes spin': {
                          '0%': {
                            transform: 'rotate(0deg)',
                          },
                          '100%': {
                            transform: 'rotate(360deg)',
                          },
                        }
                      }} 
                    />
                    <span>{isJoining ? 'Joining Meeting...' : 'Generating...'}</span>
                  </Box>
                ) : meetingId ? (
                  'Join Meeting'
                ) : (
                  'Start New Meeting'
                )}
                
                {isJoining && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      height: '3px',
                      bgcolor: 'rgba(255, 255, 255, 0.4)',
                      width: '100%',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        animation: 'loadingBar 1.5s infinite ease-in-out',
                      },
                      '@keyframes loadingBar': {
                        '0%': {
                          left: '-100%'
                        },
                        '100%': {
                          left: '100%'
                        }
                      }
                    }}
                  />
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
                          disabled={isJoining}
                          sx={{
                            borderRadius: 'var(--button-radius)',
                            borderColor: 'rgba(106, 17, 203, 0.2)',
                            color: 'var(--color-primary)',
                            '&:hover': {
                              borderColor: 'var(--color-primary)',
                              backgroundColor: 'rgba(106, 17, 203, 0.05)',
                            },
                            minWidth: '60px'
                          }}
                        >
                          {isJoining ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            'Join'
                          )}
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
      
      {/* Share Dialog */}
      <ShareDialog 
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        meetingId={meetingId}
        isScheduled={meetingType === 'scheduled'}
        scheduledDate={scheduleDate}
        scheduledTime={scheduleTime}
      />
    </Box>
  );
}
