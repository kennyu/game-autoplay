/**
 * Configuration loader
 */

import type { QAConfig } from '../types/index.js';

export function loadConfig(): QAConfig {
  const config = {
    maxExecutionTimeMs: parseInt(process.env.MAX_EXECUTION_TIME_MS || '30000', 10),
    maxActions: parseInt(process.env.MAX_ACTIONS || '999999', 10), // Effectively unlimited
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY || '',
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    headless: process.env.HEADLESS === 'true',
    logLevel: 'info',
    outputDir: './output',
    browserMode: (process.env.BROWSER_MODE as 'LOCAL' | 'BROWSERBASE') || 'LOCAL',
    modelName: process.env.MODEL_NAME || 'gpt-4o-mini',
    modelProvider: (process.env.MODEL_PROVIDER as 'openai' | 'anthropic') || 'openai',
    maxConcurrentJobs: {
      LOCAL: parseInt(process.env.MAX_CONCURRENT_LOCAL || '5', 10),
      BROWSERBASE: parseInt(process.env.MAX_CONCURRENT_BROWSERBASE || '10', 10),
    },
  };
  
  // Log config on load for debugging
  console.log('⚙️ Config loaded:', {
    maxExecutionTimeMs: config.maxExecutionTimeMs,
    maxExecutionTimeSec: Math.floor(config.maxExecutionTimeMs / 1000),
    maxActions: config.maxActions,
    browserMode: config.browserMode,
    modelName: config.modelName,
  });
  
  return config;
}

