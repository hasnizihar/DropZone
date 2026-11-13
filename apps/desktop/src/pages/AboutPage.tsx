import React from 'react';
import { Download, ShieldCheck, Heart, Terminal, Code2 } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const AboutPage: React.FC = () => {
  const systemInfo = useAppStore((state) => state.systemInfo);

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      {/* Brand Hero */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-brand-lime flex items-center justify-center text-brand-black mx-auto shadow-lg shadow-brand-lime/10">
          <Download className="w-9 h-9 stroke-[2.5]" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-wider text-brand-white">DROPZONE</h1>
          <p className="text-xs font-mono text-brand-lime mt-1">
            Universal Desktop Download Manager • Version {systemInfo?.version || '1.0.0'}
          </p>
        </div>

        <p className="text-sm text-brand-grey max-w-lg mx-auto leading-relaxed">
          Engineered for high-throughput, multi-engine downloading. DROPZONE pairs modern Chromium sandboxing and Electron architecture with high-performance Python streaming engines and FFmpeg post-processing.
        </p>
      </div>

      {/* System Specifications */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-grey flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-brand-lime" />
          <span>Runtime Environment & Architecture</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="bg-brand-black border border-brand-border rounded-lg p-3">
            <div className="text-[10px] text-brand-grey uppercase">Platform</div>
            <div className="text-brand-white font-bold capitalize mt-0.5">{systemInfo?.platform || 'Windows'}</div>
          </div>

          <div className="bg-brand-black border border-brand-border rounded-lg p-3">
            <div className="text-[10px] text-brand-grey uppercase">yt-dlp Core</div>
            <div className="text-brand-lime font-bold mt-0.5">{systemInfo?.engines?.ytdlp?.version || 'Embedded'}</div>
          </div>

          <div className="bg-brand-black border border-brand-border rounded-lg p-3">
            <div className="text-[10px] text-brand-grey uppercase">FFmpeg Suite</div>
            <div className="text-brand-lime font-bold mt-0.5">
              {systemInfo?.engines?.ffmpeg?.version ? 'v' + systemInfo.engines.ffmpeg.version.split('-')[0] : 'Ready'}
            </div>
          </div>

          <div className="bg-brand-black border border-brand-border rounded-lg p-3">
            <div className="text-[10px] text-brand-grey uppercase">Python Runtime</div>
            <div className="text-brand-white font-bold mt-0.5">{systemInfo?.engines?.python?.version || 'v3.12'}</div>
          </div>
        </div>
      </div>

      {/* Security & License */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-grey flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-brand-lime" />
          <span>Security & Local-First Philosophy</span>
        </h3>

        <p className="text-xs text-brand-grey leading-relaxed">
          DROPZONE executes entirely on your local machine with zero remote analytics, tracking, or cloud dependencies. Chromium renderer processes operate under strict context isolation and sandboxing.
        </p>

        <div className="pt-2 text-[11px] text-brand-grey border-t border-brand-border flex justify-between items-center">
          <span>Created by Hz Creatives (KR Hasni Zihar) • Open Source MIT License</span>
          <span className="font-mono text-brand-lime">#D4FF5C Edition</span>
        </div>
      </div>
    </div>
  );
};

