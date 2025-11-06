/**
 * Configuration loader
 */

import type { QAConfig } from '../types/index.js';

export function loadConfig(): QAConfig {
  return {
    maxExecutionTimeMs: 15000,
    maxActions: 100,
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY || '',
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    headless: process.env.HEADLESS === 'true',
    logLevel: 'info',
    outputDir: './output',
    browserMode: (process.env.BROWSER_MODE as 'LOCAL' | 'BROWSERBASE') || 'LOCAL',
    modelName: process.env.MODEL_NAME || 'gpt-5',
    modelProvider: (process.env.MODEL_PROVIDER as 'openai' | 'anthropic') || 'openai',
    maxConcurrentJobs: {
      LOCAL: parseInt(process.env.MAX_CONCURRENT_LOCAL || '5', 10),
      BROWSERBASE: parseInt(process.env.MAX_CONCURRENT_BROWSERBASE || '10', 10),
    },
  };
}

