# 02_BROWSER_AGENT

## Overview

Implement the core browser automation agent that uses **LLM-driven decision making** to autonomously play web games. The agent analyzes screenshots using vision models, understands game state, and decides the best actions to take—all without predefined rules. This approach handles diverse game types including canvas-based games, keyboard-controlled games, and DOM-based games.

**Key Features**:
- **LLM-driven gameplay**: Vision model analyzes screen and decides actions using Stagehand's `extract()` with Zod schemas
- **Canvas-first strategy**: Prioritizes keyboard controls for canvas/image-based games (most web games)
- **Direct keyboard access**: Uses Playwright's `page.keyboard.press()` for reliable key presses
- **Action history feedback**: Tracks success/failure to prevent repetition and adapt strategy
- **Screenshot pairs**: Capture before/after screenshots for every action to verify behavior
- **Configurable duration**: Flexible execution time with action limits

## High-Level Approach

1. Initialize Stagehand session (LOCAL or BROWSERBASE) with configured browser settings
2. Navigate to game URL and clean up page (remove ads, distractions)
3. **Enter CUA (Computer Use Agent) gameplay loop**:
   - **Analyze**: LLM examines screen using Stagehand's `extract()` with vision + reasoning
   - **Decide**: LLM recommends specific action based on game state and action history
   - **Execute**: Perform action (keyboard press or click) with before/after screenshots
   - **Learn**: Track action success/failure for next iteration's context
   - Repeat until timeout or action limit reached
4. Return results with screenshots, console logs, and action history
5. Cleanup browser session and resources

## Key Components

### Core Modules

**`src/agent/browser.ts`** - Browser session management
- `BrowserSession` class: Manages Stagehand browser instance lifecycle
- `initialize()`: Create Stagehand session with LOCAL or BROWSERBASE mode
- `navigate(url)`: Load game URL using `page.goto()`
- `getStagehand()`: Return Stagehand instance for act/extract/observe methods
- `getPage()`: Return Playwright page for direct keyboard/mouse access
- `close()`: Cleanup browser session

**`src/agent/screen-analyzer.ts`** - LLM-powered screen analysis and decision making
- `ScreenAnalyzer` class: Uses Stagehand's `extract()` with Zod schemas for type-safe LLM responses
- `analyzeScreen(actionHistory)`: Main analysis method that:
  - Accepts action history with success/failure context (prevents repetition)
  - Uses Stagehand's `extract()` with `ScreenAnalysisSchema` Zod schema
  - Returns structured analysis: game state, game type, visible elements, recommended action, reasoning, confidence
  - **Canvas detection logic**: Identifies canvas-based games and recommends keyboard controls first
  - **Action validation**: Checks action makes sense for current game state
- **Zod Schema** (`ScreenAnalysisSchema`):
  ```typescript
  z.object({
    gameState: z.enum(['menu', 'playing', 'game_over', 'paused', 'loading']),
    gameType: z.string().min(1),
    visibleElements: z.array(z.string()),
    currentSituation: z.string().min(10),
    recommendedAction: z.string().min(10),
    reasoning: z.string().min(20),
    confidence: z.number().min(0).max(1),
  })
  ```
- **Canvas-first strategy**: Prompts explicitly tell LLM to try keyboard controls for canvas games
- **Action format detection**: Recognizes "press ArrowUp" vs "click button" patterns
- Helper methods: `quickStateCheck()`, `isGameBoardVisible()`, `validateAction()`

**`src/agent/actions.ts`** - Game action execution (combines detection + interaction)
- `GameActions` class: Handles both element detection and action execution
- Constructor accepts both Stagehand instance and Playwright page for dual API access
- **`findAndClick(instruction, maxRetries)`**: 
  - Uses `stagehand.act(instruction)` for natural language clicking
  - Built-in retry logic (default 2 attempts)
  - Returns `SimpleActionResult` with success status, timestamp, error
- **`pressKey(key, maxRetries)`**: 
  - **Critical**: Uses `page.keyboard.press(key)` directly (Playwright API)
  - Bypasses Stagehand's element lookup (Stagehand's act() doesn't work for keyboard)
  - Essential for canvas-based games (Snake, Tetris, 2048, etc.)
  - Retry logic included
- **`clickCanvas(instruction)`**: 
  - Click on canvas/image elements for canvas-based games
  - Uses `stagehand.act()` to find and click canvas
- **`findElements(instruction)`**: 
  - Uses `stagehand.observe()` to find elements without interacting
  - Returns array of elements for inspection
- **`wait(ms)`**: Simple delay utility
- **Stagehand v3 API**: All methods use correct v3 patterns (act/observe on stagehand instance)

**`src/agent/orchestrator.ts`** - Main agent coordination with CUA (Computer Use Agent) loop
- `BrowserAgent` class: Orchestrates browser session, actions, and LLM analyzer
- `AgentResult` interface: Returns game URL, duration, actions, console logs, screenshots, success status
- **Simplified state machine**: Only MENU and GAME states (enum)
- **`run(gameUrl)`**: Main entry point
  - Initialize browser session (Stagehand + Playwright page)
  - Navigate to URL
  - Create `GameActions` (with both Stagehand and page)
  - Create `ScreenAnalyzer` (with Stagehand)
  - Setup console logging via `page.on('console')` and `page.on('pageerror')`
  - Clean up page (remove ads/distractions via `page.evaluate()`)
  - Enter `gameplayLoop()`
  - Return `AgentResult`
  - Always cleanup in finally block
- **`gameplayLoop(actionResults)`**: CUA Agent implementation
  - Runs for configurable duration (default 15 seconds in config)
  - **Each iteration**:
    1. **Analyze**: Call `analyzer.analyzeScreen(contextualHistory)` with action history + success/failure
    2. **Validate**: Check confidence threshold, fallback if too low
    3. **Decide**: Extract recommended action from LLM analysis
    4. **Capture before screenshot**: `captureGameScreenshot()`
    5. **Execute**: Detect if keyboard action (regex match "^press \\w+") or click action
       - Keyboard: `actions.pressKey(key)` (Playwright API)
       - Click: `actions.findAndClick(instruction)` (Stagehand API)
    6. **Capture after screenshot**: `captureGameScreenshot()`
    7. **Learn**: Add action + result to history (last 5 actions kept)
    8. **Adapt**: Log recent failures, provide feedback for stuck detection
  - Exits on: time limit, action limit, or crash
- **Action history feedback loop**: Contextual history passed to LLM includes success/failure markers (✓/✗)
- **Adaptive wait times**: Longer waits for menus (2500ms), shorter for gameplay (1500ms)
- Helper methods: `setupConsoleLogging()`, `captureGameScreenshot()`, `cleanupPage()`, `cleanup()`

## Implementation Approach

### 1. **Browser Session Management** (`src/agent/browser.ts`)
   - Initialize Stagehand with LOCAL or BROWSERBASE mode:
     ```typescript
     const stagehand = new Stagehand({
       env: config.browserMode as 'LOCAL' | 'BROWSERBASE',
       apiKey: config.browserbaseApiKey,
       projectId: config.browserbaseProjectId,
       verbose: config.verbose ? 2 : 0,
       debugDom: config.debugDom || false,
       enableCaching: true,
     });
     await stagehand.init();
     ```
   - **Dual API access pattern**:
     - Store Stagehand instance for `act()`, `extract()`, `observe()` methods
     - Extract Playwright page via `stagehand.context.pages()[0]` for `keyboard.press()` and event listeners
   - Navigate using `page.goto(url, { waitUntil: 'domcontentloaded' })`
   - Cleanup with `await stagehand.close()`

### 2. **LLM-Powered Screen Analysis** (`src/agent/screen-analyzer.ts`)
   - **Core innovation**: Use Stagehand's `extract()` with Zod schemas for type-safe LLM analysis
   - Stagehand v3 API pattern:
     ```typescript
     const analysis = await stagehand.extract(
       "Analyze the game screen and recommend next action",
       ScreenAnalysisSchema  // Zod schema for validation
     );
     ```
   - **Comprehensive prompt engineering**:
     - Include action history with success/failure markers (✓/✗)
     - Explain canvas vs DOM game detection strategy
     - Provide explicit rules: "If you clicked Start before, DON'T click it again"
     - Canvas-first guidance: "Try keyboard first, then canvas click, then DOM"
   - **Schema validation**: Ensures LLM always returns valid JSON matching expected structure
   - **Confidence thresholding**: Reject actions below 0.4 confidence, use fallbacks

### 3. **Action Execution System** (`src/agent/actions.ts`)
   - **Hybrid approach** - Combines Stagehand and Playwright APIs:
     - **For clicks**: Use `stagehand.act(instruction)` - AI finds and clicks elements
     - **For keyboard**: Use `page.keyboard.press(key)` - Direct Playwright access
   - **Why this matters**:
     - Stagehand's `act()` ALWAYS looks for DOM elements, even for keyboard instructions
     - `act("press ArrowUp")` fails with "No object generated" because it tries to find an "ArrowUp" element
     - Direct `page.keyboard.press()` bypasses element lookup and works reliably
   - **Retry logic**: All actions retry 2x by default with 1s delay
   - **Result tracking**: Return `SimpleActionResult` with success, action, timestamp, error

### 4. **CUA (Computer Use Agent) Loop** (`src/agent/orchestrator.ts`)
   - **Main innovation**: Autonomous decision-making loop driven by LLM analysis
   - **Loop structure**:
     ```typescript
     while (Date.now() - startTime < maxDuration) {
       // 1. Analyze: LLM examines screen + action history
       const analysis = await analyzer.analyzeScreen(contextualHistory);
       
       // 2. Validate: Check confidence and action quality
       if (!actionToTake || confidence < 0.4) {
         // Use fallback or retry
       }
       
       // 3. Capture before state
       const beforePath = await captureGameScreenshot();
       
       // 4. Execute: Detect keyboard vs click action
       const keyMatch = action.match(/^press\s+(\w+)/i);
       const result = keyMatch 
         ? await actions.pressKey(keyMatch[1])
         : await actions.findAndClick(action);
       
       // 5. Capture after state
       const afterPath = await captureGameScreenshot();
       
       // 6. Learn: Add to history with success/failure
       actionHistory.push(`${action} (${result.success ? '✓' : '✗'})`);
       
       // 7. Adapt: Provide feedback if stuck
       if (recentFailures >= 2) {
         logger.warn('Agent might be stuck');
       }
     }
     ```
   - **Feedback loop**: Each iteration learns from previous actions
   - **State management**: Simple MENU vs GAME state machine
   - **Adaptive timing**: Different wait times based on game state

### 5. **Page Cleanup and Optimization**
   - Remove ads and distractions using `page.evaluate()`:
     - Target common ad selectors (Google ads, iframes, etc.)
     - Remove elements matching ad dimensions (728×90, 300×250, etc.)
     - Keep game-related elements (anything with "game" in class/id)
   - Improves LLM focus on actual game content
   - Reduces noise in accessibility tree

### 6. **Console Logging and Monitoring**
   - Setup event listeners on Playwright page:
     ```typescript
     page.on('console', msg => {
       consoleLogs.push({
         type: msg.type(),
         message: msg.text(),
         timestamp: new Date(),
       });
     });
     page.on('pageerror', error => {
       consoleLogs.push({
         type: 'error',
         message: error.message,
         timestamp: new Date(),
       });
     });
     ```
   - Note: May not work with remote BROWSERBASE sessions due to debugging protocol limitations

### 7. **Screenshot Capture Strategy**
   - **When to capture**:
     - Before each action (verify starting state)
     - After each action (verify result)
   - **What to capture**:
     - Find game container once: `observe("find the game container, game canvas, or main game area")`
     - If found: Screenshot just that element (focused)
     - If not found: Screenshot full page (fallback)
   - **File naming**: `action-{count}-{before|after}.png`
   - **Storage**: Write to configurable output directory

## Dependencies

### Internal Dependencies
- `src/config/index.ts` - Browser configuration and timeouts
- `src/types/index.ts` - Base types (QAResult, Issue)
- `src/utils/logger.ts` - Logging utilities

### External Dependencies
- `@browserbasehq/stagehand` - Browser automation framework (observe, act, extract)
- Browserbase API - Remote browser instances

### Integration Dependencies
- Reporting module (03_REPORTING) - For screenshot capture and artifact storage

## Key Architectural Decisions

### Why LLM-Driven Instead of Hardcoded Rules?
**Problem**: Every game has different UI patterns, controls, and mechanics. Hardcoding detection logic doesn't scale.

**Solution**: Let vision model analyze screenshots and decide actions autonomously.

**Benefits**:
- Works with games we've never seen before
- Adapts to different UI patterns automatically
- Handles canvas games, DOM games, and hybrids equally well
- Reasoning is visible in logs for debugging

**Trade-offs**:
- Slower than hardcoded rules (LLM call per action)
- More expensive (vision model + reasoning)
- Requires good prompt engineering
- Can make mistakes that hardcoded logic wouldn't

### Why Separate Stagehand and Playwright APIs?
**Problem**: Stagehand v3's `act()` doesn't work for keyboard input—it always looks for DOM elements.

**Solution**: Use both APIs for their strengths:
- **Stagehand** (`act`, `extract`, `observe`): AI-powered element detection and clicking
- **Playwright** (`page.keyboard`, event listeners): Direct browser control

**Pattern**:
```typescript
class GameActions {
  constructor(stagehand: any, page: any) {
    this.stagehand = stagehand;  // For AI actions
    this.page = page;             // For keyboard/events
  }
  
  // Use Stagehand for clicks
  async findAndClick(instruction: string) {
    await this.stagehand.act(instruction);
  }
  
  // Use Playwright for keyboard
  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }
}
```

### Why Canvas-First Strategy?
**Discovery**: Most modern web games use canvas rendering, not DOM elements.

**Evidence**:
- Snake games: Canvas with keyboard controls
- Tetris clones: Canvas with arrow keys
- Tic-tac-toe: Often canvas with click detection
- Pong: Canvas with keyboard/mouse

**Strategy Evolution**:
1. **Old assumption**: Games use clickable DOM elements
2. **Reality check**: Most use canvas → DOM clicks fail
3. **New strategy**: Detect canvas → try keyboard first
4. **Results**: Success rate improved dramatically

### Why Action History Feedback Loop?
**Problem**: LLM keeps repeating failed actions without context.

**Example**:
```
Action 1: "click start button" → Success ✓
Action 2: "click start button" → Fails (button gone)
Action 3: "click start button" → Fails again (repeating mistake)
```

**Solution**: Include history in each analysis prompt:
```typescript
const contextualHistory = actionHistory.map((action, i) => {
  const result = actionResults[i];
  return `${action} ${result.success ? '✓' : '✗'}`;
});

await analyzer.analyzeScreen(contextualHistory);
```

**Prompt includes**:
```
PREVIOUS ACTIONS:
1. click start button ✓
2. click start button ✗

IMPORTANT:
- If an action succeeded, the page should have changed
- If an action failed, don't repeat it unless situation changed
```

**Results**: LLM adapts strategy based on what worked.

### Why Zod Schemas for LLM Responses?
**Problem**: LLM can return invalid JSON or unexpected fields.

**Solution**: Use Zod for runtime validation:
```typescript
const ScreenAnalysisSchema = z.object({
  gameState: z.enum(['menu', 'playing', 'game_over', 'paused', 'loading']),
  recommendedAction: z.string().min(10),
  reasoning: z.string().min(20),
  confidence: z.number().min(0).max(1),
});

// Stagehand validates response against schema
const analysis = await stagehand.extract(prompt, ScreenAnalysisSchema);
// analysis is now type-safe!
```

**Benefits**:
- Type safety in TypeScript
- Runtime validation catches LLM mistakes
- Clear error messages when schema doesn't match
- Self-documenting API contract

## Integration Points

- **Consumes**: Configuration from PROJECT_SETUP, browser config from environment
- **Produces**: Screenshots, console logs, detected elements for REPORTING module
- **Feeds**: Evidence data to AI_EVALUATION module for analysis
- **Called by**: EXECUTION_INTERFACE for main test runs

## Testing Strategy

### Quick Test Command
```bash
# Test single game with LOCAL browser
bun qa.ts https://playtictactoe.com

# Test with BROWSERBASE (requires API keys in .env)
BROWSER_MODE=BROWSERBASE bun qa.ts https://playtictactoe.com
```

### Good Test Games
- ✅ **Tic-tac-toe** (playtictactoe.com): Canvas-based, click testing
- ✅ **Snake** (isnoahalive.com/games/snake): Keyboard-based, arrow key testing  
- ✅ **2048**: Keyboard-based, arrow key testing
- ✅ **Pong** (isnoahalive.com/games/pong): Canvas-based, keyboard controls
- ❌ **Multiplayer games**: Avoid (triggers waiting states, not suitable for testing)

### Known Issues and Learnings

1. **Stagehand v3 vs v4 API Confusion**
   - ❌ **Wrong**: `await page.act()` (v4 API - doesn't exist in v3)
   - ✅ **Correct**: `await stagehand.act()` (v3 API - act on instance)
   - Always call `act()`, `extract()`, `observe()` on Stagehand instance, not page

2. **Keyboard Actions Don't Work with Stagehand act()**
   - **Problem**: `stagehand.act("press ArrowUp")` fails with "No object generated"
   - **Root cause**: Stagehand's `act()` always looks for DOM elements, even for keyboard
   - **Solution**: Use direct Playwright API: `page.keyboard.press('ArrowUp')`
   - **Impact**: Essential for canvas games (Snake, Tetris, racing games, etc.)

3. **Canvas Games Need Different Strategy**
   - Most web games use `<canvas>` or `<image>` elements, not clickable DOM
   - LLM must recognize canvas games and prioritize keyboard controls
   - Prompt engineering critical: explicitly tell LLM "try keyboard first for canvas"
   - Fallback: click on canvas element itself if keyboard doesn't work

4. **Action Repetition Without History**
   - LLM will repeat failed actions without context
   - **Solution**: Pass action history with success/failure markers to each analysis
   - Format: `"click start button (succeeded) → press ArrowUp (failed)"`
   - Keep last 5 actions in context window

5. **Confidence Thresholding**
   - Low confidence (<0.4) indicates LLM uncertainty
   - First attempt: Retry analysis after 2s delay
   - Subsequent attempts: Use simple fallback ("click any button")
   - Prevents agent from making random bad decisions

6. **Remote Console Logging Limitations**
   - `page.on('console')` may not work with BROWSERBASE
   - Remote debugging protocol doesn't always propagate events
   - Use LOCAL mode if console logs are critical for debugging

### Debugging Tools

```typescript
// In Stagehand config for max verbosity
{
  verbose: 2,        // See all Stagehand LLM calls
  debugDom: true,    // Log DOM snapshot sent to LLM
}
```

### Future Enhancements
1. **Canvas coordinate clicking** - Click specific pixel coordinates on canvas
2. **Vision model improvements** - Better canvas game state understanding  
3. **Multi-step planning** - Plan N actions ahead instead of 1 at a time
4. **Use Stagehand Agent mode** - Let Stagehand handle full autonomous flow

