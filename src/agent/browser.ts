/**
 * Browser session management with Stagehand/Browserbase
 */

import { Stagehand } from '@browserbasehq/stagehand';
import type { QAConfig } from '../types/index.js';
import { BrowserError } from '../utils/errors.js';
import { validateUrl } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

export class BrowserSession {
  private stagehand: Stagehand | null = null;
  private page: any | null = null;
  private config: QAConfig;

  constructor(config: QAConfig) {
    this.config = config;
  }

  /**
   * Initialize Stagehand session (LOCAL or BROWSERBASE)
   */
  async initialize(): Promise<void> {
    try {
      const mode = this.config.browserMode;
      logger.info(`Initializing Stagehand session in ${mode} mode...`);

      const stagehandConfig: any = {
        env: mode,
        enableCaching: true,
        verbose: 2,
        debugDom: true,
      };

      // Configure model
      if (this.config.modelName) {
        stagehandConfig.modelName = this.config.modelName;
        logger.info(`Using model: ${this.config.modelName}`);
      }

      // Add model client options (API key)
      if (this.config.modelProvider === 'openai' && this.config.openaiApiKey) {
        stagehandConfig.modelClientOptions = {
          apiKey: this.config.openaiApiKey,
        };
      } else if (this.config.modelProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        stagehandConfig.modelClientOptions = {
          apiKey: process.env.ANTHROPIC_API_KEY,
        };
      }

      // Add Browserbase-specific config
      if (mode === 'BROWSERBASE') {
        stagehandConfig.apiKey = this.config.browserbaseApiKey;
        stagehandConfig.projectId = this.config.browserbaseProjectId;
      }

      // Add LOCAL-specific config
      if (mode === 'LOCAL') {
        stagehandConfig.headless = this.config.headless;
        logger.info(`Headless mode: ${this.config.headless}`);
      }

      this.stagehand = new Stagehand(stagehandConfig);

      await this.stagehand.init();
      
      // Get raw Playwright page from context for console logging/cleanup
      const stagehandAny = this.stagehand as any;
      const context = stagehandAny.context;
      if (context && context.pages) {
        const pages = context.pages();
        this.page = pages[0];
      }
      
      if (!this.page) {
        throw new BrowserError('Could not access page after initialization');
      }
      
      logger.info('Got Playwright page from context');

      logger.info('Stagehand session initialized successfully');
    } catch (error) {
      logger.error('Error during initialization:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new BrowserError('Failed to initialize browser session', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    // Validate URL
    validateUrl(url);

    if (!this.page) {
      throw new BrowserError('Browser not initialized. Call initialize() first.');
    }

    try {
      logger.info(`Navigating to ${url}...`);

      // Use Playwright's goto
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      logger.info('Navigation successful');
    } catch (error) {
      throw new BrowserError(`Failed to navigate to ${url}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the Stagehand instance for actions
   */
  getStagehand(): any {
    if (!this.stagehand) {
      throw new BrowserError('Browser not initialized. Call initialize() first.');
    }
    return this.stagehand;
  }
  
  /**
   * Get Stagehand-enhanced page (has act, observe, extract methods)
   */
  getPage(): any {
    if (!this.page) {
      throw new BrowserError('Stagehand page not initialized');
    }
    return this.page;
  }

  /**
   * Close the browser session
   */
  async close(): Promise<void> {
    try {
      if (this.stagehand) {
        logger.info('Closing browser session...');
        await this.stagehand.close();
        this.stagehand = null;
        this.page = null;
        logger.info('Browser session closed');
      }
    } catch (error) {
      logger.error('Error closing browser session', error as Error);
      throw new BrowserError('Failed to close browser session', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
