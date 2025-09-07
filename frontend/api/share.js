// This file is used by Vercel to create a serverless function that handles direct URL sharing
// It ensures that direct links to meeting URLs are properly routed in the single-page application

export default function handler(req, res) {
  // Check if the request is for a meeting
  const url = req.url;
  const meetingMatch = url.match(/\/meet\/([^\/]+)/) || url.match(/\/meeting\/([^\/]+)/);
  
  if (meetingMatch) {
    // Extract the meeting ID
    const meetingId = meetingMatch[1];
    
    // Serve the index.html with proper meta tags for sharing
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Join Nexus Meeting #${meetingId}</title>
    <meta name="description" content="You've been invited to join a Nexus Meeting. Click to join now!">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${process.env.VERCEL_URL || 'https://nexus-meet.vercel.app'}/meet/${meetingId}">
    <meta property="og:title" content="Join Nexus Meeting #${meetingId}">
    <meta property="og:description" content="You've been invited to join a Nexus Meeting. Click to join now!">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${process.env.VERCEL_URL || 'https://nexus-meet.vercel.app'}/meet/${meetingId}">
    <meta property="twitter:title" content="Join Nexus Meeting #${meetingId}">
    <meta property="twitter:description" content="You've been invited to join a Nexus Meeting. Click to join now!">
    
    <meta http-equiv="refresh" content="0;url=/meet/${meetingId}" />
</head>
<body>
    <script>
        window.location.href = "/meet/${meetingId}";
    </script>
    <noscript>
        <a href="/meet/${meetingId}">Click here to join the meeting</a>
    </noscript>
</body>
</html>`);
  }
  
  // For all other routes, let the SPA handle it
  return res.end('Not Found', 404);
}
