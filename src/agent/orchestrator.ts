/**
 * Browser agent orchestrator - coordinates browser session and game actions
 */

import { EventEmitter } from 'events';
import type { QAConfig, QAResult } from '../types/index.js';
import type { ConsoleLog } from '../types/index.js';
import { BrowserSession } from './browser.js';
import { GameActions, type SimpleActionResult } from './actions.js';
import { ScreenAnalyzer, type ScreenAnalysis } from './screen-analyzer.js';
import { GameEvaluator } from '../evaluation/evaluator.js';
import { logger } from '../utils/logger.js';
import { BrowserError } from '../utils/errors.js';

export interface AgentResult {
  gameUrl: string;
  duration: number;
  actions: SimpleActionResult[];
  consoleLogs: ConsoleLog[];
  screenshots: string[];
  success: boolean;
  error?: string;
}

/**
 * Game states
 */
enum GameState {
  MENU = 'MENU',     // Looking for start button, play again, next level, etc.
  GAME = 'GAME',     // Playing the game - making moves
}

export class BrowserAgent extends EventEmitter {
  private config: QAConfig;
  private session: BrowserSession | null = null;
  private actions: GameActions | null = null;
  private analyzer: ScreenAnalyzer | null = null;
  private consoleLogs: ConsoleLog[] = [];
  private currentState: GameState = GameState.MENU;
  private actionHistory: string[] = []; // Track what we've tried

  constructor(config: QAConfig) {
    super();
    this.config = config;
  }

  /**
   * Run the browser agent on a game URL
   */
  async run(gameUrl: string): Promise<QAResult> {
    const startTime = Date.now();
    const actionResults: SimpleActionResult[] = [];

    try {
      logger.info(`Starting browser agent for: ${gameUrl}`);
      this.emit('log', { level: 'info', message: `Starting browser agent for: ${gameUrl}`, timestamp: new Date() });

      // Initialize browser session
      this.session = new BrowserSession(this.config);
      await this.session.initialize();
      this.emit('log', { level: 'info', message: 'Browser session initialized', timestamp: new Date() });

      // Navigate to game URL
      await this.session.navigate(gameUrl);
      this.emit('log', { level: 'info', message: `Navigated to ${gameUrl}`, timestamp: new Date() });

      // Get Stagehand instance for actions (has act, observe methods)
      const stagehand = this.session.getStagehand();
      
      // Get Playwright page for direct keyboard/mouse access and console logging
      const page = this.session.getPage();
      
      // Pass both stagehand and page to actions
      // Page enables direct Playwright keyboard API (bypasses Stagehand's element lookup)
      this.actions = new GameActions(stagehand, page);
      this.analyzer = new ScreenAnalyzer(stagehand);

      // Set up console logging
      this.setupConsoleLogging(page);

      // Clean up page - remove ads and distractions
      await this.cleanupPage(page);

      // Run gameplay loop for 15 seconds
      await this.gameplayLoop(actionResults);

      const duration = Date.now() - startTime;
      logger.info(`Agent completed successfully in ${duration}ms`);
      
      const agentResult: AgentResult = {
        gameUrl,
        duration,
        actions: actionResults,
        consoleLogs: this.consoleLogs,
        screenshots: actionResults.flatMap(a => [a.screenshotBefore, a.screenshotAfter].filter(Boolean) as string[]),
        success: true,
      };

      // Evaluate the results using LLM
      logger.info('🧠 Evaluating game playability...');
      const evaluator = new GameEvaluator(this.config.openaiApiKey);
      const qaResult = await evaluator.evaluate(agentResult);

      this.emit('complete', qaResult);
      return qaResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Agent failed', error as Error);

      const agentResult: AgentResult = {
        gameUrl,
        duration,
        actions: actionResults,
        consoleLogs: this.consoleLogs,
        screenshots: [],
        success: false,
        error: errorMsg,
      };

      // Still evaluate even if agent failed - helps identify the issue
      try {
        const evaluator = new GameEvaluator(this.config.openaiApiKey);
        return await evaluator.evaluate(agentResult);
      } catch (evalError) {
        logger.error('Evaluation also failed', evalError as Error);
        // Return minimal QAResult if evaluation fails
        return {
          gameUrl,
          status: 'fail',
          playabilityScore: 0,
          checks: {
            gameLoaded: false,
            controlsResponsive: false,
            gameStable: false,
          },
          issues: [{
            severity: 'critical',
            description: `Agent execution failed: ${errorMsg}`,
            evidence: String(error),
          }],
          duration,
          timestamp: new Date(),
          screenshots: [],
          metadata: {
            actionCount: actionResults.length,
            successfulActions: actionResults.filter(a => a.success).length,
            consoleErrors: this.consoleLogs.filter(l => l.type === 'error').length,
          },
        };
      }
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }

  /**
   * Main gameplay loop - CUA (Computer Use Agent) mode
   * LLM analyzes screen and decides actions intelligently
   */
  private async gameplayLoop(actionResults: SimpleActionResult[]): Promise<void> {
    if (!this.actions || !this.analyzer) {
      throw new BrowserError('Actions or Analyzer not initialized');
    }

    const startTime = Date.now();
    const maxDuration = this.config.maxExecutionTimeMs;
    let actionCount = 0;

    logger.info(`🤖 Starting CUA Agent (max ${maxDuration}ms / ${Math.floor(maxDuration/1000)}s, unlimited actions)...`);
    logger.info(`⏱️ Will stop at: ${new Date(startTime + maxDuration).toLocaleTimeString()}`);

    // Find game container once at start
    const gameElements = await this.actions.findElements(
      'find the game container, game canvas, or main game area'
    );
    const gameContainer =
      gameElements && gameElements.length > 0 ? gameElements[0] : null;

    if (gameContainer) {
      logger.info('Game container found, will capture scoped screenshots');
    } else {
      logger.info('No game container found, will capture full page screenshots');
    }

    while (Date.now() - startTime < maxDuration) {
      try {
        actionCount++;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.floor((maxDuration - (Date.now() - startTime)) / 1000);
        logger.info(`\n--- Action Cycle #${actionCount} (${elapsed}s elapsed, ${remaining}s remaining) ---`);

        // STEP 1: LLM analyzes the screen and decides what to do
        // Pass full action history with success/failure info for better context
        const contextualHistory = this.actionHistory.map((action, i) => {
          const prevResult = actionResults[i];
          return prevResult 
            ? `${action} ${prevResult.success ? '✓' : '✗'}`
            : action;
        });
        
        logger.debug('Starting screen analysis...');
        const analysis: ScreenAnalysis = await this.analyzer.analyzeScreen(
          contextualHistory
        );
        logger.debug('Screen analysis completed successfully');

        // Update state based on LLM's assessment
        if (analysis.gameState === 'menu' || analysis.gameState === 'loading') {
          this.currentState = GameState.MENU;
        } else {
          this.currentState = GameState.GAME;
        }

        // STEP 2: Validate the LLM's recommended action
        const actionToTake = analysis.recommendedAction;
        
        // Check if we have a valid action and sufficient confidence
        if (!actionToTake || actionToTake === 'Unable to analyze' || analysis.confidence < 0.4) {
          if (actionCount === 1) {
            // First attempt failed - retry analysis once
            logger.warn(`⚠️ Low confidence or no action (${(analysis.confidence * 100).toFixed(0)}%), retrying analysis...`);
            await this.actions.wait(2000);
            continue;
          } else {
            // Use simple fallback for subsequent failures
            logger.warn('⚠️ Using fallback action - click any visible button');
            analysis.recommendedAction = 'click on any visible button or start button';
          }
        }

        logger.info(`[${this.currentState}] 🎯 LLM Decision: ${analysis.recommendedAction}`);
        this.emit('log', { level: 'info', message: `LLM Decision: ${analysis.recommendedAction}`, timestamp: new Date() });
        
        logger.info(`💭 Reasoning: ${analysis.reasoning}`);
        this.emit('log', { level: 'info', message: `Reasoning: ${analysis.reasoning}`, timestamp: new Date() });

        // Capture BEFORE screenshot
        const beforePath = await this.captureGameScreenshot(
          `action-${actionCount}-before.png`,
          gameContainer
        );
        
        if (beforePath) {
          this.emit('screenshot', { path: beforePath, type: 'before', actionCount });
        }

        // STEP 3: Execute the LLM's recommended action
        // Detect if action is a keyboard press or a click
        let result: SimpleActionResult;
        const keyPressMatch = analysis.recommendedAction.match(/^press\s+(\w+)/i);
        
        if (keyPressMatch) {
          // Extract the key name (e.g., "ArrowUp", "Space", "Enter", "w")
          const key = keyPressMatch[1] || 'Space';
          logger.info(`⌨️  Detected keyboard action: ${key}`);
          result = await this.actions.pressKey(key);
        } else {
          // Default to click action
          result = await this.actions.findAndClick(analysis.recommendedAction);
        }
        
        result.screenshotBefore = beforePath;
        
        this.emit('action', { 
          count: actionCount, 
          action: analysis.recommendedAction, 
          success: result.success,
          timestamp: new Date()
        });

        // Track action history with result for context in next iteration
        const actionSummary = `${analysis.recommendedAction} (${result.success ? 'succeeded' : 'failed'})`;
        this.actionHistory.push(actionSummary);
        if (this.actionHistory.length > 5) {
          this.actionHistory.shift(); // Keep only last 5 actions
        }

        // Log the updated history for debugging
        logger.debug(`Action history: ${this.actionHistory.join(' → ')}`);
        
        // If we keep failing, provide more explicit feedback
        const recentFailures = actionResults.slice(-3).filter(a => !a.success).length;
        if (recentFailures >= 2) {
          logger.warn(`⚠️ ${recentFailures} recent failures - agent might be stuck`);
        }

        // Wait for changes to render
        await this.actions.wait(500);

        // Capture AFTER screenshot
        const afterPath = await this.captureGameScreenshot(
          `action-${actionCount}-after.png`,
          gameContainer
        );
        result.screenshotAfter = afterPath;
        
        if (afterPath) {
          this.emit('screenshot', { path: afterPath, type: 'after', actionCount });
        }

        actionResults.push(result);

        if (beforePath && afterPath) {
          logger.info(`📸 Screenshots: ${beforePath} → ${afterPath}`);
        }

        // Adaptive wait time based on game state
        const waitTime = analysis.gameState === 'playing' ? 1500 : 2500;
        logger.debug(`Waiting ${waitTime}ms before next action...`);
        await this.actions.wait(waitTime);
        
        logger.debug(`Completed action ${actionCount}, continuing to next iteration...`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Error in gameplay loop (action ${actionCount}):`, errorMsg);
        logger.error('Full error:', error);
        
        // Push a failed action result
        actionResults.push({
          action: 'Error in loop',
          success: false,
          error: errorMsg,
          timestamp: new Date(),
        });
        
        logger.warn('⚠️ Continuing after error...');
        await this.actions.wait(1000);
      }

      // Check if we should continue (redundant with while condition, but explicit)
      const timeElapsed = Date.now() - startTime;
      const timeRemaining = maxDuration - timeElapsed;
      
      logger.debug(`⏱️ Time check: elapsed=${Math.floor(timeElapsed/1000)}s, remaining=${Math.floor(timeRemaining/1000)}s, maxDuration=${Math.floor(maxDuration/1000)}s`);
      
      if (timeRemaining <= 0) {
        logger.info(`⏱️ Time limit reached in inner check, exiting loop`);
        break;
      }
      
      logger.debug(`Loop iteration complete. Actions: ${actionCount}, Time remaining: ${Math.floor(timeRemaining / 1000)}s`);
    }
    
    logger.info(`⏱️ While loop condition failed: Date.now()=${Date.now()}, startTime=${startTime}, elapsed=${Date.now() - startTime}ms, maxDuration=${maxDuration}ms`);

    logger.info(`🏁 Gameplay loop ended. Total actions: ${actionCount}, Duration: ${Math.floor((Date.now() - startTime) / 1000)}s`);

    const elapsed = Date.now() - startTime;
    const reason = `time limit (${maxDuration}ms)`;
    logger.info(
      `\n✅ CUA Agent completed. Stopped by ${reason}. Duration: ${elapsed}ms, Actions: ${actionResults.length}`
    );
  }

  /**
   * Set up console log capture
   * Note: This may not work with Browserbase remote sessions due to
   * limitations in how events are propagated through the remote debugging protocol
   */
  private setupConsoleLogging(page: any): void {
    try {
      // Check if page has the 'on' method
      if (typeof page?.on !== 'function') {
        logger.warn('Page does not support event listeners (common with remote browsers)');
        return;
      }

      page.on('console', (msg: any) => {
        this.consoleLogs.push({
          type: msg.type() as 'log' | 'warn' | 'error' | 'info' | 'debug',
          message: msg.text(),
          timestamp: new Date(),
        });
      });

      page.on('pageerror', (error: Error) => {
        this.consoleLogs.push({
          type: 'error',
          message: error.message,
          timestamp: new Date(),
        });
      });

      logger.debug('Console logging enabled');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to setup console logging: ${errorMsg}`);
    }
  }

  /**
   * Capture screenshot of game container or full page
   */
  private async captureGameScreenshot(
    filename: string,
    gameContainer?: any
  ): Promise<string> {
    const outputDir = this.config.customOutputDir || this.config.outputDir || './output';

    try {
      // Ensure output directory exists
      const fs = await import('fs');
      const path = await import('path');
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const fullPath = path.join(outputDir, filename);
      let screenshotBuffer: Buffer;

      if (gameContainer && typeof gameContainer.screenshot === 'function') {
        // Screenshot just the game container - get as buffer
        screenshotBuffer = await gameContainer.screenshot();
      } else if (this.session) {
        // Fallback to full page screenshot - get as buffer
        const page = this.session.getPage();
        screenshotBuffer = await page.screenshot();
      } else {
        logger.warn('Cannot capture screenshot: no page available');
        return '';
      }

      // Write buffer to local file
      fs.writeFileSync(fullPath, screenshotBuffer);
      logger.info(`Screenshot saved: ${fullPath}`);
      return fullPath;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to capture screenshot: ${errorMsg}`);
      return '';
    }
  }


  /**
   * Remove ads and non-game elements from the page
   */
  private async cleanupPage(page: any): Promise<void> {
    try {
      logger.info('🧹 Removing ads and distractions from page...');

      // Use any type to avoid TypeScript checking browser context code
      const removeAds = () => {
        const adSelectors = [
          'ins.adsbygoogle',
          'iframe[src*="doubleclick"]',
          'iframe[src*="googlesyndication"]',
          '[id*="ad-"]',
          '[id*="ads-"]',
          '[class*="ad-"]',
          '[class*="ads-"]',
          '[class*="advertisement"]',
          '[id*="advertisement"]',
          '[class*="social-share"]',
          '[class*="share-buttons"]',
          '[id*="social"]',
          'header:not([class*="game"])',
          'footer',
          'nav:not([class*="game"])',
          '[class*="popup"]',
          '[class*="modal"]:not([class*="game"])',
          '[class*="overlay"]:not([class*="game"])',
          '[id*="popup"]',
          '[id*="modal"]',
          '[class*="cookie"]',
          '[id*="cookie"]',
          'aside',
          '[class*="sidebar"]',
          '[id*="sidebar"]',
        ];

        let removedCount = 0;
        adSelectors.forEach((selector: string) => {
          try {
            const elements = (document as any).querySelectorAll(selector);
            elements.forEach((el: any) => {
              el.remove();
              removedCount++;
            });
          } catch (e) {
            // Ignore
          }
        });

        const allElements = (document as any).querySelectorAll('div, aside, section');
        allElements.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (
            (rect.width === 728 && rect.height === 90) ||
            (rect.width === 300 && rect.height === 250) ||
            (rect.width === 160 && rect.height === 600) ||
            (rect.width === 970 && rect.height === 90)
          ) {
            el.remove();
            removedCount++;
          }
        });

        console.log(`Removed ${removedCount} elements from page`);
        return removedCount;
      };

      await page.evaluate(removeAds);

      logger.info('✅ Page cleanup complete - ads removed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️ Page cleanup failed (non-critical): ${errorMsg}`);
    }
  }

  /**
   * Cleanup browser session
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
        this.actions = null;
      }
    } catch (error) {
      logger.error('Error during cleanup', error as Error);
    }
  }
}
