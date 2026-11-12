export class WorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class WorkerNotRunningError extends WorkerError {
  constructor(message = 'Worker process is not currently running.') {
    super(message);
    this.name = 'WorkerNotRunningError';
  }
}

export class WorkerTimeoutError extends WorkerError {
  public command: string;
  public requestId: string;

  constructor(command: string, requestId: string, timeoutMs: number) {
    super(`Worker request '${command}' (id: ${requestId}) timed out after ${timeoutMs}ms.`);
    this.name = 'WorkerTimeoutError';
    this.command = command;
    this.requestId = requestId;
  }
}

export class WorkerCrashError extends WorkerError {
  public exitCode: number | null;
  public signal: string | null;

  constructor(exitCode: number | null, signal: string | null) {
    super(`Worker process terminated unexpectedly (exitCode: ${exitCode}, signal: ${signal}).`);
    this.name = 'WorkerCrashError';
    this.exitCode = exitCode;
    this.signal = signal;
  }
}

export class WorkerHandshakeError extends WorkerError {
  constructor(message = 'Failed to establish protocol handshake with worker.') {
    super(message);
    this.name = 'WorkerHandshakeError';
  }
}

