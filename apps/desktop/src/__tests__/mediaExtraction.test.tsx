import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  MediaMetadataSchema,
  MediaFormatSchema,
  AnalyzeUrlResponsePayloadSchema,
  WORKER_COMMANDS,
} from '@dropzone/shared';
import { useAppStore } from '../stores/useAppStore';
import { AnalyzerPage } from '../pages/AnalyzerPage';
import { WorkerManager } from '../../electron/worker/WorkerManager';

describe('Media Extraction Contracts & Zod Schemas', () => {
  it('validates standard MediaMetadata', () => {
    const validMeta = {
      id: 'abc12345',
      title: 'DROPZONE Showcase Video',
      description: 'A test video for media analysis',
      uploader: 'Antigravity Studio',
      uploaderUrl: 'https://example.com/studio',
      platform: 'YouTube',
      extractor: 'youtube',
      originalUrl: 'https://www.youtube.com/watch?v=abc12345',
      webpageUrl: 'https://www.youtube.com/watch?v=abc12345',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc12345/hqdefault.jpg',
      durationSeconds: 125,
      durationFormatted: '02m 05s',
      uploadDate: '2026-11-12',
      viewCount: 104200,
      likeCount: 4200,
      mediaType: 'video',
      isPlaylist: false,
      playlistCount: null,
    };

    const parsed = MediaMetadataSchema.safeParse(validMeta);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe('DROPZONE Showcase Video');
      expect(parsed.data.platform).toBe('YouTube');
    }
  });

  it('validates MediaMetadata with omitted optional fields', () => {
    const minimalMeta = {
      id: 'min_001',
      title: 'Minimal Clip',
      platform: 'Direct',
      extractor: 'generic',
      originalUrl: 'https://example.com/file.mp4',
      mediaType: 'video',
      isPlaylist: false,
    };

    const parsed = MediaMetadataSchema.safeParse(minimalMeta);
    expect(parsed.success).toBe(true);
  });

  it('validates exact vs estimated MediaFormat entries', () => {
    const exactFormat = {
      formatId: '22',
      extension: 'mp4',
      container: 'mp4',
      resolution: '1280x720',
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'avc1.64001F',
      audioCodec: 'mp4a.40.2',
      audioBitrate: 192,
      videoBitrate: 1500,
      totalBitrate: 1692,
      fileSizeBytes: 24500000,
      estimatedFileSizeBytes: null,
      isVideo: false,
      isAudio: false,
      isCombined: true,
      hasVideo: true,
      hasAudio: true,
      qualityLabel: '720p',
    };

    const parsedExact = MediaFormatSchema.safeParse(exactFormat);
    expect(parsedExact.success).toBe(true);
    if (parsedExact.success) {
      expect(parsedExact.data.isCombined).toBe(true);
      expect(parsedExact.data.fileSizeBytes).toBe(24500000);
    }

    const approxFormat = {
      formatId: '137',
      extension: 'mp4',
      container: 'mp4',
      resolution: '1920x1080',
      width: 1920,
      height: 1080,
      fps: 60,
      videoCodec: 'avc1.64002a',
      audioCodec: null,
      fileSizeBytes: null,
      estimatedFileSizeBytes: 82000000,
      isVideo: true,
      isAudio: false,
      isCombined: false,
      hasVideo: true,
      hasAudio: false,
      qualityLabel: '1080p 60fps',
    };

    const parsedApprox = MediaFormatSchema.safeParse(approxFormat);
    expect(parsedApprox.success).toBe(true);
    if (parsedApprox.success) {
      expect(parsedApprox.data.estimatedFileSizeBytes).toBe(82000000);
      expect(parsedApprox.data.isVideo).toBe(true);
    }
  });

  it('validates full AnalyzeUrlResponsePayload', () => {
    const fullPayload = {
      success: true,
      metadata: {
        id: 'test_123',
        title: 'Full Test Analysis',
        platform: 'YouTube',
        extractor: 'youtube',
        originalUrl: 'https://youtube.com/watch?v=test_123',
        mediaType: 'video',
        isPlaylist: false,
      },
      formats: [
        {
          formatId: '140',
          extension: 'm4a',
          isVideo: false,
          isAudio: true,
          isCombined: false,
          hasVideo: false,
          hasAudio: true,
          qualityLabel: '128 kbps Audio',
        },
      ],
      extractor: {
        name: 'YouTube',
        key: 'youtube',
      },
      analysisDurationMs: 420,
    };

    const parsed = AnalyzeUrlResponsePayloadSchema.safeParse(fullPayload);
    expect(parsed.success).toBe(true);
  });
});

describe('WorkerManager URL Analyzer Dispatch', () => {
  it('dispatches analyze_url command with expected parameters', async () => {
    const manager = new WorkerManager();
    const sendRequestSpy = vi.spyOn(manager, 'sendRequest').mockResolvedValue({
      success: true,
      metadata: {
        id: 'mock_1',
        title: 'Mock Video',
        platform: 'YouTube',
        extractor: 'youtube',
        originalUrl: 'https://example.com/watch?v=1',
        mediaType: 'video',
        isPlaylist: false,
      },
      formats: [],
      extractor: { name: 'YouTube', key: 'youtube' },
      analysisDurationMs: 250,
    });

    const result = await manager.analyzeUrl('https://example.com/watch?v=1', 10000);

    expect(sendRequestSpy).toHaveBeenCalledWith(
      WORKER_COMMANDS.ANALYZE_URL,
      { url: 'https://example.com/watch?v=1' },
      10000
    );
    expect(result.success).toBe(true);
    expect(result.metadata.title).toBe('Mock Video');
  });
});

describe('App State URL Inspection & Formats', () => {
  beforeEach(() => {
    useAppStore.setState({
      analyzedMedia: null,
      analysisStatus: 'idle',
      selectedFormatId: null,
      isAnalyzing: false,
      analyzeError: null,
      analysisDurationMs: null,
    });
  });

  it('transitions state through inspectUrl successfully', async () => {
    const success = await useAppStore.getState().inspectUrl('https://example.com/video.mp4');

    expect(success).toBe(true);
    const state = useAppStore.getState();
    expect(state.analysisStatus).toBe('completed');
    expect(state.isAnalyzing).toBe(false);
    expect(state.analyzedMedia).not.toBeNull();
    expect(state.analyzedMedia?.title).toBe('Test Video');
    // Default format should be selected
    expect(state.selectedFormatId).toBe('22');
  });

  it('rejects empty and non-http URLs', async () => {
    const emptyResult = await useAppStore.getState().inspectUrl('   ');
    expect(emptyResult).toBe(false);
    expect(useAppStore.getState().analyzeError).toContain('Please enter a URL');

    const schemeResult = await useAppStore.getState().inspectUrl('ftp://example.com/file.mp4');
    expect(schemeResult).toBe(false);
    expect(useAppStore.getState().analyzeError).toContain('Only HTTP and HTTPS URLs');
  });

  it('manages format selection and resetAnalysis', () => {
    useAppStore.getState().setSelectedFormatId('137');
    expect(useAppStore.getState().selectedFormatId).toBe('137');

    useAppStore.getState().resetAnalysis();
    const state = useAppStore.getState();
    expect(state.analyzedMedia).toBeNull();
    expect(state.selectedFormatId).toBeNull();
    expect(state.analysisStatus).toBe('idle');
  });
});

describe('AnalyzerPage UI Rendering', () => {
  it('renders analyzer page with inspected media and format selector', async () => {
    // Populate store with media
    await useAppStore.getState().inspectUrl('https://example.com/video.mp4');

    render(<AnalyzerPage />);

    expect(screen.getByText('Media & URL Inspector')).toBeDefined();
    expect(screen.getByText('Test Video')).toBeDefined();
    expect(screen.getByText('Available Formats & Streams')).toBeDefined();
    expect(screen.getByText('720p')).toBeDefined();
    expect(screen.getByText('1080p 60fps')).toBeDefined();
    expect(screen.getByText('128 kbps Audio')).toBeDefined();

    // Test filter tabs
    const videoTab = screen.getByText('Video');
    fireEvent.click(videoTab);

    // Click format card to select
    const formatCard = screen.getByText('1080p 60fps');
    fireEvent.click(formatCard);
    expect(useAppStore.getState().selectedFormatId).toBe('137');
  });
});
