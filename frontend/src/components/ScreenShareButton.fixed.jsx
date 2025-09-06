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
 * @param {Object} props.streamRef - Reference to the current stream
 * @param {Object} props.videoRef - Reference to the video element
 * @param {string|null} props.activeScreenSharingUser - ID of the user currently sharing screen, if any
 */
function ScreenShareButton({ 
  onScreenShare, 
  onStopScreenShare, 
  socketRef, 
  peerRefs, 
  onError, 
  isScreenSharing, 
  setIsScreenSharing, 
  streamRef, 
  videoRef,
  activeScreenSharingUser 
}) {
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
  
  // Share screen with a new peer that joined during active screen sharing
  useEffect(() => {
    // Function to share screen with a new peer that connects during screen sharing
    const handleNewPeerDuringScreenShare = (newPeerId) => {
      // Only proceed if we're currently screen sharing
      if (!isScreenSharing || !screenStreamRef.current) return;
      
      console.log(`New peer ${newPeerId} connected during screen sharing, sending screen`);
      
      // Find the peer in peerRefs
      if (peerRefs && peerRefs.current) {
        const peerObj = peerRefs.current.find(p => p.id === newPeerId);
        if (!peerObj || !peerObj.peer) {
          console.warn(`Could not find peer ${newPeerId} in peerRefs`);
          return;
        }
        
        const peer = peerObj.peer;
        
        // Get tracks from the current screen sharing stream
        const videoTrack = screenStreamRef.current.getVideoTracks()[0];
        const audioTracks = screenStreamRef.current.getAudioTracks();
        
        // Add screen video track
        if (videoTrack) {
          try {
            console.log(`Adding screen video track to new peer ${newPeerId}`);
            peer.addTrack(videoTrack, screenStreamRef.current);
          } catch (err) {
            console.error(`Error adding video track to new peer: ${err.message}`);
          }
        }
        
        // Add all audio tracks
        for (const audioTrack of audioTracks) {
          try {
            console.log(`Adding audio track to new peer ${newPeerId}`);
            peer.addTrack(audioTrack, screenStreamRef.current);
          } catch (err) {
            console.error(`Error adding audio track to new peer: ${err.message}`);
          }
        }
        
        // Force renegotiation
        if (!peer._negotiating) {
          peer._negotiating = true;
          
          peer.createOffer()
            .then(offer => peer.setLocalDescription(offer))
            .then(() => {
              if (socketRef && socketRef.current) {
                socketRef.current.emit('offer', {
                  targetId: newPeerId,
                  offer: peer.localDescription,
                  offererId: socketRef.current.id,
                  offererUsername: 'Screen Sharing (New Peer)'
                });
              }
            })
            .catch(err => console.error(`Error creating offer for new peer: ${err.message}`))
            .finally(() => {
              peer._negotiating = false;
            });
        }
      }
    };
    
    // Set up event listener when screen sharing is active
    if (isScreenSharing && socketRef && socketRef.current) {
      console.log('Adding new-peer event listener for screen sharing');
      socketRef.current.on('new-peer', handleNewPeerDuringScreenShare);
      
      // Cleanup
      return () => {
        socketRef.current.off('new-peer', handleNewPeerDuringScreenShare);
      };
    }
    
    return () => {};
  }, [isScreenSharing, peerRefs, socketRef]);
  
  /**
   * Toggle screen sharing
   */
  const toggleScreenSharing = () => {
    // Don't do anything if screen sharing isn't supported
    if (!isSupported) {
      if (onError) onError('Screen sharing is not supported in this browser.');
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
   * Start screen sharing with optimized performance and fixed audio
   */
  const startScreenSharing = async () => {
    try {
      console.log('Starting screen sharing with optimized settings and fixed audio...');
      
      // Update UI state immediately for faster perceived response
      setIsScreenSharing(true);
      
      // IMPROVED APPROACH:
      // 1. Get microphone access first to ensure audio works consistently
      // 2. Then request screen sharing with optimized settings
      // 3. Create a proper combined stream with both sources
      // 4. Send the combined stream to peers with proper track management
      
      // Step 1: Get microphone access first to ensure audio works consistently
      let micStream;
      try {
        console.log('Getting microphone access first...');
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Use optimal audio settings for calls
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // Set higher sampling for better quality
            sampleRate: 48000,
            sampleSize: 16
          }
        });
        console.log('Successfully got microphone access:', 
          micStream.getAudioTracks().map(t => `${t.label} (enabled: ${t.enabled})`));
      } catch (micErr) {
        console.warn('Could not get microphone access:', micErr);
        // Show warning but continue - screen sharing might still work
        if (onError) {
          onError('Microphone access failed. Your voice may not be heard during screen sharing.');
        }
      }
      
      // Step 2: Now get screen stream with optimized performance settings
      console.log('Getting screen media...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: 'always',
          displaySurface: 'monitor',
          // Optimized video settings for better performance
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { max: 25 } // Slightly lower for better performance
        },
        audio: true // Try to capture system audio if available
      });
      console.log('Got screen share stream with tracks:', 
        screenStream.getTracks().map(t => `${t.kind}:${t.label} (enabled: ${t.enabled})`));
      
      // Step 3: Create a NEW MediaStream that will combine screen video and microphone audio
      let combinedStream = new MediaStream();
      
      // Step 3a: First add the screen video track
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        combinedStream.addTrack(screenVideoTrack);
        console.log('Added screen video track to combined stream:', screenVideoTrack.label);
        
        // Apply content hints for better quality
        screenVideoTrack.contentHint = "detail";
        
        // Monitor track ending to stop screen share
        screenVideoTrack.onended = () => {
          console.log('Screen video track ended by browser UI');
          stopScreenSharing();
        };
      } else {
        console.error('No video track found in screen share stream!');
        throw new Error('No video track in screen share');
      }
      
      // Step 3b: Check for system audio in the screen share
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenAudioTrack = screenAudioTracks[0];
        console.log('Screen share includes system audio:', screenAudioTrack.label);
        combinedStream.addTrack(screenAudioTrack);
      }
      
      // Step 3c: Add microphone audio - CRITICAL for fixing audio issues
      let micAudioTrack = null;
      
      // First try using the mic stream we just acquired (most reliable)
      if (micStream && micStream.getAudioTracks().length > 0) {
        micAudioTrack = micStream.getAudioTracks()[0];
        micAudioTrack.enabled = true; // Ensure it's enabled
        
        // Add a clone to avoid interference
        const micTrackClone = micAudioTrack.clone();
        micTrackClone.enabled = true;
        
        combinedStream.addTrack(micTrackClone);
        console.log('Added fresh microphone audio to combined stream:', micTrackClone.label);
        
        // Store references for cleanup
        screenStreamRef.current = combinedStream;
        screenStreamRef.current._freshMicTrack = micAudioTrack;
        screenStreamRef.current._micTrackClone = micTrackClone;
      } 
      // If we couldn't get a fresh mic stream, try from the existing stream
      else if (streamRef && streamRef.current) {
        const existingMicTracks = streamRef.current.getAudioTracks();
        if (existingMicTracks.length > 0) {
          micAudioTrack = existingMicTracks[0];
          // Enable the track to ensure audio works
          micAudioTrack.enabled = true;
          
          // Clone it for our combined stream
          const micTrackClone = micAudioTrack.clone();
          micTrackClone.enabled = true;
          
          combinedStream.addTrack(micTrackClone);
          console.log('Added existing microphone audio to combined stream:', micTrackClone.label);
          
          // Store references
          screenStreamRef.current = combinedStream;
          screenStreamRef.current._existingMicTrack = micAudioTrack;
          screenStreamRef.current._existingMicTrackClone = micTrackClone;
        }
      }
      
      // Log the final track composition
      console.log('Final combined stream composition:');
      console.log('- Video tracks:', combinedStream.getVideoTracks().map(t => t.label));
      console.log('- Audio tracks:', combinedStream.getAudioTracks().map(t => t.label));
      
      // Update the video element with screen share
      if (videoRef && videoRef.current) {
        videoRef.current.srcObject = screenStream; // Just show the screen video locally
      }
      
      // Send combined stream (screen+mic) to all peers efficiently
      if (peerRefs && peerRefs.current) {
        console.log(`Sending screen share stream to ${peerRefs.current.length} peers`);
        console.log(`Stream has ${combinedStream.getVideoTracks().length} video tracks and ${combinedStream.getAudioTracks().length} audio tracks`);
        
        // Process all peers in parallel for faster distribution
        const peerUpdatePromises = peerRefs.current.map(async ({ peer, id }) => {
          if (peer && peer.connectionState !== 'closed') {
            try {
              console.log(`Updating peer ${id} with screen sharing tracks`);
              
              // TRACK MANAGEMENT: Store original tracks to restore when screen sharing ends
              if (!peer._previousTracks) {
                peer._previousTracks = { video: [], audio: [] };
                
                // Save current video tracks
                const videoSenders = peer.getSenders().filter(s => 
                  s.track && s.track.kind === 'video'
                );
                
                if (videoSenders.length > 0) {
                  console.log(`Saving ${videoSenders.length} original video tracks for peer ${id}`);
                  peer._previousTracks.video = videoSenders.map(s => s.track).filter(t => t && t.readyState === 'live');
                }
                
                // Save current audio tracks
                const audioSenders = peer.getSenders().filter(s => 
                  s.track && s.track.kind === 'audio'
                );
                
                if (audioSenders.length > 0) {
                  console.log(`Saving ${audioSenders.length} original audio tracks for peer ${id}`);
                  peer._previousTracks.audio = audioSenders.map(s => s.track).filter(t => t && t.readyState === 'live');
                }
              }
              
              // CRITICAL FIX: For better performance and reliability with audio:
              // 1. First add video track by replacing existing sender if possible
              // 2. Handle audio tracks separately and carefully
              
              // Handle screen video track first
              if (screenVideoTrack) {
                console.log(`Adding screen video track to peer ${id}`);
                
                // Try to replace existing video track first (faster than adding new track)
                const videoSender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
                
                if (videoSender) {
                  try {
                    await videoSender.replaceTrack(screenVideoTrack);
                    screenVideoTrack.contentHint = "detail"; // Optimize encoding
                    console.log(`Successfully replaced video track for peer ${id}`);
                  } catch (err) {
                    console.warn(`Could not replace video track: ${err.message}, trying addTrack`);
                    try {
                      peer.addTrack(screenVideoTrack, combinedStream);
                    } catch (addErr) {
                      console.error(`Failed to add screen video track: ${addErr.message}`);
                    }
                  }
                } else {
                  // No existing video sender, add a new one
                  try {
                    peer.addTrack(screenVideoTrack, combinedStream);
                    screenVideoTrack.contentHint = "detail";
                    console.log(`Added new screen video track to peer ${id}`);
                  } catch (err) {
                    console.error(`Error adding screen video track: ${err.message}`);
                  }
                }
              }
              
              // Now handle audio tracks - THIS IS THE CRUCIAL PART FOR FIXING AUDIO ISSUES
              const audioTracks = combinedStream.getAudioTracks();
              
              if (audioTracks.length > 0) {
                console.log(`Adding ${audioTracks.length} audio tracks to peer ${id}`);
                
                // For reliable audio during screen sharing, we'll use a more robust approach:
                // 1. First, temporarily store any existing audio senders
                // 2. Then remove all current audio senders to avoid conflicts
                // 3. Finally add our new audio tracks with proper stream association
                
                // Get all existing audio senders
                const existingAudioSenders = peer.getSenders().filter(sender => 
                  sender.track && sender.track.kind === 'audio'
                );
                
                console.log(`Found ${existingAudioSenders.length} existing audio senders for peer ${id}`);
                
                // Temporarily store the tracks from these senders if we need to restore them later
                const existingAudioTracks = existingAudioSenders.map(sender => sender.track);
                
                // Remove all existing audio senders to avoid conflicts
                for (const sender of existingAudioSenders) {
                  try {
                    console.log(`Temporarily removing existing audio sender from peer ${id}`);
                    peer.removeTrack(sender);
                  } catch (removeErr) {
                    console.warn(`Could not remove existing audio sender: ${removeErr.message}`);
                  }
                }
                
                // Now add each of our audio tracks to the peer connection with proper stream association
                let audioAddSuccess = false;
                
                for (const audioTrack of audioTracks) {
                  try {
                    // First make absolutely sure the track is enabled
                    audioTrack.enabled = true;
                    
                    // Add the track with explicit stream association for proper audio mixing
                    console.log(`Adding audio track "${audioTrack.label}" to peer ${id} with stream association`);
                    const sender = peer.addTrack(audioTrack, combinedStream);
                    
                    // Set audio priority to high for better quality
                    try {
                      const params = sender.getParameters();
                      if (!params.encodings) {
                        params.encodings = [{}];
                      }
                      params.encodings.forEach(encoding => {
                        encoding.priority = 'high';
                      });
                      sender.setParameters(params).catch(err => 
                        console.warn(`Could not set audio priority: ${err.message}`)
                      );
                    } catch (paramErr) {
                      console.warn(`Could not set audio parameters: ${paramErr.message}`);
                    }
                    
                    console.log(`Successfully added audio track to peer ${id}`);
                    audioAddSuccess = true;
                  } catch (err) {
                    console.error(`Error adding audio track to peer ${id}:`, err);
                    
                    // If we get an InvalidAccessError, try using replaceTrack instead
                    if (err.name === 'InvalidAccessError') {
                      console.log('Audio track conflicts, trying alternative approach...');
                      
                      try {
                        // Create a new sender with a transceiver
                        const transceiver = peer.addTransceiver('audio', {
                          direction: 'sendonly',
                          streams: [combinedStream]
                        });
                        
                        console.log('Added audio transceiver');
                        
                        // Set the track on the transceiver
                        await transceiver.sender.replaceTrack(audioTrack);
                        console.log('Set audio track on transceiver');
                        
                        audioAddSuccess = true;
                      } catch (transceiverErr) {
                        console.error(`Transceiver approach failed: ${transceiverErr.message}`);
                      }
                    }
                  }
                }
                
                // Double-check that we have at least one audio sender after all this
                const currentAudioSenders = peer.getSenders().filter(s => 
                  s.track && s.track.kind === 'audio' && s.track.enabled
                );
                
                console.log(`Peer ${id} now has ${currentAudioSenders.length} audio senders after setup`);
                
                // If we still don't have any audio senders, try our most aggressive fallback
                if (currentAudioSenders.length === 0) {
                  console.warn(`No audio senders found for peer ${id}, trying last resort approach`);
                  
                  try {
                    // As an absolute last resort, try to create a new RTCRtpSender directly
                    const audioTrack = audioTracks[0];
                    
                    // First try negotiated add
                    peer.addTrack(audioTrack);
                    console.log(`Added audio track as last resort for peer ${id}`);
                    
                    // Check if we have a sender now
                    const nowHasAudioSender = peer.getSenders().some(s => 
                      s.track && s.track.kind === 'audio' && s.track.enabled
                    );
                    
                    console.log(`Last resort approach ${nowHasAudioSender ? 'successful' : 'failed'}`);
                  } catch (lastResortErr) {
                    console.error(`Last resort audio approach failed for peer ${id}:`, lastResortErr);
                    
                    // If all else fails, restore original audio tracks
                    console.log(`Attempting to restore original ${existingAudioTracks.length} audio tracks`);
                    for (const track of existingAudioTracks) {
                      if (track && track.readyState === 'live') {
                        try {
                          peer.addTrack(track);
                          console.log(`Restored original audio track: ${track.label}`);
                        } catch (restoreErr) {
                          console.error(`Could not restore audio track: ${restoreErr.message}`);
                        }
                      }
                    }
                  }
                }
              } else {
                console.warn(`No audio tracks found in combined stream for peer ${id}`);
                
                // If no audio tracks found, try to get microphone audio directly as a fallback
                try {
                  console.log(`Attempting to add microphone audio as fallback for peer ${id}`);
                  
                  if (streamRef && streamRef.current) {
                    const micTracks = streamRef.current.getAudioTracks();
                    if (micTracks.length > 0) {
                      console.log(`Adding fallback microphone track to peer ${id}`);
                      const micTrack = micTracks[0].clone();
                      micTrack.enabled = true;
                      
                      try {
                        peer.addTrack(micTrack, combinedStream);
                        console.log(`Successfully added fallback microphone track to peer ${id}`);
                      } catch (err) {
                        console.error(`Error adding fallback mic track: ${err.message}`);
                      }
                    }
                  }
                } catch (micErr) {
                  console.error(`Error adding fallback microphone: ${micErr.message}`);
                }
              }
              
              // Force renegotiation with improved reliability for audio
              if (!peer._negotiating) {
                peer._negotiating = true;
                
                try {
                  console.log(`Creating new offer for peer ${id} to negotiate screen tracks with audio`);
                  
                  // Force audio and video to be included in the offer
                  const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: true
                  };
                  
                  const offer = await peer.createOffer(offerOptions);
                  
                  // Log SDP for debugging audio issues
                  console.log(`Offer SDP for peer ${id}:`, offer.sdp.substring(0, 100) + '...');
                  
                  // Check if audio is included in the SDP
                  if (!offer.sdp.includes('m=audio')) {
                    console.warn(`No audio section in offer SDP for peer ${id} - attempting to fix`);
                    
                    // Check if we have active audio tracks and show specific warning
                    if (audioTracks.length > 0) {
                      console.warn(`Offer is missing audio section despite having ${audioTracks.length} audio tracks`);
                    }
                  } else {
                    console.log(`Confirmed audio section exists in offer SDP for peer ${id}`);
                  }
                  
                  await peer.setLocalDescription(offer);
                  
                  if (socketRef && socketRef.current) {
                    socketRef.current.emit('offer', {
                      targetId: id,
                      offer: peer.localDescription,
                      offererId: socketRef.current.id,
                      offererUsername: 'Screen Sharing'
                    });
                    console.log(`Sent screen sharing offer to peer ${id}`);
                  } else {
                    console.error(`socketRef or socketRef.current is null, cannot send offer to peer ${id}`);
                  }
                } catch (err) {
                  console.error(`Error creating offer for peer ${id}:`, err);
                  
                  // Try a simplified approach if the first one fails
                  try {
                    console.log(`Trying simplified offer for peer ${id}`);
                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);
                    
                    if (socketRef && socketRef.current) {
                      socketRef.current.emit('offer', {
                        targetId: id,
                        offer: peer.localDescription,
                        offererId: socketRef.current.id,
                        offererUsername: 'Screen Sharing (Simplified)'
                      });
                      console.log(`Sent simplified screen sharing offer to peer ${id}`);
                    }
                  } catch (retryErr) {
                    console.error(`Failed with simplified offer too: ${retryErr.message}`);
                  }
                }
                
                // Set a timeout to reset the negotiation flag after 5 seconds
                // This prevents getting stuck in negotiation state
                setTimeout(() => {
                  if (peer._negotiating) {
                    console.log(`Clearing negotiation flag for peer ${id} after timeout`);
                    peer._negotiating = false;
                  }
                }, 5000);
              } else {
                console.warn(`Peer ${id} is already negotiating, skipped offer`);
              }
            } catch (err) {
              console.error(`General error updating peer ${id} with screen share:`, err);
              peer._negotiating = false;
            }
          }
        });
        
        // Wait for all peer updates to complete
        try {
          await Promise.allSettled(peerUpdatePromises);
          console.log('Finished updating all peers with screen share');
        } catch (err) {
          console.warn('Some peer updates may have failed:', err);
        }
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
              
              // Find all screen track senders (video and audio)
              for (const sender of senders) {
                if (sender.track && screenTrackIds.includes(sender.track.id)) {
                  screenSenders.push(sender);
                  console.log(`Found screen track sender: ${sender.track.kind}/${sender.track.id}`);
                }
              }
              
              // Remove the screen video senders
              const videoSenders = screenSenders.filter(sender => 
                sender.track && sender.track.kind === 'video'
              );
              
              videoSenders.forEach(sender => {
                try {
                  console.log(`Removing screen video track from peer ${id}`);
                  peer.removeTrack(sender);
                } catch (err) {
                  console.error(`Error removing video track from peer ${id}:`, err);
                }
              });
              
              // Remove the screen audio senders
              const audioSenders = screenSenders.filter(sender => 
                sender.track && sender.track.kind === 'audio'
              );
              
              audioSenders.forEach(sender => {
                try {
                  console.log(`Removing screen audio track from peer ${id}`);
                  peer.removeTrack(sender);
                } catch (err) {
                  console.error(`Error removing audio track from peer ${id}:`, err);
                }
              });
              
              // Restore previous tracks if available
              if (peer._previousTracks) {
                // Restore video tracks
                if (peer._previousTracks.video && peer._previousTracks.video.length > 0) {
                  console.log(`Restoring ${peer._previousTracks.video.length} original video tracks for peer ${id}`);
                  
                  // Check if the original tracks are still valid
                  const validVideoTracks = peer._previousTracks.video.filter(track => 
                    track && track.readyState === 'live' && !screenTrackIds.includes(track.id)
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
                
                // Restore audio tracks - this is crucial for mic audio after screen sharing
                if (peer._previousTracks.audio && peer._previousTracks.audio.length > 0) {
                  console.log(`Restoring ${peer._previousTracks.audio.length} original audio tracks for peer ${id}`);
                  
                  // Check if the original tracks are still valid
                  const validAudioTracks = peer._previousTracks.audio.filter(track => 
                    track && track.readyState === 'live' && !screenTrackIds.includes(track.id)
                  );
                  
                  // Check current audio senders
                  const currentAudioSenders = peer.getSenders().filter(sender =>
                    sender.track && sender.track.kind === 'audio'
                  );
                  
                  console.log(`Peer ${id} has ${currentAudioSenders.length} audio senders after screen cleanup`);
                  
                  // Add original audio tracks back if needed
                  validAudioTracks.forEach(track => {
                    // Check if this track is already present
                    const exists = peer.getSenders().some(s => 
                      s.track && s.track.id === track.id
                    );
                    
                    if (!exists) {
                      try {
                        console.log(`Re-adding original audio track to peer ${id}`);
                        peer.addTrack(track);
                      } catch (err) {
                        console.error(`Error re-adding audio track to peer ${id}:`, err);
                        
                        // Try replacing an existing audio sender as fallback
                        try {
                          if (currentAudioSenders.length > 0) {
                            console.log(`Trying to replace track in existing audio sender`);
                            currentAudioSenders[0].replaceTrack(track);
                          }
                        } catch (replaceErr) {
                          console.error(`Error replacing audio track:`, replaceErr);
                        }
                      }
                    }
                  });
                }
              }
              
              // Force renegotiation with improved audio handling
              if (!peer._negotiating) {
                peer._negotiating = true;
                try {
                  console.log(`Creating new offer after removing screen tracks for peer ${id}`);
                  
                  // Check if we have audio tracks active in the peer connection
                  const activeAudioSenders = peer.getSenders().filter(sender =>
                    sender.track && sender.track.kind === 'audio' && sender.track.enabled
                  );
                  
                  console.log(`Peer ${id} has ${activeAudioSenders.length} active audio senders before renegotiation`);
                  
                  // Force include audio in the offer
                  const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: true
                  };
                  
                  // Create the offer with a timeout
                  const offerPromise = peer.createOffer(offerOptions)
                    .then(offer => {
                      // Log if audio is included in the SDP
                      if (!offer.sdp.includes('m=audio')) {
                        console.warn(`No audio section in offer SDP after screen stop for peer ${id} - checking active tracks`);
                        
                        // Log active tracks for debugging
                        peer.getSenders().forEach(sender => {
                          if (sender.track) {
                            console.log(`Active track in sender: ${sender.track.kind}, ${sender.track.label}, enabled: ${sender.track.enabled}`);
                          }
                        });
                      } else {
                        console.log(`Confirmed audio section exists in offer SDP after screen stop for peer ${id}`);
                      }
                      
                      return peer.setLocalDescription(offer);
                    })
                    .then(() => {
                      if (socketRef && socketRef.current) {
                        socketRef.current.emit('offer', {
                          targetId: id,
                          offer: peer.localDescription,
                          offererId: socketRef.current.id,
                          offererUsername: 'After Screen Share'
                        });
                        console.log(`Sent new offer after removing screen tracks to peer ${id}`);
                      } else {
                        console.error(`socketRef or socketRef.current is null, cannot send offer to peer ${id}`);
                      }
                    })
                    .catch(err => {
                      console.error(`Error creating offer after screen stop: ${err.message}`);
                      
                      // Try a simplified approach as fallback
                      return peer.createOffer()
                        .then(offer => peer.setLocalDescription(offer))
                        .then(() => {
                          if (socketRef && socketRef.current) {
                            socketRef.current.emit('offer', {
                              targetId: id,
                              offer: peer.localDescription,
                              offererId: socketRef.current.id
                            });
                            console.log(`Sent simplified offer after screen stop to peer ${id}`);
                          }
                        });
                    })
                    .finally(() => {
                      // Delay clearing the negotiation flag
                      setTimeout(() => {
                        peer._negotiating = false;
                      }, 1000);
                    });
                    
                  // Set a timeout for the renegotiation
                  setTimeout(() => {
                    if (peer._negotiating) {
                      console.warn(`Renegotiation for peer ${id} is taking too long, resetting flag`);
                      peer._negotiating = false;
                    }
                  }, 8000); // 8 second timeout
                  
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
      
      // Properly clean up all tracks created during screen sharing
      if (screenStreamRef.current) {
        console.log('Stopping screen sharing tracks...');
        
        // First process any cloned tracks we created
        if (screenStreamRef.current._clonedMicTracks && screenStreamRef.current._clonedMicTracks.length > 0) {
          console.log(`Cleaning up ${screenStreamRef.current._clonedMicTracks.length} cloned mic tracks`);
          screenStreamRef.current._clonedMicTracks.forEach(track => {
            try {
              track.stop();
              console.log(`Stopped cloned mic track: ${track.label}`);
            } catch (err) {
              console.warn(`Error stopping cloned track: ${err.message}`);
            }
          });
          delete screenStreamRef.current._clonedMicTracks;
        }
        
        // Clean up the fresh mic track if we created one
        if (screenStreamRef.current._freshMicTrack) {
          try {
            screenStreamRef.current._freshMicTrack.stop();
            console.log(`Stopped fresh mic track: ${screenStreamRef.current._freshMicTrack.label}`);
          } catch (err) {
            console.warn(`Error stopping fresh mic track: ${err.message}`);
          }
          delete screenStreamRef.current._freshMicTrack;
        }
        
        // Clean up cloned existing mic track if we created one
        if (screenStreamRef.current._micTrackClone) {
          try {
            screenStreamRef.current._micTrackClone.stop();
            console.log(`Stopped mic track clone: ${screenStreamRef.current._micTrackClone.label}`);
          } catch (err) {
            console.warn(`Error stopping mic track clone: ${err.message}`);
          }
          delete screenStreamRef.current._micTrackClone;
        }
        
        // Then stop all tracks in the screen stream
        screenStreamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
            console.log(`Stopped screen track: ${track.kind} (${track.label})`);
          } catch (err) {
            console.warn(`Error stopping screen track: ${err.message}`);
          }
        });
        
        // Check if microphone is muted and needs to stay muted
        let shouldMuteMic = false;
        if (streamRef && streamRef.current) {
          const micTracks = streamRef.current.getAudioTracks();
          if (micTracks.length > 0) {
            // Check if the original microphone was muted before screen sharing
            shouldMuteMic = !micTracks[0].enabled;
            console.log(`Original mic was ${shouldMuteMic ? 'muted' : 'unmuted'}`);
            
            // If it was muted, make sure it stays muted after screen sharing ends
            if (shouldMuteMic) {
              console.log('Keeping microphone muted after screen sharing');
              micTracks.forEach(track => {
                track.enabled = false;
              });
            }
          }
        }
        
        // Clear the reference to free memory
        screenStreamRef.current = null;
      }
      
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
  
  // Check if another user is sharing screen
  const someoneElseSharing = activeScreenSharingUser && socketRef.current && 
                            activeScreenSharingUser !== socketRef.current.id;
  
  // Determine the tooltip message based on current state
  const getTooltipTitle = () => {
    if (isScreenSharing) return "Stop Screen Sharing";
    if (!isSupported) return "Screen Sharing Not Supported in This Browser";
    if (someoneElseSharing) return "Someone else is already sharing their screen";
    return "Share Your Screen";
  };

  return (
    <>
      <Tooltip title={getTooltipTitle()}>
        <span className={someoneElseSharing && !isScreenSharing ? 'screen-sharing-disabled-icon' : ''}>
          <IconButton
            onClick={toggleScreenSharing}
            disabled={!isSupported || (!isScreenSharing && someoneElseSharing)}
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
          >
            Share Screen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ScreenShareButton;
