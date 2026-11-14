import React from 'react';
import { FEATURES } from '../data/features';
import {
  Search,
  Zap,
  ShieldCheck,
  FolderArchive,
  Music,
  CheckCircle,
} from 'lucide-react';

const ICONS_MAP: Record<string, React.ElementType> = {
  'deep-analyzer': Search,
  'dual-engine': Zap,
  'local-first': ShieldCheck,
  'batch-downloader': FolderArchive,
  'audio-conversion': Music,
  'resilience': CheckCircle,
};

export const Features: React.FC = () => {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-brand-lime mb-4">
            ENGINEERED WITHOUT CHAOS
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-brand-white tracking-tight">
            Everything you need.{' '}
            <span className="text-brand-lime">Nothing you don't.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-brand-grey font-normal">
            Designed from first principles to replace bloated, ad-supported download utilities with
            a clean, robust desktop application.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const Icon = ICONS_MAP[feature.id] || Zap;
            return (
              <div
                key={feature.id}
                className="group p-6 sm:p-8 rounded-2xl bg-brand-surface/40 border border-brand-border/70 hover:border-brand-lime/40 transition-all duration-200 flex flex-col justify-between hover:bg-brand-surface/60"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-brand-card border border-brand-border flex items-center justify-center text-brand-lime group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-brand-card border border-brand-border text-brand-lime">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-brand-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-brand-grey leading-relaxed mb-6 font-normal">
                    {feature.description}
                  </p>
                </div>

                {/* Highlights List */}
                <div className="pt-4 border-t border-brand-border/50 space-y-2">
                  {feature.highlights.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-brand-white/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-lime shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
