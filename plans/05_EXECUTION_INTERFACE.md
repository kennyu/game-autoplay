# 05_EXECUTION_INTERFACE

## Overview

Implement the execution interface that provides CLI commands and serverless function integration. Creates `qa-agent <game-url>` CLI command, supports `bun run qa.ts` script execution, and generates structured JSON output. Designed to work in serverless environments invoked by Game Dev Agent.

## High-Level Approach

1. Create CLI command parser using argument parsing library (commander.js or native)
2. Implement main execution orchestrator that coordinates agent → reporting → evaluation flow
3. Generate structured JSON output matching specified format
4. Support serverless function export for cloud deployment
5. Handle errors gracefully with proper exit codes
6. Add progress output and logging for user feedback
7. Support both single URL and batch processing (foundation for stretch feature)

## Key Components

### Core Modules

**`src/cli/parser.ts`** - Command-line argument parsing
- `CLIParser` class: Parses CLI arguments
- `parseArguments()`: Extract game URL and options from command line
- `validateURL(url)`: Validate game URL format
- `parseOptions()`: Parse flags (--headless, --output-dir, etc.)

**`src/cli/executor.ts`** - Main execution orchestrator
- `QAExecutor` class: Coordinates entire QA pipeline
- `execute(gameUrl, options)`: Main execution method
- `runPipeline()`: Orchestrate agent → reporting → evaluation
- `generateOutput(result)`: Format final JSON output

**`src/cli/output.ts`** - Output formatting and display
- `OutputFormatter` class: Formats results for display
- `formatJSON(result)`: Generate structured JSON output
- `formatConsole(result)`: Human-readable console output
- `writeOutput(result, path)`: Write JSON to file

**`src/cli/index.ts`** - CLI entry point
- `main()`: CLI main function
- Parse arguments
- Initialize executor
- Run pipeline
- Output results
- Handle errors and exit codes

**`src/serverless/index.ts`** - Serverless function handler
- `qaHandler(event)`: Serverless function entry point
- Accepts event with game URL
- Runs QA pipeline
- Returns structured response
- Handles async execution

**`qa.ts`** - Bun script entry point
- Simple wrapper that calls CLI main
- Supports `bun run qa.ts <game-url>`

## Implementation Steps

1. **CLI Argument Parser**
   - Create `src/cli/parser.ts` with CLIParser class
   - Parse positional argument: `qa-agent <game-url>`
   - Parse optional flags:
     - `--output-dir <path>`: Custom output directory
     - `--headless`: Browser headless mode
     - `--timeout <ms>`: Max execution time
     - `--screenshots <count>`: Number of screenshots
     - `--verbose`: Detailed logging
     - `--output-file <path>`: Write JSON to file
   - Validate game URL format (must be valid HTTP/HTTPS URL)
   - Show help message with `--help`

2. **Main Executor**
   - Create `src/cli/executor.ts` with QAExecutor class
   - Implement `execute(gameUrl, options)`:
     1. Initialize configuration from options
     2. Create run ID for this execution
     3. Initialize reporter with run ID
     4. Run browser agent (`agent.run(gameUrl)`)
     5. Capture artifacts (reporting module)
     6. Run evaluation (evaluation module)
     7. Generate final result
   - Handle errors at each step with proper error messages
   - Track execution time

3. **Output Formatting**
   - Create `src/cli/output.ts` with OutputFormatter class
   - Implement `formatJSON(result)`: Generate JSON matching spec:
     ```json
     {
       "status": "pass" | "fail",
       "playability_score": 0-100,
       "issues": [...],
       "screenshots": ["path1", "path2", ...],
       "timestamp": "ISO 8601"
     }
     ```
   - Implement `formatConsole(result)`: Human-readable output
   - Implement `writeOutput(result, path)`: Write JSON to file if specified
   - Pretty-print JSON with 2-space indentation

4. **CLI Entry Point**
   - Create `src/cli/index.ts` with `main()` function
   - Parse arguments using CLIParser
   - Initialize QAExecutor
   - Show progress updates during execution
   - Output results to console (and file if specified)
   - Handle errors: catch exceptions, output error JSON, exit with code 1
   - Exit with code 0 on success

5. **Bun Script Wrapper**
   - Create `qa.ts` in project root
   - Import and call `main()` from `src/cli/index.ts`
   - Add to package.json scripts: `"qa": "bun run qa.ts"`
   - Support: `bun run qa <game-url>`

6. **Serverless Handler**
   - Create `src/serverless/index.ts` with `qaHandler(event)`
   - Parse event to extract game URL and options
   - Run QAExecutor.execute()
   - Return ServerlessResponse with statusCode and body
   - Handle async execution properly
   - Export handler for serverless platforms (Vercel, AWS Lambda, etc.)

7. **Progress Feedback**
   - Add progress updates during execution:
     - "Initializing browser..."
     - "Loading game..."
     - "Capturing screenshots..."
     - "Evaluating playability..."
     - "Generating report..."
   - Show progress only in verbose mode or for long operations
   - Display execution time at end

8. **Error Handling**
   - Catch errors at each pipeline stage
   - Generate error result with status: 'error'
   - Include error message in issues array
   - Ensure screenshots/logs are saved even on error
   - Return appropriate exit codes (0=success, 1=error)

9. **Configuration Merging**
   - Merge CLI options with default config
   - Override defaults from environment variables
   - Validate merged configuration
   - Pass config to agent, reporting, and evaluation modules

10. **Package.json Scripts**
    - Add script: `"qa": "bun run qa.ts"`
    - Add script: `"qa:dev": "bun run --watch qa.ts"` (for development)
    - Ensure scripts work with Bun runtime

## Dependencies

### Internal Dependencies
- `src/agent/orchestrator.ts` - BrowserAgent execution
- `src/reporting/index.ts` - Artifact capture
- `src/evaluation/index.ts` - Playability evaluation
- `src/config/index.ts` - Configuration management
- `src/types/index.ts` - QAResult, Issue types

### External Dependencies
- Commander.js (optional) - CLI argument parsing, or use native Bun APIs
- Bun runtime - Script execution

### Integration Dependencies
- Orchestrates all core modules (agent, reporting, evaluation)
- Entry point for entire QA pipeline

## Integration Points

- **Orchestrates**: All core modules (BROWSER_AGENT, REPORTING, AI_EVALUATION)
- **Consumes**: Configuration from PROJECT_SETUP
- **Produces**: Final JSON output for external consumption
- **Called by**: CLI users or serverless platform

## Testing Strategy

1. **Unit Tests**
   - Test CLI argument parsing with various inputs
   - Test URL validation
   - Test output formatting (JSON structure)
   - Test error handling

2. **Integration Tests**
   - Test full pipeline execution with mock modules
   - Test end-to-end with simple test game
   - Verify JSON output structure matches spec
   - Test error scenarios

3. **Manual Testing**
   - Run `bun run qa.ts <test-game-url>`
   - Verify JSON output is correct
   - Test with various CLI flags
   - Test error handling with invalid URL
   - Test verbose mode output

4. **Serverless Testing**
   - Test handler with mock event
   - Verify response format
   - Test error responses
   - Deploy to test serverless platform (optional)

5. **Edge Cases**
   - Invalid game URL
   - Network timeout
   - Missing environment variables
   - Very long execution times
   - Output directory permissions issues

