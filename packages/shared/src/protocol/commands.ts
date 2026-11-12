export const WORKER_COMMANDS = {
  HELLO: 'hello',
  PING: 'ping',
  GET_STATUS: 'get_status',
  SHUTDOWN: 'shutdown',
  ANALYZE_URL: 'analyze_url',
  INSPECT_DIRECT_URL: 'inspect_direct_url',
  INSPECT_GALLERY: 'inspect_gallery',
  INSPECT_PLAYLIST: 'inspect_playlist',
  INSPECT_BATCH: 'inspect_batch',
  START_DOWNLOAD: 'start_download',
  CANCEL_DOWNLOAD: 'cancel_download',
  PAUSE_DOWNLOAD: 'pause_download',
} as const;

export type WorkerCommandName = typeof WORKER_COMMANDS[keyof typeof WORKER_COMMANDS] | string;

export interface HelloRequestPayload {
  client: string;
  version: string;
}

export interface HelloResponsePayload {
  workerVersion: string;
  protocolVersion: string;
  capabilities: string[];
  pid: number;
}

export interface PingRequestPayload {
  timestamp?: string;
}

export interface PingResponsePayload {
  pong: boolean;
  uptimeSeconds: number;
}

export interface WorkerStatusPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pid: number;
  workerVersion: string;
  protocolVersion: string;
  pythonVersion: string;
  uptimeSeconds: number;
  memoryBytes: number;
  requestsProcessed: number;
  errorsCount: number;
  capabilities: string[];
}

export interface ShutdownRequestPayload {
  reason?: string;
}

export interface ShutdownResponsePayload {
  shuttingDown: boolean;
  reason?: string;
}

export interface StartDownloadRequestPayload {
  jobId: string;
  url: string;
  engine?: 'yt-dlp' | 'direct-http' | 'image-gallery' | 'playlist' | 'batch' | 'image' | 'ffmpeg';
  formatId?: string;
  targetDirectory: string;
  customFilename?: string;
  extractAudio?: boolean;
  audioFormat?: 'mp3' | 'm4a' | 'wav' | 'flac';
}

export interface StartDownloadResponsePayload {
  success: boolean;
  jobId: string;
  outputPath?: string;
}

export interface CancelDownloadRequestPayload {
  jobId: string;
}

export interface CancelDownloadResponsePayload {
  jobId: string;
  cancelled: boolean;
  success: boolean;
}

export interface PauseDownloadRequestPayload {
  jobId: string;
}

export interface PauseDownloadResponsePayload {
  jobId: string;
  paused: boolean;
  success: boolean;
}


