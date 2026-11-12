import { describe, it, expect, vi } from 'vitest';
import { JsonLinesStreamParser, createProtocolRequest } from '../../electron/worker/WorkerProtocol';
import { WorkerHealthMonitor } from '../../electron/worker/WorkerHealthMonitor';
import { WorkerManager } from '../../electron/worker/WorkerManager';
import path from 'path';

describe('Worker Protocol & Stream Parser', () => {
  it('creates valid protocol request lines', () => {
    const { message, line } = createProtocolRequest('ping', { test: true }, 'req-custom');
    expect(message.id).toBe('req-custom');
    expect(message.command).toBe('ping');
    expect(message.type).toBe('request');
    expect(line.endsWith('\n')).toBe(true);

    const parsed = JSON.parse(line);
    expect(parsed.id).toBe('req-custom');
    expect(parsed.payload.test).toBe(true);
  });

  it('correctly handles split chunks across JSON Lines boundaries', () => {
    const parser = new JsonLinesStreamParser();
    const received: any[] = [];

    const part1 = '{"protocolVersion":"1.0","id":"msg-1","type":"response","com';
    const part2 = 'mand":"ping","payload":{"pong":true},"timestamp":"2026-11-12T12:00:00Z"}\n';

    parser.feed(part1, (msg) => received.push(msg));
    expect(received.length).toBe(0); // Incomplete line should buffer

    parser.feed(part2, (msg) => received.push(msg));
    expect(received.length).toBe(1);
    expect(received[0].id).toBe('msg-1');
    expect(received[0].command).toBe('ping');
  });

  it('correctly handles multiple messages in a single chunk', () => {
    const parser = new JsonLinesStreamParser();
    const received: any[] = [];

    const multi =
      '{"protocolVersion":"1.0","id":"m1","type":"response","command":"ping","payload":{},"timestamp":"2026-11-12T12:00:00Z"}\n' +
      '{"protocolVersion":"1.0","id":"m2","type":"event","command":"worker.ready","payload":{},"timestamp":"2026-11-12T12:00:01Z"}\n';

    parser.feed(multi, (msg) => received.push(msg));
    expect(received.length).toBe(2);
    expect(received[0].id).toBe('m1');
    expect(received[1].id).toBe('m2');
  });
});

describe('Worker Health Monitor', () => {
  it('transitions through health states', () => {
    const monitor = new WorkerHealthMonitor({ maxConsecutiveFailures: 2, maxRestarts: 2 });
    expect(monitor.getState()).toBe('stopped');

    monitor.markStarted();
    expect(monitor.getState()).toBe('starting');

    monitor.markHealthy();
    expect(monitor.getState()).toBe('healthy');

    // First heartbeat failure -> degraded
    monitor.markHeartbeatFailure('Timeout 1');
    expect(monitor.getState()).toBe('degraded');

    // Second failure reaches maxConsecutiveFailures -> unhealthy
    monitor.markHeartbeatFailure('Timeout 2');
    expect(monitor.getState()).toBe('unhealthy');

    // Successful heartbeat restores healthy
    monitor.markHeartbeatSuccess();
    expect(monitor.getState()).toBe('healthy');
  });

  it('enforces maximum restart attempts', () => {
    const monitor = new WorkerHealthMonitor({ maxRestarts: 2 });
    expect(monitor.canRestart()).toBe(true);

    monitor.incrementRestartCount(); // 1
    expect(monitor.canRestart()).toBe(true);

    monitor.incrementRestartCount(); // 2
    expect(monitor.canRestart()).toBe(false);
  });
});

describe('WorkerManager Full Integration with Python Subprocess', () => {
  it('starts Python worker, handshakes, exchanges ping, and shuts down cleanly', async () => {
    const workerRoot = path.resolve(__dirname, '../../../../backend/worker');
    const manager = new WorkerManager({
      workerRoot,
      startupTimeoutMs: 10000,
      shutdownTimeoutMs: 5000,
    });

    try {
      // 1. Start worker and verify handshake
      await manager.start();
      const statusInfo = manager.getStatusInfo();
      expect(statusInfo.state).toBe('healthy');
      expect(statusInfo.isAlive).toBe(true);
      expect(statusInfo.pid).toBeTypeOf('number');

      // 2. Send ping heartbeat
      await manager.sendPing();

      // 3. Send get_status request
      const workerStatus = await manager.getStatus();
      expect(workerStatus.status).toBe('healthy');
      expect(workerStatus.workerVersion).toBe('1.0.0');
      expect(workerStatus.protocolVersion).toBe('1.0');

      // 4. Test analyzeUrl security boundary (loopback address rejection)
      await expect(manager.analyzeUrl('http://127.0.0.1:8080/test.mp4')).rejects.toThrow(
        /loopback/i
      );

      // 5. Graceful stop
      await manager.stop();
      expect(manager.getStatusInfo().state).toBe('stopped');
      expect(manager.getStatusInfo().isAlive).toBe(false);
    } finally {
      await manager.stop().catch(() => {});
    }
  }, 20000);
});

