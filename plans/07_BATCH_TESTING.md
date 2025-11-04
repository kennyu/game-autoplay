# 07_BATCH_TESTING

## Overview

Implement batch testing capability that sequentially tests multiple game URLs and generates aggregated reports. Processes a list of URLs, runs QA pipeline for each, collects results, and produces summary statistics across all tests.

## High-Level Approach

1. Accept multiple game URLs as input (file, CLI arguments, or array)
2. Sequentially execute QA pipeline for each URL
3. Collect individual results for each game
4. Generate aggregated statistics and summary report
5. Create consolidated output directory with subdirectories per game
6. Produce summary JSON with overall metrics
7. Handle failures gracefully (continue with remaining URLs)

## Key Components

### Core Modules

**`src/batch/parser.ts`** - Input parsing
- `BatchParser` class: Parses batch input sources
- `parseFromFile(path)`: Read URLs from text file (one per line)
- `parseFromArgs(args)`: Parse URLs from CLI arguments
- `parseFromArray(urls)`: Accept array of URLs
- `validateURLs(urls)`: Validate all URLs

**`src/batch/executor.ts`** - Batch execution coordinator
- `BatchExecutor` class: Orchestrates batch runs
- `executeBatch(urls, options)`: Run QA for all URLs
- `executeSingle(url, index, total)`: Run QA for one URL with progress tracking
- `collectResults()`: Aggregate individual results

**`src/batch/aggregator.ts`** - Result aggregation
- `ResultAggregator` class: Combines individual results
- `aggregate(results)`: Calculate summary statistics
- `generateSummary(results)`: Create summary report
- `calculateMetrics(results)`: Compute pass rate, avg scores, etc.

**`src/batch/output.ts`** - Batch output formatting
- `BatchOutputFormatter` class: Formats batch results
- `formatSummary(summary)`: Generate summary JSON
- `formatReport(results)`: Detailed per-game report
- `writeBatchOutput(summary, results, path)`: Save batch results

**`src/batch/index.ts`** - Main batch interface
- `BatchRunner` class: Public API
- `run(urls, options)`: Execute batch testing
- Returns aggregated results

## Implementation Steps

1. **Input Parsing**
   - Create `src/batch/parser.ts` with BatchParser class
   - Support multiple input methods:
     - File: `--batch-file <path>` (one URL per line)
     - CLI args: `qa-agent <url1> <url2> <url3> ...`
     - Array: Programmatic API
   - Validate all URLs before starting batch
   - Return array of valid URLs

2. **Batch Executor**
   - Create `src/batch/executor.ts` with BatchExecutor class
   - Implement `executeBatch()`:
     - Loop through URLs sequentially
     - Call QAExecutor for each URL
     - Track progress (X of Y completed)
     - Collect results even if individual test fails
     - Continue with next URL on error (if continue_on_error=true)
   - Show progress updates during batch execution

3. **Result Collection**
   - Store individual results in memory
   - Include run_id, output_path for each result
   - Track execution times for statistics
   - Handle partial results (if some tests fail)

4. **Aggregation Logic**
   - Create `src/batch/aggregator.ts` with ResultAggregator class
   - Calculate summary statistics:
     - Pass/fail/error counts
     - Average playability score
     - Pass rate percentage
     - Total and average execution time
   - Identify common issues across games
   - Categorize issues by type and severity

5. **Output Formatting**
   - Create `src/batch/output.ts` with BatchOutputFormatter class
   - Generate `batch-summary.json` with:
     - Overall statistics
     - Individual result references
     - Common issues
   - Create directory structure:
     ```
     output/
     ├── batch-{timestamp}/
     │   ├── batch-summary.json
     │   ├── game1-{runId}/
     │   ├── game2-{runId}/
     │   └── ...
     ```
   - Include individual game results in summary

6. **CLI Integration**
   - Extend CLI parser to detect multiple URLs
   - Add `--batch-file` flag for file input
   - Modify main executor to handle batch mode
   - Output batch summary after completion

7. **Error Handling**
   - Continue with remaining URLs if one fails
   - Log errors for individual games but don't stop batch
   - Include error details in batch summary
   - Track which games had errors

8. **Progress Reporting**
   - Show progress: "Testing game 2 of 5..."
   - Display estimated time remaining
   - Show running pass/fail counts
   - Final summary at end

## Dependencies

### Internal Dependencies
- `src/cli/executor.ts` - QAExecutor for individual runs
- `src/cli/output.ts` - Individual result formatting
- `src/types/index.ts` - QAResult, Issue types

### External Dependencies
- File system for reading batch files
- Same as core QA pipeline dependencies

### Integration Dependencies
- Uses EXECUTION_INTERFACE (QAExecutor) for individual runs
- Extends CLI capabilities
- Produces enhanced batch reports

## Integration Points

- **Extends**: EXECUTION_INTERFACE CLI with batch capabilities
- **Uses**: QAExecutor for individual game testing
- **Produces**: Aggregated batch reports
- **Enhances**: Reporting with batch summary statistics

## Testing Strategy

1. **Unit Tests**
   - Test URL parsing from file and arguments
   - Test aggregation logic with mock results
   - Test summary calculation

2. **Integration Tests**
   - Test batch execution with 2-3 test URLs
   - Verify individual results are collected
   - Verify summary is generated correctly

3. **Manual Testing**
   - Run batch with multiple game URLs
   - Verify batch summary output
   - Test error handling (one broken URL in batch)
   - Verify individual results are preserved

4. **Edge Cases**
   - Empty URL list
   - All URLs invalid
   - All tests fail
   - Very large batch (10+ URLs)
   - Mixed pass/fail/error results

