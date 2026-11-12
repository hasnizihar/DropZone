import { z } from 'zod';

export const ProtocolMessageSchema = z.object({
  protocolVersion: z.string().default('1.0'),
  id: z.string().min(1, 'Message id is required'),
  type: z.enum(['request', 'response', 'event', 'error']),
  command: z.string().min(1, 'Message command is required'),
  payload: z.record(z.any()).default({}),
  timestamp: z.string(),
});

export const WorkerRequestSchema = ProtocolMessageSchema.extend({
  type: z.literal('request'),
});

export const WorkerResponseSchema = ProtocolMessageSchema.extend({
  type: z.literal('response'),
});

export const WorkerErrorSchema = ProtocolMessageSchema.extend({
  type: z.literal('error'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
});

export const WorkerEventSchema = ProtocolMessageSchema.extend({
  type: z.literal('event'),
});

export const WorkerStatusPayloadSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  pid: z.number(),
  workerVersion: z.string(),
  protocolVersion: z.string(),
  pythonVersion: z.string(),
  uptimeSeconds: z.number(),
  memoryBytes: z.number(),
  requestsProcessed: z.number(),
  errorsCount: z.number(),
  capabilities: z.array(z.string()),
});

export const StartDownloadRequestPayloadSchema = z.object({
  jobId: z.string().min(1),
  url: z.string().url(),
  engine: z.enum(['yt-dlp', 'direct-http', 'image-gallery', 'image', 'ffmpeg']).optional(),
  formatId: z.string().optional(),
  targetDirectory: z.string().min(1),
  customFilename: z.string().optional(),
  extractAudio: z.boolean().optional(),
  audioFormat: z.enum(['mp3', 'm4a', 'wav', 'flac']).optional(),
});

export const GalleryAssetSchema = z.object({
  id: z.string(),
  index: z.number(),
  url: z.string().url(),
  filename: z.string(),
  thumbnail: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  selected: z.boolean().optional(),
});

export const GalleryInfoSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  source: z.string(),
  downloadType: z.literal('gallery'),
  isGallery: z.literal(true),
  assetCount: z.number(),
  assets: z.array(GalleryAssetSchema),
});

export const DirectFileInfoSchema = z.object({
  url: z.string().url(),
  finalUrl: z.string().url(),
  filename: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().nullable().optional(),
  estimatedFileSizeBytes: z.number().nullable().optional(),
  supportsResume: z.boolean(),
  etag: z.string().nullable().optional(),
  lastModified: z.string().nullable().optional(),
  contentDisposition: z.string().nullable().optional(),
  category: z.string(),
  isWebpage: z.boolean().optional(),
  downloadType: z.enum(['file', 'image', 'webpage']),
});

export const StartDownloadResponsePayloadSchema = z.object({
  success: z.boolean(),
  jobId: z.string(),
  outputPath: z.string().optional(),
});

export const DownloadProgressEventPayloadSchema = z.object({
  jobId: z.string(),
  progress: z.number().min(0).max(100),
  downloadedBytes: z.number(),
  totalBytes: z.number(),
  speedBytesPerSec: z.number(),
  etaSeconds: z.number().nullable(),
  filename: z.string().optional(),
});

export const DownloadCompletedEventPayloadSchema = z.object({
  jobId: z.string(),
  outputPath: z.string(),
  totalBytes: z.number(),
});

export const DownloadFailedEventPayloadSchema = z.object({
  jobId: z.string(),
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
});

export const CancelDownloadRequestPayloadSchema = z.object({
  jobId: z.string().min(1),
});

export const CancelDownloadResponsePayloadSchema = z.object({
  jobId: z.string(),
  cancelled: z.boolean(),
  success: z.boolean().optional(),
});

export const PauseDownloadRequestPayloadSchema = z.object({
  jobId: z.string().min(1),
});

export const PauseDownloadResponsePayloadSchema = z.object({
  jobId: z.string(),
  paused: z.boolean(),
  success: z.boolean().optional(),
});



