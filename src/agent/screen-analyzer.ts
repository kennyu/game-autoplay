/**
 * Screen Analyzer - Uses LLM to understand game state and recommend actions
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Zod schema for type-safe LLM responses
export const ScreenAnalysisSchema = z.object({
  gameState: z.enum(['menu', 'playing', 'game_over', 'paused', 'loading']),
  gameType: z.string().min(1),
  visibleElements: z.array(z.string()),
  currentSituation: z.string().min(10),
  recommendedAction: z.string().min(10),
  reasoning: z.string().min(20),
  confidence: z.number().min(0).max(1),
});

export type ScreenAnalysis = z.infer<typeof ScreenAnalysisSchema>;

/**
 * Build the analysis prompt with action history
 */
function buildAnalysisPrompt(historyContext: string): string {
  return `You are a game-playing AI agent. Analyze the current screen and provide your assessment.
${historyContext}

CRITICAL RULES:
1. If you already clicked "Start", "Play", or "Restart" in previous actions, DO NOT click them again.
2. If the game board/grid is visible, focus on making moves in the game.
3. Review your previous actions to avoid repeating the same action.

GAME TYPES TO CONSIDER:
1. **Canvas-based games** (MOST COMMON): Games rendered on <canvas> or <image> elements
   - You won't see individual cells in the accessibility tree
   - You'll see: <canvas>, <image>, or visual game board elements
   - PRIORITY STRATEGY: Use keyboard controls FIRST (arrow keys, WASD, space bar, Enter)
   - FALLBACK: Click on the canvas element itself
   
2. **DOM-based games**: Clickable HTML elements (divs, buttons)
   - Individual game cells/tiles appear in the accessibility tree
   - Each cell is a separate clickable element

3. **Hybrid games**: Mix of both

DETECTION RULES:
- If you see "<canvas>", "<image>", or "game board image" → It's CANVAS-based
- If you see "no clickable cells" or previous cell clicks failed → It's CANVAS-based
- If you see individual cell elements in the tree → It's DOM-based

CANVAS GAME STRATEGY (USE THIS FIRST):
1. Try keyboard controls: arrow keys, WASD, Enter, Space
2. If keyboard doesn't work, click on the canvas/image element
3. For menus, look for DOM buttons outside the game area (Start, Restart, etc.)

DOM GAME STRATEGY (USE THIS SECOND):
1. Click on specific cells/elements you see in the accessibility tree
2. Use DOM buttons and controls

ADAPT based on what you observe and what worked before.

Please analyze what you see and respond in this EXACT JSON format:
{
  "gameState": "menu|playing|game_over|paused|loading",
  "gameType": "name of the game (e.g., tic-tac-toe, snake, etc.)",
  "visibleElements": ["list", "of", "key", "elements", "you", "see"],
  "currentSituation": "brief description of what's happening",
  "recommendedAction": "specific action to take next",
  "reasoning": "why this action makes sense",
  "confidence": 0.85
}

Be specific about the recommended action. Use this format:
- For keyboard: "press ArrowUp" or "press Space" or "press Enter" or "press w"
- For canvas clicks: "click on the game canvas" or "click on the center of the game board"
- For DOM elements: "click on the start button" or "click on the restart button"
- For specific cells (DOM): "click on the top-left cell"

IMPORTANT: For canvas/image-based games, ALWAYS prefer keyboard controls first!

Examples:
- Canvas game (Snake): "press ArrowUp" or "press w"
- Canvas game (menu): "press Enter" or "press Space"
- Canvas game (Tic Tac Toe): "click on the game canvas"
- DOM game: "click on the top-left empty cell"
- Menu (DOM): "click on the play button"

Respond ONLY with valid JSON, no other text.`;
}

export class ScreenAnalyzer {
  private stagehand: any;

  constructor(stagehand: any) {
    this.stagehand = stagehand;
  }

  /**
   * Analyze the current screen using LLM vision and reasoning
   * This is where the agent "thinks" about what it sees
   */
  async analyzeScreen(actionHistory: string[] = []): Promise<ScreenAnalysis> {
    try {
      logger.info('🧠 Analyzing screen with LLM...');

      // Build context about what we've tried before
      const historyContext = actionHistory.length > 0
        ? `\n\nPREVIOUS ACTIONS (most recent first):
${actionHistory.slice(-5).reverse().map((action, i) => `${i + 1}. ${action}`).join('\n')}

IMPORTANT:
- If an action succeeded (✓), the page should have changed
- If an action failed (✗), either the element doesn't exist or your understanding was wrong
- Adapt your strategy based on what worked and what didn't
- DO NOT repeat failed actions unless the situation has clearly changed
- Consider what should logically happen NEXT based on these results`
        : '\n\nThis is your first action on this page.';

      const analysisPrompt = buildAnalysisPrompt(historyContext);

      // Use Stagehand extract() with Zod schema
      const analysis = await this.stagehand.extract(analysisPrompt, ScreenAnalysisSchema);

      logger.info(`🎮 Game State: ${analysis.gameState}`);
      logger.info(`🎯 Recommended: ${analysis.recommendedAction}`);
      logger.info(`💭 Reasoning: ${analysis.reasoning}`);
      logger.info(`📊 Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);

      return analysis;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Screen analysis failed:', errorMsg);
      
      // Log specific error details to help debugging
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        logger.error('🔑 API authentication failed - check your OPENAI_API_KEY');
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        logger.error('⏳ API rate limit exceeded - consider reducing request frequency');
      } else if (errorMsg.includes('model')) {
        logger.error('🤖 Model error - verify MODEL_NAME is correct in config');
      } else if (errorMsg.includes('schema') || errorMsg.includes('validation')) {
        logger.error('📋 Schema validation failed - LLM returned unexpected format');
      }
      
      logger.warn('⚠️ Using fallback action due to analysis failure');
      
      // Fallback to basic observation if analysis fails
      return {
        gameState: 'menu',
        gameType: 'unknown',
        visibleElements: [],
        currentSituation: 'Unable to analyze',
        recommendedAction: 'click on any visible button',
        reasoning: 'Fallback action due to analysis failure',
        confidence: 0.3,
      };
    }
  }

}

