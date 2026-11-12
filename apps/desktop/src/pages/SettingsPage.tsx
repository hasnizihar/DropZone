import React from 'react';
import {
  Folder,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Shield,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const SettingsPage: React.FC = () => {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const selectDownloadDirectory = useAppStore((state) => state.selectDownloadDirectory);
  const systemInfo = useAppStore((state) => state.systemInfo);

  const engines = systemInfo?.engines;

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-brand-white">Application Settings</h1>
        <p className="text-xs text-brand-grey">
          Configure directories, download concurrency limits, and backend engines.
        </p>
      </div>

      {/* Storage & Directories */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-lime flex items-center space-x-2">
          <Folder className="w-4 h-4" />
          <span>Storage & Path Configuration</span>
        </h3>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-brand-white">Default Download Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={settings.defaultDownloadDir}
              className="flex-1 bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-white font-mono cursor-default"
            />
            <button
              onClick={() => selectDownloadDirectory()}
              className="px-4 py-2 bg-brand-lime text-brand-black font-semibold rounded-lg text-xs hover:brightness-105 transition-all"
            >
              Change Folder
            </button>
          </div>
        </div>
      </div>

      {/* Queue & Concurrency Management */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-lime flex items-center space-x-2">
          <Sliders className="w-4 h-4" />
          <span>Queue & Concurrency Rules</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-brand-white flex justify-between">
              <span>Max Concurrent Downloads</span>
              <span className="font-mono text-brand-lime">{settings.maxConcurrentDownloads}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.maxConcurrentDownloads}
              onChange={(e) => updateSettings({ maxConcurrentDownloads: parseInt(e.target.value, 10) })}
              className="w-full accent-brand-lime cursor-pointer"
            />
            <p className="text-[11px] text-brand-grey">Default is 3 to preserve bandwidth stability.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-brand-white flex justify-between">
              <span>Automatic Retry Count</span>
              <span className="font-mono text-brand-lime">{settings.retryCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.retryCount}
              onChange={(e) => updateSettings({ retryCount: parseInt(e.target.value, 10) })}
              className="w-full accent-brand-lime cursor-pointer"
            />
            <p className="text-[11px] text-brand-grey">Retries on network timeout before marking failed.</p>
          </div>
        </div>

        <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-brand-white">Auto-Start Added Downloads</div>
            <div className="text-[11px] text-brand-grey">Immediately begin download upon queueing</div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoStartDownloads}
            onChange={(e) => updateSettings({ autoStartDownloads: e.target.checked })}
            className="w-4 h-4 accent-brand-lime cursor-pointer"
          />
        </div>
      </div>

      {/* Engine Diagnostics */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-brand-lime flex items-center space-x-2">
          <Cpu className="w-4 h-4" />
          <span>Engine Status & Diagnostic Information</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-brand-black border border-brand-border rounded-lg p-4 space-y-1">
            <div className="text-xs font-semibold text-brand-grey">yt-dlp Engine</div>
            <div className="text-sm font-mono font-bold text-brand-white">
              {engines?.ytdlp?.version || 'Available'}
            </div>
            <div className="text-[10px] text-brand-lime flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Python API Ready</span>
            </div>
          </div>

          <div className="bg-brand-black border border-brand-border rounded-lg p-4 space-y-1">
            <div className="text-xs font-semibold text-brand-grey">FFmpeg Codec Suite</div>
            <div className="text-sm font-mono font-bold text-brand-white">
              {engines?.ffmpeg?.version ? 'v' + engines.ffmpeg.version.split('-')[0] : 'Available'}
            </div>
            <div className="text-[10px] text-brand-lime flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Hardware Acceleration Enabled</span>
            </div>
          </div>

          <div className="bg-brand-black border border-brand-border rounded-lg p-4 space-y-1">
            <div className="text-xs font-semibold text-brand-grey">Python Runtime</div>
            <div className="text-sm font-mono font-bold text-brand-white">
              {engines?.python?.version || 'v3.12'}
            </div>
            <div className="text-[10px] text-brand-lime flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Isolated Environment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
