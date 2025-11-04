# Browser Game QA Pipeline

An AI Agent that autonmousely tests browser games by simulating user interactions, capturing visual evidence, and evaluating playability metrics. System must work with any web-hosted game URL.

### Success Criteria

- Successfully tests 3+ diverse browser games end-to-end
- Generates structured reports on playability assessment
- Handles common failure modes gracefully ( crashes, slow loads, rendering issues )
- Clean, documented, modular codebase

## Scope

## Browser Agent 
- Load game from URL
- Detect and handle common UI patterns (start buttons, menus, game over screens)
- Walk through the game based on the controls it finds
- Implement timeouts and retry logic

## Reporting
- Take 3-5 timestamped screenshots per test session
- Save artifacts to structured output directory
- Include console logs and error messages

## Evaluation with AI
- Use LLM to analyze screenshot and logs
- Assess:
    Successful load
    Responsive controls
    Stability
- Output JSON:
    Pass / Fail
    Confidence Scores
    Issue Descriptions

## Execution Interface
- Game Dev Agent runs in a serverless function. Invoke the QA from this environment
- Typescript with `bun run qa.ts`
- CLI command `qa-agent <game-url>`
- Structured output:  `{status, playability_score, issues[], screenshots[], timestamp}`

## Assumption
- Single player games
- Played on web browser

## Stretch Features
- **GIF Recording:** Capture gameplay as animated GIF for reports
- **Batch Testing** Sequential testing of multiple URLs with aggregated reporting
- **Advanced Metrics:** FPS monitoring, load time analysis
- **Web Dashboard:** Simple UI for viewing test results and history

## Technical Architecture

### Stack

- **Browser Use:** [Browserbase](https://www.browserbase.com/) w/ [Stagehand](https://www.npmjs.com/package/@browserbasehq/stagehand) (recommended)
- **Language:** Typescript preferred 
- **LLM Framework:** 
   OpenAI SDK
   Stagehand AI functions

## Agent Design

1. Initialize -> Load game URL in headless browser
2. Observe -> Wait for initial render, capture baseline screenshot
3. Interact -> Execute action sequence:
    1. Find and click start / play buttons
    2. Simulate basic gameplay ( arrow keys, spacebar, mouse clicks )
    3. Navigate 2-3 screens if applicable
4. Monitor -> Detect crashes, freezes, or errors via:
    1. Console error logs
    2. Page state changes
    3. Screenshot
5. Repeat Step 3 until 5 minute play time or crash / bug
5. Evaluate -> Submit evidence to LLM with structure prompt:
    1. "Does game load successfully?"
    2. "Are the controls responsive?"
    3. "Did the game complete without crashes?"
6. Report -> Generate JSON output with findings

## Error Handling

- Max execution time: 5 minutes per game
- Retry failed loads up to 3 times
- Graceful degredation if screenshots fail

## Test Cases

Validate against diverse game types:
1. **Simple Puzzle:** Basic click interaction (e.g. tic-tac-toe)
2. **Platformer:** Keyboard controls, physics (e.g. simple Mario clone)
3. **Idle/Clicker:** Minimal interaction, persistent state
4. **Broken Game:** Intentionally buggy game to test failure detection

## Risks and Mitigations
1. Agent loogs infinitely - Max action count, total timeout
2. LLM gives inconsistent results - Structured prompts, fallback heuristics
3. Games don't load in headless mode - Test with headed mode, screenshot comparison

## Approach
1. Create minimal agent that loads a game and takes a screenshot
2. Add on interaction type at a time
3. Integrate LLM evaluation last
4. Iterate on real games early and often