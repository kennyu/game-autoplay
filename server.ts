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

async function main() {
  logger.info('🚀 Starting Game QA Agent Dashboard...');

  // Ensure output directory exists
  const fs = await import('fs');
  if (!fs.existsSync('./output')) {
    fs.mkdirSync('./output', { recursive: true });
    logger.info('Created output directory');
  }

  // Create server
  const server = new DashboardServer({
    port: 3000,
    publicDir: './public',
  });

  // Create job queue
  const queue = new JobQueue();

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
      const runs: any[] = [];
      
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
      runs.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      
      return new Response(JSON.stringify({ runs }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Error reading results:', error);
      return new Response(JSON.stringify({ runs: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });

  // SSE endpoint - Stream real-time job events
  server.registerApiHandler('/api/stream/:jobId', async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];
    
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check if job exists
    const job = queue.getJob(jobId);
    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    logger.info(`SSE stream requested for job: ${jobId}`);
    
    // Create SSE stream for this specific job
    return server.createSSEStream(jobId);
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
  logger.info('📊 Open http://localhost:3000 in your browser');
}

main().catch((error) => {
  logger.error('Fatal error starting server:', error);
  process.exit(1);
});

