import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '100vh',
            p: 3,
            background: 'var(--gradient-primary)'
          }}
        >
          <Paper 
            elevation={2}
            sx={{ 
              maxWidth: 500, 
              width: '100%', 
              p: 4, 
              textAlign: 'center',
              borderRadius: 'var(--card-radius)',
              boxShadow: 'var(--shadow-soft)'
            }}
          >
            <Typography 
              variant="h5" 
              color="error.main" 
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              Oops! Something went wrong
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              The application encountered an unexpected error. We've been notified and are working to fix it.
            </Typography>
            <Button 
              variant="contained" 
              onClick={this.handleReload}
              sx={{ 
                borderRadius: 'var(--button-radius)',
                background: 'var(--gradient-accent)',
                py: 1,
                px: 3
              }}
            >
              Reload Application
            </Button>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 4, textAlign: 'left' }}>
                <Typography variant="subtitle2" color="error" sx={{ fontWeight: 600 }}>
                  Error Details (development only):
                </Typography>
                <Box 
                  sx={{ 
                    p: 2, 
                    mt: 1, 
                    backgroundColor: 'rgba(0,0,0,0.05)', 
                    borderRadius: 1, 
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    overflowX: 'auto'
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
