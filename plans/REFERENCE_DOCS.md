# Reference Documentation

This document contains key documentation and examples for the libraries used in this project.

## Libraries Used
- **Stagehand** ^3.0.1 - AI-powered browser automation with Browserbase
- **OpenAI** ^6.8.0 - Direct OpenAI API client for LLM evaluation
- **Zod** ^4.1.12 - Runtime type validation and schema definition

## Table of Contents
- [Stagehand (Browser Automation)](#stagehand-browser-automation)
- [OpenAI (LLM Integration)](#openai-llm-integration)
- [Browserbase (Cloud Browser Platform)](#browserbase-cloud-browser-platform)
- [Integration Patterns](#integration-patterns-for-this-project)

---

## Stagehand (Browser Automation)

### Key Features
- AI-powered browser automation framework
- Natural language element detection and interaction
- Integrates with Browserbase for cloud browser sessions
- Supports TypeScript and Python

### Initialization

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

// With Browserbase (cloud) - as used in our implementation
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: 1,
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  enableCaching: true, // Cache observed actions to reduce LLM calls
} as any);

await stagehand.init();

// Small delay to ensure page is ready
await new Promise(resolve => setTimeout(resolve, 500));

// Access page via type casting (Stagehand type exports are limited)
const page = (stagehand as any).page;
```

### Core Methods

**Act (Perform Actions)**
```typescript
// Simple action
await page.act("click the login button");

// With variables for sensitive data
await page.act({
  action: "enter %password% in the password field",
  variables: {
    password: process.env.USER_PASSWORD,
  },
});

// With options
await page.act({
  action: "click the submit button",
  domSettleTimeoutMs: 45000,
  timeoutMs: 60000,
  iframes: true,
});
```

**Observe (Discover Elements)**
```typescript
// Find elements
const buttons = await page.observe("find all clickable buttons");
const [loginButton] = await page.observe("find the login button");

// Use observed action (no additional LLM call)
if (loginButton) {
  await page.act(loginButton);
}
```

**Extract (Structured Data)**
```typescript
import { z } from "zod";

// Define schema for structured extraction
const gameStateSchema = z.object({
  isLoaded: z.boolean().optional(),
  isRunning: z.boolean().optional(),
  score: z.number().optional(),
  level: z.number().optional(),
  isGameOver: z.boolean().optional(),
});

// Extract structured data from page
const gameState = await page.extract({
  instruction: "extract game state including if game is loaded, running, score, level, and if game is over",
  schema: gameStateSchema,
});

// gameState is typed according to schema
console.log(gameState.isLoaded, gameState.score);
```

**Screenshots**
```typescript
// Take screenshots via Playwright API (accessible through Stagehand page)
const screenshot = await page.screenshot({ fullPage: false });
// Returns Buffer that can be saved to file

// Full page screenshot
const fullScreenshot = await page.screenshot({ fullPage: true });
```

### Keyboard and Mouse Input
```typescript
// Direct keyboard access via Playwright API
await page.keyboard.press("ArrowRight");
await page.keyboard.type("Hello world");

// Mouse clicks
await page.mouse.click(100, 200);

// Or use act() for natural language
await page.act("press the arrow keys to move right");
```

### Error Handling and Retry Logic
```typescript
// Retry with fallback patterns
const patterns = [
  'find the start button',
  'find the play button',
  'find any button that starts the game',
];

let clicked = false;
for (const pattern of patterns) {
  try {
    const results = await page.observe(pattern);
    if (results.length > 0) {
      await page.act(results[0]);
      clicked = true;
      break;
    }
  } catch (error) {
    continue; // Try next pattern
  }
}

if (!clicked) {
  // Final fallback with natural language
  await page.act("click the start or play button");
}
```

---

## OpenAI (LLM Integration)

### Basic Setup

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Chat Completion

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a game QA evaluator." },
    { role: "user", content: "Analyze this game based on the evidence..." }
  ],
  temperature: 0.3, // Lower for consistency
});

const response = completion.choices[0].message.content;
```

### Structured Output with JSON Schema

```typescript
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Define Zod schema
const analysisSchema = z.object({
  loaded_successfully: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
  playability_score: z.number().min(0).max(100),
});

// Use structured output
const completion = await openai.beta.chat.completions.parse({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a game QA evaluator." },
    { role: "user", content: "Analyze: ..." }
  ],
  response_format: zodResponseFormat(analysisSchema, "analysis"),
});

const result = completion.choices[0].message.parsed;
// result is typed according to analysisSchema
```

### Streaming

```typescript
const stream = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Analyze this game..." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  console.log(content);
}
```

### Vision API (for Screenshot Analysis)

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Does this game appear to have loaded successfully?" },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Screenshot}`,
          },
        },
      ],
    },
  ],
});

const analysis = completion.choices[0].message.content;
```

---

## Browserbase (Cloud Browser Platform)

### API Overview

**Core Concepts:**
- Browser Session: Instance of a running headless browser
- Session Management: Create, use, and terminate sessions
- Features: Stealth mode, proxies, viewports, screenshots, downloads

### Session Creation (via Stagehand)

When using Stagehand with Browserbase, session management is handled automatically. Configuration:

```typescript
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});
```

### Key Features Available

1. **Screenshots**
   - Automatically available through Stagehand's page API
   - Format: PNG or JPEG
   - Full page or viewport capture

2. **Session Inspector**
   - Monitor network requests
   - View console logs
   - Real-time debugging

3. **Stealth Mode**
   - Evade bot detection
   - Configure via Stagehand options

4. **Viewports**
   - Custom dimensions
   - Configure via Stagehand initialization

5. **Console Logs**
   - Access console.log, console.error, etc.
   - Available through browser/page APIs

### API Endpoints (Reference)

```
POST /sessions
  - Create new browser session
  - Returns: sessionId, url, status

GET /sessions/{id}
  - Get session information

POST /sessions/{id}/navigate
  - Navigate to URL

POST /sessions/{id}/screenshot
  - Capture screenshot

DELETE /sessions/{id}
  - Close session

GET /sessions/{sessionId}/logs
  - Retrieve console logs
```

**Note:** When using Stagehand, these are abstracted away. Direct API access may be needed for advanced features.

---

## Integration Patterns for This Project

### Simplified Architecture (Our Implementation)

Our implementation uses a **simple sequential workflow** (no LangGraph or LangChain):

```typescript
// 1. Initialize Browser Session
const browserSession = new BrowserSession(config);
await browserSession.initialize();
await browserSession.navigate(gameUrl);

// 2. Create Components
const page = browserSession.getPage();
const detector = new UIDetector(page);
const interactor = new GameInteractor(page);
const monitor = new GameMonitor(page);

// 3. Observe & Interact
const startButton = await detector.findStartButton();
await interactor.clickElement(startButton);
await interactor.pressKey('Space');

// 4. Monitor & Collect Evidence
const consoleLogs = monitor.getConsoleLogs();
const gameState = await monitor.extractGameState();
const screenshot = await monitor.takeScreenshot();

// 5. Evaluate with OpenAI
const evaluation = await openai.beta.chat.completions.parse({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a game QA evaluator." },
    { role: "user", content: JSON.stringify({ consoleLogs, gameState }) }
  ],
  response_format: zodResponseFormat(evaluationSchema, "evaluation"),
});

// 6. Cleanup
await browserSession.close();
```

### Complete Workflow Example

```typescript
import { BrowserAgent } from './src/agent';
import { loadConfig } from './src/config';

const config = loadConfig();
const agent = new BrowserAgent(config);

// Simple sequential execution
const result = await agent.run('https://example.com/game');

console.log(`Phase: ${result.phase}`);
console.log(`Screenshots: ${result.screenshots.length}`);
console.log(`Actions: ${result.actions.length}`);
console.log(`Crashed: ${result.evidence.crashed}`);
```

### Cost-Optimized Pattern

```typescript
// EFFICIENT: observe() once, reuse result (1 LLM call)
const buttons = await page.observe("find all buttons");
for (const button of buttons) {
  await page.act(button); // No additional LLM call
}

// EXPENSIVE: Multiple separate act() calls (N LLM calls)
await page.act("click the first button");   // LLM call
await page.act("click the second button");  // LLM call
await page.act("click the third button");   // LLM call

// BEST: Observe → filter → act
const elements = await page.observe("find clickable elements");
const startBtn = elements.find(el => el.description.includes("start"));
if (startBtn) {
  await page.act(startBtn); // Reuse observed result
}
```

---

## Resources

- Stagehand Docs: https://github.com/browserbase/stagehand
- OpenAI API Docs: https://platform.openai.com/docs/api-reference
- Browserbase Docs: https://docs.browserbase.com/

