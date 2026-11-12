import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { JsonLinesStreamParser } from './WorkerProtocol';
import { AnyWorkerMessage } from '@dropzone/shared';

export interface WorkerProcessOptions {
  customPythonPath?: string;
  workerRoot?: string;
  onMessage: (msg: AnyWorkerMessage) => void;
  onStderr?: (logLine: string) => void;
  onExit: (code: number | null, signal: string | null) => void;
  onError: (err: Error) => void;
}

export class WorkerProcess {
  private proc: ChildProcess | null = null;
  private parser = new JsonLinesStreamParser();
  private options: WorkerProcessOptions;

  constructor(options: WorkerProcessOptions) {
    this.options = options;
  }

  public static resolvePythonExecutable(customPath?: string, workerRoot?: string): string {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const baseRoot = workerRoot || path.resolve(__dirname, '../../../backend/worker');

    // Check project virtualenv
    const isWin = process.platform === 'win32';
    const venvPythonWin = path.join(baseRoot, '.venv', 'Scripts', 'python.exe');
    const venvPythonUnix = path.join(baseRoot, '.venv', 'bin', 'python');

    if (isWin && fs.existsSync(venvPythonWin)) {
      return venvPythonWin;
    }
    if (!isWin && fs.existsSync(venvPythonUnix)) {
      return venvPythonUnix;
    }

    // Default to system python command
    return isWin ? 'python' : 'python3';
  }

  public spawn(): void {
    if (this.proc) {
      throw new Error('Worker process is already running.');
    }

    const workerRoot = this.options.workerRoot || path.resolve(__dirname, '../../../backend/worker');
    const pythonExecutable = WorkerProcess.resolvePythonExecutable(this.options.customPythonPath, workerRoot);
    const workerSrc = path.join(workerRoot, 'src');

    const env = {
      ...process.env,
      PYTHONPATH: workerSrc,
      PYTHONUNBUFFERED: '1',
    };

    this.parser.reset();

    this.proc = spawn(pythonExecutable, ['-m', 'dropzone_worker'], {
      cwd: workerSrc,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout?.setEncoding('utf8');
    this.proc.stdout?.on('data', (chunk: string) => {
      this.parser.feed(
        chunk,
        (msg) => this.options.onMessage(msg),
        (err, rawLine) => {
          console.warn('[WorkerProtocol Parse Warning]', err.message, rawLine);
        }
      );
    });

    this.proc.stderr?.setEncoding('utf8');
    this.proc.stderr?.on('data', (chunk: string) => {
      const trimmed = chunk.trim();
      if (trimmed) {
        this.options.onStderr?.(trimmed);
      }
    });

    this.proc.on('error', (err: Error) => {
      this.options.onError(err);
    });

    this.proc.on('close', (code: number | null, signal: string | null) => {
      this.proc = null;
      this.options.onExit(code, signal);
    });
  }

  public writeLine(line: string): void {
    if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
      throw new Error('Cannot write to worker: process or stdin not available.');
    }
    this.proc.stdin.write(line);
  }

  public kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.proc && !this.proc.killed) {
      this.proc.kill(signal);
    }
  }

  public get pid(): number | undefined {
    return this.proc?.pid;
  }

  public get isAlive(): boolean {
    return !!this.proc && !this.proc.killed;
  }
}

