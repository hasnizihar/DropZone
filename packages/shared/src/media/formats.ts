import { z } from 'zod';

export interface MediaFormat {
  formatId: string;
  formatNote?: string | null;
  extension: string;
  container?: string | null;
  resolution?: string | null;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  audioBitrate?: number | null;
  videoBitrate?: number | null;
  totalBitrate?: number | null;
  fileSizeBytes?: number | null;
  estimatedFileSizeBytes?: number | null;
  isVideo: boolean;
  isAudio: boolean;
  isCombined: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  qualityLabel: string;
}

export const MediaFormatSchema = z.object({
  formatId: z.string(),
  formatNote: z.string().nullable().optional(),
  extension: z.string(),
  container: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  fps: z.number().nullable().optional(),
  videoCodec: z.string().nullable().optional(),
  audioCodec: z.string().nullable().optional(),
  audioBitrate: z.number().nullable().optional(),
  videoBitrate: z.number().nullable().optional(),
  totalBitrate: z.number().nullable().optional(),
  fileSizeBytes: z.number().nullable().optional(),
  estimatedFileSizeBytes: z.number().nullable().optional(),
  isVideo: z.boolean(),
  isAudio: z.boolean(),
  isCombined: z.boolean(),
  hasVideo: z.boolean(),
  hasAudio: z.boolean(),
  qualityLabel: z.string(),
});
