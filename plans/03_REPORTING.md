# 03_REPORTING

## Overview

Implement artifact capture and storage system that saves screenshots, console logs, and error messages to structured output directories. Handles timestamped screenshots (3-5 per session), organizes artifacts by test run, and prepares evidence for AI evaluation.

## High-Level Approach

1. Create structured output directory hierarchy organized by test run ID and timestamp
2. Capture screenshots at designated phases during agent execution
3. Collect and store console logs with timestamps and severity levels
4. Save error messages and stack traces
5. Generate metadata files (run info, timestamps, URLs tested)
6. Implement graceful degradation if screenshot capture fails
7. Create artifact paths that can be referenced in final JSON output

## Key Components

### Core Modules

**`src/reporting/capture.ts`** - Screenshot and log capture
- `ArtifactCapture` class: Coordinates artifact collection
- `captureScreenshot(phase, description)`: Take screenshot at specific phase
- `captureConsoleLog(level, message)`: Store console messages
- `captureError(error, context)`: Save error details with stack traces

**`src/reporting/storage.ts`** - File system management
- `ArtifactStorage` class: Manages output directory structure
- `createRunDirectory(runId)`: Create unique directory for test run
- `saveScreenshot(imageData, filename)`: Write screenshot to disk
- `saveLogs(logs, filename)`: Write console logs to JSON file
- `saveMetadata(metadata)`: Write run metadata to JSON

**`src/reporting/formatter.ts`** - Output formatting
- `ReportFormatter` class: Formats artifacts for final output
- `formatScreenshotPaths(screenshots)`: Generate relative/absolute paths
- `formatConsoleLogs(logs)`: Structure log data for JSON output
- `generateRunSummary(artifacts)`: Create summary of captured artifacts

**`src/reporting/index.ts`** - Main reporting coordinator
- `Reporter` class: Main interface for reporting module
- `initialize(runId)`: Set up output directory for new test run
- `captureArtifacts(agentState)`: Capture all artifacts from agent execution
- `finalize()`: Complete report generation and return artifact paths

## Implementation Steps

1. **Directory Structure Setup**
   - Create `src/reporting/storage.ts` with ArtifactStorage class
   - Implement `createRunDirectory()` that creates: `output/{runId}/`
   - Create subdirectories: `screenshots/`, `logs/`, `errors/`
   - Generate unique run IDs using timestamp + random suffix

2. **Screenshot Capture**
   - Create `src/reporting/capture.ts` with ArtifactCapture class
   - Integrate with browser agent to capture screenshots at phases:
     - Initial render (baseline)
     - After start button click
     - Mid-gameplay (1-2 during interaction)
     - Final state
     - Error state (if applicable)
   - Use Stagehand/Browserbase screenshot API
   - Implement retry logic for failed captures
   - Add graceful degradation: continue if screenshot fails

3. **Console Log Collection**
   - Set up console log listeners in browser agent
   - Store logs in memory during execution with timestamps
   - Filter logs by severity (error, warn, info, log)
   - Save logs to JSON file: `output/{runId}/logs/console.json`
   - Include metadata: total count, error count, warning count

4. **Error Capture**
   - Capture JavaScript errors from page context
   - Store stack traces when available
   - Include phase context (what agent was doing when error occurred)
   - Save to: `output/{runId}/errors/errors.json`
   - Track error count and severity

5. **Metadata Generation**
   - Create `src/reporting/formatter.ts` with ReportFormatter class
   - Generate `output/{runId}/metadata.json` with:
     - Run ID, game URL, timestamps
     - Artifact counts
     - Agent phase progression
     - Execution duration

6. **Path Management**
   - Store both relative paths (for portability) and absolute paths
   - Generate paths that can be referenced in final JSON output
   - Ensure paths are cross-platform compatible (Windows/Unix)

7. **Reporter Coordination**
   - Create `src/reporting/index.ts` with Reporter class
   - Implement `initialize()`: Set up directory structure
   - Implement `captureArtifacts()`: Coordinate all capture operations
   - Implement `finalize()`: Complete report and return artifact paths
   - Provide interface for agent to call at each phase

8. **Configuration Integration**
   - Load reporting config from main config
   - Support configurable output directory, screenshot count (3-5)
   - Allow override of screenshot format (PNG default)

9. **Error Handling**
   - Handle file system errors gracefully
   - Continue execution if individual artifact saves fail
   - Log warnings for failed captures but don't fail entire run

## Dependencies

### Internal Dependencies
- `src/agent/orchestrator.ts` - Receives agent state and screenshots
- `src/config/index.ts` - Reporting configuration
- `src/types/index.ts` - Base types
- `src/utils/logger.ts` - Logging utilities

### External Dependencies
- Browser/Stagehand API - For screenshot capture
- Node.js/Bun `fs` module - File system operations
- Node.js/Bun `path` module - Path manipulation

### Integration Dependencies
- Receives data from BROWSER_AGENT module
- Provides artifact paths to AI_EVALUATION module
- Feeds structured output to EXECUTION_INTERFACE module

## Integration Points

- **Consumes**: Agent state, screenshots, console logs from BROWSER_AGENT
- **Produces**: File artifacts and paths for AI_EVALUATION
- **Called by**: BROWSER_AGENT at key phases for screenshot capture
- **Feeds**: Artifact paths to EXECUTION_INTERFACE for final JSON output

## Testing Strategy

1. **Unit Tests**
   - Test directory creation with mock file system
   - Test screenshot path generation
   - Test log formatting and JSON serialization

2. **Integration Tests**
   - Test full artifact capture with mock browser session
   - Verify directory structure is created correctly
   - Test graceful degradation when screenshot fails

3. **Manual Testing**
   - Run full capture on test game
   - Verify screenshots are saved and viewable
   - Check log files contain expected console output
   - Verify metadata file structure

4. **Edge Cases**
   - Test with very long console log output
   - Test with missing permissions for output directory
   - Test with disk space issues (should fail gracefully)
   - Test screenshot capture during page transitions

