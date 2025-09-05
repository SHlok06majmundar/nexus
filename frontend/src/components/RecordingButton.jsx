import React, { useState, useEffect, useRef } from 'react';
import { 
  IconButton, 
  Tooltip, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Button,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RecordingService from '../services/RecordingService';

/**
 * RecordingButton component for handling screen recording in meetings
 * 
 * @param {Object} props - Component props
 * @param {MediaStream} props.localStream - The local media stream to capture audio from
 * @param {Function} props.onError - Error handler function
 */
function RecordingButton({ localStream, onError }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  
  // Use a ref to persist the recording service instance
  const recordingServiceRef = useRef(new RecordingService());
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (recordingServiceRef.current.isActive()) {
        recordingServiceRef.current.stopRecording();
      }
    };
  }, []);
  
  /**
   * Toggle recording state
   */
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        // Stop recording
        setIsProcessing(true);
        const blob = await recordingServiceRef.current.stopRecording();
        setIsProcessing(false);
        
        if (blob) {
          setRecordedBlob(blob);
          setShowDownloadDialog(true);
        }
        
        setIsRecording(false);
        setElapsedTime('00:00');
      } else {
        // Start recording
        const started = await recordingServiceRef.current.startRecording(
          localStream,
          (time) => setElapsedTime(time)
        );
        
        if (started) {
          setIsRecording(true);
        } else {
          onError?.('Failed to start recording. Please check your permissions and try again.');
        }
      }
    } catch (err) {
      console.error('Recording error:', err);
      onError?.(`Recording error: ${err.message}`);
      setIsRecording(false);
      setIsProcessing(false);
    }
  };
  
  /**
   * Handle download action
   */
  const handleDownload = () => {
    if (recordedBlob) {
      const now = new Date();
      const dateString = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const filename = `nexus-meeting-${dateString}.webm`;
      
      recordingServiceRef.current.downloadRecording(recordedBlob, filename);
    }
    setShowDownloadDialog(false);
  };
  
  /**
   * Close the download dialog
   */
  const handleCloseDialog = () => {
    setShowDownloadDialog(false);
    setRecordedBlob(null);
  };
  
  return (
    <>
      <Tooltip title={isRecording ? "Stop Recording" : "Start Recording"}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <IconButton
            onClick={toggleRecording}
            disabled={isProcessing}
            sx={{ 
              bgcolor: isRecording ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)', 
              color: isRecording ? 'var(--color-error)' : 'var(--color-success)', 
              borderRadius: 'var(--button-radius)',
              p: { xs: 1, sm: 1.5 },
              '&:hover': {
                bgcolor: isRecording ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)'
              }
            }}
          >
            {isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
          </IconButton>
          
          {isRecording && (
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'var(--color-error)',
                color: 'white',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              {elapsedTime}
            </Box>
          )}
          
          {isProcessing && (
            <CircularProgress
              size={44}
              sx={{
                position: 'absolute',
                top: -2,
                left: -2,
                color: 'var(--color-secondary)',
                zIndex: 1
              }}
            />
          )}
        </Box>
      </Tooltip>
      
      {/* Download Dialog */}
      <Dialog
        open={showDownloadDialog}
        onClose={handleCloseDialog}
        aria-labelledby="download-dialog-title"
        aria-describedby="download-dialog-description"
      >
        <DialogTitle id="download-dialog-title">
          Recording Complete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="download-dialog-description">
            Your meeting recording is ready. Would you like to download it now?
          </DialogContentText>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mt: 2,
            p: 2,
            bgcolor: 'rgba(0,0,0,0.04)',
            borderRadius: 1
          }}>
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileDownloadIcon color="primary" />
              <span>Meeting recording ({Math.round(recordedBlob?.size / 1024 / 1024 * 10) / 10} MB)</span>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleDownload} 
            variant="contained" 
            color="primary" 
            startIcon={<FileDownloadIcon />}
            autoFocus
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default RecordingButton;
