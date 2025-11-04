# 01_PROJECT_SETUP

## Overview

Establish the foundational structure, dependencies, and configuration for the Browser Game QA Pipeline. This includes setting up TypeScript, installing required packages (Browserbase/Stagehand), configuring the project structure, and creating base types and utilities.

## High-Level Approach

1. Initialize TypeScript configuration with strict typing
2. Install and configure core dependencies (Browserbase, Stagehand)
3. Create modular directory structure for separation of concerns
4. Set up environment variable management for API keys
5. Create base TypeScript types and interfaces
6. Configure build and development tooling (Bun)

## Key Components

### Directory Structure
```
src/
├── agent/          # Browser automation logic
├── reporting/      # Screenshot and artifact management
├── evaluation/     # LLM integration and analysis
├── cli/            # Command-line interface
├── types/          # Shared TypeScript types
├── utils/          # Helper functions
└── config/         # Configuration management
```

### Configuration Files
- `tsconfig.json` - TypeScript compiler configuration
- `.env.example` - Environment variable template
- `bunfig.toml` - Bun runtime configuration (optional)

### Core Modules
- `src/config/env.ts` - Environment variable loader and validator
- `src/types/index.ts` - Base type definitions
- `src/utils/logger.ts` - Logging utility

## Implementation Steps

1. **TypeScript Configuration**
   - Create `tsconfig.json` with strict mode, ES2022 target, module resolution
   - Configure path aliases for clean imports

2. **Package Management**
   - Verify Bun is installed and configured
   - Install core dependencies: `@browserbasehq/stagehand`, `openai`
   - Install dev dependencies: TypeScript types, testing tools (if applicable)

3. **Project Structure**
   - Create directory structure (src/ with subdirectories)
   - Create placeholder index files in each module directory

4. **Environment Configuration**
   - Create `.env.example` with required variables:
     - `BROWSERBASE_API_KEY`
     - `OPENAI_API_KEY` (or LLM provider key)
     - `BROWSERBASE_PROJECT_ID`
   - Create `src/config/env.ts` to load and validate environment variables
   - Add `.env` to `.gitignore`

5. **Base Types**
   - Create `src/types/index.ts` with core interfaces (QAResult, Issue, QAConfig, etc.)
   - Export all types for use across modules

6. **Utility Functions**
   - Create `src/utils/logger.ts` with structured logging
   - Create `src/utils/errors.ts` for custom error classes
   - Create `src/utils/validation.ts` for data validation helpers

7. **Configuration Module**
   - Create `src/config/index.ts` that exports QAConfig with defaults
   - Load configuration from environment variables with fallbacks

8. **Root Entry Point**
   - Create `src/index.ts` as main entry point (placeholder for now)
   - Export main modules for CLI consumption

## Dependencies

### Runtime Dependencies
- `@browserbasehq/stagehand` ^3.0.1 - Browser automation framework
- `openai` ^4.0.0 - OpenAI API client
- `zod` ^4.1.12 - Runtime type validation

### Development Dependencies
- `typescript` ^5.9.3 - TypeScript compiler
- `@types/bun` latest - Bun type definitions
- `@types/node` ^24.10.0 - Node.js type definitions

### External Services
- Browserbase API (requires API key)
- OpenAI API or compatible LLM provider (requires API key)

## Integration Points

- **Foundation for all features**: Every subsequent feature will depend on types, config, and utilities defined here
- **CLI will consume**: Configuration and types will be imported by CLI module
- **Agent will use**: Browser config and base types for automation
- **Evaluation will use**: LLM config and result types for analysis

## Testing Strategy

1. **Type Safety**: Verify TypeScript compilation succeeds with strict mode
2. **Config Loading**: Test environment variable loading with mock values
3. **Type Validation**: Use Zod schemas to validate config at runtime
4. **Module Imports**: Verify all modules can be imported without errors
5. **Error Handling**: Test graceful handling of missing environment variables

