/**
 * RecordingService.js
 * Service to handle screen and audio recording functionality
 */

class RecordingService {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.audioContext = null;
    this.audioDestination = null;
    this.audioSources = [];
    this.isRecording = false;
    this.startTime = 0;
    this.elapsedTimeCallback = null;
    this.timeInterval = null;
  }

  /**
   * Start recording with screen capture and audio
   * @param {MediaStream} audioStream - The local audio stream from the meeting
   * @param {Function} onElapsedTimeUpdate - Callback to update elapsed time display
   * @param {Array} peerRefs - Optional reference to peer connections for capturing remote audio
   * @returns {Promise<boolean>} - True if recording started successfully
   */
  async startRecording(audioStream, onElapsedTimeUpdate, peerRefs = []) {
    try {
      if (this.isRecording) return false;
      
      console.log('Requesting screen capture permission...');
      
      // Request screen capture from the user
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
          logicalSurface: true,
          frameRate: 30
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } // Try to capture system audio with better settings
      });
      
      console.log('Screen capture permission granted');

      // Create an audio context to mix all audio streams
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      this.audioSources = [];
      
      // Add screen audio if available
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        console.log('Screen audio tracks found:', screenAudioTracks.length);
        const screenAudioSource = this.audioContext.createMediaStreamSource(new MediaStream([screenAudioTracks[0]]));
        screenAudioSource.connect(this.audioDestination);
        this.audioSources.push(screenAudioSource);
      } else {
        console.log('No screen audio tracks available');
      }
      
      // Add local audio track if available
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        console.log('Local audio track found, adding to mix');
        const localAudioSource = this.audioContext.createMediaStreamSource(new MediaStream([audioStream.getAudioTracks()[0]]));
        localAudioSource.connect(this.audioDestination);
        this.audioSources.push(localAudioSource);
      } else {
        console.log('No local audio tracks available');
      }
      
      // Collect video tracks for the final stream
      const videoTracks = screenStream.getVideoTracks();
      
      // Try to add remote peer audio tracks if available
      if (peerRefs && typeof peerRefs === 'object') {
        console.log(`Attempting to capture audio from peer connections`);
        
        // Process each peer connection to extract audio
        if (Array.isArray(peerRefs.current)) {
          peerRefs.current.forEach((peerObj, index) => {
            try {
              if (peerObj && peerObj.peer && typeof peerObj.peer.getReceivers === 'function') {
                // Get all receivers from the peer connection
                const receivers = peerObj.peer.getReceivers();
                
                // Filter for audio receivers only
                const audioReceivers = receivers.filter(receiver => 
                  receiver.track && receiver.track.kind === 'audio' && receiver.track.readyState === 'live'
                );
                
                if (audioReceivers.length > 0) {
                  console.log(`Found ${audioReceivers.length} audio tracks from peer ${peerObj.id || index}`);
                  
                  // Create a stream from each audio track and connect to the audio destination
                  audioReceivers.forEach(receiver => {
                    try {
                      // Create a stream with just this track
                      const remoteStream = new MediaStream([receiver.track]);
                      const remoteSource = this.audioContext.createMediaStreamSource(remoteStream);
                      
                      // Connect to the audio destination
                      remoteSource.connect(this.audioDestination);
                      this.audioSources.push(remoteSource);
                      
                      console.log(`Successfully added remote audio track: ${receiver.track.id}`);
                    } catch (trackErr) {
                      console.error(`Error adding remote track to audio mix:`, trackErr);
                    }
                  });
                } else {
                  console.log(`No audio tracks found from peer ${peerObj.id || index}`);
                }
              }
            } catch (peerErr) {
              console.error(`Error accessing peer ${peerObj.id || index}:`, peerErr);
            }
          });
        }
      } else {
        console.log('No peer references provided for audio capture');
      }
      
      // Create the final media stream with video from screen and mixed audio
      const finalTracks = [
        ...videoTracks,                             // Screen video track(s)
        ...this.audioDestination.stream.getAudioTracks()  // Mixed audio track
      ];
      
      // Create the combined stream for recording
      this.stream = new MediaStream(finalTracks);
      
      // Log what we're recording
      console.log(`Recording stream created with ${videoTracks.length} video tracks and ${this.audioDestination.stream.getAudioTracks().length} audio tracks`);
      
      // Try to find the best supported codec options
      let options;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus', audioBitsPerSecond: 128000, videoBitsPerSecond: 2500000 };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus', audioBitsPerSecond: 128000, videoBitsPerSecond: 2500000 };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) {
        options = { mimeType: 'video/webm;codecs=h264,opus', audioBitsPerSecond: 128000, videoBitsPerSecond: 2500000 };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm', audioBitsPerSecond: 128000, videoBitsPerSecond: 2500000 };
      }
      
      // Set up the media recorder with the best options
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      // Track when screen sharing is stopped by the user
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing stopped by user');
        this.stopRecording();
      };
      
      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.startTime = Date.now();
      this.elapsedTimeCallback = onElapsedTimeUpdate;
      
      // Start the timer to update elapsed time
      this.timeInterval = setInterval(() => {
        if (this.elapsedTimeCallback) {
          const elapsed = Date.now() - this.startTime;
          this.elapsedTimeCallback(this.formatElapsedTime(elapsed));
        }
      }, 1000);
      
      console.log('Recording started successfully');
      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      return false;
    }
  }
  
  /**
   * Stop the current recording
   * @returns {Promise<Blob|null>} The recorded blob or null if no recording
   */
  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(null);
        return;
      }
      
      // Stop the media recorder
      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing...');
        
        // Clear the timer
        clearInterval(this.timeInterval);
        this.timeInterval = null;
        
        // Create a blob from the recorded chunks
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        
        // Reset recording state
        this.recordedChunks = [];
        this.isRecording = false;
        
        // Clean up audio context resources
        if (this.audioSources && this.audioSources.length > 0) {
          this.audioSources.forEach(source => {
            try {
              source.disconnect();
            } catch (err) {
              console.error('Error disconnecting audio source:', err);
            }
          });
          this.audioSources = [];
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
          try {
            this.audioContext.close().then(() => {
              console.log('Audio context closed successfully');
            }).catch(err => {
              console.error('Error closing audio context:', err);
            });
          } catch (err) {
            console.error('Error closing audio context:', err);
            // Try without promise in case browser doesn't support it
            try {
              this.audioContext.close();
            } catch (e) {}
          }
          this.audioContext = null;
          this.audioDestination = null;
        }
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        console.log('Recording processed successfully');
        resolve(blob);
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  /**
   * Format milliseconds to MM:SS display
   * @param {number} ms - Milliseconds elapsed
   * @returns {string} Formatted time as MM:SS
   */
  formatElapsedTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Check if recording is currently active
   * @returns {boolean} True if recording is active
   */
  isActive() {
    return this.isRecording;
  }
  
  /**
   * Download the recorded video
   * @param {Blob} blob - The recorded video blob
   * @param {string} filename - Optional filename for the download
   */
  downloadRecording(blob, filename = 'nexus-meeting-recording.webm') {
    if (!blob) return;
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    // Trigger download
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}

export default RecordingService;
