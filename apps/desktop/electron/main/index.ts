import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '../ipc/channels';
import { getSystemEnginesReport } from './engines';
import { WorkerManager } from '../worker/WorkerManager';
import { QueueManager } from '../queue/QueueManager';
import {
  AppSettings,
  DownloadJob,
  CreateDownloadOptions,
  MediaInfo,
  parseBatchUrls,
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

// Queue Manager (Milestone 4 - Authoritative scheduler & in-memory queue state)
const queueManager = new QueueManager(workerManager, {
  maxConcurrentDownloads: appSettings.maxConcurrentDownloads,
  autoStartDownloads: appSettings.autoStartDownloads,
  defaultDownloadDir: appSettings.defaultDownloadDir,
});

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
    engines.workerRunning = workerManager.getStatusInfo().isAlive;
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      engines,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_ENGINES, async () => {
    const engines = await getSystemEnginesReport();
    engines.workerRunning = workerManager.getStatusInfo().isAlive;
    return engines;
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
    queueManager.updateSettings(
      appSettings.maxConcurrentDownloads,
      appSettings.autoStartDownloads,
      appSettings.defaultDownloadDir
    );
    return appSettings;
  });

  // Media Analyzer (Milestone 3 with real Python yt-dlp worker backend)
  ipcMain.handle(IPC_CHANNELS.ANALYZER_INSPECT, async (_event, url: string) => {
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return { success: false, error: 'Please enter a valid HTTP or HTTPS URL.' };
    }

    try {
      if (!workerManager.getStatusInfo().isAlive) {
        try {
          await workerManager.start();
        } catch (startErr: any) {
          return {
            success: false,
            error: `Background worker engine is not running: ${startErr.message}`,
          };
        }
      }

      const response = await workerManager.analyzeUrl(url.trim(), 35000);
      if (!response) {
        return { success: false, error: 'Analyzer returned empty or invalid response.' };
      }

      // Handle Playlist Result
      if (response.downloadType === 'playlist' || response.isPlaylist || response.playlist) {
        const playlistData = response.playlist || response;
        const info: MediaInfo = {
          url: playlistData.url || url.trim(),
          metadata: {
            id: playlistData.id || 'playlist',
            title: playlistData.title || 'Media Playlist',
            extractor: playlistData.extractor || 'Playlist',
            platform: playlistData.source || 'Playlist',
            originalUrl: url.trim(),
            webpageUrl: url.trim(),
            mediaType: 'video',
            isPlaylist: true,
            playlistCount: playlistData.totalCount || playlistData.extractedCount,
          },
          formats: [],
          extractor: {
            name: playlistData.source || 'Playlist',
            key: playlistData.extractor || 'playlist',
          },
          analysisDurationMs: 0,
          title: playlistData.title || 'Media Playlist',
          thumbnail: playlistData.entries?.[0]?.thumbnail,
          source: playlistData.source || 'Playlist',
          category: 'playlist',
          engine: 'playlist',
          isPlaylist: true,
          playlistItemsCount: playlistData.totalCount || playlistData.extractedCount,
        };
        return { success: true, data: info, playlist: playlistData };
      }

      // Handle Gallery Result
      if (response.downloadType === 'gallery' || response.isGallery) {
        const info: MediaInfo = {
          url: response.url || url.trim(),
          metadata: {
            id: 'gallery',
            title: response.title || 'Image Gallery',
            extractor: response.source || 'gallery-dl',
            platform: response.source || 'Gallery',
            originalUrl: url.trim(),
            webpageUrl: url.trim(),
            mediaType: 'image',
            isPlaylist: false,
          },
          formats: [],
          extractor: {
            name: response.source || 'Gallery',
            key: 'gallery-dl',
          },
          analysisDurationMs: 0,
          title: response.title || 'Image Gallery',
          thumbnail: response.assets?.[0]?.thumbnail,
          source: response.source || 'Gallery',
          category: 'image',
          engine: 'image-gallery',
          isPlaylist: false,
          playlistItemsCount: response.assetCount || response.assets?.length,
        };
        return { success: true, data: info, gallery: response };
      }

      // Handle Direct File Result
      if (response.downloadType === 'file' || response.fileInfo) {
        const fileInfo = response.fileInfo || response;
        const info: MediaInfo = {
          url: fileInfo.url || url.trim(),
          metadata: {
            id: 'direct_file',
            title: fileInfo.filename || 'Direct Download',
            extractor: 'direct-http',
            platform: 'Direct HTTP',
            originalUrl: url.trim(),
            webpageUrl: url.trim(),
            mediaType: 'unknown',
            isPlaylist: false,
          },
          formats: [],
          extractor: {
            name: 'Direct HTTP',
            key: 'direct-http',
          },
          analysisDurationMs: 0,
          title: fileInfo.filename || 'Direct Download',
          source: fileInfo.source || 'Direct HTTP',
          category: fileInfo.category || 'file',
          engine: 'direct-http',
          isPlaylist: false,
        };
        return { success: true, data: info, fileInfo };
      }

      // Handle Direct Image Result
      if (response.downloadType === 'image') {
        const firstAsset = response.assets?.[0];
        const info: MediaInfo = {
          url: response.url || url.trim(),
          metadata: {
            id: 'image',
            title: response.title || 'Direct Image',
            extractor: 'direct-http',
            platform: response.source || 'Direct Image',
            originalUrl: url.trim(),
            webpageUrl: url.trim(),
            thumbnailUrl: firstAsset?.thumbnail || response.url,
            mediaType: 'image',
            isPlaylist: false,
          },
          formats: [],
          extractor: {
            name: 'Direct Image',
            key: 'direct-http',
          },
          analysisDurationMs: 0,
          title: response.title || 'Direct Image',
          thumbnail: firstAsset?.thumbnail || response.url,
          source: response.source || 'Direct Image',
          category: 'image',
          engine: 'direct-http',
          isPlaylist: false,
        };
        return { success: true, data: info, gallery: response };
      }

      if (!response.metadata) {
        return { success: false, error: 'Media analyzer returned empty metadata.' };
      }

      // Convert to MediaInfo format for renderer
      const info: MediaInfo = {
        url: response.metadata.originalUrl || url.trim(),
        metadata: response.metadata,
        formats: response.formats || [],
        extractor: response.extractor || {
          name: response.metadata.platform,
          key: response.metadata.extractor,
        },
        analysisDurationMs: response.analysisDurationMs || 0,
        title: response.metadata.title,
        thumbnail: response.metadata.thumbnailUrl || undefined,
        source: response.metadata.platform,
        duration: response.metadata.durationSeconds || undefined,
        category: response.metadata.mediaType === 'audio' ? 'file' : 'video',
        engine: 'yt-dlp',
        isPlaylist: response.metadata.isPlaylist || false,
        playlistItemsCount: response.metadata.playlistCount || undefined,
      };

      return { success: true, data: info };
    } catch (err: any) {
      console.error('[Analyzer Error]', err);
      return {
        success: false,
        error: err?.message || 'Failed to extract media information.',
      };
    }
  });

  // Job Management (Milestone 4 - Powered by authoritative QueueManager)
  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_ADD, (_event, options: CreateDownloadOptions) => {
    try {
      const job = queueManager.addJob(options);
      return { success: true, job };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET_ALL, () => {
    return queueManager.getAllJobs();
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_PAUSE, async (_event, jobId: string) => {
    const success = await queueManager.pauseJob(jobId);
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RESUME, async (_event, jobId: string) => {
    const success = await queueManager.resumeJob(jobId);
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CANCEL, async (_event, jobId: string) => {
    const success = await queueManager.cancelJob(jobId);
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RETRY, async (_event, jobId: string) => {
    const success = await queueManager.retryJob(jobId);
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_REMOVE, async (_event, jobId: string, deleteFile = false) => {
    const success = await queueManager.removeJob(jobId, deleteFile);
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CLEAR_COMPLETED, () => {
    const count = queueManager.clearCompleted();
    return { success: true, count };
  });

  // Playlist Inspector
  ipcMain.handle(IPC_CHANNELS.PLAYLIST_INSPECT, async (_event, url: string, maxEntries?: number) => {
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return { success: false, error: 'Please enter a valid HTTP or HTTPS playlist URL.' };
    }
    try {
      if (!workerManager.getStatusInfo().isAlive) {
        await workerManager.start();
      }
      const playlist = await workerManager.inspectPlaylist(url.trim(), maxEntries);
      return { success: true, data: playlist };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to inspect playlist.' };
    }
  });

  // Batch
  ipcMain.handle(IPC_CHANNELS.BATCH_INSPECT_MULTIPLE, async (_event, rawUrls: string[]) => {
    const { urls, excessCount } = parseBatchUrls(rawUrls.join('\n'), 50);
    if (urls.length === 0) {
      return { success: false, results: [], excessCount: 0, error: 'No valid HTTP/HTTPS URLs provided.' };
    }

    try {
      if (!workerManager.getStatusInfo().isAlive) {
        await workerManager.start();
      }
      const batchRes = await workerManager.inspectBatch(urls);
      return {
        success: true,
        results: batchRes.results,
        excessCount,
        errorsCount: batchRes.errorsCount,
      };
    } catch (err: any) {
      return { success: false, results: [], excessCount, error: err.message || 'Batch inspection failed.' };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.BATCH_START,
    (_event, items: CreateDownloadOptions[], options?: { title?: string; targetDirectory?: string }) => {
      try {
        if (!items || items.length === 0) {
          return { success: false, jobIds: [], error: 'No items provided to enqueue.' };
        }
        const parentJob = queueManager.addJob({
          url: 'batch://queue',
          customFilename: options?.title || `Batch (${items.length} items)`,
          targetDirectory: options?.targetDirectory,
          batchItems: items,
        });
        return {
          success: true,
          parentJobId: parentJob.id,
          jobIds: parentJob.childJobIds || [],
        };
      } catch (err: any) {
        return { success: false, jobIds: [], error: err.message };
      }
    }
  );

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

  workerManager.on('worker-event', (event: any) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (event.command === 'analysis.started') {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_ANALYSIS_STARTED, event.payload);
    } else if (event.command === 'analysis.completed') {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_ANALYSIS_COMPLETED, event.payload);
    } else if (event.command === 'analysis.failed') {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_ANALYSIS_FAILED, event.payload);
    }
  });

  // Forward QueueManager lifecycle and progress events to renderer
  queueManager.on('job-progress', (job) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, job);
    }
  });

  queueManager.on('job-completed', (job) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_DOWNLOAD_COMPLETED, job);
    }
  });

  queueManager.on('job-failed', (job) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_DOWNLOAD_FAILED, job);
    }
  });

  queueManager.on('job-updated', (job) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, job);
    }
  });

  queueManager.on('job-added', (job) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, job);
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

