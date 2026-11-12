import { z } from 'zod';

export const ProtocolMessageSchema = z.object({
  protocolVersion: z.string().default('1.0'),
  id: z.string().min(1, 'Message id is required'),
  type: z.enum(['request', 'response', 'event', 'error']),
  command: z.string().min(1, 'Message command is required'),
  payload: z.record(z.any()).default({}),
  timestamp: z.string(),
});

export const WorkerRequestSchema = ProtocolMessageSchema.extend({
  type: z.literal('request'),
});

export const WorkerResponseSchema = ProtocolMessageSchema.extend({
  type: z.literal('response'),
});

export const WorkerErrorSchema = ProtocolMessageSchema.extend({
  type: z.literal('error'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
});

export const WorkerEventSchema = ProtocolMessageSchema.extend({
  type: z.literal('event'),
});

export const WorkerStatusPayloadSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  pid: z.number(),
  workerVersion: z.string(),
  protocolVersion: z.string(),
  pythonVersion: z.string(),
  uptimeSeconds: z.number(),
  memoryBytes: z.number(),
  requestsProcessed: z.number(),
  errorsCount: z.number(),
  capabilities: z.array(z.string()),
});

