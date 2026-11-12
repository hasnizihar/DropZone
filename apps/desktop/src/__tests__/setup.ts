import { vi } from 'vitest';

// Mock window.dropzone bridge for tests
const mockDropzone = {
  inspectUrl: vi.fn().mockResolvedValue({
    success: true,
    data: {
      url: 'https://example.com/video.mp4',
      title: 'Test Video',
      source: 'example.com',
      category: 'video',
      engine: 'direct-http',
      isPlaylist: false,
      formats: [{ formatId: 'best', extension: 'mp4', resolution: '1080p' }],
    },
  }),
  addJob: vi.fn().mockImplementation((opts: any) =>
    Promise.resolve({
      success: true,
      job: {
        id: 'test_job_1',
        url: opts.url,
        title: opts.customFilename || 'Test Video',
        source: 'example.com',
        category: opts.category || 'video',
        engine: 'yt-dlp',
        status: 'pending',
        selectedFormatId: opts.selectedFormatId || 'best',
        targetDirectory: 'C:/Downloads/DropZone',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 1000000,
        speedBytesPerSec: 0,
        etaSeconds: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  ),
  pauseJob: vi.fn().mockResolvedValue({ success: true }),
  resumeJob: vi.fn().mockResolvedValue({ success: true }),
  cancelJob: vi.fn().mockResolvedValue({ success: true }),
  retryJob: vi.fn().mockResolvedValue({ success: true }),
  removeJob: vi.fn().mockResolvedValue({ success: true }),
  clearCompletedJobs: vi.fn().mockResolvedValue({ success: true, count: 1 }),
  getAllJobs: vi.fn().mockResolvedValue([]),
  inspectBatch: vi.fn().mockResolvedValue({ success: true, results: [], errors: [] }),
  startBatch: vi.fn().mockResolvedValue({ success: true, jobIds: [] }),
  getSystemInfo: vi.fn().mockResolvedValue({
    version: '1.0.0',
    platform: 'win32',
    engines: {
      ytdlp: { name: 'yt-dlp', version: '2026.10.26', isAvailable: true },
      ffmpeg: { name: 'FFmpeg', version: '9.0.2', isAvailable: true },
      python: { name: 'Python', version: '3.12.10', isAvailable: true },
      workerRunning: false,
      timestamp: new Date().toISOString(),
    },
  }),
  selectDirectory: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['C:/Downloads/DropZone'] }),
  openPath: vi.fn().mockResolvedValue(true),
  openContainingFolder: vi.fn().mockResolvedValue(true),
  windowControl: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({
    defaultDownloadDir: 'C:/Downloads/DropZone',
    maxConcurrentDownloads: 3,
    autoStartDownloads: true,
    theme: 'dark',
    retryCount: 3,
    defaultVideoQuality: 'best',
    defaultAudioFormat: 'mp3',
    speedLimitKbs: 0,
    networkTimeoutSeconds: 30,
    loggingLevel: 'info',
  }),
  updateSettings: vi.fn().mockImplementation((s: any) => Promise.resolve(s)),
  onDownloadProgress: vi.fn().mockReturnValue(() => {}),
  onDownloadCompleted: vi.fn().mockReturnValue(() => {}),
  onDownloadFailed: vi.fn().mockReturnValue(() => {}),
  onEngineStatusChanged: vi.fn().mockReturnValue(() => {}),
};

// @ts-ignore
window.dropzone = mockDropzone;
