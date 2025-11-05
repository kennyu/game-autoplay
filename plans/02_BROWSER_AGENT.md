# 02_BROWSER_AGENT

## Overview

Implement the core browser automation agent that loads games from URLs, detects UI patterns (start buttons, menus, game over screens), simulates user interactions (clicks, keyboard input), and monitors game state in a continuous gameplay loop. Includes timeout handling, retry logic, interaction detection, and before/after screenshot capture for debugging.

**Key Features**:
- **Looping gameplay**: Continuous observe-interact-monitor cycles for realistic testing
- **Natural language actions**: All interactions use `page.act("instruction")` for visibility
- **Screenshot pairs**: Capture before/after screenshots for every action to verify behavior
- **Configurable duration**: 1 minute (60000ms) for testing, 5 minutes (300000ms) for production

## High-Level Approach

1. Initialize Browserbase/Stagehand session with configured browser settings
2. Navigate to game URL and wait for initial render, capture initial screenshot
3. **Enter gameplay loop** (runs for MAX_EXECUTION_TIME_MS):
   - **Observe**: Detect interactive elements using Stagehand's AI-powered element detection
   - **Interact**: Execute natural language actions with before/after screenshot capture
   - **Monitor**: Check for crashes, freezes, or errors via console logs and DOM state
   - Repeat until timeout, crash, or action limit reached
4. Prepare evidence (screenshots, logs, actions) for AI evaluation
5. Cleanup browser session and resources

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

**`src/agent/interactor.ts`** - User interaction simulation using Stagehand act() with screenshot capture
- `GameInteractor` class: Simulates user actions using Stagehand's `act()` method with before/after screenshots
- `clickByInstruction(instruction, outputDir)`: Use `page.act("click the start button")` - Natural language action with screenshot capture
  - Captures screenshot BEFORE action (e.g., `01-before-click-start.png`)
  - Executes the natural language action
  - Captures screenshot AFTER action (e.g., `01-after-click-start.png`)
  - Returns `ActionResult` with both screenshot paths, success status, and timestamp
- `simulateKeyboardInput(keys, outputDir)`: Access Playwright keyboard API via `page.keyboard.press("ArrowUp")` with screenshot capture
- `executeActionSequence(actions, outputDir)`: Run ordered sequence of natural language actions with screenshot pairs for each action
- **Natural language preferred**: All interactions use natural language instructions for better debugging and visibility
- **Screenshot pairs**: Every action captures before/after screenshots to verify what Stagehand clicked

**`src/agent/monitor.ts`** - Game state monitoring using Stagehand
- `GameMonitor` class: Tracks game health and state using Stagehand's page API
- `watchConsoleErrors()`: Use `page.on('console')` and `page.on('pageerror')` to capture console.log, console.error messages
- `detectFreeze()`: Use `page.waitForTimeout()` with DOM mutation observers to check if page is frozen
- `detectCrash()`: Use `page.observe("find error overlay or crash indicator")` or check for blank screens via `page.extract()` with crash detection schema
- `getPageState()`: Capture current DOM state using `page.screenshot()` and `page.extract()` with structured schema
- `extractGameState()`: Use `page.extract({ instruction: "extract game state", schema: z.object({...}) })` for structured state data
- Access Playwright page API via `stagehand.page` for advanced monitoring: `page.evaluate()`, `page.metrics()`, etc.

**`src/agent/orchestrator.ts`** - Main agent coordination (looping gameplay workflow)
- `BrowserAgent` class: Orchestrates all agent components using a continuous gameplay loop
- Define `AgentState` interface with fields: `phase`, `evidence`, `screenshots`, `consoleLogs`, `actions`, `gameUrl`, component instances
- Create workflow methods:
  - `initialize()`: Initialize Stagehand session, navigate to URL, create component instances, capture initial screenshot
  - `gameplayLoop()`: **Main loop** - continuously cycle through observe-interact-monitor phases
    - Runs for configurable duration (MAX_EXECUTION_TIME_MS: 60000 for testing, 300000 for production)
    - Loop iterations: observe current state → interact with game → monitor for issues
    - Exits on crash detection, action limit reached, or timeout
  - `observe()`: Detect current UI state, find interactive elements
  - `interact()`: Execute natural language actions with before/after screenshot pairs
  - `monitor()`: Check for crashes, collect console logs, verify game still running
  - `evaluate()`: Prepare all collected evidence for AI evaluation module
  - `cleanup()`: Close browser session and cleanup resources (guaranteed via finally)
- `run(gameUrl)`: Execute workflow: initialize → gameplayLoop → evaluate → cleanup
- **Loop control**: Duration controlled by MAX_EXECUTION_TIME_MS config (1 min testing / 5 min production)

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
   - Add timeout handling (configurable via MAX_EXECUTION_TIME_MS: 60000 for testing, 300000 for production)
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

4. **Interaction Simulation with Screenshot Capture**
   - Create `src/agent/interactor.ts` with GameInteractor class
   - Use Stagehand's `page.act()` method with natural language actions (preferred approach):
     - `page.act("click the start button")` - Natural language clicking
     - `page.act("press the arrow keys to move")` - Natural language keyboard input
   - **Screenshot capture workflow** for every action:
     1. Generate unique filename prefix (e.g., `01`, `02`, `03`)
     2. Capture BEFORE screenshot: `await page.screenshot({ path: '01-before-click-start.png' })`
     3. Execute action: `await page.act("click the start button")`
     4. Capture AFTER screenshot: `await page.screenshot({ path: '01-after-click-start.png' })`
     5. Return ActionResult with both screenshot paths
   - For direct keyboard input (when needed), use Playwright API:
     - `page.keyboard.press("ArrowUp")` - Arrow keys
     - `page.keyboard.press("Space")` - Spacebar
   - Create action sequence executor that produces screenshot pairs for each action
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

6. **Agent Orchestrator (Looping Gameplay Workflow)**
   - Create `src/agent/orchestrator.ts` with BrowserAgent class
   - Define `AgentState` interface:
     ```typescript
     export interface AgentState {
       gameUrl: string;
       phase: string;
       evidence: Record<string, unknown>;
       screenshots: string[];
       consoleLogs: ConsoleLog[];
       actions: ActionResult[];
       errors: string[];
       startTime: Date;
       browserSession: BrowserSession | null;
       detector: UIDetector | null;
       interactor: GameInteractor | null;
       monitor: GameMonitor | null;
     }
     ```
   - Create workflow methods:
     - **`initialize()`**: Initialize Stagehand, navigate to URL, create component instances, capture initial screenshot
     - **`gameplayLoop()`**: Main loop that runs for configured duration
     - **`observe()`**: Detect current UI state, find interactive elements
     - **`interact()`**: Execute natural language actions with before/after screenshot pairs
     - **`monitor()`**: Check for crashes, collect console logs, verify game still running
     - **`evaluate()`**: Prepare all evidence for AI evaluation module
     - **`cleanup()`**: Close browser session and cleanup resources
   - Implement looping workflow execution:
     ```typescript
     async run(gameUrl: string): Promise<AgentState> {
       const state = this.initializeState(gameUrl);
       try {
         await this.initialize(state);
         await this.gameplayLoop(state);
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
     
     async gameplayLoop(state: AgentState): Promise<void> {
       const startTime = Date.now();
       const maxDuration = this.config.maxExecutionTimeMs; // 60000 testing, 300000 production
       
       while (Date.now() - startTime < maxDuration) {
         if (await this.monitor.detectCrash(state)) {
           state.phase = 'crashed';
           break;
         }
         
         await this.observe(state);
         await this.interact(state);
         await this.monitor(state);
         
         if (state.actions.length >= this.config.maxActions) {
           break;
         }
       }
     }
     ```
   - Error handling via try/catch with state mutation
   - Guaranteed cleanup via finally block
   - Loop exits on: timeout, crash, or action limit

7. **Action Sequence Logic in Gameplay Loop**
   - Use **natural language pattern** for all interactions (preferred for debugging):
     - `await page.act("click the start button")` - Natural language with LLM
     - `await page.act("press the spacebar to jump")` - Natural language keyboard
     - `await page.act("click on the game area")` - Natural language mouse actions
   - **Continuous gameplay interaction**:
     - Loop continuously executes observe-interact-monitor cycles
     - Each loop iteration performs 1-2 actions based on observed UI
     - Actions include: clicking buttons, pressing keys, navigating menus
     - Each action produces a before/after screenshot pair
   - **Screenshot naming convention**:
     - Sequential numbering: `01-before-action.png`, `01-after-action.png`, `02-before-action.png`, etc.
     - Descriptive names help identify what action was performed
   - **Loop control mechanisms**:
     - Time limit: MAX_EXECUTION_TIME_MS (60000 for testing, 300000 for production)
     - Action limit: Max actions per session (default 100)
     - Crash detection: Exit loop if game crashes
   - Cache observed elements to reduce LLM calls (enableCaching in Stagehand config)

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

