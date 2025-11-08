# 03_AI_EVALUATION

## Overview

Implement LLM-powered evaluation system that analyzes the `AgentResult` (action outcomes, console logs, execution metrics) to assess game playability. Uses **data-only analysis** (no visual inspection) to evaluate if the game is playable based on structured evidence. Outputs structured `QAResult` with playability score, issues, and confidence.

**Input**: `AgentResult` from orchestrator (structured data)
**Output**: `QAResult` with pass/fail, playability score (0-100), issues, confidence

**Key Approach**: Pure data analysis using OpenAI SDK - no browser or vision API required!

## High-Level Approach

### Current State
- ❌ No evaluation module exists yet
- ❌ Need to define `QAResult` type
- ❌ Need to build LLM evaluator
- ✅ Have all evidence needed (`AgentResult`)

### Evaluation Strategy

**Simple Single-Pass Data Analysis**:
1. Load `AgentResult` from orchestrator (structured JSON)
2. Build evaluation prompt with data-only metrics:
   - Action success rate (e.g., 4/5 = 80%)
   - Console error count (e.g., 0 errors)
   - Execution completion status (success/failure)
   - Duration and action sequence
3. Use OpenAI SDK with structured outputs (Zod schema validation)
4. LLM analyzes ALL data in one pass
5. Returns structured `EvaluationResult` with scores and issues
6. Convert to `QAResult` format

**Why Single-Pass?**
- Simpler than multi-step evaluation
- One API call = faster and cheaper
- LLM has full context to make holistic judgment
- No browser or vision API dependency

## Key Components

### Proposed Architecture

**`src/evaluation/evaluator.ts`** - Main evaluation class
```typescript
export class GameEvaluator {
  private openai: OpenAI;  // OpenAI SDK client
  
  async evaluate(result: AgentResult): Promise<QAResult> {
    // 1. Build evaluation prompt with structured data (action success rates, errors, etc.)
    // 2. Call OpenAI with structured outputs (Zod schema)
    // 3. Parse LLM response into EvaluationResult
    // 4. Convert to QAResult format
    // 5. Return structured result (or fallback if LLM fails)
  }
}
```

**`src/evaluation/schemas.ts`** - Zod schemas for evaluation
```typescript
// Evaluation response schema - Boolean checks only!
export const EvaluationSchema = z.object({
  gameLoaded: z.boolean(),              // 30 points
  controlsResponsive: z.boolean(),      // 40 points
  gameStable: z.boolean(),              // 30 points
  issues: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    evidence: z.string(),
  })),
  reasoning: z.string(),
});

// Point values for each check
export const SCORE_WEIGHTS = {
  gameLoaded: 30,         // Did game load and render?
  controlsResponsive: 40, // Are controls working? (most important)
  gameStable: 30,         // Did game run without crashes?
  // Total: 100 points
};

// QAResult type (what we return to CLI/server)
export interface QAResult {
  gameUrl: string;
  status: 'pass' | 'fail';
  playabilityScore: number;  // 0-100 (sum of passed checks)
  checks: {
    gameLoaded: boolean;
    controlsResponsive: boolean;
    gameStable: boolean;
  };
  issues: Issue[];
  duration: number;
  timestamp: Date;
  screenshots: string[];
  metadata: {
    actionCount: number;
    successfulActions: number;
    consoleErrors: number;
  };
}
```

**`src/evaluation/prompts.ts`** - Prompt builder
```typescript
export function buildEvaluationPrompt(result: AgentResult): string {
  const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
  const successRate = result.actions.length > 0
    ? result.actions.filter(a => a.success).length / result.actions.length
    : 0;
  
  return `
You are evaluating if a web game is playable. Answer each question with TRUE or FALSE.

GAME DATA:
- URL: ${result.gameUrl}
- Duration: ${result.duration}ms
- Actions: ${result.actions.length} total
- Success Rate: ${(successRate * 100).toFixed(0)}%
- Console Errors: ${errorCount}
- Completed: ${result.success ? 'YES' : 'NO'}

ACTION SEQUENCE:
${result.actions.map((a, i) => 
  `${i + 1}. ${a.action} → ${a.success ? 'SUCCESS ✓' : 'FAILED ✗'}${a.error ? ` (${a.error})` : ''}`
).join('\n')}

BOOLEAN CHECKS (answer TRUE or FALSE for each):

1. gameLoaded (30 points)
   - TRUE if: Success rate >0% (at least some actions worked)
   - FALSE if: All actions failed OR zero actions performed

2. controlsResponsive (40 points) 
   - TRUE if: Success rate ≥50% (majority of actions worked)
   - FALSE if: Success rate <50%

3. gameStable (30 points)
   - TRUE if: Execution completed AND no critical console errors
   - FALSE if: Execution did not complete OR console has crash/freeze errors

Also provide:
- List any issues found (with severity and evidence)
- Brief reasoning for your TRUE/FALSE decisions
`;
}
```

**`src/types/index.ts`** - Type definitions (update)
```typescript
// Add to existing types
export interface Issue {
  severity: 'critical' | 'major' | 'minor';
  description: string;
  evidence?: string;
}

export interface QAResult {
  gameUrl: string;
  status: 'pass' | 'fail';
  playabilityScore: number;
  confidence: number;
  issues: Issue[];
  duration: number;
  timestamp: Date;
  screenshots: string[];
  metadata: {
    actionCount: number;
    successfulActions: number;
    consoleErrors: number;
  };
}
```

## Implementation Steps

### Phase 1: Define Types and Schemas

**Step 1.1: Update `src/types/index.ts`**
```typescript
// Add new interfaces
export interface Issue {
  severity: 'critical' | 'major' | 'minor';
  description: string;
  evidence?: string;
}

export interface QAResult {
  gameUrl: string;
  status: 'pass' | 'fail';
  playabilityScore: number;  // 0-100
  confidence: number;  // 0-1
  issues: Issue[];
  duration: number;
  timestamp: Date;
  screenshots: string[];
  metadata: {
    actionCount: number;
    successfulActions: number;
    consoleErrors: number;
  };
}
```

**Step 1.2: Create `src/evaluation/schemas.ts`**
```typescript
import { z } from 'zod';

// Boolean checks only - LLM answers TRUE or FALSE
export const EvaluationSchema = z.object({
  gameLoaded: z.boolean(),
  controlsResponsive: z.boolean(),
  gameStable: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    evidence: z.string(),
  })),
  reasoning: z.string(),
});

// Point values for each check (must sum to 100)
export const SCORE_WEIGHTS = {
  gameLoaded: 30,
  controlsResponsive: 40,
  gameStable: 30,
};

export type EvaluationResult = z.infer<typeof EvaluationSchema>;
```

### Phase 2: Build Prompt System

**Step 2.1: Create `src/evaluation/prompts.ts`**
```typescript
import type { AgentResult } from '../types/index.js';

export function buildEvaluationPrompt(result: AgentResult): string {
  const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
  const successRate = result.actions.length > 0 
    ? result.actions.filter(a => a.success).length / result.actions.length 
    : 0;
  
  return `
You are evaluating if a web game is playable based on automated testing data.

GAME: ${result.gameUrl}
DURATION: ${result.duration}ms
ACTIONS: ${result.actions.length} (${(successRate * 100).toFixed(0)}% successful)
CONSOLE ERRORS: ${errorCount}
EXECUTION COMPLETED: ${result.success ? 'YES' : 'NO'}

ACTION SEQUENCE:
${result.actions.map((a, i) => 
  `${i + 1}. ${a.action} → ${a.success ? 'SUCCESS ✓' : 'FAILED ✗'}${a.error ? ` (${a.error})` : ''}`
).join('\n')}

EVALUATION CRITERIA:

1. **Game Loaded** (Critical)
   - Action success rate >0% indicates game loaded and was interactive
   - Any loading errors? (Check console error count)
   
2. **Controls Responsive** (Critical)
   - Success rate: ${(successRate * 100).toFixed(0)}%
   - Threshold: >50% = responsive
   - Failed actions indicate unresponsive controls or incorrect game type detection
   
3. **Game Stable** (Critical)
   - Console errors: ${errorCount}
   - Any crashes or freezes? (Check execution completion)
   - Did execution complete? (${result.success ? 'YES' : 'NO'})

SCORING GUIDE:
- 90-100: Fully playable, no issues (>90% success rate, 0 errors)
- 70-89: Playable with minor issues (70-90% success rate, few errors)
- 50-69: Partially playable, major issues (50-70% success rate, or some errors)
- 0-49: Not playable, critical issues (<50% success rate, or crash/freeze)

Provide structured evaluation based on the data above.
`;
}
```

### Phase 3: Build Evaluator

**Step 3.1: Create `src/evaluation/evaluator.ts`**
```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { logger } from '../utils/logger.js';
import type { AgentResult, QAResult } from '../types/index.js';
import { EvaluationSchema, type EvaluationResult } from './schemas.js';
import { buildEvaluationPrompt } from './prompts.js';

export class GameEvaluator {
  private openai: OpenAI;
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }
  
  async evaluate(result: AgentResult): Promise<QAResult> {
    try {
      logger.info('🧠 Starting game evaluation...');
      
      // Build prompt with all evidence (data only, no images)
      const prompt = buildEvaluationPrompt(result);
      
      // Use OpenAI structured outputs with Zod schema
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are an expert at evaluating web game playability based on automated test results. Analyze the evidence and provide a structured assessment."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        response_format: zodResponseFormat(EvaluationSchema, "evaluation"),
        temperature: 0.3,  // Lower temperature for more consistent evaluation
      });
      
      const evaluation = completion.choices[0].message.parsed;
      
      if (!evaluation) {
        throw new Error('Failed to parse evaluation response');
      }
      
      logger.info(`📊 Evaluation complete: ${evaluation.playabilityScore}/100`);
      
      // Convert to QAResult format
      return this.convertToQAResult(result, evaluation);
    } catch (error) {
      logger.error('Evaluation failed, using fallback', error as Error);
      return this.fallbackEvaluation(result);
    }
  }
  
  private convertToQAResult(result: AgentResult, eval: EvaluationResult): QAResult {
    const successfulActions = result.actions.filter(a => a.success).length;
    const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
    
    // Calculate score from boolean checks (0-100)
    const score = 
      (eval.gameLoaded ? SCORE_WEIGHTS.gameLoaded : 0) +
      (eval.controlsResponsive ? SCORE_WEIGHTS.controlsResponsive : 0) +
      (eval.gameStable ? SCORE_WEIGHTS.gameStable : 0);
    
    return {
      gameUrl: result.gameUrl,
      status: score >= 50 ? 'pass' : 'fail',  // Pass if score ≥50
      playabilityScore: score,
      checks: {
        gameLoaded: eval.gameLoaded,
        controlsResponsive: eval.controlsResponsive,
        gameStable: eval.gameStable,
      },
      issues: eval.issues,
      duration: result.duration,
      timestamp: new Date(),
      screenshots: result.screenshots,
      metadata: {
        actionCount: result.actions.length,
        successfulActions,
        consoleErrors: errorCount,
      },
    };
  }
  
  private fallbackEvaluation(result: AgentResult): QAResult {
    // Simple heuristic evaluation if LLM fails - same boolean logic
    const successRate = result.actions.length > 0
      ? result.actions.filter(a => a.success).length / result.actions.length
      : 0;
    const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
    
    // Apply same boolean checks as LLM would
    const gameLoaded = successRate > 0;
    const controlsResponsive = successRate >= 0.5;
    const gameStable = result.success && errorCount === 0;
    
    // Calculate score from boolean checks
    const score = 
      (gameLoaded ? SCORE_WEIGHTS.gameLoaded : 0) +
      (controlsResponsive ? SCORE_WEIGHTS.controlsResponsive : 0) +
      (gameStable ? SCORE_WEIGHTS.gameStable : 0);
    
    return {
      gameUrl: result.gameUrl,
      status: score >= 50 ? 'pass' : 'fail',
      playabilityScore: score,
      checks: {
        gameLoaded,
        controlsResponsive,
        gameStable,
      },
      issues: [
        {
          severity: 'minor',
          description: 'Evaluation used fallback heuristics (LLM unavailable)',
          evidence: 'N/A',
        },
      ],
      duration: result.duration,
      timestamp: new Date(),
      screenshots: result.screenshots,
      metadata: {
        actionCount: result.actions.length,
        successfulActions: result.actions.filter(a => a.success).length,
        consoleErrors: errorCount,
      },
    };
  }
}
```

### Phase 4: Integration

**Step 4.1: Update orchestrator to call evaluator**
```typescript
// In src/agent/orchestrator.ts
import { GameEvaluator } from '../evaluation/evaluator.js';

export class BrowserAgent extends EventEmitter {
  async run(gameUrl: string): Promise<QAResult> {  // Change return type
    // ... existing code ...
    
    const agentResult: AgentResult = {
      gameUrl,
      duration,
      actions: actionResults,
      consoleLogs: this.consoleLogs,
      screenshots: actionResults.flatMap(a => [a.screenshotBefore, a.screenshotAfter].filter(Boolean) as string[]),
      success: true,
    };
    
    // NEW: Evaluate the results (no Stagehand needed!)
    const evaluator = new GameEvaluator();  // Uses OPENAI_API_KEY from env
    const qaResult = await evaluator.evaluate(agentResult);
    
    return qaResult;
  }
}
```

**Step 4.2: Update CLI to display QAResult**
```typescript
// In qa.ts
const result = await agent.run(gameUrl);

console.log('\n📊 EVALUATION RESULTS:');
console.log(`Status: ${result.status.toUpperCase()}`);
console.log(`Playability Score: ${result.playabilityScore}/100\n`);

console.log('Checks:');
console.log(`  ✓ Game Loaded (30pts): ${result.checks.gameLoaded ? 'PASS' : 'FAIL'}`);
console.log(`  ✓ Controls Responsive (40pts): ${result.checks.controlsResponsive ? 'PASS' : 'FAIL'}`);
console.log(`  ✓ Game Stable (30pts): ${result.checks.gameStable ? 'PASS' : 'FAIL'}`);

if (result.issues.length > 0) {
  console.log('\n🐛 Issues Found:');
  result.issues.forEach(issue => {
    console.log(`  [${issue.severity}] ${issue.description}`);
  });
}
```

### Phase 5: Testing

**Step 5.1: Test with known games**
```bash
# Should PASS
bun qa.ts https://playtictactoe.com

# Should identify issues
bun qa.ts https://broken-game-url.com
```

**Step 5.2: Verify output structure**
- Check that playability score makes sense
- Verify issues are identified correctly
- Confirm screenshots are referenced
- Validate confidence scores are reasonable

## Dependencies

### Internal Dependencies
- `src/agent/orchestrator.ts` - Receives `AgentResult` from here
- `src/types/index.ts` - Define `QAResult`, `Issue`, `AgentResult` types
- `src/utils/logger.ts` - Logging utilities

### External Dependencies
- `openai` - OpenAI SDK for LLM API (v4.x with structured outputs)
- `zod` - Schema definition and validation

### Integration Dependencies
- **Consumes**: `AgentResult` from orchestrator (not from reporting module!)
- **Produces**: `QAResult` for CLI/server display
- **Independent**: No browser/Stagehand dependency - pure data analysis

## Integration Points

- **Consumes**: `AgentResult` directly from `BrowserAgent.run()`
- **Produces**: `QAResult` with playability score, issues, status
- **Called by**: Orchestrator at end of agent execution
- **Uses**: OpenAI API key from environment variables

## Key Design Decisions

### Why Single-Pass Evaluation Instead of Multi-Step?

**Original Plan**: Load → Controls → Stability (3 separate LLM calls)
**New Approach**: One comprehensive data analysis

**Rationale**:
1. **Simpler**: One prompt, one LLM call, one result
2. **Faster**: 3x fewer API calls
3. **Cheaper**: ~67% cost savings (~$0.001 vs ~$0.003 per evaluation)
4. **Better context**: LLM sees all evidence at once (action sequence, errors, timing)
5. **Data-only**: No expensive vision API calls needed

**Trade-off**: Less granular confidence scores, but overall confidence still useful

### Why Use OpenAI SDK Directly (Not Stagehand)?

**Decision**: Use OpenAI SDK for evaluation, not Stagehand's `extract()`

**Rationale**:
- **Stagehand's `extract()`** is for analyzing *web pages* (vision + DOM)
- **Evaluation** is analyzing *structured data* (JSON from AgentResult)
- We don't need browser navigation or vision analysis
- Just need LLM reasoning over data

**What We Actually Need**:
```typescript
// NOT this (Stagehand - for web pages)
const analysis = await stagehand.extract(prompt, schema);

// THIS (OpenAI - for data analysis)
const completion = await openai.beta.chat.completions.parse({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You evaluate game playability." },
    { role: "user", content: buildEvaluationPrompt(result) }
  ],
  response_format: zodResponseFormat(EvaluationSchema, "evaluation")
});
```

**Benefits**:
- Evaluation independent of browser session
- Faster (no page navigation)
- Cheaper (no vision API unless we want it)
- Can evaluate offline from saved AgentResults

### Should We Include Visual Analysis of Screenshots?

**Question**: Should the LLM actually *look at* the screenshots, or just evaluate based on metadata?

**Option A: Data-Only Evaluation (RECOMMENDED for MVP)**
- Evaluate based on action success rates, console errors, completion status
- No visual analysis needed
- Faster and cheaper
- Works for 90% of cases

```typescript
// Prompt includes statistics, not images
const prompt = `
Actions: 5 total, 4 successful (80% success rate)
Console Errors: 0
Duration: 15234ms
Completion: Success

Evaluate playability based on these metrics.
`;
```

**Option B: Include Visual Analysis (Future Enhancement)**
- Base64 encode screenshots and include in prompt
- Use OpenAI vision API to analyze visuals
- Can detect visual issues (blank screens, broken layouts)
- More expensive and slower

```typescript
// Include images in messages
const messages = [
  { 
    role: "user", 
    content: [
      { type: "text", text: prompt },
      { 
        type: "image_url", 
        image_url: { 
          url: `data:image/png;base64,${base64Screenshot}` 
        }
      }
    ]
  }
];
```

**Recommendation**: Start with Option A (data-only), add visual analysis later if needed.

### Fallback Heuristics Strategy

**When to use fallback**:
- LLM API fails (timeout, rate limit, network error)
- OpenAI API key not configured
- LLM returns unparseable response

**Heuristic boolean checks** (same logic as LLM):
```typescript
const gameLoaded = successRate > 0;           // 30 points if true
const controlsResponsive = successRate >= 0.5; // 40 points if true
const gameStable = result.success && errorCount === 0; // 30 points if true

score = (gameLoaded ? 30 : 0) + (controlsResponsive ? 40 : 0) + (gameStable ? 30 : 0);
```

**Why this approach**:
- Consistent with LLM evaluation logic
- Transparent scoring (no subjective weights)
- Easy to understand: each check is pass/fail
- Total always 0, 30, 40, 70, or 100 (discrete values)

## Testing Strategy

### Manual Testing Workflow

**Step 1**: Test with working game
```bash
bun qa.ts https://playtictactoe.com
```

**Expected**:
- Status: PASS
- Score: 100 (all 3 checks pass) or 70 (2 checks pass)
- Checks: gameLoaded ✓, controlsResponsive ✓, gameStable ✓
- Issues: 0-2 minor issues

**Step 2**: Test with problematic game
```bash
bun qa.ts https://broken-game-url.com
```

**Expected**:
- Status: FAIL
- Score: 0, 30, or 40 (1 or fewer checks pass)
- Checks: At least one check FAIL
- Issues: 1+ critical/major issues

**Step 3**: Verify fallback works
```bash
# Temporarily break LLM (remove API key)
unset OPENAI_API_KEY
bun qa.ts https://playtictactoe.com
```

**Expected**:
- Status: PASS or FAIL (based on heuristics)
- Score: Same discrete values (0, 30, 40, 70, or 100)
- Checks: Boolean values match heuristic logic
- Issues: Contains "fallback heuristics" message

**Possible Scores**:
- **100**: All 3 checks pass (perfect)
- **70**: gameLoaded + controlsResponsive (good, but unstable)
- **70**: gameLoaded + gameStable (loaded but controls broken)
- **40**: controlsResponsive only (rare)
- **30**: gameLoaded only (loaded but broken)
- **0**: All checks fail (completely broken)

### Validation Checklist

Before considering evaluation complete, verify:

- [ ] QAResult has all required fields
- [ ] Playability score is one of: 0, 30, 40, 70, or 100 (discrete values)
- [ ] `checks` object has all 3 boolean fields
- [ ] Issues array has proper severity levels
- [ ] Screenshots array matches AgentResult
- [ ] Metadata has correct counts
- [ ] Status matches score (fail if <50, pass if >=50)
- [ ] Score calculation: (gameLoaded?30:0) + (controlsResponsive?40:0) + (gameStable?30:0)
- [ ] Fallback works when LLM unavailable (same boolean logic)
- [ ] Evaluation works with 0 actions (all checks should be false → score 0)
- [ ] Evaluation works with all failed actions (gameLoaded false → max score 30)
- [ ] Evaluation works with all successful actions (all checks true → score 100)

### Known Limitations

1. **Data-only evaluation (MVP)**: LLM evaluates based on action success rates and console errors, not visual inspection of screenshots
   - **Why**: Faster, cheaper, simpler
   - **Future**: Could add vision API to analyze screenshots (detect blank screens, broken layouts, etc.)
   
2. **Discrete scoring only**: Score can only be 0, 30, 40, 70, or 100 (5 possible values)
   - **Why**: Boolean checks with fixed weights
   - **Trade-off**: Less granular than 0-100 range, but more transparent
   - **Benefit**: Easy to understand what passed/failed
   
3. **Simple boolean logic**: Each check is pass/fail with fixed threshold
   - **Current**: successRate ≥50% = pass, <50% = fail
   - **Future**: Could use more sophisticated multi-level scoring
   
4. **No historical comparison**: Each evaluation is independent
   - **Impact**: Can't detect "this game used to work" regressions
   - **Future**: Could store evaluation history and compare trends

