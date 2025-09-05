# Live Transcription Feature

This feature provides real-time speech-to-text transcription during Nexus Meet video calls, displaying captions with speaker names.

## Features

- Real-time speech-to-text conversion
- Speaker identification for each transcribed segment
- Extensive language support (including Indian languages like Gujarati, Marathi, Tamil, etc.)
- Transcript export in multiple formats (TXT, JSON, PDF)
- Professional PDF export with formatting for meeting minutes
- Transcript clearing and management
- Accessible transcript history in a side panel

## Implementation Details

The transcription functionality is implemented in two main components:

1. **TranscriptionService.js**: A service class that handles:
   - Speech recognition using the Web Speech API
   - Speaker tracking and identification
   - Transcript management and storage
   - Language selection and configuration
   - Export functionality in multiple formats (TXT, JSON, PDF)
   - Dynamic loading of PDF libraries (jsPDF and html2canvas)
   - Organization of transcripts by date and speaker

2. **TranscriptionButton.jsx**: A React component that:
   - Provides UI controls for starting/stopping transcription
   - Displays a drawer with real-time transcripts
   - Shows speaker information for each transcript segment
   - Offers export in multiple formats (TXT, JSON, PDF)
   - Provides extensive language selection options
   - Organizes transcripts chronologically with date separators

## Usage

The TranscriptionButton component is added to the meeting controls and works as follows:

1. Click the transcription button to start live transcription
2. A drawer opens on the right showing transcriptions in real-time
3. Each transcription segment shows the speaker's name and timestamp
4. Use the language selector to change the recognition language (now including Indian languages)
5. Use the export button to download transcripts in your preferred format:
   - TXT: Simple text format suitable for notes
   - JSON: Structured data format for programmatic processing
   - PDF: Professional document format ideal for meeting minutes and sharing
6. Click the clear button to remove all transcripts
7. Click the transcription button again to stop transcription

## Technical Notes

- Uses the Web Speech API (SpeechRecognition interface)
- Supports continuous speech recognition with interim results
- Automatically restarts recognition on errors or timeouts
- Provides fallbacks for different browser implementations
- Handles browser compatibility detection
- Manages resources to prevent memory leaks
- Dynamically loads PDF generation libraries (jsPDF and html2canvas)
- Supports a wide range of languages including Indian languages
- Organizes transcripts logically for improved readability
- Generates professionally formatted PDF documents for meeting minutes

## Browser Support

The Web Speech API is currently supported in:
- Google Chrome
- Microsoft Edge
- Safari
- Some versions of Firefox (may require enabling flags)

Browsers without Web Speech API support will have the transcription button disabled.

## Supported Languages

The transcription feature now supports a wide range of languages including:

### Indian Languages
- Hindi (hi-IN)
- Gujarati (gu-IN)
- Marathi (mr-IN)
- Tamil (ta-IN)
- Telugu (te-IN)
- Kannada (kn-IN)
- Malayalam (ml-IN)
- Punjabi (pa-Guru-IN)
- Bengali (bn-IN)
- Urdu (ur-IN)

### Other Languages
- Multiple English variants (US, UK, India, Australia, Canada)
- European languages (Spanish, French, German, Italian, etc.)
- Asian languages (Chinese, Japanese, Korean, etc.)
- And many more

## PDF Export Feature

The new PDF export functionality provides:
- Professionally formatted meeting transcripts
- Clean organization by date and speaker
- Proper timestamps and attribution
- Multiple page support for longer meetings
- Page numbering and headers
- Ability to save and share meeting minutes easily
- Ideal format for standup meeting notes and documentation
