
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery, Box, Avatar, Typography, Paper, Grid, Button, Container } from '@mui/material';
import ErrorBoundary from './components/ErrorBoundary';
// Use theme variables
const bgGradient = 'var(--gradient-primary)';

const cardStyle = {
  width: '100%',
  maxWidth: 480,
  mx: 'auto',
  p: { xs: 2, sm: 4 },
  borderRadius: 'var(--card-radius)',
  boxShadow: 'var(--shadow-soft)',
  bgcolor: '#ffffff',
};

function Dashboard() {
  const { user } = useUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgGradient }}>
      <Paper elevation={2} sx={cardStyle}>
        <Box textAlign="center" mb={3}>
          <Avatar 
            src={user?.imageUrl} 
            sx={{ 
              width: 80, 
              height: 80, 
              mx: 'auto', 
              mb: 3, 
              background: 'var(--gradient-accent)', 
              color: 'white', 
              fontSize: 32,
              boxShadow: 'var(--shadow-soft)'
            }}
          >
            {user?.firstName?.[0] || user?.username?.[0] || 'U'}
          </Avatar>
          <Typography 
            variant={isMobile ? 'h4' : 'h3'} 
            fontWeight="bold" 
            color="var(--color-primary)" 
            sx={{ mb: 1 }}
            className="text-gradient"
          >
            Welcome to Nexus Meet
          </Typography>
          <Typography variant="subtitle1" color="var(--text-secondary)">
            Hello, {user?.fullName || user?.username}!
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid lg={6} md={6} sm={6} xs={12}>
            <Button 
              variant="contained" 
              fullWidth 
              size="large" 
              sx={{ 
                py: 2, 
                fontWeight: 'bold', 
                fontSize: isMobile ? '1rem' : '1.1rem', 
                borderRadius: 'var(--button-radius)',
                background: 'var(--gradient-accent)',
                color: 'white',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              Start New Meeting
            </Button>
          </Grid>
          <Grid lg={6} md={6} sm={6} xs={12}>
            <Button 
              variant="outlined" 
              fullWidth 
              size="large" 
              sx={{ 
                py: 2, 
                fontWeight: 'bold', 
                fontSize: isMobile ? '1rem' : '1.1rem', 
                borderRadius: 'var(--button-radius)',
                borderColor: 'var(--color-primary)',
                color: 'var(--color-primary)',
                '&:hover': {
                  borderColor: 'var(--color-secondary)',
                  backgroundColor: 'rgba(106, 17, 203, 0.05)'
                }
              }}
            >
              Join Meeting
            </Button>
          </Grid>
        </Grid>
        <Box mt={4} textAlign="center">
          <Typography variant="body2" color="var(--text-secondary)">
            Nexus Meet is a modern, real-time meeting platform.<br />More features coming soon!
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <ErrorBoundary>
      <Box sx={{ minHeight: '100vh', width: '100vw', background: bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
          <SignedOut>
            <Paper elevation={2} sx={cardStyle}>
              <Box textAlign="center" mb={4}>
                <Typography 
                  variant={isMobile ? 'h3' : 'h2'} 
                  fontWeight="800" 
                  className="text-gradient"
                  sx={{ mb: 2 }}
                >
                  Nexus Meet
                </Typography>
                <Typography 
                  variant="subtitle1" 
                  color="var(--text-secondary)" 
                  sx={{ maxWidth: '80%', mx: 'auto' }}
                >
                  Sign in or sign up to join the next generation of video meetings
                </Typography>
              </Box>
              <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
            </Paper>
          </SignedOut>
          <SignedIn>
            <Dashboard />
          </SignedIn>
        </Container>
      </Box>
    </ErrorBoundary>
  );
}

export default App;
