# Browser Game QA Pipeline

An AI-powered agent that autonomously tests browser games by simulating user interactions, capturing visual evidence, and evaluating playability metrics.

## Features

- **Automated Browser Testing**: Load and interact with any web-hosted game
- **Visual Evidence Capture**: Take timestamped screenshots throughout testing
- **AI-Powered Evaluation**: Use LLM to analyze gameplay and assess quality
- **Structured Reporting**: Generate comprehensive JSON reports with findings

## Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0+)
- [Browserbase](https://browserbase.com/) account and API key
- [OpenAI](https://openai.com/) API key (or compatible LLM provider)

## Setup

1. **Install Dependencies**

```bash
bun install
```

2. **Configure Environment Variables**

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Required environment variables:
- `BROWSERBASE_API_KEY` - Your Browserbase API key
- `BROWSERBASE_PROJECT_ID` - Your Browserbase project ID
- `OPENAI_API_KEY` - Your OpenAI API key

Optional configuration:
- `MAX_EXECUTION_TIME_MS` - Maximum test duration (default: 300000ms / 5 minutes)
- `MAX_ACTIONS` - Maximum agent actions per test (default: 100)
- `MAX_RETRIES` - Maximum retry attempts for failed loads (default: 3)
- `SCREENSHOT_INTERVAL_MS` - Time between screenshots (default: 30000ms / 30 seconds)

3. **Verify Setup**

```bash
bun run src/index.ts
```

## Project Structure

```
src/
├── agent/          # Browser automation logic
├── reporting/      # Screenshot and artifact management
├── evaluation/     # LLM integration and analysis
├── cli/            # Command-line interface
├── types/          # Shared TypeScript types
├── utils/          # Helper functions
│   ├── logger.ts      # Structured logging
│   ├── errors.ts      # Custom error classes
│   └── validation.ts  # Data validation helpers
├── config/         # Configuration management
│   ├── env.ts         # Environment variable loader
│   └── index.ts       # Configuration with defaults
└── index.ts        # Main entry point
```

## Development

### Type Checking

```bash
bun run bunx tsc --noEmit
```

### Run Development Mode

```bash
bun run dev
```

## Usage (Coming Soon)

Once the agent module is implemented, you'll be able to test games like this:

```typescript
import { runQA } from './src/index.js';

const result = await runQA('https://example.com/game');
console.log(result);
```

Or via CLI:

```bash
qa-agent https://example.com/game
```

## Architecture

### Technology Stack

- **Runtime**: Bun (TypeScript/JavaScript)
- **Browser Automation**: Browserbase + Stagehand
- **LLM Provider**: OpenAI (configurable)
- **Type Safety**: TypeScript with strict mode
- **Validation**: Zod schemas

### Core Modules

1. **Types** (`src/types/`): Comprehensive TypeScript interfaces for all data structures
2. **Config** (`src/config/`): Environment-based configuration with validation
3. **Utils** (`src/utils/`): Logging, error handling, and validation utilities
4. **Agent** (`src/agent/`): Browser automation and game interaction (to be implemented)
5. **Reporting** (`src/reporting/`): Screenshot capture and artifact management (to be implemented)
6. **Evaluation** (`src/evaluation/`): LLM-based analysis and scoring (to be implemented)
7. **CLI** (`src/cli/`): Command-line interface (to be implemented)

## Status

✅ **Phase 1: Project Setup** - Complete
- TypeScript configuration with strict mode
- Dependency installation
- Environment configuration
- Base types and interfaces
- Utility functions (logger, errors, validation)
- Configuration module with defaults

🔜 **Phase 2: Browser Agent** - Next
🔜 **Phase 3: Reporting System** - Planned
🔜 **Phase 4: AI Evaluation** - Planned
🔜 **Phase 5: CLI Interface** - Planned

## License

MIT

