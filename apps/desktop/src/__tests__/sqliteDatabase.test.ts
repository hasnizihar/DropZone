import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseManager } from '../../electron/database/DatabaseManager';
import { SettingsRepository } from '../../electron/database/SettingsRepository';
import { JobRepository } from '../../electron/database/JobRepository';
import { DownloadJob, DEFAULT_SETTINGS } from '@dropzone/shared';

describe('SQLite Database & Repositories (Milestone 8)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropzone-test-'));
    dbPath = path.join(tempDir, 'test_dropzone.db');
    dbManager = new DatabaseManager({ dbPath });
    await dbManager.initialize();
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

  describe('DatabaseManager & Migrations', () => {
    it('initializes schema and applies migration v1', () => {
      const migrations = dbManager.query<{ version: number; name: string }>(
        'SELECT version, name FROM schema_migrations;'
      );
      expect(migrations.length).toBe(1);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].name).toBe('001_initial_schema');

      // Verify tables exist
      const tables = dbManager.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('settings', 'download_jobs');"
      );
      expect(tables.map((t) => t.name).sort()).toEqual(['download_jobs', 'settings']);
    });

    it('enforces foreign keys', () => {
      // Trying to insert a child job with non-existent parent should fail
      expect(() => {
        dbManager.run(
          `INSERT INTO download_jobs (id, parent_job_id, engine, url, title, source, category, status, target_directory, created_at, updated_at)
           VALUES ('child_1', 'non_existent_parent', 'yt-dlp', 'https://example.com', 'title', 'web', 'video', 'pending', '/tmp', '2026-11-13', '2026-11-13');`
        );
      }).toThrow();
    });

    it('persists data to disk and reloads across simulated restart', async () => {
      dbManager.run(
        `INSERT INTO settings (key, value, updated_at) VALUES ('theme', '"system"', '2026-11-13T00:00:00Z');`
      );
      dbManager.saveImmediately();
      dbManager.close();

      expect(fs.existsSync(dbPath)).toBe(true);

      // Re-open database with new manager
      const restartManager = new DatabaseManager({ dbPath });
      await restartManager.initialize();

      const rows = restartManager.query<{ key: string; value: string }>(
        "SELECT key, value FROM settings WHERE key = 'theme';"
      );
      expect(rows.length).toBe(1);
      expect(JSON.parse(rows[0].value)).toBe('system');
      restartManager.close();
    });

    it('handles corrupted database file safely by creating backup and starting fresh', async () => {
      dbManager.close();
      // Corrupt database file with garbage
      fs.writeFileSync(dbPath, 'CORRUPTED_NON_SQLITE_DATA_GARBAGE');

      const recoveryManager = new DatabaseManager({ dbPath });
      await recoveryManager.initialize();

      // Check backup was created
      const files = fs.readdirSync(tempDir);
      const backupFile = files.find((f) => f.includes('.corrupted.'));
      expect(backupFile).toBeDefined();

      // Ensure fresh database works
      const rows = recoveryManager.query('SELECT version FROM schema_migrations;');
      expect(rows.length).toBe(1);
      recoveryManager.close();
    });
  });

  describe('SettingsRepository', () => {
    let settingsRepo: SettingsRepository;

    beforeEach(() => {
      settingsRepo = new SettingsRepository(dbManager);
    });

    it('returns default settings when database is empty', () => {
      const settings = settingsRepo.getSettings();
      expect(settings.maxConcurrentDownloads).toBe(DEFAULT_SETTINGS.maxConcurrentDownloads);
      expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(settings.defaultAudioFormat).toBe('mp3');
      expect(settings.defaultRemuxContainer).toBe('mp4');
    });

    it('updates and retrieves partial settings', () => {
      const updated = settingsRepo.updateSettings({
        maxConcurrentDownloads: 5,
        defaultAudioFormat: 'flac',
        preserveDownloadedSource: true,
      });

      expect(updated.maxConcurrentDownloads).toBe(5);
      expect(updated.defaultAudioFormat).toBe('flac');
      expect(updated.preserveDownloadedSource).toBe(true);

      const retrieved = settingsRepo.getSettings();
      expect(retrieved.maxConcurrentDownloads).toBe(5);
      expect(retrieved.defaultAudioFormat).toBe('flac');
      expect(retrieved.preserveDownloadedSource).toBe(true);
    });

    it('resets settings to defaults', () => {
      settingsRepo.updateSettings({ maxConcurrentDownloads: 8, theme: 'light' });
      const reset = settingsRepo.resetSettings();

      expect(reset.maxConcurrentDownloads).toBe(DEFAULT_SETTINGS.maxConcurrentDownloads);
      expect(reset.theme).toBe(DEFAULT_SETTINGS.theme);

      const current = settingsRepo.getSettings();
      expect(current.maxConcurrentDownloads).toBe(DEFAULT_SETTINGS.maxConcurrentDownloads);
    });
  });

  describe('JobRepository', () => {
    let jobRepo: JobRepository;

    beforeEach(() => {
      jobRepo = new JobRepository(dbManager);
    });

    const createDummyJob = (id: string, overrides: Partial<DownloadJob> = {}): DownloadJob => ({
      id,
      url: `https://example.com/video_${id}`,
      title: `Sample Video ${id}`,
      source: 'example.com',
      category: 'video',
      engine: 'yt-dlp',
      status: 'pending',
      targetDirectory: tempDir,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 50_000_000,
      speedBytesPerSec: 0,
      etaSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    it('saves and retrieves single download job with post-processing options', () => {
      const job = createDummyJob('job_1', {
        status: 'completed',
        progress: 100,
        downloadedBytes: 50_000_000,
        outputPath: path.join(tempDir, 'sample.mp3'),
        postProcess: {
          action: 'extract_audio',
          audioFormat: 'mp3',
          audioBitrate: '320k',
          embedMetadata: true,
        },
      });

      jobRepo.saveJob(job);
      const retrieved = jobRepo.getJob('job_1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('job_1');
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.postProcess?.action).toBe('extract_audio');
      expect(retrieved?.postProcess?.audioFormat).toBe('mp3');
      expect(retrieved?.postProcess?.audioBitrate).toBe('320k');
    });

    it('persists and cascades parent-child download hierarchies', () => {
      const parent = createDummyJob('parent_batch', {
        category: 'batch',
        engine: 'batch',
        childJobIds: ['child_1', 'child_2'],
      });
      const child1 = createDummyJob('child_1', { parentJobId: 'parent_batch' });
      const child2 = createDummyJob('child_2', { parentJobId: 'parent_batch' });

      jobRepo.saveJobs([parent, child1, child2]);

      expect(jobRepo.getJob('parent_batch')?.childJobIds).toEqual(['child_1', 'child_2']);
      expect(jobRepo.getJob('child_1')?.parentJobId).toBe('parent_batch');

      // Removing parent should cascade delete children
      jobRepo.removeJob('parent_batch');
      expect(jobRepo.getJob('parent_batch')).toBeNull();
      expect(jobRepo.getJob('child_1')).toBeNull();
      expect(jobRepo.getJob('child_2')).toBeNull();
    });

    it('queries history with search, category filter, status filter, and pagination', () => {
      const j1 = createDummyJob('j_vid', { title: 'Tears of Steel 4K', category: 'video', status: 'completed' });
      const j2 = createDummyJob('j_aud', { title: 'Classical Symphony MP3', category: 'audio', status: 'completed' });
      const j3 = createDummyJob('j_fail', { title: 'Failed Download Stream', category: 'video', status: 'failed' });

      jobRepo.saveJobs([j1, j2, j3]);

      // Search
      const searchRes = jobRepo.listHistory({ searchTerm: 'Steel' });
      expect(searchRes.items.length).toBe(1);
      expect(searchRes.items[0].id).toBe('j_vid');

      // Category filter
      const catRes = jobRepo.listHistory({ category: 'audio' });
      expect(catRes.items.length).toBe(1);
      expect(catRes.items[0].id).toBe('j_aud');

      // Status filter
      const statusRes = jobRepo.listHistory({ status: 'failed' });
      expect(statusRes.items.length).toBe(1);
      expect(statusRes.items[0].id).toBe('j_fail');

      // Pagination
      const pageRes = jobRepo.listHistory({ limit: 2, offset: 0 });
      expect(pageRes.items.length).toBe(2);
      expect(pageRes.totalCount).toBe(3);
      expect(pageRes.totalPages).toBe(2);
    });

    it('clears completed, failed, and cancelled records from history', () => {
      const j1 = createDummyJob('j_comp', { status: 'completed' });
      const j2 = createDummyJob('j_canc', { status: 'cancelled' });
      const j3 = createDummyJob('j_fail', { status: 'failed' });
      const j4 = createDummyJob('j_pend', { status: 'pending' });

      jobRepo.saveJobs([j1, j2, j3, j4]);

      const cleared = jobRepo.clearHistory();
      expect(cleared).toBe(3);

      const remaining = jobRepo.getAllJobs();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('j_pend');
    });
  });
});
