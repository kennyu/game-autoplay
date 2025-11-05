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

    // Display results
    logger.info('\n=== Test Results ===');
    logger.info(`✅ Success: ${result.success}`);
    logger.info(`⏱️  Duration: ${result.duration}ms`);
    logger.info(`🎯 Actions performed: ${result.actions.length}`);
    logger.info(`📝 Console logs captured: ${result.consoleLogs.length}`);

    // Show action summary with screenshots
    if (result.actions.length > 0) {
      logger.info('\n📸 Actions with screenshots:');
      result.actions.forEach((action, i) => {
        const status = action.success ? '✅' : '❌';
        logger.info(`  ${i + 1}. ${status} ${action.action}`);
        if (action.screenshotBefore) {
          logger.info(`     📷 Before: ${action.screenshotBefore}`);
        }
        if (action.screenshotAfter) {
          logger.info(`     📷 After: ${action.screenshotAfter}`);
        }
        if (action.error) {
          logger.info(`     ⚠️  Error: ${action.error}`);
        }
      });
    }

    if (result.error) {
      logger.error('\n❌ Error occurred', { error: result.error });
      process.exit(1);
    } else {
      logger.info('\n✅ Test completed successfully!');
      process.exit(0);
    }
  } catch (error) {
    logger.error('❌ Fatal error', error as Error);
    process.exit(1);
  }
}

main();

