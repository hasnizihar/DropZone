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

  public static resolveWorkerRoot(workerRoot?: string): string {
    if (workerRoot && fs.existsSync(workerRoot)) {
      return workerRoot;
    }
    const candidates = [
      path.resolve(__dirname, '../../../../backend/worker'),
      path.resolve(__dirname, '../../../backend/worker'),
      path.resolve(process.cwd(), 'backend/worker'),
      path.resolve(process.cwd(), '../../backend/worker'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return candidates[0];
  }

  public static resolvePythonExecutable(customPath?: string, workerRoot?: string): string {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    if (process.env.DROPZONE_PYTHON_PATH && fs.existsSync(process.env.DROPZONE_PYTHON_PATH)) {
      return process.env.DROPZONE_PYTHON_PATH;
    }

    const baseRoot = WorkerProcess.resolveWorkerRoot(workerRoot);

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

    // On Windows, check common Python installation paths before bare 'python'
    if (isWin) {
      const localAppData = process.env.LOCALAPPDATA || '';
      const versions = ['Python312', 'Python311', 'Python310', 'Python313', 'Python39'];
      for (const ver of versions) {
        const candidate = path.join(localAppData, 'Programs', 'Python', ver, 'python.exe');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      for (const ver of versions) {
        const candidate = path.join('C:\\Program Files', ver, 'python.exe');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    // Default to system python command
    return isWin ? 'python' : 'python3';
  }

  public static resolveStandaloneWorkerExecutable(): string | null {
    if (process.env.DROPZONE_WORKER_BIN && fs.existsSync(process.env.DROPZONE_WORKER_BIN)) {
      return process.env.DROPZONE_WORKER_BIN;
    }

    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'dropzone-worker.exe' : 'dropzone-worker';

    // 1. Packaged Electron resources directory
    if (process.resourcesPath) {
      const candidatesInResources = [
        path.join(process.resourcesPath, 'worker', binaryName),
        path.join(process.resourcesPath, 'bin', binaryName),
        path.join(process.resourcesPath, binaryName),
      ];
      for (const cand of candidatesInResources) {
        if (fs.existsSync(cand)) {
          return cand;
        }
      }
    }

    // 2. Development relative paths
    const devCandidates = [
      path.resolve(__dirname, '../../resources/worker', binaryName),
      path.resolve(__dirname, '../../../resources/worker', binaryName),
      path.resolve(__dirname, '../../../../resources/worker', binaryName),
      path.resolve(process.cwd(), 'apps/desktop/resources/worker', binaryName),
      path.resolve(process.cwd(), 'resources/worker', binaryName),
    ];
    for (const cand of devCandidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    return null;
  }

  public spawn(): void {
    if (this.proc) {
      throw new Error('Worker process is already running.');
    }

    this.parser.reset();

    const standaloneBinary = WorkerProcess.resolveStandaloneWorkerExecutable();
    let isPackaged = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron');
      if (electron?.app?.isPackaged) {
        isPackaged = true;
      }
    } catch {
      // ignore outside Electron
    }

    // In packaged application, prefer standalone bundled binary.
    // In development mode, prefer Python source unless DROPZONE_FORCE_STANDALONE is explicitly set.
    const preferStandalone = isPackaged || process.env.DROPZONE_FORCE_STANDALONE === 'true';

    const baseEnv = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONUNBUFFERED: '1',
    };

    if (standaloneBinary && preferStandalone) {
      try {
        this.proc = spawn(standaloneBinary, [], {
          cwd: path.dirname(standaloneBinary),
          env: baseEnv,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        if (err?.code === 'UNKNOWN' || err?.errno === -4094 || err?.message?.includes('spawn')) {
          console.warn(`[WorkerProcess] Standalone worker execution blocked by OS security policy (${err.message}). Attempting Python interpreter fallback...`);
          const workerRoot = WorkerProcess.resolveWorkerRoot(this.options.workerRoot);
          const pythonExecutable = WorkerProcess.resolvePythonExecutable(this.options.customPythonPath, workerRoot);
          const workerSrc = path.join(workerRoot, 'src');
          if (fs.existsSync(workerSrc)) {
            const env = {
              ...baseEnv,
              PYTHONPATH: workerSrc,
            };
            this.proc = spawn(pythonExecutable, ['-m', 'dropzone_worker'], {
              cwd: workerSrc,
              env,
              shell: false,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    } else {
      if (isPackaged && !process.env.DROPZONE_ALLOW_GLOBAL_PYTHON) {
        throw new Error(
          'Packaged DROPZONE background worker binary (dropzone-worker.exe) was not found in application resources. Please reinstall DROPZONE.'
        );
      }

      const workerRoot = WorkerProcess.resolveWorkerRoot(this.options.workerRoot);
      const pythonExecutable = WorkerProcess.resolvePythonExecutable(this.options.customPythonPath, workerRoot);
      const workerSrc = path.join(workerRoot, 'src');

      const env = {
        ...baseEnv,
        PYTHONPATH: workerSrc,
      };

      this.proc = spawn(pythonExecutable, ['-m', 'dropzone_worker'], {
        cwd: workerSrc,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

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

