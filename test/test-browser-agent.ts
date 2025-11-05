/**
 * Test the browser agent implementation
 */

import { BrowserAgent } from '../src/agent/orchestrator.js';
import { loadConfig } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';
import { readFile } from 'fs/promises';

async function main() {
  try {
    logger.info('=== Browser Agent Test ===');

    // Load configuration
    const config = loadConfig();
    logger.info('Configuration loaded');

    // Read test URL from file
    const urlFile = await readFile('./url-to-test.txt', 'utf-8');
    const testUrl = urlFile.split('\n')[0].trim();

    logger.info(`Test URL: ${testUrl}`);

    // Create and run agent
    const agent = new BrowserAgent(config);
    logger.info('Starting agent (15 seconds)...');

    const result = await agent.run(testUrl);

    // Display results
    logger.info('=== Test Results ===');
    logger.info(`Success: ${result.success}`);
    logger.info(`Duration: ${result.duration}ms`);
    logger.info(`Actions performed: ${result.actions.length}`);
    logger.info(`Console logs captured: ${result.consoleLogs.length}`);

    // Show action summary with screenshots
    if (result.actions.length > 0) {
      logger.info('Actions with screenshots:');
      result.actions.forEach((action, i) => {
        const status = action.success ? '✓' : '✗';
        logger.info(`  ${i + 1}. ${status} ${action.action}`);
        if (action.screenshotBefore) {
          logger.info(`     Before: ${action.screenshotBefore}`);
        }
        if (action.screenshotAfter) {
          logger.info(`     After: ${action.screenshotAfter}`);
        }
      });
    }

    if (result.error) {
      logger.error('Error occurred', { error: result.error });
    } else {
      logger.info('✅ Test completed successfully!');
    }
  } catch (error) {
    logger.error('Test failed', error as Error);
    process.exit(1);
  }
}

main();

