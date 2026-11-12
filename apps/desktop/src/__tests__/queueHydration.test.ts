import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseManager } from '../../electron/database/DatabaseManager';
import { JobRepository } from '../../electron/database/JobRepository';
import { QueueManager } from '../../electron/queue/QueueManager';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import { DownloadJob } from '@dropzone/shared';

describe('QueueManager Startup Hydration & Recovery Policy (Milestone 8)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbManager: DatabaseManager;
  let jobRepo: JobRepository;
  let mockWorker: WorkerManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropzone-queue-test-'));
    dbPath = path.join(tempDir, 'test_queue.db');
    dbManager = new DatabaseManager({ dbPath });
    await dbManager.initialize();
    jobRepo = new JobRepository(dbManager);

    mockWorker = new WorkerManager();
    vi.spyOn(mockWorker, 'startDownload').mockResolvedValue({ success: true, jobId: 'mock' });
    vi.spyOn(mockWorker, 'postprocessMedia').mockResolvedValue({
      success: true,
      jobId: 'mock',
      outputPath: path.join(tempDir, 'out.mp3'),
      totalBytes: 1000,
      action: 'extract_audio',
    });
  });

  afterEach(() => {
    if (dbManager && !dbManager.isClosed()) {
      dbManager.close();
    }
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  const createJob = (id: string, status: any, overrides: Partial<DownloadJob> = {}): DownloadJob => ({
    id,
    url: `https://example.com/item_${id}`,
    title: `Item ${id}`,
    source: 'web',
    category: 'video',
    engine: 'yt-dlp',
    status,
    targetDirectory: tempDir,
    progress: status === 'completed' ? 100 : 45,
    downloadedBytes: status === 'completed' ? 1000 : 450,
    totalBytes: 1000,
    speedBytesPerSec: 100,
    etaSeconds: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  it('restores completed, failed, and cancelled jobs in their terminal states', () => {
    const j1 = createJob('job_done', 'completed');
    const j2 = createJob('job_fail', 'failed', { error: { code: 'NETWORK_ERR', message: 'Timeout' } });
    const j3 = createJob('job_canc', 'cancelled');

    jobRepo.saveJobs([j1, j2, j3]);

    const queue = new QueueManager(mockWorker, {
      maxConcurrentDownloads: 3,
      autoStartDownloads: false,
      defaultDownloadDir: tempDir,
      jobRepository: jobRepo,
    });

    queue.hydrateFromDatabase();

    expect(queue.getJob('job_done')?.status).toBe('completed');
    expect(queue.getJob('job_fail')?.status).toBe('failed');
    expect(queue.getJob('job_canc')?.status).toBe('cancelled');
  });

  it('reconciles interrupted active downloads as failed on startup', () => {
    const inFlightJob = createJob('job_inflight', 'downloading');
    jobRepo.saveJob(inFlightJob);

    const queue = new QueueManager(mockWorker, {
      maxConcurrentDownloads: 3,
      autoStartDownloads: false,
      defaultDownloadDir: tempDir,
      jobRepository: jobRepo,
    });

    queue.hydrateFromDatabase();

    const reconciled = queue.getJob('job_inflight');
    expect(reconciled?.status).toBe('failed');
    expect(reconciled?.error?.code).toBe('DOWNLOAD_INTERRUPTED');
    expect(reconciled?.speedBytesPerSec).toBe(0);

    // Verify it was updated in the database
    const inDb = jobRepo.getJob('job_inflight');
    expect(inDb?.status).toBe('failed');
    expect(inDb?.error?.code).toBe('DOWNLOAD_INTERRUPTED');
  });

  it('reconciles interrupted post-processing as failed with POSTPROCESS_INTERRUPTED and enables direct retry', async () => {
    const dummySource = path.join(tempDir, 'source.mp4');
    fs.writeFileSync(dummySource, 'dummy media content');

    const inFlightFx = createJob('job_infx', 'processing', {
      sourcePath: dummySource,
      postProcess: {
        action: 'extract_audio',
        audioFormat: 'mp3',
        audioBitrate: '192k',
      },
    });
    jobRepo.saveJob(inFlightFx);

    const queue = new QueueManager(mockWorker, {
      maxConcurrentDownloads: 3,
      autoStartDownloads: false,
      defaultDownloadDir: tempDir,
      jobRepository: jobRepo,
    });

    queue.hydrateFromDatabase();

    const reconciled = queue.getJob('job_infx');
    expect(reconciled?.status).toBe('failed');
    expect(reconciled?.error?.code).toBe('POSTPROCESS_INTERRUPTED');

    // Direct retry should succeed using local source without re-downloading
    const retrySuccess = await queue.retryJob('job_infx');
    expect(retrySuccess).toBe(true);
    expect(mockWorker.postprocessMedia).toHaveBeenCalled();
    expect(queue.getJob('job_infx')?.status).toBe('processing');
  });

  it('recalculates parent aggregate status from restored child jobs on startup', () => {
    const parent = createJob('parent_p1', 'downloading', {
      category: 'batch',
      engine: 'batch',
      childJobIds: ['child_c1', 'child_c2'],
      assetCount: 2,
    });
    const c1 = createJob('child_c1', 'completed', { parentJobId: 'parent_p1' });
    const c2 = createJob('child_c2', 'completed', { parentJobId: 'parent_p1' });

    jobRepo.saveJobs([parent, c1, c2]);

    const queue = new QueueManager(mockWorker, {
      maxConcurrentDownloads: 3,
      autoStartDownloads: false,
      defaultDownloadDir: tempDir,
      jobRepository: jobRepo,
    });

    queue.hydrateFromDatabase();

    const hydratedParent = queue.getJob('parent_p1');
    expect(hydratedParent?.status).toBe('completed');
    expect(hydratedParent?.progress).toBe(100);
    expect(hydratedParent?.completedAssetsCount).toBe(2);
  });
});
