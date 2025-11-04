# 02_BROWSER_AGENT

## Overview

Implement the core browser automation agent that loads games from URLs, detects UI patterns (start buttons, menus, game over screens), simulates user interactions (clicks, keyboard input), and monitors game state. Includes timeout handling, retry logic, and interaction detection.

## High-Level Approach

1. Initialize Browserbase/Stagehand session with configured browser settings
2. Navigate to game URL and wait for initial render
3. Detect interactive elements using Stagehand's AI-powered element detection
4. Execute interaction sequence: find start/play buttons, simulate gameplay inputs
5. Monitor page state for crashes, freezes, or errors via console logs and DOM state
6. Implement timeout and retry mechanisms for failed loads
7. Track action sequence and game state transitions

## Key Components

### Core Modules

**`src/agent/browser.ts`** - Browser session management
- `BrowserSession` class: Manages browser instance lifecycle
- `initialize()`: Create browser session with config
- `navigate(url)`: Load game URL with retry logic
- `waitForRender()`: Wait for page to be interactive

**`src/agent/detector.ts`** - UI pattern detection using Stagehand observe()
- `UIDetector` class: Detects common game UI elements using Stagehand's `observe()` method
- `findStartButton()`: Use `page.observe("find the start/play button")` - Returns array of ObserveResult objects
- `findMenuElements()`: Use `page.observe("find menu items or navigation elements")` - Detect menus
- `findGameOverScreen()`: Use `page.observe("find game over screen or end game indicator")` - Identify end-game states
- `findInteractiveElements()`: Use `page.observe("find all clickable buttons")` - Discover UI elements
- Returns ObserveResult[] arrays with properties: `description`, `selector`, `method`, `bounds`
- Can be passed directly to `page.act(observeResult)` without additional LLM calls (cost optimization)
- Supports filtering: `const buttons = await page.observe("find buttons"); const startBtn = buttons.find(b => b.description.includes("start"))`

**`src/agent/interactor.ts`** - User interaction simulation using Stagehand act()
- `GameInteractor` class: Simulates user actions using Stagehand's `act()` method
- `clickElement(observeResult)`: Use `page.act(observeResult)` - Pass ObserveResult directly (no additional LLM call, cost-efficient)
- `clickByInstruction(instruction)`: Use `page.act("click the start button")` - Natural language action (requires LLM call)
- `actWithOptions(action, options)`: Use `page.act({ action: "...", domSettleTimeoutMs: 45000, timeoutMs: 60000 })` - Advanced options
- `simulateKeyboardInput(keys)`: Access Playwright keyboard API via `page.keyboard.press("ArrowUp")` for direct key presses
- `simulateKeyboardByInstruction(instruction)`: Use `page.act("press the arrow keys")` - Natural language keyboard input
- `executeActionSequence(actions)`: Run ordered sequence combining observe() + act() pattern for efficiency
- `executeWithVariables(action, variables)`: Use `page.act({ action: "enter %text%", variables: { text: "..." } })` - Variables for dynamic content

**`src/agent/monitor.ts`** - Game state monitoring using Stagehand
- `GameMonitor` class: Tracks game health and state using Stagehand's page API
- `watchConsoleErrors()`: Use `page.on('console')` and `page.on('pageerror')` to capture console.log, console.error messages
- `detectFreeze()`: Use `page.waitForTimeout()` with DOM mutation observers to check if page is frozen
- `detectCrash()`: Use `page.observe("find error overlay or crash indicator")` or check for blank screens via `page.extract()` with crash detection schema
- `getPageState()`: Capture current DOM state using `page.screenshot()` and `page.extract()` with structured schema
- `extractGameState()`: Use `page.extract({ instruction: "extract game state", schema: z.object({...}) })` for structured state data
- Access Playwright page API via `stagehand.page` for advanced monitoring: `page.evaluate()`, `page.metrics()`, etc.

**`src/agent/orchestrator.ts`** - Main agent coordination (simplified workflow)
- `BrowserAgent` class: Orchestrates all agent components using a simple sequential workflow
- Define `AgentState` interface with fields: `phase`, `evidence`, `screenshots`, `consoleLogs`, `actions`, `gameUrl`, component instances
- Create workflow methods:
  - `initialize()`: Initialize Stagehand session, navigate to URL, create component instances
  - `observe()`: Wait for render, capture baseline screenshot, detect initial UI
  - `interact()`: Find start button, execute gameplay actions
  - `monitor()`: Collect console logs, detect crashes/freezes, extract game state
  - `evaluate()`: Prepare evidence for AI evaluation module
  - `cleanup()`: Close browser session and cleanup resources
- `run(gameUrl)`: Execute workflow in sequence with try/finally for guaranteed cleanup
- `execute()`: Alias for run() method

## Implementation Steps

1. **Browser Session Management**
   - Create `src/agent/browser.ts` with BrowserSession class
   - Initialize Stagehand with Browserbase configuration:
     ```typescript
     const stagehand = new Stagehand({
       env: "BROWSERBASE",
       apiKey: process.env.BROWSERBASE_API_KEY,
       projectId: process.env.BROWSERBASE_PROJECT_ID,
       enableCaching: true, // Cache observed actions to reduce LLM calls
     });
     await stagehand.init();
     const page = stagehand.page;
     ```
   - Implement connection to Browserbase API via Stagehand
   - Add session initialization with configurable options (headless, viewport, etc.)
   - Implement cleanup/dispose methods: `await stagehand.close()`

2. **Navigation and Loading**
   - Implement `navigate()` method using `page.goto(url)` with URL validation
   - Add retry logic (up to 3 attempts) for failed loads
   - Create `waitForRender()` using `page.waitForLoadState('networkidle')` or `'domcontentloaded'`
   - Add timeout handling (5 minute max execution time)
   - Use Stagehand's built-in retry capabilities via options: `{ timeoutMs: 60000 }`

3. **UI Detection Module**
   - Create `src/agent/detector.ts` with UIDetector class
   - Use Stagehand's `page.observe()` method for AI-powered element detection:
     - `page.observe("find the start button or play button")` - Returns array of detected elements
     - `page.observe("find menu items or navigation")` - Detect menu elements
     - `page.observe("find game over screen")` - Identify end-game states
     - `page.observe("find all clickable buttons")` - Discover interactive elements
   - Observe results are ObserveResult objects with `description`, `selector`, `method` properties
   - Can be passed directly to `page.act()` without additional LLM calls (cost optimization)
   - Implement fallback heuristics: if observe() returns empty, try more specific instructions

4. **Interaction Simulation**
   - Create `src/agent/interactor.ts` with GameInteractor class
   - Use Stagehand's `page.act()` method for natural language actions:
     - `page.act("click the start button")` - Natural language clicking
     - `page.act(observeResult)` - Direct action on observed element (cost-efficient, no LLM call)
     - `page.act({ action: "type text", variables: {...} })` - Typing with variables
   - For keyboard input, use Stagehand's underlying Playwright page API:
     - `page.keyboard.press("ArrowUp")` - Arrow keys
     - `page.keyboard.press("Space")` - Spacebar
     - `page.keyboard.press("Enter")` - Enter key
     - `page.keyboard.press("KeyW")` - WASD keys
   - Or use natural language: `page.act("press the arrow keys to move")`
   - Create action sequence executor combining observe() + act() pattern:
     1. Observe to find elements (cache results)
     2. Act on observed elements (reuse without LLM calls)
   - Add timing controls and action counting to prevent infinite loops

5. **Monitoring System**
   - Create `src/agent/monitor.ts` with GameMonitor class using Stagehand
   - Set up console log listeners using Stagehand's page API:
     - `page.on('console', msg => { /* capture console.log/error */ })`
     - `page.on('pageerror', error => { /* capture page errors */ })`
   - Implement freeze detection:
     - Use `page.waitForTimeout()` with DOM mutation observers
     - Check if DOM stops updating over time window
   - Detect crash indicators using Stagehand:
     - `page.observe("find error overlay or crash message")` - AI-powered crash detection
     - `page.extract({ instruction: "detect if page crashed", schema: crashSchema })` - Structured crash detection
     - Check for blank screens via screenshot analysis
   - Track page state changes:
     - Use `page.screenshot()` at intervals
     - Use `page.extract()` with Zod schema to extract structured game state
     - Access Playwright metrics: `page.metrics()` for performance data

6. **Agent Orchestrator (Simplified Workflow)**
   - Create `src/agent/orchestrator.ts` with BrowserAgent class
   - Define `AgentState` interface:
     ```typescript
     export interface AgentState {
       gameUrl: string;
       phase: string;
       evidence: Record<string, unknown>;
       screenshots: string[];
       consoleLogs: ConsoleLog[];
       actions: Array<Record<string, unknown>>;
       errors: string[];
       browserSession: BrowserSession | null;
       detector: UIDetector | null;
       interactor: GameInteractor | null;
       monitor: GameMonitor | null;
     }
     ```
   - Create workflow methods:
     - **`initialize()`**: Initialize Stagehand, navigate to URL, create component instances
     - **`observe()`**: Wait for render, capture baseline screenshot, detect UI
     - **`interact()`**: Find start button via detector, execute actions via interactor
     - **`monitor()`**: Collect console logs, detect crashes/freezes, extract state
     - **`evaluate()`**: Prepare evidence for AI evaluation module
     - **`cleanup()`**: Close browser session and cleanup resources
   - Implement sequential workflow execution:
     ```typescript
     async run(gameUrl: string): Promise<AgentState> {
       const state = this.initializeState(gameUrl);
       try {
         await this.initialize(state);
         await this.observe(state);
         await this.interact(state);
         await this.monitor(state);
         await this.evaluate(state);
         return state;
       } catch (error) {
         state.phase = 'error';
         state.errors.push(error.message);
         throw error;
       } finally {
         await this.cleanup(state);
       }
     }
     ```
   - Error handling via try/catch with state mutation
   - Guaranteed cleanup via finally block

7. **Action Sequence Logic**
   - Define default interaction patterns using Stagehand API:
     - **Pattern 1 (Cost-optimized)**: `observe()` → `act(observeResult)`
       - `const [startButton] = await page.observe("find start button")`
       - `await page.act(startButton)` - No additional LLM call, reuses observed result
     - **Pattern 2 (Natural language)**: Direct `act()` with instructions
       - `await page.act("click the start button")` - Single LLM call for action
     - **Pattern 3 (Mixed)**: Combine observe for discovery, act for execution
       - Observe multiple elements, then act on selected ones
   - Execute 2-3 basic gameplay actions:
     - Keyboard: `page.keyboard.press("ArrowRight")` (Playwright API) or `page.act("press arrow keys")` (natural language)
     - Mouse: `page.act("click on the game area")` or `page.act(observedGameArea)`
   - Navigate through 2-3 screens using observe + act pattern:
     - Observe next screen elements, act to navigate
     - Screenshot the screen
   - Cache observed elements to reduce LLM calls (enableCaching in Stagehand config)
   - Add configurable action sequences per game type
   - Implement action counting to prevent infinite loops (max actions per phase)

8. **Integration with Reporting**
   - Capture screenshots at key phases (initial, after interactions, final)
   - Collect console logs throughout execution
   - Pass evidence to reporting module for storage

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

## Integration Points

- **Consumes**: Configuration from PROJECT_SETUP, browser config from environment
- **Produces**: Screenshots, console logs, detected elements for REPORTING module
- **Feeds**: Evidence data to AI_EVALUATION module for analysis
- **Called by**: EXECUTION_INTERFACE for main test runs

## Testing Strategy

1. **Unit Tests**
   - Test UI detection with mock page elements
   - Test interaction simulation with test pages
   - Test monitor logic with injected console errors

2. **Integration Tests**
   - Test full agent flow with simple test game (e.g., static HTML game)
   - Verify retry logic with flaky network conditions
   - Test timeout handling with slow-loading pages

3. **Manual Testing**
   - Run against diverse game types (puzzle, platformer, idle)
   - Verify detection works with different UI patterns
   - Test error handling with intentionally broken games

4. **Edge Cases**
   - Games that don't load
   - Games with no start button
   - Games that crash immediately
   - Games with very slow rendering

