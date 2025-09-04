import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
	Box, Typography, Button, TextField, IconButton, Paper, CircularProgress, Avatar
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
				// Apply initial mic preference
				stream.getAudioTracks().forEach(track => track.enabled = micOn);
				
				// For video, if initially off, disable tracks but don't stop them
				stream.getVideoTracks().forEach(track => {
					track.enabled = videoOn;
					console.log(`Initial video state: Video track "${track.label}" ${videoOn ? 'enabled' : 'disabled'}`);
				});
				
				streamRef.current = stream;
				setLoading(false);
				socketRef.current.emit('join-room', { meetingId, username });
				
				// Notify other users of our initial media state
				socketRef.current.emit('media-status-changed', { 
					meetingId, 
					hasAudio: micOn, 
					hasVideo: videoOn 
				});
			})
			.catch((err) => {
				console.error('Media access error:', err);
				setLoading(false);
				alert('Could not access camera/microphone');
			});

		// Socket events
		socketRef.current.on('room-message', msg => {
			setMessages(prev => [...prev, msg]);
		});

		// WebRTC signaling
		socketRef.current.on('offer', async ({ offer, offererId, offererUsername }) => {
			const peer = createPeer(offererId, false);
			peersRef.current.push({ id: offererId, peer, username: offererUsername, hasVideo: true, hasAudio: true });
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
		socketRef.current.on('user-joined', ({ id, username }) => {
			if (id === socketRef.current.id) return;
			const peer = createPeer(id, true);
			peersRef.current.push({ id, peer, username, hasVideo: true, hasAudio: true });
			setPeers([...peersRef.current]);
		});
		socketRef.current.on('user-left', ({ id }) => {
			peersRef.current = peersRef.current.filter(p => p.id !== id);
			setPeers([...peersRef.current]);
		});
		// Listen for media status changes
		socketRef.current.on('user-media-status-changed', ({ userId, hasAudio, hasVideo }) => {
			// Update the peer's media status in our state
			const peerIndex = peersRef.current.findIndex(p => p.id === userId);
			if (peerIndex !== -1) {
				peersRef.current[peerIndex].hasAudio = hasAudio;
				peersRef.current[peerIndex].hasVideo = hasVideo;
				setPeers([...peersRef.current]);
				console.log(`Peer ${userId} media status updated: audio=${hasAudio}, video=${hasVideo}`);
			}
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
			
			// Set display style based on video state
			localVideoRef.current.style.display = videoOn ? 'block' : 'none';
			
			localVideoRef.current.onloadedmetadata = () => {
				localVideoRef.current.play().catch((err) => {
					console.error('Video play error:', err);
				});
			};
		}
	}, [streamRef.current, localVideoRef.current, videoOn]);

	// Create WebRTC peer
	function createPeer(targetId, initiator) {
		const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
		
		// Make sure to add all tracks to the peer connection
		// The tracks might be disabled, but they need to be added to the connection
		if (streamRef.current) {
			streamRef.current.getTracks().forEach(track => {
				peer.addTrack(track, streamRef.current);
				console.log(`Added ${track.kind} track to peer connection: ${track.enabled ? 'enabled' : 'disabled'}`);
			});
		}
		
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
				socketRef.current.emit('offer', { targetId, offer, username });
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
			// If turning video on, we need to restart the camera
			if (videoTracks.length === 0 || videoTracks[0].readyState === 'ended') {
				// Camera was fully stopped, need to get a new stream
				navigator.mediaDevices.getUserMedia({ video: true })
					.then(videoStream => {
						// Add new video tracks to the stream
						videoStream.getVideoTracks().forEach(track => {
							streamRef.current.addTrack(track);
							console.log(`New video track "${track.label}" added and enabled`);
							
							// Add this track to all peer connections
							peersRef.current.forEach(({ peer }) => {
								if (peer) {
									peer.addTrack(track, streamRef.current);
								}
							});
						});
						
						// Make sure local video shows the new track
						if (localVideoRef.current) {
							localVideoRef.current.srcObject = streamRef.current;
						}
						
						// Update UI and notify peers
						setVideoOn(true);
						socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: true });
					})
					.catch(err => {
						console.error("Error restarting camera:", err);
						// Revert UI state if camera can't be restarted
						setVideoOn(false);
					});
			} else {
				// Camera is just disabled, enable it
				videoTracks.forEach(track => {
					track.enabled = true;
					console.log(`Video track "${track.label}" enabled`);
				});
				
				// Update state and notify peers
				setVideoOn(true);
				socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: true });
			}
		} else {
			// If turning video off, disable but don't stop tracks
			// This way the camera indicator will remain on but video won't be sent
			videoTracks.forEach(track => {
				track.enabled = false;
				console.log(`Video track "${track.label}" disabled`);
			});
			
			// Update state and notify peers
			setVideoOn(false);
			socketRef.current.emit('media-status-changed', { meetingId, hasAudio: micOn, hasVideo: false });
		}
		
		// Also save to localStorage for persistence
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
						paddingBottom: '56.25%', // 16:9 aspect ratio
						position: 'relative'
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
							paddingBottom: '56.25%', // 16:9 aspect ratio
							position: 'relative'
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
					<Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'rgba(245, 247, 250, 0.5)' }}>
						{messages.map((msg, idx) => (
							<Box key={idx} sx={{ mb: 2, textAlign: msg.user === username ? 'right' : 'left' }}>
								<Typography variant="caption" sx={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>
									{msg.user}
								</Typography>
								<Paper sx={{ 
									display: 'inline-block', 
									p: 1.5, 
									bgcolor: msg.user === username ? 'rgba(106, 17, 203, 0.05)' : '#fff', 
									color: 'var(--text-primary)', 
									borderRadius: 2, 
									maxWidth: '85%', 
									fontSize: 14,
									boxShadow: 'var(--shadow-soft)'
								}}>
									{msg.text}
								</Paper>
							</Box>
						))}
					</Box>
					<Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
						<TextField
							fullWidth
							variant="outlined"
							size="small"
							placeholder="Type a message..."
							value={input}
							onChange={e => setInput(e.target.value)}
							onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
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
