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
   */
  async findAndClick(instruction: string): Promise<SimpleActionResult> {
    try {
      logger.info(`🎯 Attempting action: ${instruction}`);

      // Stagehand's act() handles both observation and interaction
      await this.stagehand.act(instruction);

      logger.info(`✅ Action succeeded: ${instruction}`);

      return {
        success: true,
        action: instruction,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`❌ Action failed: ${instruction}`, {
        error: errorMsg,
        stack: errorStack?.split('\n').slice(0, 3).join('\n'), // First 3 lines
      });

      return {
        success: false,
        action: instruction,
        timestamp: new Date(),
        error: errorMsg,
      };
    }
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
   * Press a keyboard key using Stagehand's act
   */
  async pressKey(key: string): Promise<SimpleActionResult> {
    try {
      logger.debug(`Pressing key: ${key}`);

      // Use Stagehand act for keyboard input
      await this.stagehand.act(`press the ${key} key`);

      logger.debug(`Key pressed: ${key}`);

      return {
        success: true,
        action: `Press ${key}`,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to press key: ${key} - ${errorMsg}`);

      return {
        success: false,
        action: `Press ${key}`,
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

