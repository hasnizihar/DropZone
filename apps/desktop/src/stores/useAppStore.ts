import { create } from 'zustand';
import type {
  DownloadJob,
  MediaInfo,
  AppSettings,
  SystemEnginesReport,
  CreateDownloadOptions,
  AnalysisStatus,
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
  analysisStatus: AnalysisStatus;
  selectedFormatId: string | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
  analysisDurationMs: number | null;
  systemInfo: { version: string; platform: string; engines: SystemEnginesReport } | null;
  settings: AppSettings;
  toast: Toast | null;
  workerStatus: Record<string, any> | null;

  // Actions
  setActiveTab: (tab: NavigationTab) => void;
  setAnalyzedMedia: (media: MediaInfo | null) => void;
  setSelectedFormatId: (formatId: string | null) => void;
  resetAnalysis: () => void;
  showToast: (text: string, type?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
  
  // Async IPC Actions
  init: () => Promise<void>;
  inspectUrl: (url: string) => Promise<boolean>;
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
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'dashboard',
  jobs: [],
  analyzedMedia: null,
  analysisStatus: 'idle',
  selectedFormatId: null,
  isAnalyzing: false,
  analyzeError: null,
  analysisDurationMs: null,
  systemInfo: null,
  settings: DEFAULT_SETTINGS,
  toast: null,
  workerStatus: null,

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
      selectedFormatId: null,
      isAnalyzing: false,
      analysisStatus: 'idle',
      analyzeError: null,
      analysisDurationMs: null,
    }),

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
      const [sysInfo, settings, jobs, workerStatus] = await Promise.all([
        window.dropzone.getSystemInfo(),
        window.dropzone.getSettings(),
        window.dropzone.getAllJobs(),
        window.dropzone.getWorkerStatus ? window.dropzone.getWorkerStatus() : Promise.resolve(null),
      ]);

      set({
        systemInfo: sysInfo,
        settings: settings || DEFAULT_SETTINGS,
        jobs: jobs || [],
        workerStatus,
      });

      // Register live listeners
      window.dropzone.onDownloadProgress((updatedJob) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)),
        }));
      });

      window.dropzone.onDownloadCompleted((completedJob) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === completedJob.id ? completedJob : j)),
        }));
        get().showToast(`Finished download: ${completedJob.title}`, 'success');
      });

      window.dropzone.onDownloadFailed((failedJob) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === failedJob.id ? failedJob : j)),
        }));
        get().showToast(`Download failed: ${failedJob.title}`, 'error');
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
}));

