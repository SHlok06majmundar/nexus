import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
	Box, Typography, Button, TextField, IconButton, Paper, CircularProgress, Avatar, Tooltip
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatIcon from '@mui/icons-material/Chat';
import RecordingButton from './components/RecordingButton';

const SIGNAL_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Meet() {
	// CSS for typing animation
	const typingAnimationStyles = `
		.typing-animation {
			display: flex;
			align-items: center;
			column-gap: 2px;
			margin-right: 5px;
		}
		
		.typing-animation span {
			height: 5px;
			width: 5px;
			background-color: var(--color-primary, #6A11CB);
			border-radius: 50%;
			opacity: 0.6;
		}
		
		.typing-animation span:nth-child(1) {
			animation: pulse 1s infinite ease-in-out;
		}
		
		.typing-animation span:nth-child(2) {
			animation: pulse 1s infinite ease-in-out 0.2s;
		}
		
		.typing-animation span:nth-child(3) {
			animation: pulse 1s infinite ease-in-out 0.4s;
		}
		
		@keyframes pulse {
			0%, 100% { 
				transform: scale(0.8); 
				opacity: 0.6;
			}
			50% { 
				transform: scale(1.2); 
				opacity: 1; 
			}
		}
	`;

	// Always define all hooks at the top level, never conditionally
	const { meetingId } = useParams();
	const navigate = useNavigate();
	
	// User and meeting state
	const [username, setUsername] = useState('');
	const [messages, setMessages] = useState([]);
	const [input, setInput] = useState('');
	const [typingUsers, setTypingUsers] = useState([]);
	const [isTyping, setIsTyping] = useState(false);
	
	// Media state
	const [micOn, setMicOn] = useState(true);
	const [videoOn, setVideoOn] = useState(true);
	
	// UI state
	const [loading, setLoading] = useState(true);
	const [chatOpen, setChatOpen] = useState(false);
	const [error, setError] = useState('');
	const [errorSeverity, setErrorSeverity] = useState('info'); // 'info', 'warning', 'error'
	
	// Connection state
	const [connectionState, setConnectionState] = useState('connecting');
	const [showReconnectButton, setShowReconnectButton] = useState(false);
	const [peers, setPeers] = useState([]);
	
	// Keep track of initialization to avoid double initialization
	const [isInitialized, setIsInitialized] = useState(false);
	
	// Refs for media and connections
	const localVideoRef = useRef(null);
	const peersRef = useRef([]);
	const socketRef = useRef(null);
	const streamRef = useRef(null);
	
	// Additional refs to track cleanup status and errors
	const isCleanedUp = useRef(false);
	const errorTimeoutRef = useRef(null);
	
	// Helper function to show errors with severity
	const showError = (message, severity = 'error') => {
		console.error(message);
		setError(message);
		setErrorSeverity(severity);
		
		// Auto-hide info messages after 5 seconds
		if (severity === 'info') {
			setTimeout(() => {
				setError('');
			}, 5000);
		}
	};
	
	// Handler for manual reconnection
	const handleReconnect = () => {
		console.log('Manual reconnection requested');
		setConnectionState('reconnecting');
		
		// Close all existing peer connections
		peersRef.current.forEach(peerObj => {
			try {
				if (peerObj && peerObj.peer) {
					peerObj.peer.close();
				}
			} catch (err) {
				console.error(`Error closing peer connection:`, err);
			}
		});
		
		// Clear current peer list
		peersRef.current = [];
		setPeers([]);
		
		// Request socket reconnection
		if (socketRef.current) {
			if (!socketRef.current.connected) {
				console.log('Reconnecting socket...');
				socketRef.current.connect();
			}
			
			// Re-join the room after a short delay
			setTimeout(() => {
				console.log('Rejoining room...');
				socketRef.current.emit('join-room', { meetingId, username });
				setShowReconnectButton(false);
			}, 1000);
		}
	};

	// Typing indicator with debounce
	useEffect(() => {
		let typingTimeout;
		
		if (isTyping) {
			// Reset the timer whenever isTyping changes to true
			clearTimeout(typingTimeout);
			
			// Set a new timer to automatically clear typing status after inactivity
			typingTimeout = setTimeout(() => {
				setIsTyping(false);
				if (socketRef.current) {
					socketRef.current.emit('user-stopped-typing', { meetingId, username });
				}
			}, 2000); // 2 seconds without typing will clear the typing status
		}
		
		return () => clearTimeout(typingTimeout);
	}, [input, isTyping, meetingId, username]);

	// Get user preferences from session or set defaults
	useEffect(() => {
		let name = '';
		let initialMicOn = true;
		let initialVideoOn = true;
		
		try {
			const info = JSON.parse(sessionStorage.getItem('nexus_meeting_info'));
			if (info) {
				if (info.username) name = info.username;
				if (info.micEnabled !== undefined) initialMicOn = info.micEnabled;
				if (info.videoEnabled !== undefined) initialVideoOn = info.videoEnabled;
			}
		} catch {}
		
		if (!name) name = 'Guest-' + Math.floor(Math.random() * 1000);
		setUsername(name);
		setMicOn(initialMicOn);
		setVideoOn(initialVideoOn);
	}, []);

	// Initialize socket and media with improved connection handling
	useEffect(() => {
		if (!username || isInitialized) return;
		
		// Mark as initialized to prevent double initialization
		setIsInitialized(true);
		
		console.log(`Initializing meeting: ${meetingId} for user: ${username}`);
		
		// Enhanced socket.io initialization with better reconnection parameters
		socketRef.current = io(SIGNAL_SERVER, {
			transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
			reconnection: true,
			reconnectionAttempts: 15,   // Increased from 10 to 15
			reconnectionDelay: 1000,    // Start with 1 second delay
			reconnectionDelayMax: 8000, // Increased max delay to 8 seconds
			timeout: 20000,
			autoConnect: true,
			forceNew: true,             // Force a new connection to avoid reusing problematic ones
			rejectUnauthorized: false,
			query: {                    // Add identifying info to connection
				username,
				meetingId
			}
		});
		
		// Enhanced socket connection and error handling
		socketRef.current.on('connect', () => {
			console.log(`Socket connected with ID: ${socketRef.current.id}`);
			
			// Update UI state on successful connection
			setConnectionState(prevState => {
				if (prevState === 'failed') {
					showError('Connection restored', 'info');
				}
				return 'connecting'; // Still need to join the room
			});
			
			// If reconnecting, automatically re-join the room
			if (socketRef.current.recovered) {
				console.log('Socket connection recovered, rejoining room...');
				socketRef.current.emit('join-room', { meetingId, username });
			}
		});
		
		socketRef.current.on('connect_error', (err) => {
			console.error('Socket connection error:', err);
			setLoading(false);
			setConnectionState('failed');
			setShowReconnectButton(true);
			showError(`Connection error: ${err.message}. Please check your internet connection and try again.`, 'error');
		});
		
		socketRef.current.on('reconnect', (attemptNumber) => {
			console.log(`Socket reconnected after ${attemptNumber} attempts`);
			showError('Connection restored. Rejoining meeting...', 'info');
			
			// Re-join the room
			socketRef.current.emit('join-room', { meetingId, username });
		});
		
		socketRef.current.on('reconnect_attempt', (attemptNumber) => {
			console.log(`Socket reconnection attempt #${attemptNumber}`);
			showError(`Reconnecting... (Attempt ${attemptNumber})`, 'info');
		});
		
		socketRef.current.on('reconnect_error', (err) => {
			console.error('Socket reconnection error:', err);
			showError('Reconnection failed. Please check your network.', 'error');
		});
		
		socketRef.current.on('reconnect_failed', () => {
			console.error('Socket reconnection failed after all attempts');
			showError('Failed to reconnect after multiple attempts. Please refresh the page.', 'error');
			setConnectionState('failed');
			setShowReconnectButton(true);
		});
		
		socketRef.current.on('error', (err) => {
			console.error('Socket error:', err);
			showError(`Error: ${err.message || 'Unknown socket error'}`, 'error');
		});
		
		// Setup heartbeat to keep connection alive
		const heartbeatInterval = setInterval(() => {
			if (socketRef.current && socketRef.current.connected) {
				socketRef.current.emit('heartbeat');
			}
		}, 30000);

		// Get media with multiple fallback options and comprehensive error handling
		const getMedia = async () => {
			try {
				console.log('Requesting camera and microphone access with optimal settings...');
				
				// Try to get optimal video and audio
				const stream = await navigator.mediaDevices.getUserMedia({ 
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}, 
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: 'user',
						frameRate: { ideal: 30, max: 60 }
					}
				});
				
				console.log('Media access granted with optimal settings:', 
					stream.getTracks().map(t => `${t.kind}:${t.label}`));
				
				// Apply initial mic preference with detailed logging
				stream.getAudioTracks().forEach(track => {
					track.enabled = micOn;
					console.log(`Initial audio state: ${track.label} ${micOn ? 'enabled' : 'disabled'}`);
					
					// Set up track ended handler for monitoring
					track.onended = () => {
						console.log(`Audio track ${track.id} ended unexpectedly`);
						showError('Your microphone disconnected. Please check your audio device.', 'warning');
					};
					
					// Monitor mute state changes
					track.onmute = () => console.log(`Audio track ${track.id} muted`);
					track.onunmute = () => console.log(`Audio track ${track.id} unmuted`);
				});
				
				// For video, if initially off, disable tracks but don't stop them
				stream.getVideoTracks().forEach(track => {
					track.enabled = videoOn;
					console.log(`Initial video state: ${track.label} ${videoOn ? 'enabled' : 'disabled'}`);
					
					// Set up track ended handler for monitoring
					track.onended = () => {
						console.log(`Video track ${track.id} ended unexpectedly`);
						setVideoOn(false);
						showError('Your camera disconnected. Switching to audio-only mode.', 'warning');
					};
					
					// Monitor mute state changes
					track.onmute = () => console.log(`Video track ${track.id} muted`);
					track.onunmute = () => console.log(`Video track ${track.id} unmuted`);
				});
				
				// Apply stream to video element
				if (localVideoRef.current) {
					localVideoRef.current.srcObject = stream;
					localVideoRef.current.muted = true; // Mute local video to prevent feedback
					
					// Monitor video element for errors
					localVideoRef.current.onerror = (err) => {
						console.error('Video element error:', err);
					};
				}
				
				// Store stream and update UI
				streamRef.current = stream;
				setLoading(false);
				
				// Join the room with detailed logging
				console.log(`Joining room: ${meetingId} as ${username} with video=${videoOn}, audio=${micOn}`);
				socketRef.current.emit('join-room', { meetingId, username });
				
				// Notify other users of our initial media state
				socketRef.current.emit('media-status-changed', { 
					meetingId, 
					hasAudio: micOn, 
					hasVideo: videoOn 
				});
				
				// Monitor for device changes
				navigator.mediaDevices.ondevicechange = () => {
					console.log('Media devices changed, checking available devices...');
					
					navigator.mediaDevices.enumerateDevices()
						.then(devices => {
							const hasVideoDevices = devices.some(device => device.kind === 'videoinput');
							const hasAudioDevices = devices.some(device => device.kind === 'audioinput');
							
							console.log(`Available devices: video=${hasVideoDevices}, audio=${hasAudioDevices}`);
							
							// Could implement dynamic device switching here
						})
						.catch(err => console.error('Error enumerating devices:', err));
				};
				
				return true;
			} catch (err) {
				console.error('Media access error:', err);
				
				// Try with basic video/audio settings if optimal fails
				try {
					console.log('Falling back to basic video/audio settings...');
					const basicStream = await navigator.mediaDevices.getUserMedia({
						audio: true,
						video: true
					});
					
					console.log('Media access granted with basic settings');
					
					// Apply initial state
					basicStream.getAudioTracks().forEach(track => {
						track.enabled = micOn;
					});
					
					basicStream.getVideoTracks().forEach(track => {
						track.enabled = videoOn;
					});
					
					// Store stream and update UI
					streamRef.current = basicStream;
					setLoading(false);
					
					// Apply stream to video element
					if (localVideoRef.current) {
						localVideoRef.current.srcObject = basicStream;
						localVideoRef.current.muted = true;
					}
					
					// Join the room
					socketRef.current.emit('join-room', { meetingId, username });
					socketRef.current.emit('media-status-changed', { 
						meetingId, 
						hasAudio: micOn, 
						hasVideo: videoOn 
					});
					
					return true;
				} catch (basicErr) {
					console.error('Basic media settings failed:', basicErr);
					
					// Try audio-only as fallback
					try {
						console.log('Falling back to audio-only mode...');
						const audioStream = await navigator.mediaDevices.getUserMedia({ 
							audio: {
								echoCancellation: true,
								noiseSuppression: true,
								autoGainControl: true
							}, 
							video: false 
						});
						
						console.log('Audio-only access granted');
						
						audioStream.getAudioTracks().forEach(track => {
							track.enabled = micOn;
							console.log(`Audio-only fallback: ${track.label} ${micOn ? 'enabled' : 'disabled'}`);
						});
						
						// Store stream and update UI
						streamRef.current = audioStream;
						setLoading(false);
						setVideoOn(false);
						
						// Clear video element
						if (localVideoRef.current) {
							localVideoRef.current.srcObject = null;
						}
						
						// Join the room in audio-only mode
						socketRef.current.emit('join-room', { meetingId, username });
						socketRef.current.emit('media-status-changed', { 
							meetingId, 
							hasAudio: micOn, 
							hasVideo: false 
						});
						
						showError('Video access denied. Joining in audio-only mode.', 'info');
						return true;
					} catch (audioErr) {
						console.error('Audio-only fallback failed:', audioErr);
						
						// Final fallback: join without any media
						try {
							console.log('Joining without media access');
							
							// Create empty stream for signaling
							const emptyStream = new MediaStream();
							streamRef.current = emptyStream;
							
							setLoading(false);
							setVideoOn(false);
							setMicOn(false);
							
							// Join the room in no-media mode
							socketRef.current.emit('join-room', { meetingId, username });
							socketRef.current.emit('media-status-changed', { 
								meetingId, 
								hasAudio: false, 
								hasVideo: false 
							});
							
							showError('Could not access camera or microphone. You can see and hear others, but they cannot see or hear you.', 'warning');
							return true;
						} catch (finalErr) {
							setLoading(false);
							showError('Could not join the meeting. Please check your permissions and try again.', 'error');
							return false;
						}
					}
				}
			}
		};
		
		getMedia();

		// Enhanced socket events for chat handling
		socketRef.current.on('room-message', msg => {
			// Check for duplicates to prevent double messages
			setMessages(prev => {
				// Check if this message is already in our list
				const isDuplicate = prev.some(m => m.messageId === msg.messageId);
				if (isDuplicate) {
					return prev; // Don't add duplicates
				}
				
				// Add the message
				const updatedMessages = [...prev, msg];
				
				// Send read receipt after short delay to ensure UI has updated
				setTimeout(() => {
					if (socketRef.current) {
						socketRef.current.emit('message-read', { 
							messageId: msg.messageId,
							meetingId
						});
						
						console.log(`Sent read receipt for message ${msg.messageId}`);
					}
				}, 500);
				
				return updatedMessages;
			});
		});
		
		// Handle message history when joining a room
		socketRef.current.on('room-message-history', ({ messages: historyMessages }) => {
			console.log(`Received message history: ${historyMessages.length} messages`);
			setMessages(prev => {
				// Merge with existing messages, avoiding duplicates
				const existingIds = new Set(prev.map(m => m.messageId));
				const newMessages = historyMessages.filter(m => !existingIds.has(m.messageId));
				
				// Send read receipts for all new messages
				setTimeout(() => {
					newMessages.forEach(msg => {
						if (socketRef.current) {
							socketRef.current.emit('message-read', { 
								messageId: msg.messageId,
								meetingId
							});
						}
					});
				}, 1000);
				
				return [...prev, ...newMessages];
			});
		});
		
		// Handle message read receipts
		socketRef.current.on('message-read-receipt', ({ messageId, readBy, timestamp }) => {
			setMessages(prev => {
				return prev.map(msg => {
					if (msg.messageId === messageId) {
						// Create or update the read receipts array
						const readReceipts = msg.readReceipts || [];
						
						// Check if this user has already been recorded
						const alreadyRead = readReceipts.some(receipt => receipt.readBy === readBy);
						
						if (!alreadyRead) {
							return {
								...msg,
								readStatus: 'read',
								readReceipts: [
									...readReceipts,
									{ readBy, timestamp }
								]
							};
						}
					}
					return msg;
				});
			});
		});
		
		// Handle typing indicators
		socketRef.current.on('user-typing', ({ username: typingUser }) => {
			if (typingUser !== username) {
				setTypingUsers(prev => {
					if (!prev.includes(typingUser)) {
						return [...prev, typingUser];
					}
					return prev;
				});
				
				// Auto-remove typing indicator after 3 seconds of inactivity
				setTimeout(() => {
					setTypingUsers(prev => prev.filter(user => user !== typingUser));
				}, 3000);
			}
		});
		
		socketRef.current.on('user-stopped-typing', ({ username: stoppedUser }) => {
			setTypingUsers(prev => prev.filter(user => user !== stoppedUser));
		});

		// Room events
		socketRef.current.on('joined-room', ({ success, meetingId, participantCount }) => {
			console.log(`Join room result: success=${success}, participants=${participantCount}`);
			if (!success) {
				showError('Failed to join meeting room', 'error');
				navigate('/dashboard');
			}
		});
		
		socketRef.current.on('room-users', (participants) => {
			console.log('Current room participants:', participants);
		});

		// WebRTC signaling with enhanced error handling
		socketRef.current.on('offer', async ({ offer, offererId, offererUsername }) => {
			try {
				console.log(`Received offer from ${offererId} (${offererUsername})`);
				
				// Check if we already have a peer for this user
				const existingPeer = peersRef.current.find(p => p.id === offererId);
				if (existingPeer) {
					console.log(`Already have a peer for ${offererId}, closing old connection`);
					existingPeer.peer.close();
					peersRef.current = peersRef.current.filter(p => p.id !== offererId);
				}
				
				// Create new peer
				const peer = createPeer(offererId, false);
				peersRef.current.push({ id: offererId, peer, username: offererUsername, hasVideo: true, hasAudio: true });
				setPeers([...peersRef.current]);
				
				// Set remote description and create answer
				await peer.setRemoteDescription(new RTCSessionDescription(offer));
				console.log(`Set remote description from ${offererId}, creating answer`);
				
				const answer = await peer.createAnswer();
				await peer.setLocalDescription(answer);
				console.log(`Sending answer to ${offererId}`);
				
				socketRef.current.emit('answer', { 
					targetId: offererId, 
					answer,
					answererId: socketRef.current.id,
					answererUsername: username
				});
			} catch (err) {
				console.error('Error handling offer:', err);
				showError(`Connection error: ${err.message}. Try rejoining the meeting.`, 'error');
			}
		});
		
		socketRef.current.on('answer', async ({ answer, answererId, answererUsername }) => {
			try {
				console.log(`Received answer from ${answererId} (${answererUsername || 'unknown'})`);
				
				// Find the peer
				const peerIndex = peersRef.current.findIndex(p => p.id === answererId);
				const peer = peerIndex !== -1 ? peersRef.current[peerIndex].peer : null;
				
				if (peer) {
					// Update username if available
					if (answererUsername && peerIndex !== -1) {
						peersRef.current[peerIndex].username = answererUsername;
					}
					
					// Set remote description
					await peer.setRemoteDescription(new RTCSessionDescription(answer));
					console.log(`Set remote description from ${answererId}, connection established`);
				} else {
					console.warn(`Received answer from unknown peer: ${answererId}`);
				}
			} catch (err) {
				console.error('Error handling answer:', err);
			}
		});
		
		socketRef.current.on('ice-candidate', async ({ senderId, candidate }) => {
			try {
				const peer = peersRef.current.find(p => p.id === senderId)?.peer;
				
				if (peer) {
					if (peer.currentRemoteDescription) {
						console.log(`Adding ICE candidate from ${senderId}`);
						await peer.addIceCandidate(new RTCIceCandidate(candidate));
					} else {
						console.log(`Queueing ICE candidate from ${senderId} - no remote description yet`);
						// Could implement candidate queueing here if needed
					}
				}
			} catch (err) {
				console.error('Error adding ICE candidate:', err);
			}
		});
		
		socketRef.current.on('user-joined', ({ id, username }) => {
			if (id === socketRef.current.id) return;
			
			console.log(`New user joined: ${id} (${username})`);
			
			// Check if we already have a peer for this user (shouldn't happen, but just in case)
			const existingPeer = peersRef.current.find(p => p.id === id);
			if (existingPeer) {
				console.warn(`Already have a peer for ${id}, not creating a new one`);
				return;
			}
			
			// Create new peer as initiator
			const peer = createPeer(id, true);
			peersRef.current.push({ id, peer, username, hasVideo: true, hasAudio: true });
			setPeers([...peersRef.current]);
		});
		
		socketRef.current.on('user-left', ({ id, username }) => {
			console.log(`User left: ${id} (${username || 'unknown'})`);
			
			// Find the peer
			const peer = peersRef.current.find(p => p.id === id)?.peer;
			
			// Close the peer connection if it exists
			if (peer) {
				peer.close();
			}
			
			// Remove the peer from our list
			peersRef.current = peersRef.current.filter(p => p.id !== id);
			setPeers([...peersRef.current]);
		});
		
		// Enhanced handling of media status changes from other users
		socketRef.current.on('user-media-status-changed', ({ userId, hasAudio, hasVideo }) => {
			// Update the peer's media status in our state with better error handling
			const peerIndex = peersRef.current.findIndex(p => p.id === userId);
			if (peerIndex !== -1) {
				// Update peer state
				peersRef.current[peerIndex].hasAudio = hasAudio;
				peersRef.current[peerIndex].hasVideo = hasVideo;
				
				// Also update the UI for remote videos
				try {
					const remoteVideo = document.getElementById('video-' + userId);
					if (remoteVideo) {
						// Update display style based on video status
						remoteVideo.style.display = hasVideo ? 'block' : 'none';
						console.log(`Updated video display for peer ${userId} to ${hasVideo ? 'visible' : 'hidden'}`);
					}
				} catch (err) {
					console.error('Error updating video element visibility:', err);
				}
				
				// Update peers state
				setPeers([...peersRef.current]);
				console.log(`Peer ${userId} media status updated: audio=${hasAudio}, video=${hasVideo}`);
			} else {
				console.warn(`Received media status update for unknown peer: ${userId}`);
			}
		});

		// Listen for network connection changes
		window.addEventListener('online', () => {
			console.log('Network connection restored');
			if (socketRef.current && !socketRef.current.connected) {
				console.log('Attempting to reconnect socket...');
				socketRef.current.connect();
			}
		});
		
		window.addEventListener('offline', () => {
			console.log('Network connection lost');
			showError('Your internet connection was lost. Please check your connection.', 'error');
		});
		
		// Listen for new socket events for enhanced WebRTC reliability
		socketRef.current.on('peer-unavailable', ({ peerId, reason }) => {
			console.warn(`Peer ${peerId} unavailable: ${reason}`);
			// Clean up any pending connection attempts
			const peerObj = peersRef.current.find(p => p.id === peerId);
			if (peerObj && peerObj.peer && peerObj.peer.connectionState !== 'connected') {
				console.log(`Cleaning up failed connection to ${peerId}`);
				peerObj.peer.close();
				peersRef.current = peersRef.current.filter(p => p.id !== peerId);
				setPeers([...peersRef.current]);
			}
		});
		
		socketRef.current.on('peer-reconnect-requested', ({ peerId, username }) => {
			console.log(`Reconnection requested from ${peerId} (${username})`);
			// Handle reconnection by creating a new peer connection
			const existingPeer = peersRef.current.find(p => p.id === peerId);
			if (existingPeer) {
				console.log(`Closing existing peer connection with ${peerId}`);
				existingPeer.peer.close();
				peersRef.current = peersRef.current.filter(p => p.id !== peerId);
			}
			
			// Create a new peer connection
			const peer = createPeer(peerId, true); // We initiate the new connection
			peersRef.current.push({ id: peerId, peer, username, hasVideo: true, hasAudio: true });
			setPeers([...peersRef.current]);
		});
		
		socketRef.current.on('signaling-success', ({ type, targetId }) => {
			console.log(`Signaling ${type} successfully delivered to ${targetId}`);
		});
		
		socketRef.current.on('peer-connection-status', ({ peerId, status }) => {
			console.log(`Peer ${peerId} connection status: ${status}`);
		});
		
		// Enhanced cleanup function with proper resource management, error handling, and state cleanup
		return () => {
			// Prevent multiple cleanups
			if (isCleanedUp.current) {
				console.log('Cleanup already performed, skipping');
				return;
			}
			isCleanedUp.current = true;
			
			console.log('Cleaning up meeting resources...');
			
			// Clear any pending timeouts
			if (errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current);
				errorTimeoutRef.current = null;
			}
			
			// Clean up network event listeners with proper function references
			window.removeEventListener('online', () => {});
			window.removeEventListener('offline', () => {});
			
			// Clean up heartbeat interval
			clearInterval(heartbeatInterval);
			
			// Notify server that we're leaving the meeting - do this first while connection is still alive
			if (socketRef.current && socketRef.current.connected && meetingId) {
				try {
					console.log('Notifying server about leaving room');
					socketRef.current.emit('leave-room', meetingId);
					
					// Small delay to ensure the message is sent before disconnecting
					setTimeout(() => {
						// Now close all peer connections
						closePeerConnections();
						
						// Stop media tracks
						stopMediaTracks();
						
						// Finally disconnect the socket
						disconnectSocket();
					}, 200);
				} catch (err) {
					console.error('Error notifying server about leaving:', err);
					
					// If notification fails, still do the cleanup
					closePeerConnections();
					stopMediaTracks();
					disconnectSocket();
				}
			} else {
				// If socket isn't connected, just clean up local resources
				closePeerConnections();
				stopMediaTracks();
				disconnectSocket();
			}
			
			console.log('Meeting cleanup process initiated');
		};
		
		// Helper functions for cleanup to keep the code organized
		function closePeerConnections() {
			if (peersRef.current.length > 0) {
				console.log(`Closing ${peersRef.current.length} peer connections`);
				peersRef.current.forEach(peerObj => {
					try {
						if (peerObj && peerObj.peer) {
							// Remove all event listeners to prevent callbacks after cleanup
							peerObj.peer.ontrack = null;
							peerObj.peer.onicecandidate = null;
							peerObj.peer.oniceconnectionstatechange = null;
							peerObj.peer.onsignalingstatechange = null;
							peerObj.peer.onconnectionstatechange = null;
							peerObj.peer.onicegatheringstatechange = null;
							peerObj.peer.onnegotiationneeded = null;
							
							// Close the connection
							peerObj.peer.close();
							console.log(`Closed peer connection to ${peerObj.id}`);
						}
					} catch (err) {
						console.error(`Error closing peer connection to ${peerObj.id}:`, err);
					}
				});
				// Clear the array
				peersRef.current = [];
			}
		}
		
		function stopMediaTracks() {
			if (streamRef.current) {
				const tracks = streamRef.current.getTracks();
				console.log(`Stopping ${tracks.length} media tracks`);
				
				try {
					tracks.forEach(track => {
						try {
							track.stop();
							streamRef.current.removeTrack(track);
							console.log(`Stopped ${track.kind} track: ${track.label}`);
						} catch (trackErr) {
							console.error(`Error stopping track ${track.kind}:`, trackErr);
						}
					});
				} catch (err) {
					console.error('Error stopping media tracks:', err);
				}
				
				// Clear stream reference
				streamRef.current = null;
			}
			
			// Clear video elements
			if (localVideoRef.current) {
				try {
					localVideoRef.current.pause();
					localVideoRef.current.srcObject = null;
					console.log('Cleared local video element');
				} catch (err) {
					console.error('Error clearing local video element:', err);
				}
			}
			
			// Also clear remote video elements
			peersRef.current.forEach(peer => {
				try {
					const remoteVideo = document.getElementById(`video-${peer.id}`);
					if (remoteVideo) {
						remoteVideo.pause();
						remoteVideo.srcObject = null;
					}
				} catch (err) {
					console.error(`Error clearing remote video for peer ${peer.id}:`, err);
				}
			});
		}
		
		function disconnectSocket() {
			if (socketRef.current) {
				try {
					// Remove all listeners to prevent callbacks after cleanup
					socketRef.current.removeAllListeners();
					console.log('Removed all socket listeners');
					
					// Disconnect the socket
					socketRef.current.disconnect();
					console.log('Socket disconnected');
					
					// Clear the reference
					socketRef.current = null;
				} catch (err) {
					console.error('Error disconnecting socket:', err);
				}
			}
		}
	}, [username, meetingId]);

	// Assign local stream to video element when stream is available and ref is ready
	useEffect(() => {
		if (streamRef.current && localVideoRef.current) {
			console.log('Assigning local stream to video element:', streamRef.current);
			localVideoRef.current.srcObject = streamRef.current;
			localVideoRef.current.muted = true;
			localVideoRef.current.autoplay = true;
			localVideoRef.current.playsInline = true;
			
			// Set display style based on video state
			localVideoRef.current.style.display = videoOn ? 'block' : 'none';
			
			localVideoRef.current.onloadedmetadata = () => {
				localVideoRef.current.play().catch((err) => {
					console.error('Video play error:', err);
				});
			};
		}
	}, [streamRef.current, localVideoRef.current, videoOn]);
	
	// Enhanced connection state monitoring and auto-recovery
	useEffect(() => {
		// If we have at least one connected peer, show as connected
		const hasConnectedPeer = peersRef.current.some(
			p => p.peer && p.peer.connectionState === 'connected'
		);
		
		// If we have any connecting peers, show as connecting
		const hasConnectingPeer = peersRef.current.some(
			p => p.peer && ['connecting', 'new'].includes(p.peer.connectionState)
		);
		
		// If we have any failed peers, show as failed
		const hasFailedPeer = peersRef.current.some(
			p => p.peer && ['failed', 'disconnected'].includes(p.peer.connectionState)
		);
		
		// Update UI based on connection states
		if (hasConnectedPeer) {
			setConnectionState('connected');
			setShowReconnectButton(false);
			setError(''); // Clear any connection errors when we have at least one good connection
		} else if (hasConnectingPeer) {
			setConnectionState('connecting');
			setShowReconnectButton(false);
		} else if (hasFailedPeer) {
			setConnectionState('failed');
			setShowReconnectButton(true);
			
			// Auto-attempt reconnection for failed peers
			const attemptReconnection = () => {
				// Find peers that have failed
				const failedPeers = peersRef.current.filter(
					p => p.peer && ['failed', 'disconnected'].includes(p.peer.connectionState)
				);
				
				if (failedPeers.length > 0) {
					console.log(`Attempting auto-reconnection for ${failedPeers.length} failed peers`);
					
					// Try to reconnect each failed peer
					failedPeers.forEach(peerObj => {
						// Request server-assisted reconnection
						if (socketRef.current && socketRef.current.connected) {
							console.log(`Requesting reconnection with peer ${peerObj.id}`);
							socketRef.current.emit('reconnect-peer', { targetId: peerObj.id });
						}
					});
				}
			};
			
			// Attempt reconnection after a short delay (only if we've been in failed state for a while)
			const reconnectionTimer = setTimeout(attemptReconnection, 8000);
			
			// Clean up timer
			return () => clearTimeout(reconnectionTimer);
		}
	}, [peers]);
	
	// Monitor connection health regularly and try to recover
	useEffect(() => {
		// Skip if not initialized
		if (!socketRef.current || !username) return;
		
		const monitorConnections = () => {
			// Ensure we're still connected to signaling server
			if (!socketRef.current.connected) {
				console.log('Socket disconnected, attempting reconnection...');
				socketRef.current.connect();
				return; // Skip peer checks if socket is disconnected
			}
			
			// Check each peer connection
			peersRef.current.forEach(peerObj => {
				if (!peerObj.peer) return;
				
				const { peer, id, username } = peerObj;
				const connectionState = peer.connectionState;
				const iceConnectionState = peer.iceConnectionState;
				
				// Log current state
				console.log(`Peer ${id} (${username}) connection state: ${connectionState}, ICE state: ${iceConnectionState}`);
				
				// Send connection status to server for monitoring
				socketRef.current.emit('connection-status', {
					peerId: id,
					status: connectionState,
					details: {
						iceConnectionState,
						timestamp: Date.now()
					}
				});
				
				// Handle failed connections
				if ((connectionState === 'failed' || connectionState === 'disconnected') && 
					(iceConnectionState === 'failed' || iceConnectionState === 'disconnected')) {
					
					console.log(`Connection with peer ${id} is in a failed state, attempting recovery...`);
					
					// Try to recover with a new peer connection
					socketRef.current.emit('reconnect-peer', { targetId: id });
				}
			});
		};
		
		// Run connection check periodically
		const connectionMonitorTimer = setInterval(monitorConnections, 30000); // Every 30 seconds
		
		// Run once immediately after a short delay
		const initialCheckTimer = setTimeout(monitorConnections, 10000);
		
		// Clean up
		return () => {
			clearInterval(connectionMonitorTimer);
			clearTimeout(initialCheckTimer);
		};
	}, [username]);

	// Create WebRTC peer
	function createPeer(targetId, initiator) {
		console.log(`Creating ${initiator ? 'initiator' : 'receiver'} peer for ${targetId}`);
		
		// Enhanced ICE servers configuration for better connectivity
		const peer = new RTCPeerConnection({ 
			iceServers: [
				// STUN servers for NAT traversal
				{ urls: 'stun:stun.l.google.com:19302' },
				{ urls: 'stun:stun1.l.google.com:19302' },
				{ urls: 'stun:stun2.l.google.com:19302' },
				{ urls: 'stun:stun3.l.google.com:19302' },
				{ urls: 'stun:stun4.l.google.com:19302' },
				{ urls: 'stun:stun.ekiga.net' },
				{ urls: 'stun:stun.ideasip.com' },
				{ urls: 'stun:stun.stunprotocol.org:3478' },
				{ urls: 'stun:stun.voiparound.com' },
				{ urls: 'stun:stun.voipbuster.com' },
				
				// Public TURN servers for fallback when STUN fails
				// These are crucial for users behind symmetric NATs or strict firewalls
				{
					urls: 'turn:openrelay.metered.ca:80',
					username: 'openrelayproject',
					credential: 'openrelayproject'
				},
				{
					urls: 'turn:openrelay.metered.ca:443',
					username: 'openrelayproject',
					credential: 'openrelayproject'
				},
				{
					urls: 'turn:openrelay.metered.ca:443?transport=tcp',
					username: 'openrelayproject',
					credential: 'openrelayproject'
				}
			],
			iceCandidatePoolSize: 10,
			bundlePolicy: 'max-bundle',
			rtcpMuxPolicy: 'require'
		});
		
		// Track connection establishment timeouts
		const connectionTimeoutId = setTimeout(() => {
			if (peer.connectionState !== 'connected' && peer.connectionState !== 'closed') {
				console.warn(`Connection timeout with ${targetId}, connection state: ${peer.connectionState}`);
				// Display connection error
				showError(`Connection timeout with peer. Try refreshing the page.`, 'warning');
			}
		}, 30000); // 30 seconds timeout
		
		// Make sure to add all tracks to the peer connection
		// The tracks might be disabled, but they need to be added to the connection
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => {
				try {
					const sender = peer.addTrack(track, streamRef.current);
					console.log(`Added ${track.kind} track to peer connection: ${track.enabled ? 'enabled' : 'disabled'}`);
				} catch (err) {
					console.error(`Error adding track to peer:`, err);
				}
			});
		} else {
			console.warn('No local stream available to add tracks');
		}
		
		// Enhanced ICE connection state change handling with better monitoring and recovery
		peer.oniceconnectionstatechange = () => {
			console.log(`ICE connection state with ${targetId}: ${peer.iceConnectionState}`);
			
			// Notify server about connection status for monitoring
			try {
				if (socketRef.current && socketRef.current.connected) {
					socketRef.current.emit('connection-status', {
						peerId: targetId,
						status: peer.iceConnectionState,
						details: {
							connectionState: peer.connectionState,
							signalingState: peer.signalingState,
							timestamp: Date.now()
						}
					});
				}
			} catch (err) {
				console.error('Error sending connection status update:', err);
			}
			
			// Handle different ICE states with appropriate recovery strategies
			switch (peer.iceConnectionState) {
				case 'failed':
					console.log(`ICE connection failed with ${targetId}, attempting restart...`);
					
					// Update UI to show connection issue
					showError(`Connection with ${peerUsername || 'peer'} failed. Attempting to reconnect...`, 'warning');
					
					// If we're the initiator, try to restart ICE
					if (initiator) {
						try {
							console.log('Creating offer with ICE restart');
							peer.createOffer({ iceRestart: true })
								.then(offer => peer.setLocalDescription(offer))
								.then(() => {
									console.log(`Sending ICE restart offer to ${targetId}`);
									socketRef.current.emit('offer', { 
										targetId, 
										offer: peer.localDescription,
										offererId: socketRef.current.id,
										offererUsername: username 
									});
								})
								.catch(err => {
									console.error('Error creating ICE restart offer:', err);
									// If ICE restart fails, request a complete reconnection via signaling server
									socketRef.current.emit('reconnect-peer', { targetId });
								});
						} catch (err) {
							console.error('Error restarting ICE:', err);
							// Request a complete reconnection via signaling server as a fallback
							socketRef.current.emit('reconnect-peer', { targetId });
						}
					} else {
						// Non-initiators should wait for reconnection attempt from the other side
						// but can request reconnection after a timeout
						setTimeout(() => {
							if (peer.iceConnectionState === 'failed') {
								console.log('Still failed, requesting reconnection...');
								socketRef.current.emit('reconnect-peer', { targetId });
							}
						}, 8000); // Wait 8 seconds before requesting reconnection
					}
					break;
					
				case 'disconnected':
					console.log(`ICE connection disconnected with ${targetId}, waiting for recovery...`);
					
					// Wait a moment to see if it recovers on its own
					setTimeout(() => {
						if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
							console.log('Still disconnected, attempting ICE restart...');
							
							// Show subtle warning to user
							showError(`Connection with ${peerUsername || 'peer'} unstable. Attempting to reconnect...`, 'info');
							
							if (initiator) {
								try {
									peer.createOffer({ iceRestart: true })
										.then(offer => peer.setLocalDescription(offer))
										.then(() => {
											socketRef.current.emit('offer', { 
												targetId, 
												offer: peer.localDescription,
												offererId: socketRef.current.id,
												offererUsername: username 
											});
										})
										.catch(err => console.error('Error creating ICE restart offer:', err));
								} catch (err) {
									console.error('Error during reconnection attempt:', err);
								}
							}
						}
					}, 5000); // Wait 5 seconds before trying
					break;
					
				case 'connected':
					console.log(`ICE connection established with ${targetId}`);
					// Clear any connection errors
					setError('');
					break;
					
				case 'checking':
					console.log(`ICE connection checking with ${targetId}`);
					// Update UI to show we're trying to connect
					break;
					
				case 'completed':
					console.log(`ICE connection completed with ${targetId} - all candidates have been gathered`);
					setError('');
					break;
			}
		};
		
		// Enhanced connection state changes
		peer.onconnectionstatechange = () => {
			console.log(`Connection state with ${targetId}: ${peer.connectionState}`);
			
			if (peer.connectionState === 'connected') {
				console.log(`Successfully connected to ${targetId}`);
				clearTimeout(connectionTimeoutId);
				setError(''); // Clear any connection errors
			} 
			else if (peer.connectionState === 'failed') {
				console.error(`Connection with ${targetId} failed`);
				showError(`Connection failed. Try refreshing the page.`, 'error');
			}
			else if (peer.connectionState === 'closed') {
				console.log(`Connection with ${targetId} closed`);
				clearTimeout(connectionTimeoutId);
			}
		};
		
		// Log signaling state changes
		peer.onsignalingstatechange = () => {
			console.log(`Signaling state with ${targetId}: ${peer.signalingState}`);
		};
		
		// Monitor ICE gathering state
		peer.onicegatheringstatechange = () => {
			console.log(`ICE gathering state with ${targetId}: ${peer.iceGatheringState}`);
			
			if (peer.iceGatheringState === 'complete') {
				console.log(`Finished gathering ICE candidates for ${targetId}`);
			}
		};
		
		// Enhanced ICE candidate handling with better error reporting
		peer.onicecandidate = e => {
			if (e.candidate) {
				console.log(`Sending ICE candidate to ${targetId} (type: ${e.candidate.type || 'unknown'})`);
				try {
					socketRef.current.emit('ice-candidate', { 
						targetId, 
						candidate: e.candidate,
						senderId: socketRef.current.id
					});
				} catch (err) {
					console.error('Error sending ICE candidate:', err);
				}
			} else {
				console.log(`Finished collecting ICE candidates for ${targetId}`);
			}
		};
		
		// Enhanced track handling with detailed logging and reliability improvements
		peer.ontrack = e => {
			console.log(`Track received from ${targetId}:`, e.streams?.[0]);
			console.log(`Received ${e.streams?.length || 0} streams with ${e.track ? 1 : 0} tracks`);

			// Validate streams
			if (!e.streams || e.streams.length === 0) {
				console.warn(`No streams received from peer ${targetId}`);
				return;
			}

			// Get or find the peer object in our state
			const peerObj = peersRef.current.find(p => p.id === targetId);
			if (!peerObj) {
				console.warn(`Received track for unknown peer: ${targetId}`);
				return;
			}

			// Use the first stream
			let mediaStream = e.streams[0];

			// Log track details and attach event handlers
			e.track.onended = () => {
				console.log(`Track ${e.track.id} from peer ${targetId} ended`);
				if (e.track.kind === 'audio') {
					peerObj.hasAudio = false;
				} else if (e.track.kind === 'video') {
					peerObj.hasVideo = false;
				}
				setPeers([...peersRef.current]);
			};

			e.track.onmute = () => {
				console.log(`Track ${e.track.id} from peer ${targetId} muted`);
				if (e.track.kind === 'audio') {
					peerObj.hasAudio = false;
				} else if (e.track.kind === 'video') {
					peerObj.hasVideo = false;
				}
				setPeers([...peersRef.current]);
			};

			e.track.onunmute = () => {
				console.log(`Track ${e.track.id} from peer ${targetId} unmuted`);
				if (e.track.kind === 'audio') {
					peerObj.hasAudio = true;
				} else if (e.track.kind === 'video') {
					peerObj.hasVideo = true;
				}
				setPeers([...peersRef.current]);
			};

			// Update peer's media status
			if (mediaStream.getAudioTracks().length > 0) {
				peerObj.hasAudio = mediaStream.getAudioTracks().some(t => t.enabled);
			}
			if (mediaStream.getVideoTracks().length > 0) {
				peerObj.hasVideo = mediaStream.getVideoTracks().some(t => t.enabled);
			}
			setPeers([...peersRef.current]);

			// Update video element for this peer
			const remoteVideo = document.getElementById('video-' + targetId);
			if (remoteVideo) {
				remoteVideo.srcObject = mediaStream;
				remoteVideo.style.display = peerObj.hasVideo ? 'block' : 'none';
				remoteVideo.play().catch(err => console.error(`Error playing video for peer ${targetId}:`, err));
			}
		};
		
		// Enhanced negotiation with better error handling and retry
		if (initiator) {
			console.log(`Setting up initiator negotiation for ${targetId}`);
			peer.onnegotiationneeded = async () => {
				try {
					console.log(`Negotiation needed with ${targetId}, creating offer...`);
					
					// Create offer with retry logic
					const createOfferWithRetry = async (retries = 3) => {
						try {
							const offer = await peer.createOffer();
							console.log(`Offer created for ${targetId}`, { 
								type: offer.type, 
								sdpPreview: offer.sdp.substring(0, 100) + '...' 
							});
							
							await peer.setLocalDescription(offer);
							console.log(`Local description set, sending offer to ${targetId}`);
							
							socketRef.current.emit('offer', { 
								targetId, 
								offer: peer.localDescription,
								username 
							});
						} catch (err) {
							console.error(`Error creating/sending offer (attempt ${4 - retries}/3):`, err);
							
							if (retries > 0 && peer.signalingState !== 'closed') {
								console.log(`Retrying offer creation in 2 seconds, ${retries} attempts remaining`);
								setTimeout(() => createOfferWithRetry(retries - 1), 2000);
							} else {
								console.error('Failed to create offer after multiple attempts');
								showError('Failed to establish connection. Please try rejoining the meeting.', 'error');
							}
						}
					};
					
					await createOfferWithRetry();
				} catch (err) {
					console.error('Error during negotiation:', err);
				}
			};
		}
		return peer;
	}

	// Send chat message with enhanced reliability and UX
	function sendMessage() {
		if (input.trim()) {
			try {
				// Store message text before clearing input
				const messageText = input.trim();
				
				// Create a unique message ID with more entropy
				const messageId = `${socketRef.current.id}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
				
				// Create a temporary message object for immediate display
				const tempMessage = {
					id: socketRef.current.id,
					messageId,
					user: username,
					text: messageText,
					timestamp: new Date().toISOString(),
					pending: true,  // Mark as pending until confirmed
					sendAttempts: 1
				};
				
				// Add to local messages immediately for responsive UX
				setMessages(prev => [...prev, tempMessage]);
				
				// Clear input right away for better UX
				setInput('');
				
				// Clear typing indicator
				setIsTyping(false);
				if (socketRef.current) {
					socketRef.current.emit('user-stopped-typing', { meetingId, username });
				}
				
				// Send to server with timeout for error handling
				const sendPromise = new Promise((resolve, reject) => {
					// Set a timeout to detect if confirmation doesn't come back
					const timeoutId = setTimeout(() => {
						reject(new Error('Message sending timed out'));
					}, 10000); // 10 second timeout
					
					// Set up a one-time confirmation handler for this specific message
					socketRef.current.once(`room-message-confirm-${messageId}`, confirmedMsg => {
						clearTimeout(timeoutId); // Clear timeout since we got confirmation
						resolve(confirmedMsg);
					});
					
					// Actually send the message
					socketRef.current.emit('room-message', { 
						meetingId, 
						text: messageText,
						messageId 
					});
				});
				
				// Handle message confirmation or failure
				sendPromise
					.then(confirmedMsg => {
						// Update the pending message to confirmed status
						setMessages(prev => prev.map(msg => 
							msg.messageId === confirmedMsg.messageId 
								? { ...confirmedMsg, pending: false } 
								: msg
						));
					})
					.catch(error => {
						console.error('Error confirming message:', error);
						
						// Update UI to show message failed
						setMessages(prev => prev.map(msg => 
							msg.messageId === messageId
								? { ...msg, pending: false, failed: true } 
								: msg
						));
						
						// Show error to user
						showError('Message may not have been delivered. Network issues detected.', 'warning');
					});
				
				// Set up general confirmation handler if not already set
				if (!socketRef.current._hasMessageConfirmHandler) {
					socketRef.current.on('room-message-confirm', confirmedMsg => {
						// Update the pending message to confirmed status
						setMessages(prev => prev.map(msg => 
							msg.messageId === confirmedMsg.messageId 
								? { ...confirmedMsg, pending: false } 
								: msg
						));
						
						// Also emit specific event for the promise above
						socketRef.current.emit(`room-message-confirm-${confirmedMsg.messageId}`, confirmedMsg);
					});
					socketRef.current._hasMessageConfirmHandler = true;
				}
			} catch (error) {
				console.error('Error sending message:', error);
				showError('Failed to send message. Please try again.', 'error');
			}
		}
	}

	// Toggle mic/video with improved track handling
	function toggleMic() {
		if (!streamRef.current) return;
		
		const enabled = !micOn;
		const audioTracks = streamRef.current.getAudioTracks();
		
		// For microphone, we use enabled property rather than stopping the track
		// This gives better user experience as restarting mic doesn't usually show a UI indicator
		audioTracks.forEach(track => {
			track.enabled = enabled;
			console.log(`Microphone track "${track.label}" set to ${enabled ? 'enabled' : 'disabled'}`);
		});
		
		// Update state and notify peers
		setMicOn(enabled);
		socketRef.current.emit('media-status-changed', { meetingId, hasAudio: enabled, hasVideo: videoOn });
		
		// Also save to localStorage for persistence
		localStorage.setItem('nexus_micPreference', enabled.toString());
	}
	
	function toggleVideo() {
		if (!streamRef.current) return;
		
		const enabled = !videoOn;
		const videoTracks = streamRef.current.getVideoTracks();
		
		if (enabled) {
			// If turning video on, we need to check if we need to restart the camera
			if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
				console.log('Camera needs to be restarted, requesting new media stream');
				
				// Camera was fully stopped, need to get a new stream
				navigator.mediaDevices.getUserMedia({ 
					video: {
						width: { ideal: 1280 },
						height: { ideal: 720 },
						facingMode: 'user'
					}
				})
				.then(videoStream => {
					console.log('New camera stream obtained successfully');
					
					// Add new video tracks to the stream
					videoStream.getVideoTracks().forEach(track => {
						// First stop any existing tracks that might be in ended state
						const existingTracks = streamRef.current.getVideoTracks();
						existingTracks.forEach(oldTrack => {
							streamRef.current.removeTrack(oldTrack);
							oldTrack.stop();
							console.log(`Removed old video track "${oldTrack.label}"`);
						});
						
						// Add the new track
						streamRef.current.addTrack(track);
						console.log(`New video track "${track.label}" added and enabled`);
						
						// Add this track to all peer connections
						peersRef.current.forEach(({ peer }) => {
							if (peer && peer.connectionState !== 'closed') {
								try {
									const sender = peer.getSenders().find(s => 
										s.track && s.track.kind === 'video'
									);
									
									if (sender) {
										// Replace the track in the existing sender
										console.log(`Replacing video track for peer`);
										sender.replaceTrack(track)
											.then(() => console.log('Video track replaced successfully'))
											.catch(err => console.error('Error replacing video track:', err));
									} else {
										// Add as a new track if no sender exists
										console.log(`Adding video track as new track to peer`);
										peer.addTrack(track, streamRef.current);
									}
								} catch (err) {
									console.error('Error updating peer with new video track:', err);
								}
							}
						});
					});
					
					// Make sure local video shows the new track
					if (localVideoRef.current) {
						localVideoRef.current.srcObject = streamRef.current;
						localVideoRef.current.style.display = 'block'; // Ensure video is visible
						
						// Try to play the video
						localVideoRef.current.play()
							.catch(err => console.error('Error playing local video:', err));
					}
					
					// Update UI and notify peers
					setVideoOn(true);
					socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: true });
				})
				.catch(err => {
					console.error("Error restarting camera:", err);
					// Revert UI state if camera can't be restarted
					setVideoOn(false);
					showError('Failed to access camera. Please check your camera permissions.', 'error');
				});
			} else {
				// Camera is just disabled, enable it
				videoTracks.forEach(track => {
					track.enabled = true;
					console.log(`Video track "${track.label}" enabled`);
				});
				
				// Update the UI
				if (localVideoRef.current) {
					localVideoRef.current.style.display = 'block';
				}
				
				// Update state and notify peers
				setVideoOn(true);
				socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: true });
			}
		} else {
			// If turning video off, disable tracks but don't stop them
			// This allows quickly turning video back on without renegotiating
			videoTracks.forEach(track => {
				track.enabled = false;
				console.log(`Video track "${track.label}" disabled`);
			});
			
			// Update the UI
			if (localVideoRef.current) {
				localVideoRef.current.style.display = 'none';
			}
			
			// Update state and notify peers
			setVideoOn(false);
			socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: false });
		}
		
		// Save to localStorage for persistence
		localStorage.setItem('nexus_videoPreference', enabled.toString());
	}

	// Leave meeting with proper cleanup
	function leaveMeeting() {
		console.log("Leaving meeting, cleaning up resources...");
		
		// Notify peers we're leaving
		if (socketRef.current) {
			socketRef.current.emit('leave-room', meetingId);
			// Disconnect from socket to ensure clean termination
			socketRef.current.disconnect();
			console.log("Socket disconnected");
		}
		
		// Properly stop all tracks to release camera/mic
		if (streamRef.current) {
			const tracks = streamRef.current.getTracks();
			tracks.forEach(track => {
				track.stop();
				streamRef.current.removeTrack(track);
				console.log(`Track ${track.kind}: ${track.label} has been stopped and removed`);
			});
			streamRef.current = null;
		}
		
		// Close all peer connections
		peersRef.current.forEach(({ peer }) => {
			if (peer) {
				peer.close();
				console.log("Peer connection closed");
			}
		});
		
		// Clear arrays
		peersRef.current = [];
		setPeers([]);
		
		// Navigate back to dashboard
		navigate('/dashboard');
	}

	if (loading) {
		return (
			<Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#fff', background: 'var(--gradient-primary)' }}>
				<CircularProgress size={60} sx={{ color: 'var(--color-primary)' }} />
				<Typography variant="h6" sx={{ mt: 4, color: 'var(--text-primary)', fontWeight: 500 }}>
					Connecting to meeting...
				</Typography>
				<Typography variant="body2" sx={{ mt: 1, color: 'var(--text-secondary)' }}>
					Setting up your video call
				</Typography>
			</Box>
		);
	}



	return (
		<Box sx={{ height: '100vh', bgcolor: 'var(--gradient-primary)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-primary)' }}>
			{/* Add typing animation styles */}
			<style>{typingAnimationStyles}</style>
			{/* Connection status notification */}
			{connectionState === 'connecting' && (
				<Box sx={{ 
					bgcolor: '#FFF9C4', 
					p: 1, 
					textAlign: 'center',
					borderBottom: '1px solid #FFC107'
				}}>
					<Typography variant="body2">
						Establishing connection to other participants...
						<CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />
					</Typography>
				</Box>
			)}
			
			{connectionState === 'failed' && (
				<Box sx={{ 
					bgcolor: '#FFEBEE', 
					p: 1, 
					textAlign: 'center',
					borderBottom: '1px solid #EF5350'
				}}>
					<Typography variant="body2">
						Connection issues detected. 
						<Button 
							variant="contained" 
							color="error" 
							size="small" 
							sx={{ ml: 1, textTransform: 'none' }}
							onClick={handleReconnect}
						>
							Reconnect
						</Button>
					</Typography>
				</Box>
			)}
			
			{/* Error messages */}
			{error && (
				<Box sx={{ 
					bgcolor: errorSeverity === 'error' ? '#FFEBEE' : 
					         errorSeverity === 'warning' ? '#FFF8E1' : '#E1F5FE', 
					p: 1, 
					textAlign: 'center',
					borderBottom: `1px solid ${
						errorSeverity === 'error' ? '#EF5350' : 
						errorSeverity === 'warning' ? '#FFB74D' : '#4FC3F7'
					}`
				}}>
					<Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{error}
						{errorSeverity === 'error' && (
							<Button 
								variant="contained" 
								color="error" 
							size="small" 
								sx={{ ml: 1, textTransform: 'none' }}
								onClick={() => setError('')}
							>
								Dismiss
							</Button>
						)}
					</Typography>
				</Box>
			)}
			
			{/* Meeting Info */}
			<Box sx={{ 
				p: { xs: 1.5, sm: 2 }, 
				bgcolor: '#fff', 
				color: 'var(--text-primary)', 
				display: 'flex', 
				alignItems: 'center', 
				justifyContent: 'space-between',
				boxShadow: 'var(--shadow-soft)',
				position: 'relative',
				zIndex: 5,
				borderBottom: '1px solid rgba(0,0,0,0.05)'
			}}>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<Typography 
						variant="h6" 
						className="text-gradient" 
						sx={{ 
							fontWeight: 600, 
							fontSize: { xs: '1rem', sm: '1.25rem' },
							display: { xs: 'none', sm: 'block' }
						}}
					>
						Nexus Meet
					</Typography>
					<Box sx={{ 
						display: 'flex', 
						alignItems: 'center', 
						borderLeft: { xs: 'none', sm: '1px solid rgba(0,0,0,0.08)' }, 
						ml: { xs: 0, sm: 2 }, 
						pl: { xs: 0, sm: 2 }
					}}>
						<Typography 
							variant="body2" 
							sx={{ 
								fontFamily: 'monospace', 
								fontWeight: 'bold', 
								color: 'var(--text-secondary)',
								fontSize: { xs: '0.75rem', sm: '0.875rem' }
							}}
						>
							Meeting: {meetingId}
						</Typography>
					</Box>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<Typography 
						variant="body2" 
						sx={{ 
							color: 'var(--text-secondary)', 
							fontWeight: 500,
							display: { xs: 'none', sm: 'block' }
						}}
					>
						{username}
					</Typography>
					<Button 
						variant="outlined" 
						size="small" 
						onClick={leaveMeeting}
						startIcon={<CallEndIcon />}
						sx={{ 
							borderColor: 'var(--color-error)', 
							color: 'var(--color-error)',
							borderRadius: 'var(--button-radius)',
							'&:hover': {
								borderColor: 'var(--color-error)',
								backgroundColor: 'rgba(244, 67, 54, 0.05)'
							},
							display: { xs: 'none', sm: 'flex' }
						}}
					>
						Leave
					</Button>
				</Box>
			</Box>
			{/* Video Grid */}
			<Box sx={{ 
				flex: 1, 
				display: 'flex', 
				flexWrap: 'wrap', 
				gap: { xs: 1, sm: 2, md: 3 }, 
				p: { xs: 1, sm: 2, md: 3 }, 
				alignItems: 'center', 
				justifyContent: 'center', 
				bgcolor: 'rgba(245, 247, 250, 0.5)',
				overflowY: 'auto'
			}}>
				<Paper elevation={2} sx={{ 
					p: { xs: 1, sm: 2 }, 
					bgcolor: '#fff', 
					borderRadius: 'var(--card-radius)',
					boxShadow: 'var(--shadow-soft)',
					position: 'relative',
					overflow: 'hidden',
					width: { xs: '100%', sm: 300, md: 320, lg: 360 },
					maxWidth: '100%',
					display: 'flex',
					flexDirection: 'column'
				}}>
					<div style={{
						width: '100%',
						height: 0,
						paddingBottom: '56.25%' // 16:9 aspect ratio
					}}>
						<video 
							ref={localVideoRef} 
							autoPlay 
							playsInline 
							muted 
							style={{ 
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								height: '100%',
								borderRadius: 8, 
								background: '#000',
								objectFit: 'cover',
								display: videoOn ? 'block' : 'none' // Hide video element when video is off
							}} 
						/>
					</div>
					{!streamRef.current && (
						<Typography variant="body2" sx={{ color: 'var(--color-error)', textAlign: 'center', mt: 2, fontWeight: 500 }}>
							Camera stream not available
						</Typography>
					)}
					<Box sx={{
						position: 'absolute',
						bottom: 8,
						left: 8,
						backgroundColor: 'rgba(0,0,0,0.6)',
						borderRadius: 1,
						px: 1,
						py: 0.5
					}}>
						<Typography variant="caption" sx={{ color: '#fff', fontWeight: 500 }}>
							You {!videoOn && '(video off)'}
						</Typography>
					</Box>
					{/* Enhanced avatar display when video is off */}
					{!videoOn && (
						<Box sx={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							backgroundColor: '#121212', // Dark background for better contrast
							borderRadius: 8,
							height: '100%',
							padding: 2,
							boxSizing: 'border-box',
							overflow: 'hidden'
						}}>
							<Avatar 
								sx={{ 
								 
									width: { xs: 60, sm: 80, md: 100 }, 
									height: { xs: 60, sm: 80, md: 100 },
									bgcolor: 'var(--color-primary)',
									fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
									fontWeight: 'bold',
									border: '3px solid rgba(255,255,255,0.2)',
									boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
									marginBottom: { xs: 1, sm: 2 }
								}}
							>
								{username.charAt(0).toUpperCase()}
							</Avatar>
							<Typography 
								variant="h6"
								noWrap
								sx={{ 
									color: 'white', 
									fontWeight: 'bold',
									textShadow: '0 2px 4px rgba(0,0,0,0.5)',
									fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' },
									maxWidth: '100%',
									textOverflow: 'ellipsis',
									textAlign: 'center'
								}}
							>
								{username}
							</Typography>
							<Typography 
								variant="body2" 
								sx={{ 
									color: 'rgba(255,255,255,0.7)',
									mt: 0.5,
									fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
								}}
							>
								Camera off
							</Typography>
						</Box>
					)}
				</Paper>
				{peers.map(({ id, username: peerUsername, hasVideo }) => (
					<Paper key={id} elevation={2} sx={{ 
						p: { xs: 1, sm: 2 }, 
						bgcolor: '#fff', 
						borderRadius: 'var(--card-radius)',
						boxShadow: 'var(--shadow-soft)',
						position: 'relative',
						overflow: 'hidden',
						width: { xs: '100%', sm: 300, md: 320, lg: 360 },
						maxWidth: '100%',
						display: 'flex',
						flexDirection: 'column'
					}}>
						<div style={{
							width: '100%',
							height: 0,
							paddingBottom: '56.25%' // 16:9 aspect ratio
						}}>
							<video 
								id={'video-' + id} 
								autoPlay 
								playsInline 
								style={{ 
									position: 'absolute',
									top: 0,
									left: 0,
									width: '100%',
									height: '100%',
									borderRadius: 8, 
									background: '#000',
									objectFit: 'cover',
									display: hasVideo === false ? 'none' : 'block'
								}} 
							/>
						</div>
						<Box sx={{
							position: 'absolute',
							bottom: 8,
							left: 8,
							backgroundColor: 'rgba(0,0,0,0.6)',
							borderRadius: 1,
							px: 1,
							py: 0.5
						}}>
							<Typography variant="caption" sx={{ color: '#fff', fontWeight: 500 }}>
								{peerUsername || 'Participant'}
							</Typography>
						</Box>
						
						{/* Avatar for peers with video off */}
						{hasVideo === false && (
							<Box sx={{
								position: 'absolute',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center',
								backgroundColor: '#121212',
								borderRadius: 8,
								height: '100%',
								padding: 2,
								boxSizing: 'border-box',
								overflow: 'hidden'
							}}>
								<Avatar 
									sx={{ 
										width: { xs: 60, sm: 80, md: 100 }, 
										height: { xs: 60, sm: 80, md: 100 },
										bgcolor: 'var(--color-secondary)',
										fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
										fontWeight: 'bold',
										border: '3px solid rgba(255,255,255,0.2)',
										boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
										marginBottom: { xs: 1, sm: 2 }
									}}
								>
									{(peerUsername && peerUsername.charAt(0).toUpperCase()) || 'U'}
								</Avatar>
								<Typography 
									variant="h6" 
									noWrap
									sx={{ 
										color: 'white', 
										fontWeight: 'bold',
										textShadow: '0 2px 4px rgba(0,0,0,0.5)',
										fontSize: { xs: '0.9rem', sm: '1.1rem', md: '1.25rem' },
										maxWidth: '100%',
										textOverflow: 'ellipsis',
										textAlign: 'center'
									}}
								>
									{peerUsername || 'Participant'}
								</Typography>
								<Typography 
									variant="body2" 
									sx={{ 
										color: 'rgba(255,255,255,0.7)',
										mt: 0.5,
										fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' }
									}}
								>
									Camera off
								</Typography>
							</Box>
						)}
					</Paper>
				))}
			</Box>
			{/* Controls */}
			<Box sx={{ 
				display: 'flex', 
				justifyContent: 'center', 
				alignItems: 'center',
				gap: { xs: 1, sm: 2 }, 
				p: { xs: 1.5, sm: 2 }, 
				bgcolor: '#fff',
				boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
				borderTop: '1px solid rgba(0,0,0,0.05)',
				position: 'relative',
				zIndex: 5
			}}>
				<IconButton 
					onClick={toggleMic} 
					sx={{ 
						bgcolor: micOn ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', 
						color: micOn ? 'var(--color-success)' : 'var(--color-error)', 
						borderRadius: 'var(--button-radius)',
						p: { xs: 1, sm: 1.5 }
					}}
				>
					{micOn ? <MicIcon /> : <MicOffIcon />}
				</IconButton>
				<IconButton 
					onClick={toggleVideo} 
					sx={{ 
						bgcolor: videoOn ? 'rgba(33, 150, 243, 0.1)' : 'rgba(255, 152, 0, 0.1)', 
						color: videoOn ? 'var(--color-secondary)' : 'var(--color-warning)', 
						borderRadius: 'var(--button-radius)',
						p: { xs: 1, sm: 1.5 }
					}}
				>
					{videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
				</IconButton>
				<IconButton 
					onClick={leaveMeeting} 
					sx={{ 
						bgcolor: 'rgba(244, 67, 54, 0.1)', 
						color: 'var(--color-error)', 
						borderRadius: 'var(--button-radius)',
						p: { xs: 1, sm: 1.5 }
					}}
				>
					<CallEndIcon />
				</IconButton>
				<IconButton 
					onClick={() => setChatOpen(!chatOpen)} 
					sx={{ 
						bgcolor: chatOpen ? 'rgba(106, 27, 154, 0.1)' : 'rgba(0, 0, 0, 0.05)', 
						color: chatOpen ? 'var(--color-primary)' : 'var(--text-secondary)', 
						borderRadius: 'var(--button-radius)',
						p: { xs: 1, sm: 1.5 }
					}}
				>
					<ChatIcon />
				</IconButton>
				
				{/* Recording Button */}
				<RecordingButton 
					localStream={streamRef.current} 
					peerRefs={peersRef}
					onError={(message) => showError(message, 'error')}
				/>
			</Box>
			{/* Chat Sidebar */}
			{chatOpen && (
				<Box sx={{ 
					position: 'fixed', 
					right: 0, 
					top: 0, 
					width: { xs: '100%', sm: 320 }, 
					height: '100vh', 
					bgcolor: '#fff', 
					boxShadow: 'var(--shadow-strong)', 
					zIndex: 200, 
					display: 'flex', 
					flexDirection: 'column'
				}}>
					<Box sx={{ 
						p: 2, 
						borderBottom: '1px solid rgba(0,0,0,0.1)', 
						bgcolor: 'var(--color-primary)', 
						color: '#fff', 
						display: 'flex', 
						alignItems: 'center', 
						justifyContent: 'space-between'
					}}>
						<Typography variant="subtitle1" fontWeight={600}>Chat</Typography>
						<Button 
							size="small" 
							variant="outlined"
							onClick={() => setChatOpen(false)} 
							sx={{ 
								color: '#fff', 
								borderColor: 'rgba(255,255,255,0.5)',
								'&:hover': {
									borderColor: '#fff',
									backgroundColor: 'rgba(255,255,255,0.1)'
								}
							}}
						>
							Close
						</Button>
					</Box>
					<Box 
						sx={{ 
							flex: 1, 
							overflowY: 'auto', 
							p: 2, 
							bgcolor: 'rgba(245, 247, 250, 0.5)',
							display: 'flex',
							flexDirection: 'column'
						}}
						ref={el => {
							// Auto-scroll to bottom when new messages arrive
							if (el) {
								setTimeout(() => {
									el.scrollTop = el.scrollHeight;
								}, 100);
							}
						}}
					>
						{messages.length === 0 && (
							<Box sx={{ 
								display: 'flex', 
								flexDirection: 'column', 
								alignItems: 'center', 
								justifyContent: 'center',
								height: '100%',
								opacity: 0.7
							}}>
								<Typography variant="body2" color="var(--text-muted)" textAlign="center">
									No messages yet
								</Typography>
								<Typography variant="caption" color="var(--text-muted)" textAlign="center">
									Send a message to start the conversation
								</Typography>
							</Box>
						)}
						
						{messages.map((msg, idx) => {
							const isMyMessage = msg.user === username || msg.id === socketRef.current?.id;
							const isSystemMessage = msg.type === 'system';
							const messageTime = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
							
							// System messages are centered
							if (isSystemMessage) {
								return (
									<Box 
										key={msg.messageId || idx} 
										sx={{ 
											my: 1.5, 
											mx: 'auto',
											maxWidth: '90%', 
											textAlign: 'center' 
										}}
									>
										<Typography 
											variant="caption" 
											sx={{ 
												color: 'var(--text-muted)', 
												fontSize: 12,
												backgroundColor: 'rgba(0,0,0,0.05)',
												py: 0.5,
												px: 1.5,
												borderRadius: 10
											}}
										>
											{msg.text}
										</Typography>
									</Box>
								);
							}
							
							// Regular user messages
							return (
								<Box 
									key={msg.messageId || idx} 
									sx={{ 
										mb: 2, 
										mt: idx > 0 && messages[idx-1].user === msg.user ? 0.5 : 1.5,
										textAlign: isMyMessage ? 'right' : 'left',
										alignSelf: isMyMessage ? 'flex-end' : 'flex-start',
										maxWidth: '85%'
									}}
								>
									{/* Only show username if different from previous message */}
									{(idx === 0 || messages[idx-1].user !== msg.user) && (
										<Typography 
											variant="caption" 
											sx={{ 
												color: 'var(--text-muted)', 
												fontSize: 12, 
												fontWeight: 500,
												display: 'block',
												mb: 0.5,
												ml: isMyMessage ? 0 : 1,
												mr: isMyMessage ? 1 : 0
											}}
										>
											{isMyMessage ? 'You' : msg.user}
										</Typography>
									)}
									
									<Box 
										sx={{
											display: 'flex',
											alignItems: 'flex-end',
											flexDirection: isMyMessage ? 'row-reverse' : 'row'
										}}
									>
										<Paper sx={{ 
											display: 'inline-block', 
											p: 1.5, 
											bgcolor: isMyMessage ? 'rgba(106, 17, 203, 0.05)' : '#fff', 
											color: 'var(--text-primary)', 
											borderRadius: 2,
											borderBottomRightRadius: isMyMessage ? 0 : 2,
											borderBottomLeftRadius: isMyMessage ? 2 : 0,
											maxWidth: '100%', 
											fontSize: 14,
											boxShadow: 'var(--shadow-soft)',
											position: 'relative',
											opacity: msg.pending ? 0.7 : 1,
											border: msg.failed ? '1px solid var(--color-error, #f44336)' : 'none',
											backgroundColor: msg.failed ? 'rgba(244, 67, 54, 0.05)' : (isMyMessage ? 'rgba(106, 17, 203, 0.05)' : '#fff')
										}}>
											{msg.text}
											
											{/* Status indicator for my messages */}
											{isMyMessage && (
												(msg.readReceipts && msg.readReceipts.length > 0) ? (
													<Tooltip 
														title={
															<React.Fragment>
																<Typography variant="caption" sx={{ fontWeight: 500 }}>Read by:</Typography>
																{msg.readReceipts.map((receipt, i) => (
																	<Typography key={i} variant="caption" component="div">
																		{receipt.readBy} at {new Date(receipt.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
																	</Typography>
																))}
															</React.Fragment>
														} 
														arrow
													>
														<Typography 
															component="span"
															variant="caption"
															sx={{ 
																fontSize: '0.6rem',
																color: 'var(--color-success, #4caf50)',
																ml: 1,
																display: 'block',
																textAlign: 'right',
																mt: 0.5,
																cursor: 'help'
															}}
														>
															{messageTime} • read{msg.readReceipts.length > 1 ? ` (${msg.readReceipts.length})` : ''}
														</Typography>
													</Tooltip>
												) : (
													<Typography 
														component="span"
														variant="caption"
														sx={{ 
															fontSize: '0.6rem',
															color: 'var(--text-muted)',
															ml: 1,
															display: 'block',
															textAlign: 'right',
															mt: 0.5
														}}
													>
														{messageTime} {msg.pending ? '• sending...' : 
														msg.failed ? (
															<Box 
																component="span" 
																sx={{ 
																	cursor: 'pointer',
																	color: 'var(--color-error, #f44336)',
																	'&:hover': { textDecoration: 'underline' }
																}}
																onClick={() => {
																	// Retry sending failed message
																	const retryMessage = {...msg, pending: true, failed: false};
																	
																	// Update UI to show message is sending again
																	setMessages(prev => prev.map(m => 
																		m.messageId === msg.messageId ? retryMessage : m
																	));
																	
																	// Send to server again
																	socketRef.current.emit('room-message', { 
																		meetingId, 
																		text: msg.text,
																		messageId: msg.messageId 
																	});
																}}
															>
																• failed • tap to retry
															</Box>
														) : '• sent'}
													</Typography>
												)
											)}
										</Paper>
										
										{/* Time for other people's messages */}
										{!isMyMessage && (
											<Tooltip 
												title={new Date(msg.timestamp).toLocaleString()} 
												arrow
												placement="left"
											>
												<Typography 
													variant="caption"
													sx={{ 
														fontSize: '0.6rem',
														color: 'var(--text-muted)',
														ml: 1,
														mb: 0.5,
														cursor: 'help'
													}}
												>
													{messageTime}
												</Typography>
											</Tooltip>
										)}
									</Box>
								</Box>
							);
						})}
						
						{/* Typing indicator */}
						{typingUsers.length > 0 && (
							<Box 
								sx={{ 
									ml: 2, 
									mb: 2,
									display: 'flex',
									alignItems: 'center'
								}}
							>
								<Box sx={{ 
									display: 'flex',
									gap: 0.3,
									alignItems: 'center',
									py: 0.5,
									px: 1.5,
									borderRadius: 10,
									backgroundColor: 'rgba(0,0,0,0.04)',
								}}>
									<Box className="typing-animation">
										<span></span>
										<span></span>
										<span></span>
									</Box>
									<Typography 
										variant="caption" 
										sx={{ 
											color: 'var(--text-muted)', 
											fontSize: 12,
											fontWeight: 500
										}}
									>
										{typingUsers.length === 1 
											? `${typingUsers[0]} is typing...` 
											: typingUsers.length === 2 
												? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
												: `${typingUsers.length} people are typing...`
										}
									</Typography>
								</Box>
							</Box>
						)}
					</Box>
					<Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Type a message..."
							value={input}
							onChange={e => {
								const newValue = e.target.value;
								setInput(newValue);
								
								// Handle typing indicator
								if (newValue.trim() && !isTyping) {
									setIsTyping(true);
									if (socketRef.current) {
										socketRef.current.emit('user-typing', { meetingId, username });
									}
								} else if (!newValue.trim() && isTyping) {
									setIsTyping(false);
									if (socketRef.current) {
										socketRef.current.emit('user-stopped-typing', { meetingId, username });
									}
								}
							}}
							onKeyDown={e => { 
								if (e.key === 'Enter') {
									sendMessage();
									// Clear typing status
									setIsTyping(false);
									if (socketRef.current) {
										socketRef.current.emit('user-stopped-typing', { meetingId, username });
									}
								}
							}}
							sx={{ 
								borderRadius: 'var(--input-radius)',
								'& .MuiOutlinedInput-root': {
									borderRadius: 'var(--input-radius)',
									backgroundColor: 'rgba(245, 247, 250, 0.8)'
								}
							}}
						/>
						<IconButton 
							color="primary" 
							onClick={sendMessage} 
							sx={{ 
								bgcolor: 'var(--color-primary)', 
								color: 'white', 
								borderRadius: 'var(--button-radius)',
								'&:hover': {
									bgcolor: 'var(--color-secondary)',
								}
							}}
						>
							<ChatIcon />
						</IconButton>
					</Box>
				</Box>
			)}
		</Box>
	);
}
