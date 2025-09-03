import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
	Box, Typography, Button, TextField, IconButton, Paper, CircularProgress
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatIcon from '@mui/icons-material/Chat';

const SIGNAL_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Meet() {
	const { meetingId } = useParams();
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [micOn, setMicOn] = useState(true);
	const [videoOn, setVideoOn] = useState(true);
	const [loading, setLoading] = useState(true);
	const [peers, setPeers] = useState([]);
	const [chatOpen, setChatOpen] = useState(false);
	const localVideoRef = useRef();
	const peersRef = useRef([]);
	const socketRef = useRef();
	const streamRef = useRef();

	// Get username from session or default
	useEffect(() => {
		let name = '';
		try {
			const info = JSON.parse(sessionStorage.getItem('nexus_meeting_info'));
			if (info && info.username) name = info.username;
		} catch {}
		if (!name) name = 'Guest-' + Math.floor(Math.random() * 1000);
		setUsername(name);
	}, []);

	// Initialize socket and media
	useEffect(() => {
		if (!username) return;
		socketRef.current = io(SIGNAL_SERVER, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			reconnectionAttempts: 10,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			timeout: 20000,
			autoConnect: true,
			rejectUnauthorized: false
		});

		// Get media
		navigator.mediaDevices.getUserMedia({ audio: true, video: true })
			.then(stream => {
				streamRef.current = stream;
				setLoading(false);
				socketRef.current.emit('join-room', { meetingId, username });
			})
			.catch(() => {
				setLoading(false);
				alert('Could not access camera/microphone');
			});

		// Socket events
		socketRef.current.on('room-message', msg => {
			setMessages(prev => [...prev, msg]);
		});

		// WebRTC signaling
		socketRef.current.on('offer', async ({ offer, offererId }) => {
			const peer = createPeer(offererId, false);
			peersRef.current.push({ id: offererId, peer });
			setPeers([...peersRef.current]);
			await peer.setRemoteDescription(new RTCSessionDescription(offer));
			const answer = await peer.createAnswer();
			await peer.setLocalDescription(answer);
			socketRef.current.emit('answer', { targetId: offererId, answer });
		});
		socketRef.current.on('answer', async ({ answer, answererId }) => {
			const peer = peersRef.current.find(p => p.id === answererId)?.peer;
			if (peer) await peer.setRemoteDescription(new RTCSessionDescription(answer));
		});
		socketRef.current.on('ice-candidate', ({ senderId, candidate }) => {
			const peer = peersRef.current.find(p => p.id === senderId)?.peer;
			if (peer && candidate) peer.addIceCandidate(new RTCIceCandidate(candidate));
		});
		socketRef.current.on('user-joined', ({ id }) => {
			if (id === socketRef.current.id) return;
			const peer = createPeer(id, true);
			peersRef.current.push({ id, peer });
			setPeers([...peersRef.current]);
		});
		socketRef.current.on('user-left', ({ id }) => {
			peersRef.current = peersRef.current.filter(p => p.id !== id);
			setPeers([...peersRef.current]);
		});
		// Listen for media status changes
		socketRef.current.on('user-media-status-changed', ({ userId, hasAudio, hasVideo }) => {
			// Update UI for peer media status (optional: show mic/cam status)
			// Could add state for peer media status if needed
		});

		return () => {
			socketRef.current.disconnect();
			streamRef.current?.getTracks().forEach(track => track.stop());
		};
	}, [username, meetingId]);

	// Assign local stream to video element when stream is available and ref is ready
	useEffect(() => {
		if (streamRef.current && localVideoRef.current) {
			console.log('Assigning local stream to video element:', streamRef.current);
			localVideoRef.current.srcObject = streamRef.current;
			localVideoRef.current.muted = true;
			localVideoRef.current.autoplay = true;
			localVideoRef.current.playsInline = true;
			localVideoRef.current.style.display = 'block';
			localVideoRef.current.onloadedmetadata = () => {
				localVideoRef.current.play().catch((err) => {
					console.error('Video play error:', err);
				});
			};
		}
	}, [streamRef.current, localVideoRef.current]);

	// Create WebRTC peer
	function createPeer(targetId, initiator) {
		const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
		streamRef.current.getTracks().forEach(track => peer.addTrack(track, streamRef.current));
		peer.onicecandidate = e => {
			if (e.candidate) {
				socketRef.current.emit('ice-candidate', { targetId, candidate: e.candidate });
			}
		};
		peer.ontrack = e => {
			// Always update video element for this peer
			setTimeout(() => {
				const remoteVideo = document.getElementById('video-' + targetId);
				if (remoteVideo && e.streams[0]) remoteVideo.srcObject = e.streams[0];
			}, 100);
		};
		if (initiator) {
			peer.onnegotiationneeded = async () => {
				const offer = await peer.createOffer();
				await peer.setLocalDescription(offer);
				socketRef.current.emit('offer', { targetId, offer });
			};
		}
		return peer;
	}

	// Send chat message
	function sendMessage() {
		if (input.trim()) {
			socketRef.current.emit('room-message', { meetingId, user: username, text: input });
			setInput('');
		}
	}

	// Toggle mic/video (fix: update tracks and notify peers)
	function toggleMic() {
		const enabled = !micOn;
		streamRef.current.getAudioTracks().forEach(track => track.enabled = enabled);
		setMicOn(enabled);
		socketRef.current.emit('media-status-changed', { meetingId, hasAudio: enabled, hasVideo: videoOn });
	}
	function toggleVideo() {
		const enabled = !videoOn;
		streamRef.current.getVideoTracks().forEach(track => track.enabled = enabled);
		setVideoOn(enabled);
		socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: enabled });
	}

	// Leave meeting
	function leaveMeeting() {
		socketRef.current.emit('leave-room', meetingId);
		navigate('/dashboard');
	}

	if (loading) {
		return (
			<Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#121212' }}>
				<CircularProgress size={60} sx={{ color: '#1976d2' }} />
				<Typography variant="h6" sx={{ mt: 2, color: '#fff' }}>
					Connecting to meeting...
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ height: '100vh', bgcolor: '#f5f7fa', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, Arial, sans-serif' }}>
			{/* Meeting Info */}
			<Box sx={{ p: 2, bgcolor: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<Typography variant="h6">Meeting ID: {meetingId}</Typography>
				<Typography variant="body2">User: {username}</Typography>
			</Box>
			{/* Video Grid */}
			<Box sx={{ flex: 1, display: 'flex', gap: 2, p: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', bgcolor: '#e3f2fd' }}>
				<Paper elevation={3} sx={{ p: 1, bgcolor: '#fff', borderRadius: 2 }}>
					<video ref={localVideoRef} autoPlay playsInline muted style={{ width: 240, borderRadius: 8, background: '#000' }} />
					{!streamRef.current && (
						<Typography variant="body2" sx={{ color: 'red', textAlign: 'center', mt: 2 }}>
							Camera stream not available
						</Typography>
					)}
					<Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>You</Typography>
				</Paper>
				{peers.map(({ id }) => (
					<Paper key={id} elevation={3} sx={{ p: 1, bgcolor: '#fff', borderRadius: 2 }}>
						<video id={'video-' + id} autoPlay playsInline style={{ width: 240, borderRadius: 8, background: '#000' }} />
						<Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>Peer</Typography>
					</Paper>
				))}
			</Box>
			{/* Controls */}
			<Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, p: 2, bgcolor: '#fff' }}>
				<IconButton onClick={toggleMic} sx={{ bgcolor: micOn ? '#c8e6c9' : '#ffcdd2', color: micOn ? '#388e3c' : '#d32f2f', borderRadius: 2 }}>
					{micOn ? <MicIcon /> : <MicOffIcon />}
				</IconButton>
				<IconButton onClick={toggleVideo} sx={{ bgcolor: videoOn ? '#bbdefb' : '#ffe0b2', color: videoOn ? '#1976d2' : '#f57c00', borderRadius: 2 }}>
					{videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
				</IconButton>
				<IconButton onClick={leaveMeeting} sx={{ bgcolor: '#f8bbd0', color: '#d81b60', borderRadius: 2 }}>
					<CallEndIcon />
				</IconButton>
				<IconButton onClick={() => setChatOpen(!chatOpen)} sx={{ bgcolor: chatOpen ? '#e1bee7' : '#fff', color: chatOpen ? '#6a1b9a' : '#1976d2', borderRadius: 2 }}>
					<ChatIcon />
				</IconButton>
			</Box>
			{/* Chat Sidebar */}
			{chatOpen && (
				<Box sx={{ position: 'fixed', right: 0, top: 0, width: 320, height: '100vh', bgcolor: '#fff', boxShadow: 6, zIndex: 100, display: 'flex', flexDirection: 'column' }}>
					<Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
						<Typography variant="h6">Chat</Typography>
						<Button size="small" onClick={() => setChatOpen(false)} sx={{ color: '#fff' }}>Close</Button>
					</Box>
					<Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
						{messages.map((msg, idx) => (
							<Box key={idx} sx={{ mb: 2, textAlign: msg.user === username ? 'right' : 'left' }}>
								<Typography variant="caption" sx={{ color: '#888', fontSize: 12 }}>{msg.user}</Typography>
								<Paper sx={{ display: 'inline-block', p: 1, bgcolor: msg.user === username ? '#e3f2fd' : '#f5f7fa', color: '#1976d2', borderRadius: 2, maxWidth: '80%', fontSize: 14 }}>{msg.text}</Paper>
							</Box>
						))}
					</Box>
					<Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Type a message..."
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
							sx={{ bgcolor: '#f5f7fa', color: '#1976d2', borderRadius: 2, fontSize: 14 }}
							InputProps={{ style: { color: '#1976d2' } }}
						/>
						<IconButton color="primary" onClick={sendMessage} sx={{ ml: 1, bgcolor: '#e3f2fd', color: '#1976d2', borderRadius: 2 }}>
							<ChatIcon />
						</IconButton>
					</Box>
				</Box>
			)}
		</Box>
	);
}
