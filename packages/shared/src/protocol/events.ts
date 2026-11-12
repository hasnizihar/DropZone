export const WORKER_EVENTS = {
  READY: 'worker.ready',
  SHUTTING_DOWN: 'worker.shutting_down',
  ERROR: 'worker.error',
  STATUS: 'worker.status',
  ANALYSIS_STARTED: 'analysis.started',
  ANALYSIS_COMPLETED: 'analysis.completed',
  ANALYSIS_FAILED: 'analysis.failed',
} as const;

export type WorkerEventName = typeof WORKER_EVENTS[keyof typeof WORKER_EVENTS] | string;

export interface WorkerReadyEventPayload {
  workerVersion: string;
  protocolVersion: string;
  pid: number;
}

export interface WorkerShuttingDownEventPayload {
  workerVersion: string;
  clean: boolean;
}

export interface WorkerErrorEventPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
}

