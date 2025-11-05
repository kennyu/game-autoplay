# Stagehand

Stagehand is an AI-powered browser automation framework that bridges the gap between low-level Playwright code and unpredictable high-level agents. By allowing developers to choose when to use natural language versus explicit code, Stagehand enables building production-ready browser automations that are both reliable and adaptive. Built on Playwright with support for multiple LLM providers, it provides methods for performing individual actions (`act`), extracting structured data (`extract`), discovering page elements (`observe`), and executing complex multi-step workflows (`agent`).

The framework integrates seamlessly with Browserbase for cloud browser sessions and supports local browser automation with extensive configuration options. Stagehand offers advanced features including action caching to reduce LLM costs, self-healing automations that adapt to website changes, experimental shadow DOM support, and computer use agents powered by OpenAI, Anthropic, and Google models. With built-in Model Context Protocol (MCP) integration, agents can leverage external tools and APIs beyond browser interactions, making Stagehand suitable for complex enterprise workflows.

## Initialization and Configuration

### Initialize Stagehand instance

Create a new Stagehand instance with environment configuration and connect to a browser session.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

// Initialize with Browserbase (cloud browser)
const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: 1,
  modelName: "openai/gpt-4.1-mini",
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  enableCaching: true,
});

await stagehand.init();
const page = stagehand.page;

// Navigate and perform actions
await page.goto("https://github.com/browserbase/stagehand");
await page.act("click on the Issues tab");

const { issueCount } = await page.extract({
  instruction: "extract the number of open issues",
  schema: z.object({
    issueCount: z.number(),
  }),
});

console.log(`Open issues: ${issueCount}`);
await stagehand.close();
```

### Initialize with local browser

Launch Stagehand with a local Chromium browser for development and testing.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

// Local browser with custom configuration
const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 2,
  headless: false,
  modelName: "anthropic/claude-sonnet-4-20250514",
  modelClientOptions: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  localBrowserLaunchOptions: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
    downloadsPath: "./downloads",
    userDataDir: "./browser-profile",
    preserveUserDataDir: true,
  },
  enableCaching: true,
  selfHeal: true,
});

const { debugUrl, sessionUrl } = await stagehand.init();
console.log(`Browser debug URL: ${debugUrl}`);

const page = stagehand.page;
await page.goto("https://example.com");

// Access metrics
console.log(`Total tokens used: ${stagehand.metrics.totalPromptTokens}`);

await stagehand.close();
```

## Act - Single Action Execution

### Execute action with natural language

Perform a single browser action using natural language instructions.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://github.com/login");

// Simple actions
await page.act("type 'john@example.com' in the email field");
await page.act("click the continue button");

// Using variables for sensitive data
await page.act({
  action: "enter %password% in the password field",
  variables: {
    password: process.env.USER_PASSWORD,
  },
});

await page.act("click the sign in button");

// Wait for navigation
await page.waitForLoadState("networkidle");

await stagehand.close();
```

### Execute action with advanced options

Perform actions with custom timeout, model selection, and iframe support.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "LOCAL",
  verbose: 1,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://example-store.com");

const productName = "organic quinoa";

try {
  const result = await page.act({
    action: "Type %productName% in the search box and press enter",
    variables: {
      productName: productName,
    },
    modelName: "google/gemini-2.5-pro",
    modelClientOptions: {
      apiKey: process.env.GOOGLE_API_KEY,
    },
    iframes: true,
    domSettleTimeoutMs: 45000,
    timeoutMs: 60000,
  });

  if (result.success) {
    console.log("Search completed successfully");
  } else {
    console.error("Search failed:", result.message);
  }
} catch (error) {
  console.error("Action error:", error.message);
}

await stagehand.close();
```

## Observe - Element Discovery

### Find actionable elements on page

Discover available actions on a page and validate elements before acting.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  enableCaching: true,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://example.com/form");

// Discover multiple elements
const formFields = await page.observe("Find all input fields in the form");

console.log(`Found ${formFields.length} form fields:`);
formFields.forEach((field, index) => {
  console.log(`${index}: ${field.description}`);
  console.log(`   Selector: ${field.selector}`);
  console.log(`   Method: ${field.method}`);
});

// Act on discovered elements (no additional LLM calls)
for (const field of formFields) {
  if (field.description.includes("email")) {
    await page.act({
      ...field,
      variables: { email: "user@example.com" },
    });
  }
}

// Find specific button
const [submitButton] = await page.observe("Find the submit button");

if (submitButton && submitButton.method === "click") {
  await page.act(submitButton);
  console.log("Form submitted successfully");
} else {
  console.error("Submit button not found or has unexpected method");
}

await stagehand.close();
```

### Optimize extraction with observe

Use observe to scope extraction to specific page sections, reducing token usage.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://example.com/products");

// First, find the specific section
const [productsTable] = await page.observe("Find the products data table");

if (!productsTable) {
  throw new Error("Products table not found");
}

console.log(`Found table: ${productsTable.description}`);
console.log(`Selector: ${productsTable.selector}`);

// Extract data only from the table section (10x token reduction)
const products = await page.extract({
  instruction: "Extract all products with their names, prices, and ratings",
  schema: z.object({
    products: z.array(
      z.object({
        name: z.string().describe("product name or title"),
        price: z.string().describe("price with currency symbol"),
        rating: z.number().optional().describe("star rating out of 5"),
      })
    ),
  }),
  selector: productsTable.selector,
});

console.log(`Extracted ${products.products.length} products:`);
console.log(JSON.stringify(products, null, 2));

await stagehand.close();
```

## Extract - Structured Data Extraction

### Extract data with schema

Extract structured data from webpages using Zod schemas with type safety.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://github.com/browserbase/stagehand");

// Extract repository information
const repoData = await page.extract({
  instruction: "Extract the repository details",
  schema: z.object({
    name: z.string().describe("repository name"),
    description: z.string().describe("repository description"),
    stars: z.number().describe("number of stars"),
    forks: z.number().describe("number of forks"),
    language: z.string().describe("primary programming language"),
    topics: z.array(z.string()).describe("repository topics/tags"),
  }),
});

console.log("Repository Details:");
console.log(`Name: ${repoData.name}`);
console.log(`Description: ${repoData.description}`);
console.log(`Stars: ${repoData.stars}`);
console.log(`Forks: ${repoData.forks}`);
console.log(`Language: ${repoData.language}`);
console.log(`Topics: ${repoData.topics.join(", ")}`);

await stagehand.close();
```

### Extract lists and links

Extract arrays of structured data and URL links from webpages.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://news.ycombinator.com");

// Extract list of articles with links
const newsData = await page.extract({
  instruction: "Extract ALL the top stories with their titles, scores, and links",
  schema: z.object({
    stories: z.array(
      z.object({
        title: z.string().describe("article title"),
        score: z.number().describe("upvote score"),
        link: z.string().url().describe("article URL"),
        comments: z.number().optional().describe("number of comments"),
      })
    ),
  }),
});

console.log(`Extracted ${newsData.stories.length} stories:`);

newsData.stories.slice(0, 5).forEach((story, index) => {
  console.log(`\n${index + 1}. ${story.title}`);
  console.log(`   Score: ${story.score} points`);
  console.log(`   Link: ${story.link}`);
  console.log(`   Comments: ${story.comments || 0}`);
});

// Extract page text without LLM
const pageText = await page.extract();
console.log("\nPage accessibility tree:");
console.log(pageText.page_text.substring(0, 500) + "...");

await stagehand.close();
```

## Agent - Multi-Step Workflows

### Execute autonomous agent task

Create and execute agents for complex multi-step browser workflows.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: 1,
});

await stagehand.init();
const page = stagehand.page;

// Navigate to starting page
await page.goto("https://github.com/browserbase");

// Create Stagehand agent (works with any model)
const agent = stagehand.agent({
  instructions: "You are a helpful assistant researching GitHub repositories.",
  executionModel: "openai/gpt-4.1",
});

// Execute complex task
const result = await agent.execute({
  instruction: "Find the stagehand repository, go to issues, and tell me the title of the most recent open issue",
  maxSteps: 20,
});

console.log("Agent result:", result);
console.log("Success:", result.success);
console.log("Steps taken:", result.steps?.length || 0);

// Check metrics
console.log(`\nAgent metrics:`);
console.log(`Prompt tokens: ${stagehand.metrics.agentPromptTokens}`);
console.log(`Completion tokens: ${stagehand.metrics.agentCompletionTokens}`);
console.log(`Inference time: ${stagehand.metrics.agentInferenceTimeMs}ms`);

await stagehand.close();
```

### Computer Use Agent with vision

Use specialized computer use models from OpenAI, Anthropic, or Google with visual understanding.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: 2,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://github.com/browserbase/stagehand");

// Create Computer Use Agent with Google Gemini
const googleAgent = stagehand.agent({
  provider: "google",
  model: "gemini-2.5-computer-use-preview-10-2025",
  instructions: "You are an expert at navigating GitHub repositories and understanding code.",
  options: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
});

const result = await googleAgent.execute({
  instruction: "Navigate to the pull requests tab, find the most recent PR, and summarize what it does",
  maxSteps: 25,
});

if (result.success) {
  console.log("Task completed successfully!");
  console.log("Result:", result);
} else {
  console.log("Task incomplete or failed");
  console.log("Steps completed:", result.steps?.length || 0);
}

// Create Anthropic Computer Use Agent
const anthropicAgent = stagehand.agent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  instructions: "You can see and interact with web interfaces like a human.",
  options: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});

await anthropicAgent.execute({
  instruction: "Find the README and tell me what Stagehand is used for",
  maxSteps: 15,
});

await stagehand.close();
```

### Agent with MCP integrations

Enhance agents with external tools and APIs through Model Context Protocol.

```typescript
import { Stagehand, connectToMCPServer } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  experimental: true, // Required for MCP
});

await stagehand.init();
const page = stagehand.page;

// Connect to MCP server
const exaClient = await connectToMCPServer(
  `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`
);

// Create agent with MCP integration
const agent = stagehand.agent({
  provider: "google",
  model: "gemini-2.5-computer-use-preview-10-2025",
  integrations: [exaClient],
  instructions: `You have access to web search through Exa. Use it to find current information before browsing websites.`,
  options: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
});

const result = await agent.execute({
  instruction: "Search for the best noise-cancelling headphones of 2025, go to the top product page, and extract the price and key features",
  maxSteps: 30,
});

console.log("Task result:", result);

// Alternative: Pass MCP URL directly
const agentWithUrl = stagehand.agent({
  provider: "google",
  model: "gemini-2.5-computer-use-preview-10-2025",
  integrations: [`https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`],
  instructions: "Use Exa search to find information and browse to relevant sites.",
  options: {
    apiKey: process.env.GOOGLE_API_KEY,
  },
});

await agentWithUrl.execute("Find the latest AI research papers and summarize the top 3");

await stagehand.close();
```

## Caching and Performance

### Build action cache

Cache observed actions to reduce LLM calls and ensure consistent execution.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  enableCaching: true,
});

await stagehand.init();
const page = stagehand.page;

// Action cache implementation
const actionCache = new Map();

async function getCachedAction(instruction: string) {
  if (actionCache.has(instruction)) {
    console.log(`Using cached action for: ${instruction}`);
    return actionCache.get(instruction);
  }

  console.log(`Fetching new action for: ${instruction}`);
  const [action] = await page.observe(instruction);

  if (action) {
    actionCache.set(instruction, action);
  }

  return action;
}

// First run - fetches and caches
await page.goto("https://github.com/login");

const emailField = await getCachedAction("find the email input field");
const passwordField = await getCachedAction("find the password input field");
const submitButton = await getCachedAction("find the sign in button");

// Execute cached actions (no LLM calls)
await page.act({ ...emailField, variables: { email: "user@example.com" } });
await page.act({ ...passwordField, variables: { password: process.env.PASSWORD } });
await page.act(submitButton);

console.log(`Cache size: ${actionCache.size} actions`);
console.log(`Total tokens used: ${stagehand.metrics.totalPromptTokens}`);

await stagehand.close();
```

## Context and Multi-Tab Management

### Work with multiple pages

Create and manage multiple browser tabs with context.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();

// Access context for multi-page operations
const context = stagehand.context;

// Create multiple pages
const page1 = await context.newPage();
const page2 = await context.newPage();

// Work with first page
await page1.goto("https://github.com/browserbase/stagehand");
const repo1Data = await page1.extract({
  instruction: "extract repository name and description",
  schema: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

console.log("Page 1:", repo1Data);

// Work with second page
await page2.goto("https://github.com/microsoft/playwright");
const repo2Data = await page2.extract({
  instruction: "extract repository name and description",
  schema: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

console.log("Page 2:", repo2Data);

// List all pages
const allPages = context.pages();
console.log(`Total pages open: ${allPages.length}`);

// Close specific pages
await page1.close();
await page2.close();

await stagehand.close();
```

## Advanced Configuration

### Handle iframes and dynamic content

Work with iframes and configure DOM settle timeouts for dynamic pages.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  domSettleTimeoutMs: 45000,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://example.com/iframe-form");

// Wait for iframes to load
await page.waitForLoadState("networkidle");

// Act inside iframes
await page.act({
  action: "click the submit button inside the payment form",
  iframes: true,
  domSettleTimeoutMs: 60000,
  timeoutMs: 90000,
});

// Extract from iframe content
const formData = await page.extract({
  instruction: "extract the form fields from the embedded form",
  schema: z.object({
    fields: z.array(z.string()),
  }),
  iframes: true,
});

console.log("Form fields:", formData.fields);

await stagehand.close();
```

### Enable experimental features

Use experimental features like shadow DOM support.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "LOCAL",
  experimental: true,
  verbose: 2,
  headless: false,
  selfHeal: true,
  domSettleTimeoutMs: 30000,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://example.com/shadow-dom-app");

// Act on elements inside shadow DOM
await page.act({
  action: "click the menu button in the custom web component",
  domSettleTimeoutMs: 45000,
});

// Extract from shadow DOM elements
const componentData = await page.extract("extract the content from the web component");

console.log("Component data:", componentData);

await stagehand.close();
```

## History and Observability

### Track automation history

Access execution history to monitor all actions and extractions.

```typescript
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod/v3";

const stagehand = new Stagehand({
  env: "BROWSERBASE",
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  verbose: 2,
});

await stagehand.init();
const page = stagehand.page;

await page.goto("https://github.com/browserbase");
await page.act("click on the stagehand repository");

const repoInfo = await page.extract({
  instruction: "get the star count",
  schema: z.object({
    stars: z.number(),
  }),
});

await page.act("click on the issues tab");

// Access history of all operations
const history = stagehand.history;

console.log(`Total operations: ${history.length}`);
console.log("\nOperation history:");

history.forEach((entry, index) => {
  console.log(`\n${index + 1}. ${entry.method}`);
  console.log(`   Timestamp: ${entry.timestamp}`);
  console.log(`   Parameters:`, JSON.stringify(entry.parameters, null, 2));
  if (entry.result) {
    console.log(`   Result:`, JSON.stringify(entry.result, null, 2));
  }
});

// Access comprehensive metrics
console.log("\nPerformance Metrics:");
console.log(`Act: ${stagehand.metrics.actPromptTokens} prompt tokens, ${stagehand.metrics.actCompletionTokens} completion tokens, ${stagehand.metrics.actInferenceTimeMs}ms`);
console.log(`Extract: ${stagehand.metrics.extractPromptTokens} prompt tokens, ${stagehand.metrics.extractCompletionTokens} completion tokens, ${stagehand.metrics.extractInferenceTimeMs}ms`);
console.log(`Total: ${stagehand.metrics.totalPromptTokens} prompt tokens, ${stagehand.metrics.totalCompletionTokens} completion tokens, ${stagehand.metrics.totalInferenceTimeMs}ms`);

await stagehand.close();
```

## Summary

Stagehand provides a comprehensive toolkit for AI-powered browser automation with four core methods: `act()` for individual actions with natural language, `observe()` for discovering actionable elements and optimizing workflows, `extract()` for pulling structured data with schemas, and `agent()` for autonomous multi-step tasks. These methods can be combined with caching strategies to minimize LLM costs, chained together for complex workflows, and enhanced with MCP integrations for external tool access. The framework's versatility makes it suitable for web scraping, form automation, testing, data extraction, and end-to-end workflow automation.

Integration patterns include using `observe()` before `act()` to cache and validate actions, scoping `extract()` with observe results to reduce token usage 10x, chaining multiple operations with error handling and retries, and combining Stagehand agents with external APIs through MCP for enhanced capabilities. The framework supports both Browserbase cloud sessions for production deployments and local browsers for development, with extensive configuration options including viewport size, download handling, proxy support, custom user profiles, and experimental features like shadow DOM traversal. Built-in observability through history tracking, comprehensive metrics, and customizable logging enables monitoring, debugging, and optimization of browser automation workflows at scale.


