import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import {
  PostProcessOptionsSchema,
  PostProcessRequestPayloadSchema,
  PostProcessProgressEventPayloadSchema,
  PostProcessCompletedEventPayloadSchema,
  GetFfmpegInfoResponsePayloadSchema,
} from '@dropzone/shared';
import { QueueManager } from '../../electron/queue/QueueManager';
import { WorkerManager } from '../../electron/worker/WorkerManager';

describe('Milestone 7: Post-Processing & Audio Extraction Contracts', () => {
  it('validates audio extraction options schema', () => {
    const valid = {
      action: 'extract_audio',
      audioFormat: 'mp3',
      audioBitrate: '320k',
      embedMetadata: true,
      preserveSource: false,
    };
    expect(PostProcessOptionsSchema.parse(valid)).toEqual(valid);

    const invalid = {
      action: 'extract_audio',
      audioFormat: 'unsupported_codec_xyz',
    };
    expect(() => PostProcessOptionsSchema.parse(invalid)).toThrow();
  });

  it('validates video remux options schema', () => {
    const valid = {
      action: 'remux',
      remuxContainer: 'mkv',
      preserveSource: true,
    };
    expect(PostProcessOptionsSchema.parse(valid)).toEqual(valid);
  });

  it('validates postprocess request and event schemas', () => {
    const req = {
      jobId: 'job_123',
      inputPath: 'C:/media/test.mp4',
      action: 'extract_audio',
      targetDirectory: 'C:/media',
      audioFormat: 'flac',
    };
    expect(PostProcessRequestPayloadSchema.parse(req)).toEqual(expect.objectContaining(req));

    const progressEvent = {
      jobId: 'job_123',
      progress: 78.4,
      stage: 'processing',
    };
    expect(PostProcessProgressEventPayloadSchema.parse(progressEvent)).toEqual(expect.objectContaining(progressEvent));

    const completedEvent = {
      jobId: 'job_123',
      outputPath: 'C:/media/test.flac',
      totalBytes: 25000000,
      action: 'extract_audio',
    };
    expect(PostProcessCompletedEventPayloadSchema.parse(completedEvent)).toEqual(expect.objectContaining(completedEvent));

    const ffmpegInfo = {
      available: true,
      version: '9.0.2',
      ffmpegPath: 'C:/ffmpeg/bin/ffmpeg.exe',
      ffprobePath: 'C:/ffmpeg/bin/ffprobe.exe',
      probeAvailable: true,
      supportedAudioFormats: ['mp3', 'm4a', 'wav', 'flac', 'opus'],
      supportedContainers: ['mp4', 'mkv', 'webm', 'mov'],
    };
    expect(GetFfmpegInfoResponsePayloadSchema.parse(ffmpegInfo)).toEqual(ffmpegInfo);
  });

  it('retries post-processing without redownloading if source file exists on disk', async () => {
    const mockWorkerManager = new WorkerManager();
    vi.spyOn(mockWorkerManager, 'startDownload').mockResolvedValue({ success: true, jobId: 'mock_job' });
    vi.spyOn(mockWorkerManager, 'postprocessMedia').mockResolvedValue({
      success: true,
      jobId: 'mock_job',
      outputPath: 'C:/media/test.mp3',
      totalBytes: 5000000,
      action: 'extract_audio',
    });

    const queueManager = new QueueManager(mockWorkerManager, {
      maxConcurrentDownloads: 2,
      defaultDownloadDir: 'C:/media',
    });

    const job = queueManager.addJob({
      url: 'https://example.com/test.mp4',
      postProcess: { action: 'extract_audio', audioFormat: 'mp3' },
    });

    // Simulate download complete
    mockWorkerManager.emit('download-completed', {
      jobId: job.id,
      outputPath: 'C:/media/test.mp4',
      totalBytes: 10000000,
    });
    expect(job.status).toBe('processing');

    // Simulate postprocess failure
    mockWorkerManager.emit('postprocess-failed', {
      jobId: job.id,
      code: 'POSTPROCESS_FAILED',
      message: 'Temporary encoder glitch',
    });
    expect(job.status).toBe('failed');
    expect(job.sourcePath).toBe('C:/media/test.mp4');

    // Mock fs.existsSync to report source exists
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    // Retry job
    const retried = await queueManager.retryJob(job.id);
    expect(retried).toBe(true);

    // Job should transition directly back to processing, NOT pending/downloading!
    expect(job.status).toBe('processing');
    expect(mockWorkerManager.postprocessMedia).toHaveBeenCalledTimes(2);
    // startDownload was only called once at the start!
    expect(mockWorkerManager.startDownload).toHaveBeenCalledTimes(1);

    existsSpy.mockRestore();
  });
});
