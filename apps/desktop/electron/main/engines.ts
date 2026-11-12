import { exec } from 'child_process';
import { promisify } from 'util';
import type { EngineStatus, SystemEnginesReport } from '@dropzone/shared';

const execAsync = promisify(exec);

export async function detectPython(): Promise<EngineStatus> {
  try {
    const { stdout, stderr } = await execAsync('python --version');
    const versionOutput = (stdout || stderr).trim();
    const versionMatch = versionOutput.match(/Python\s+([0-9.]+)/i);
    return {
      name: 'Python',
      version: versionMatch ? versionMatch[1] : versionOutput,
      isAvailable: true,
    };
  } catch (err: any) {
    return {
      name: 'Python',
      version: null,
      isAvailable: false,
      error: err.message,
    };
  }
}

export async function detectYtDlp(): Promise<EngineStatus> {
  try {
    // Check python module yt_dlp directly
    const { stdout } = await execAsync('python -c "import yt_dlp.version; print(yt_dlp.version.__version__)"');
    const version = stdout.trim();
    if (version) {
      return {
        name: 'yt-dlp',
        version,
        isAvailable: true,
      };
    }
    return {
      name: 'yt-dlp',
      version: null,
      isAvailable: false,
      error: 'yt-dlp Python package not detected',
    };
  } catch (err: any) {
    return {
      name: 'yt-dlp',
      version: null,
      isAvailable: false,
      error: err.message,
    };
  }
}

export async function detectFfmpeg(): Promise<EngineStatus> {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    const versionMatch = stdout.match(/ffmpeg\s+version\s+([^\s]+)/i);
    return {
      name: 'FFmpeg',
      version: versionMatch ? versionMatch[1] : 'Installed',
      isAvailable: true,
    };
  } catch (err: any) {
    return {
      name: 'FFmpeg',
      version: null,
      isAvailable: false,
      error: err.message,
    };
  }
}

export async function getSystemEnginesReport(): Promise<SystemEnginesReport> {
  const [python, ytdlp, ffmpeg] = await Promise.all([
    detectPython(),
    detectYtDlp(),
    detectFfmpeg(),
  ]);

  return {
    python,
    ytdlp,
    ffmpeg,
    workerRunning: false, // Updated when worker process starts in Milestone 2
    timestamp: new Date().toISOString(),
  };
}

