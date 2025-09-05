import React, { useState, useEffect, useRef } from 'react';
import { 
  IconButton, 
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * ScreenShareButton component for handling screen sharing in meetings
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onScreenShare - Callback when screen is shared with the stream
 * @param {Function} props.onStopScreenShare - Callback when screen sharing is stopped
 * @param {Object} props.socketRef - Reference to the socket connection
 * @param {Array} props.peerRefs - Reference to peer connections
 * @param {Function} props.onError - Error handler function
 * @param {boolean} props.isScreenSharing - Whether screen is currently being shared
 * @param {Function} props.setIsScreenSharing - Function to set screen sharing state
 */
function ScreenShareButton({ onScreenShare, onStopScreenShare, socketRef, peerRefs, onError, isScreenSharing, setIsScreenSharing }) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const screenStreamRef = useRef(null);
  
  // Check if browser supports screen sharing
  const isSupported = 'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices;
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopScreenSharing();
    };
  }, []);
  
  /**
   * Toggle screen sharing state
   */
  const toggleScreenSharing = () => {
    if (!isSupported) {
      onError?.('Screen sharing is not supported in your browser. Please try Chrome, Edge, or Firefox.');
      return;
    }
    
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      // Show confirmation dialog
      setIsConfirmDialogOpen(true);
    }
  };
  
  /**
   * Start screen sharing
   */
  const startScreenSharing = async () => {
    try {
      console.log('Starting screen sharing...');
      
      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { max: 30 }
        },
        audio: true // Include audio from the screen if available (like system audio)
      });
      
      // Store reference to the screen stream
      screenStreamRef.current = screenStream;
      
      // Handle user manually stopping the screen share
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('User stopped screen sharing via browser controls');
        stopScreenSharing();
      };
      
      // Update state
      setIsScreenSharing(true);
      
      // Send screen stream to all peers
      if (peerRefs && peerRefs.current) {
        peerRefs.current.forEach(({ peer }) => {
          if (peer && peer.connectionState !== 'closed') {
            // Get all screen tracks
            screenStream.getTracks().forEach(track => {
              console.log(`Adding screen track ${track.kind} to peer`);
              peer.addTrack(track, screenStream);
            });
          }
        });
      }
      
      // Notify about the screen share to help synchronize UI for other users
      if (socketRef && socketRef.current) {
        socketRef.current.emit('screen-share-started', {
          roomId: socketRef.current.roomId,
          userId: socketRef.current.id
        });
      }
      
      // Call the callback with the screen stream
      onScreenShare?.(screenStream);
      
    } catch (err) {
      console.error('Error starting screen sharing:', err);
      
      // Handle user cancellation
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        onError?.('Screen sharing was cancelled or permission was denied.');
      } else {
        onError?.(`Failed to start screen sharing: ${err.message}`);
      }
      
      setIsScreenSharing(false);
    }
  };
  
  /**
   * Stop screen sharing
   */
  const stopScreenSharing = () => {
    // Don't do anything if not sharing
    if (!isScreenSharing || !screenStreamRef.current) return;
    
    console.log('Stopping screen sharing...');
    
    try {
      // Stop all tracks in the screen stream
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      
      // Remove screen share tracks from all peers
      if (peerRefs && peerRefs.current) {
        peerRefs.current.forEach(({ peer }) => {
          if (peer && peer.connectionState !== 'closed') {
            const senders = peer.getSenders();
            const screenTrackIds = screenStreamRef.current.getTracks().map(track => track.id);
            
            senders.forEach(sender => {
              if (sender.track && screenTrackIds.includes(sender.track.id)) {
                console.log(`Removing screen track ${sender.track.kind} from peer`);
                peer.removeTrack(sender);
              }
            });
          }
        });
      }
      
      // Notify peers about stopping screen share
      if (socketRef && socketRef.current) {
        socketRef.current.emit('screen-share-stopped', {
          roomId: socketRef.current.roomId,
          userId: socketRef.current.id
        });
      }
      
      // Call the callback
      onStopScreenShare?.();
      
    } catch (err) {
      console.error('Error stopping screen sharing:', err);
    } finally {
      // Clear the reference and update state
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    }
  };
  
  return (
    <>
      <Tooltip title={isScreenSharing ? "Stop Screen Sharing" : (isSupported ? "Share Your Screen" : "Screen Sharing Not Supported")}>
        <span>
          <IconButton
            onClick={toggleScreenSharing}
            disabled={!isSupported}
            sx={{ 
              bgcolor: isScreenSharing ? 'rgba(76, 175, 80, 0.1)' : 'rgba(156, 39, 176, 0.1)', 
              color: isScreenSharing ? 'var(--color-success)' : 'var(--color-primary)', 
              borderRadius: 'var(--button-radius)',
              p: { xs: 1, sm: 1.5 },
              '&:hover': {
                bgcolor: isScreenSharing ? 'rgba(76, 175, 80, 0.2)' : 'rgba(156, 39, 176, 0.2)'
              }
            }}
          >
            {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
          </IconButton>
        </span>
      </Tooltip>
      
      {/* Confirmation Dialog */}
      <Dialog
        open={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        aria-labelledby="screen-share-dialog-title"
      >
        <DialogTitle id="screen-share-dialog-title">
          Share Your Screen
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <ErrorOutlineIcon sx={{ color: 'var(--color-warning)', mr: 1, mt: 0.5 }} />
            <Typography variant="body1">
              You're about to share your screen with all meeting participants. They will be able to see everything displayed on your screen.
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            • You can choose which window or your entire screen to share in the next dialog
            <br />
            • To stop sharing, click the "Stop Sharing" button or close this browser tab
            <br />
            • System audio sharing depends on your browser and operating system support
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setIsConfirmDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 'var(--button-radius)' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setIsConfirmDialogOpen(false);
              startScreenSharing();
            }}
            variant="contained"
            color="primary"
            sx={{ 
              borderRadius: 'var(--button-radius)',
              bgcolor: 'var(--color-primary)',
              '&:hover': {
                bgcolor: 'var(--color-primary-dark)'
              }
            }}
            autoFocus
          >
            Share Screen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ScreenShareButton;
