import { z } from 'zod';

// ==========================================
// 1. BRAND & THEME TOKENS
// ==========================================
export const THEME_COLORS = {
  nearBlack: '#121417',
  warmOffWhite: '#F5F3EF',
  acidLime: '#D4FF5C',
  graphiteGrey: '#858B93',
  darkSurface: '#1A1D23',
  darkBorder: '#282C35',
  errorRed: '#FF4D4D',
  warningAmber: '#FFB800',
  successGreen: '#22C55E',
} as const;

// ==========================================
// 2. ENUMS & CONSTANTS
// ==========================================
export type JobStatus =
  | 'pending'
  | 'analyzing'
  | 'ready'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const JOB_STATUS_LIST: JobStatus[] = [
  'pending',
  'analyzing',
  'ready',
  'downloading',
  'paused',
  'completed',
  'failed',
  'cancelled',
];

export type ContentCategory =
  | 'video'
  | 'audio'
  | 'image'
  | 'document'
  | 'archive'
  | 'file'
  | 'playlist'
  | 'batch';

export type DownloadEngineType =
  | 'yt-dlp'
  | 'direct-http'
  | 'image-gallery'
  | 'ffmpeg';

// ==========================================
// 3. MEDIA FORMAT & ANALYSIS MODELS
// ==========================================
export interface MediaFormat {
  formatId: string;
  extension: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  fileSize?: number;
  filesizeApprox?: number;
  tbr?: number;
  isAudioOnly?: boolean;
  isVideoOnly?: boolean;
  note?: string;
}

export interface PlaylistItemInfo {
  id: string;
  index: number;
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export interface MediaInfo {
  url: string;
  canonicalUrl?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  source: string;
  category: ContentCategory;
  uploader?: string;
  formats: MediaFormat[];
  bestVideoFormatId?: string;
  bestAudioFormatId?: string;
  isPlaylist: boolean;
  playlistItemsCount?: number;
  playlistItems?: PlaylistItemInfo[];
  engine: DownloadEngineType;
}

// ==========================================
// 4. DOWNLOAD JOB MODEL
// ==========================================
export interface DownloadJob {
  id: string;
  url: string;
  title: string;
  source: string;
  category: ContentCategory;
  engine: DownloadEngineType;
  status: JobStatus;
  selectedFormatId?: string;
  outputPath?: string;
  targetDirectory: string;
  customFilename?: string;
  thumbnail?: string;
  progress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateDownloadOptions {
  url: string;
  targetDirectory?: string;
  selectedFormatId?: string;
  customFilename?: string;
  category?: ContentCategory;
  extractAudio?: boolean;
  audioFormat?: 'mp3' | 'm4a' | 'wav' | 'flac';
}

// ==========================================
// 5. ENGINE STATUS & HEALTH
// ==========================================
export interface EngineStatus {
  name: string;
  version: string | null;
  isAvailable: boolean;
  path?: string;
  error?: string;
}

export interface SystemEnginesReport {
  ytdlp: EngineStatus;
  ffmpeg: EngineStatus;
  python: EngineStatus;
  workerRunning: boolean;
  timestamp: string;
}

// ==========================================
// 6. APPLICATION SETTINGS
// ==========================================
export interface AppSettings {
  defaultDownloadDir: string;
  maxConcurrentDownloads: number;
  autoStartDownloads: boolean;
  theme: 'dark' | 'light' | 'system';
  retryCount: number;
  defaultVideoQuality: 'best' | '1080p' | '720p' | '480p';
  defaultAudioFormat: 'mp3' | 'm4a' | 'wav' | 'flac';
  speedLimitKbs: number; // 0 = unlimited
  networkTimeoutSeconds: number;
  proxyUrl?: string;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultDownloadDir: '',
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

// ==========================================
// 7. IPC CONTRACT SPECIFICATION
// ==========================================
export interface IpcRendererToMainApi {
  // Analyzer
  inspectUrl(url: string): Promise<{ success: boolean; data?: MediaInfo; error?: string }>;
  
  // Job Management
  addJob(options: CreateDownloadOptions): Promise<{ success: boolean; job?: DownloadJob; error?: string }>;
  pauseJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  resumeJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  cancelJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  retryJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  removeJob(jobId: string, deleteFile?: boolean): Promise<{ success: boolean; error?: string }>;
  clearCompletedJobs(): Promise<{ success: boolean; count: number }>;
  getAllJobs(): Promise<DownloadJob[]>;
  
  // Batch
  inspectBatch(urls: string[]): Promise<{ success: boolean; results: MediaInfo[]; errors: { url: string; error: string }[] }>;
  startBatch(items: CreateDownloadOptions[]): Promise<{ success: boolean; jobIds: string[] }>;

  // System & Environment
  getSystemInfo(): Promise<{ version: string; platform: string; engines: SystemEnginesReport }>;
  selectDirectory(): Promise<{ canceled: boolean; filePaths: string[] }>;
  openPath(path: string): Promise<boolean>;
  openContainingFolder(filePath: string): Promise<boolean>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
}

// Window Bridge
declare global {
  interface Window {
    dropzone: IpcRendererToMainApi & {
      onDownloadProgress(callback: (job: DownloadJob) => void): () => void;
      onDownloadCompleted(callback: (job: DownloadJob) => void): () => void;
      onDownloadFailed(callback: (job: DownloadJob) => void): () => void;
      onEngineStatusChanged(callback: (report: SystemEnginesReport) => void): () => void;
    };
  }
}
