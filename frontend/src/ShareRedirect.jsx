import React from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

// This component helps redirect direct link shares to the meeting
const ShareRedirect = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Small delay to show loading before redirect
    const timer = setTimeout(() => {
      navigate(`/meet/${meetingId}`);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [meetingId, navigate]);
  
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-primary)',
        textAlign: 'center',
        p: 3
      }}
    >
      <CircularProgress 
        size={60} 
        sx={{ 
          color: 'white',
          mb: 3
        }} 
      />
      <Typography 
        variant="h4" 
        sx={{ 
          color: 'white', 
          mb: 2,
          fontWeight: 'bold'
        }}
      >
        Joining Meeting...
      </Typography>
      <Typography 
        variant="body1" 
        sx={{ 
          color: 'rgba(255,255,255,0.8)', 
          mb: 4,
          maxWidth: '500px'
        }}
      >
        You're being redirected to meeting #{meetingId}
      </Typography>
      <Button
        variant="contained"
        color="inherit"
        onClick={() => navigate(`/meet/${meetingId}`)}
        sx={{
          color: 'var(--color-primary)',
          fontWeight: 'bold',
          px: 3,
          py: 1,
          borderRadius: '8px'
        }}
      >
        Join Now
      </Button>
    </Box>
  );
};

export default ShareRedirect;
