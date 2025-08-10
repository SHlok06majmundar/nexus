import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Box, Typography, Paper, Button, TextField, Avatar, 
  Chip, Divider, Alert, Snackbar, List, ListItem, 
  ListItemAvatar, ListItemText, IconButton, Tooltip,
  useMediaQuery, useTheme, Badge, Grid, CircularProgress
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
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState('participants'); // 'participants' or 'chat'
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [focusedStream, setFocusedStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraPermissionDenied, setIsCameraPermissionDenied] = useState(false);
  const [isMicPermissionDenied, setIsMicPermissionDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  // Refs
  const socketRef = useRef();
  const messagesEndRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());

  // Scroll to bottom of messages when new messages arrive
  useEffect(() => {
    if (!sidebarOpen || sidebarContent !== 'chat') {
      // If sidebar is closed or not showing chat, count unread messages
      const newMessageCount = messages.length - unreadMessages;
      if (newMessageCount > 0) {
        setUnreadMessages(messages.length);
      }
    } else {
      // Reset unread count when chat is visible
      setUnreadMessages(0);
      // Scroll to bottom with a slight delay to ensure rendering is complete
      const scrollTimer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [messages, sidebarOpen, sidebarContent, unreadMessages]);
  
  // Auto-hide controls after inactivity
  useEffect(() => {
    const hideControls = () => {
      // Don't hide if user is interacting with controls
      if (document.querySelector(':hover')?.closest('[data-controls]')) {
        return;
      }
      setShowControls(false);
    };
    
    // Show controls on any mouse movement
    const handleMouseMove = () => {
      setShowControls(true);
      // Reset the timer
      clearTimeout(window.controlsTimer);
      window.controlsTimer = setTimeout(hideControls, 4000);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    // Initial timer
    window.controlsTimer = setTimeout(hideControls, 4000);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(window.controlsTimer);
    };
  }, []);

  // Initialize WebRTC peer connections
  const initializePeerConnection = useCallback((targetId) => {
    try {
      // Check if we already have a connection to this peer
      if (peerConnectionsRef.current.has(targetId)) {
        return peerConnectionsRef.current.get(targetId);
      }
      
      // Configure ICE servers for NAT traversal
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };
      
      // Create new peer connection
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionsRef.current.set(targetId, peerConnection);
      
      // Add our local stream tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }
      
      // Add screen sharing stream if active
      if (isScreenSharing && screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          peerConnection.addTrack(track, screenStreamRef.current);
        });
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('ice-candidate', {
            targetId,
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = (event) => {
        switch(peerConnection.connectionState) {
          case "disconnected":
          case "failed":
          case "closed":
            // Clean up connection if it's closed
            if (peerConnectionsRef.current.has(targetId)) {
              peerConnectionsRef.current.delete(targetId);
              remoteStreamsRef.current.delete(targetId);
            }
            break;
        }
      };
      
      // Handle incoming media streams
      peerConnection.ontrack = (event) => {
        const remoteStream = new MediaStream();
        event.streams[0].getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        remoteStreamsRef.current.set(targetId, remoteStream);
        
        // Use state update that doesn't cause continuous re-renders
        setParticipants(prevParticipants => {
          // Only update if the participant doesn't already exist
          const exists = prevParticipants.some(p => p.id === targetId);
          if (exists) return prevParticipants;
          return [...prevParticipants];
        });
      };
      
      return peerConnection;
    } catch (error) {
      console.error("Error creating peer connection:", error);
      setSnackbar({
        open: true,
        message: 'Failed to establish video connection',
        severity: 'error'
      });
      return null;
    }
  }, [isScreenSharing]);

  // Create and send an offer to a peer
  const createAndSendOffer = useCallback(async (targetId) => {
    try {
      const peerConnection = initializePeerConnection(targetId);
      if (!peerConnection) return;
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Send the offer to the target peer
      socketRef.current.emit('offer', {
        targetId,
        offer: peerConnection.localDescription
      });
    } catch (error) {
      console.error("Error creating offer:", error);
      setSnackbar({
        open: true,
        message: 'Failed to create connection offer',
        severity: 'warning'
      });
    }
  }, [initializePeerConnection]);
  
  // Handle received offers
  const handleReceivedOffer = useCallback(async ({ offer, offererId }) => {
    try {
      const peerConnection = initializePeerConnection(offererId);
      if (!peerConnection) return;
      
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send the answer back
      socketRef.current.emit('answer', {
        targetId: offererId,
        answer: peerConnection.localDescription
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }, [initializePeerConnection]);
  
  // Handle received answers
  const handleReceivedAnswer = useCallback(async ({ answer, answererId }) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(answererId);
      if (peerConnection && peerConnection.signalingState !== 'closed') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }, []);
  
  // Handle received ICE candidates
  const handleIceCandidate = useCallback(async ({ candidate, senderId }) => {
    try {
      const peerConnection = peerConnectionsRef.current.get(senderId);
      if (peerConnection && peerConnection.signalingState !== 'closed') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }, []);
  
  // Initialize media devices
  const setupLocalMedia = useCallback(async () => {
    try {
      setIsLoading(true);
      // Close any existing stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get user media with audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micEnabled,
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      });
      
      localStreamRef.current = stream;
      
      // Set the stream to the local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Update state based on what was actually allowed
      setMicEnabled(stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled);
      setVideoEnabled(stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled);
      
      // Add the stream to all existing peer connections
      for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });
      }
      
      // Update the server about our media status
      if (socketRef.current && connected) {
        socketRef.current.emit('media-status-changed', {
          meetingId,
          hasAudio: micEnabled,
          hasVideo: videoEnabled
        });
      }
      
      setIsLoading(false);
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setIsLoading(false);
      
      // Handle permission denied errors
      if (error.name === 'NotAllowedError') {
        if (videoEnabled) setIsCameraPermissionDenied(true);
        if (micEnabled) setIsMicPermissionDenied(true);
        
        setSnackbar({
          open: true,
          message: `${videoEnabled && micEnabled ? 'Camera and microphone' : 
                     videoEnabled ? 'Camera' : 'Microphone'} access denied. Please check your browser permissions.`,
          severity: 'error'
        });
        
        // Try again with just audio if video failed
        if (videoEnabled && !micEnabled) {
          setVideoEnabled(false);
          return setupLocalMedia();
        }
      }
    }
  }, [micEnabled, videoEnabled, connected, meetingId]);
  
  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (isMicPermissionDenied) {
      setSnackbar({
        open: true,
        message: 'Microphone access was denied. Please check your browser permissions.',
        severity: 'warning'
      });
      return;
    }
    
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks[0].enabled = newState;
        setMicEnabled(newState);
        
        // Notify server of media status change
        if (socketRef.current && connected) {
          socketRef.current.emit('media-status-changed', {
            meetingId,
            hasAudio: newState,
            hasVideo: videoEnabled
          });
        }
      } else {
        // No audio track exists, try to get one
        setMicEnabled(true);
        setupLocalMedia();
      }
    } else {
      // No stream exists yet
      setMicEnabled(true);
      setupLocalMedia();
    }
  }, [isMicPermissionDenied, videoEnabled, connected, meetingId, setupLocalMedia]);
  
  // Toggle video
  const toggleVideo = useCallback(() => {
    if (isCameraPermissionDenied) {
      setSnackbar({
        open: true,
        message: 'Camera access was denied. Please check your browser permissions.',
        severity: 'warning'
      });
      return;
    }
    
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks[0].enabled = newState;
        setVideoEnabled(newState);
        
        // Notify server of media status change
        if (socketRef.current && connected) {
          socketRef.current.emit('media-status-changed', {
            meetingId,
            hasAudio: micEnabled,
            hasVideo: newState
          });
        }
      } else if (!videoEnabled) {
        // No video track exists but we want to enable it
        setVideoEnabled(true);
        setupLocalMedia();
      }
    } else {
      // No stream exists yet
      setVideoEnabled(true);
      setupLocalMedia();
    }
  }, [isCameraPermissionDenied, micEnabled, connected, meetingId, setupLocalMedia]);
  
  // Start/stop screen sharing
  const toggleScreenSharing = useCallback(async () => {
    try {
      if (isScreenSharing && screenStreamRef.current) {
        // Stop screen sharing
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        
        // Renegotiate connections without the screen stream
        for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
          await createAndSendOffer(peerId);
        }
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        
        // Handle the user stopping screen sharing via the browser UI
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          
          // Renegotiate connections
          for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
            createAndSendOffer(peerId);
          }
        };
        
        // Add screen sharing tracks to all peer connections
        for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
          screenStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, screenStream);
          });
          
          // Renegotiate with new tracks
          await createAndSendOffer(peerId);
        }
      }
    } catch (error) {
      console.error("Error toggling screen sharing:", error);
      setSnackbar({
        open: true,
        message: 'Failed to share screen. Please try again.',
        severity: 'error'
      });
    }
  }, [isScreenSharing, createAndSendOffer]);
  
  // Clean up peer connections
  const cleanupPeerConnection = useCallback((peerId) => {
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(peerId);
    }
    
    if (remoteStreamsRef.current.has(peerId)) {
      remoteStreamsRef.current.delete(peerId);
      // Force a re-render
      setParticipants(prevParticipants => {
        return prevParticipants.filter(p => p.id !== peerId);
      });
    }
  }, []);
  
  // Main useEffect for initialization
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
    
    // Setup local media first, then connect to socket
    setupLocalMedia().then(() => {
      // Connect to socket server after media is set up
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

      // Handle room participants
      socketRef.current.on('room-users', (users) => {
        setParticipants(users);
        
        // Initiate WebRTC connections with each existing participant
        users.forEach(user => {
          if (user.id !== socketRef.current.id) {
            createAndSendOffer(user.id);
          }
        });
      });
      
      socketRef.current.on('room-users-changed', (users) => {
        setParticipants(users);
      });
      
      // WebRTC Signaling
      socketRef.current.on('user-joined', (user) => {
        createAndSendOffer(user.id);
      });
      
      socketRef.current.on('offer', (data) => {
        handleReceivedOffer(data);
      });
      
      socketRef.current.on('answer', (data) => {
        handleReceivedAnswer(data);
      });
      
      socketRef.current.on('ice-candidate', (data) => {
        handleIceCandidate(data);
      });
      
      socketRef.current.on('user-left', (user) => {
        cleanupPeerConnection(user.id);
      });
      
      socketRef.current.on('user-media-status-changed', ({userId, hasAudio, hasVideo}) => {
        setParticipants(prevParticipants => {
          return prevParticipants.map(p => {
            if (p.id === userId) {
              return {...p, hasAudio, hasVideo};
            }
            return p;
          });
        });
      });
    });

    return () => {
      // Clean up when component unmounts
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      for (const [peerId, peerConnection] of peerConnectionsRef.current.entries()) {
        peerConnection.close();
      }
      peerConnectionsRef.current.clear();
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit('leave-room', meetingId);
        socketRef.current.disconnect();
      }
    };
  }, [meetingId, setupLocalMedia, createAndSendOffer, handleReceivedOffer, 
      handleReceivedAnswer, handleIceCandidate, cleanupPeerConnection]);

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
      // Clean up media streams
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
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
  
  const toggleSidebar = (content) => {
    // If sidebar is already open with the same content, close it
    if (sidebarOpen && sidebarContent === content) {
      setSidebarOpen(false);
    } else {
      // Open the sidebar with the selected content
      setSidebarOpen(true);
      setSidebarContent(content);
      
      // Reset unread count when opening chat
      if (content === 'chat') {
        setUnreadMessages(0);
      }
    }
  };
  
  // Focus a specific stream
  const handleFocusStream = (streamId) => {
    if (focusedStream === streamId) {
      setFocusedStream(null); // Toggle off if already focused
    } else {
      setFocusedStream(streamId);
    }
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

  // Create video element for a participant with improved UI
  const renderParticipantVideo = useCallback((participant) => {
    const isCurrentUser = participant.id === socketRef.current?.id;
    const isFocused = focusedStream === participant.id;
    const videoStream = isCurrentUser ? localStreamRef.current : remoteStreamsRef.current.get(participant.id);
    const hasVideo = isCurrentUser ? videoEnabled : participant.hasVideo;
    const hasAudio = isCurrentUser ? micEnabled : participant.hasAudio;
    
    return (
      <Box
        className="video-container"
        sx={{
          position: 'relative',
          borderRadius: 'var(--card-radius)',
          overflow: 'hidden',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          aspectRatio: '16/9',
          width: '100%',
          height: '100%', 
          transition: 'all 0.3s ease',
          border: isCurrentUser 
            ? '2px solid var(--color-primary)'
            : isFocused
              ? '2px solid var(--color-secondary)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'var(--shadow-soft)',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 'var(--shadow-strong)',
            transform: !isFocused ? 'scale(1.02)' : 'none',
          },
        }}
        onClick={() => handleFocusStream(participant.id)}
      >
        {/* Video element */}
        {videoStream && (
          <video
            ref={isCurrentUser ? localVideoRef : null}
            autoPlay
            playsInline
            muted={isCurrentUser}
            srcObject={videoStream}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: hasVideo ? 'block' : 'none',
              backgroundColor: '#111',
              transition: 'all 0.3s ease'
            }}
          />
        )}
        
        {/* Placeholder when video is off */}
        {!hasVideo && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backgroundImage: 'linear-gradient(45deg, rgba(20,20,40,0.7) 0%, rgba(0,0,0,0.8) 100%)',
            }}
          >
            <Avatar
              className="video-avatar"
              sx={{
                width: isFocused ? 120 : 70,
                height: isFocused ? 120 : 70,
                fontSize: isFocused ? '3rem' : '2rem',
                bgcolor: isCurrentUser ? 'var(--color-primary)' : 'var(--color-secondary)',
                boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)',
                border: '3px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
                animation: 'pulse 3s infinite ease-in-out'
              }}
            >
              {participant.username[0].toUpperCase()}
            </Avatar>
            
            {isFocused && (
              <Typography 
                variant="h6" 
                sx={{ 
                  mt: 2, 
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                  fontWeight: 500
                }}
              >
                {participant.username} {isCurrentUser ? '(You)' : ''}
              </Typography>
            )}
          </Box>
        )}
        
        {/* Status indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            gap: 0.5,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            borderRadius: '12px',
            padding: '4px 8px',
            opacity: 0.8,
            transition: '0.2s all'
          }}
        >
          {!hasAudio && <MicOffIcon fontSize="small" color="error" />}
          {!hasVideo && <VideocamOffIcon fontSize="small" color="error" />}
          {isScreenSharing && isCurrentUser && <ScreenShareIcon fontSize="small" sx={{ color: '#2196f3' }} />}
          {isFocused && <FullscreenExitIcon fontSize="small" sx={{ color: 'white' }} />}
        </Box>
        
        {/* Username overlay - show always at bottom */}
        <Box
          className="video-controls"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(5px)',
            padding: hasVideo ? '8px 12px' : '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: hasVideo ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out',
            '.video-container:hover &': {
              opacity: 1
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!isFocused && (
              <Avatar 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  fontSize: '0.75rem',
                  bgcolor: isCurrentUser ? 'var(--color-primary)' : 'var(--color-secondary)'
                }}
              >
                {participant.username[0].toUpperCase()}
              </Avatar>
            )}
            <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              {participant.username} {isCurrentUser ? '(You)' : ''}
            </Typography>
          </Box>
          
          {/* Focus/expand button */}
          <IconButton 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleFocusStream(participant.id);
            }}
            sx={{ 
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.2)',
              p: '4px',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)'
              }
            }}
          >
            {isFocused ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>
    );
  }, [focusedStream, micEnabled, videoEnabled, isScreenSharing, handleFocusStream]);

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
      
      {/* Main content with improved responsive layout and sliding sidebar */}
      <Box sx={{ 
        flex: 1,
        display: 'flex', 
        height: { xs: 'calc(100vh - 60px)', md: 'calc(100vh - 76px)' },
        position: 'relative',
        overflow: 'hidden', // Prevent layout overflow
      }}>
        {/* Main area with videos only */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          position: 'relative',
          pb: { xs: '80px', sm: 0 }, // Add padding at bottom on mobile for controls
          transition: 'all 0.3s ease',
        }}>
          {/* Video grid area with gradient background */}
          <Box sx={{
            flex: 1,
            p: { xs: 1, md: 2 },
            overflowY: 'auto',
            backgroundColor: 'rgba(10, 10, 20, 0.3)',
            background: 'linear-gradient(135deg, rgba(12,14,20,0.9) 0%, rgba(26,31,53,0.8) 100%)',
            position: 'relative',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }
            },
          }}
          data-controls="video-area"
          >
            {/* Loading indicator */}
            {isLoading && (
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 10,
                backdropFilter: 'blur(5px)'
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={60} sx={{ color: 'var(--color-secondary)' }} />
                  <Typography variant="body1" color="white" sx={{ mt: 2 }}>
                    Setting up your media...
                  </Typography>
                </Box>
              </Box>
            )}
            
            {/* Permission denied warnings */}
            {(isCameraPermissionDenied || isMicPermissionDenied) && (
              <Alert 
                severity="warning" 
                sx={{ 
                  mb: 2, 
                  borderRadius: 'var(--card-radius)',
                  width: '100%'
                }}
              >
                {isCameraPermissionDenied && isMicPermissionDenied ? 
                  'Camera and microphone access denied. Other participants won\'t be able to see or hear you.' :
                  isCameraPermissionDenied ? 
                    'Camera access denied. Other participants won\'t be able to see you.' :
                    'Microphone access denied. Other participants won\'t be able to hear you.'
                }
              </Alert>
            )}
            
            {/* Video grid with improved layout */}
            <Box 
              sx={{ 
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Featured stream at top when focused */}
              {focusedStream && (
                <Box sx={{ width: '100%', height: '70%', mb: 2 }}>
                  {participants.filter(p => p.id === focusedStream).map(participant => (
                    <Box 
                      key={`featured-${participant.id}`}
                      sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 'var(--card-radius)',
                        overflow: 'hidden',
                      }}
                    >
                      {renderParticipantVideo(participant)}
                    </Box>
                  ))}
                </Box>
              )}
              
              {/* Row of video thumbnails */}
              <Box 
                sx={{ 
                  display: 'flex',
                  flexWrap: 'nowrap',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  gap: 2,
                  py: 2,
                  height: focusedStream ? '30%' : '100%',
                  '&::-webkit-scrollbar': {
                    height: '8px',
                  },
                  scrollbarWidth: 'thin',
                }}
              >
                {participants.map(participant => (
                  (!focusedStream || participant.id !== focusedStream) && (
                    <Box
                      key={participant.id}
                      sx={{
                        flexShrink: 0,
                        width: focusedStream 
                          ? { xs: '180px', sm: '200px', md: '220px' }
                          : { 
                              xs: participants.length > 2 ? '300px' : '100%', 
                              sm: participants.length > 3 ? '300px' : `${100 / Math.min(participants.length, 3)}%`,
                              md: participants.length > 4 ? '300px' : `${100 / Math.min(participants.length, 4)}%`
                            },
                        height: focusedStream ? '100%' : { xs: '220px', sm: '300px', md: '400px' },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {renderParticipantVideo(participant)}
                    </Box>
                  )
                ))}
              </Box>
            </Box>
          </Box>
          
          {/* Chat has been moved to the sidebar */}
          
          {/* Media controls with improved styling */}
          <Box 
            sx={{ 
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: { xs: '100%', sm: 'auto' },
              maxWidth: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: { xs: 1.5, sm: 2 },
              px: { xs: 2, sm: 4 },
              mb: { xs: 0, sm: 2 },
              gap: { xs: 1, sm: 1.5, md: 2 },
              backgroundColor: 'rgba(10, 10, 20, 0.85)',
              backdropFilter: 'blur(10px)',
              borderRadius: { xs: '0', sm: '50px' },
              boxShadow: '0 5px 20px rgba(0, 0, 0, 0.3)',
              border: { xs: 'none', sm: '1px solid rgba(255, 255, 255, 0.1)' },
              zIndex: 100,
              transition: 'all 0.3s ease',
              opacity: showControls ? 1 : 0.2,
              '&:hover': {
                opacity: 1
              }
            }}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setTimeout(() => setShowControls(false), 3000)}
          >
            <Tooltip title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}>
              <IconButton 
                onClick={toggleMic}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: micEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(244, 67, 54, 0.2)',
                  '&:hover': { 
                    bgcolor: micEnabled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(244, 67, 54, 0.3)',
                    transform: 'scale(1.05)'
                  },
                  color: micEnabled ? 'white' : '#f44336',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                {micEnabled ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title={videoEnabled ? "Turn Off Camera" : "Turn On Camera"}>
              <IconButton 
                onClick={toggleVideo}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(244, 67, 54, 0.2)',
                  '&:hover': { 
                    bgcolor: videoEnabled ? 'rgba(255, 255, 255, 0.15)' : 'rgba(244, 67, 54, 0.3)',
                    transform: 'scale(1.05)'
                  },
                  color: videoEnabled ? 'white' : '#f44336',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                {videoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}>
              <IconButton 
                onClick={toggleScreenSharing}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: isScreenSharing ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    bgcolor: isScreenSharing ? 'rgba(33, 150, 243, 0.4)' : 'rgba(255, 255, 255, 0.15)',
                    transform: 'scale(1.05)'
                  },
                  color: isScreenSharing ? '#2196f3' : 'white',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Leave Meeting">
              <IconButton 
                onClick={leaveMeeting}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: 'rgba(244, 67, 54, 0.8)',
                  '&:hover': { 
                    bgcolor: 'rgba(244, 67, 54, 1)',
                    transform: 'scale(1.05)'
                  },
                  color: 'white',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <CallEndIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={sidebarContent === 'chat' && sidebarOpen ? "Close Chat" : "Show Chat"}>
              <IconButton 
                onClick={() => toggleSidebar('chat')}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: (sidebarContent === 'chat' && sidebarOpen) ? 'rgba(106, 17, 203, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    bgcolor: (sidebarContent === 'chat' && sidebarOpen) ? 'rgba(106, 17, 203, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                    transform: 'scale(1.05)'
                  },
                  color: (sidebarContent === 'chat' && sidebarOpen) ? 'var(--color-secondary)' : 'white',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <ChatIcon />
                {(!sidebarOpen || sidebarContent !== 'chat') && unreadMessages > 0 && (
                  <Badge 
                    badgeContent={unreadMessages} 
                    color="primary" 
                    sx={{ position: 'absolute', top: 0, right: 0 }}
                  />
                )}
              </IconButton>
            </Tooltip>
            
            <Tooltip title={sidebarContent === 'participants' && sidebarOpen ? "Close Participants" : "Show Participants"}>
              <IconButton 
                onClick={() => toggleSidebar('participants')}
                size={isSmall ? "medium" : "large"}
                sx={{ 
                  bgcolor: (sidebarContent === 'participants' && sidebarOpen) ? 'rgba(106, 17, 203, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': { 
                    bgcolor: (sidebarContent === 'participants' && sidebarOpen) ? 'rgba(106, 17, 203, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                    transform: 'scale(1.05)'
                  },
                  color: (sidebarContent === 'participants' && sidebarOpen) ? 'var(--color-secondary)' : 'white',
                  transition: 'all 0.2s ease',
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                <PersonIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Sliding sidebar for both chat and participants */}
        <Box sx={{ 
          position: 'absolute',
          top: 0,
          right: 0,
          width: { xs: '100%', sm: '350px', md: '380px' },
          height: '100%',
          bgcolor: 'rgba(15, 15, 25, 0.85)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.2)',
          transform: sidebarOpen ? 'translateX(0)' : { xs: 'translateX(100%)', sm: 'translateX(100%)' },
          transition: 'transform 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {/* Sidebar header with tabs */}
          <Box sx={{ 
            px: 2, 
            py: 2, 
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Box 
                onClick={() => setSidebarContent('participants')}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  cursor: 'pointer',
                  pb: 0.5,
                  borderBottom: sidebarContent === 'participants' ? '2px solid var(--color-secondary)' : 'none',
                  opacity: sidebarContent === 'participants' ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  '&:hover': { opacity: 1 }
                }}
              >
                <PersonIcon sx={{ color: 'var(--color-secondary)' }} />
                <Typography variant="subtitle1" fontWeight="600" color="var(--text-primary)">
                  Participants ({participants.length})
                </Typography>
              </Box>
              
              <Box 
                onClick={() => setSidebarContent('chat')}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  cursor: 'pointer',
                  pb: 0.5,
                  borderBottom: sidebarContent === 'chat' ? '2px solid var(--color-secondary)' : 'none',
                  opacity: sidebarContent === 'chat' ? 1 : 0.7,
                  transition: 'all 0.2s ease',
                  '&:hover': { opacity: 1 }
                }}
              >
                <ChatIcon sx={{ color: 'var(--color-secondary)' }} />
                <Typography variant="subtitle1" fontWeight="600" color="var(--text-primary)">
                  Chat {unreadMessages > 0 && sidebarContent !== 'chat' && `(${unreadMessages})`}
                </Typography>
              </Box>
            </Box>
            
            <IconButton 
              onClick={() => setSidebarOpen(false)}
              size="small"
              sx={{ color: 'var(--text-muted)' }}
            >
              <FullscreenExitIcon />
            </IconButton>
          </Box>
          
          {/* Participants Panel - conditionally rendered */}
          <Box sx={{ 
            display: sidebarContent === 'participants' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            overflow: 'hidden'
          }}>
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
                        py: 1.5,
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
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                            <Box sx={{ display: 'flex' }}>
                              {!participant.hasAudio && <MicOffIcon fontSize="small" color="error" sx={{ mr: 0.5 }} />}
                              {!participant.hasVideo && <VideocamOffIcon fontSize="small" color="error" />}
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })
              )}
            </List>
          </Box>
          
          {/* Chat Panel - conditionally rendered */}
          <Box sx={{ 
            display: sidebarContent === 'chat' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Chat message container */}
            <Box sx={{ 
              flex: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
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
                  <ChatIcon sx={{ fontSize: 40, mb: 1, color: 'var(--color-secondary)' }} />
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
              p: { xs: 1.5, md: 2 },
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundColor: 'rgba(10, 10, 20, 0.4)',
            }}>
              <Box 
                sx={{ 
                  display: 'flex',
                  gap: 1,
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
                  size="small"
                  InputProps={{
                    sx: {
                      borderRadius: 'var(--input-radius)',
                      bgcolor: 'rgba(0, 0, 0, 0.2)',
                      color: 'var(--text-primary)',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.1)',
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
                    minWidth: 0,
                  }}
                >
                  <SendIcon />
                </Button>
              </Box>
            </Box>
          </Box>
          
          {/* User status - shown at bottom for both panels */}
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
