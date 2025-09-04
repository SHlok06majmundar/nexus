import React from 'react';
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery, Box, Typography, Button, Grid, Card, CardContent, Avatar } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ChatIcon from '@mui/icons-material/Chat';
import SecurityIcon from '@mui/icons-material/Security';
import DevicesIcon from '@mui/icons-material/Devices';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user } = useUser();

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100vw',
      bgcolor: 'linear-gradient(135deg, #e0e7ff 0%, #f5f7fa 100%)',
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 2, md: 6 },
      gap: { xs: 4, md: 8 },
      overflow: 'hidden',
    }}>
      {/* Left: Hero & Features */}
      <Box sx={{
        flex: 1,
        maxWidth: { xs: '100%', md: 600 },
        textAlign: { xs: 'center', md: 'left' },
        mb: { xs: 6, md: 0 },
      }}>
        <Typography
          variant={isSmall ? 'h3' : isMobile ? 'h2' : 'h1'}
          sx={{
            fontWeight: 800,
            mb: 3,
            fontFamily: 'var(--font-secondary)',
            color: 'primary.main',
            lineHeight: 1.1,
            textShadow: '0 2px 16px rgba(60,80,180,0.08)',
          }}
        >
          Nexus Meet<br />Connect in Real-Time
        </Typography>
        <Typography
          variant={isSmall ? 'body1' : 'h5'}
          sx={{
            color: 'text.secondary',
            mb: 4,
            fontWeight: 400,
            maxWidth: { xs: '100%', md: '80%' },
            mx: { xs: 'auto', md: 0 },
          }}
        >
          Seamless video meetings and real-time chat. Modern, intuitive, and secure—built for every device.
        </Typography>
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {[
            { icon: <VideocamIcon fontSize="large" />, title: 'HD Video', desc: 'Crystal clear meetings' },
            { icon: <ChatIcon fontSize="large" />, title: 'Live Chat', desc: 'Real-time messaging' },
            { icon: <SecurityIcon fontSize="large" />, title: 'Secure', desc: 'Private & protected' },
            { icon: <DevicesIcon fontSize="large" />, title: 'Cross-device', desc: 'Works everywhere' },
          ].map((f, i) => (
            <Grid item xs={6} key={i}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(106,17,203,0.08)', color: 'primary.main' }}>{f.icon}</Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          sx={{
            py: 2,
            px: 4,
            fontWeight: 700,
            fontSize: '1.1rem',
            borderRadius: 3,
            background: 'linear-gradient(90deg,#6a11cb,#2575fc)',
            boxShadow: '0 4px 24px rgba(60,80,180,0.12)',
            mb: 2,
          }}
          onClick={() => navigate('/dashboard')}
        >
          Get Started
        </Button>
      </Box>
      {/* Right: Auth Card */}
      <Box sx={{
        flex: 1,
        maxWidth: 480,
        mx: 'auto',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Card elevation={8} sx={{ width: '100%', borderRadius: 4, boxShadow: '0 8px 32px rgba(60,80,180,0.12)', p: { xs: 2, sm: 4 }, bgcolor: 'background.paper' }}>
          <CardContent>
            <SignedOut>
              <Typography variant={isSmall ? 'h4' : 'h3'} fontWeight={800} color="primary" sx={{ mb: 2 }}>Sign In</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>Sign in or sign up to start your meeting journey.</Typography>
              <SignIn path={import.meta.env.VITE_CLERK_SIGN_IN_URL} routing="path" signUpUrl={import.meta.env.VITE_CLERK_SIGN_UP_URL} />
            </SignedOut>
            <SignedIn>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar src={user?.imageUrl} sx={{ width: 56, height: 56, bgcolor: 'primary.main', color: 'white', fontWeight: 700 }}>{user?.firstName?.[0] || user?.username?.[0] || 'N'}</Avatar>
                <Box>
                  <Typography variant="h5" fontWeight={700} color="primary.main">Welcome Back!</Typography>
                  <Typography variant="body2" color="text.secondary">{user?.fullName || user?.username}</Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                fullWidth
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', borderRadius: 3, background: 'linear-gradient(90deg,#6a11cb,#2575fc)', boxShadow: '0 4px 24px rgba(60,80,180,0.12)', mb: 2 }}
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 2 }}>Access your meetings and preferences in the dashboard.</Typography>
            </SignedIn>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
