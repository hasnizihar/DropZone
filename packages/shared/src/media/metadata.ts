import { z } from 'zod';

export interface MediaMetadata {
  id: string;
  title: string;
  description?: string | null;
  uploader?: string | null;
  uploaderUrl?: string | null;
  platform: string;
  extractor: string;
  originalUrl: string;
  webpageUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  durationFormatted?: string | null;
  uploadDate?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  mediaType: 'video' | 'audio' | 'image' | 'unknown';
  isPlaylist: boolean;
  playlistCount?: number | null;
}

export const MediaMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  uploader: z.string().nullable().optional(),
  uploaderUrl: z.string().nullable().optional(),
  platform: z.string(),
  extractor: z.string(),
  originalUrl: z.string(),
  webpageUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  durationFormatted: z.string().nullable().optional(),
  uploadDate: z.string().nullable().optional(),
  viewCount: z.number().nullable().optional(),
  likeCount: z.number().nullable().optional(),
  mediaType: z.enum(['video', 'audio', 'image', 'unknown']),
  isPlaylist: z.boolean(),
  playlistCount: z.number().nullable().optional(),
});
