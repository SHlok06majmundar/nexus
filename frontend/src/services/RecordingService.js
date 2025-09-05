/**
 * RecordingService.js
 * Service to handle screen and audio recording functionality
 */

class RecordingService {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = 0;
    this.elapsedTimeCallback = null;
    this.timeInterval = null;
  }

  /**
   * Start recording with screen capture and audio
   * @param {MediaStream} audioStream - The audio stream from the meeting
   * @param {Function} onElapsedTimeUpdate - Callback to update elapsed time display
   * @returns {Promise<boolean>} - True if recording started successfully
   */
  async startRecording(audioStream, onElapsedTimeUpdate) {
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
        audio: true // Try to capture system audio as well
      });
      
      console.log('Screen capture permission granted');
      
      // Create a new stream that combines screen capture and audio
      const tracks = [...screenStream.getTracks()];
      
      // Add audio tracks from the meeting
      if (audioStream) {
        const audioTracks = audioStream.getAudioTracks();
        tracks.push(...audioTracks);
      }
      
      // Create a combined stream
      this.stream = new MediaStream(tracks);
      
      // Set up the media recorder with options for better quality
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
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
        
        // Stop all tracks
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        
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
