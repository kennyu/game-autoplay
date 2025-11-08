/**
 * Runner - Executes agent jobs with event streaming via WebSocket
 */

import { BrowserAgent } from '../agent/orchestrator.js';
import { loadConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { QAResult } from '../types/index.js';
import type { DashboardServer } from './index.js';
import type { Job, JobQueue } from './queue.js';
import * as fs from 'fs';
import * as path from 'path';

export class JobRunner {
  private server: DashboardServer;
  private queue: JobQueue;
  private isRunning: boolean = false;
  private activeJobCount: number = 0;

  constructor(server: DashboardServer, queue: JobQueue) {
    this.server = server;
    this.queue = queue;
  }

  /**
   * Start processing jobs from the queue (parallel execution)
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Job runner already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Job runner started (parallel mode)');

    // Process jobs in parallel
    while (this.isRunning) {
      // Check if we can start more jobs
      if (this.queue.canStartMoreJobs()) {
        const jobsToStart = this.queue.getNextJobs();
        
        if (jobsToStart.length > 0) {
          logger.info(`Starting ${jobsToStart.length} jobs...`);
          
          // Start all jobs in parallel (fire and forget)
          for (const job of jobsToStart) {
            this.runJob(job).catch((error) => {
              logger.error(`Unhandled error in job ${job.id}:`, error);
            });
          }
        }
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
   * Run a single job (can run in parallel with other jobs)
   */
  private async runJob(job: Job) {
    this.activeJobCount++;
    
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

      // Run the agent (now returns QAResult with evaluation)
      const result = await agent.run(job.url);

      // Save run metadata
      await this.saveMetadata(job, result);

      // Mark job as completed
      this.queue.completeJob(job.id, {
        duration: result.duration,
        actionCount: result.metadata.actionCount,
        screenshotCount: result.screenshots.length,
      });

      // Broadcast job completed with evaluation results
      this.server.broadcast({
        type: 'job-completed',
        data: {
          jobId: job.id,
          url: job.url,
          // Evaluation results
          status: result.status,
          playabilityScore: result.playabilityScore,
          checks: result.checks,
          issues: result.issues,
          // Metadata
          duration: result.duration,
          actionCount: result.metadata.actionCount,
          successfulActions: result.metadata.successfulActions,
          consoleErrors: result.metadata.consoleErrors,
          screenshotCount: result.screenshots.length,
        },
      });

      // Broadcast queue update
      const stats = this.queue.getStats();
      this.server.broadcast({
        type: 'queue-update',
        data: stats,
      });
      
      this.activeJobCount--;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Job failed: ${job.id} - ${errorMsg}`);
      this.activeJobCount--;

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
   * Save run metadata to JSON file (now includes evaluation results)
   */
  private async saveMetadata(job: Job, result: QAResult): Promise<void> {
    try {
      const metadata = {
        jobId: job.id,
        url: job.url,
        startedAt: job.startedAt,
        completedAt: new Date(),
        timestamp: result.timestamp,
        // Evaluation results
        status: result.status,
        playabilityScore: result.playabilityScore,
        checks: result.checks,
        issues: result.issues,
        // Test metadata
        duration: result.duration,
        actionCount: result.metadata.actionCount,
        successfulActions: result.metadata.successfulActions,
        consoleErrors: result.metadata.consoleErrors,
        // Screenshots
        screenshots: result.screenshots,
        screenshotCount: result.screenshots.length,
      };

      const metadataPath = path.join(job.outputDir, 'run-metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      logger.info(`Saved metadata: ${metadataPath}`);
    } catch (error) {
      logger.error('Failed to save metadata', error as Error);
    }
  }
}

