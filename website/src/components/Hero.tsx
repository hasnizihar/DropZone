import React from 'react';
import { Download, Shield, Cpu, HardDrive, Terminal } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { CURRENT_RELEASE } from '../data/releases';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Subtle background glow effect using brand tokens */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-lime/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Release Tag Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs text-brand-white mb-8 hover:border-brand-lime/40 transition-colors">
          <span className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
          <span className="font-semibold text-brand-lime">{CURRENT_RELEASE.tag}</span>
          <span className="text-brand-grey">·</span>
          <span>Public Pre-Release</span>
          <span className="text-brand-grey">·</span>
          <span className="text-brand-grey">MIT License</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-brand-white max-w-4xl mx-auto leading-[1.1]">
          Your downloads.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-lime via-white to-brand-lime">
            One place.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-brand-grey max-w-2xl mx-auto leading-relaxed font-normal">
          A high-contrast, local-first desktop download manager for Windows. Inspect video streams,
          download high-throughput files, convert audio, and batch process queues with{' '}
          <strong className="text-brand-white font-medium">zero telemetry</strong>.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={CURRENT_RELEASE.latestReleaseUrl}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-sm font-semibold text-brand-black bg-brand-lime hover:bg-[#e0ff80] transition-all duration-200 shadow-lg shadow-brand-lime/10 hover:shadow-brand-lime/20 hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-brand-black" />
            <span>Download for Windows</span>
            <span className="text-xs px-2 py-0.5 rounded bg-brand-black/15 font-mono">
              x64 (.exe)
            </span>
          </a>

          <a
            href={CURRENT_RELEASE.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-medium text-brand-white bg-brand-surface border border-brand-border hover:border-brand-grey/60 hover:bg-brand-card transition-all duration-200"
          >
            <GithubIcon className="w-4 h-4 text-brand-grey" />
            <span>Star on GitHub</span>
          </a>
        </div>

        {/* Specifications Strip */}
        <div className="mt-12 pt-8 border-t border-brand-border/40 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-surface/40 border border-brand-border/40">
            <Cpu className="w-5 h-5 text-brand-lime shrink-0" />
            <div>
              <div className="text-xs font-semibold text-brand-white">Windows 10 / 11</div>
              <div className="text-[11px] text-brand-grey">64-bit Architecture</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-surface/40 border border-brand-border/40">
            <Terminal className="w-5 h-5 text-brand-lime shrink-0" />
            <div>
              <div className="text-xs font-semibold text-brand-white">Dual Engine</div>
              <div className="text-[11px] text-brand-grey">yt-dlp & Direct HTTP</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-surface/40 border border-brand-border/40">
            <Shield className="w-5 h-5 text-brand-lime shrink-0" />
            <div>
              <div className="text-xs font-semibold text-brand-white">Zero Telemetry</div>
              <div className="text-[11px] text-brand-grey">No Cloud Tracking</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-surface/40 border border-brand-border/40">
            <HardDrive className="w-5 h-5 text-brand-lime shrink-0" />
            <div>
              <div className="text-xs font-semibold text-brand-white">SQLite WASM</div>
              <div className="text-[11px] text-brand-grey">Local Persistence</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
