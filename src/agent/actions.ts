/**
 * Game actions - combines element detection and interaction
 */

import { logger } from '../utils/logger.js';

export interface SimpleActionResult {
  success: boolean;
  action: string;
  timestamp: Date;
  error?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
}

export class GameActions {
  private stagehand: any;

  constructor(stagehand: any) {
    this.stagehand = stagehand;
  }

  /**
   * Find and click an element using natural language instruction
   * Includes automatic retry logic for reliability
   */
  async findAndClick(instruction: string, maxRetries: number = 2): Promise<SimpleActionResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`🎯 Attempting action (${attempt}/${maxRetries}): ${instruction}`);

        // Stagehand act() handles both observation and interaction
        await this.stagehand.act(instruction);

        logger.info(`✅ Action succeeded: ${instruction}`);

        return {
          success: true,
          action: instruction,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        if (attempt < maxRetries) {
          logger.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed, retrying in 1s...`);
          await this.wait(1000);
        } else {
          logger.error(`❌ Action failed after ${maxRetries} attempts: ${instruction}`, {
            error: lastError,
            stack: errorStack?.split('\n').slice(0, 3).join('\n'), // First 3 lines
          });
        }
      }
    }

    return {
      success: false,
      action: instruction,
      timestamp: new Date(),
      error: lastError,
    };
  }

  /**
   * Find elements without interacting (just observe)
   */
  async findElements(instruction: string): Promise<any[]> {
    try {
      logger.info(`🔍 Searching for: ${instruction}`);

      const elements = await this.stagehand.observe(instruction);

      logger.info(`📋 Found ${elements?.length || 0} elements matching: ${instruction}`);

      return elements || [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️ Failed to find elements: ${instruction} - ${errorMsg}`);
      return [];
    }
  }

  /**
   * Press a keyboard key - optimized for canvas-based games
   * Uses Playwright's page.keyboard.press for direct key events
   */
  async pressKey(key: string, maxRetries: number = 2): Promise<SimpleActionResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`⌨️  Attempting key press (${attempt}/${maxRetries}): ${key}`);

        // Try to get the raw page object for direct keyboard access
        // This is more reliable for canvas games than going through Stagehand act
        const stagehandAny = this.stagehand as any;
        let page = null;
        
        // Try to get page from different possible locations
        if (stagehandAny.page) {
          page = stagehandAny.page;
        } else if (stagehandAny.context) {
          const context = stagehandAny.context;
          const pages = context.pages();
          page = pages[0];
        }

        if (page && page.keyboard) {
          // Direct keyboard press - works better for canvas games
          await page.keyboard.press(key);
          logger.info(`✅ Key pressed successfully: ${key}`);
        } else {
          // Fallback to Stagehand act
          await this.stagehand.act(`press the ${key} key`);
          logger.info(`✅ Key pressed via Stagehand: ${key}`);
        }

        return {
          success: true,
          action: `press ${key}`,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxRetries) {
          logger.warn(`⚠️ Key press attempt ${attempt}/${maxRetries} failed, retrying...`);
          await this.wait(500);
        } else {
          logger.error(`❌ Key press failed after ${maxRetries} attempts: ${key}`, { error: lastError });
        }
      }
    }

    return {
      success: false,
      action: `press ${key}`,
      timestamp: new Date(),
      error: lastError,
    };
  }

  /**
   * Click on canvas or image element - for canvas-based games
   */
  async clickCanvas(instruction: string = 'click on the game canvas'): Promise<SimpleActionResult> {
    try {
      logger.info(`🎨 Attempting canvas click: ${instruction}`);
      
      // Try to find and click canvas or image element
      await this.stagehand.act(instruction);
      
      logger.info(`✅ Canvas click succeeded`);
      
      return {
        success: true,
        action: instruction,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️ Canvas click failed: ${errorMsg}`);
      
      return {
        success: false,
        action: instruction,
        timestamp: new Date(),
        error: errorMsg,
      };
    }
  }

  /**
   * Wait for a specified duration
   */
  async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

