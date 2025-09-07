import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  IconButton,
  Divider,
  TextField,
  Tooltip,
  Stack,
  Fade,
  Tab,
  Tabs,
  Paper
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import TelegramIcon from '@mui/icons-material/Telegram';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import QrCodeIcon from '@mui/icons-material/QrCode';
import CloseIcon from '@mui/icons-material/Close';
import QRCodeGenerator from './QRCodeGenerator';

const ShareDialog = ({ 
  open, 
  onClose, 
  meetingId, 
  isScheduled = false,
  scheduledDate = null,
  scheduledTime = null 
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const meetingLink = `${window.location.origin}/meet/${meetingId}`;
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    // You could add a toast notification here
  };
  
  const getFormattedDateTime = () => {
    if (!scheduledDate || !scheduledTime) return '';
    
    const dateObj = new Date(scheduledDate);
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return `${dateFormatted} at ${scheduledTime}`;
  };
  
  const shareText = isScheduled
    ? `Join me for a Nexus meeting on ${getFormattedDateTime()}. Meeting ID: ${meetingId}`
    : `Join me now on Nexus! Meeting ID: ${meetingId}`;
    
  const shareViaWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${meetingLink}`)}`;
    window.open(url, '_blank');
  };
  
  const shareViaEmail = () => {
    const subject = isScheduled 
      ? `Nexus Meeting Invitation - ${getFormattedDateTime()}` 
      : 'Join My Nexus Meeting Now';
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${shareText}\n\n${meetingLink}`)}`;
    window.open(url);
  };
  
  const shareViaTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(meetingLink)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };
  
  const shareViaFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(meetingLink)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };
  
  const shareViaTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${meetingLink}`)}`;
    window.open(url, '_blank');
  };
  
  const shareViaLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(meetingLink)}`;
    window.open(url, '_blank');
  };
  
  const shareViaWebShare = () => {
    if (navigator.share) {
      navigator.share({
        title: isScheduled ? 'Scheduled Nexus Meeting' : 'Join My Nexus Meeting',
        text: shareText,
        url: meetingLink
      }).catch(err => console.error('Error sharing:', err));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      sx={{
        '& .MuiPaper-root': {
          borderRadius: 'var(--card-radius)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        pb: 1
      }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {isScheduled ? 'Share Scheduled Meeting' : 'Share Meeting'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ py: 3 }}>
        <Stack spacing={3}>
          {isScheduled && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'rgba(106, 17, 203, 0.05)', 
              borderRadius: 'var(--card-radius)'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                Scheduled Meeting Details
              </Typography>
              <Typography variant="body2">
                {getFormattedDateTime()}
              </Typography>
            </Box>
          )}
          
          <Box sx={{ width: '100%' }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange} 
              variant="fullWidth"
              sx={{
                mb: 3,
                '& .MuiTab-root': {
                  fontWeight: 600,
                  py: 1.5
                },
                '& .Mui-selected': {
                  color: 'var(--color-primary)',
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: 'var(--color-primary)',
                }
              }}
            >
              <Tab label="Link" />
              <Tab label="Social" />
              <Tab label="QR Code" />
            </Tabs>
            
            {/* Link Tab */}
            {activeTab === 0 && (
              <Fade in={activeTab === 0}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Meeting Link
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      value={meetingLink}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        readOnly: true,
                        sx: {
                          borderRadius: 'var(--input-radius)',
                          bgcolor: 'rgba(245, 247, 250, 0.8)'
                        }
                      }}
                    />
                    <Tooltip title="Copy link">
                      <IconButton 
                        onClick={handleCopyLink}
                        sx={{ 
                          bgcolor: 'var(--color-primary)', 
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'var(--color-secondary)'
                          }
                        }}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Meeting ID
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        value={meetingId}
                        variant="outlined"
                        size="small"
                        InputProps={{
                          readOnly: true,
                          sx: {
                            borderRadius: 'var(--input-radius)',
                            bgcolor: 'rgba(245, 247, 250, 0.8)',
                            fontFamily: 'monospace'
                          }
                        }}
                      />
                      <Tooltip title="Copy ID">
                        <IconButton 
                          onClick={() => navigator.clipboard.writeText(meetingId)}
                          sx={{ 
                            bgcolor: 'var(--color-secondary)', 
                            color: 'white',
                            '&:hover': {
                              bgcolor: 'var(--color-primary)'
                            }
                          }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  
                  {navigator.share && (
                    <Button 
                      variant="contained" 
                      fullWidth
                      onClick={shareViaWebShare}
                      sx={{ 
                        mt: 3,
                        bgcolor: 'var(--color-primary)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'var(--color-secondary)'
                        }
                      }}
                    >
                      Share using device options
                    </Button>
                  )}
                </Box>
              </Fade>
            )}
            
            {/* Social Tab */}
            {activeTab === 1 && (
              <Fade in={activeTab === 1}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Share via social media or messaging
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#25D366' }}>
                        <IconButton 
                          onClick={shareViaWhatsApp}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <WhatsAppIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          WhatsApp
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#EA4335' }}>
                        <IconButton 
                          onClick={shareViaEmail}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <EmailIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          Email
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#0088cc' }}>
                        <IconButton 
                          onClick={shareViaTelegram}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <TelegramIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          Telegram
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#1877F2' }}>
                        <IconButton 
                          onClick={shareViaFacebook}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <FacebookIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          Facebook
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#1DA1F2' }}>
                        <IconButton 
                          onClick={shareViaTwitter}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <TwitterIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          Twitter
                        </Typography>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={4} sm={3}>
                      <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 'var(--card-radius)', bgcolor: '#0A66C2' }}>
                        <IconButton 
                          onClick={shareViaLinkedIn}
                          sx={{ color: 'white', mb: 1 }}
                        >
                          <LinkedInIcon fontSize="large" />
                        </IconButton>
                        <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                          LinkedIn
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </Box>
              </Fade>
            )}
            
            {/* QR Code Tab */}
            {activeTab === 2 && (
              <Fade in={activeTab === 2}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Scan this QR code to join the meeting
                  </Typography>
                  
                  <Box 
                    sx={{ 
                      display: 'inline-flex', 
                      p: 3, 
                      borderRadius: 'var(--card-radius)',
                      bgcolor: '#fff',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      mb: 2
                    }}
                  >
                    <QRCodeGenerator url={meetingLink} size={200} />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Point your camera at the QR code to join instantly
                  </Typography>
                  
                  <Button 
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyLink}
                    sx={{ mt: 3 }}
                  >
                    Copy meeting link
                  </Button>
                </Box>
              </Fade>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, pt: 0 }}>
        <Button 
          variant="outlined" 
          onClick={onClose}
          sx={{
            borderColor: 'rgba(0,0,0,0.2)',
            color: 'var(--text-primary)',
            '&:hover': {
              borderColor: 'rgba(0,0,0,0.4)',
              bgcolor: 'rgba(0,0,0,0.03)'
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareDialog;
