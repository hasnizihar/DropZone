export const WORKER_EVENTS = {
  READY: 'worker.ready',
  SHUTTING_DOWN: 'worker.shutting_down',
  ERROR: 'worker.error',
  STATUS: 'worker.status',
  ANALYSIS_STARTED: 'analysis.started',
  ANALYSIS_COMPLETED: 'analysis.completed',
  ANALYSIS_FAILED: 'analysis.failed',
  DOWNLOAD_STARTED: 'download.started',
  DOWNLOAD_PROGRESS: 'download.progress',
  DOWNLOAD_COMPLETED: 'download.completed',
  DOWNLOAD_FAILED: 'download.failed',
  DOWNLOAD_CANCELLED: 'download.cancelled',
  DOWNLOAD_PAUSED: 'download.paused',
} as const;

export type WorkerEventName = typeof WORKER_EVENTS[keyof typeof WORKER_EVENTS] | string;

export interface WorkerReadyEventPayload {
  workerVersion: string;
  protocolVersion: string;
  pid: number;
}

export interface WorkerShuttingDownEventPayload {
  workerVersion: string;
  clean: boolean;
}

export interface WorkerErrorEventPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface DownloadStartedEventPayload {
  jobId: string;
  url: string;
}

export interface DownloadProgressEventPayload {
  jobId: string;
  progress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  filename?: string;
}

export interface DownloadCompletedEventPayload {
  jobId: string;
  outputPath: string;
  totalBytes: number;
}

export interface DownloadFailedEventPayload {
  jobId: string;
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface DownloadCancelledEventPayload {
  jobId: string;
}

export interface DownloadPausedEventPayload {
  jobId: string;
}


