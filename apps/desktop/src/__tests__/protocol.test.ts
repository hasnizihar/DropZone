import { describe, it, expect } from 'vitest';
import {
  ProtocolMessageSchema,
  WorkerRequestSchema,
  WorkerResponseSchema,
  WorkerErrorSchema,
  WorkerEventSchema,
  WorkerStatusPayloadSchema,
} from '@dropzone/shared';

describe('Protocol Message Schemas & Validation', () => {
  it('validates a correct request message', () => {
    const raw = {
      protocolVersion: '1.0',
      id: 'req-123',
      type: 'request',
      command: 'ping',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    const parsed = WorkerRequestSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe('req-123');
      expect(parsed.data.command).toBe('ping');
    }
  });

  it('rejects message with missing id', () => {
    const raw = {
      protocolVersion: '1.0',
      type: 'request',
      command: 'ping',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    const parsed = WorkerRequestSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });

  it('validates worker status payload structure', () => {
    const statusPayload = {
      status: 'healthy',
      pid: 1234,
      workerVersion: '1.0.0',
      protocolVersion: '1.0',
      pythonVersion: '3.12.10',
      uptimeSeconds: 12.5,
      memoryBytes: 52428800,
      requestsProcessed: 10,
      errorsCount: 0,
      capabilities: ['ping', 'hello', 'get_status', 'shutdown'],
    };

    const parsed = WorkerStatusPayloadSchema.safeParse(statusPayload);
    expect(parsed.success).toBe(true);
  });

  it('validates error response structure', () => {
    const raw = {
      protocolVersion: '1.0',
      id: 'req-err',
      type: 'error',
      command: 'unknown',
      payload: {
        code: 'UNKNOWN_COMMAND',
        message: 'Invalid command passed',
      },
      timestamp: new Date().toISOString(),
    };

    const parsed = WorkerErrorSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});
