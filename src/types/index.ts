/**
 * Type definitions
 */

export interface QAConfig {
  maxExecutionTimeMs: number;
  maxActions: number;
  browserbaseApiKey: string;
  browserbaseProjectId: string;
  openaiApiKey: string;
  headless: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  outputDir: string;
  // Browser mode
  browserMode: 'LOCAL' | 'BROWSERBASE';
  // Model configuration
  modelName?: string; // e.g., 'gpt-4o', 'claude-3-5-sonnet-20241022'
  modelProvider?: 'openai' | 'anthropic';
  // Custom output directory (overrides outputDir if set)
  customOutputDir?: string;
  // Parallel execution limits
  maxConcurrentJobs: {
    LOCAL: number;
    BROWSERBASE: number;
  };
}

export interface ConsoleLog {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: Date;
}

