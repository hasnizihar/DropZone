import React from 'react';
import { FileCode, CheckCircle, Scale, Shield, Users } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { CURRENT_RELEASE } from '../data/releases';

export const OpenSource: React.FC = () => {
  return (
    <section id="open-source" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-b from-brand-surface to-brand-card/60 p-8 sm:p-12 lg:p-16 rounded-3xl border border-brand-border/80 shadow-2xl relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-lime/5 rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-brand-lime mb-6">
                OPEN SOURCE & TRANSPARENT
              </div>

              <h2 className="text-3xl sm:text-5xl font-bold text-brand-white tracking-tight leading-tight">
                Built in public.{' '}
                <span className="text-brand-lime">Licensed under MIT.</span>
              </h2>

              <p className="mt-6 text-base sm:text-lg text-brand-grey leading-relaxed font-normal">
                DROPZONE was born out of frustration with modern download utilities that bundle
                cryptominers, adware, and cloud tracking. Every line of DROPZONE code is open,
                auditable, and community-driven.
              </p>

              {/* Guarantees List */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-sm text-brand-white font-medium">
                  <CheckCircle className="w-4 h-4 text-brand-lime shrink-0" />
                  <span>100% Free & Open Source</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-brand-white font-medium">
                  <CheckCircle className="w-4 h-4 text-brand-lime shrink-0" />
                  <span>Zero Adware or Bundled Bloat</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-brand-white font-medium">
                  <CheckCircle className="w-4 h-4 text-brand-lime shrink-0" />
                  <span>Zero Cloud Analytics / Tracking</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-brand-white font-medium">
                  <CheckCircle className="w-4 h-4 text-brand-lime shrink-0" />
                  <span>Audited GPL Isolation Boundaries</span>
                </div>
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href={CURRENT_RELEASE.githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold text-brand-black bg-brand-lime hover:bg-[#e0ff80] transition-colors shadow-sm"
                >
                  <GithubIcon className="w-4 h-4 text-brand-black" />
                  <span>View Repository on GitHub</span>
                </a>

                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium text-brand-white bg-brand-surface border border-brand-border hover:border-brand-grey/60 transition-colors"
                >
                  <Users className="w-4 h-4 text-brand-grey" />
                  <span>Contribute</span>
                </a>
              </div>
            </div>

            {/* Right Architecture / Metadata Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl bg-brand-black/70 border border-brand-border/60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-brand-lime" />
                    <span className="font-semibold text-sm text-brand-white">MIT License</span>
                  </div>
                  <span className="text-xs font-mono text-brand-grey">Permissive</span>
                </div>
                <p className="text-xs text-brand-grey leading-relaxed">
                  Copyright © 2026 Hz Creatives (KR Hasni Zihar). Free for personal and commercial
                  use, modification, and distribution.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-brand-black/70 border border-brand-border/60">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <FileCode className="w-5 h-5 text-brand-lime" />
                    <span className="font-semibold text-sm text-brand-white">Technical Stack</span>
                  </div>
                  <span className="text-xs font-mono text-brand-grey">Monorepo</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-white">
                    Electron 34
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-white">
                    React 18 + Vite
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-white">
                    Python 3.12 (yt-dlp)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-white">
                    SQLite WASM (sql.js)
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-brand-surface border border-brand-border text-brand-white">
                    Tailwind CSS
                  </span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-brand-black/70 border border-brand-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-brand-lime" />
                    <span className="font-semibold text-sm text-brand-white">Responsible Use</span>
                  </div>
                  <span className="text-xs font-mono text-brand-lime">Compliant</span>
                </div>
                <p className="text-xs text-brand-grey leading-relaxed">
                  Engineered to respect server range requests, HTTP 429 Retry-After rate limits, and
                  maintain explicit subprocess boundaries for all GPL companion components.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
