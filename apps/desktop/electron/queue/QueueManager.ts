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

export const CONTAINER_ENGINES = new Set<DownloadEngineType>(['image-gallery', 'playlist', 'batch']);

/**
 * Resolves a unique, collision-safe filename within a target directory and/or among items in a batch.
 */
export function resolveUniqueFilename(
  targetDir: string,
  desiredFilename: string,
  usedFilenames?: Set<string>
): string {
  let cleanName = desiredFilename.trim().replace(/[\\/:*?"<>|]/g, '_');
  if (!cleanName) cleanName = 'download';

  const ext = path.extname(cleanName);
  const base = path.basename(cleanName, ext);

  let candidate = cleanName;
  let counter = 1;

  const isOccupied = (name: string) => {
    if (usedFilenames && usedFilenames.has(name.toLowerCase())) {
      return true;
    }
    if (targetDir && fs.existsSync(path.join(targetDir, name))) {
      return true;
    }
    return false;
  };

  while (isOccupied(candidate)) {
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }

  if (usedFilenames) {
    usedFilenames.add(candidate.toLowerCase());
  }

  return candidate;
}

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
    // Note: Container parent jobs ('image-gallery', 'playlist', 'batch') don't consume concurrency slots; their children do
    const pendingJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending' && !CONTAINER_ENGINES.has(j.engine))
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
    // 1. Image Gallery Parent-Child Job
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
        failedAssetsCount: 0,
        cancelledAssetsCount: 0,
        childJobIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(parentId, parentJob);
      this.emit('job-added', parentJob);

      const usedNames = new Set<string>();
      for (const asset of selectedAssets) {
        const childId = `job_${parentId}_${asset.index}`;
        parentJob.childJobIds!.push(childId);
        const filename = resolveUniqueFilename(parentJob.targetDirectory, asset.filename, usedNames);
        const childJob: DownloadJob = {
          id: childId,
          parentJobId: parentId,
          url: asset.url,
          title: filename,
          source: parentJob.source,
          category: 'image',
          engine: 'direct-http',
          status: 'pending',
          targetDirectory: parentJob.targetDirectory,
          customFilename: filename,
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

    // 2. Playlist Parent-Child Job
    if (options.playlistItems && options.playlistItems.length > 0) {
      const parentId = `job_pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const selectedItems = options.playlistItems.filter((i) => i.selected !== false && i.isAvailable !== false);
      const parentJob: DownloadJob = {
        id: parentId,
        url: options.url,
        title: options.customFilename || `Playlist (${selectedItems.length} videos)`,
        source: options.url.split('/')[2] || 'playlist',
        category: 'playlist',
        engine: 'playlist',
        status: 'downloading',
        targetDirectory: options.targetDirectory || this.defaultDownloadDir,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        assetCount: selectedItems.length,
        completedAssetsCount: 0,
        failedAssetsCount: 0,
        cancelledAssetsCount: 0,
        childJobIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(parentId, parentJob);
      this.emit('job-added', parentJob);

      const usedNames = new Set<string>();
      for (const item of selectedItems) {
        const childId = `job_${parentId}_${item.index}`;
        parentJob.childJobIds!.push(childId);
        const desiredName = `${item.index.toString().padStart(2, '0')} - ${item.title}`;
        const filename = resolveUniqueFilename(parentJob.targetDirectory, desiredName, usedNames);

        const childJob: DownloadJob = {
          id: childId,
          parentJobId: parentId,
          url: item.url,
          title: item.title,
          source: parentJob.source,
          category: options.extractAudio ? 'file' : 'video',
          engine: 'yt-dlp',
          status: 'pending',
          selectedFormatId: item.formatId || options.selectedFormatId || 'best',
          targetDirectory: parentJob.targetDirectory,
          customFilename: filename,
          thumbnail: item.thumbnail,
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
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

    // 3. Batch Parent-Child Job
    if (options.batchItems && options.batchItems.length > 0) {
      const parentId = `job_batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const parentJob: DownloadJob = {
        id: parentId,
        url: options.url || 'batch://multiple-urls',
        title: options.customFilename || `Batch (${options.batchItems.length} downloads)`,
        source: 'batch',
        category: 'batch',
        engine: 'batch',
        status: 'downloading',
        targetDirectory: options.targetDirectory || this.defaultDownloadDir,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        assetCount: options.batchItems.length,
        completedAssetsCount: 0,
        failedAssetsCount: 0,
        cancelledAssetsCount: 0,
        childJobIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(parentId, parentJob);
      this.emit('job-added', parentJob);

      const usedNames = new Set<string>();
      for (let i = 0; i < options.batchItems.length; i++) {
        const item = options.batchItems[i];
        const childId = `job_${parentId}_${i + 1}`;
        parentJob.childJobIds!.push(childId);

        const targetDir = item.targetDirectory || parentJob.targetDirectory;
        const desiredName = item.customFilename || item.url.split('/').pop()?.split('?')[0] || `batch_item_${i + 1}`;
        const filename = resolveUniqueFilename(targetDir, desiredName, usedNames);

        const isImage = item.category === 'image' || /\.(jpe?g|png|gif|webp|svg|bmp|tiff|avif)($|\?)/i.test(item.url);
        const engine: DownloadEngineType = item.engine || (isImage ? 'direct-http' : (item.category === 'file' ? 'direct-http' : 'yt-dlp'));

        const childJob: DownloadJob = {
          id: childId,
          parentJobId: parentId,
          url: item.url,
          title: filename,
          source: item.url.split('/')[2] || 'web',
          category: item.category || (isImage ? 'image' : (item.extractAudio ? 'file' : 'video')),
          engine,
          status: 'pending',
          selectedFormatId: item.selectedFormatId || 'best',
          targetDirectory: targetDir,
          customFilename: filename,
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
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

    // 4. Single Download Job
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

    // Partial Retry for parent container jobs:
    // Only retry children that failed or were cancelled; do NOT re-download completed children!
    if (job.childJobIds && job.childJobIds.length > 0) {
      let retriedAny = false;
      for (const childId of job.childJobIds) {
        const child = this.jobs.get(childId);
        if (child && (child.status === 'failed' || child.status === 'cancelled')) {
          child.status = 'pending';
          child.progress = 0;
          child.downloadedBytes = 0;
          child.error = undefined;
          child.speedBytesPerSec = 0;
          child.etaSeconds = null;
          child.updatedAt = new Date().toISOString();
          this.emit('job-updated', child);
          retriedAny = true;
        }
      }

      if (retriedAny) {
        job.status = 'downloading';
        job.error = undefined;
        job.isPartialFailure = false;
        job.updatedAt = new Date().toISOString();
        this.emit('job-updated', job);
        this.processQueue();
        return true;
      }
      return false;
    }

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

    // Cascading removal: delete all child jobs first to prevent orphaned records
    if (job.childJobIds && job.childJobIds.length > 0) {
      for (const childId of job.childJobIds) {
        await this.removeJob(childId, deleteFile);
      }
    }

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

  private updateParentTerminalState(parentJobId: string): void {
    const parent = this.jobs.get(parentJobId);
    if (!parent || !parent.childJobIds || parent.childJobIds.length === 0) return;

    const children = parent.childJobIds
      .map((id) => this.jobs.get(id))
      .filter(Boolean) as DownloadJob[];
    const total = children.length;
    const completed = children.filter((c) => c.status === 'completed').length;
    const failed = children.filter((c) => c.status === 'failed').length;
    const cancelled = children.filter((c) => c.status === 'cancelled').length;

    parent.completedAssetsCount = completed;
    parent.failedAssetsCount = failed;
    parent.cancelledAssetsCount = cancelled;

    // Recalculate aggregate downloaded/total bytes
    parent.downloadedBytes = children.reduce((sum, c) => sum + (c.downloadedBytes || 0), 0);
    parent.totalBytes = children.reduce((sum, c) => sum + (c.totalBytes || 0), 0);
    parent.progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const allTerminal = children.every(
      (c) => c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled'
    );

    if (allTerminal) {
      parent.speedBytesPerSec = 0;
      parent.etaSeconds = 0;
      if (completed === total) {
        parent.status = 'completed';
        parent.progress = 100;
        parent.completedAt = new Date().toISOString();
        parent.error = undefined;
        parent.isPartialFailure = false;
        this.emit('job-completed', parent);
      } else if (completed === 0 && cancelled === total) {
        parent.status = 'cancelled';
        parent.isPartialFailure = false;
      } else {
        parent.status = 'failed';
        parent.isPartialFailure = completed > 0;
        parent.error = {
          code: failed === total ? 'ALL_CHILDREN_FAILED' : (completed > 0 ? 'PARTIAL_FAILURE' : 'DOWNLOAD_FAILED'),
          message: `${completed} of ${total} items completed (${failed} failed, ${cancelled} cancelled).`,
        };
        this.emit('job-failed', parent);
      }
    } else {
      parent.status = 'downloading';
      parent.speedBytesPerSec = children
        .filter((c) => c.status === 'downloading')
        .reduce((sum, c) => sum + (c.speedBytesPerSec || 0), 0);
    }

    parent.updatedAt = new Date().toISOString();
    this.emit('job-updated', parent);
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
      this.updateParentTerminalState(job.parentJobId);
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

    if (job.parentJobId) {
      this.updateParentTerminalState(job.parentJobId);
    }

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

    if (job.parentJobId) {
      this.updateParentTerminalState(job.parentJobId);
    }

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

