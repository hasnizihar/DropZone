import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import { DatabaseManager } from '../../electron/database/DatabaseManager';
import { JobRepository } from '../../electron/database/JobRepository';
import { QueueManager } from '../../electron/queue/QueueManager';

describe('Real Electron Application Pipeline E2E Test (Stage 3.3)', () => {
  it('executes real W3C PDF download through QueueManager, WorkerManager, and SQLite JobRepository', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropzone-pipeline-test-'));
    const dbPath = path.join(tempDir, 'test_pipeline.db');
    const downloadDir = path.join(tempDir, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });

    const workerRoot = path.resolve(__dirname, '../../../../backend/worker');

    // 1. Initialize SQLite Database & Repositories
    const dbManager = new DatabaseManager(dbPath);
    dbManager.initialize();
    const jobRepository = new JobRepository(dbManager);

    // 2. Initialize WorkerManager
    const workerManager = new WorkerManager({
      workerRoot,
      startupTimeoutMs: 15000,
      shutdownTimeoutMs: 5000,
    });
    await workerManager.start();

    // 3. Initialize QueueManager
    const queueManager = new QueueManager(workerManager, {
      jobRepository,
      maxConcurrentDownloads: 1,
      autoStartDownloads: true,
      defaultDownloadDir: downloadDir,
    });

    try {
      const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

      // 4. Add Job to QueueManager (simulating renderer addJob IPC)
      const completionPromise = new Promise<{ id: string; status: string; outputPath?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for real download to complete after 25s'));
        }, 25000);

        queueManager.on('job-completed', (completedJob) => {
          clearTimeout(timeout);
          resolve(completedJob);
        });

        queueManager.on('job-failed', (failedJob) => {
          clearTimeout(timeout);
          reject(new Error(`Download job failed: ${failedJob.error?.message || failedJob.error?.code}`));
        });
      });

      const newJob = await queueManager.addJob({
        url: testUrl,
        engine: 'direct-http',
        customFilename: 'real_pipeline_dummy.pdf',
        targetDirectory: downloadDir,
      });

      expect(newJob).toBeDefined();
      expect(newJob.id).toBeDefined();

      // 5. Wait for download completion
      const completedJob = await completionPromise;

      expect(completedJob.id).toBe(newJob.id);
      expect(completedJob.status).toBe('completed');
      expect(completedJob.outputPath).toBeDefined();

      // 6. Verify Physical Output File Integrity on Disk
      const outputPath = completedJob.outputPath!;
      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBe(13264);

      const buffer = Buffer.alloc(10);
      const fd = fs.openSync(outputPath, 'r');
      fs.readSync(fd, buffer, 0, 10, 0);
      fs.closeSync(fd);
      expect(buffer.toString('utf-8').startsWith('%PDF-1.4')).toBe(true);

      // 7. Verify SQLite Database State & History Persistence
      const persistedJob = jobRepository.getJob(newJob.id);
      expect(persistedJob).toBeDefined();
      expect(persistedJob?.status).toBe('completed');
      expect(persistedJob?.outputPath).toBe(outputPath);
      expect(persistedJob?.totalBytes).toBe(13264);

      const history = jobRepository.listHistory();
      expect(history.totalCount).toBeGreaterThanOrEqual(1);
      const historyItem = history.items.find((item) => item.id === newJob.id);
      expect(historyItem).toBeDefined();
      expect(historyItem?.status).toBe('completed');
      expect(historyItem?.title).toContain('dummy');

      // 8. Test Clean Removal with Physical File Deletion
      const removed = await queueManager.removeJob(newJob.id, true);
      expect(removed).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(false);
      expect(jobRepository.getJob(newJob.id)).toBeNull();
    } finally {
      // 9. Teardown
      await workerManager.stop();
      dbManager.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 35000);
});
