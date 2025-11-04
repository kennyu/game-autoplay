# 06_GIF_RECORDING

## Overview

Implement gameplay recording functionality that captures animated GIFs of the test session for inclusion in reports. Records screen activity during agent execution and saves as GIF files alongside screenshots. Enhances visual evidence for playability assessment.

## High-Level Approach

1. Capture continuous screenshots at regular intervals during agent execution
2. Store frame sequence in memory or temporary storage
3. Encode frames into animated GIF format after session completes
4. Save GIF file to output directory alongside screenshots
5. Include GIF path in final report output
6. Support configurable frame rate and quality settings
7. Handle memory constraints for long sessions

## Key Components

### Core Modules

**`src/recording/capture.ts`** - Frame capture during execution
- `GIFRecorder` class: Manages frame capture
- `startRecording()`: Begin capturing frames
- `captureFrame()`: Take screenshot and add to frame buffer
- `stopRecording()`: End capture and trigger encoding

**`src/recording/encoder.ts`** - GIF encoding
- `GIFEncoder` class: Converts frames to GIF
- `encodeFrames(frames, options)`: Encode frame sequence to GIF
- `optimizeGIF(gifData)`: Reduce file size if needed
- `saveGIF(gifData, path)`: Write GIF to disk

**`src/recording/options.ts`** - Recording configuration
- `RecordingConfig` interface: Frame rate, quality, dimensions
- `defaultConfig()`: Sensible defaults for recording

**`src/recording/index.ts`** - Main recording interface
- `GameplayRecorder` class: Public API
- `initialize(config)`: Set up recorder
- `recordFrame()`: Called by agent during execution
- `finalize()`: Complete recording and return GIF path

## Implementation Steps

1. **Frame Capture Integration**
   - Create `src/recording/capture.ts` with GIFRecorder class
   - Integrate with browser agent to capture frames during execution
   - Implement frame buffer: store frames in memory with timestamps
   - Add frame rate control: capture at configurable intervals (default: 0.5s = 2 fps)
   - Limit buffer size: stop capturing if max duration exceeded

2. **GIF Encoding Library**
   - Research and select GIF encoding library (e.g., `gifencoder`, `sharp`, or `canvas`)
   - Install required dependencies
   - Create `src/recording/encoder.ts` with GIFEncoder class
   - Implement `encodeFrames()`: Convert frame buffer to GIF
   - Add quality/optimization options

3. **Recording Configuration**
   - Create `src/recording/options.ts` with RecordingConfig
   - Add config to main QAConfig interface
   - Support enabling/disabling via CLI flag: `--record-gif`
   - Set defaults: 2 fps, medium quality, optimize enabled

4. **Agent Integration**
   - Modify browser agent to call recorder at key phases
   - Capture frames: initial load, during interactions, final state
   - Pass phase information to recorder for frame metadata
   - Ensure recorder doesn't slow down agent execution

5. **Memory Management**
   - Implement frame buffer limits to prevent memory issues
   - Option: Write frames to temp files if buffer gets too large
   - Clean up frame buffer after encoding
   - Handle long sessions gracefully (stop recording at max duration)

6. **GIF Optimization**
   - Implement optional GIF optimization to reduce file size
   - Reduce color palette if quality set to 'low'
   - Add frame compression options
   - Balance quality vs file size

7. **Output Integration**
   - Save GIF to: `output/{runId}/recording.gif`
   - Include GIF path in final JSON output (new field: `recording_gif`)
   - Update QAResult type to include optional recording_gif field
   - Update reporting module to handle GIF artifact

8. **Error Handling**
   - Handle encoding failures gracefully (don't fail entire run)
   - Log warnings if recording fails
   - Continue execution even if GIF recording disabled or fails

## Dependencies

### Internal Dependencies
- `src/agent/orchestrator.ts` - Integration point for frame capture
- `src/reporting/index.ts` - Artifact storage
- `src/config/index.ts` - Recording configuration

### External Dependencies
- GIF encoding library (e.g., `gifencoder`, `sharp`, or native canvas API)
- Browser screenshot API (from Stagehand/Browserbase)

### Integration Dependencies
- Called by BROWSER_AGENT during execution
- Outputs GIF path to REPORTING module
- Included in final JSON from EXECUTION_INTERFACE

## Integration Points

- **Integrated with**: BROWSER_AGENT for frame capture during execution
- **Produces**: GIF file for REPORTING module
- **Consumes**: Configuration from PROJECT_SETUP
- **Enhances**: Final JSON output with recording_gif field

## Testing Strategy

1. **Unit Tests**
   - Test frame capture timing and buffering
   - Test GIF encoding with sample frames
   - Test configuration options

2. **Integration Tests**
   - Test full recording workflow with mock browser
   - Verify GIF file is created and valid
   - Test memory management with many frames

3. **Manual Testing**
   - Record test game session
   - Verify GIF plays correctly
   - Check file size is reasonable
   - Test with different quality settings

4. **Edge Cases**
   - Very long sessions (max duration limit)
   - Memory constraints (large frame buffers)
   - Encoding failures
   - Empty frame sequences

