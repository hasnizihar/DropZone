export const IPC_CHANNELS = {
  // Analyzer
  ANALYZER_INSPECT: 'analyzer:inspect',

  // Downloads
  DOWNLOADS_ADD: 'downloads:add',
  DOWNLOADS_PAUSE: 'downloads:pause',
  DOWNLOADS_RESUME: 'downloads:resume',
  DOWNLOADS_CANCEL: 'downloads:cancel',
  DOWNLOADS_RETRY: 'downloads:retry',
  DOWNLOADS_REMOVE: 'downloads:remove',
  DOWNLOADS_CLEAR_COMPLETED: 'downloads:clear-completed',
  DOWNLOADS_GET_ALL: 'downloads:get-all',

  // Batch
  BATCH_INSPECT_MULTIPLE: 'batch:inspect-multiple',
  BATCH_START: 'batch:start',

  // System
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_GET_ENGINES: 'system:get-engines',
  SYSTEM_SELECT_DIRECTORY: 'system:select-directory',
  SYSTEM_OPEN_PATH: 'system:open-path',
  SYSTEM_OPEN_FOLDER: 'system:open-folder',
  SYSTEM_WINDOW_CONTROL: 'system:window-control',

  // Worker Lifecycle & Health (Milestone 2)
  WORKER_START: 'worker:start',
  WORKER_STOP: 'worker:stop',
  WORKER_GET_STATUS: 'worker:get-status',
  WORKER_HEALTH_CHECK: 'worker:health-check',
  WORKER_RESTART: 'worker:restart',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Main -> Renderer Events
  EVENT_DOWNLOAD_PROGRESS: 'event:download-progress',
  EVENT_DOWNLOAD_COMPLETED: 'event:download-completed',
  EVENT_DOWNLOAD_FAILED: 'event:download-failed',
  EVENT_ENGINE_STATUS: 'event:engine-status',
  EVENT_WORKER_STATUS_CHANGED: 'event:worker-status-changed',
  EVENT_WORKER_ERROR: 'event:worker-error',
  EVENT_ANALYSIS_STARTED: 'event:analysis-started',
  EVENT_ANALYSIS_COMPLETED: 'event:analysis-completed',
  EVENT_ANALYSIS_FAILED: 'event:analysis-failed',
} as const;
