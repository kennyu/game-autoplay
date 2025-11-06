# Testing Guide

This guide explains how to test the browser game QA agent codebase.

## Quick Start

### Run All Tests
```bash
bun run test:all
```

### Run Individual Tests
```bash
# Basic integration test (full game test)
bun run test:basic

# Browser session test
bun run test:browser

# UI detector test
bun run test:detector

# UI interactor test
bun run test:interactor
```

## Test Files

### 1. Basic Integration Test (`test/basic-test.ts`)
Tests the complete game testing workflow:
- Loads a game URL
- Executes the full agent workflow
- Verifies screenshots are captured
- Verifies actions are performed
- Reports console logs and errors

**Usage:**
```bash
bun run test:basic
```

**What it tests:**
- ✅ End-to-end game testing flow
- ✅ Screenshot capture
- ✅ Action execution
- ✅ Error handling
- ✅ State management

### 2. Browser Session Test (`test/test-browser.ts`)
Tests browser initialization and navigation:
- Validates configuration
- Creates browser session
- Navigates to test URL
- Verifies page access

**Usage:**
```bash
bun run test:browser
```

**What it tests:**
- ✅ Configuration validation
- ✅ Browser session initialization
- ✅ Page navigation
- ✅ Page rendering
- ✅ Cleanup

### 3. UI Detector Test (`test/test-detector.ts`)
Tests UI element detection:
- Finds interactive elements
- Detects start buttons
- Detects game over screens
- Custom element observation

**Usage:**
```bash
bun run test:detector
```

**What it tests:**
- ✅ Interactive element detection
- ✅ Start button detection
- ✅ Game over screen detection
- ✅ Custom observation queries

### 4. UI Interactor Test (`test/test-interactor.ts`)
Tests UI interaction capabilities:
- Clicks elements
- Types text
- Performs actions

**Usage:**
```bash
bun run test:interactor
```

## Running Tests Manually

### Direct Execution
You can run tests directly without npm scripts:

```bash
# Basic test
bun run test/basic-test.ts

# Browser test
bun run test/test-browser.ts

# Detector test
bun run test/test-detector.ts

# Interactor test
bun run test/test-interactor.ts
```

### With Custom URLs
You can modify test files to use different game URLs, or pass URLs via command line:

```bash
# Run main entry point with custom URL
bun run src/index.ts https://example.com/game

# Or modify test files to use URLs from url-to-test.txt
```

## Testing Different Games

The `url-to-test.txt` file contains example game URLs:
- `https://www.playtictactoe.org`
- `https://isnoahalive.com/games/snake/`
- `https://isnoahalive.com/games/pong/`

To test with a different URL, you can:

1. **Modify the test file directly:**
   ```typescript
   const gameUrl = 'https://your-game-url.com';
   ```

2. **Use command line argument (for main entry point):**
   ```bash
   bun run src/index.ts https://your-game-url.com
   ```

3. **Use environment variable:**
   ```bash
   GAME_URL=https://your-game-url.com bun run test:basic
   ```

## Environment Setup

Before running tests, ensure you have:

1. **Environment variables configured** (`.env.local`):
   ```bash
   BROWSERBASE_API_KEY=your_key
   BROWSERBASE_PROJECT_ID=your_project_id
   OPENAI_API_KEY=your_openai_key
   ```

2. **Dependencies installed:**
   ```bash
   bun install
   ```

## Using Bun's Built-in Test Runner

Bun has a built-in test runner. To use it, create test files with `.test.ts` extension:

```typescript
// test/example.test.ts
import { test, expect } from "bun:test";
import { runGameTest } from '../src/index.js';

test("game test runs successfully", async () => {
  const state = await runGameTest('https://www.playtictactoe.org');
  expect(state.phase).toBeDefined();
  expect(state.actions.length).toBeGreaterThan(0);
});
```

Then run:
```bash
bun test
```

## Test Output

Tests will output:
- ✅ **Pass indicators** for successful checks
- ❌ **Fail indicators** for failed checks
- ⚠️ **Warnings** for non-critical issues
- **Detailed logs** showing what was tested
- **Error messages** if tests fail

## Debugging Tests

### Enable Verbose Logging
Set environment variable for more detailed output:
```bash
DEBUG=true bun run test:basic
```

### Check Screenshots
Screenshots are saved to the `output/` directory. Check them to verify what the agent saw:
```bash
ls output/
```

### Check Console Logs
Test output includes console logs captured during browser automation. Look for errors or warnings in the test output.

## Continuous Testing

### Watch Mode
For development, you can use Bun's watch mode:
```bash
bun run --watch test/basic-test.ts
```

### CI/CD Integration
Tests exit with appropriate exit codes:
- `0` = success
- `1` = failure

This makes them suitable for CI/CD pipelines.

## Best Practices

1. **Run tests before committing code**
2. **Add new tests when adding features**
3. **Keep test URLs updated** in `url-to-test.txt`
4. **Check screenshots** to verify visual correctness
5. **Monitor API usage** - tests consume Browserbase and OpenAI API credits

## Troubleshooting

### Tests Fail to Connect
- Check your `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`
- Verify your internet connection
- Check Browserbase service status

### Tests Timeout
- Increase timeout in config: `MAX_EXECUTION_TIME_MS`
- Check if the game URL is accessible
- Verify network connectivity

### No Screenshots Captured
- Check `output/` directory permissions
- Verify screenshot interval is not too long
- Check browser session initialization

### Actions Not Executing
- Verify game URL is correct
- Check if game requires authentication
- Review detector output for found elements




