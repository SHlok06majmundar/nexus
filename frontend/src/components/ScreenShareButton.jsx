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
function ScreenShareButton({ onScreenShare, onStopScreenShare, socketRef, peerRefs, onError, isScreenSharing, setIsScreenSharing, streamRef }) {
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
        audio: true // Capture system audio from the screen share if available
      });
      
      // Create a combined stream that includes both the screen share and microphone audio
      // This ensures that user's voice continues to work during screen sharing
      let combinedStream = new MediaStream();
      
      // First add all screen sharing tracks
      screenStream.getTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      // Get the user's microphone audio if it's currently enabled
      try {
        if (streamRef && streamRef.current) {
          // Check if there are enabled audio tracks from the user's microphone
          const micTracks = streamRef.current.getAudioTracks().filter(track => track.enabled);
          
          if (micTracks.length > 0) {
            console.log('Adding microphone audio to screen share stream');
            // Clone the microphone tracks to avoid interfering with the original stream
            micTracks.forEach(track => {
              combinedStream.addTrack(track.clone());
            });
          } else {
            console.log('No enabled microphone tracks found');
          }
        }
      } catch (err) {
        console.error('Error adding microphone audio to screen share:', err);
      }
      
      // Store reference to the combined stream
      screenStreamRef.current = combinedStream;
      
      // Handle user manually stopping the screen share
      const videoTrack = combinedStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('User stopped screen sharing via browser controls');
          stopScreenSharing();
        };
      }
      
      // Apply encoding optimizations for video track to reduce initial latency
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
      
      // Send combined stream (screen+mic) to all peers efficiently
      if (peerRefs && peerRefs.current) {
        // Process all peers in parallel for faster distribution
        const peerUpdatePromises = peerRefs.current.map(async ({ peer, id }) => {
          if (peer && peer.connectionState !== 'closed') {
            try {
              console.log(`Updating peer ${id} with screen sharing tracks`);
              
              // Store original senders to restore if needed
              const originalVideoSenders = peer.getSenders().filter(s => 
                s.track && s.track.kind === 'video'
              );
              
              // Clear any saved information about previous tracks
              if (!peer._previousTracks) {
                peer._previousTracks = { video: [], audio: [] };
              }
              
              // Save current video tracks if we haven't already
              if (originalVideoSenders.length > 0 && peer._previousTracks.video.length === 0) {
                console.log(`Saving ${originalVideoSenders.length} original video tracks for peer ${id}`);
                peer._previousTracks.video = originalVideoSenders.map(s => s.track);
              }
              
              // Add a new transceiver for screen video instead of replacing camera video
              // This ensures screen and camera video can coexist
              console.log(`Adding screen video track to peer ${id}`);
              if (videoTrack) {
                // Check if we already have a screen transceiver
                const screenSender = peer.getSenders().find(s => 
                  s.track && s.track.id === videoTrack.id
                );
                
                if (!screenSender) {
                  // Add a new transceiver specifically for screen sharing
                  const screenTransceiver = peer.addTransceiver(videoTrack, {
                    streams: [combinedStream],
                    direction: 'sendonly'
                  });
                  
                  // Set content hints for better quality
                  videoTrack.contentHint = "detail";
                  console.log(`Added screen video track as new transceiver for peer ${id}`);
                } else {
                  console.log(`Screen video track already exists for peer ${id}`);
                }
              }
              
              // Process audio tracks from screen and mic
              const screenAudioTracks = combinedStream.getAudioTracks();
              if (screenAudioTracks.length > 0) {
                console.log(`Found ${screenAudioTracks.length} audio tracks in screen share stream`);
                
                // Get existing audio senders
                const audioSenders = peer.getSenders().filter(s => 
                  s.track && s.track.kind === 'audio'
                );
                
                // Save original audio tracks if needed
                if (audioSenders.length > 0 && peer._previousTracks.audio.length === 0) {
                  console.log(`Saving ${audioSenders.length} original audio tracks for peer ${id}`);
                  peer._previousTracks.audio = audioSenders.map(s => s.track);
                }
                
                // Add all screen audio tracks as new transceivers
                for (const audioTrack of screenAudioTracks) {
                  const existingSender = peer.getSenders().find(s => 
                    s.track && s.track.id === audioTrack.id
                  );
                  
                  if (!existingSender) {
                    console.log(`Adding screen audio track to peer ${id}`);
                    peer.addTransceiver(audioTrack, {
                      streams: [combinedStream],
                      direction: 'sendonly'
                    });
                  }
                }
              }
              
              // Force renegotiation
              if (!peer._negotiating) {
                peer._negotiating = true;
                
                try {
                  console.log(`Creating new offer for peer ${id} to negotiate screen tracks`);
                  const offer = await peer.createOffer();
                  await peer.setLocalDescription(offer);
                  
                  // Send the offer via signaling
                  if (socketRef && socketRef.current) {
                    socketRef.current.emit('offer', {
                      targetId: id,
                      offer: peer.localDescription,
                      offererId: socketRef.current.id,
                      offererUsername: 'Screen Sharing'
                    });
                    console.log(`Sent new offer for screen share to peer ${id}`);
                  }
                } catch (err) {
                  console.error(`Error creating offer for screen share: ${err.message}`);
                } finally {
                  peer._negotiating = false;
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
        // Make sure to use the correct room ID
        const roomId = socketRef.current.roomId || socketRef.current.meetingId;
        console.log(`Emitting screen-share-started event for room: ${roomId}`);
        socketRef.current.emit('screen-share-started', {
          roomId: roomId,
          userId: socketRef.current.id
        });
      }
      
      // Call the callback with the combined stream
      onScreenShare?.(combinedStream);
      
      console.log('Screen sharing started with combined stream:', 
        `Video tracks: ${combinedStream.getVideoTracks().length}`,
        `Audio tracks: ${combinedStream.getAudioTracks().length}`
      );
      
    } catch (err) {
      console.error('Error starting screen sharing:', err);
      
      // Handle user cancellation with specific error messages
      if (err.name === 'NotAllowedError') {
        onError?.('Screen sharing permission was denied. Please allow access to continue.');
      } else if (err.name === 'AbortError') {
        onError?.('Screen sharing was cancelled.');
      } else if (err.name === 'NotFoundError') {
        onError?.('No screen sharing source was found. Please make sure you have a display to share.');
      } else if (err.name === 'NotReadableError') {
        onError?.('Could not read screen content. This may be due to hardware or operating system restrictions.');
      } else if (err.name === 'OverconstrainedError') {
        onError?.('Screen sharing constraints could not be satisfied. Please try again with different options.');
      } else {
        onError?.(`Failed to start screen sharing: ${err.message || 'Unknown error'}`);
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
              console.log(`Cleaning up screen sharing tracks for peer ${id}`);
              const senders = peer.getSenders();
              const screenSenders = [];
              
              // First, find all screen track senders
              senders.forEach(sender => {
                if (sender.track && screenTrackIds.includes(sender.track.id)) {
                  screenSenders.push(sender);
                }
              });
              
              console.log(`Found ${screenSenders.length} screen track senders to remove for peer ${id}`);
              
              // Remove all screen senders
              screenSenders.forEach(sender => {
                try {
                  console.log(`Removing ${sender.track?.kind || 'unknown'} track from peer ${id}`);
                  peer.removeTrack(sender);
                } catch (err) {
                  console.error(`Error removing track from peer ${id}:`, err);
                }
              });
              
              // Restore previous tracks if available
              if (peer._previousTracks) {
                // Restore video tracks
                if (peer._previousTracks.video && peer._previousTracks.video.length > 0) {
                  console.log(`Restoring ${peer._previousTracks.video.length} original video tracks for peer ${id}`);
                  
                  // Check if the original tracks are still valid
                  const validVideoTracks = peer._previousTracks.video.filter(track => 
                    track.readyState === 'live' && !screenTrackIds.includes(track.id)
                  );
                  
                  // Add them back if needed
                  validVideoTracks.forEach(track => {
                    // Check if this track is already present
                    const exists = peer.getSenders().some(s => 
                      s.track && s.track.id === track.id
                    );
                    
                    if (!exists) {
                      try {
                        console.log(`Re-adding original video track to peer ${id}`);
                        peer.addTrack(track);
                      } catch (err) {
                        console.error(`Error re-adding video track to peer ${id}:`, err);
                      }
                    }
                  });
                }
              }
              
              // Force renegotiation
              if (!peer._negotiating) {
                peer._negotiating = true;
                try {
                  console.log(`Creating new offer after removing screen tracks for peer ${id}`);
                  peer.createOffer()
                    .then(offer => peer.setLocalDescription(offer))
                    .then(() => {
                      if (socketRef && socketRef.current) {
                        socketRef.current.emit('offer', {
                          targetId: id,
                          offer: peer.localDescription,
                          offererId: socketRef.current.id
                        });
                        console.log(`Sent new offer after removing screen tracks to peer ${id}`);
                      }
                    })
                    .catch(err => console.error(`Error creating offer after screen stop: ${err.message}`))
                    .finally(() => {
                      peer._negotiating = false;
                    });
                } catch (err) {
                  console.error(`Error during renegotiation for peer ${id}:`, err);
                  peer._negotiating = false;
                }
              }
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
        // Make sure to use the correct room ID
        const roomId = socketRef.current.roomId || socketRef.current.meetingId;
        console.log(`Emitting screen-share-stopped event for room: ${roomId}`);
        socketRef.current.emit('screen-share-stopped', {
          roomId: roomId,
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
