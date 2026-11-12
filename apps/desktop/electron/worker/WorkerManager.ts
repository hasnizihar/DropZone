import { EventEmitter } from 'events';
import { WorkerProcess } from './WorkerProcess';
import { WorkerHealthMonitor } from './WorkerHealthMonitor';
import { createProtocolRequest } from './WorkerProtocol';
import {
  WorkerCrashError,
  WorkerTimeoutError,
  WorkerNotRunningError,
  WorkerHandshakeError,
} from './WorkerErrors';
import {
  AnyWorkerMessage,
  WorkerResponse,
  WorkerError,
  WorkerEvent,
  WorkerHealthState,
  WORKER_COMMANDS,
  WORKER_EVENTS,
  AnalyzeUrlResponsePayload,
  StartDownloadRequestPayload,
  StartDownloadResponsePayload,
  CancelDownloadResponsePayload,
  PauseDownloadResponsePayload,
} from '@dropzone/shared';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
  command: string;
  createdAt: number;
}

export interface WorkerManagerConfig {
  customPythonPath?: string;
  workerRoot?: string;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  maxRestarts?: number;
}

export class WorkerManager extends EventEmitter {
  private proc: WorkerProcess | null = null;
  private healthMonitor: WorkerHealthMonitor;
  private pendingRequests = new Map<string, PendingRequest>();
  private isIntentionalShutdown = false;
  private handshakePromiseResolve: (() => void) | null = null;
  private handshakePromiseReject: ((err: Error) => void) | null = null;
  private config: WorkerManagerConfig;

  constructor(config: WorkerManagerConfig = {}) {
    super();
    this.config = {
      startupTimeoutMs: 15000,
      shutdownTimeoutMs: 5000,
      maxRestarts: 3,
      ...config,
    };

    this.healthMonitor = new WorkerHealthMonitor({
      maxRestarts: this.config.maxRestarts,
    });

    this.healthMonitor.onStateChange((state) => {
      this.emit('status-changed', this.getStatusInfo());
    });
  }

  public async start(): Promise<void> {
    if (this.proc && this.proc.isAlive) {
      return;
    }

    this.isIntentionalShutdown = false;
    this.healthMonitor.markStarted();

    return new Promise<void>((resolve, reject) => {
      const startupTimer = setTimeout(() => {
        this.handshakePromiseResolve = null;
        this.handshakePromiseReject = null;
        this.healthMonitor.setState('unhealthy', 'Worker startup handshake timed out.');
        this.stop().catch(() => {});
        reject(new WorkerHandshakeError(`Worker failed to become ready within ${this.config.startupTimeoutMs}ms`));
      }, this.config.startupTimeoutMs);

      this.handshakePromiseResolve = () => {
        clearTimeout(startupTimer);
        this.healthMonitor.markHealthy();
        this.healthMonitor.startHeartbeat(() => this.sendPing());
        resolve();
      };

      this.handshakePromiseReject = (err) => {
        clearTimeout(startupTimer);
        this.healthMonitor.setState('unhealthy', err.message);
        reject(err);
      };

      try {
        this.proc = new WorkerProcess({
          customPythonPath: this.config.customPythonPath,
          workerRoot: this.config.workerRoot,
          onMessage: (msg) => this.handleWorkerMessage(msg),
          onStderr: (logLine) => {
            console.error('[Worker stderr]', logLine);
            this.emit('stderr', logLine);
          },
          onExit: (code, signal) => this.handleProcessExit(code, signal),
          onError: (err) => {
            console.error('[Worker spawn error]', err);
            this.emit('error', err);
          },
        });

        this.proc.spawn();
      } catch (err: any) {
        clearTimeout(startupTimer);
        this.healthMonitor.setState('unhealthy', err.message);
        reject(err);
      }
    });
  }

  public async sendRequest<T = any>(command: string, payload: Record<string, any> = {}, timeoutMs = 10000): Promise<T> {
    if (!this.proc || !this.proc.isAlive) {
      throw new WorkerNotRunningError();
    }

    const { message, line } = createProtocolRequest(command, payload);

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new WorkerTimeoutError(command, message.id, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timer,
        command,
        createdAt: Date.now(),
      });

      try {
        this.proc!.writeLine(line);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(message.id);
        reject(err);
      }
    });
  }

  public async sendPing(): Promise<void> {
    const res = await this.sendRequest(WORKER_COMMANDS.PING, {}, this.healthMonitor.heartbeatTimeoutMs);
    if (!res || res.pong !== true) {
      throw new Error('Worker returned invalid heartbeat response.');
    }
  }

  public async analyzeUrl(url: string, timeoutMs = 35000): Promise<AnalyzeUrlResponsePayload> {
    return this.sendRequest<AnalyzeUrlResponsePayload>(
      WORKER_COMMANDS.ANALYZE_URL,
      { url },
      timeoutMs
    );
  }

  public async startDownload(
    payload: StartDownloadRequestPayload,
    timeoutMs = 3600000 // 1 hour default timeout for large file downloads
  ): Promise<StartDownloadResponsePayload> {
    return this.sendRequest<StartDownloadResponsePayload>(
      WORKER_COMMANDS.START_DOWNLOAD,
      payload,
      timeoutMs
    );
  }

  public async cancelDownload(jobId: string): Promise<CancelDownloadResponsePayload> {
    return this.sendRequest<CancelDownloadResponsePayload>(
      WORKER_COMMANDS.CANCEL_DOWNLOAD,
      { jobId },
      5000
    );
  }

  public async pauseDownload(jobId: string): Promise<PauseDownloadResponsePayload> {
    return this.sendRequest<PauseDownloadResponsePayload>(
      WORKER_COMMANDS.PAUSE_DOWNLOAD,
      { jobId },
      5000
    );
  }

  public async getStatus(): Promise<any> {
    if (this.healthMonitor.getState() === 'healthy') {
      try {
        const payload = await this.sendRequest(WORKER_COMMANDS.GET_STATUS, {}, 3000);
        return {
          ...payload,
          ...this.healthMonitor.getDiagnosticInfo(),
        };
      } catch {
        // Fall back to diagnostic info if request times out
      }
    }
    return this.getStatusInfo();
  }

  public getStatusInfo(): Record<string, any> {
    return {
      pid: this.proc?.pid ?? null,
      isAlive: this.proc?.isAlive ?? false,
      ...this.healthMonitor.getDiagnosticInfo(),
    };
  }

  public async stop(): Promise<void> {
    this.isIntentionalShutdown = true;
    this.healthMonitor.stopHeartbeat();
    this.healthMonitor.setState('stopping');

    if (this.proc && this.proc.isAlive) {
      try {
        // Send shutdown request with short timeout
        await this.sendRequest(WORKER_COMMANDS.SHUTDOWN, { reason: 'manager_stop' }, 2000);
      } catch {
        // Process might exit before responding
      }

      // Allow 1 second for graceful exit before forceful kill
      await new Promise((r) => setTimeout(r, 1000));
      if (this.proc && this.proc.isAlive) {
        this.proc.kill('SIGTERM');
      }
    }

    this.healthMonitor.setState('stopped');
    this.proc = null;
  }

  public async restart(): Promise<void> {
    this.healthMonitor.setState('restarting');
    await this.stop();
    await this.start();
  }

  private handleWorkerMessage(message: AnyWorkerMessage): void {
    if (message.type === 'response') {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id);
        pending.resolve(message.payload);
      }
    } else if (message.type === 'error') {
      const pending = this.pendingRequests.get(message.id);
      const errMsg = (message as WorkerError).payload?.message || 'Worker protocol error';
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message.id);
        pending.reject(new Error(errMsg));
      }
      this.emit('worker-error', message);
    } else if (message.type === 'event') {
      const event = message as WorkerEvent;
      if (event.command === WORKER_EVENTS.READY) {
        // Complete handshake
        this.sendRequest(WORKER_COMMANDS.HELLO, { client: 'DropZone Electron', version: '1.0.0' }, 3000)
          .then(() => {
            this.handshakePromiseResolve?.();
            this.handshakePromiseResolve = null;
          })
          .catch((err) => {
            this.handshakePromiseReject?.(err);
            this.handshakePromiseReject = null;
          });
      } else if (event.command === WORKER_EVENTS.SHUTTING_DOWN) {
        console.log('[Worker Event] Worker is shutting down cleanly.');
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_STARTED) {
        this.emit('download-started', event.payload);
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_PROGRESS) {
        this.emit('download-progress', event.payload);
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_COMPLETED) {
        this.emit('download-completed', event.payload);
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_FAILED) {
        this.emit('download-failed', event.payload);
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_CANCELLED) {
        this.emit('download-cancelled', event.payload);
      } else if (event.command === WORKER_EVENTS.DOWNLOAD_PAUSED) {
        this.emit('download-paused', event.payload);
      }
      this.emit('worker-event', event);
    }
  }

  private handleProcessExit(code: number | null, signal: string | null): void {
    console.warn(`[Worker Process Exited] code: ${code}, signal: ${signal}`);
    this.healthMonitor.stopHeartbeat();

    // Reject all pending requests
    const crashError = new WorkerCrashError(code, signal);
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(crashError);
    }
    this.pendingRequests.clear();

    if (this.isIntentionalShutdown) {
      this.healthMonitor.setState('stopped');
      return;
    }

    // Unexpected crash -> Attempt crash recovery
    this.healthMonitor.setState('unhealthy', `Process exited unexpectedly (code: ${code})`);
    this.emit('crash', { code, signal });

    if (this.healthMonitor.canRestart()) {
      const restartAttempt = this.healthMonitor.incrementRestartCount();
      const backoffDelay = Math.min(1000 * Math.pow(2, restartAttempt - 1), 15000);

      console.log(`[Crash Recovery] Scheduling restart attempt ${restartAttempt}/${this.config.maxRestarts} in ${backoffDelay}ms...`);
      this.healthMonitor.setState('restarting');

      setTimeout(async () => {
        if (!this.isIntentionalShutdown) {
          try {
            await this.start();
            console.log(`[Crash Recovery] Restart attempt ${restartAttempt} succeeded.`);
          } catch (err) {
            console.error(`[Crash Recovery] Restart attempt ${restartAttempt} failed:`, err);
          }
        }
      }, backoffDelay);
    } else {
      console.error(`[Crash Recovery] Worker exceeded maximum restart attempts (${this.config.maxRestarts}). Halting recovery.`);
      this.healthMonitor.setState('unhealthy', 'Exceeded maximum crash recovery restarts');
    }
  }
}

