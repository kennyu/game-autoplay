/**
 * Game evaluator - uses LLM to assess playability from AgentResult data
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { logger } from '../utils/logger.js';
import type { AgentResult } from '../agent/orchestrator.js';
import type { QAResult } from '../types/index.js';
import { EvaluationSchema, SCORE_WEIGHTS, type EvaluationResult } from './schemas.js';
import { buildEvaluationPrompt } from './prompts.js';

/**
 * GameEvaluator analyzes AgentResult data using LLM to determine playability
 * Uses OpenAI structured outputs for reliable boolean checks
 */
export class GameEvaluator {
  private openai: OpenAI;
  
  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      logger.warn('⚠️ No OpenAI API key provided - evaluation will use fallback heuristics');
    }
    
    this.openai = new OpenAI({
      apiKey: key,
    });
  }
  
  /**
   * Evaluate game playability from agent execution results
   * Returns structured QAResult with pass/fail, score, and issues
   */
  async evaluate(result: AgentResult): Promise<QAResult> {
    try {
      logger.info('🧠 Starting game evaluation...');
      
      // Build prompt with all evidence (data only, no images)
      const prompt = buildEvaluationPrompt(result);
      
      // Use OpenAI structured outputs with Zod schema
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are an expert at evaluating web game playability based on automated test results. Analyze the evidence and provide a structured assessment with boolean checks only."
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        response_format: zodResponseFormat(EvaluationSchema, "evaluation"),
        temperature: 0.3,  // Lower temperature for more consistent evaluation
      });
      
      const evaluation = completion.choices[0].message.parsed;
      
      if (!evaluation) {
        throw new Error('Failed to parse evaluation response');
      }
      
      // Calculate score from boolean checks
      const score = 
        (evaluation.gameLoaded ? SCORE_WEIGHTS.gameLoaded : 0) +
        (evaluation.controlsResponsive ? SCORE_WEIGHTS.controlsResponsive : 0) +
        (evaluation.gameStable ? SCORE_WEIGHTS.gameStable : 0);
      
      logger.info(`📊 Evaluation complete: ${score}/100`);
      logger.info(`   ✓ Game Loaded: ${evaluation.gameLoaded ? 'PASS' : 'FAIL'}`);
      logger.info(`   ✓ Controls Responsive: ${evaluation.controlsResponsive ? 'PASS' : 'FAIL'}`);
      logger.info(`   ✓ Game Stable: ${evaluation.gameStable ? 'PASS' : 'FAIL'}`);
      
      // Convert to QAResult format
      return this.convertToQAResult(result, evaluation);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check for common API key issues
      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('API key')) {
        logger.error('❌ OpenAI API authentication failed - check your OPENAI_API_KEY');
        logger.error(`Error: ${errorMsg}`);
      } else if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        logger.error('❌ OpenAI API rate limit exceeded - please wait and try again');
      } else {
        logger.error('❌ Evaluation failed, using fallback heuristics', error as Error);
      }
      
      return this.fallbackEvaluation(result);
    }
  }
  
  /**
   * Convert LLM evaluation to QAResult format
   */
  private convertToQAResult(result: AgentResult, evaluation: EvaluationResult): QAResult {
    const successfulActions = result.actions.filter(a => a.success).length;
    const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
    
    // Calculate score from boolean checks (0-100)
    const score = 
      (evaluation.gameLoaded ? SCORE_WEIGHTS.gameLoaded : 0) +
      (evaluation.controlsResponsive ? SCORE_WEIGHTS.controlsResponsive : 0) +
      (evaluation.gameStable ? SCORE_WEIGHTS.gameStable : 0);
    
    return {
      gameUrl: result.gameUrl,
      status: score >= 50 ? 'pass' : 'fail',  // Pass if score ≥50
      playabilityScore: score,
      checks: {
        gameLoaded: evaluation.gameLoaded,
        controlsResponsive: evaluation.controlsResponsive,
        gameStable: evaluation.gameStable,
      },
      issues: evaluation.issues,
      duration: result.duration,
      timestamp: new Date(),
      screenshots: result.screenshots,
      actions: result.actions,  // Include detailed action history
      metadata: {
        actionCount: result.actions.length,
        successfulActions,
        consoleErrors: errorCount,
      },
    };
  }
  
  /**
   * Fallback evaluation using heuristics if LLM fails
   * Uses same boolean logic as LLM would apply
   */
  private fallbackEvaluation(result: AgentResult): QAResult {
    logger.warn('⚠️ Using fallback heuristic evaluation (LLM unavailable)');
    
    const successRate = result.actions.length > 0
      ? result.actions.filter(a => a.success).length / result.actions.length
      : 0;
    const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
    
    // Apply same boolean checks as LLM would
    const gameLoaded = successRate > 0;
    const controlsResponsive = successRate >= 0.5;
    const gameStable = result.success && errorCount === 0;
    
    // Calculate score from boolean checks
    const score = 
      (gameLoaded ? SCORE_WEIGHTS.gameLoaded : 0) +
      (controlsResponsive ? SCORE_WEIGHTS.controlsResponsive : 0) +
      (gameStable ? SCORE_WEIGHTS.gameStable : 0);
    
    logger.info(`📊 Fallback evaluation complete: ${score}/100`);
    logger.info(`   ✓ Game Loaded: ${gameLoaded ? 'PASS' : 'FAIL'} (${(successRate * 100).toFixed(0)}% success rate)`);
    logger.info(`   ✓ Controls Responsive: ${controlsResponsive ? 'PASS' : 'FAIL'} (≥50% threshold)`);
    logger.info(`   ✓ Game Stable: ${gameStable ? 'PASS' : 'FAIL'} (${errorCount} errors)`);
    
    return {
      gameUrl: result.gameUrl,
      status: score >= 50 ? 'pass' : 'fail',
      playabilityScore: score,
      checks: {
        gameLoaded,
        controlsResponsive,
        gameStable,
      },
      issues: [
        {
          severity: 'minor',
          description: 'Evaluation used fallback heuristics (LLM unavailable)',
          evidence: 'OpenAI API unavailable or failed',
        },
      ],
      duration: result.duration,
      timestamp: new Date(),
      screenshots: result.screenshots,
      actions: result.actions,  // Include detailed action history
      metadata: {
        actionCount: result.actions.length,
        successfulActions: result.actions.filter(a => a.success).length,
        consoleErrors: errorCount,
      },
    };
  }
}

