import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { QueueManager, splitBaseAndExt, resolveUniqueFilename, WINDOWS_RESERVED_NAMES } from '../../electron/queue/QueueManager';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import { JobRepository } from '../../electron/database/JobRepository';
import { DatabaseManager } from '../../electron/database/DatabaseManager';

describe('Stage 8.2: Duplicate Download Filename Overwrite Prevention', () => {
  let tempDir: string;
  let mockWorkerManager: WorkerManager;
  let queueManager: QueueManager;
  let dbManager: DatabaseManager;
  let jobRepo: JobRepository;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropzone-collision-test-'));

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

    const dbPath = path.join(tempDir, 'test_jobs.db');
    dbManager = new DatabaseManager({ dbPath });
    await dbManager.initialize();
    jobRepo = new JobRepository(dbManager);

    queueManager = new QueueManager(mockWorkerManager, {
      maxConcurrentDownloads: 5,
      autoStartDownloads: false, // keep jobs in pending state for deterministic queue testing
      defaultDownloadDir: tempDir,
      jobRepository: jobRepo,
    });
  });

  afterEach(() => {
    try {
      dbManager.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors in tests
    }
  });

  describe('splitBaseAndExt & sanitize helpers', () => {
    it('splits standard filename with single extension', () => {
      const res = splitBaseAndExt('10Mb.dat');
      expect(res.base).toBe('10Mb');
      expect(res.ext).toBe('.dat');
    });

    it('preserves compound extensions like .tar.gz and .tar.bz2', () => {
      const res1 = splitBaseAndExt('archive.tar.gz');
      expect(res1.base).toBe('archive');
      expect(res1.ext).toBe('.tar.gz');

      const res2 = splitBaseAndExt('package.tar.bz2');
      expect(res2.base).toBe('package');
      expect(res2.ext).toBe('.tar.bz2');
    });

    it('protects Windows reserved device names (CON, NUL, PRN, COM1, LPT1)', () => {
      const resCon = splitBaseAndExt('CON.dat');
      expect(resCon.base).toBe('_CON');
      expect(resCon.ext).toBe('.dat');

      const resNul = splitBaseAndExt('nul.tar.gz');
      expect(resNul.base).toBe('_nul');
      expect(resNul.ext).toBe('.tar.gz');

      const resAux = splitBaseAndExt('AUX');
      expect(resAux.base).toBe('_AUX');
      expect(resAux.ext).toBe('');
    });

    it('strips illegal characters and trailing dots or spaces', () => {
      const res = splitBaseAndExt('bad:file/name?.dat. ');
      expect(res.base).not.toContain(':');
      expect(res.base).not.toContain('?');
      expect(res.ext).toBe('.dat');
    });
  });

  describe('resolveUniqueFilename collision avoidance', () => {
    it('returns original name when destination does not exist', () => {
      const name = resolveUniqueFilename(tempDir, '10Mb.dat');
      expect(name).toBe('10Mb.dat');
    });

    it('increments counter when file exists on disk', () => {
      fs.writeFileSync(path.join(tempDir, '10Mb.dat'), 'data');

      const name = resolveUniqueFilename(tempDir, '10Mb.dat');
      expect(name).toBe('10Mb (1).dat');
    });

    it('increments counter when .part or .part.meta.json exists on disk', () => {
      fs.writeFileSync(path.join(tempDir, '10Mb.dat.part'), 'partial data');

      const name1 = resolveUniqueFilename(tempDir, '10Mb.dat');
      expect(name1).toBe('10Mb (1).dat');

      fs.writeFileSync(path.join(tempDir, '10Mb (1).dat.part.meta.json'), '{}');
      const name2 = resolveUniqueFilename(tempDir, '10Mb.dat');
      expect(name2).toBe('10Mb (2).dat');
    });

    it('increments counter across in-memory used set', () => {
      const used = new Set<string>();
      const n1 = resolveUniqueFilename(tempDir, '10Mb.dat', used);
      const n2 = resolveUniqueFilename(tempDir, '10Mb.dat', used);
      const n3 = resolveUniqueFilename(tempDir, '10Mb.dat', used);

      expect(n1).toBe('10Mb.dat');
      expect(n2).toBe('10Mb (1).dat');
      expect(n3).toBe('10Mb (2).dat');
    });
  });

  describe('QueueManager Destination Allocation & Isolation', () => {
    it('allocates 10Mb.dat, 10Mb (1).dat, 10Mb (2).dat for consecutive submissions of the same URL', () => {
      const job1 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });
      const job2 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });
      const job3 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      expect(job1.customFilename).toBe('10Mb.dat');
      expect(job2.customFilename).toBe('10Mb (1).dat');
      expect(job3.customFilename).toBe('10Mb (2).dat');

      expect(job1.outputPath).toBe(path.join(tempDir, '10Mb.dat'));
      expect(job2.outputPath).toBe(path.join(tempDir, '10Mb (1).dat'));
      expect(job3.outputPath).toBe(path.join(tempDir, '10Mb (2).dat'));
    });

    it('allocates unique filenames when different URLs produce the same desired filename', () => {
      const jobA = queueManager.addJob({
        url: 'https://serverA.org/downloads/setup.exe',
      });
      const jobB = queueManager.addJob({
        url: 'https://serverB.org/mirrors/setup.exe',
      });

      expect(jobA.customFilename).toBe('setup.exe');
      expect(jobB.customFilename).toBe('setup (1).exe');
      expect(jobA.outputPath).not.toBe(jobB.outputPath);
    });

    it('preserves destination filename across pause and resume', async () => {
      const job1 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });
      const job2 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      expect(job2.customFilename).toBe('10Mb (1).dat');

      // Pause job2
      await queueManager.pauseJob(job2.id);
      expect(queueManager.getJob(job2.id)?.status).toBe('paused');
      expect(queueManager.getJob(job2.id)?.customFilename).toBe('10Mb (1).dat');

      // Resume job2
      await queueManager.resumeJob(job2.id);
      expect(queueManager.getJob(job2.id)?.customFilename).toBe('10Mb (1).dat');
      expect(queueManager.getJob(job2.id)?.outputPath).toBe(path.join(tempDir, '10Mb (1).dat'));
    });

    it('preserves destination filename on retry of failed job', async () => {
      const job = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      // Simulate failure from worker
      (queueManager as any).handleWorkerFailed({
        jobId: job.id,
        code: 'NETWORK_TIMEOUT',
        message: 'Timed out',
      });

      expect(queueManager.getJob(job.id)?.status).toBe('failed');
      expect(queueManager.getJob(job.id)?.customFilename).toBe('10Mb.dat');

      // Queue another job while job1 is failed
      const job2 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });
      // Should not steal 10Mb.dat from the failed job!
      expect(job2.customFilename).toBe('10Mb (1).dat');

      // Retry original failed job
      await queueManager.retryJob(job.id);
      expect(queueManager.getJob(job.id)?.customFilename).toBe('10Mb.dat');
    });

    it('rehydrates reservations from SQLite on application restart so new jobs do not overwrite existing ones', () => {
      const job1 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      // Mark job1 completed
      (queueManager as any).handleWorkerCompleted({
        jobId: job1.id,
        outputPath: path.join(tempDir, '10Mb.dat'),
        totalBytes: 10485760,
      });

      // Create a fresh QueueManager simulating app restart
      const restartedQM = new QueueManager(mockWorkerManager, {
        maxConcurrentDownloads: 5,
        autoStartDownloads: false,
        defaultDownloadDir: tempDir,
        jobRepository: jobRepo,
      });

      restartedQM.hydrateFromDatabase();

      // Submit the same URL again in the new application session
      const newJob = restartedQM.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      expect(newJob.customFilename).toBe('10Mb (1).dat');
      expect(newJob.outputPath).toBe(path.join(tempDir, '10Mb (1).dat'));
    });

    it('releases reservation on job cancellation or removal without affecting other jobs', () => {
      const job1 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });
      const job2 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      expect(job1.customFilename).toBe('10Mb.dat');
      expect(job2.customFilename).toBe('10Mb (1).dat');

      // Remove job1
      queueManager.removeJob(job1.id);
      expect(queueManager.getJob(job1.id)).toBeUndefined();

      // Now adding another job can re-use 10Mb.dat if not on disk
      const job3 = queueManager.addJob({
        url: 'https://proof.ovh.net/files/10Mb.dat',
        customFilename: '10Mb.dat',
      });

      expect(job3.customFilename).toBe('10Mb.dat');
      // job2's reservation is completely unaffected
      expect(job2.customFilename).toBe('10Mb (1).dat');
    });
  });
});
