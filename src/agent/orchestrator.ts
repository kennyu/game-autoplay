/**
 * Browser agent orchestrator - coordinates browser session and game actions
 */

import type { QAConfig } from '../types/index.js';
import type { ConsoleLog } from '../types/index.js';
import { BrowserSession } from './browser.js';
import { GameActions, type SimpleActionResult } from './actions.js';
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

export class BrowserAgent {
  private config: QAConfig;
  private session: BrowserSession | null = null;
  private actions: GameActions | null = null;
  private consoleLogs: ConsoleLog[] = [];
  private currentState: GameState = GameState.MENU;
  private stateConfidenceCount: number = 0; // Prevent rapid state flipping

  constructor(config: QAConfig) {
    this.config = config;
  }

  /**
   * Run the browser agent on a game URL
   */
  async run(gameUrl: string): Promise<AgentResult> {
    const startTime = Date.now();
    const actionResults: SimpleActionResult[] = [];

    try {
      logger.info(`Starting browser agent for: ${gameUrl}`);

      // Initialize browser session
      this.session = new BrowserSession(this.config);
      await this.session.initialize();

      // Navigate to game URL
      await this.session.navigate(gameUrl);

      // Get Stagehand instance for actions (has act, observe methods)
      const stagehand = this.session.getStagehand();
      this.actions = new GameActions(stagehand);
      
      // Get Playwright page for console logging
      const page = this.session.getPage();

      // Set up console logging
      this.setupConsoleLogging(page);

      // Clean up page - remove ads and distractions
      await this.cleanupPage(page);

      // Run gameplay loop for 15 seconds
      await this.gameplayLoop(actionResults);

      const duration = Date.now() - startTime;
      logger.info(`Agent completed successfully in ${duration}ms`);

      return {
        gameUrl,
        duration,
        actions: actionResults,
        consoleLogs: this.consoleLogs,
        screenshots: [],
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Agent failed', error as Error);

      return {
        gameUrl,
        duration,
        actions: actionResults,
        consoleLogs: this.consoleLogs,
        screenshots: [],
        success: false,
        error: errorMsg,
      };
    } finally {
      // Always cleanup
      await this.cleanup();
    }
  }

  /**
   * Main gameplay loop - runs for 15 seconds with intelligent actions and screenshots
   */
  private async gameplayLoop(actionResults: SimpleActionResult[]): Promise<void> {
    if (!this.actions) {
      throw new BrowserError('Actions not initialized');
    }

    const startTime = Date.now();
    const maxDuration = 15000; // 15 seconds as specified in plan
    let actionCount = 0;

    logger.info('Starting gameplay loop (15 seconds)...');
    logger.info(`Initial state: ${this.currentState}`);

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

        // Analyze what actions are available
        const availableActions = await this.analyzeGameActions();

        if (availableActions.length === 0) {
          logger.warn('No actions found, waiting...');
          await this.actions.wait(2000);
          continue;
        }

        const actionToTake = availableActions[0];
        if (!actionToTake) {
          logger.warn('No valid action found, waiting...');
          await this.actions.wait(2000);
          continue;
        }

        logger.info(`[${this.currentState}] Action #${actionCount}: ${actionToTake}`);

        // Capture BEFORE screenshot
        const beforePath = await this.captureGameScreenshot(
          `action-${actionCount}-before.png`,
          gameContainer
        );

        // Execute the action
        const result = await this.actions.findAndClick(actionToTake);
        result.screenshotBefore = beforePath;

        // Wait for changes to render
        await this.actions.wait(500);

        // Capture AFTER screenshot
        const afterPath = await this.captureGameScreenshot(
          `action-${actionCount}-after.png`,
          gameContainer
        );
        result.screenshotAfter = afterPath;

        actionResults.push(result);

        if (beforePath && afterPath) {
          logger.info(`Screenshots: ${beforePath} → ${afterPath}`);
        }

        // Wait before next action
        await this.actions.wait(2000);
      } catch (error) {
        logger.warn('Error in gameplay loop, continuing...');
        await this.actions.wait(1000);
      }

      // Safety check - don't do too many actions
      if (actionCount >= 10) {
        logger.info('Reached action limit (10), stopping loop');
        break;
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(
      `Gameplay loop completed. Duration: ${elapsed}ms, Actions: ${actionResults.length}`
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
    const outputDir = this.config.outputDir || './output';

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
   * Detect current game state by observing the page
   * Uses multiple detection methods for robustness
   */
  private async detectGameState(): Promise<GameState> {
    if (!this.actions || !this.session) {
      return GameState.MENU;
    }

    try {
      const page = this.session.getPage();
      
      // Method 1: AI Vision Detection
      const visionState = await this.detectStateByVision();
      
      // Method 2: DOM Analysis
      const domState = await this.detectStateByDOM(page);
      
      // Method 3: URL Analysis
      const urlState = this.detectStateByURL(page);
      
      // Score the results
      let menuScore = 0;
      let gameScore = 0;
      
      if (visionState === GameState.MENU) menuScore += 3; // Vision is most reliable
      if (visionState === GameState.GAME) gameScore += 3;
      
      if (domState === GameState.MENU) menuScore += 2;
      if (domState === GameState.GAME) gameScore += 2;
      
      if (urlState === GameState.MENU) menuScore += 1;
      if (urlState === GameState.GAME) gameScore += 1;
      
      const detectedState = gameScore > menuScore ? GameState.GAME : GameState.MENU;
      
      logger.info(`State detection scores - MENU: ${menuScore}, GAME: ${gameScore} → ${detectedState}`);
      
      // Prevent rapid state flipping - require 2 consecutive detections
      if (detectedState !== this.currentState) {
        this.stateConfidenceCount++;
        if (this.stateConfidenceCount >= 2) {
          this.stateConfidenceCount = 0;
          return detectedState;
        } else {
          logger.info(`State change detected but waiting for confirmation (${this.stateConfidenceCount}/2)`);
          return this.currentState; // Stay in current state
        }
      } else {
        this.stateConfidenceCount = 0; // Reset if state is stable
      }
      
      return detectedState;
    } catch (error) {
      logger.warn('Error detecting game state, defaulting to current state');
      return this.currentState;
    }
  }

  /**
   * Detect state using AI vision (Stagehand observe)
   */
  private async detectStateByVision(): Promise<GameState> {
    if (!this.actions) return GameState.MENU;
    
    try {
      // Look for menu-related elements
      const menuObservation = await this.actions.findElements(
        'find start button, play button, play again button, next level button, or menu screen'
      );

      // Look for game-related elements
      const gameObservation = await this.actions.findElements(
        'find game board, playing field, game grid, game canvas, or active gameplay area'
      );

      // Score based on what we found
      const menuCount = menuObservation?.length || 0;
      const gameCount = gameObservation?.length || 0;
      
      logger.debug(`Vision detection - Menu elements: ${menuCount}, Game elements: ${gameCount}`);

      if (gameCount > 0 && menuCount === 0) {
        return GameState.GAME;
      } else if (menuCount > 0 && gameCount === 0) {
        return GameState.MENU;
      } else if (gameCount > menuCount) {
        return GameState.GAME;
      } else {
        return GameState.MENU;
      }
    } catch (error) {
      logger.debug('Vision detection failed');
      return GameState.MENU;
    }
  }

  /**
   * Detect state by analyzing DOM structure
   */
  private async detectStateByDOM(page: any): Promise<GameState> {
    try {
      const domAnalysis = await page.evaluate(() => {
        // Look for common game-related elements
        const canvas = document.querySelector('canvas');
        const gameBoard = document.querySelector('[class*="board"], [id*="board"], [class*="game"], [id*="game"]');
        
        // Look for common menu elements
        const startButton = document.querySelector('button[class*="start"], button[id*="start"], button:contains("Start")');
        const playButton = document.querySelector('button[class*="play"], button[id*="play"], [class*="menu"]');
        
        // Check visibility and size
        const hasLargeCanvas = canvas && canvas.getBoundingClientRect().width > 200;
        const hasGameBoard = gameBoard && gameBoard.getBoundingClientRect().width > 200;
        const hasMenuButton = startButton || playButton;
        
        return {
          hasCanvas: !!canvas,
          hasLargeCanvas,
          hasGameBoard,
          hasMenuButton,
        };
      });

      logger.debug(`DOM detection - Canvas: ${domAnalysis.hasLargeCanvas}, Board: ${domAnalysis.hasGameBoard}, Menu: ${domAnalysis.hasMenuButton}`);

      // Prioritize large canvas or game board as game indicators
      if (domAnalysis.hasLargeCanvas || domAnalysis.hasGameBoard) {
        return GameState.GAME;
      }
      
      if (domAnalysis.hasMenuButton) {
        return GameState.MENU;
      }

      return GameState.MENU;
    } catch (error) {
      logger.debug('DOM detection failed');
      return GameState.MENU;
    }
  }

  /**
   * Detect state by analyzing URL patterns
   */
  private detectStateByURL(page: any): GameState {
    try {
      const url = page.url().toLowerCase();
      
      // Some games change URL params or hash when playing
      if (url.includes('playing') || url.includes('game=active') || url.includes('#play')) {
        logger.debug('URL detection → GAME');
        return GameState.GAME;
      }
      
      if (url.includes('menu') || url.includes('start')) {
        logger.debug('URL detection → MENU');
        return GameState.MENU;
      }
      
      // URL doesn't help, return neutral (treated as MENU in scoring)
      return GameState.MENU;
    } catch (error) {
      return GameState.MENU;
    }
  }

  /**
   * Analyze game to find specific actions based on current state
   * Returns a list of action instructions to try
   */
  private async analyzeGameActions(): Promise<string[]> {
    // Detect current state
    const newState = await this.detectGameState();
    
    if (newState !== this.currentState) {
      logger.info(`🔄 State transition: ${this.currentState} → ${newState}`);
      this.currentState = newState;
    }

    if (this.currentState === GameState.MENU) {
      // MENU STATE: Look for buttons to start/continue the game
      return [
        'click on the start button',
        'click on the play button',
        'click on play again button',
        'click on next level button',
        'click on continue button',
        'click on 1P or single player button',
      ];
    } else {
      // GAME STATE: Make gameplay moves
      // For Tic-Tac-Toe specifically, but general enough for other games
      return [
        'click on an empty cell in the game board',
        'click on an empty square in the grid',
        'click on the center cell of the board',
        'click on a corner cell of the board',
        'click on any available space on the game board',
      ];
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
