/**
 * Runner - Executes agent jobs with event streaming via WebSocket
 */

import { BrowserAgent } from '../agent/orchestrator.js';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { DashboardServer } from './index.js';
import type { Job, JobQueue } from './queue.js';
import * as fs from 'fs';
import * as path from 'path';

export class JobRunner {
  private server: DashboardServer;
  private queue: JobQueue;
  private isRunning: boolean = false;

  constructor(server: DashboardServer, queue: JobQueue) {
    this.server = server;
    this.queue = queue;
  }

  /**
   * Start processing jobs from the queue
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Job runner already running');
      return;
    }

    this.isRunning = true;
    logger.info('Job runner started');

    // Process jobs sequentially
    while (this.isRunning) {
      const nextJob = this.queue.getNextJob();

      if (!nextJob) {
        // No more jobs, wait a bit and check again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      await this.runJob(nextJob);
    }
  }

  /**
   * Stop the job runner
   */
  stop() {
    this.isRunning = false;
    logger.info('Job runner stopped');
  }

  /**
   * Run a single job
   */
  private async runJob(job: Job) {
    try {
      // Mark job as started
      this.queue.startJob(job.id);

      // Broadcast job started
      this.server.broadcast({
        type: 'job-started',
        data: {
          jobId: job.id,
          url: job.url,
          outputDir: job.outputDir,
        },
      });

      // Create output directory
      await this.ensureOutputDir(job.outputDir);

      // Load config and set custom output dir
      const config = loadConfig();
      config.customOutputDir = job.outputDir;

      // Create agent with event listeners
      const agent = new BrowserAgent(config);

      // Set up event forwarding to WebSocket clients
      agent.on('log', (data) => {
        this.server.broadcast({
          type: 'log',
          data: {
            jobId: job.id,
            ...data,
          },
        });
      });

      agent.on('screenshot', (data) => {
        this.server.broadcast({
          type: 'screenshot',
          data: {
            jobId: job.id,
            ...data,
          },
        });
      });

      agent.on('action', (data) => {
        this.server.broadcast({
          type: 'action',
          data: {
            jobId: job.id,
            ...data,
          },
        });
      });

      // Run the agent
      const result = await agent.run(job.url);

      // Save run metadata
      await this.saveMetadata(job, result);

      // Mark job as completed
      this.queue.completeJob(job.id, {
        duration: result.duration,
        actionCount: result.actions.length,
        screenshotCount: result.screenshots.length,
      });

      // Broadcast job completed
      this.server.broadcast({
        type: 'job-completed',
        data: {
          jobId: job.id,
          url: job.url,
          duration: result.duration,
          actionCount: result.actions.length,
          screenshotCount: result.screenshots.length,
          success: result.success,
        },
      });

      // Broadcast queue update
      const stats = this.queue.getStats();
      this.server.broadcast({
        type: 'queue-update',
        data: stats,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Job failed: ${job.id} - ${errorMsg}`);

      // Mark job as failed
      this.queue.failJob(job.id, errorMsg);

      // Broadcast job failed
      this.server.broadcast({
        type: 'job-failed',
        data: {
          jobId: job.id,
          url: job.url,
          error: errorMsg,
        },
      });

      // Broadcast queue update
      const stats = this.queue.getStats();
      this.server.broadcast({
        type: 'queue-update',
        data: stats,
      });
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created output directory: ${dir}`);
    }
  }

  /**
   * Save run metadata to JSON file
   */
  private async saveMetadata(job: Job, result: any): Promise<void> {
    try {
      const metadata = {
        jobId: job.id,
        url: job.url,
        startedAt: job.startedAt,
        completedAt: new Date(),
        duration: result.duration,
        actionCount: result.actions.length,
        screenshotCount: result.screenshots.length,
        success: result.success,
        error: result.error,
        actions: result.actions.map((a: any) => ({
          action: a.action,
          success: a.success,
          timestamp: a.timestamp,
          error: a.error,
        })),
        consoleLogs: result.consoleLogs,
        screenshots: result.screenshots,
      };

      const metadataPath = path.join(job.outputDir, 'run-metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      logger.info(`Saved metadata: ${metadataPath}`);
    } catch (error) {
      logger.error('Failed to save metadata', error as Error);
    }
  }
}

