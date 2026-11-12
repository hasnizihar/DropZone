import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '../ipc/channels';
import { getSystemEnginesReport } from './engines';
import { WorkerManager } from '../worker/WorkerManager';
import type {
  AppSettings,
  DownloadJob,
  CreateDownloadOptions,
  MediaInfo,
} from '@dropzone/shared';

let mainWindow: BrowserWindow | null = null;
const workerManager = new WorkerManager();

// Initial application settings
const defaultDownloadDir = path.join(app.getPath('downloads'), 'DropZone');
if (!fs.existsSync(defaultDownloadDir)) {
  try {
    fs.mkdirSync(defaultDownloadDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create default download directory:', err);
  }
}

let appSettings: AppSettings = {
  defaultDownloadDir,
  maxConcurrentDownloads: 3,
  autoStartDownloads: true,
  theme: 'dark',
  retryCount: 3,
  defaultVideoQuality: 'best',
  defaultAudioFormat: 'mp3',
  speedLimitKbs: 0,
  networkTimeoutSeconds: 30,
  loggingLevel: 'info',
};

// In-memory job repository for foundation (SQLite layer in Milestone 4)
const jobsMap = new Map<string, DownloadJob>();

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#121417',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Handle external link clicks securely
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// Register IPC Handlers
function setupIpcHandlers() {
  // Window controls
  ipcMain.handle(IPC_CHANNELS.SYSTEM_WINDOW_CONTROL, (_event, action: 'minimize' | 'maximize' | 'close') => {
    if (!mainWindow) return;
    if (action === 'minimize') {
      mainWindow.minimize();
    } else if (action === 'maximize') {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    } else if (action === 'close') {
      mainWindow.close();
    }
  });

  // System & Environment
  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_INFO, async () => {
    const engines = await getSystemEnginesReport();
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      engines,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_ENGINES, async () => {
    return await getSystemEnginesReport();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SELECT_DIRECTORY, async () => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: appSettings.defaultDownloadDir,
    });
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_PATH, async (_event, targetPath: string) => {
    try {
      if (fs.existsSync(targetPath)) {
        await shell.openPath(targetPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_FOLDER, async (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return appSettings;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, partialSettings: Partial<AppSettings>) => {
    appSettings = { ...appSettings, ...partialSettings };
    return appSettings;
  });

  // Analyzer stub (wired to Python worker in Milestone 3)
  ipcMain.handle(IPC_CHANNELS.ANALYZER_INSPECT, async (_event, url: string) => {
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return { success: false, error: 'Please enter a valid HTTP or HTTPS URL.' };
    }

    // Identify source engine type
    let engine: 'yt-dlp' | 'direct-http' = 'yt-dlp';
    let category: 'video' | 'file' = 'video';
    const lower = url.toLowerCase();

    if (lower.match(/\.(mp4|mkv|webm|avi|mov)$/i)) {
      category = 'video';
      engine = 'direct-http';
    } else if (lower.match(/\.(mp3|m4a|flac|wav|ogg)$/i)) {
      category = 'file';
      engine = 'direct-http';
    } else if (lower.match(/\.(zip|tar|gz|7z|rar|iso|exe|msi|pdf|docx|xlsx)$/i)) {
      category = 'file';
      engine = 'direct-http';
    }

    // Extract provider name
    let source = 'Direct Download';
    try {
      const parsed = new URL(url);
      source = parsed.hostname.replace('www.', '');
    } catch {
      // ignore
    }

    // Return preliminary inspection metadata
    const info: MediaInfo = {
      url,
      canonicalUrl: url,
      title: url.split('/').pop()?.split('?')[0] || 'Media Item',
      source,
      category,
      engine,
      isPlaylist: false,
      formats: [
        {
          formatId: 'best',
          extension: category === 'video' ? 'mp4' : 'bin',
          resolution: 'Optimal',
          note: 'Best available quality',
        },
      ],
    };

    return { success: true, data: info };
  });

  // Job Management
  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_ADD, (_event, options: CreateDownloadOptions) => {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newJob: DownloadJob = {
      id,
      url: options.url,
      title: options.customFilename || options.url.split('/').pop()?.split('?')[0] || 'Download Job',
      source: 'web',
      category: options.category || 'video',
      engine: 'yt-dlp',
      status: 'pending',
      selectedFormatId: options.selectedFormatId || 'best',
      targetDirectory: options.targetDirectory || appSettings.defaultDownloadDir,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      etaSeconds: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobsMap.set(id, newJob);
    return { success: true, job: newJob };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET_ALL, () => {
    return Array.from(jobsMap.values());
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_PAUSE, (_event, jobId: string) => {
    const job = jobsMap.get(jobId);
    if (job) {
      job.status = 'paused';
      job.updatedAt = new Date().toISOString();
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RESUME, (_event, jobId: string) => {
    const job = jobsMap.get(jobId);
    if (job) {
      job.status = 'downloading';
      job.updatedAt = new Date().toISOString();
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CANCEL, (_event, jobId: string) => {
    const job = jobsMap.get(jobId);
    if (job) {
      job.status = 'cancelled';
      job.updatedAt = new Date().toISOString();
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RETRY, (_event, jobId: string) => {
    const job = jobsMap.get(jobId);
    if (job) {
      job.status = 'pending';
      job.progress = 0;
      job.updatedAt = new Date().toISOString();
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_REMOVE, (_event, jobId: string, deleteFile = false) => {
    const job = jobsMap.get(jobId);
    if (job) {
      if (deleteFile && job.outputPath && fs.existsSync(job.outputPath)) {
        try {
          fs.unlinkSync(job.outputPath);
        } catch (e) {
          console.error('Failed to delete file:', e);
        }
      }
      jobsMap.delete(jobId);
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CLEAR_COMPLETED, () => {
    let count = 0;
    for (const [id, job] of jobsMap.entries()) {
      if (job.status === 'completed' || job.status === 'cancelled') {
        jobsMap.delete(id);
        count++;
      }
    }
    return { success: true, count };
  });

  // Batch
  ipcMain.handle(IPC_CHANNELS.BATCH_INSPECT_MULTIPLE, async (_event, urls: string[]) => {
    const results: MediaInfo[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const rawUrl of urls) {
      const url = rawUrl.trim();
      if (!url) continue;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        errors.push({ url, error: 'Invalid URL scheme' });
        continue;
      }

      let source = 'Direct Download';
      try {
        source = new URL(url).hostname.replace('www.', '');
      } catch {
        // ignore
      }

      results.push({
        url,
        canonicalUrl: url,
        title: url.split('/').pop()?.split('?')[0] || 'Media Item',
        source,
        category: 'video',
        engine: 'yt-dlp',
        isPlaylist: false,
        formats: [{ formatId: 'best', extension: 'mp4', resolution: 'Optimal' }],
      });
    }

    return { success: true, results, errors };
  });

  ipcMain.handle(IPC_CHANNELS.BATCH_START, (_event, items: CreateDownloadOptions[]) => {
    const jobIds: string[] = [];
    for (const item of items) {
      const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newJob: DownloadJob = {
        id,
        url: item.url,
        title: item.customFilename || item.url.split('/').pop()?.split('?')[0] || 'Download Job',
        source: 'web',
        category: item.category || 'video',
        engine: 'yt-dlp',
        status: 'pending',
        selectedFormatId: item.selectedFormatId || 'best',
        targetDirectory: item.targetDirectory || appSettings.defaultDownloadDir,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobsMap.set(id, newJob);
      jobIds.push(id);
    }
    return { success: true, jobIds };
  });

  // Worker Subprocess (Milestone 2)
  ipcMain.handle(IPC_CHANNELS.WORKER_START, async () => {
    try {
      await workerManager.start();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKER_STOP, async () => {
    try {
      await workerManager.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKER_GET_STATUS, async () => {
    return await workerManager.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.WORKER_HEALTH_CHECK, async () => {
    try {
      const t0 = Date.now();
      await workerManager.sendPing();
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.WORKER_RESTART, async () => {
    try {
      await workerManager.restart();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  setupIpcHandlers();
  mainWindow = createWindow();

  // Forward worker events to renderer
  workerManager.on('status-changed', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_WORKER_STATUS_CHANGED, status);
    }
  });

  workerManager.on('worker-error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_WORKER_ERROR, err);
    }
  });

  // Start background worker
  workerManager.start().catch((err) => {
    console.error('[Worker Boot Error]', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('before-quit', async () => {
  try {
    await workerManager.stop();
  } catch (err) {
    console.error('Error stopping worker during quit:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

