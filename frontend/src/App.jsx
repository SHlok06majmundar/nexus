import React from 'react';
import { SignedIn, SignedOut, SignIn, SignUp, useUser, RedirectToSignIn } from '@clerk/clerk-react';
import { Container, Box, Typography, Button, Paper } from '@mui/material';

function Dashboard() {
  const { user } = useUser();
  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={4} sx={{ width: '100%', padding: 4, borderRadius: 3 }}>
        <Box textAlign="center" mb={3}>
          <Typography variant="h3" fontWeight="bold" color="primary">Welcome to nexus-meet</Typography>
          <Typography variant="subtitle1" color="text.secondary">Hello, {user?.fullName || user?.username}!</Typography>
        </Box>
        <Typography variant="body1">You are now logged in. Dashboard features coming soon!</Typography>
      </Paper>
    </Container>
  );
}

function App() {
  return (
    <>
      <SignedOut>
        <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper elevation={4} sx={{ width: '100%', padding: 4, borderRadius: 3 }}>
            <Box textAlign="center" mb={3}>
              <Typography variant="h3" fontWeight="bold" color="primary">nexus-meet</Typography>
              <Typography variant="subtitle1" color="text.secondary">Sign in or sign up with Google to continue</Typography>
            </Box>
            <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
          </Paper>
        </Container>
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}

export default App;
