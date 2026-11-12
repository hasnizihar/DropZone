import { create } from 'zustand';
import type {
  DownloadJob,
  MediaInfo,
  DirectFileInfo,
  GalleryInfo,
  PlaylistInfo,
  BatchItemAnalysisResult,
  AppSettings,
  SystemEnginesReport,
  CreateDownloadOptions,
  PostProcessOptions,
  AnalysisStatus,
  HistoryQueryOptions,
} from '@dropzone/shared';
import { DEFAULT_SETTINGS } from '@dropzone/shared';

export type NavigationTab =
  | 'dashboard'
  | 'analyzer'
  | 'downloads'
  | 'batch'
  | 'history'
  | 'settings'
  | 'about';

interface Toast {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface AppState {
  activeTab: NavigationTab;
  jobs: DownloadJob[];
  analyzedMedia: MediaInfo | null;
  analyzedFile: DirectFileInfo | null;
  analyzedGallery: GalleryInfo | null;
  analyzedPlaylist: PlaylistInfo | null;
  batchItems: BatchItemAnalysisResult[];
  isAnalyzingBatch: boolean;
  analysisStatus: AnalysisStatus;
  selectedFormatId: string | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  analysisDurationMs: number | null;
  systemInfo: { version: string; platform: string; engines: SystemEnginesReport } | null;
  settings: AppSettings;
  toast: Toast | null;
  workerStatus: Record<string, any> | null;
  ffmpegInfo: {
    available: boolean;
    version: string | null;
    ffmpegPath: string | null;
    ffprobePath: string | null;
    probeAvailable: boolean;
    supportedAudioFormats: string[];
    supportedContainers: string[];
  } | null;

  // Actions
  setActiveTab: (tab: NavigationTab) => void;
  setAnalyzedMedia: (media: MediaInfo | null) => void;
  setSelectedFormatId: (formatId: string | null) => void;
  resetAnalysis: () => void;
  toggleGalleryAssetSelected: (index: number) => void;
  selectAllGalleryAssets: (selected: boolean) => void;
  togglePlaylistItem: (index: number) => void;
  selectAllPlaylistItems: (selected: boolean) => void;
  setBatchItems: (items: BatchItemAnalysisResult[]) => void;
  updateBatchItem: (id: string, updates: Partial<BatchItemAnalysisResult>) => void;
  toggleBatchItem: (id: string) => void;
  selectAllBatchItems: (selected: boolean) => void;
  removeBatchItem: (id: string) => void;
  showToast: (text: string, type?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
  
  // Async IPC Actions
  init: () => Promise<void>;
  inspectUrl: (url: string) => Promise<boolean>;
  inspectPlaylist: (url: string, maxEntries?: number) => Promise<boolean>;
  inspectBatch: (urls: string[]) => Promise<void>;
  startBatch: (options?: { targetDirectory?: string; title?: string }) => Promise<boolean>;
  addJob: (options: CreateDownloadOptions) => Promise<boolean>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  removeJob: (jobId: string, deleteFile?: boolean) => Promise<void>;
  clearCompleted: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  selectDownloadDirectory: () => Promise<string | null>;
  openPath: (path: string) => Promise<boolean>;
  openFolder: (filePath: string) => Promise<boolean>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;

  // Worker Actions (Milestone 2)
  fetchWorkerStatus: () => Promise<void>;
  restartWorker: () => Promise<void>;

  // Post-Processing Actions (Milestone 7)
  fetchFfmpegInfo: () => Promise<void>;
  postprocessJob: (jobId: string, options: PostProcessOptions) => Promise<boolean>;

  // History State & Actions (Milestone 8 SQLite)
  historyItems: DownloadJob[];
  historyTotalCount: number;
  historyPage: number;
  historyPageSize: number;
  historyTotalPages: number;
  historySearchTerm: string;
  historyCategoryFilter: string;
  historyStatusFilter: string;
  isHistoryLoading: boolean;

  fetchHistory: (query?: Partial<HistoryQueryOptions>) => Promise<void>;
  setHistoryPage: (page: number) => Promise<void>;
  setHistorySearchTerm: (term: string) => Promise<void>;
  setHistoryCategoryFilter: (category: string) => Promise<void>;
  setHistoryStatusFilter: (status: string) => Promise<void>;
  removeHistoryItem: (jobId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteDownloadedFile: (jobId: string) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  jobs: [],
  analyzedMedia: null,
  analyzedFile: null,
  analyzedGallery: null,
  analyzedPlaylist: null,
  batchItems: [],
  isAnalyzingBatch: false,
  analysisStatus: 'idle',
  selectedFormatId: null,
  isAnalyzing: false,
  analyzeError: null,
  analysisDurationMs: null,
  systemInfo: null,
  settings: DEFAULT_SETTINGS,
  toast: null,
  workerStatus: null,
  ffmpegInfo: null,

  // History State
  historyItems: [],
  historyTotalCount: 0,
  historyPage: 1,
  historyPageSize: 50,
  historyTotalPages: 1,
  historySearchTerm: '',
  historyCategoryFilter: 'all',
  historyStatusFilter: 'all',
  isHistoryLoading: false,

  setActiveTab: (activeTab) => set({ activeTab }),

  setAnalyzedMedia: (analyzedMedia) => {
    const defaultFmt = analyzedMedia?.formats?.find((f) => f.isCombined) || analyzedMedia?.formats?.[0];
    set({
      analyzedMedia,
      selectedFormatId: defaultFmt?.formatId || null,
      analysisStatus: analyzedMedia ? 'completed' : 'idle',
      analyzeError: null,
    });
  },

  setSelectedFormatId: (selectedFormatId) => set({ selectedFormatId }),

  resetAnalysis: () =>
    set({
      analyzedMedia: null,
      analyzedFile: null,
      analyzedGallery: null,
      analyzedPlaylist: null,
      selectedFormatId: null,
      isAnalyzing: false,
      analysisStatus: 'idle',
      analyzeError: null,
      analysisDurationMs: null,
    }),

  toggleGalleryAssetSelected: (index: number) => {
    set((state) => {
      if (!state.analyzedGallery) return state;
      const updatedAssets = state.analyzedGallery.assets.map((a, i) =>
        i === index ? { ...a, selected: a.selected === false ? true : false } : a
      );
      return {
        analyzedGallery: {
          ...state.analyzedGallery,
          assets: updatedAssets,
        },
      };
    });
  },

  selectAllGalleryAssets: (selected: boolean) => {
    set((state) => {
      if (!state.analyzedGallery) return state;
      const updatedAssets = state.analyzedGallery.assets.map((a) => ({ ...a, selected }));
      return {
        analyzedGallery: {
          ...state.analyzedGallery,
          assets: updatedAssets,
        },
      };
    });
  },

  togglePlaylistItem: (index: number) => {
    set((state) => {
      if (!state.analyzedPlaylist) return state;
      const updatedEntries = state.analyzedPlaylist.entries.map((e, i) =>
        i === index ? { ...e, selected: !e.selected } : e
      );
      return {
        analyzedPlaylist: {
          ...state.analyzedPlaylist,
          entries: updatedEntries,
        },
      };
    });
  },

  selectAllPlaylistItems: (selected: boolean) => {
    set((state) => {
      if (!state.analyzedPlaylist) return state;
      const updatedEntries = state.analyzedPlaylist.entries.map((e) =>
        e.isAvailable ? { ...e, selected } : e
      );
      return {
        analyzedPlaylist: {
          ...state.analyzedPlaylist,
          entries: updatedEntries,
        },
      };
    });
  },

  setBatchItems: (batchItems) => set({ batchItems }),

  updateBatchItem: (id, updates) =>
    set((state) => ({
      batchItems: state.batchItems.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    })),

  toggleBatchItem: (id) =>
    set((state) => ({
      batchItems: state.batchItems.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      ),
    })),

  selectAllBatchItems: (selected) =>
    set((state) => ({
      batchItems: state.batchItems.map((item) =>
        item.status === 'ready' ? { ...item, selected } : item
      ),
    })),

  removeBatchItem: (id) =>
    set((state) => ({
      batchItems: state.batchItems.filter((item) => item.id !== id),
    })),

  showToast: (text, type = 'info') => {
    const id = Date.now().toString();
    set({ toast: { id, text, type } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 4000);
  },

  clearToast: () => set({ toast: null }),

  init: async () => {
    if (typeof window === 'undefined' || !window.dropzone) return;

    try {
      const [sysInfo, settings, jobs, workerStatus, ffmpegInfo] = await Promise.all([
        window.dropzone.getSystemInfo(),
        window.dropzone.getSettings(),
        window.dropzone.getAllJobs(),
        window.dropzone.getWorkerStatus ? window.dropzone.getWorkerStatus() : Promise.resolve(null),
        window.dropzone.getFfmpegInfo ? window.dropzone.getFfmpegInfo() : Promise.resolve(null),
      ]);

      set({
        systemInfo: sysInfo,
        settings: settings || DEFAULT_SETTINGS,
        jobs: jobs || [],
        workerStatus,
        ffmpegInfo: ffmpegInfo || null,
      });

      // Initial history fetch from SQLite (Milestone 8)
      get().fetchHistory().catch(console.error);

      // Register live listeners
      window.dropzone.onDownloadProgress((updatedJob) => {
        set((state) => {
          const exists = state.jobs.some((j) => j.id === updatedJob.id);
          if (exists) {
            return {
              jobs: state.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)),
            };
          }
          return {
            jobs: [updatedJob, ...state.jobs],
          };
        });
      });

      window.dropzone.onDownloadCompleted((completedJob) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === completedJob.id ? completedJob : j)),
        }));
        get().showToast(`Finished download: ${completedJob.title}`, 'success');
        get().fetchHistory().catch(console.error);
      });

      window.dropzone.onDownloadFailed((failedJob) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === failedJob.id ? failedJob : j)),
        }));
        get().showToast(`Download failed: ${failedJob.title}`, 'error');
        get().fetchHistory().catch(console.error);
      });

      window.dropzone.onEngineStatusChanged((report) => {
        set((state) => ({
          systemInfo: state.systemInfo ? { ...state.systemInfo, engines: report } : null,
        }));
      });

      // Worker Subprocess listeners (Milestone 2)
      if (window.dropzone.onWorkerStatusChanged) {
        window.dropzone.onWorkerStatusChanged((status) => {
          set({ workerStatus: status });
        });
      }

      if (window.dropzone.onWorkerError) {
        window.dropzone.onWorkerError((err) => {
          get().showToast(err.payload?.message || 'Worker error occurred', 'error');
        });
      }

      // Analysis Lifecycle listeners (Milestone 3)
      if (window.dropzone.onAnalysisStarted) {
        window.dropzone.onAnalysisStarted(() => {
          set({ analysisStatus: 'analyzing', isAnalyzing: true, analyzeError: null });
        });
      }

      if (window.dropzone.onAnalysisCompleted) {
        window.dropzone.onAnalysisCompleted(() => {
          set({ analysisStatus: 'completed', isAnalyzing: false });
        });
      }

      if (window.dropzone.onAnalysisFailed) {
        window.dropzone.onAnalysisFailed((payload) => {
          set({
            analysisStatus: 'failed',
            isAnalyzing: false,
            analyzeError: payload.error || 'Analysis failed',
          });
        });
      }
    } catch (err: any) {
      console.error('Failed to initialize desktop store:', err);
    }
  },

  inspectUrl: async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      set({ analyzeError: 'Please enter a URL to inspect.', analysisStatus: 'failed' });
      return false;
    }

    set({
      isAnalyzing: true,
      analysisStatus: 'validating',
      analyzeError: null,
    });

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const err = 'Invalid URL protocol: Only HTTP and HTTPS URLs are supported.';
      set({
        isAnalyzing: false,
        analysisStatus: 'failed',
        analyzeError: err,
      });
      get().showToast(err, 'error');
      return false;
    }

    set({ analysisStatus: 'analyzing' });

    try {
      if (typeof window !== 'undefined' && window.dropzone) {
        const res = await window.dropzone.inspectUrl(trimmed);
        if (res.success && res.data) {
          const defaultFmt = res.data.formats?.find((f) => f.isCombined) || res.data.formats?.[0];
          set({
            analyzedMedia: res.data,
            analyzedFile: res.fileInfo || null,
            analyzedGallery: res.gallery || null,
            analyzedPlaylist: res.playlist || null,
            selectedFormatId: defaultFmt?.formatId || null,
            isAnalyzing: false,
            analysisStatus: 'completed',
            analysisDurationMs: res.data.analysisDurationMs || null,
            analyzeError: null,
          });
          return true;
        } else {
          const err = res.error || 'Failed to inspect URL';
          const isTimeout = err.toLowerCase().includes('timeout');
          set({
            isAnalyzing: false,
            analysisStatus: isTimeout ? 'timeout' : 'failed',
            analyzeError: err,
          });
          get().showToast(err, 'error');
          return false;
        }
      }
      return false;
    } catch (err: any) {
      const errMsg = err?.message || 'Inspection error occurred';
      const isTimeout = errMsg.toLowerCase().includes('timeout');
      set({
        isAnalyzing: false,
        analysisStatus: isTimeout ? 'timeout' : 'failed',
        analyzeError: errMsg,
      });
      get().showToast(errMsg, 'error');
      return false;
    }
  },

  inspectPlaylist: async (url: string, maxEntries?: number) => {
    const trimmed = url.trim();
    if (!trimmed) {
      set({ analyzeError: 'Please enter a playlist URL.', analysisStatus: 'failed' });
      return false;
    }
    set({ isAnalyzing: true, analysisStatus: 'analyzing', analyzeError: null });

    try {
      if (typeof window !== 'undefined' && window.dropzone) {
        const res = await window.dropzone.inspectPlaylist(trimmed, maxEntries);
        if (res.success && res.data) {
          set({
            analyzedPlaylist: res.data,
            isAnalyzing: false,
            analysisStatus: 'completed',
            analyzeError: null,
          });
          return true;
        } else {
          const err = res.error || 'Failed to inspect playlist';
          set({ isAnalyzing: false, analysisStatus: 'failed', analyzeError: err });
          get().showToast(err, 'error');
          return false;
        }
      }
      return false;
    } catch (err: any) {
      const errStr = err?.message || 'Playlist inspection failed';
      set({ isAnalyzing: false, analysisStatus: 'failed', analyzeError: errStr });
      get().showToast(errStr, 'error');
      return false;
    }
  },

  inspectBatch: async (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    set({ isAnalyzingBatch: true });

    try {
      if (typeof window !== 'undefined' && window.dropzone) {
        const res = await window.dropzone.inspectBatch(urls);
        if (res.success && res.results) {
          set({ batchItems: res.results, isAnalyzingBatch: false });
          if (res.excessCount && res.excessCount > 0) {
            get().showToast(`Batch bounded to 50 URLs (${res.excessCount} excess URLs omitted)`, 'info');
          } else {
            get().showToast(`Inspected ${res.results.length} URLs in batch`, 'success');
          }
        } else {
          set({ isAnalyzingBatch: false });
          get().showToast(res.error || 'Batch inspection failed', 'error');
        }
      }
    } catch (err: any) {
      set({ isAnalyzingBatch: false });
      get().showToast(err?.message || 'Failed to analyze batch', 'error');
    }
  },

  startBatch: async (options?: { targetDirectory?: string; title?: string }) => {
    const { batchItems, settings } = get();
    const readySelected = batchItems.filter((i) => i.selected && i.status === 'ready');
    if (readySelected.length === 0) {
      get().showToast('No ready and selected items to enqueue.', 'error');
      return false;
    }

    const targetDir = options?.targetDirectory || settings.defaultDownloadDir;
    const downloadOptionsList: CreateDownloadOptions[] = readySelected.map((item) => {
      const isImage = item.downloadType === 'image';
      const isFile = item.downloadType === 'file';
      const engine = isImage || isFile ? 'direct-http' : 'yt-dlp';
      return {
        url: item.url,
        customFilename: item.customFilename || item.title,
        targetDirectory: targetDir,
        engine,
        category: isImage ? 'image' : (isFile ? 'file' : 'video'),
        selectedFormatId: item.selectedFormatId || 'best',
      };
    });

    try {
      if (typeof window !== 'undefined' && window.dropzone) {
        const res = await window.dropzone.startBatch(downloadOptionsList, {
          title: options?.title || `Batch (${readySelected.length} items)`,
          targetDirectory: targetDir,
        });
        if (res.success) {
          get().showToast(`Enqueued batch container with ${readySelected.length} items`, 'success');
          set({ activeTab: 'downloads' });
          return true;
        } else {
          get().showToast(res.error || 'Failed to start batch downloads', 'error');
          return false;
        }
      }
      return false;
    } catch (err: any) {
      get().showToast(err?.message || 'Failed to start batch', 'error');
      return false;
    }
  },

  addJob: async (options: CreateDownloadOptions) => {
    try {
      if (typeof window !== 'undefined' && window.dropzone) {
        const res = await window.dropzone.addJob(options);
        if (res.success && res.job) {
          set((state) => ({ jobs: [res.job!, ...state.jobs] }));
          get().showToast(`Added to queue: ${res.job.title}`, 'success');
          return true;
        }
      }
      return false;
    } catch (err: any) {
      get().showToast(err.message || 'Failed to add download', 'error');
      return false;
    }
  },

  pauseJob: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.pauseJob(jobId);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'paused' } : j)),
      }));
    }
  },

  resumeJob: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.resumeJob(jobId);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'downloading' } : j)),
      }));
    }
  },

  cancelJob: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.cancelJob(jobId);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'cancelled' } : j)),
      }));
    }
  },

  retryJob: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.retryJob(jobId);
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'pending', progress: 0 } : j)),
      }));
    }
  },

  removeJob: async (jobId: string, deleteFile = false) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.removeJob(jobId, deleteFile);
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== jobId),
      }));
      get().showToast('Download removed', 'info');
    }
  },

  clearCompleted: async () => {
    if (typeof window !== 'undefined' && window.dropzone) {
      await window.dropzone.clearCompletedJobs();
      set((state) => ({
        jobs: state.jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled'),
      }));
      get().showToast('Cleared completed items', 'info');
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      const updated = await window.dropzone.updateSettings(newSettings);
      set({ settings: updated });
      get().showToast('Settings saved', 'success');
    }
  },

  selectDownloadDirectory: async () => {
    if (typeof window !== 'undefined' && window.dropzone) {
      const result = await window.dropzone.selectDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        await get().updateSettings({ defaultDownloadDir: path });
        return path;
      }
    }
    return null;
  },

  openPath: async (targetPath: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      return await window.dropzone.openPath(targetPath);
    }
    return false;
  },

  openFolder: async (filePath: string) => {
    if (typeof window !== 'undefined' && window.dropzone) {
      return await window.dropzone.openContainingFolder(filePath);
    }
    return false;
  },

  windowControl: (action: 'minimize' | 'maximize' | 'close') => {
    if (typeof window !== 'undefined' && window.dropzone) {
      (window.dropzone as any).windowControl?.(action);
    }
  },

  fetchWorkerStatus: async () => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.getWorkerStatus) {
      const status = await window.dropzone.getWorkerStatus();
      set({ workerStatus: status });
    }
  },

  restartWorker: async () => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.restartWorker) {
      get().showToast('Restarting Python worker...', 'info');
      const res = await window.dropzone.restartWorker();
      if (res.success) {
        get().showToast('Python worker restarted successfully', 'success');
        await get().fetchWorkerStatus();
      } else {
        get().showToast(res.error || 'Failed to restart worker', 'error');
      }
    }
  },

  fetchFfmpegInfo: async () => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.getFfmpegInfo) {
      try {
        const info = await window.dropzone.getFfmpegInfo();
        set({ ffmpegInfo: info });
      } catch (err: any) {
        console.warn('Failed to fetch FFmpeg info:', err);
      }
    }
  },

  postprocessJob: async (jobId: string, options: PostProcessOptions) => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.postprocessJob) {
      get().showToast('Starting media post-processing...', 'info');
      try {
        const res = await window.dropzone.postprocessJob(jobId, options);
        if (res.success) {
          get().showToast('Post-processing completed successfully', 'success');
          get().fetchHistory().catch(console.error);
          return true;
        } else {
          get().showToast(res.error || 'Post-processing failed', 'error');
          return false;
        }
      } catch (err: any) {
        get().showToast(err?.message || 'Failed to trigger post-processing', 'error');
        return false;
      }
    }
    return false;
  },

  // History Actions (Milestone 8 SQLite)
  fetchHistory: async (queryOverride?: Partial<HistoryQueryOptions>) => {
    if (typeof window === 'undefined' || !window.dropzone || !window.dropzone.listHistory) return;
    set({ isHistoryLoading: true });
    try {
      const state = get();
      const limit = queryOverride?.limit ?? state.historyPageSize;
      const offset = queryOverride?.offset ?? (state.historyPage - 1) * limit;
      const searchTerm = queryOverride?.searchTerm !== undefined ? queryOverride.searchTerm : state.historySearchTerm;
      const category = queryOverride?.category !== undefined ? queryOverride.category : state.historyCategoryFilter;
      const status = queryOverride?.status !== undefined ? queryOverride.status : state.historyStatusFilter;

      const res = await window.dropzone.listHistory({
        limit,
        offset,
        searchTerm,
        category,
        status,
        sortBy: queryOverride?.sortBy ?? 'created_at',
        sortOrder: queryOverride?.sortOrder ?? 'desc',
      });

      set({
        historyItems: res.items,
        historyTotalCount: res.totalCount,
        historyPage: res.page,
        historyPageSize: res.pageSize,
        historyTotalPages: res.totalPages,
        isHistoryLoading: false,
      });
    } catch (err) {
      console.error('Failed to list history:', err);
      set({ isHistoryLoading: false });
    }
  },

  setHistoryPage: async (page: number) => {
    const limit = get().historyPageSize;
    const offset = Math.max(0, (page - 1) * limit);
    set({ historyPage: page });
    await get().fetchHistory({ offset });
  },

  setHistorySearchTerm: async (term: string) => {
    set({ historySearchTerm: term, historyPage: 1 });
    await get().fetchHistory({ searchTerm: term, offset: 0 });
  },

  setHistoryCategoryFilter: async (category: string) => {
    set({ historyCategoryFilter: category, historyPage: 1 });
    await get().fetchHistory({ category, offset: 0 });
  },

  setHistoryStatusFilter: async (status: string) => {
    set({ historyStatusFilter: status, historyPage: 1 });
    await get().fetchHistory({ status, offset: 0 });
  },

  removeHistoryItem: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.removeHistoryItem) {
      const res = await window.dropzone.removeHistoryItem(jobId);
      if (res.success) {
        set((state) => ({
          historyItems: state.historyItems.filter((item) => item.id !== jobId && item.parentJobId !== jobId),
          historyTotalCount: Math.max(0, state.historyTotalCount - 1),
          jobs: state.jobs.filter((j) => j.id !== jobId && j.parentJobId !== jobId),
        }));
        get().showToast('History record removed', 'info');
      }
    }
  },

  clearHistory: async () => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.clearHistory) {
      const res = await window.dropzone.clearHistory();
      if (res.success) {
        set((state) => ({
          historyItems: state.historyItems.filter((i) => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'failed'),
          historyTotalCount: 0,
          jobs: state.jobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'failed'),
        }));
        get().showToast(`Cleared ${res.count} history records`, 'info');
        await get().fetchHistory({ offset: 0 });
      }
    }
  },

  deleteDownloadedFile: async (jobId: string) => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.deleteDownloadedFile) {
      const res = await window.dropzone.deleteDownloadedFile(jobId);
      if (res.success) {
        set((state) => ({
          historyItems: state.historyItems.filter((item) => item.id !== jobId && item.parentJobId !== jobId),
          jobs: state.jobs.filter((j) => j.id !== jobId && j.parentJobId !== jobId),
        }));
        get().showToast('File and record deleted', 'success');
      } else {
        get().showToast(res.error || 'Failed to delete file', 'error');
      }
    }
  },

  resetSettings: async () => {
    if (typeof window !== 'undefined' && window.dropzone && window.dropzone.resetSettings) {
      const defaults = await window.dropzone.resetSettings();
      set({ settings: defaults });
      get().showToast('Settings reset to defaults', 'info');
    }
  },
}));

