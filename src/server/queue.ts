/**
 * Job Queue Manager - Sequential execution of QA tests
 */

import { logger } from '../utils/logger.js';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  outputDir: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  actionCount?: number;
  screenshotCount?: number;
  error?: string;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private queue: string[] = []; // Job IDs in order
  private currentJobId: string | null = null;
  private isProcessing: boolean = false;

  /**
   * Add URLs to the queue
   */
  addJobs(urls: string[]): Job[] {
    const newJobs: Job[] = [];

    for (const url of urls) {
      const job: Job = {
        id: crypto.randomUUID(),
        url,
        status: 'pending',
        outputDir: this.generateOutputDir(url),
        createdAt: new Date(),
      };

      this.jobs.set(job.id, job);
      this.queue.push(job.id);
      newJobs.push(job);

      logger.info(`Job added to queue: ${job.id} - ${url}`);
    }

    return newJobs;
  }

  /**
   * Generate unique output directory for URL
   */
  private generateOutputDir(url: string): string {
    // Sanitize URL for directory name
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '-');
    const pathname = urlObj.pathname.replace(/\//g, '-').replace(/^-/, '');
    const sanitized = `${hostname}${pathname}`.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-');

    // Generate timestamp
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '')
      .replace(/\..+/, '')
      .substring(0, 17); // YYYY-MM-DD_HHMMSS

    return `output/${sanitized}_${timestamp}`;
  }

  /**
   * Get next job from queue
   */
  getNextJob(): Job | null {
    if (this.queue.length === 0) {
      return null;
    }

    const jobId = this.queue[0];
    if (!jobId) {
      return null;
    }
    
    const job = this.jobs.get(jobId);
    return job || null;
  }

  /**
   * Mark job as started
   */
  startJob(jobId: string): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.status = 'running';
    job.startedAt = new Date();
    this.currentJobId = jobId;

    // Remove from queue
    this.queue = this.queue.filter((id) => id !== jobId);

    logger.info(`Job started: ${jobId} - ${job.url}`);
    return job;
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, metadata: { duration: number; actionCount: number; screenshotCount: number }): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.duration = metadata.duration;
    job.actionCount = metadata.actionCount;
    job.screenshotCount = metadata.screenshotCount;
    this.currentJobId = null;

    logger.info(`Job completed: ${jobId} - ${job.url} (${metadata.duration}ms)`);
    return job;
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): Job | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    job.status = 'failed';
    job.completedAt = new Date();
    job.error = error;
    this.currentJobId = null;

    // Remove from queue
    this.queue = this.queue.filter((id) => id !== jobId);

    logger.error(`Job failed: ${jobId} - ${job.url}: ${error}`);
    return job;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get run history (completed and failed jobs)
   */
  getHistory(): Job[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === 'completed' || job.status === 'failed')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
  }

  /**
   * Get current running job
   */
  getCurrentJob(): Job | null {
    if (!this.currentJobId) {
      return null;
    }
    return this.jobs.get(this.currentJobId) || null;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Check if processing
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Set processing state
   */
  setProcessing(state: boolean) {
    this.isProcessing = state;
  }
}

