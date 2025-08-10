import React, { useState, useEffect } from 'react';
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { 
  useMediaQuery, Box, Paper, Typography, Button, 
  Grid, Card, CardContent, Avatar, IconButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Import icons
import VideocamIcon from '@mui/icons-material/Videocam';
import ChatIcon from '@mui/icons-material/Chat';
import SecurityIcon from '@mui/icons-material/Security';
import DevicesIcon from '@mui/icons-material/Devices';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function Landing() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user } = useUser();
  const [animateIn, setAnimateIn] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animations after a short delay
    const timer = setTimeout(() => {
      setAnimateIn(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        width: '100vw', 
        background: 'var(--gradient-primary)',
        display: 'flex', 
        flexDirection: { xs: 'column', lg: 'row' },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: '5%',
          left: '10%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(106, 17, 203, 0.2) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(40px)',
          opacity: animateIn ? 0.6 : 0,
          transition: 'opacity 1.5s ease',
          zIndex: 0,
        }} 
      />
      
      <Box 
        sx={{ 
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 117, 252, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(40px)',
          opacity: animateIn ? 0.6 : 0,
          transition: 'opacity 1.5s ease 0.3s',
          zIndex: 0,
        }} 
      />
      
      {/* Left side branding (shown on desktop) */}
      <Box 
        sx={{ 
          flex: { xs: 'none', lg: 1 },
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: 5,
          py: 10,
          position: 'relative',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s ease',
          zIndex: 1,
        }}
      >
        <Box sx={{ maxWidth: '600px', textAlign: 'left' }}>
          <Typography 
            variant="h1" 
            className="text-gradient"
            sx={{ 
              fontWeight: 800,
              mb: 3,
              fontFamily: 'var(--font-secondary)',
              fontSize: 'clamp(3rem, 5vw, 4.5rem)',
              lineHeight: 1.1,
            }}
          >
            Connect in Real-Time with Nexus Meet
          </Typography>
          
          <Typography 
            variant="h5" 
            sx={{ 
              color: 'var(--text-secondary)',
              mb: 5,
              maxWidth: '90%',
              fontWeight: 300
            }}
          >
            Experience seamless video meetings and real-time chat with our modern, 
            intuitive platform designed for simplicity and performance.
          </Typography>
          
          <Grid container spacing={4} sx={{ mb: 8 }}>
            {[
              {
                icon: <VideocamIcon fontSize="large" />,
                title: 'HD Video',
                description: 'Crystal clear video meetings'
              },
              {
                icon: <ChatIcon fontSize="large" />,
                title: 'Live Chat',
                description: 'Real-time messaging'
              },
              {
                icon: <SecurityIcon fontSize="large" />,
                title: 'Secure',
                description: 'Private and protected meetings'
              },
              {
                icon: <DevicesIcon fontSize="large" />,
                title: 'Cross-device',
                description: 'Works on all your devices'
              }
            ].map((feature, idx) => (
              <Grid item xs={6} key={idx}>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                }}>
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: '16px', 
                    bgcolor: 'rgba(106, 17, 203, 0.1)',
                    color: 'var(--color-secondary)'
                  }}>
                    {feature.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="600" color="var(--text-primary)" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="var(--text-muted)">
                      {feature.description}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ 
            p: 3, 
            borderRadius: 'var(--card-radius)', 
            border: '1px solid rgba(255,255,255,0.1)',
            bgcolor: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box>
              <Typography variant="subtitle1" color="var(--text-secondary)" fontWeight={600}>
                Ready to get started?
              </Typography>
              <Typography variant="body2" color="var(--text-muted)">
                Sign in or create an account to begin
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              color="primary"
              sx={{ 
                borderRadius: 'var(--button-radius)',
                py: 1.5,
                px: 3,
                fontWeight: 600,
                background: 'var(--gradient-accent)',
              }}
              onClick={() => {
                const signInEl = document.querySelector('.cl-sign-in-button');
                if (signInEl) signInEl.click();
              }}
            >
              Get Started
            </Button>
          </Box>
        </Box>
      </Box>
      
      {/* Right side - auth form */}
      <Box 
        sx={{ 
          flex: { xs: 1, lg: 0.8 },
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          py: { xs: 4, sm: 8 },
          px: { xs: 2, sm: 4 },
          minHeight: '100vh',
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s ease 0.2s',
          zIndex: 1,
        }}
      >
        <SignedOut>
          <Card 
            elevation={4}
            className="glassmorphism" 
            sx={{ 
              width: '100%',
              maxWidth: 520,
              mx: 'auto',
              p: { xs: 2, sm: 4 },
              pt: { xs: 6, sm: 6 },
              pb: { xs: 6, sm: 6 },
              borderRadius: 'var(--card-radius)',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(15, 15, 25, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: 'var(--shadow-strong)',
              overflow: 'visible',
              position: 'relative',
            }}
          >
            {/* Mobile logo */}
            <Box 
              sx={{ 
                display: { xs: 'block', lg: 'none' },
                textAlign: 'center',
                mb: 5,
                mt: { xs: 0, sm: 2 }
              }}
            >
              <Typography 
                variant={isSmall ? 'h3' : 'h2'}
                className="text-gradient"
                sx={{ 
                  fontWeight: 800,
                  mb: 2,
                  fontFamily: 'var(--font-secondary)',
                }}
              >
                Nexus Meet
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'var(--text-secondary)', maxWidth: '400px', mx: 'auto' }}>
                Experience seamless video meetings and real-time chat with our modern platform.
              </Typography>
            </Box>
            
            <CardContent sx={{ p: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, color: 'var(--text-primary)' }}>
                Sign in to your account
              </Typography>
              <SignIn path={import.meta.env.VITE_CLERK_SIGN_IN_URL} routing="path" signUpUrl={import.meta.env.VITE_CLERK_SIGN_UP_URL} />
            </CardContent>
          </Card>
        </SignedOut>
        
        <SignedIn>
          <Card
            elevation={4}
            className="glassmorphism"
            sx={{ 
              width: '100%',
              maxWidth: 520,
              mx: 'auto',
              p: { xs: 4, sm: 6 },
              borderRadius: 'var(--card-radius)',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(15, 15, 25, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: 'var(--shadow-strong)',
              overflow: 'visible',
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 5, gap: 3 }}>
                <Avatar 
                  src={user?.imageUrl}
                  sx={{ 
                    width: 72, 
                    height: 72,
                    bgcolor: 'var(--color-primary)',
                    boxShadow: 'var(--shadow-soft)',
                    fontSize: '2rem'
                  }}
                >
                  {user?.firstName?.[0] || user?.username?.[0] || 'N'}
                </Avatar>
                <Box>
                  <Typography 
                    variant="h4" 
                    fontWeight="bold" 
                    sx={{ mb: 0.5, color: 'var(--text-primary)' }}
                  >
                    Welcome Back!
                  </Typography>
                  <Typography variant="body1" color="var(--text-secondary)">
                    {user?.fullName || user?.username}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="h5" sx={{ mb: 3, color: 'var(--text-primary)', fontWeight: 600 }}>
                Ready to start meeting?
              </Typography>
              
              <Typography variant="body1" sx={{ mb: 4, color: 'var(--text-secondary)' }}>
                Go to your dashboard to start a new meeting or join an existing one with a meeting ID.
              </Typography>
              
              <Button 
                variant="contained" 
                fullWidth 
                size="large" 
                endIcon={<ArrowForwardIcon />}
                sx={{ 
                  py: 2, 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem', 
                  borderRadius: 'var(--button-radius)', 
                  background: 'var(--gradient-accent)',
                  boxShadow: 'var(--shadow-glow)',
                  '&:hover': {
                    boxShadow: 'var(--shadow-strong)'
                  },
                  animation: 'pulse 2s infinite',
                }}
                onClick={goToDashboard}
              >
                Go to Dashboard
              </Button>
              
              <Typography 
                variant="body2" 
                textAlign="center" 
                sx={{ 
                  color: 'var(--text-muted)', 
                  mt: 3,
                  opacity: 0.8
                }}
              >
                Access your meeting history and preferences in the dashboard
              </Typography>
            </CardContent>
          </Card>
        </SignedIn>
      </Box>
    </Box>
  );
}
