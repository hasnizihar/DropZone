import {
  WorkerRequest,
  AnyWorkerMessage,
  ProtocolMessageSchema,
  PROTOCOL_VERSION,
} from '@dropzone/shared';

let idCounter = 1;

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${idCounter++}`;
}

export function createProtocolRequest<T extends Record<string, any> = Record<string, any>>(
  command: string,
  payload: T = {} as T,
  requestId?: string
): { message: WorkerRequest<T>; line: string } {
  const id = requestId || generateRequestId();
  const message: WorkerRequest<T> = {
    protocolVersion: PROTOCOL_VERSION,
    id,
    type: 'request',
    command,
    payload,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(message) + '\n';
  return { message, line };
}

/**
 * Streaming JSON Lines parser for incoming stdout chunks.
 * Buffers partial lines across chunk boundaries safely.
 */
export class JsonLinesStreamParser {
  private buffer = '';

  public feed(chunk: string, onMessage: (msg: AnyWorkerMessage) => void, onError?: (err: Error, rawLine: string) => void): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // Keep whatever remains after the last newline in the buffer
    this.buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const validated = ProtocolMessageSchema.safeParse(parsed);
        if (validated.success) {
          onMessage(validated.data as AnyWorkerMessage);
        } else {
          onError?.(new Error(`Protocol validation failed: ${validated.error.message}`), trimmed);
        }
      } catch (err: any) {
        onError?.(new Error(`Malformed JSON line from worker: ${err.message}`), trimmed);
      }
    }
  }

  public reset(): void {
    this.buffer = '';
  }
}

