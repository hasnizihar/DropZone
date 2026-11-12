import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../ipc/channels';
import type {
  CreateDownloadOptions,
  AppSettings,
  DownloadJob,
  SystemEnginesReport,
  PostProcessOptions,
  HistoryQueryOptions,
} from '@dropzone/shared';

const dropzoneApi = {
  // Analyzer
  inspectUrl: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.ANALYZER_INSPECT, url),
  inspectPlaylist: (url: string, maxEntries?: number) => ipcRenderer.invoke(IPC_CHANNELS.PLAYLIST_INSPECT, url, maxEntries),

  // Job Management
  addJob: (options: CreateDownloadOptions) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_ADD, options),
  pauseJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_PAUSE, jobId),
  resumeJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_RESUME, jobId),
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_CANCEL, jobId),
  retryJob: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_RETRY, jobId),
  removeJob: (jobId: string, deleteFile = false) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_REMOVE, jobId, deleteFile),
  clearCompletedJobs: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_CLEAR_COMPLETED),
  getAllJobs: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_GET_ALL),
  postprocessJob: (jobId: string, options: PostProcessOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.DOWNLOADS_POSTPROCESS, jobId, options),

  // Batch
  inspectBatch: (urls: string[]) => ipcRenderer.invoke(IPC_CHANNELS.BATCH_INSPECT_MULTIPLE, urls),
  startBatch: (items: CreateDownloadOptions[], options?: { title?: string; targetDirectory?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.BATCH_START, items, options),

  // System & Environment
  getSystemInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_INFO),
  getFfmpegInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_FFMPEG_INFO),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SELECT_DIRECTORY),
  openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_PATH, path),
  openContainingFolder: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_FOLDER, filePath),
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_WINDOW_CONTROL, action),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, settings),
  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),

  // History (Milestone 8 SQLite)
  listHistory: (query?: HistoryQueryOptions) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, query),
  getHistoryItem: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET, jobId),
  removeHistoryItem: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_REMOVE, jobId),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR),
  deleteDownloadedFile: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE_FILE, jobId),

  // Worker Subprocess (Milestone 2)
  startWorker: () => ipcRenderer.invoke(IPC_CHANNELS.WORKER_START),
  stopWorker: () => ipcRenderer.invoke(IPC_CHANNELS.WORKER_STOP),
  getWorkerStatus: () => ipcRenderer.invoke(IPC_CHANNELS.WORKER_GET_STATUS),
  checkWorkerHealth: () => ipcRenderer.invoke(IPC_CHANNELS.WORKER_HEALTH_CHECK),
  restartWorker: () => ipcRenderer.invoke(IPC_CHANNELS.WORKER_RESTART),

  // Events (Main -> Renderer)
  onWorkerStatusChanged: (callback: (status: Record<string, any>) => void) => {
    const handler = (_event: any, status: Record<string, any>) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.EVENT_WORKER_STATUS_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WORKER_STATUS_CHANGED, handler);
    };
  },

  onWorkerError: (callback: (error: Record<string, any>) => void) => {
    const handler = (_event: any, error: Record<string, any>) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.EVENT_WORKER_ERROR, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WORKER_ERROR, handler);
    };
  },

  onAnalysisStarted: (callback: (payload: Record<string, any>) => void) => {
    const handler = (_event: any, payload: Record<string, any>) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_ANALYSIS_STARTED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_ANALYSIS_STARTED, handler);
    };
  },

  onAnalysisCompleted: (callback: (payload: Record<string, any>) => void) => {
    const handler = (_event: any, payload: Record<string, any>) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_ANALYSIS_COMPLETED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_ANALYSIS_COMPLETED, handler);
    };
  },

  onAnalysisFailed: (callback: (payload: Record<string, any>) => void) => {
    const handler = (_event: any, payload: Record<string, any>) => callback(payload);
    ipcRenderer.on(IPC_CHANNELS.EVENT_ANALYSIS_FAILED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_ANALYSIS_FAILED, handler);
    };
  },
  onDownloadProgress: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_DOWNLOAD_PROGRESS, handler);
    };
  },

  onDownloadCompleted: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on(IPC_CHANNELS.EVENT_DOWNLOAD_COMPLETED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_DOWNLOAD_COMPLETED, handler);
    };
  },

  onDownloadFailed: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on(IPC_CHANNELS.EVENT_DOWNLOAD_FAILED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_DOWNLOAD_FAILED, handler);
    };
  },

  onEngineStatusChanged: (callback: (report: SystemEnginesReport) => void) => {
    const handler = (_event: any, report: SystemEnginesReport) => callback(report);
    ipcRenderer.on(IPC_CHANNELS.EVENT_ENGINE_STATUS, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_ENGINE_STATUS, handler);
    };
  },
};

// Expose protected API to renderer
contextBridge.exposeInMainWorld('dropzone', dropzoneApi);

