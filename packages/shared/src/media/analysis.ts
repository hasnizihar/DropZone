import { z } from 'zod';
import { MediaMetadata, MediaMetadataSchema } from './metadata';
import { MediaFormat, MediaFormatSchema } from './formats';

export type AnalysisStatus =
  | 'idle'
  | 'validating'
  | 'analyzing'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface ExtractorInfo {
  name: string;
  key: string;
}

export interface AnalysisError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface AnalyzeUrlRequestPayload {
  url: string;
}

export interface AnalyzeUrlResponsePayload {
  success?: boolean;
  metadata?: MediaMetadata;
  formats?: MediaFormat[];
  extractor?: ExtractorInfo;
  analysisDurationMs?: number;
  downloadType?: 'media' | 'file' | 'image' | 'gallery';
  isGallery?: boolean;
  title?: string;
  url?: string;
  source?: string;
  assets?: any[];
  assetCount?: number;
  fileInfo?: any;
}

export const ExtractorInfoSchema = z.object({
  name: z.string(),
  key: z.string(),
});

export const AnalysisErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
});

export const AnalyzeUrlResponsePayloadSchema = z.object({
  success: z.boolean(),
  metadata: MediaMetadataSchema,
  formats: z.array(MediaFormatSchema),
  extractor: ExtractorInfoSchema,
  analysisDurationMs: z.number(),
});
