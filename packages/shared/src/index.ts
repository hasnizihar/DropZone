import { z } from 'zod';

export * from './protocol';
export * from './media';
export * from './utils/batchParser';

import type { MediaMetadata } from './media/metadata';
import type { MediaFormat } from './media/formats';
import type { ExtractorInfo } from './media/analysis';

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
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const JOB_STATUS_LIST: JobStatus[] = [
  'pending',
  'analyzing',
  'ready',
  'downloading',
  'processing',
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
  | 'playlist'
  | 'batch'
  | 'ffmpeg';

// ==========================================
// 3. MEDIA ANALYSIS INFO MODEL
// ==========================================
export interface PlaylistItemInfo {
  id: string;
  index: number;
  url: string;
  title: string;
  duration?: number;
  thumbnail?: string;
}

export interface PlaylistItem {
  id: string;
  index: number;
  url: string;
  title: string;
  duration?: number;
  durationFormatted?: string;
  thumbnail?: string;
  uploader?: string;
  isAvailable: boolean;
  selected?: boolean;
  formatId?: string;
}

export interface PlaylistInfo {
  id: string;
  title: string;
  url: string;
  source: string;
  extractor: string;
  totalCount: number;
  extractedCount: number;
  isTruncated: boolean;
  warnings?: string[];
  entries: PlaylistItem[];
  downloadType: 'playlist';
}

export interface BatchItemAnalysisResult {
  id: string;
  url: string;
  status: 'pending' | 'analyzing' | 'ready' | 'unsupported' | 'failed';
  downloadType?: 'media' | 'file' | 'image' | 'gallery' | 'playlist';
  title?: string;
  source?: string;
  fileSizeBytes?: number;
  duration?: number;
  thumbnail?: string;
  error?: string;
  selected: boolean;
  selectedFormatId?: string;
  customFilename?: string;
  analysisResult?: UnifiedAnalysisResult;
}

export interface MediaInfo {
  url: string;
  metadata: MediaMetadata;
  formats: MediaFormat[];
  extractor: ExtractorInfo;
  analysisDurationMs: number;
  // Convenience accessors
  title: string;
  thumbnail?: string;
  source: string;
  duration?: number;
  category: ContentCategory;
  engine: DownloadEngineType;
  isPlaylist: boolean;
  playlistItemsCount?: number;
}

export interface GalleryAsset {
  id: string;
  index: number;
  url: string;
  filename: string;
  thumbnail?: string;
  fileSizeBytes?: number;
  width?: number;
  height?: number;
  selected?: boolean;
}

export interface GalleryInfo {
  url: string;
  title: string;
  source: string;
  downloadType: 'gallery';
  isGallery: true;
  assetCount: number;
  assets: GalleryAsset[];
}

export interface DirectFileInfo {
  url: string;
  finalUrl: string;
  filename: string;
  mimeType: string;
  fileSizeBytes?: number | null;
  estimatedFileSizeBytes?: number | null;
  supportsResume: boolean;
  etag?: string | null;
  lastModified?: string | null;
  contentDisposition?: string | null;
  category: ContentCategory;
  isWebpage?: boolean;
  downloadType: 'file' | 'image';
}

export interface UnifiedAnalysisResult {
  url: string;
  title?: string;
  downloadType: 'media' | 'file' | 'image' | 'gallery' | 'playlist';
  media?: MediaInfo;
  fileInfo?: DirectFileInfo;
  gallery?: GalleryInfo;
  playlist?: PlaylistInfo;
  assets?: GalleryAsset[];
}

export interface PostProcessOptions {
  action: 'extract_audio' | 'remux' | 'merge';
  audioFormat?: 'mp3' | 'm4a' | 'wav' | 'flac' | 'opus';
  audioBitrate?: '96k' | '128k' | '160k' | '192k' | '256k' | '320k' | 'best';
  remuxContainer?: 'mp4' | 'mkv' | 'webm' | 'mov';
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
  thumbnailPath?: string;
  preserveSource?: boolean;
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
  sourcePath?: string;
  postProcess?: PostProcessOptions;
  processingProgress?: number;
  processingStage?: 'processing' | 'verifying';
  targetDirectory: string;
  customFilename?: string;
  thumbnail?: string;
  progress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  parentJobId?: string;
  childJobIds?: string[];
  assetCount?: number;
  completedAssetsCount?: number;
  failedAssetsCount?: number;
  cancelledAssetsCount?: number;
  isPartialFailure?: boolean;
  mimeType?: string;
  supportsResume?: boolean;
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
  engine?: DownloadEngineType;
  extractAudio?: boolean;
  audioFormat?: 'mp3' | 'm4a' | 'wav' | 'flac' | 'opus';
  audioBitrate?: '96k' | '128k' | '160k' | '192k' | '256k' | '320k' | 'best';
  postProcess?: PostProcessOptions;
  parentJobId?: string;
  assets?: GalleryAsset[];
  playlistItems?: PlaylistItem[];
  batchItems?: CreateDownloadOptions[];
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
  defaultAudioFormat: 'mp3' | 'm4a' | 'wav' | 'flac' | 'opus';
  defaultAudioBitrate: '128k' | '192k' | '256k' | '320k';
  defaultRemuxContainer: 'mp4' | 'mkv' | 'webm';
  preserveDownloadedSource: boolean;
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
  defaultAudioBitrate: '192k',
  defaultRemuxContainer: 'mp4',
  preserveDownloadedSource: false,
  speedLimitKbs: 0,
  networkTimeoutSeconds: 30,
  loggingLevel: 'info',
};

// ==========================================
// 7. IPC CONTRACT SPECIFICATION
// ==========================================
export interface IpcRendererToMainApi {
  // Analyzer (Milestone 3 & 5 unified media, direct file, and gallery analysis)
  inspectUrl(url: string): Promise<{
    success: boolean;
    data?: MediaInfo;
    fileInfo?: DirectFileInfo;
    gallery?: GalleryInfo;
    playlist?: PlaylistInfo;
    error?: string;
  }>;
  
  // Playlist
  inspectPlaylist(url: string, maxEntries?: number): Promise<{
    success: boolean;
    data?: PlaylistInfo;
    error?: string;
  }>;

  // Job Management
  addJob(options: CreateDownloadOptions): Promise<{ success: boolean; job?: DownloadJob; error?: string }>;
  pauseJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  resumeJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  cancelJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  retryJob(jobId: string): Promise<{ success: boolean; error?: string }>;
  removeJob(jobId: string, deleteFile?: boolean): Promise<{ success: boolean; error?: string }>;
  clearCompletedJobs(): Promise<{ success: boolean; count: number }>;
  getAllJobs(): Promise<DownloadJob[]>;
  postprocessJob(jobId: string, options: PostProcessOptions): Promise<{ success: boolean; outputPath?: string; error?: string }>;
  getFfmpegInfo(): Promise<{
    available: boolean;
    version: string | null;
    ffmpegPath: string | null;
    ffprobePath: string | null;
    probeAvailable: boolean;
    supportedAudioFormats: string[];
    supportedContainers: string[];
    error?: string;
  }>;
  
  // Batch
  inspectBatch(urls: string[]): Promise<{
    success: boolean;
    results: BatchItemAnalysisResult[];
    excessCount?: number;
    error?: string;
  }>;
  startBatch(
    items: CreateDownloadOptions[],
    options?: { title?: string; targetDirectory?: string }
  ): Promise<{
    success: boolean;
    jobIds: string[];
    parentJobId?: string;
    error?: string;
  }>;

  // System & Environment
  getSystemInfo(): Promise<{ version: string; platform: string; engines: SystemEnginesReport }>;
  selectDirectory(): Promise<{ canceled: boolean; filePaths: string[] }>;
  openPath(path: string): Promise<boolean>;
  openContainingFolder(filePath: string): Promise<boolean>;

  // Settings
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<AppSettings>;

  // Worker Subprocess (Milestone 2)
  startWorker(): Promise<{ success: boolean; error?: string }>;
  stopWorker(): Promise<{ success: boolean; error?: string }>;
  getWorkerStatus(): Promise<Record<string, any>>;
  checkWorkerHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  restartWorker(): Promise<{ success: boolean; error?: string }>;
}

// Window Bridge
declare global {
  interface Window {
    dropzone: IpcRendererToMainApi & {
      onDownloadProgress(callback: (job: DownloadJob) => void): () => void;
      onDownloadCompleted(callback: (job: DownloadJob) => void): () => void;
      onDownloadFailed(callback: (job: DownloadJob) => void): () => void;
      onEngineStatusChanged(callback: (report: SystemEnginesReport) => void): () => void;
      onWorkerStatusChanged(callback: (status: Record<string, any>) => void): () => void;
      onWorkerError(callback: (error: Record<string, any>) => void): () => void;
      onAnalysisStarted(callback: (payload: Record<string, any>) => void): () => void;
      onAnalysisCompleted(callback: (payload: Record<string, any>) => void): () => void;
      onAnalysisFailed(callback: (payload: Record<string, any>) => void): () => void;
    };
  }
}
