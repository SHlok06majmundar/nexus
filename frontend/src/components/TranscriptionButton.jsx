import React, { useState, useEffect, useRef } from 'react';
import { 
  IconButton, 
  Tooltip, 
  Box,
  Typography,
  Drawer,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Button,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VoiceOverOffIcon from '@mui/icons-material/VoiceOverOff';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import TranslateIcon from '@mui/icons-material/Translate';
import TranscriptionService from '../services/TranscriptionService';

/**
 * TranscriptionButton component for handling live speech-to-text transcription
 * 
 * @param {Object} props - Component props
 * @param {string} props.localUserId - The local user's ID
 * @param {string} props.localUserName - The local user's name
 * @param {boolean} props.micOn - Whether the microphone is enabled
 * @param {MediaStream} props.localStream - The local media stream
 * @param {Object} props.peerRefs - Reference to peer connections
 * @param {Function} props.onError - Error handler function
 */
function TranscriptionButton({ localUserId, localUserName, micOn, localStream, peerRefs, onError }) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [languageAnchorEl, setLanguageAnchorEl] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Use a ref for the transcription service
  const transcriptionServiceRef = useRef(new TranscriptionService());
  const transcriptsEndRef = useRef(null);
  
  // Check if speech recognition is supported
  const isSupported = transcriptionServiceRef.current.isSpeechRecognitionSupported();
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (transcriptionServiceRef.current.isActive()) {
        transcriptionServiceRef.current.stopTranscription();
      }
    };
  }, []);
  
  // Monitor microphone state and stop transcription if it's turned off
  useEffect(() => {
    // Update the service with the current stream whenever it changes
    if (localStream) {
      transcriptionServiceRef.current.updateMediaStream(localStream);
    }
    
    // If mic is turned off while transcribing, stop transcription
    if (isTranscribing && !micOn) {
      console.log('Microphone turned off, stopping transcription');
      transcriptionServiceRef.current.stopTranscription();
      setIsTranscribing(false);
      onError?.('Transcription stopped because microphone was turned off.');
    }
  }, [micOn, isTranscribing, localStream, onError]);
  
  // Monitor audio tracks in the local stream
  useEffect(() => {
    if (!localStream) return;
    
    const handleTrackEnabled = (event) => {
      // If mic was re-enabled while transcription is active, restart it
      if (isTranscribing && event.target.kind === 'audio' && event.target.enabled) {
        console.log('Audio track enabled, restarting transcription');
        transcriptionServiceRef.current.restartWithStream(localStream);
      }
    };
    
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.addEventListener('enabled', handleTrackEnabled);
    });
    
    return () => {
      audioTracks.forEach(track => {
        track.removeEventListener('enabled', handleTrackEnabled);
      });
    };
  }, [localStream, isTranscribing]);
  
  // Monitor changes in remote peers for transcription
  useEffect(() => {
    if (!isTranscribing || !peerRefs) return;
    
    // Update remote peers when they change while transcription is active
    const updateRemotePeers = () => {
      if (!peerRefs.current) return;
      
      const remotePeersData = peerRefs.current
        .map(peer => {
          // First check if peer has stream property directly
          let peerStream = peer.stream;
          
          // If not, try to get it from the RTCPeerConnection using our helper
          if (!peerStream && peer.peer) {
            peerStream = transcriptionServiceRef.current.getRemoteStreamFromPeer(peer.peer);
          }
          
          return {
            id: peer.id,
            username: peer.username || 'Remote User',
            stream: peerStream
          };
        })
        .filter(peer => peer.stream); // Only include peers with valid streams
      
      console.log(`Updating transcription with ${remotePeersData.length} remote peers`);
      
      // Update each remote peer in the service
      remotePeersData.forEach(peer => {
        transcriptionServiceRef.current.addRemoteAudioSource(
          peer.id, 
          peer.username, 
          peer.stream
        );
      });
    };
    
    // Set up a periodic check for peer changes
    const intervalId = setInterval(updateRemotePeers, 5000);
    
    // Initial update
    updateRemotePeers();
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isTranscribing, peerRefs]);
  
  // Auto scroll to the bottom when transcripts update
  useEffect(() => {
    if (transcriptsEndRef.current && isDrawerOpen) {
      transcriptsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, isDrawerOpen]);
  
  /**
   * Toggle transcription state
   */
  const toggleTranscription = () => {
    if (!isSupported) {
      onError?.('Speech recognition is not supported in your browser. Please try Chrome, Edge, or Safari.');
      return;
    }
    
    if (isTranscribing) {
      // Stop transcription
      transcriptionServiceRef.current.stopTranscription();
      setIsTranscribing(false);
    } else {
      // Check if microphone is enabled before starting transcription
      if (!micOn) {
        onError?.('Please turn on your microphone before starting transcription.');
        return;
      }
      
      // Verify we have access to the audio stream with a more detailed error
      if (!localStream) {
        onError?.('Unable to access microphone stream. Please reload the page or check browser permissions.');
        return;
      }
      
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        onError?.('No audio input detected. Please check if your microphone is properly connected.');
        return;
      }
      
      if (!audioTracks.some(track => track.enabled)) {
        onError?.('Your microphone is currently muted. Please unmute it to use transcription.');
        return;
      }
      
      // Prepare remote peers data if available
      let remotePeersData = [];
      if (peerRefs && peerRefs.current) {
        remotePeersData = peerRefs.current.map(peer => {
          // First check if peer has stream property directly
          let peerStream = peer.stream;
          
          // If not, try to get it from the RTCPeerConnection using our helper
          if (!peerStream && peer.peer) {
            peerStream = transcriptionServiceRef.current.getRemoteStreamFromPeer(peer.peer);
          }
          
          return {
            id: peer.id,
            username: peer.username || 'Remote User',
            stream: peerStream
          };
        }).filter(peer => peer.stream); // Only include peers with valid streams
      }
      
      console.log(`Found ${remotePeersData.length} remote peers with audio streams`);
      
      // Start transcription with the audio stream and remote peers
      const success = transcriptionServiceRef.current.startTranscription(
        localUserId,
        localUserName,
        (updatedTranscripts) => {
          setTranscripts([...updatedTranscripts]);
        },
        (errorMessage) => {
          onError?.(errorMessage);
        },
        localStream,
        remotePeersData
      );
      
      if (success) {
        setIsTranscribing(true);
        
        // Open the drawer to show transcripts
        setIsDrawerOpen(true);
      } else {
        onError?.('Failed to start transcription. Please check your microphone permissions.');
      }
    }
  };
  
  /**
   * Handle language menu open
   */
  const handleLanguageMenuOpen = (event) => {
    setLanguageAnchorEl(event.currentTarget);
    setIsLanguageMenuOpen(true);
  };
  
  /**
   * Handle language menu close
   */
  const handleLanguageMenuClose = () => {
    setLanguageAnchorEl(null);
    setIsLanguageMenuOpen(false);
  };
  
  /**
   * Handle language selection
   */
  const handleLanguageSelect = (languageCode) => {
    transcriptionServiceRef.current.setLanguage(languageCode);
    handleLanguageMenuClose();
  };
  
  /**
   * Clear all transcripts
   */
  const handleClearTranscripts = () => {
    transcriptionServiceRef.current.clearTranscripts();
    setTranscripts([]);
  };
  
  /**
   * Handle closing export menu
   */
  const handleExportMenuClose = () => {
    setExportAnchorEl(null);
    setIsExportMenuOpen(false);
  };
  
  /**
   * Export transcripts as file (txt, json, pdf)
   */
  const handleExportTranscripts = async (format = 'txt') => {
    try {
      setIsExporting(true);
      handleExportMenuClose();
      
      // Show loading indicator for PDF generation
      if (format === 'pdf') {
        onError?.('Generating PDF transcript...', 'info');
      }
      
      // Get blob from service
      const blobResult = transcriptionServiceRef.current.exportTranscripts(format);
      
      // Handle async (Promise) or sync (Blob) result
      const blob = blobResult instanceof Promise ? await blobResult : blobResult;
      
      if (blob) {
        const now = new Date();
        const dateString = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const extension = format;
        const filename = `nexus-transcription-${dateString}.${extension}`;
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        // Trigger download
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        if (format === 'pdf') {
          onError?.('PDF transcript generated successfully!', 'success');
        }
      }
    } catch (err) {
      console.error('Error exporting transcript:', err);
      onError?.(`Failed to export transcript: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Determine the tooltip message based on state
  const getTooltipMessage = () => {
    if (!isSupported) return "Transcription not supported in this browser";
    if (isTranscribing) return "Stop Transcription";
    if (!micOn) return "Microphone is off - Turn on microphone to enable transcription";
    
    // Check audio tracks in local stream
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        return "No audio input detected - Check microphone connection";
      }
      if (!audioTracks.some(track => track.enabled)) {
        return "Microphone is muted - Unmute to enable transcription";
      }
    }
    
    return "Start Transcription";
  };
  
  return (
    <>
      <Tooltip title={getTooltipMessage()}>
        <span>
          <IconButton
            onClick={toggleTranscription}
            disabled={!isSupported || (!isTranscribing && !micOn)}
            sx={{ 
              position: 'relative',
              bgcolor: isTranscribing ? 'rgba(103, 58, 183, 0.1)' : (!micOn ? 'rgba(244, 67, 54, 0.05)' : 'rgba(33, 150, 243, 0.1)'), 
              color: isTranscribing 
                ? 'var(--color-primary)' 
                : (!micOn ? 'rgba(244, 67, 54, 0.5)' : 'var(--color-secondary)'), 
              borderRadius: 'var(--button-radius)',
              p: { xs: 1, sm: 1.5 },
              '&:hover': {
                bgcolor: isTranscribing 
                  ? 'rgba(103, 58, 183, 0.2)' 
                  : (!micOn ? 'rgba(244, 67, 54, 0.1)' : 'rgba(33, 150, 243, 0.2)')
              },
              '&.Mui-disabled': {
                bgcolor: !micOn ? 'rgba(244, 67, 54, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: !micOn ? 'rgba(244, 67, 54, 0.4)' : 'rgba(0, 0, 0, 0.26)'
              },
              '&::after': !micOn ? {
                content: '""',
                position: 'absolute',
                width: '75%',
                height: '2px',
                background: 'rgba(244, 67, 54, 0.5)',
                transform: 'rotate(45deg)'
              } : {}
            }}
          >
            {isTranscribing ? <RecordVoiceOverIcon /> : <VoiceOverOffIcon />}
          </IconButton>
        </span>
      </Tooltip>
      
      {/* Transcription Drawer */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': { 
            width: { xs: '100%', sm: 400 },
            maxWidth: '100%',
            boxSizing: 'border-box',
            p: 0
          },
        }}
      >
        {/* Drawer Header */}
        <Box sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0,0,0,0.1)', 
          bgcolor: isTranscribing ? 'rgba(103, 58, 183, 0.05)' : 'white'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isTranscribing && (
              <CircularProgress size={20} sx={{ color: 'var(--color-primary)' }} />
            )}
            <Typography variant="h6" fontWeight={600}>
              Live Transcription
            </Typography>
            {isTranscribing && (
              <Chip 
                label="Active" 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Select language">
              <IconButton 
                size="small"
                onClick={handleLanguageMenuOpen}
                sx={{ color: 'var(--color-secondary)' }}
              >
                <TranslateIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear transcripts">
              <IconButton 
                size="small"
                onClick={handleClearTranscripts}
                disabled={transcripts.length === 0}
                sx={{ color: transcripts.length > 0 ? 'var(--color-error)' : undefined }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export transcripts">
              <IconButton 
                size="small"
                onClick={(e) => {
                  setExportAnchorEl(e.currentTarget);
                  setIsExportMenuOpen(true);
                }}
                disabled={transcripts.length === 0}
                sx={{ color: transcripts.length > 0 ? 'var(--color-success)' : undefined }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton 
                size="small"
                onClick={() => setIsDrawerOpen(false)}
                sx={{ ml: 1 }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Current Language Indicator */}
        <Box 
          sx={{
            px: 2,
            py: 1,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'rgba(103, 58, 183, 0.02)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TranslateIcon fontSize="small" sx={{ mr: 1, color: 'var(--color-secondary)', opacity: 0.7 }} />
            <Typography variant="body2" color="var(--text-secondary)">
              Current language: <strong>{
                transcriptionServiceRef.current.supportedLanguages.find(
                  lang => lang.code === transcriptionServiceRef.current.currentLanguage
                )?.name || 'English (US)'
              }</strong>
            </Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={handleLanguageMenuOpen}
            sx={{ 
              color: 'var(--color-secondary)',
              textTransform: 'none',
              fontWeight: 500,
              p: 0.5
            }}
          >
            Change
          </Button>
        </Box>
        
        {/* Transcripts List */}
        <Box sx={{ 
          flex: 1, 
          overflowY: 'auto', 
          height: 'calc(100% - 64px)',
          bgcolor: 'rgba(245, 247, 250, 0.5)'
        }}>
          {transcripts.length === 0 ? (
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              opacity: 0.7
            }}>
              <VoiceOverOffIcon sx={{ fontSize: 48, color: 'var(--text-muted)', mb: 2 }} />
              <Typography variant="body1" color="var(--text-muted)" textAlign="center" gutterBottom>
                No transcriptions yet
              </Typography>
              <Typography variant="body2" color="var(--text-muted)" textAlign="center">
                {isTranscribing 
                  ? "Start speaking to see real-time transcriptions"
                  : "Click the transcription button to start"
                }
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {transcripts.map((transcript, index) => (
                <React.Fragment key={transcript.id || index}>
                  {/* Show date divider if first item or if date changes from previous item */}
                  {(index === 0 || (
                    new Date(transcript.startTime).toLocaleDateString() !==
                    new Date(transcripts[index-1].startTime).toLocaleDateString()
                  )) && (
                    <Box sx={{ 
                      textAlign: 'center',
                      py: 1,
                      px: 2,
                      bgcolor: 'rgba(0, 0, 0, 0.03)'
                    }}>
                      <Typography variant="caption" color="var(--text-muted)">
                        {new Date(transcript.startTime).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Typography>
                    </Box>
                  )}
                
                  <ListItem 
                    alignItems="flex-start" 
                    sx={{ 
                      opacity: transcript.isFinal ? 1 : 0.7,
                      bgcolor: transcript.isFinal ? undefined : 'rgba(103, 58, 183, 0.04)',
                      py: 1,
                      borderBottom: '1px solid rgba(0,0,0,0.03)'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        sx={{ 
                          bgcolor: transcript.speakerId === localUserId 
                            ? 'var(--color-primary)' 
                            : 'var(--color-secondary)',
                          width: 35,
                          height: 35
                        }}
                      >
                        {transcript.speakerName.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="subtitle2" component="span">
                            {transcript.speakerName}
                          </Typography>
                          <Typography variant="caption" color="var(--text-muted)">
                            {new Date(transcript.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography 
                          variant="body2" 
                          color="var(--text-primary)"
                          sx={{ 
                            wordBreak: 'break-word',
                            lineHeight: 1.5,
                            fontWeight: transcript.isFinal ? 400 : 300
                          }}
                        >
                          {transcript.text}
                        </Typography>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
              {/* Empty div for auto scrolling to bottom */}
              <div ref={transcriptsEndRef} />
            </List>
          )}
        </Box>
        
        {/* Bottom controls */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          bgcolor: 'white'
        }}>
          <Button 
            variant="outlined"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleClearTranscripts}
            disabled={transcripts.length === 0}
            color="error"
            sx={{ borderRadius: 'var(--button-radius)' }}
          >
            Clear
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={(e) => {
                setExportAnchorEl(e.currentTarget);
                setIsExportMenuOpen(true);
              }}
              disabled={transcripts.length === 0}
              sx={{ 
                borderRadius: 'var(--button-radius)',
                bgcolor: 'var(--color-primary)',
                '&:hover': {
                  bgcolor: 'var(--color-secondary)'
                }
              }}
            >
              Export Transcript
            </Button>
          </Box>
        </Box>
      </Drawer>
      
      {/* Language selection menu */}
      <Menu
        anchorEl={languageAnchorEl}
        open={isLanguageMenuOpen}
        onClose={handleLanguageMenuClose}
        sx={{ maxHeight: 300 }}
      >
        <MenuItem disabled>
          <Typography variant="body2" color="var(--text-muted)">
            Select language
          </Typography>
        </MenuItem>
        <Divider />
        {transcriptionServiceRef.current.supportedLanguages.map(language => (
          <MenuItem 
            key={language.code} 
            onClick={() => handleLanguageSelect(language.code)}
            selected={transcriptionServiceRef.current.currentLanguage === language.code}
          >
            {language.name}
          </MenuItem>
        ))}
      </Menu>
      
      {/* Export format menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={isExportMenuOpen}
        onClose={handleExportMenuClose}
      >
        <MenuItem disabled>
          <Typography variant="body2" color="var(--text-muted)">
            Choose export format
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleExportTranscripts('txt')} disabled={isExporting}>
          <ListItemText 
            primary="Plain Text (.txt)" 
            secondary="Simple text format" 
          />
        </MenuItem>
        <MenuItem onClick={() => handleExportTranscripts('json')} disabled={isExporting}>
          <ListItemText 
            primary="JSON (.json)" 
            secondary="Machine-readable format" 
          />
        </MenuItem>
        <MenuItem onClick={() => handleExportTranscripts('pdf')} disabled={isExporting}>
          <ListItemText 
            primary="PDF Document (.pdf)" 
            secondary="Professional document format" 
          />
          {isExporting && <CircularProgress size={20} sx={{ ml: 1 }} />}
        </MenuItem>
      </Menu>
    </>
  );
}

export default TranscriptionButton;
