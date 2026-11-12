export const PROTOCOL_VERSION = '1.0' as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

export type MessageType = 'request' | 'response' | 'event' | 'error';

export type WorkerHealthState =
  | 'stopped'
  | 'starting'
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'restarting'
  | 'stopping';

export interface BaseProtocolMessage {
  protocolVersion: ProtocolVersion | string;
  id: string;
  type: MessageType;
  command: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface WorkerRequest<T extends Record<string, any> = Record<string, any>> extends BaseProtocolMessage {
  type: 'request';
  command: string;
  payload: T;
}

export interface WorkerResponse<T extends Record<string, any> = Record<string, any>> extends BaseProtocolMessage {
  type: 'response';
  command: string;
  payload: T;
}

export interface WorkerErrorPayload {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface WorkerError extends BaseProtocolMessage {
  type: 'error';
  payload: WorkerErrorPayload;
}

export interface WorkerEvent<T extends Record<string, any> = Record<string, any>> extends BaseProtocolMessage {
  type: 'event';
  command: string; // e.g. 'worker.ready', 'worker.shutting_down'
  payload: T;
}

export type AnyWorkerMessage =
  | WorkerRequest
  | WorkerResponse
  | WorkerError
  | WorkerEvent;
