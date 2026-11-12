import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '../../electron/queue/QueueManager';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import type { CreateDownloadOptions } from '@dropzone/shared';

describe('QueueManager State Machine & Concurrency Scheduler', () => {
  let mockWorkerManager: WorkerManager;
  let queueManager: QueueManager;

  beforeEach(() => {
    // Create a mock worker manager
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

    queueManager = new QueueManager(mockWorkerManager, {
      maxConcurrentDownloads: 2,
      autoStartDownloads: true,
      defaultDownloadDir: 'C:/Downloads/DropZone',
    });
  });

  it('adds jobs and schedules up to maximum concurrency limit', () => {
    const job1 = queueManager.addJob({ url: 'https://example.com/video1.mp4' });
    const job2 = queueManager.addJob({ url: 'https://example.com/video2.mp4' });
    const job3 = queueManager.addJob({ url: 'https://example.com/video3.mp4' });

    // With maxConcurrent = 2:
    // job1 and job2 should be downloading
    // job3 should remain pending
    expect(job1.status).toBe('downloading');
    expect(job2.status).toBe('downloading');
    expect(job3.status).toBe('pending');
    expect(queueManager.getActiveJobsCount()).toBe(2);

    expect(mockWorkerManager.startDownload).toHaveBeenCalledTimes(2);
  });

  it('advances queue when an active job completes', () => {
    const job1 = queueManager.addJob({ url: 'https://example.com/video1.mp4' });
    const job2 = queueManager.addJob({ url: 'https://example.com/video2.mp4' });
    const job3 = queueManager.addJob({ url: 'https://example.com/video3.mp4' });

    expect(job3.status).toBe('pending');

    // Simulate worker emitting download-completed for job1
    mockWorkerManager.emit('download-completed', {
      jobId: job1.id,
      outputPath: 'C:/Downloads/DropZone/video1.mp4',
      totalBytes: 50000000,
    });

    // job1 should now be completed
    expect(job1.status).toBe('completed');
    expect(job1.progress).toBe(100);
    expect(job1.outputPath).toBe('C:/Downloads/DropZone/video1.mp4');

    // job3 should have automatically transitioned to downloading
    expect(job3.status).toBe('downloading');
    expect(mockWorkerManager.startDownload).toHaveBeenCalledTimes(3);
  });

  it('updates progress telemetry on download-progress events', () => {
    const job = queueManager.addJob({ url: 'https://example.com/test.mp4' });

    mockWorkerManager.emit('download-progress', {
      jobId: job.id,
      progress: 45.5,
      downloadedBytes: 4550000,
      totalBytes: 10000000,
      speedBytesPerSec: 1500000,
      etaSeconds: 4,
      filename: 'test.mp4',
    });

    expect(job.progress).toBe(45.5);
    expect(job.downloadedBytes).toBe(4550000);
    expect(job.totalBytes).toBe(10000000);
    expect(job.speedBytesPerSec).toBe(1500000);
    expect(job.etaSeconds).toBe(4);
  });

  it('manages pause and resume lifecycle transitions', async () => {
    const job1 = queueManager.addJob({ url: 'https://example.com/item1.mp4' });
    const job2 = queueManager.addJob({ url: 'https://example.com/item2.mp4' });
    const job3 = queueManager.addJob({ url: 'https://example.com/item3.mp4' });

    expect(job1.status).toBe('downloading');
    expect(job3.status).toBe('pending');

    // Pause job1
    await queueManager.pauseJob(job1.id);
    expect(job1.status).toBe('paused');
    expect(mockWorkerManager.pauseDownload).toHaveBeenCalledWith(job1.id);

    // job3 should now have started since a concurrency slot was freed
    expect(job3.status).toBe('downloading');

    // Resume job1 -> becomes pending, will queue until slot is available
    await queueManager.resumeJob(job1.id);
    expect(job1.status).toBe('pending');
  });

  it('handles cancellation and frees slot for next queued item', async () => {
    const job1 = queueManager.addJob({ url: 'https://example.com/clip1.mp4' });
    const job2 = queueManager.addJob({ url: 'https://example.com/clip2.mp4' });
    const job3 = queueManager.addJob({ url: 'https://example.com/clip3.mp4' });

    expect(job1.status).toBe('downloading');
    expect(job3.status).toBe('pending');

    await queueManager.cancelJob(job1.id);
    expect(job1.status).toBe('cancelled');
    expect(mockWorkerManager.cancelDownload).toHaveBeenCalledWith(job1.id);

    // job3 starts downloading
    expect(job3.status).toBe('downloading');
  });

  it('handles retry of failed downloads', async () => {
    const job = queueManager.addJob({ url: 'https://example.com/failed.mp4' });

    mockWorkerManager.emit('download-failed', {
      jobId: job.id,
      code: 'NETWORK_TIMEOUT',
      message: 'Connection timed out',
    });

    expect(job.status).toBe('failed');
    expect(job.error?.code).toBe('NETWORK_TIMEOUT');

    await queueManager.retryJob(job.id);
    expect(job.status).toBe('downloading'); // Slot was free, so retrying moves to pending -> immediately schedules to downloading
    expect(job.error).toBeUndefined();
  });

  it('clears completed and cancelled jobs from memory', async () => {
    const job1 = queueManager.addJob({ url: 'https://example.com/j1.mp4' });
    const job2 = queueManager.addJob({ url: 'https://example.com/j2.mp4' });

    mockWorkerManager.emit('download-completed', {
      jobId: job1.id,
      outputPath: 'C:/Downloads/DropZone/j1.mp4',
      totalBytes: 1000,
    });

    await queueManager.cancelJob(job2.id);

    const count = queueManager.clearCompleted();
    expect(count).toBe(2);
    expect(queueManager.getAllJobs().length).toBe(0);
  });
});
