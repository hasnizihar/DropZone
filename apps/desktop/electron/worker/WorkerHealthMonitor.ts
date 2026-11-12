import { WorkerHealthState } from '@dropzone/shared';

export interface HealthMonitorConfig {
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxConsecutiveFailures?: number;
  maxRestarts?: number;
}

export class WorkerHealthMonitor {
  private state: WorkerHealthState = 'stopped';
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private lastHeartbeatTime: number | null = null;
  private startTime: number | null = null;
  private restartCount = 0;
  private lastError: string | null = null;

  public readonly heartbeatIntervalMs: number;
  public readonly heartbeatTimeoutMs: number;
  public readonly maxConsecutiveFailures: number;
  public readonly maxRestarts: number;

  private onStateChangeCb?: (state: WorkerHealthState) => void;

  constructor(config: HealthMonitorConfig = {}) {
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 5000;
    this.heartbeatTimeoutMs = config.heartbeatTimeoutMs ?? 3000;
    this.maxConsecutiveFailures = config.maxConsecutiveFailures ?? 3;
    this.maxRestarts = config.maxRestarts ?? 3;
  }

  public setState(newState: WorkerHealthState, error?: string): void {
    if (this.state === newState && !error) return;
    this.state = newState;
    if (error) this.lastError = error;
    this.onStateChangeCb?.(newState);
  }

  public getState(): WorkerHealthState {
    return this.state;
  }

  public onStateChange(callback: (state: WorkerHealthState) => void): void {
    this.onStateChangeCb = callback;
  }

  public markStarted(): void {
    this.startTime = Date.now();
    this.setState('starting');
  }

  public markHealthy(): void {
    this.consecutiveFailures = 0;
    this.setState('healthy');
  }

  public markHeartbeatSuccess(): void {
    this.lastHeartbeatTime = Date.now();
    this.consecutiveFailures = 0;
    if (this.state === 'degraded' || this.state === 'unhealthy') {
      this.setState('healthy');
    }
  }

  public markHeartbeatFailure(errMessage: string): void {
    this.consecutiveFailures++;
    this.lastError = errMessage;

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.setState('unhealthy', `Heartbeat failed ${this.consecutiveFailures} consecutive times: ${errMessage}`);
    } else if (this.state === 'healthy') {
      this.setState('degraded', `Heartbeat missed (${this.consecutiveFailures}/${this.maxConsecutiveFailures})`);
    }
  }

  public incrementRestartCount(): number {
    this.restartCount++;
    return this.restartCount;
  }

  public resetRestartCount(): void {
    this.restartCount = 0;
  }

  public getRestartCount(): number {
    return this.restartCount;
  }

  public canRestart(): boolean {
    return this.restartCount < this.maxRestarts;
  }

  public getUptimeSeconds(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getDiagnosticInfo(): Record<string, any> {
    return {
      state: this.state,
      uptimeSeconds: this.getUptimeSeconds(),
      restartCount: this.restartCount,
      lastHeartbeatTime: this.lastHeartbeatTime ? new Date(this.lastHeartbeatTime).toISOString() : null,
      consecutiveHeartbeatFailures: this.consecutiveFailures,
      lastError: this.lastError,
    };
  }

  public startHeartbeat(sendPingFn: () => Promise<void>): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.state !== 'healthy' && this.state !== 'degraded') return;
      try {
        await sendPingFn();
        this.markHeartbeatSuccess();
      } catch (err: any) {
        this.markHeartbeatFailure(err.message || 'Heartbeat timeout');
      }
    }, this.heartbeatIntervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
