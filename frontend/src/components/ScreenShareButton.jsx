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
   * Start screen sharing with optimized performance
   */
  const startScreenSharing = async () => {
    try {
      console.log('Starting screen sharing with optimized settings...');
      
      // Update UI state immediately for faster perceived response
      setIsScreenSharing(true);
      
      // Get screen stream with optimized settings for better performance
      // Use more browser-compatible constraints
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: 'always',
          displaySurface: 'monitor',
          // Avoid using min constraints which may not be supported in all browsers
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          // Use only ideal for frameRate to be more compatible
          frameRate: { ideal: 24 }
        },
        audio: true // Simplified audio constraint for better compatibility
      });
      
      // Store reference to the screen stream
      screenStreamRef.current = screenStream;
      
      // Handle user manually stopping the screen share
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('User stopped screen sharing via browser controls');
        stopScreenSharing();
      };
      
      // Apply encoding optimizations for video track to reduce initial latency
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        // Apply content hints to optimize encoding
        videoTrack.contentHint = "detail";
        
        // Set priority to high for better quality
        try {
          const constraints = { priority: 'high' };
          videoTrack.applyConstraints(constraints);
        } catch (e) {
          console.log('Could not apply constraints to screen track:', e);
        }
      }
      
      // Send screen stream to all peers efficiently
      if (peerRefs && peerRefs.current) {
        // Process all peers in parallel for faster distribution
        const peerUpdatePromises = peerRefs.current.map(async ({ peer, id }) => {
          if (peer && peer.connectionState !== 'closed') {
            try {
              const videoSender = peer.getSenders().find(s => 
                s.track && s.track.kind === 'video' && s.track.readyState === 'live'
              );
              
              // Prioritize video track handling for faster sharing
              if (videoTrack) {
                if (videoSender) {
                  // Replace existing track for better performance
                  console.log(`Replacing video track for peer ${id}`);
                  await videoSender.replaceTrack(videoTrack);
                } else {
                  // Add as new track if no existing track
                  console.log(`Adding screen video track to peer ${id}`);
                  peer.addTrack(videoTrack, screenStream);
                }
              }
              
              // Process audio track after video for better perceived performance
              const audioTrack = screenStream.getAudioTracks()[0];
              if (audioTrack) {
                const audioSender = peer.getSenders().find(s => 
                  s.track && s.track.kind === 'audio'
                );
                
                if (!audioSender) {
                  console.log(`Adding screen audio track to peer ${id}`);
                  peer.addTrack(audioTrack, screenStream);
                }
              }
            } catch (err) {
              console.error(`Error sending screen to peer ${id}:`, err);
            }
          }
        });
        
        // Wait for all peer updates to complete
        Promise.all(peerUpdatePromises).catch(err => 
          console.error('Error updating peers with screen share:', err)
        );
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
   * Stop screen sharing with optimized cleanup
   */
  const stopScreenSharing = () => {
    // Don't do anything if not sharing
    if (!isScreenSharing || !screenStreamRef.current) return;
    
    console.log('Stopping screen sharing...');
    
    // Update UI state immediately for responsive feedback
    setIsScreenSharing(false);
    
    try {
      // Get track references before stopping them
      const screenTrackIds = screenStreamRef.current.getTracks().map(track => track.id);
      const videoTrack = screenStreamRef.current.getVideoTracks()[0];
      
      // Process peer connections first for faster UI response on remote ends
      if (peerRefs && peerRefs.current) {
        // Process connections in parallel
        peerRefs.current.forEach(({ peer, id }) => {
          if (peer && peer.connectionState !== 'closed') {
            try {
              const senders = peer.getSenders();
              
              // Find and clean up video senders first (most important for UI feedback)
              const videoSender = senders.find(sender => 
                sender.track && 
                sender.track.kind === 'video' && 
                screenTrackIds.includes(sender.track.id)
              );
              
              if (videoSender) {
                // Instead of removing the track (which can be slow),
                // replace it with a null track or stop it
                if (videoTrack) {
                  videoTrack.enabled = false;
                  console.log(`Disabled screen video track for peer ${id}`);
                  peer.removeTrack(videoSender);
                }
              }
              
              // Then process other tracks
              senders.forEach(sender => {
                if (sender !== videoSender && 
                    sender.track && 
                    screenTrackIds.includes(sender.track.id)) {
                  console.log(`Removing screen track ${sender.track.kind} from peer ${id}`);
                  peer.removeTrack(sender);
                }
              });
            } catch (err) {
              console.error(`Error cleaning up screen share for peer ${id}:`, err);
            }
          }
        });
      }
      
      // Stop all tracks in the screen stream AFTER peer handling
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped screen track: ${track.kind}`);
      });
      
      // Clear the reference to free memory
      screenStreamRef.current = null;
      
      // Emit screen share stopped event to all participants for faster UI updates
      if (socketRef && socketRef.current) {
        socketRef.current.emit('screen-share-stopped', {
          roomId: socketRef.current.roomId,
          userId: socketRef.current.id
        });
        console.log('Notified peers of screen share stopped');
      }
      
      // Schedule a garbage collection hint (not guaranteed, but can help)
      if (window.gc) {
        try {
          window.gc();
        } catch (e) {
          console.log('Manual GC not available');
        }
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
              position: 'relative',
              '&:hover': {
                bgcolor: isScreenSharing ? 'rgba(76, 175, 80, 0.2)' : 'rgba(156, 39, 176, 0.2)'
              },
              // Animated pulsing effect when sharing
              ...(isScreenSharing && {
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '-4px',
                  left: '-4px',
                  right: '-4px',
                  bottom: '-4px',
                  border: '2px solid var(--color-success)',
                  borderRadius: 'var(--button-radius)',
                  animation: 'pulse 2s infinite',
                  opacity: 0.6,
                  zIndex: -1
                },
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)', opacity: 0.6 },
                  '50%': { transform: 'scale(1.05)', opacity: 0.8 },
                  '100%': { transform: 'scale(1)', opacity: 0.6 }
                }
              })
            }}
          >
            {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            {/* Live indicator dot */}
            {isScreenSharing && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 8,
                  height: 8,
                  bgcolor: 'var(--color-success)',
                  borderRadius: '50%',
                  animation: 'livePulse 1.5s infinite ease-in-out'
                }}
              />
            )}
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
