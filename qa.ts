#!/usr/bin/env bun
/**
 * QA Agent CLI - Run browser automation against any game URL
 * 
 * Usage:
 *   bun qa.ts <url>
 *   bun qa.ts https://playtictactoe.net/
 */

import { BrowserAgent } from './src/agent/orchestrator.js';
import { loadConfig } from './src/config/index.js';
import { logger } from './src/utils/logger.js';

async function main() {
  // Get URL from command line argument
  const url = process.argv[2];

  if (!url) {
    console.error('❌ Error: Please provide a URL');
    console.log('\nUsage:');
    console.log('  bun qa.ts <url>');
    console.log('\nExamples:');
    console.log('  bun qa.ts https://playtictactoe.net/');
    console.log('  bun qa.ts https://isnoahalive.com/games/snake/');
    process.exit(1);
  }

  try {
    logger.info('=== Game QA Agent ===');
    logger.info(`Target URL: ${url}`);

    // Load configuration
    const config = loadConfig();
    logger.info(`Browser Mode: ${config.browserMode}`);
    logger.info(`Model: ${config.modelName}`);
    logger.info(`Headless: ${config.headless}`);

    // Create and run agent
    const agent = new BrowserAgent(config);
    logger.info('Starting agent...');

    const result = await agent.run(url);

    // Display evaluation results
    logger.info('\n=== 📊 EVALUATION RESULTS ===');
    logger.info(`Status: ${result.status.toUpperCase()}`);
    logger.info(`Playability Score: ${result.playabilityScore}/100\n`);

    logger.info('Checks:');
    logger.info(`  ${result.checks.gameLoaded ? '✅' : '❌'} Game Loaded (30pts): ${result.checks.gameLoaded ? 'PASS' : 'FAIL'}`);
    logger.info(`  ${result.checks.controlsResponsive ? '✅' : '❌'} Controls Responsive (40pts): ${result.checks.controlsResponsive ? 'PASS' : 'FAIL'}`);
    logger.info(`  ${result.checks.gameStable ? '✅' : '❌'} Game Stable (30pts): ${result.checks.gameStable ? 'PASS' : 'FAIL'}\n`);

    // Show issues if found
    if (result.issues.length > 0) {
      logger.info('🐛 Issues Found:');
      result.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟡' : '🔵';
        logger.info(`  ${icon} [${issue.severity}] ${issue.description}`);
        if (issue.evidence) {
          logger.info(`     Evidence: ${issue.evidence}`);
        }
      });
      logger.info('');
    }

    // Show metadata
    logger.info('📈 Test Metadata:');
    logger.info(`  ⏱️  Duration: ${result.duration}ms`);
    logger.info(`  🎯 Actions: ${result.metadata.actionCount} (${result.metadata.successfulActions} successful)`);
    logger.info(`  📝 Console Errors: ${result.metadata.consoleErrors}`);
    logger.info(`  📸 Screenshots: ${result.screenshots.length}`);

    // Exit with appropriate code
    if (result.status === 'fail') {
      logger.error('\n❌ Game evaluation: FAILED');
      process.exit(1);
    } else {
      logger.info('\n✅ Game evaluation: PASSED');
      process.exit(0);
    }
  } catch (error) {
    logger.error('❌ Fatal error', error as Error);
    process.exit(1);
  }
}

main();

