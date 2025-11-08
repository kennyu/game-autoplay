/**
 * Prompt builder for game evaluation
 */

import type { AgentResult } from '../agent/orchestrator.js';

/**
 * Build evaluation prompt from agent execution results
 * Uses data-only analysis (no visual inspection)
 */
export function buildEvaluationPrompt(result: AgentResult): string {
  const errorCount = result.consoleLogs.filter(l => l.type === 'error').length;
  const successRate = result.actions.length > 0 
    ? result.actions.filter(a => a.success).length / result.actions.length 
    : 0;
  
  return `
You are evaluating if a web game is playable based on automated testing data.
Answer each criterion with TRUE or FALSE based on the evidence below.

=== GAME DATA ===
URL: ${result.gameUrl}
Duration: ${result.duration}ms
Actions: ${result.actions.length} total (${(successRate * 100).toFixed(0)}% successful)
Console Errors: ${errorCount}
Execution Completed: ${result.success ? 'YES' : 'NO'}

=== ACTION SEQUENCE ===
${result.actions.map((a, i) => 
  `${i + 1}. ${a.action} → ${a.success ? 'SUCCESS ✓' : 'FAILED ✗'}${a.error ? ` (${a.error})` : ''}`
).join('\n')}

=== EVALUATION CRITERIA ===

1. **gameLoaded** (30 points)
   - TRUE if: Success rate >0% (at least some actions worked, indicating game loaded and was interactive)
   - FALSE if: All actions failed OR zero actions performed

2. **controlsResponsive** (40 points) 
   - TRUE if: Success rate ≥50% (majority of actions worked)
   - FALSE if: Success rate <50%
   - Note: This is the most important criterion!

3. **gameStable** (30 points)
   - TRUE if: Execution completed AND no critical console errors
   - FALSE if: Execution did not complete OR has crash/freeze errors

=== SCORING REFERENCE ===
- 100 points: All 3 checks pass (fully playable)
- 70 points: 2 checks pass (playable with issues)
- 30-40 points: 1 check passes (partially playable)
- 0 points: All checks fail (not playable)

=== YOUR TASK ===
Provide structured evaluation with:
1. Boolean value (TRUE/FALSE) for each of the 3 checks above
2. List of issues found (with severity: critical/major/minor, description, and evidence)
3. Brief reasoning for your TRUE/FALSE decisions

Be objective and base your evaluation ONLY on the data provided above.
`;
}

