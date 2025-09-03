
import { SignedIn, SignedOut, SignIn, useUser } from '@clerk/clerk-react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery, Box, Avatar, Typography, Paper, Grid, Button } from '@mui/material';
// Custom background gradient
const bgGradient = 'linear-gradient(135deg, #e0e7ff 0%, #f5f7fa 100%)';

const cardStyle = {
  width: '100%',
  maxWidth: 480,
  mx: 'auto',
  p: { xs: 2, sm: 4 },
  borderRadius: 5,
  boxShadow: '0 8px 32px rgba(60, 80, 180, 0.12)',
  backdropFilter: 'blur(2px)',
  bgcolor: 'background.paper',
};

function Dashboard() {
  const { user } = useUser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: bgGradient }}>
      <Paper elevation={8} sx={cardStyle}>
        <Box textAlign="center" mb={3}>
          <Avatar src={user?.imageUrl} sx={{ width: 72, height: 72, mx: 'auto', mb: 2, bgcolor: '#2563eb', color: 'white', fontSize: 32 }}>
            {user?.firstName?.[0] || user?.username?.[0] || 'U'}
          </Avatar>
          <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight="bold" color="primary" sx={{ mb: 1 }}>Welcome to Nexus Meet</Typography>
          <Typography variant="subtitle1" color="text.secondary">Hello, {user?.fullName || user?.username}!</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Button variant="contained" color="primary" fullWidth size="large" sx={{ py: 2, fontWeight: 'bold', fontSize: isMobile ? '1rem' : '1.2rem', borderRadius: 2 }}>
              Start New Meeting
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button variant="outlined" color="primary" fullWidth size="large" sx={{ py: 2, fontWeight: 'bold', fontSize: isMobile ? '1rem' : '1.2rem', borderRadius: 2 }}>
              Join Meeting
            </Button>
          </Grid>
        </Grid>
        <Box mt={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">
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
    <Box sx={{ minHeight: '100vh', width: '100vw', bgcolor: bgGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SignedOut>
        <Paper elevation={8} sx={cardStyle}>
          <Box textAlign="center" mb={3}>
            <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight="bold" color="primary" sx={{ mb: 1 }}>Nexus Meet</Typography>
            <Typography variant="subtitle1" color="text.secondary">Sign in or sign up with Google to continue</Typography>
          </Box>
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
        </Paper>
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </Box>
  );
}

export default App;
