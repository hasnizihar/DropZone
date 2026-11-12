import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type {
  DownloadJob,
  DownloadEngineType,
  CreateDownloadOptions,
  DownloadProgressEventPayload,
  DownloadCompletedEventPayload,
  DownloadFailedEventPayload,
  DownloadCancelledEventPayload,
  DownloadPausedEventPayload,
} from '@dropzone/shared';
import { WorkerManager } from '../worker/WorkerManager';

export interface QueueManagerConfig {
  maxConcurrentDownloads?: number;
  autoStartDownloads?: boolean;
  defaultDownloadDir: string;
}

export class QueueManager extends EventEmitter {
  private jobs = new Map<string, DownloadJob>();
  private activeJobIds = new Set<string>();
  private maxConcurrentDownloads: number;
  private autoStartDownloads: boolean;
  private defaultDownloadDir: string;
  private workerManager: WorkerManager;

  constructor(workerManager: WorkerManager, config: QueueManagerConfig) {
    super();
    this.workerManager = workerManager;
    this.maxConcurrentDownloads = config.maxConcurrentDownloads ?? 3;
    this.autoStartDownloads = config.autoStartDownloads ?? true;
    this.defaultDownloadDir = config.defaultDownloadDir;

    this.bindWorkerEvents();
  }

  private bindWorkerEvents(): void {
    this.workerManager.on('download-progress', (payload: DownloadProgressEventPayload) => {
      this.handleWorkerProgress(payload);
    });

    this.workerManager.on('download-completed', (payload: DownloadCompletedEventPayload) => {
      this.handleWorkerCompleted(payload);
    });

    this.workerManager.on('download-failed', (payload: DownloadFailedEventPayload) => {
      this.handleWorkerFailed(payload);
    });

    this.workerManager.on('download-cancelled', (payload: DownloadCancelledEventPayload) => {
      this.handleWorkerCancelled(payload);
    });

    this.workerManager.on('download-paused', (payload: DownloadPausedEventPayload) => {
      this.handleWorkerPaused(payload);
    });

    // Handle worker process unexpected crash
    this.workerManager.on('crash', () => {
      console.warn('[QueueManager] Worker crashed; marking in-flight downloads for retry/paused.');
      for (const id of Array.from(this.activeJobIds)) {
        const job = this.jobs.get(id);
        if (job) {
          job.status = 'failed';
          job.error = {
            code: 'WORKER_CRASHED',
            message: 'Background worker subprocess exited unexpectedly during download.',
          };
          job.speedBytesPerSec = 0;
          job.updatedAt = new Date().toISOString();
          this.emit('job-updated', job);
        }
      }
      this.activeJobIds.clear();
    });
  }

  public processQueue(): void {
    if (!this.autoStartDownloads) {
      return;
    }

    const availableSlots = this.maxConcurrentDownloads - this.activeJobIds.size;
    if (availableSlots <= 0) {
      return;
    }

    // Find all pending execution jobs, sorted chronologically (FIFO)
    // Note: 'image-gallery' parent container jobs don't consume concurrency slots; their child assets do
    const pendingJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending' && j.engine !== 'image-gallery')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const jobsToStart = pendingJobs.slice(0, availableSlots);
    for (const job of jobsToStart) {
      this.startJob(job);
    }
  }

  private async startJob(job: DownloadJob): Promise<void> {
    if (this.activeJobIds.has(job.id)) {
      return;
    }

    this.activeJobIds.add(job.id);
    job.status = 'downloading';
    job.updatedAt = new Date().toISOString();
    this.emit('job-updated', job);

    const targetDirectory = job.targetDirectory || this.defaultDownloadDir;
    const isAudioExtraction = job.category === 'file' && (job.selectedFormatId === 'audio_only' || job.title.endsWith('.mp3'));

    try {
      await this.workerManager.startDownload({
        jobId: job.id,
        url: job.url,
        engine: job.engine,
        formatId: job.selectedFormatId,
        targetDirectory,
        customFilename: job.customFilename || job.title,
        extractAudio: isAudioExtraction,
      });
    } catch (err: any) {
      // Rejection will also be handled if download.failed event was not fired
      if (this.activeJobIds.has(job.id)) {
        this.handleWorkerFailed({
          jobId: job.id,
          code: 'DOWNLOAD_FAILED',
          message: err?.message || 'Failed to start download in worker.',
        });
      }
    }
  }

  public addJob(options: CreateDownloadOptions): DownloadJob {
    if (options.assets && options.assets.length > 0) {
      const parentId = `job_gal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const selectedAssets = options.assets.filter((a) => a.selected !== false);
      const parentJob: DownloadJob = {
        id: parentId,
        url: options.url,
        title: options.customFilename || `Gallery (${selectedAssets.length} images)`,
        source: options.url.split('/')[2] || 'web',
        category: 'image',
        engine: 'image-gallery',
        status: 'downloading',
        targetDirectory: options.targetDirectory || this.defaultDownloadDir,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        assetCount: selectedAssets.length,
        completedAssetsCount: 0,
        childJobIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(parentId, parentJob);
      this.emit('job-added', parentJob);

      for (const asset of selectedAssets) {
        const childId = `job_${parentId}_${asset.index}`;
        parentJob.childJobIds!.push(childId);
        const childJob: DownloadJob = {
          id: childId,
          parentJobId: parentId,
          url: asset.url,
          title: asset.filename,
          source: parentJob.source,
          category: 'image',
          engine: 'direct-http',
          status: 'pending',
          targetDirectory: parentJob.targetDirectory,
          customFilename: asset.filename,
          thumbnail: asset.thumbnail,
          progress: 0,
          downloadedBytes: 0,
          totalBytes: asset.fileSizeBytes || 0,
          speedBytesPerSec: 0,
          etaSeconds: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.jobs.set(childId, childJob);
        this.emit('job-added', childJob);
      }
      this.processQueue();
      return parentJob;
    }

    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const filename = options.customFilename || options.url.split('/').pop()?.split('?')[0] || 'Download Job';
    const isImage = options.category === 'image' || /\.(jpe?g|png|gif|webp|svg|bmp|tiff|avif)($|\?)/i.test(options.url);
    const engine: DownloadEngineType = options.engine || (isImage ? 'direct-http' : (options.category === 'file' ? 'direct-http' : 'yt-dlp'));

    const newJob: DownloadJob = {
      id,
      url: options.url,
      title: filename,
      source: options.url.split('/')[2] || 'web',
      category: options.category || (isImage ? 'image' : (options.extractAudio ? 'file' : 'video')),
      engine,
      status: 'pending',
      selectedFormatId: options.selectedFormatId || 'best',
      targetDirectory: options.targetDirectory || this.defaultDownloadDir,
      customFilename: options.customFilename,
      parentJobId: options.parentJobId,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      etaSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(id, newJob);
    this.emit('job-added', newJob);
    this.processQueue();
    return newJob;
  }

  public async pauseJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.childJobIds && job.childJobIds.length > 0) {
      for (const childId of job.childJobIds) {
        await this.pauseJob(childId);
      }
      job.status = 'paused';
      job.updatedAt = new Date().toISOString();
      this.emit('job-updated', job);
      return true;
    }

    if (this.activeJobIds.has(jobId)) {
      try {
        await this.workerManager.pauseDownload(jobId);
      } catch (e) {
        console.warn(`Failed to signal pause to worker for job ${jobId}:`, e);
      }
      this.activeJobIds.delete(jobId);
    }

    job.status = 'paused';
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.updatedAt = new Date().toISOString();
    this.emit('job-updated', job);
    this.processQueue();
    return true;
  }

  public async resumeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.childJobIds && job.childJobIds.length > 0) {
      for (const childId of job.childJobIds) {
        const child = this.jobs.get(childId);
        if (child && child.status === 'paused') {
          await this.resumeJob(childId);
        }
      }
      job.status = 'pending';
      job.updatedAt = new Date().toISOString();
      this.emit('job-updated', job);
      return true;
    }

    job.status = 'pending';
    job.error = undefined;
    job.updatedAt = new Date().toISOString();
    this.emit('job-updated', job);
    this.processQueue();
    return true;
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.childJobIds && job.childJobIds.length > 0) {
      for (const childId of job.childJobIds) {
        await this.cancelJob(childId);
      }
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      this.emit('job-updated', job);
      return true;
    }

    if (this.activeJobIds.has(jobId)) {
      try {
        await this.workerManager.cancelDownload(jobId);
      } catch (e) {
        console.warn(`Failed to signal cancellation to worker for job ${jobId}:`, e);
      }
      this.activeJobIds.delete(jobId);
    }

    job.status = 'cancelled';
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.updatedAt = new Date().toISOString();
    this.emit('job-updated', job);
    this.processQueue();
    return true;
  }

  public async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.status = 'pending';
    job.progress = 0;
    job.downloadedBytes = 0;
    job.error = undefined;
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.updatedAt = new Date().toISOString();
    this.emit('job-updated', job);
    this.processQueue();
    return true;
  }

  public async removeJob(jobId: string, deleteFile = false): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (this.activeJobIds.has(jobId)) {
      await this.cancelJob(jobId);
    }

    if (deleteFile && job.outputPath && fs.existsSync(job.outputPath)) {
      try {
        fs.unlinkSync(job.outputPath);
      } catch (e) {
        console.error('Failed to unlink file on job removal:', e);
      }
    }

    this.jobs.delete(jobId);
    this.emit('job-removed', jobId);
    this.processQueue();
    return true;
  }

  public clearCompleted(): number {
    let count = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'cancelled') {
        this.jobs.delete(id);
        count++;
      }
    }
    return count;
  }

  public getAllJobs(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  public getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId);
  }

  public getActiveJobsCount(): number {
    return this.activeJobIds.size;
  }

  public updateSettings(maxConcurrent?: number, autoStart?: boolean, defaultDir?: string): void {
    if (typeof maxConcurrent === 'number' && maxConcurrent > 0) {
      this.maxConcurrentDownloads = maxConcurrent;
    }
    if (typeof autoStart === 'boolean') {
      this.autoStartDownloads = autoStart;
    }
    if (defaultDir) {
      this.defaultDownloadDir = defaultDir;
    }
    this.processQueue();
  }

  // --- Worker Event Handlers ---

  private handleWorkerProgress(payload: DownloadProgressEventPayload): void {
    const job = this.jobs.get(payload.jobId);
    if (!job) return;

    job.progress = payload.progress;
    job.downloadedBytes = payload.downloadedBytes;
    job.totalBytes = payload.totalBytes;
    job.speedBytesPerSec = payload.speedBytesPerSec;
    job.etaSeconds = payload.etaSeconds;
    job.updatedAt = new Date().toISOString();

    if (payload.filename && !job.outputPath) {
      job.outputPath = path.join(job.targetDirectory, payload.filename);
    }

    this.emit('job-progress', job);

    if (job.parentJobId) {
      const parent = this.jobs.get(job.parentJobId);
      if (parent) {
        parent.speedBytesPerSec = payload.speedBytesPerSec;
        parent.updatedAt = new Date().toISOString();
        this.emit('job-progress', parent);
      }
    }
  }

  private handleWorkerCompleted(payload: DownloadCompletedEventPayload): void {
    const job = this.jobs.get(payload.jobId);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.speedBytesPerSec = 0;
    job.etaSeconds = 0;
    job.outputPath = payload.outputPath;
    if (payload.totalBytes > 0) {
      job.downloadedBytes = payload.totalBytes;
      job.totalBytes = payload.totalBytes;
    }
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    this.activeJobIds.delete(job.id);
    this.emit('job-completed', job);
    this.emit('job-updated', job);

    if (job.parentJobId) {
      const parent = this.jobs.get(job.parentJobId);
      if (parent) {
        parent.completedAssetsCount = (parent.completedAssetsCount || 0) + 1;
        const total = parent.assetCount || 1;
        parent.progress = Math.min(100, Math.round((parent.completedAssetsCount / total) * 100));
        parent.downloadedBytes += (payload.totalBytes || 0);
        if (parent.completedAssetsCount >= total) {
          parent.status = 'completed';
          parent.completedAt = new Date().toISOString();
          this.emit('job-completed', parent);
        }
        parent.updatedAt = new Date().toISOString();
        this.emit('job-updated', parent);
      }
    }

    this.processQueue();
  }

  private handleWorkerFailed(payload: DownloadFailedEventPayload): void {
    const job = this.jobs.get(payload.jobId);
    if (!job) return;

    job.status = 'failed';
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.error = {
      code: payload.code,
      message: payload.message,
      details: payload.details ? JSON.stringify(payload.details) : undefined,
    };
    job.updatedAt = new Date().toISOString();

    this.activeJobIds.delete(job.id);
    this.emit('job-failed', job);
    this.emit('job-updated', job);
    this.processQueue();
  }

  private handleWorkerCancelled(payload: DownloadCancelledEventPayload): void {
    const job = this.jobs.get(payload.jobId);
    if (!job) return;

    job.status = 'cancelled';
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.updatedAt = new Date().toISOString();

    this.activeJobIds.delete(job.id);
    this.emit('job-updated', job);
    this.processQueue();
  }

  private handleWorkerPaused(payload: DownloadPausedEventPayload): void {
    const job = this.jobs.get(payload.jobId);
    if (!job) return;

    job.status = 'paused';
    job.speedBytesPerSec = 0;
    job.etaSeconds = null;
    job.updatedAt = new Date().toISOString();

    this.activeJobIds.delete(job.id);
    this.emit('job-updated', job);
    this.processQueue();
  }
}

