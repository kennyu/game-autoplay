#!/usr/bin/env bun
/**
 * Dashboard Server Entry Point
 * 
 * Usage:
 *   bun server.ts
 */

import { DashboardServer } from './src/server/index.js';
import { JobQueue } from './src/server/queue.js';
import { JobRunner } from './src/server/runner.js';
import { logger } from './src/utils/logger.js';
import { loadConfig } from './src/config/index.js';

async function main() {
  logger.info('🚀 Starting Game QA Agent Dashboard...');

  // Load configuration
  const config = loadConfig();

  // Create server (use PORT env var for cloud deployments like Fly.io)
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = new DashboardServer({
    port,
    publicDir: './public',
  });

  // Create job queue with max concurrent jobs based on browser mode
  const queue = new JobQueue();
  const maxConcurrent = config.maxConcurrentJobs[config.browserMode];
  queue.setMaxConcurrent(maxConcurrent);
  logger.info(`📊 Configured for ${maxConcurrent} concurrent jobs in ${config.browserMode} mode`);

  // Register API handlers
  server.registerApiHandler('/api/run', async (req: Request) => {
    try {
      const body = await req.json();
      const { urls } = body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return new Response(JSON.stringify({ success: false, message: 'No URLs provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Add jobs to queue
      const jobs = queue.addJobs(urls);

      // Broadcast queue update
      server.broadcast({
        type: 'queue-update',
        data: queue.getStats(),
      });

      return new Response(JSON.stringify({ success: true, jobs }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to parse request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });

  server.registerApiHandler('/api/status', async (req: Request) => {
    const stats = queue.getStats();
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  server.registerApiHandler('/api/history', async (req: Request) => {
    const history = queue.getHistory();
    return new Response(JSON.stringify({ runs: history }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  server.registerApiHandler('/api/results', async (req: Request) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const outputDir = './output';
      
      // Read all directories in output folder
      const entries = fs.readdirSync(outputDir);
      const runs = [];
      
      for (const entry of entries) {
        const fullPath = path.join(outputDir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          const metadataPath = path.join(fullPath, 'run-metadata.json');
          if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            runs.push({
              folder: entry,
              ...metadata,
            });
          }
        }
      }
      
      // Sort by date, most recent first
      runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      
      return new Response(JSON.stringify({ runs }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ runs: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });

  // Start server
  server.start();

  // Create and start job runner
  const runner = new JobRunner(server, queue);
  runner.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n🛑 Shutting down gracefully...');
    runner.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\n🛑 Shutting down gracefully...');
    runner.stop();
    process.exit(0);
  });

  logger.info('✅ Dashboard ready!');
  logger.info(`📊 Open http://localhost:${port} in your browser`);
}

main().catch((error) => {
  logger.error('Fatal error starting server:', error);
  process.exit(1);
});

