// This file is deprecated and no longer used.
// Stream API integration has been moved directly into Meet.jsx
// This file is kept for reference purposes only.

import React from 'react';
import { useParams } from 'react-router-dom';

const StreamVideoWrapper = () => {
  const { meetingId } = useParams();
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>This component is no longer used</h1>
      <p>Stream API integration has been moved directly into Meet.jsx</p>
      <p>Please use /meet/{meetingId} instead of /stream-meet/{meetingId}</p>
    </div>
  );
  
  // Get username from URL parameter or use stored session info
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    let name = searchParams.get('username');
    
    if (!name) {
      // Try to get from session storage
      try {
        const meetingInfo = JSON.parse(sessionStorage.getItem('nexus_meeting_info'));
        if (meetingInfo && meetingInfo.username) {
          name = meetingInfo.username;
        }
      } catch (e) {
        console.error('Error getting username from session storage:', e);
      }
    }
    
    // If still no username, use a default
    if (!name) {
      name = 'Guest-' + Math.floor(Math.random() * 1000);
    }
    
    setUsername(name);
  }, [location]);
  
  // Get the Stream API key from env
  const apiKey = import.meta.env.VITE_STREAM_API_KEY;
  
  // Generate userId if not set
  useEffect(() => {
    if (!userId) {
      // Create a userId based on username and timestamp to make it unique
      const generatedUserId = `user-${username.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
      setUserId(generatedUserId);
    }
  }, [username, userId]);
  
  // Get token from backend
  useEffect(() => {
    const getToken = async () => {
      if (!userId || !username) return;
      
      try {
        setLoading(true);
        console.log(`Fetching token for user: ${username} (${userId})`);
        
        // Get the API URL with fallbacks for different environments
        const apiUrl = import.meta.env.VITE_LOCAL_API_URL || 
                      'http://localhost:5000';
        
        console.log(`Using API URL: ${apiUrl}/api/stream/token`);
        
        const response = await fetch(`${apiUrl}/api/stream/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, username }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Token request failed with status ${response.status}: ${errorText}`);
          throw new Error(`Failed to get Stream token (${response.status})`);
        }
        
        const data = await response.json();
        console.log('Token received successfully');
        setToken(data.token);
        
        // Initialize client
        console.log(`Initializing Stream client with API key: ${apiKey}`);
        const streamClient = new StreamVideoClient({
          apiKey,
          token: data.token,
          user: { 
            id: userId, 
            name: username,
            image: `https://getstream.io/random_svg/?id=${userId}&name=${username}`
          }
        });
        
        setClient(streamClient);
        console.log('Stream client initialized successfully');
      } catch (err) {
        console.error('Error getting token:', err);
        setError(`Failed to connect to video service: ${err.message}. Please try again.`);
      } finally {
        setLoading(false);
      }
    };
    
    getToken();
  }, [userId, username, apiKey]);
  
  // Join or create call
  useEffect(() => {
    const joinCall = async () => {
      if (!client || !meetingId) return;
      
      try {
        setLoading(true);
        let callObject;
        
        // Try to get the call if it exists
        try {
          callObject = client.call('default', meetingId);
          await callObject.getOrCreate();
        } catch (err) {
          console.error('Error getting call, creating a new one:', err);
          
          // Create a new call via backend
          const createCallResponse = await fetch('/api/stream/call', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              meetingId, 
              userId, 
              members: [userId]
            }),
          });
          
          if (!createCallResponse.ok) {
            throw new Error('Failed to create call');
          }
          
          // Get the newly created call
          callObject = client.call('default', meetingId);
          await callObject.getOrCreate();
        }
        
        // Join the call
        await callObject.join();
        setCall(callObject);
      } catch (err) {
        console.error('Error joining call:', err);
        setError('Failed to join the meeting. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    if (client) {
      joinCall();
    }
  }, [client, meetingId, userId]);
  
  // Handle errors
  if (error) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#121212'
      }}>
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center', bgcolor: '#1e1e1e' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Connection Error
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {error}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
            sx={{ 
              background: 'var(--gradient-primary)',
              color: 'white'
            }}
          >
            Try Again
          </Button>
        </Paper>
      </Box>
    );
  }
  
  // Loading state
  if (loading || !call) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        bgcolor: '#121212' 
      }}>
        <CircularProgress size={60} sx={{ color: 'var(--color-primary)' }} />
        <Typography variant="h6" sx={{ mt: 2, color: 'var(--text-secondary)' }}>
          Connecting to meeting...
        </Typography>
      </Box>
    );
  }
  
  // Render the Stream call UI
  return (
    <Box sx={{ height: '100vh', bgcolor: '#121212' }}>
      {client && call && (
        <StreamCall call={call}>
          {/* Stream call UI will be rendered here */}
          <CallUI meetingId={meetingId} username={username} />
        </StreamCall>
      )}
    </Box>
  );
};

// Custom UI for the call
const CallUI = ({ meetingId, username }) => {
  const call = useStreamVideoClient();
  
  // Call state and controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  
  // Toggle microphone
  const toggleMic = () => {
    if (micEnabled) {
      call.muteAudio();
    } else {
      call.unmuteAudio();
    }
    setMicEnabled(!micEnabled);
  };
  
  // Toggle camera
  const toggleVideo = () => {
    if (videoEnabled) {
      call.disableVideo();
    } else {
      call.enableVideo();
    }
    setVideoEnabled(!videoEnabled);
  };
  
  // Leave call
  const leaveCall = () => {
    call.leave();
    // Redirect to home
    window.location.href = '/';
  };
  
  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      position: 'relative'
    }}>
      {/* Meeting Info */}
      <Box sx={{ 
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'rgba(0,0,0,0.5)',
        borderRadius: 2,
        p: 1,
        pr: 2
      }}>
        <Typography variant="body1" sx={{ color: 'white', mr: 1 }}>
          Meeting ID: {meetingId}
        </Typography>
      </Box>
      
      {/* Video Grid */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        p: 2,
        gap: 2
      }}>
        {/* Stream Video SDK will automatically populate the video components here */}
      </Box>
      
      {/* Controls */}
      <Box sx={{ 
        p: 2,
        display: 'flex',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.5)',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0
      }}>
        <Button 
          variant="contained"
          onClick={toggleMic}
          sx={{ 
            mx: 1,
            bgcolor: micEnabled ? 'rgba(255,255,255,0.2)' : 'red',
            '&:hover': {
              bgcolor: micEnabled ? 'rgba(255,255,255,0.3)' : 'darkred',
            }
          }}
        >
          {micEnabled ? <MicIcon /> : <MicOffIcon />}
        </Button>
        
        <Button 
          variant="contained"
          onClick={toggleVideo}
          sx={{ 
            mx: 1,
            bgcolor: videoEnabled ? 'rgba(255,255,255,0.2)' : 'red',
            '&:hover': {
              bgcolor: videoEnabled ? 'rgba(255,255,255,0.3)' : 'darkred',
            }
          }}
        >
          {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
        </Button>
        
        <Button 
          variant="contained"
          onClick={leaveCall}
          sx={{ 
            mx: 1,
            bgcolor: 'red',
            '&:hover': {
              bgcolor: 'darkred',
            }
          }}
        >
          <CallEndIcon />
        </Button>
      </Box>
    </Box>
  );
};

export default StreamVideoWrapper;
