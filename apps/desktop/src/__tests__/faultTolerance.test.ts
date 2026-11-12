import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { QueueManager } from '../../electron/queue/QueueManager';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import { DatabaseManager } from '../../electron/database/DatabaseManager';

describe('Milestone 9 QA: Fault-Tolerance & Reliability Hardening', () => {
  describe('QueueManager State Machine Guards', () => {
    let mockWorkerManager: WorkerManager;
    let queueManager: QueueManager;

    beforeEach(() => {
      mockWorkerManager = new WorkerManager();
      vi.spyOn(mockWorkerManager, 'startDownload').mockResolvedValue({
        success: true,
        jobId: 'mock_job',
      });
      vi.spyOn(mockWorkerManager, 'cancelDownload').mockResolvedValue({
        success: true,
        cancelled: true,
        jobId: 'mock_job',
      });
      vi.spyOn(mockWorkerManager, 'pauseDownload').mockResolvedValue({
        success: true,
        paused: true,
        jobId: 'mock_job',
      });
      vi.spyOn(mockWorkerManager, 'postprocessMedia').mockResolvedValue({
        success: true,
        jobId: 'mock_job',
        outputPath: 'C:/Downloads/DropZone/audio.mp3',
        totalBytes: 5000000,
        action: 'extract_audio',
      });
      vi.spyOn(mockWorkerManager, 'cancelPostprocess').mockResolvedValue({
        success: true,
        cancelled: true,
        jobId: 'mock_job',
      });

      queueManager = new QueueManager(mockWorkerManager, {
        maxConcurrentDownloads: 2,
        autoStartDownloads: true,
        defaultDownloadDir: 'C:/Downloads/DropZone',
      });
    });

    it('rejects pausing completed, failed, or cancelled jobs', async () => {
      const job1 = queueManager.addJob({ url: 'https://example.com/test1.mp4' });
      mockWorkerManager.emit('download-completed', {
        jobId: job1.id,
        outputPath: 'C:/Downloads/DropZone/test1.mp4',
        totalBytes: 1000,
      });
      expect(job1.status).toBe('completed');

      // Attempt invalid pause on completed job
      const pauseCompletedResult = await queueManager.pauseJob(job1.id);
      expect(pauseCompletedResult).toBe(false);
      expect(job1.status).toBe('completed');

      // Test failed job
      const job2 = queueManager.addJob({ url: 'https://example.com/test2.mp4' });
      mockWorkerManager.emit('download-failed', {
        jobId: job2.id,
        code: 'NETWORK_TIMEOUT',
        message: 'Timeout occurred',
      });
      expect(job2.status).toBe('failed');

      // Attempt invalid pause on failed job
      const pauseFailedResult = await queueManager.pauseJob(job2.id);
      expect(pauseFailedResult).toBe(false);
      expect(job2.status).toBe('failed');

      // Test cancelled job
      const job3 = queueManager.addJob({ url: 'https://example.com/test3.mp4' });
      await queueManager.cancelJob(job3.id);
      expect(job3.status).toBe('cancelled');

      // Attempt invalid pause on cancelled job
      const pauseCancelledResult = await queueManager.pauseJob(job3.id);
      expect(pauseCancelledResult).toBe(false);
      expect(job3.status).toBe('cancelled');
    });

    it('rejects resuming non-paused jobs (downloading, completed, failed, pending)', async () => {
      // 1. Downloading job
      const job1 = queueManager.addJob({ url: 'https://example.com/active.mp4' });
      expect(job1.status).toBe('downloading');
      const resumeDownloadingResult = await queueManager.resumeJob(job1.id);
      expect(resumeDownloadingResult).toBe(false);
      expect(job1.status).toBe('downloading');

      // 2. Pending job
      const job2 = queueManager.addJob({ url: 'https://example.com/active2.mp4' });
      const job3 = queueManager.addJob({ url: 'https://example.com/queued.mp4' });
      expect(job3.status).toBe('pending');
      const resumePendingResult = await queueManager.resumeJob(job3.id);
      expect(resumePendingResult).toBe(false);
      expect(job3.status).toBe('pending');

      // 3. Completed job
      mockWorkerManager.emit('download-completed', {
        jobId: job1.id,
        outputPath: 'C:/Downloads/DropZone/active.mp4',
        totalBytes: 500,
      });
      expect(job1.status).toBe('completed');
      const resumeCompletedResult = await queueManager.resumeJob(job1.id);
      expect(resumeCompletedResult).toBe(false);
      expect(job1.status).toBe('completed');

      // 4. Failed job
      mockWorkerManager.emit('download-failed', {
        jobId: job2.id,
        code: 'HTTP_404',
        message: 'Not Found',
      });
      expect(job2.status).toBe('failed');
      const resumeFailedResult = await queueManager.resumeJob(job2.id);
      expect(resumeFailedResult).toBe(false);
      expect(job2.status).toBe('failed');
    });

    it('rejects retrying active downloading or completed jobs', async () => {
      const job = queueManager.addJob({ url: 'https://example.com/stream.mp4' });
      expect(job.status).toBe('downloading');

      // Cannot retry an actively downloading job
      const retryDownloadingResult = await queueManager.retryJob(job.id);
      expect(retryDownloadingResult).toBe(false);
      expect(job.status).toBe('downloading');

      // Complete job
      mockWorkerManager.emit('download-completed', {
        jobId: job.id,
        outputPath: 'C:/Downloads/DropZone/stream.mp4',
        totalBytes: 2000,
      });
      expect(job.status).toBe('completed');

      // Cannot retry a completed job
      const retryCompletedResult = await queueManager.retryJob(job.id);
      expect(retryCompletedResult).toBe(false);
      expect(job.status).toBe('completed');
    });

    it('handles cancellation idempotently without re-triggering cancellations', async () => {
      const job = queueManager.addJob({ url: 'https://example.com/clip.mp4' });
      expect(job.status).toBe('downloading');

      // First cancel
      const cancelResult1 = await queueManager.cancelJob(job.id);
      expect(cancelResult1).toBe(true);
      expect(job.status).toBe('cancelled');
      expect(mockWorkerManager.cancelDownload).toHaveBeenCalledTimes(1);

      // Second cancel on already cancelled job is a safe no-op
      const cancelResult2 = await queueManager.cancelJob(job.id);
      expect(cancelResult2).toBe(true);
      expect(job.status).toBe('cancelled');
      expect(mockWorkerManager.cancelDownload).toHaveBeenCalledTimes(1); // not called again
    });

    it('enforces hard concurrency limit even under race conditions', async () => {
      // Add 2 jobs to fill concurrency limit
      const job1 = queueManager.addJob({ url: 'https://example.com/one.mp4' });
      const job2 = queueManager.addJob({ url: 'https://example.com/two.mp4' });
      const job3 = queueManager.addJob({ url: 'https://example.com/three.mp4' });

      expect(queueManager.getActiveJobsCount()).toBe(2);
      expect(job3.status).toBe('pending');

      // Attempting to manually start job3 while active concurrency is full must be prevented
      await (queueManager as any).startJob(job3);
      expect(job3.status).toBe('pending');
      expect(queueManager.getActiveJobsCount()).toBe(2);
      expect(mockWorkerManager.startDownload).toHaveBeenCalledTimes(2);
    });
  });

  describe('Late Worker Event Shields', () => {
    let mockWorkerManager: WorkerManager;
    let queueManager: QueueManager;

    beforeEach(() => {
      mockWorkerManager = new WorkerManager();
      vi.spyOn(mockWorkerManager, 'startDownload').mockResolvedValue({ success: true, jobId: 'mock_job' });
      vi.spyOn(mockWorkerManager, 'cancelDownload').mockResolvedValue({ success: true, cancelled: true, jobId: 'mock_job' });
      vi.spyOn(mockWorkerManager, 'postprocessMedia').mockResolvedValue({
        success: true,
        jobId: 'mock_job',
        outputPath: 'C:/Downloads/DropZone/audio.mp3',
        totalBytes: 5000000,
        action: 'extract_audio',
      });

      queueManager = new QueueManager(mockWorkerManager, {
        maxConcurrentDownloads: 1,
        autoStartDownloads: true,
        defaultDownloadDir: 'C:/Downloads/DropZone',
      });
    });

    it('discards late progress events after job has been cancelled', async () => {
      const job = queueManager.addJob({ url: 'https://example.com/video.mp4' });
      await queueManager.cancelJob(job.id);
      expect(job.status).toBe('cancelled');
      expect(job.speedBytesPerSec).toBe(0);

      // Late progress event arrives from stdio pipe
      mockWorkerManager.emit('download-progress', {
        jobId: job.id,
        progress: 85,
        downloadedBytes: 85000,
        totalBytes: 100000,
        speedBytesPerSec: 500000,
      });

      // Must remain cancelled, speed must remain 0
      expect(job.status).toBe('cancelled');
      expect(job.progress).toBe(0);
      expect(job.downloadedBytes).toBe(0);
      expect(job.speedBytesPerSec).toBe(0);
    });

    it('discards late progress events after job has completed', () => {
      const job = queueManager.addJob({ url: 'https://example.com/video.mp4' });
      mockWorkerManager.emit('download-completed', {
        jobId: job.id,
        outputPath: 'C:/Downloads/DropZone/video.mp4',
        totalBytes: 100000,
      });
      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.downloadedBytes).toBe(100000);

      // Late progress event with partial bytes arrives
      mockWorkerManager.emit('download-progress', {
        jobId: job.id,
        progress: 40,
        downloadedBytes: 40000,
        totalBytes: 100000,
        speedBytesPerSec: 250000,
      });

      // Must remain 100% completed
      expect(job.status).toBe('completed');
      expect(job.progress).toBe(100);
      expect(job.downloadedBytes).toBe(100000);
      expect(job.speedBytesPerSec).toBe(0);
    });

    it('discards late completion events after job has been cancelled', async () => {
      const job = queueManager.addJob({ url: 'https://example.com/video.mp4' });
      await queueManager.cancelJob(job.id);
      expect(job.status).toBe('cancelled');

      // Late completion event arrives
      mockWorkerManager.emit('download-completed', {
        jobId: job.id,
        outputPath: 'C:/Downloads/DropZone/video.mp4',
        totalBytes: 100000,
      });

      // Status must not be overwritten to completed
      expect(job.status).toBe('cancelled');
    });

    it('discards late failure events after job has completed', () => {
      const job = queueManager.addJob({ url: 'https://example.com/video.mp4' });
      mockWorkerManager.emit('download-completed', {
        jobId: job.id,
        outputPath: 'C:/Downloads/DropZone/video.mp4',
        totalBytes: 100000,
      });
      expect(job.status).toBe('completed');

      // Late failure event arrives
      mockWorkerManager.emit('download-failed', {
        jobId: job.id,
        code: 'NETWORK_TIMEOUT',
        message: 'Late timeout',
      });

      // Status must not regress to failed
      expect(job.status).toBe('completed');
      expect(job.error).toBeUndefined();
    });

    it('discards late postprocess progress and failure events on cancelled or completed jobs', () => {
      const job = queueManager.addJob({
        url: 'https://example.com/video.mp4',
        postProcess: { action: 'extract_audio', audioFormat: 'mp3' },
      });

      // Mark cancelled
      job.status = 'cancelled';

      mockWorkerManager.emit('postprocess-progress', {
        jobId: job.id,
        progress: 50,
        stage: 'transcoding',
      });
      expect(job.processingProgress).toBeUndefined();

      mockWorkerManager.emit('postprocess-failed', {
        jobId: job.id,
        code: 'FFMPEG_CRASH',
        message: 'Simulated crash',
      });
      expect(job.status).toBe('cancelled');
    });
  });

  describe('Parent-Child Hierarchical Reliability & Partial Retries', () => {
    let mockWorkerManager: WorkerManager;
    let queueManager: QueueManager;

    beforeEach(() => {
      mockWorkerManager = new WorkerManager();
      vi.spyOn(mockWorkerManager, 'startDownload').mockResolvedValue({ success: true, jobId: 'mock_job' });
      vi.spyOn(mockWorkerManager, 'cancelDownload').mockResolvedValue({ success: true, cancelled: true, jobId: 'mock_job' });

      queueManager = new QueueManager(mockWorkerManager, {
        maxConcurrentDownloads: 4,
        autoStartDownloads: true,
        defaultDownloadDir: 'C:/Downloads/DropZone',
      });
    });

    it('retrying a parent container only retries failed or cancelled children without re-downloading completed ones', async () => {
      const parent = queueManager.addJob({
        url: 'https://example.com/playlist',
        playlistItems: [
          {
            id: 'track_1',
            index: 1,
            title: 'track1.mp4',
            url: 'https://example.com/track1.mp4',
            selected: true,
            isAvailable: true,
          },
          {
            id: 'track_2',
            index: 2,
            title: 'track2.mp4',
            url: 'https://example.com/track2.mp4',
            selected: true,
            isAvailable: true,
          },
        ],
      });

      expect(parent.childJobIds).toBeDefined();
      expect(parent.childJobIds!.length).toBe(2);

      const [child1Id, child2Id] = parent.childJobIds!;
      const child1 = queueManager.getJob(child1Id)!;
      const child2 = queueManager.getJob(child2Id)!;

      // Child 1 completes
      mockWorkerManager.emit('download-completed', {
        jobId: child1.id,
        outputPath: 'C:/Downloads/DropZone/track1.mp4',
        totalBytes: 5000,
      });
      expect(child1.status).toBe('completed');

      // Child 2 fails
      mockWorkerManager.emit('download-failed', {
        jobId: child2.id,
        code: 'NETWORK_ERROR',
        message: 'Connection dropped',
      });
      expect(child2.status).toBe('failed');
      expect(parent.status).toBe('failed');

      // Call partial retry on parent
      const retryResult = await queueManager.retryJob(parent.id);
      expect(retryResult).toBe(true);

      // Child 1 must remain completed
      expect(child1.status).toBe('completed');
      // Child 2 must be retried into downloading
      expect(child2.status).toBe('downloading');
    });
  });

  describe('DatabaseManager Persistence Serialization & Staging Cleanup', () => {
    let tempDir: string;
    let dbPath: string;
    let dbManager: DatabaseManager;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropzone-qa-'));
      dbPath = path.join(tempDir, 'qa_test.db');
      dbManager = new DatabaseManager({ dbPath });
      await dbManager.initialize();
    });

    afterEach(() => {
      try {
        dbManager.close();
      } catch {
        // ignore
      }
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it('serializes rapid concurrent calls to saveImmediately without dropping writes', async () => {
      // Perform database operations via run
      dbManager.run("INSERT INTO settings (key, value, updated_at) VALUES ('qa_key_1', '\"value1\"', datetime('now'))");

      // Trigger concurrent immediate flushes
      dbManager.saveImmediately();
      dbManager.run("INSERT INTO settings (key, value, updated_at) VALUES ('qa_key_2', '\"value2\"', datetime('now'))");
      dbManager.saveImmediately();
      dbManager.run("INSERT INTO settings (key, value, updated_at) VALUES ('qa_key_3', '\"value3\"', datetime('now'))");
      dbManager.saveImmediately();

      // Ensure file exists and is valid SQLite
      expect(fs.existsSync(dbPath)).toBe(true);
      const buffer = fs.readFileSync(dbPath);
      expect(buffer.slice(0, 15).toString()).toBe('SQLite format 3');

      // Verify records are present in persisted file
      const dbManager2 = new DatabaseManager({ dbPath });
      await dbManager2.initialize();
      const results = dbManager2.query('SELECT key FROM settings WHERE key LIKE "qa_key_%"');
      expect(results.length).toBe(3);
      dbManager2.close();
    });

    it('cleans up .tmp staging file if disk write or commit fails', () => {
      const tmpPath = `${dbPath}.tmp`;

      // Mock fs.renameSync to simulate filesystem failure
      const originalRename = fs.renameSync;
      vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
        throw new Error('EPERM: operation not permitted');
      });

      // Trigger save
      dbManager.saveImmediately();

      // Temp staging file should be unlinked/cleaned up
      expect(fs.existsSync(tmpPath)).toBe(false);

      // Restore
      vi.restoreAllMocks();
    });
  });
});
