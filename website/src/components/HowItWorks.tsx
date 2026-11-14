import React from 'react';
import { ArrowRight, Link2, SlidersHorizontal, FolderCheck } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Paste & Inspect',
    icon: Link2,
    description:
      'Paste any URL from YouTube, Vimeo, direct HTTP servers, or playlists into the search bar. DROPZONE probes the manifest in seconds, presenting every available video resolution, audio bitrate, and container format.',
    code: 'dropzone.inspect("https://...") -> 4K | 1080p | 720p | MP3',
  },
  {
    step: '02',
    title: 'Queue & Govern',
    icon: SlidersHorizontal,
    description:
      'Add items to the active queue with your desired concurrency limit. DROPZONE safely reserves unique filenames, manages HTTP Range requests, and automatically handles server rate limits (429) with exponential backoff.',
    code: 'concurrency: 3 · backoff: auto · unique_dest: true',
  },
  {
    step: '03',
    title: 'Convert & Access',
    icon: FolderCheck,
    description:
      'Audio conversions, stream merges, and post-processing finish seamlessly via background FFmpeg workers. Reveal your finished files directly in Windows File Explorer or revisit your durable history anytime.',
    code: 'status: COMPLETED · %APPDATA%/DROPZONE/dropzone.db',
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-brand-surface/20 border-t border-brand-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-brand-lime mb-4">
            STREAMLINED WORKFLOW
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-brand-white tracking-tight">
            From URL to file in <span className="text-brand-lime">three clean steps</span>.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-brand-grey font-normal">
            No endless advertising redirects, no unwanted toolbars, and no intrusive popups. Just a
            direct line from the web to your local storage.
          </p>
        </div>

        {/* 3 Step Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative p-8 rounded-2xl bg-brand-surface/50 border border-brand-border/70 hover:border-brand-lime/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-extrabold text-brand-lime/20 font-mono">
                      {item.step}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-brand-card border border-brand-border flex items-center justify-center text-brand-lime">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-brand-white mb-3">{item.title}</h3>
                  <p className="text-sm text-brand-grey leading-relaxed mb-6 font-normal">
                    {item.description}
                  </p>
                </div>

                {/* Micro Terminal Snippet */}
                <div className="p-3 rounded-lg bg-brand-black/70 border border-brand-border/60 text-[11px] font-mono text-brand-white/80 overflow-x-auto whitespace-nowrap">
                  <span className="text-brand-lime mr-2">$</span>
                  {item.code}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
