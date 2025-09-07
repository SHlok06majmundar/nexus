import React, { useState } from 'react';
import { SignedIn, SignedOut, SignIn, useUser, useClerk } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { 
  useMediaQuery, Box, Typography, Button, Grid, Card, CardContent, Avatar, 
  AppBar, Toolbar, Container, Menu, MenuItem, IconButton, Divider, Link,
  Stack, Paper, Tab, Tabs
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ChatIcon from '@mui/icons-material/Chat';
import SecurityIcon from '@mui/icons-material/Security';
import DevicesIcon from '@mui/icons-material/Devices';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import MenuIcon from '@mui/icons-material/Menu';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [tabValue, setTabValue] = useState(0);
  
  // Profile menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  
  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleClose();
    signOut();
  };
  
  const handleLogin = () => {
    handleClose();
    // You can navigate to a specific sign-in page if needed
    // or just close the menu as the sign-in is already on the page
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #e0e7ff 0%, #f5f7fa 100%)',
      overflow: 'hidden',
    }}>
      {/* Header with Profile Button */}
      <AppBar position="static" color="transparent" elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 800, 
              color: 'primary.main', 
              fontFamily: 'var(--font-secondary)',
              fontSize: { xs: '1.2rem', sm: '1.5rem' }
            }}
          >
            Nexus Meet
          </Typography>
          
          {/* Profile Button */}
          <Box>
            <SignedIn>
              <Button
                id="profile-button"
                aria-controls={open ? 'profile-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleProfileClick}
                startIcon={
                  user?.imageUrl ? 
                  <Avatar src={user.imageUrl} sx={{ width: 28, height: 28 }} /> : 
                  <AccountCircleIcon />
                }
                endIcon={<ArrowForwardIcon sx={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} />}
                sx={{ 
                  borderRadius: 'var(--button-radius)', 
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'rgba(106,17,203,0.08)',
                  }
                }}
              >
                {!isSmall && (user?.firstName || user?.username || 'Profile')}
              </Button>
              <Menu
                id="profile-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                  'aria-labelledby': 'profile-button',
                }}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  elevation: 3,
                  sx: { 
                    borderRadius: 2,
                    minWidth: 180,
                    mt: 0.5,
                    boxShadow: 'var(--shadow-soft)'
                  }
                }}
              >
                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={user?.imageUrl} sx={{ width: 32, height: 32 }}>
                    {user?.firstName?.[0] || user?.username?.[0] || 'N'}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {user?.fullName || user?.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {user?.emailAddresses?.[0]?.emailAddress || ''}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 1 }} />
                <MenuItem onClick={() => { handleClose(); navigate('/dashboard'); }}>
                  Dashboard
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </SignedIn>
            
            <SignedOut>
              <Button
                id="login-button"
                aria-controls={open ? 'login-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleProfileClick}
                startIcon={<AccountCircleIcon />}
                sx={{ 
                  borderRadius: 'var(--button-radius)', 
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'rgba(106,17,203,0.08)',
                  }
                }}
              >
                {!isSmall && 'Sign In'}
              </Button>
              <Menu
                id="login-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                  'aria-labelledby': 'login-button',
                }}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  elevation: 3,
                  sx: { 
                    borderRadius: 2,
                    minWidth: 180,
                    mt: 0.5,
                    boxShadow: 'var(--shadow-soft)'
                  }
                }}
              >
                <MenuItem onClick={handleLogin}>
                  <LoginIcon fontSize="small" sx={{ mr: 1 }} />
                  Sign In
                </MenuItem>
              </Menu>
            </SignedOut>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Main Content */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 6 },
        gap: { xs: 4, md: 8 },
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
            lineHeight: 1.1,
            background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
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
        {/* Features */}
        <Stack 
          direction="row" 
          flexWrap="wrap" 
          spacing={2} 
          justifyContent={{ xs: 'center', md: 'flex-start' }}
          sx={{ mb: 6 }}
        >
          {[
            { icon: <VideocamIcon fontSize="large" />, title: 'HD Video', desc: 'Crystal clear meetings' },
            { icon: <ChatIcon fontSize="large" />, title: 'Live Chat', desc: 'Real-time messaging' },
            { icon: <SecurityIcon fontSize="large" />, title: 'Secure', desc: 'Private & protected' },
            { icon: <DevicesIcon fontSize="large" />, title: 'Cross-device', desc: 'Works everywhere' },
          ].map((f, i) => (
            <Box key={i} sx={{ width: { xs: '100%', sm: 'calc(50% - 16px)' }, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(106,17,203,0.08)', 
                  color: 'primary.main',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'rgba(106,17,203,0.15)',
                    transform: 'translateY(-2px)'
                  }
                }}>
                  {f.icon}
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
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
            transition: 'all 0.3s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 32px rgba(60,80,180,0.18)',
            }
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
        <Card 
            elevation={0} 
            sx={{ 
              width: '100%', 
              borderRadius: 4, 
              p: { xs: 2, sm: 4 }, 
              bgcolor: 'background.paper',
              boxShadow: '0 10px 40px rgba(60,80,180,0.15), 0 1px 3px rgba(60,80,180,0.1)',
              border: '1px solid rgba(255,255,255,0.8)',
              backdropFilter: 'blur(8px)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative elements */}
            <Box 
              sx={{ 
                position: 'absolute', 
                width: '300px', 
                height: '300px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, rgba(106,17,203,0.05) 0%, rgba(37,117,252,0.05) 100%)', 
                top: '-150px', 
                right: '-150px', 
                zIndex: 0 
              }} 
            />
            <Box 
              sx={{ 
                position: 'absolute', 
                width: '200px', 
                height: '200px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, rgba(106,17,203,0.05) 0%, rgba(37,117,252,0.05) 100%)', 
                bottom: '-100px', 
                left: '-100px', 
                zIndex: 0 
              }} 
            />
            
            <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <SignedOut>
              <Typography 
                variant={isSmall ? 'h4' : 'h3'} 
                fontWeight={800} 
                sx={{ 
                  mb: 1,
                  background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Sign In
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Sign in or sign up to start your meeting journey.
              </Typography>
                
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 3, 
                  borderRadius: 3, 
                  bgcolor: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  mb: 3
                }}
              >
                <SignIn className="auth-card" />
              </Paper>
                
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ display: 'block' }}>
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </Typography>
            </SignedOut>
            <SignedIn>
              <Box sx={{ textAlign: 'center' }}>
                <Avatar 
                  src={user?.imageUrl} 
                  sx={{ 
                    width: 80, 
                    height: 80, 
                    mx: 'auto', 
                    mb: 2,
                    bgcolor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(60,80,180,0.15)'
                  }}
                >
                  {user?.firstName?.[0] || user?.username?.[0] || 'N'}
                </Avatar>
                <Typography variant="h4" fontWeight={700} sx={{ 
                  mb: 1,
                  background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Welcome Back!
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                  {user?.fullName || user?.username}
                </Typography>
              </Box>
                
              <Button
                variant="contained"
                fullWidth
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{ 
                  py: 2, 
                  fontWeight: 'bold', 
                  fontSize: '1.1rem', 
                  borderRadius: 3, 
                  background: 'linear-gradient(90deg,#6a11cb,#2575fc)', 
                  boxShadow: '0 4px 24px rgba(60,80,180,0.12)', 
                  mb: 3,
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(60,80,180,0.18)',
                  }
                }}
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
                
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ 
                  py: 1.5, 
                  borderRadius: 3, 
                  borderColor: 'rgba(106,17,203,0.3)',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(106,17,203,0.05)',
                  }
                }}
              >
                Sign Out
              </Button>
            </SignedIn>
          </CardContent>
        </Card>
      </Box>
      </Box>
      
      {/* Footer with social links */}
      <Box 
        component="footer"
        sx={{
          width: '100%',
          py: { xs: 3, sm: 4 },
          px: { xs: 2, sm: 4 },
          mt: 'auto',
          bgcolor: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
        }}
      >
        <Container maxWidth="lg">
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={3} 
            alignItems="center" 
            justifyContent="space-between"
          >
            <Box sx={{ width: { xs: '100%', sm: '50%' }, textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 800, 
                  color: 'primary.main', 
                  fontFamily: 'var(--font-secondary)',
                  fontSize: { xs: '1.2rem', sm: '1.5rem' },
                  mb: 1
                }}
              >
                Nexus Meet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                © 2025 Shlok Majmundar. All rights reserved.
              </Typography>
            </Box>
            
            <Box sx={{ 
              width: { xs: '100%', sm: '50%' },
              display: 'flex', 
              justifyContent: { xs: 'center', sm: 'flex-end' },
              gap: { xs: 1, sm: 2 },
              alignItems: 'center'
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
                Connect with me:
              </Typography>
              
              <IconButton 
                component="a" 
                href="https://github.com/SHlok06majmundar" 
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.primary',
                  '&:hover': { 
                    color: '#333',
                    bgcolor: 'rgba(0,0,0,0.05)'
                  }
                }}
              >
                <GitHubIcon />
              </IconButton>
              
              <IconButton 
                component="a" 
                href="https://www.linkedin.com/in/shlok-majmundar-988851252/" 
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.primary',
                  '&:hover': { 
                    color: '#0077b5',
                    bgcolor: 'rgba(0,119,181,0.1)'
                  }
                }}
              >
                <LinkedInIcon />
              </IconButton>
              
              <IconButton 
                component="a" 
                href="https://www.instagram.com/shlok.majmundar" 
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'text.primary',
                  '&:hover': { 
                    color: '#e4405f',
                    bgcolor: 'rgba(228,64,95,0.1)'
                  }
                }}
              >
                <InstagramIcon />
              </IconButton>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
