export const WORKER_COMMANDS = {
  HELLO: 'hello',
  PING: 'ping',
  GET_STATUS: 'get_status',
  SHUTDOWN: 'shutdown',
} as const;

export type WorkerCommandName = typeof WORKER_COMMANDS[keyof typeof WORKER_COMMANDS] | string;

export interface HelloRequestPayload {
  client: string;
  version: string;
}

export interface HelloResponsePayload {
  workerVersion: string;
  protocolVersion: string;
  capabilities: string[];
  pid: number;
}

export interface PingRequestPayload {
  timestamp?: string;
}

export interface PingResponsePayload {
  pong: boolean;
  uptimeSeconds: number;
}

export interface WorkerStatusPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pid: number;
  workerVersion: string;
  protocolVersion: string;
  pythonVersion: string;
  uptimeSeconds: number;
  memoryBytes: number;
  requestsProcessed: number;
  errorsCount: number;
  capabilities: string[];
}

export interface ShutdownRequestPayload {
  reason?: string;
}

export interface ShutdownResponsePayload {
  shuttingDown: boolean;
  reason?: string;
}
