/**
 * Zod schemas for LLM evaluation responses
 */

import { z } from 'zod';

/**
 * Evaluation schema - LLM returns boolean checks for each criterion
 */
export const EvaluationSchema = z.object({
  gameLoaded: z.boolean(),
  controlsResponsive: z.boolean(),
  gameStable: z.boolean(),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    description: z.string(),
    evidence: z.string(),
  })),
  reasoning: z.string(),
});

/**
 * Point values for each check (must sum to 100)
 */
export const SCORE_WEIGHTS = {
  gameLoaded: 30,         // Did game load and render?
  controlsResponsive: 40, // Are controls working? (most important)
  gameStable: 30,         // Did game run without crashes?
};

export type EvaluationResult = z.infer<typeof EvaluationSchema>;

