# 04_AI_EVALUATION

## Overview

Implement LLM-powered evaluation system that analyzes screenshots, console logs, and execution evidence to assess game playability. Evaluates successful load, responsive controls, and stability. Outputs structured JSON with pass/fail status, confidence scores, and issue descriptions.

## High-Level Approach

1. Collect all evidence artifacts (screenshots, logs, errors) from reporting module
2. Prepare structured prompts for LLM analysis with clear evaluation criteria
3. Use OpenAI API to evaluate evidence with structured output (Zod schemas)
4. Analyze evidence across three dimensions: load success, control responsiveness, stability
5. Generate confidence scores and issue descriptions for each dimension
6. Aggregate results into final playability assessment
7. Implement fallback heuristics if LLM fails or gives inconsistent results

## Key Components

### Core Modules

**`src/evaluation/prompt.ts`** - Prompt engineering
- `PromptBuilder` class: Constructs evaluation prompts
- `buildLoadPrompt(evidence)`: Prompt for load success assessment
- `buildControlsPrompt(evidence)`: Prompt for control responsiveness
- `buildStabilityPrompt(evidence)`: Prompt for crash/stability check
- `buildAggregatePrompt(results)`: Final assessment prompt

**`src/evaluation/analyzer.ts`** - LLM analysis orchestration
- `EvidenceAnalyzer` class: Coordinates LLM evaluation
- `analyzeLoad(artifacts)`: Evaluate if game loaded successfully
- `analyzeControls(artifacts)`: Assess control responsiveness
- `analyzeStability(artifacts)`: Check for crashes and freezes
- `aggregateResults(analyses)`: Combine individual analyses

**`src/evaluation/llm.ts`** - LLM integration
- `LLMClient` class: Wraps OpenAI API calls
- `callWithStructuredOutput(prompt, schema)`: Execute OpenAI call with Zod schema
- `parseResponse(completion)`: Extract and validate parsed response
- `handleLLMError(error)`: Graceful error handling with retry logic

**`src/evaluation/fallback.ts`** - Heuristic fallbacks
- `HeuristicEvaluator` class: Rule-based evaluation when LLM fails
- `evaluateByLogs(logs)`: Analyze console errors for issues
- `evaluateByScreenshots(screenshots)`: Basic screenshot analysis
- `generateScore(evidence)`: Calculate playability score heuristically

**`src/evaluation/index.ts`** - Main evaluation interface
- `Evaluator` class: Public API for evaluation
- `evaluate(artifacts)`: Main evaluation method
- Returns structured QAResult with scores and issues

## Implementation Steps

1. **LLM Client Setup**
   - Create `src/evaluation/llm.ts` with LLMClient class
   - Initialize OpenAI client with API key from environment variables
   - Configure model parameters (temperature, max tokens, model selection)
   - Implement structured output using `openai.beta.chat.completions.parse()` with Zod schemas
   - Add retry logic for failed API calls

2. **Prompt Engineering**
   - Create `src/evaluation/prompt.ts` with PromptBuilder class
   - Design system prompts for each evaluation dimension:
     - Load: "Analyze if the game loaded successfully based on screenshots and logs"
     - Controls: "Assess if game controls are responsive based on interaction evidence"
     - Stability: "Determine if the game crashed or froze during execution"
   - Include examples in prompts for consistency
   - Add instructions for structured JSON output

3. **Sequential Evaluation Workflow**
   - Create `src/evaluation/analyzer.ts` with EvidenceAnalyzer class
   - Implement sequential evaluation flow:
     1. `analyzeLoad()`: Call OpenAI for load analysis
     2. `analyzeControls()`: Call OpenAI for controls analysis
     3. `analyzeStability()`: Call OpenAI for stability analysis
     4. `aggregateResults()`: Combine results into final assessment
   - Use try/catch for error handling with fallback to heuristics
   - Implement retry logic for failed LLM calls (up to 3 attempts)

4. **Individual Analysis Methods**
   - Create `src/evaluation/analyzer.ts` with EvidenceAnalyzer class
   - Implement `analyzeLoad()`:
     - Extract initial screenshot
     - Check console logs for load errors
     - Prompt LLM: "Does game load successfully?"
     - Parse response into LoadAnalysis
   - Implement `analyzeControls()`:
     - Extract screenshots showing interactions
     - Check action success indicators
     - Prompt LLM: "Are the controls responsive?"
     - Parse response into ControlsAnalysis
   - Implement `analyzeStability()`:
     - Extract error logs and final screenshots
     - Check for crash indicators
     - Prompt LLM: "Did the game complete without crashes?"
     - Parse response into StabilityAnalysis

5. **Result Aggregation**
   - Implement `aggregateResults()` in analyzer:
     - Calculate overall score: weighted average of load/controls/stability
     - Determine pass/fail: fail if any critical issue or score < 50
     - Generate overall confidence: average of individual confidences
     - Map analyses to Issue[] format for QAResult

6. **Fallback Heuristics**
   - Create `src/evaluation/fallback.ts` with HeuristicEvaluator class
   - Implement rule-based evaluation:
     - Load: Check for console errors, blank screenshots
     - Controls: Verify actions were executed successfully
     - Stability: Count console errors, check for error screenshots
   - Generate scores and issues based on heuristics
   - Use when LLM fails or confidence is too low

7. **Configuration and Scoring**
   - Define scoring weights: Load (30%), Controls (40%), Stability (30%)
   - Implement confidence thresholds (min 0.5 for reliable results)
   - Map LLM responses to Issue[] format with severity levels
   - Generate playability_score (0-100) from analyses

8. **Main Evaluator Interface**
   - Create `src/evaluation/index.ts` with Evaluator class
   - Implement `evaluate(artifacts)` method:
     - Load evidence from artifact paths
     - Run sequential evaluation workflow
     - Handle LLM errors with fallback to heuristics
     - Return structured QAResult
   - Export clean public API

9. **Error Handling**
   - Handle LLM API failures gracefully
   - Fall back to heuristics if LLM unavailable
   - Log LLM responses for debugging
   - Handle malformed LLM responses with validation

## Dependencies

### Internal Dependencies
- `src/reporting/index.ts` - Artifact artifacts and paths
- `src/config/index.ts` - LLM configuration
- `src/types/index.ts` - QAResult, Issue types
- `src/utils/logger.ts` - Logging

### External Dependencies
- `openai` - OpenAI API client
- `zod` - Response validation and schema definition

### Integration Dependencies
- Consumes artifacts from REPORTING module
- Produces QAResult for EXECUTION_INTERFACE module

## Integration Points

- **Consumes**: ArtifactSet from REPORTING module (screenshots, logs, errors)
- **Produces**: QAResult with playability_score, issues, status for EXECUTION_INTERFACE
- **Called by**: EXECUTION_INTERFACE after agent execution completes
- **Uses**: Configuration from PROJECT_SETUP for LLM settings

## Testing Strategy

1. **Unit Tests**
   - Test prompt building with mock evidence
   - Test LLM response parsing and validation
   - Test score calculation and aggregation logic
   - Test fallback heuristics with various evidence scenarios

2. **Integration Tests**
   - Test full evaluation workflow with mock OpenAI responses
   - Test sequential workflow execution with real artifacts
   - Test fallback activation when LLM fails

3. **Manual Testing**
   - Run evaluation on known good game (should pass)
   - Run evaluation on broken game (should fail with issues)
   - Test with inconsistent LLM responses (should handle gracefully)

4. **Edge Cases**
   - LLM API timeout or rate limiting
   - Malformed LLM responses
   - Missing evidence (no screenshots or logs)
   - Very low confidence scores
   - All dimensions passing but low overall score

