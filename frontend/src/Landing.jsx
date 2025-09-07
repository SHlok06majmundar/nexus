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
      <AppBar 
        position="sticky" 
        color="transparent" 
        elevation={0} 
        sx={{ 
          bgcolor: 'rgba(255,255,255,0.9)', 
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 1px 10px rgba(0,0,0,0.05)'
        }}
      >
        <Toolbar 
          sx={{ 
            justifyContent: 'space-between',
            minHeight: { xs: '56px', sm: '64px' },
            px: { xs: 2, sm: 3 }
          }}
        >
          {/* Logo with animation */}
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: { xs: 0.5, sm: 1 } 
            }}
          >
            <VideocamIcon 
              sx={{ 
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }, 
                color: 'primary.main',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                animation: 'float 3s ease-in-out infinite',
                '@keyframes float': {
                  '0%, 100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-5px)' }
                }
              }} 
            />
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 800, 
                fontFamily: 'var(--font-secondary)',
                fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
                background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 10px rgba(60,80,180,0.05)'
              }}
            >
              Nexus Meet
            </Typography>
          </Box>
          
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
                  <Avatar 
                    src={user.imageUrl} 
                    sx={{ 
                      width: { xs: 24, sm: 28 }, 
                      height: { xs: 24, sm: 28 },
                      border: '2px solid rgba(255,255,255,0.8)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }} 
                  /> : 
                  <AccountCircleIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.4rem' } }} />
                }
                endIcon={
                  <ArrowForwardIcon 
                    sx={{ 
                      fontSize: { xs: '1rem', sm: '1.2rem' },
                      transform: open ? 'rotate(90deg)' : 'none', 
                      transition: 'transform 0.3s' 
                    }} 
                  />
                }
                sx={{ 
                  borderRadius: { xs: '24px', sm: '28px' }, 
                  textTransform: 'none',
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 0.5, sm: 0.75 },
                  color: 'primary.main',
                  bgcolor: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(106,17,203,0.08)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {!isSmall && (
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
                      fontWeight: 600
                    }}
                  >
                    {user?.firstName || user?.username || 'Profile'}
                  </Typography>
                )}
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                  }
                }}
                TransitionProps={{
                  style: { borderRadius: 8 },
                }}
              >
                <Box 
                  sx={{ 
                    px: 2, 
                    py: 1.5, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    bgcolor: 'rgba(240,242,245,0.4)',
                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                  }}
                >
                  <Avatar 
                    src={user?.imageUrl} 
                    sx={{ 
                      width: { xs: 32, sm: 36 }, 
                      height: { xs: 32, sm: 36 },
                      border: '2px solid white',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {user?.firstName?.[0] || user?.username?.[0] || 'N'}
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="subtitle2" 
                      fontWeight={600}
                      sx={{ 
                        color: 'text.primary',
                        fontSize: { xs: '0.85rem', sm: '0.9rem' } 
                      }}
                    >
                      {user?.fullName || user?.username}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        display: 'block',
                        lineHeight: 1.2
                      }}
                    >
                      {user?.emailAddresses?.[0]?.emailAddress || ''}
                    </Typography>
                  </Box>
                </Box>
                <MenuItem 
                  onClick={() => { handleClose(); navigate('/dashboard'); }}
                  sx={{ 
                    py: 1.5,
                    fontSize: { xs: '0.85rem', sm: '0.9rem' },
                    '&:hover': {
                      bgcolor: 'rgba(106,17,203,0.05)',
                    }
                  }}
                >
                  Dashboard
                </MenuItem>
                <MenuItem 
                  onClick={handleLogout} 
                  sx={{ 
                    color: 'error.main',
                    py: 1.5,
                    fontSize: { xs: '0.85rem', sm: '0.9rem' },
                    '&:hover': {
                      bgcolor: 'rgba(211,47,47,0.05)',
                    }
                  }}
                >
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
                startIcon={<AccountCircleIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.4rem' } }} />}
                sx={{ 
                  borderRadius: { xs: '24px', sm: '28px' }, 
                  textTransform: 'none',
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 0.5, sm: 0.75 },
                  color: 'primary.main',
                  bgcolor: 'rgba(255,255,255,0.9)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  '&:hover': {
                    bgcolor: 'rgba(106,17,203,0.08)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {!isSmall && (
                  <Typography 
                    sx={{ 
                      fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem' },
                      fontWeight: 600
                    }}
                  >
                    Sign In
                  </Typography>
                )}
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
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.05)',
                    overflow: 'hidden'
                  }
                }}
              >
                <MenuItem 
                  onClick={handleLogin}
                  sx={{ 
                    py: 1.5,
                    fontSize: { xs: '0.85rem', sm: '0.9rem' },
                    '&:hover': {
                      bgcolor: 'rgba(106,17,203,0.05)',
                    }
                  }}
                >
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
        p: { xs: 2, sm: 3, md: 4, lg: 6 },
        pt: { xs: 3, sm: 4, md: 5, lg: 6 },
        pb: { xs: 4, sm: 5, md: 6, lg: 8 },
        gap: { xs: 4, sm: 5, md: 6, lg: 8 },
        maxWidth: '100vw',
        overflow: 'hidden',
      }}>
      {/* Left: Hero & Features */}
      <Box sx={{
        flex: 1,
        maxWidth: { xs: '100%', md: 600 },
        textAlign: { xs: 'center', md: 'left' },
        mb: { xs: 6, md: 0 },
        px: { xs: 1, sm: 2, md: 0 },
      }}>
        <Typography
          variant={isSmall ? 'h3' : isMobile ? 'h2' : 'h1'}
          sx={{
            fontWeight: 800,
            mb: { xs: 2, sm: 3 },
            fontFamily: 'var(--font-secondary)',
            lineHeight: 1.1,
            background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 16px rgba(60,80,180,0.08)',
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem', lg: '4rem' }
          }}
        >
          Nexus Meet<br />Connect in Real-Time
        </Typography>
        <Typography
          variant={isSmall ? 'body1' : 'h5'}
          sx={{
            color: 'text.secondary',
            mb: { xs: 3, sm: 4 },
            fontWeight: 400,
            maxWidth: { xs: '100%', md: '80%' },
            mx: { xs: 'auto', md: 0 },
            fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
            lineHeight: 1.5,
          }}
        >
          Seamless video meetings and real-time chat. Modern, intuitive, and secure—built for every device.
        </Typography>
        {/* Features */}
        <Box 
          sx={{ 
            mb: 6,
            display: 'grid',
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)',
              md: 'repeat(2, 1fr)' 
            },
            gap: { xs: 3, sm: 4 },
            width: '100%'
          }}
        >
          {[
            { 
              icon: <VideocamIcon fontSize="large" />, 
              title: 'HD Video', 
              desc: 'Crystal clear meetings',
              gradient: 'linear-gradient(135deg, rgba(106,17,203,0.08) 0%, rgba(106,17,203,0.12) 100%)'
            },
            { 
              icon: <ChatIcon fontSize="large" />, 
              title: 'Live Chat', 
              desc: 'Real-time messaging',
              gradient: 'linear-gradient(135deg, rgba(37,117,252,0.08) 0%, rgba(37,117,252,0.12) 100%)'
            },
            { 
              icon: <SecurityIcon fontSize="large" />, 
              title: 'Secure', 
              desc: 'Private & protected',
              gradient: 'linear-gradient(135deg, rgba(106,17,203,0.08) 0%, rgba(37,117,252,0.12) 100%)'
            },
            { 
              icon: <DevicesIcon fontSize="large" />, 
              title: 'Cross-device', 
              desc: 'Works everywhere',
              gradient: 'linear-gradient(135deg, rgba(37,117,252,0.08) 0%, rgba(106,17,203,0.12) 100%)'
            },
          ].map((f, i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 2, sm: 3 },
                border: '1px solid rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(6px)',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                position: 'relative',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 25px rgba(60,80,180,0.12)',
                  '& .feature-icon-bg': {
                    transform: 'scale(1.15)',
                  },
                  '& .feature-title': {
                    color: '#6a11cb',
                  }
                }
              }}
            >
              {/* Background gradient element */}
              <Box 
                className="feature-bg-gradient" 
                sx={{ 
                  position: 'absolute', 
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.5,
                  background: f.gradient,
                  zIndex: 0 
                }} 
              />
              
              {/* Icon wrapper */}
              <Box 
                className="feature-icon-bg"
                sx={{ 
                  p: { xs: 1.5, sm: 2 }, 
                  borderRadius: 2, 
                  bgcolor: 'white',
                  color: 'primary.main',
                  boxShadow: '0 4px 12px rgba(106,17,203,0.12)',
                  zIndex: 1,
                  transition: 'all 0.4s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {f.icon}
              </Box>
              
              {/* Text content */}
              <Box sx={{ zIndex: 1 }}>
                <Typography 
                  className="feature-title"
                  variant="subtitle1" 
                  fontWeight={700} 
                  color="primary.main"
                  sx={{ 
                    mb: 0.5,
                    transition: 'all 0.3s ease',
                    fontSize: { xs: '1rem', sm: '1.1rem' }
                  }}
                >
                  {f.title}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.85rem', sm: '0.9rem' } }}
                >
                  {f.desc}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          sx={{
            py: { xs: 1.5, sm: 2 },
            px: { xs: 3, sm: 4 },
            fontWeight: 700,
            fontSize: { xs: '1rem', sm: '1.1rem' },
            borderRadius: 3,
            background: 'linear-gradient(90deg,#6a11cb,#2575fc)',
            boxShadow: '0 4px 24px rgba(60,80,180,0.12)',
            mb: { xs: 2, sm: 3 },
            transition: 'all 0.3s',
            width: { xs: '100%', sm: 'auto' },
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 32px rgba(60,80,180,0.18)',
            },
            '&:active': {
              transform: 'translateY(1px)',
              boxShadow: '0 2px 8px rgba(60,80,180,0.15)',
            },
            animation: 'pulse 2s infinite ease-in-out',
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 4px 24px rgba(106,17,203,0.15)',
              },
              '50%': {
                boxShadow: '0 4px 24px rgba(37,117,252,0.25)',
              },
              '100%': {
                boxShadow: '0 4px 24px rgba(106,17,203,0.15)',
              },
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
        maxWidth: { xs: '100%', sm: '450px', md: '480px' },
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
              borderRadius: { xs: 3, sm: 4 }, 
              p: { xs: 2, sm: 3, md: 4 }, 
              bgcolor: 'background.paper',
              boxShadow: '0 10px 40px rgba(60,80,180,0.15), 0 1px 3px rgba(60,80,180,0.1)',
              border: '1px solid rgba(255,255,255,0.8)',
              backdropFilter: 'blur(8px)',
              position: 'relative',
              overflow: 'hidden',
              transform: { xs: 'scale(1)', md: 'scale(1)' },
              transition: 'transform 0.3s ease',
              '&:hover': {
                transform: { xs: 'scale(1)', md: 'scale(1.01)' },
              }
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
            
            <CardContent sx={{ position: 'relative', zIndex: 1, p: { xs: 2, sm: 3 } }}>
            <SignedOut>
              <Typography 
                variant="h3" 
                fontWeight={800} 
                sx={{ 
                  mb: { xs: 0.5, sm: 1 },
                  fontSize: { xs: '1.75rem', sm: '2rem', md: '2.5rem' },
                  background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textAlign: { xs: 'center', sm: 'left' },
                  lineHeight: 1.2
                }}
              >
                Sign In
              </Typography>
              <Typography 
                variant="body1" 
                color="text.secondary" 
                sx={{ 
                  mb: { xs: 3, sm: 4 },
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  textAlign: { xs: 'center', sm: 'left' },
                  maxWidth: { xs: '100%', sm: '90%' }
                }}
              >
                Sign in or sign up to start your meeting journey.
              </Typography>
                
              <Paper 
                elevation={0} 
                sx={{ 
                  p: { xs: 2, sm: 3 }, 
                  borderRadius: { xs: 2, sm: 3 }, 
                  bgcolor: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  mb: { xs: 2, sm: 3 },
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  '& .cl-rootBox': {
                    width: '100%',
                    maxWidth: '100%'
                  },
                  '& .cl-card': {
                    borderRadius: { xs: '8px', sm: '12px' },
                    boxShadow: 'none'
                  },
                  '& .cl-formButtonPrimary': {
                    background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  },
                  '& .cl-formFieldInput': {
                    borderRadius: '8px'
                  },
                  '& .cl-identityPreviewText': {
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  },
                  '& .cl-footerActionLink': {
                    color: '#6a11cb'
                  },
                  '& .cl-socialButtonsIconButton': {
                    borderRadius: '8px'
                  }
                }}
              >
                <SignIn className="auth-card" />
              </Paper>
                
              <Typography 
                variant="caption" 
                color="text.secondary" 
                textAlign="center" 
                sx={{ 
                  display: 'block',
                  fontSize: { xs: '0.7rem', sm: '0.75rem' },
                  opacity: 0.8,
                  mt: { xs: 2, sm: 3 }
                }}
              >
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </Typography>
            </SignedOut>
            <SignedIn>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: 'fit-content',
                    mx: 'auto',
                    mb: { xs: 2, sm: 3 },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -4,
                      left: -4,
                      right: -4,
                      bottom: -4,
                      background: 'linear-gradient(135deg, #6a11cb, #2575fc)',
                      borderRadius: '50%',
                      opacity: 0.2,
                      animation: 'pulse 2s infinite ease-in-out',
                      '@keyframes pulse': {
                        '0%, 100%': { transform: 'scale(0.95)' },
                        '50%': { transform: 'scale(1.05)' },
                      },
                    }
                  }}
                >
                  <Avatar 
                    src={user?.imageUrl} 
                    sx={{ 
                      width: { xs: 70, sm: 80 }, 
                      height: { xs: 70, sm: 80 }, 
                      mx: 'auto',
                      bgcolor: 'primary.main', 
                      color: 'white', 
                      fontWeight: 700,
                      boxShadow: '0 4px 20px rgba(60,80,180,0.2)',
                      border: '4px solid white'
                    }}
                  >
                    {user?.firstName?.[0] || user?.username?.[0] || 'N'}
                  </Avatar>
                </Box>
                <Typography 
                  variant="h4" 
                  fontWeight={700} 
                  sx={{ 
                    mb: 0.5,
                    fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                    background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    lineHeight: 1.2
                  }}
                >
                  Welcome Back!
                </Typography>
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  sx={{ 
                    mb: { xs: 3, sm: 4 },
                    fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
                  }}
                >
                  {user?.fullName || user?.username}
                </Typography>
              </Box>
                
              <Button
                variant="contained"
                fullWidth
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{ 
                  py: { xs: 1.5, sm: 2 }, 
                  fontWeight: 'bold', 
                  fontSize: { xs: '1rem', sm: '1.1rem' }, 
                  borderRadius: { xs: 2, sm: 3 }, 
                  background: 'linear-gradient(90deg,#6a11cb,#2575fc)', 
                  boxShadow: '0 4px 24px rgba(60,80,180,0.12)', 
                  mb: { xs: 2, sm: 3 },
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 32px rgba(60,80,180,0.18)',
                  },
                  '&:active': {
                    transform: 'translateY(1px)',
                    boxShadow: '0 2px 8px rgba(60,80,180,0.15)',
                  },
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
                  py: { xs: 1.25, sm: 1.5 }, 
                  borderRadius: { xs: 2, sm: 3 }, 
                  borderWidth: 2,
                  borderColor: 'rgba(106,17,203,0.3)',
                  color: 'primary.main',
                  fontWeight: 600,
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  '&:hover': {
                    borderWidth: 2,
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
          py: { xs: 2, sm: 3, md: 4 },
          px: { xs: 2, sm: 3, md: 4 },
          mt: 'auto',
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
        }}
      >
        <Container maxWidth="lg">
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={{ xs: 2, sm: 3 }} 
            alignItems="center" 
            justifyContent="space-between"
          >
            <Box sx={{ width: { xs: '100%', sm: '50%' }, textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography 
                variant="h6" 
                component="div" 
                sx={{ 
                  fontWeight: 800, 
                  fontFamily: 'var(--font-secondary)',
                  fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.5rem' },
                  mb: 0.5,
                  background: 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Nexus Meet
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.875rem' } }}
              >
                © 2025 Shlok Majmundar. All rights reserved.
              </Typography>
            </Box>
            
            <Box sx={{ 
              width: { xs: '100%', sm: '50%' },
              display: 'flex', 
              justifyContent: { xs: 'center', sm: 'flex-end' },
              gap: { xs: 1, sm: 1.5, md: 2 },
              alignItems: 'center',
              mt: { xs: 1, sm: 0 }
            }}>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mr: 1, 
                  display: { xs: 'none', sm: 'block' },
                  fontSize: { sm: '0.8rem', md: '0.875rem' }
                }}
              >
                Connect with me:
              </Typography>
              
              <IconButton 
                component="a" 
                href="https://github.com/SHlok06majmundar" 
                target="_blank"
                rel="noopener noreferrer"
                size={isSmall ? "small" : "medium"}
                sx={{ 
                  color: 'text.primary',
                  p: { xs: 1, sm: 1.5 },
                  '&:hover': { 
                    color: '#333',
                    bgcolor: 'rgba(0,0,0,0.05)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <GitHubIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
              </IconButton>
              
              <IconButton 
                component="a" 
                href="https://www.linkedin.com/in/shlok-majmundar-988851252/" 
                target="_blank"
                rel="noopener noreferrer"
                size={isSmall ? "small" : "medium"}
                sx={{ 
                  color: 'text.primary',
                  p: { xs: 1, sm: 1.5 },
                  '&:hover': { 
                    color: '#0077b5',
                    bgcolor: 'rgba(0,119,181,0.1)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <LinkedInIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
              </IconButton>
              
              <IconButton 
                component="a" 
                href="https://www.instagram.com/shlok.majmundar" 
                target="_blank"
                rel="noopener noreferrer"
                size={isSmall ? "small" : "medium"}
                sx={{ 
                  color: 'text.primary',
                  p: { xs: 1, sm: 1.5 },
                  '&:hover': { 
                    color: '#e4405f',
                    bgcolor: 'rgba(228,64,95,0.1)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <InstagramIcon sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />
              </IconButton>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
