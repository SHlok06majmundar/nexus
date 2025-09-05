/**
 * TranscriptionService.js
 * Service to handle real-time speech-to-text transcription
 */

class TranscriptionService {
  constructor() {
    this.recognition = null;
    this.isTranscribing = false;
    this.transcripts = [];
    this.currentSpeakerId = null;
    this.currentSpeakerName = null;
    this.onTranscriptCallback = null;
    this.onErrorCallback = null;
    this.supportedLanguages = [
      // English variants
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'en-IN', name: 'English (India)' },
      { code: 'en-AU', name: 'English (Australia)' },
      { code: 'en-CA', name: 'English (Canada)' },
      
      // Indian languages
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'gu-IN', name: 'Gujarati' },
      { code: 'mr-IN', name: 'Marathi' },
      { code: 'ta-IN', name: 'Tamil' },
      { code: 'te-IN', name: 'Telugu' },
      { code: 'kn-IN', name: 'Kannada' },
      { code: 'ml-IN', name: 'Malayalam' },
      { code: 'pa-Guru-IN', name: 'Punjabi' },
      { code: 'bn-IN', name: 'Bengali' },
      { code: 'ur-IN', name: 'Urdu' },
      
      // European languages
      { code: 'es-ES', name: 'Spanish' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'nl-NL', name: 'Dutch' },
      { code: 'pl-PL', name: 'Polish' },
      { code: 'sv-SE', name: 'Swedish' },
      
      // Asian languages
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'th-TH', name: 'Thai' },
      { code: 'vi-VN', name: 'Vietnamese' },
      { code: 'id-ID', name: 'Indonesian' },
      { code: 'ms-MY', name: 'Malay' },
    ];
    this.currentLanguage = 'en-US';
    
    // Check if speech recognition is supported
    this.isSupported = 'webkitSpeechRecognition' in window || 
                      'SpeechRecognition' in window;
  }

  /**
   * Initialize the speech recognition service
   */
  initialize() {
    if (!this.isSupported) {
      console.error('Speech recognition is not supported in this browser');
      return false;
    }
    
    // Create speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLanguage;
    
    // Set up event handlers
    this.recognition.onstart = () => {
      console.log('Transcription started');
    };
    
    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      // Only process if we have a current speaker
      if (this.currentSpeakerId && this.currentSpeakerName) {
        // Check if we need to create a new transcript or update existing one
        const existingIndex = this.transcripts.findIndex(t => 
          t.speakerId === this.currentSpeakerId && t.isFinal === false);
        
        if (existingIndex >= 0) {
          // Update existing interim transcript
          this.transcripts[existingIndex].text = transcript;
          
          // Check if the result is final
          if (event.results[0].isFinal) {
            this.transcripts[existingIndex].isFinal = true;
            
            // Add timestamp when finalized
            this.transcripts[existingIndex].endTime = new Date().toISOString();
          }
        } else {
          // Create a new transcript entry
          const newTranscript = {
            id: `transcript-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            speakerId: this.currentSpeakerId,
            speakerName: this.currentSpeakerName,
            text: transcript,
            isFinal: event.results[0].isFinal,
            startTime: new Date().toISOString(),
            endTime: event.results[0].isFinal ? new Date().toISOString() : null
          };
          
          this.transcripts.push(newTranscript);
        }
        
        // Notify listeners
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(this.transcripts);
        }
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Transcription error:', event.error);
      
      if (this.onErrorCallback) {
        this.onErrorCallback(`Transcription error: ${event.error}`);
      }
      
      // Try to restart if it was a temporary error
      if (event.error === 'network' || event.error === 'service-not-allowed') {
        this.restartRecognition();
      }
    };
    
    this.recognition.onend = () => {
      console.log('Transcription ended');
      
      // Restart if we're still supposed to be transcribing
      if (this.isTranscribing) {
        this.restartRecognition();
      }
    };
    
    return true;
  }
  
  /**
   * Start the transcription process
   * @param {string} speakerId - ID of the current speaker
   * @param {string} speakerName - Name of the current speaker
   * @param {Function} onTranscript - Callback for transcript updates
   * @param {Function} onError - Callback for errors
   */
  startTranscription(speakerId, speakerName, onTranscript, onError) {
    // Initialize if not already done
    if (!this.recognition && !this.initialize()) {
      if (onError) onError('Speech recognition is not supported in this browser');
      return false;
    }
    
    // Set current speaker
    this.currentSpeakerId = speakerId;
    this.currentSpeakerName = speakerName;
    
    // Set callbacks
    this.onTranscriptCallback = onTranscript;
    this.onErrorCallback = onError;
    
    // Start recognition
    try {
      this.recognition.start();
      this.isTranscribing = true;
      return true;
    } catch (err) {
      console.error('Error starting transcription:', err);
      if (onError) onError(`Failed to start transcription: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Stop the transcription process
   */
  stopTranscription() {
    if (this.recognition) {
      this.isTranscribing = false;
      
      try {
        this.recognition.stop();
      } catch (err) {
        console.error('Error stopping transcription:', err);
      }
      
      // Finalize any remaining interim results
      this.transcripts = this.transcripts.map(transcript => {
        if (!transcript.isFinal) {
          return {
            ...transcript,
            isFinal: true,
            endTime: new Date().toISOString()
          };
        }
        return transcript;
      });
      
      // Notify listeners of final state
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(this.transcripts);
      }
    }
  }
  
  /**
   * Restart recognition after an error or timeout
   */
  restartRecognition() {
    if (this.isTranscribing) {
      try {
        setTimeout(() => {
          console.log('Restarting transcription...');
          this.recognition.start();
        }, 1000);
      } catch (err) {
        console.error('Error restarting transcription:', err);
      }
    }
  }
  
  /**
   * Set the active speaker for transcription
   * @param {string} speakerId - ID of the current speaker
   * @param {string} speakerName - Name of the current speaker
   */
  setActiveSpeaker(speakerId, speakerName) {
    this.currentSpeakerId = speakerId;
    this.currentSpeakerName = speakerName;
  }
  
  /**
   * Change the recognition language
   * @param {string} languageCode - Language code (e.g. 'en-US')
   */
  setLanguage(languageCode) {
    if (this.supportedLanguages.some(lang => lang.code === languageCode)) {
      this.currentLanguage = languageCode;
      
      if (this.recognition) {
        this.recognition.lang = languageCode;
        
        // Restart if currently running
        if (this.isTranscribing) {
          this.stopTranscription();
          setTimeout(() => this.startTranscription(
            this.currentSpeakerId, 
            this.currentSpeakerName, 
            this.onTranscriptCallback, 
            this.onErrorCallback
          ), 100);
        }
      }
      
      return true;
    }
    return false;
  }
  
  /**
   * Get all transcripts
   * @returns {Array} Array of transcript objects
   */
  getAllTranscripts() {
    return [...this.transcripts];
  }
  
  /**
   * Clear all transcripts
   */
  clearTranscripts() {
    this.transcripts = [];
    
    if (this.onTranscriptCallback) {
      this.onTranscriptCallback(this.transcripts);
    }
  }
  
  /**
   * Export transcripts to a file
   * @param {string} format - Export format (txt, json, pdf)
   * @returns {Blob|Promise<Blob>} Blob containing the exported data
   */
  exportTranscripts(format = 'txt') {
    if (this.transcripts.length === 0) return null;
    
    if (format === 'json') {
      const jsonData = JSON.stringify(this.transcripts, null, 2);
      return new Blob([jsonData], { type: 'application/json' });
    } else if (format === 'pdf') {
      // Return a promise for PDF generation since it might be async with jsPDF
      return this.generatePDF();
    } else {
      // Default to text format
      let textContent = 'Meeting Transcription\n';
      textContent += '====================\n\n';
      
      // Group transcripts by date
      const transcriptsByDate = this.groupTranscriptsByDate();
      
      Object.entries(transcriptsByDate).forEach(([date, dailyTranscripts]) => {
        textContent += `${date}\n`;
        textContent += '-'.repeat(date.length) + '\n\n';
        
        dailyTranscripts.forEach(transcript => {
          if (transcript.isFinal) {
            const time = new Date(transcript.startTime).toLocaleTimeString();
            textContent += `[${time}] ${transcript.speakerName}: ${transcript.text}\n`;
          }
        });
        textContent += '\n';
      });
      
      return new Blob([textContent], { type: 'text/plain' });
    }
  }
  
  /**
   * Generate a PDF document from transcripts
   * @returns {Promise<Blob>} Promise resolving to PDF blob
   */
  async generatePDF() {
    // Check if we need to load libraries
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      // Load PDF libraries dynamically
      try {
        await this.loadPdfLibraries();
      } catch (err) {
        console.error('Failed to load PDF generation libraries', err);
        // Fall back to text export if PDF generation fails
        return this.exportTranscripts('txt');
      }
    }
    
    // Wait a moment to ensure libraries are initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return new Promise((resolve) => {
      try {
        // Create temporary element to render the transcript content
        const tempEl = document.createElement('div');
        tempEl.style.position = 'absolute';
        tempEl.style.left = '-9999px';
        tempEl.style.top = '0';
        tempEl.style.width = '800px';
        document.body.appendChild(tempEl);
        
        // Style the PDF content
        tempEl.innerHTML = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h1 style="text-align: center; color: #4527a0;">Meeting Transcription</h1>
            <p style="text-align: center; color: #666; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <div id="transcription-content"></div>
          </div>
        `;
        
        const contentEl = tempEl.querySelector('#transcription-content');
        
        // Group transcripts by date for better organization
        const transcriptsByDate = this.groupTranscriptsByDate();
        
        Object.entries(transcriptsByDate).forEach(([date, dailyTranscripts]) => {
          const dateDiv = document.createElement('div');
          dateDiv.style.marginBottom = '20px';
          
          dateDiv.innerHTML = `
            <h2 style="color: #4527a0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${date}</h2>
          `;
          
          const transcriptsUl = document.createElement('ul');
          transcriptsUl.style.listStyle = 'none';
          transcriptsUl.style.padding = '0';
          
          dailyTranscripts.forEach(transcript => {
            if (transcript.isFinal) {
              const time = new Date(transcript.startTime).toLocaleTimeString();
              const li = document.createElement('li');
              li.style.marginBottom = '10px';
              li.style.paddingLeft = '10px';
              li.style.borderLeft = '3px solid #e1bee7';
              
              li.innerHTML = `
                <p style="margin: 0;">
                  <strong style="color: #512da8;">${transcript.speakerName}</strong>
                  <span style="color: #9e9e9e; font-size: 0.8em;"> - ${time}</span>
                </p>
                <p style="margin: 5px 0 0 0; color: #424242;">${transcript.text}</p>
              `;
              
              transcriptsUl.appendChild(li);
            }
          });
          
          dateDiv.appendChild(transcriptsUl);
          contentEl.appendChild(dateDiv);
        });
        
        // Use html2canvas to convert HTML to image for PDF
        window.html2canvas(tempEl).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          
          // Initialize PDF
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          // Calculate dimensions
          const imgProps = doc.getImageProperties(imgData);
          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          // Add image to PDF (possibly multiple pages)
          let heightLeft = pdfHeight;
          let position = 0;
          let page = 1;
          
          doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= doc.internal.pageSize.getHeight();
          
          // Add more pages if content overflows
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= doc.internal.pageSize.getHeight();
            page++;
          }
          
          // Add page numbers
          const pageCount = doc.internal.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, {
              align: 'center'
            });
          }
          
          // Create blob from PDF
          const pdfBlob = doc.output('blob');
          
          // Clean up temporary element
          document.body.removeChild(tempEl);
          
          resolve(pdfBlob);
        }).catch(err => {
          console.error('Error in html2canvas:', err);
          // Fall back to text export
          resolve(this.exportTranscripts('txt'));
        });
      } catch (err) {
        console.error('Error generating PDF', err);
        // Fall back to text export
        resolve(this.exportTranscripts('txt'));
      }
    });
  }
  
  /**
   * Load the necessary libraries for PDF generation
   * @returns {Promise<void>} Promise that resolves when libraries are loaded
   */
  async loadPdfLibraries() {
    // Helper function to load a script
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };
    
    // Load jsPDF and html2canvas
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    ]);
    
    // Wait a moment to ensure libraries are initialized
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return new Promise((resolve) => {
      try {
        // Create temporary element to render the transcript content
        const tempEl = document.createElement('div');
        tempEl.style.position = 'absolute';
        tempEl.style.left = '-9999px';
        tempEl.style.top = '0';
        tempEl.style.width = '800px';
        document.body.appendChild(tempEl);
        
        // Style the PDF content
        tempEl.innerHTML = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h1 style="text-align: center; color: #4527a0;">Meeting Transcription</h1>
            <p style="text-align: center; color: #666; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <div id="transcription-content"></div>
          </div>
        `;
        
        const contentEl = tempEl.querySelector('#transcription-content');
        
        // Group transcripts by date for better organization
        const transcriptsByDate = this.groupTranscriptsByDate();
        
        Object.entries(transcriptsByDate).forEach(([date, dailyTranscripts]) => {
          const dateDiv = document.createElement('div');
          dateDiv.style.marginBottom = '20px';
          
          dateDiv.innerHTML = `
            <h2 style="color: #4527a0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">${date}</h2>
          `;
          
          const transcriptsUl = document.createElement('ul');
          transcriptsUl.style.listStyle = 'none';
          transcriptsUl.style.padding = '0';
          
          dailyTranscripts.forEach(transcript => {
            if (transcript.isFinal) {
              const time = new Date(transcript.startTime).toLocaleTimeString();
              const li = document.createElement('li');
              li.style.marginBottom = '10px';
              li.style.paddingLeft = '10px';
              li.style.borderLeft = '3px solid #e1bee7';
              
              li.innerHTML = `
                <p style="margin: 0;">
                  <strong style="color: #512da8;">${transcript.speakerName}</strong>
                  <span style="color: #9e9e9e; font-size: 0.8em;"> - ${time}</span>
                </p>
                <p style="margin: 5px 0 0 0; color: #424242;">${transcript.text}</p>
              `;
              
              transcriptsUl.appendChild(li);
            }
          });
          
          dateDiv.appendChild(transcriptsUl);
          contentEl.appendChild(dateDiv);
        });
        
        // Use html2canvas to convert HTML to image for PDF
        window.html2canvas(tempEl).then(canvas => {
          const imgData = canvas.toDataURL('image/png');
          
          // Initialize PDF
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });
          
          // Calculate dimensions
          const imgProps = doc.getImageProperties(imgData);
          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          // Add image to PDF (possibly multiple pages)
          let heightLeft = pdfHeight;
          let position = 0;
          let page = 1;
          
          doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= doc.internal.pageSize.getHeight();
          
          // Add more pages if content overflows
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= doc.internal.pageSize.getHeight();
            page++;
          }
          
          // Add page numbers
          const pageCount = doc.internal.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, {
              align: 'center'
            });
          }
          
          // Create blob from PDF
          const pdfBlob = doc.output('blob');
          
          // Clean up temporary element
          document.body.removeChild(tempEl);
          
          resolve(pdfBlob);
        });
      } catch (err) {
        console.error('Error generating PDF', err);
        // Fall back to text export
        resolve(this.exportTranscripts('txt'));
      }
    });
  }
  
  /**
   * Group transcripts by date for better organization
   * @returns {Object} Map of dates to transcript arrays
   */
  groupTranscriptsByDate() {
    const transcriptsByDate = {};
    
    this.transcripts.forEach(transcript => {
      if (transcript.isFinal) {
        const date = new Date(transcript.startTime).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        if (!transcriptsByDate[date]) {
          transcriptsByDate[date] = [];
        }
        
        transcriptsByDate[date].push(transcript);
      }
    });
    
    return transcriptsByDate;
  }
  
  /**
   * Check if transcription is currently active
   * @returns {boolean} True if transcription is active
   */
  isActive() {
    return this.isTranscribing;
  }
  
  /**
   * Check if speech recognition is supported in this browser
   * @returns {boolean} True if supported
   */
  isSpeechRecognitionSupported() {
    return this.isSupported;
  }
}

export default TranscriptionService;
