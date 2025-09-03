# Nexus Meet

A real-time video conferencing application with WebRTC for peer-to-peer video, audio, and chat.

## Features

- Real-time video and audio communication using WebRTC
- Text chat functionality
- Screen sharing
- Unique meeting ID generation
- Responsive design for all devices

## Project Structure

```
nexus/
├── frontend/          # React frontend
│   ├── src/           # Source files
│   ├── public/        # Static assets
│   └── .env           # Frontend environment variables
└── backend/           # Express server
    ├── index.js       # Main server file
    └── package.json   # Backend dependencies
```

## Environment Variables

### Frontend (.env)

```
VITE_API_URL=https://your-api-url.com
VITE_LOCAL_API_URL=http://localhost:5000
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-key
```

### Backend (.env)

```
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-domain.com
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/nexus.git
cd nexus
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

### Running Locally

1. Start the backend server
```bash
cd backend
npm run dev
```

2. Start the frontend development server
```bash
cd frontend
npm run dev
```

3. Open your browser and navigate to http://localhost:5173

## Deployment

### Backend Deployment (Render.com)

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Configure the build:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add environment variables from the `.env` file
5. Deploy

### Frontend Deployment (Vercel)

1. Connect your GitHub repository to Vercel
2. Configure the build:
   - Framework Preset: Vite
   - Root Directory: `frontend`
3. Add environment variables:
   - `VITE_API_URL` = Your deployed backend URL
4. Deploy

## Troubleshooting

### Video and Audio Issues

If you're experiencing issues with video or audio:

1. Make sure your browser permissions for camera and microphone are enabled
2. Check your browser console for any error messages
3. Try using a different browser (Chrome or Firefox recommended)
4. Verify that your camera and microphone are not being used by another application

### WebRTC Connection Issues

WebRTC connections might fail due to network restrictions. Consider:

1. Using a TURN server for better connectivity
2. Adding additional STUN servers
3. Checking firewall settings

## License

This project is licensed under the MIT License - see the LICENSE file for details.
