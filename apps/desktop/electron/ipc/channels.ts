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

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Main -> Renderer Events
  EVENT_DOWNLOAD_PROGRESS: 'event:download-progress',
  EVENT_DOWNLOAD_COMPLETED: 'event:download-completed',
  EVENT_DOWNLOAD_FAILED: 'event:download-failed',
  EVENT_ENGINE_STATUS: 'event:engine-status',
} as const;
