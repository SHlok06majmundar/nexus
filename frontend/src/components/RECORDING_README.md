# Meeting Recording Feature

This feature allows users to record their Nexus Meet video calls, including all participant video and audio.

## Features

- Record screen with all user video and audio
- Real-time recording timer display
- Download options when recording is complete
- High-quality WebM video format with VP9 codec

## Implementation Details

The recording functionality is implemented in two main components:

1. **RecordingService.js**: A service class that handles:
   - Screen capture using the `getDisplayMedia` API
   - Audio capture from meeting participants
   - Media recording using the `MediaRecorder` API
   - Time tracking and formatting
   - File download functionality

2. **RecordingButton.jsx**: A React component that:
   - Provides UI controls for starting/stopping recording
   - Shows real-time recording duration
   - Handles the download dialog
   - Manages recording states

## Usage

The RecordingButton component is added to the meeting controls and works as follows:

1. Click the record button to start recording (red dot icon)
2. A timer appears showing the elapsed recording time
3. Click the stop button to end recording (square icon)
4. A dialog appears offering to download the recording
5. The recording is saved as a WebM file with date/time stamp

## Technical Notes

- Uses the browser's `MediaRecorder` API
- Combines screen capture with audio from both local and remote participants using Web Audio API
- Uses AudioContext to mix multiple audio sources into a single high-quality audio track
- Records in WebM format with VP9 video codec and Opus audio codec
- Recording quality is set for optimal balance of quality and file size
- File is processed and downloaded locally (no server storage)

## Limitations

- Requires user permission for screen recording
- Chrome/Edge browsers have the best support for this feature
- Some browsers may have limitations with capturing system audio
- Large recordings may consume significant memory during processing
