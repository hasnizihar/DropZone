import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Search,
  ListOrdered,
  Layers,
  History,
  Sliders,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface ShowcaseTab {
  id: string;
  name: string;
  icon: React.ElementType;
  image: string;
  title: string;
  description: string;
  features: string[];
}

const TABS: ShowcaseTab[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    image: '/screenshots/screenshot-dashboard.png',
    title: 'Command Dashboard & Instant Input',
    description:
      'Real-time status readouts for all core engines (yt-dlp, FFmpeg, Python worker), with a high-visibility quick-download bar and active queue summary.',
    features: [
      'Instant engine health status indicators',
      'One-click clipboard paste entry',
      'Recent download overview cards',
      'Fast single-link dispatch',
    ],
  },
  {
    id: 'analyzer',
    name: 'Stream Analyzer',
    icon: Search,
    image: '/screenshots/screenshot-analyzer.png',
    title: 'Deep Media & Stream Inspection',
    description:
      'Inspect streaming videos before downloading. Choose specific video resolutions, separate audio tracks, bitrates, and target containers on the fly.',
    features: [
      'Visual resolution badges (4K UHD, 1080p, 720p, etc.)',
      'Dedicated tabs for Video + Audio, Video Only, and Audio Only',
      'Real-time duration, codec, and estimated file size tags',
      'Target container selector (MP4, MKV, WebM)',
    ],
  },
  {
    id: 'queue',
    name: 'Download Queue',
    icon: ListOrdered,
    image: '/screenshots/screenshot-queue.png',
    title: 'High-Throughput Download Queue',
    description:
      'Active transfer indicators rendered in high-visibility Acid Lime (#D4FF5C). Track speeds in MB/s, downloaded bytes, and ETAs with instant pause, resume, or cancel.',
    features: [
      'Real-time transfer speed readouts in MB/s',
      'Accurate byte counters and dynamic ETA calculations',
      'Atomic pause and resume using HTTP range headers',
      'Individual and global concurrency controls',
    ],
  },
  {
    id: 'batch',
    name: 'Batch Downloader',
    icon: Layers,
    image: '/screenshots/screenshot-batch.png',
    title: 'Multi-URL & Playlist Ingestion',
    description:
      'Drop raw text, CSV files, or multi-line lists of links to ingest complete queues. Automatically parses and categorizes URLs into media, files, and image galleries.',
    features: [
      'Bulk text dropzone and file import support',
      'Automatic categorization into MEDIA, FILE, and IMAGE sets',
      'Playlist parsing up to 200 items with pagination',
      'Batch start, pause, and cancellation actions',
    ],
  },
  {
    id: 'history',
    name: 'SQLite History',
    icon: History,
    image: '/screenshots/screenshot-history.png',
    title: 'Durable Searchable History',
    description:
      'Every download is recorded in an embedded SQLite database (sql.js WASM) stored locally on your machine. Filter by status, search by filename, and reveal files in Explorer.',
    features: [
      'Local SQLite persistence surviving system restarts',
      'Search by filename, URL, or domain',
      'One-click "Open Folder" action in Windows Explorer',
      'Comprehensive completed, failed, and cancelled logs',
    ],
  },
  {
    id: 'settings',
    name: 'Preferences',
    icon: Sliders,
    image: '/screenshots/screenshot-settings.png',
    title: 'Engine Preferences & Audio Profiles',
    description:
      'Customize default download folders, active concurrency limits, default audio extraction formats (MP3/FLAC/M4A), bitrates, and FFmpeg configuration.',
    features: [
      'Concurrency governor slider (1 to 10 parallel jobs)',
      'Audio extraction quality selector (128 kbps to 320 kbps)',
      'Custom FFmpeg and FFprobe binary path discovery',
      'SQLite database maintenance and backup controls',
    ],
  },
  {
    id: 'about',
    name: 'About & Runtime',
    icon: Info,
    image: '/screenshots/screenshot-about.png',
    title: 'Open Source Transparency & Status',
    description:
      'View detailed build metadata, bundled companion worker runtime parameters, and full licensing notices with zero telemetry guarantees.',
    features: [
      'Authentic PE binary version and copyright metadata',
      'Bundled yt-dlp, gallery-dl, and Python runtime versions',
      'MIT open-source license attribution',
      'Official GitHub documentation and issues links',
    ],
  },
];

export const Showcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const current = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <section id="showcase" className="py-20 md:py-28 bg-brand-surface/30 border-y border-brand-border/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-brand-lime mb-4">
            GENUINE APPLICATION SHOWCASE
          </div>
          <h2 className="text-3xl sm:text-5xl font-bold text-brand-white tracking-tight">
            Designed for clarity.{' '}
            <span className="text-brand-lime">Built for power.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-brand-grey font-normal">
            No mockups or artificial renders. Inspect the real DROPZONE desktop interface across its
            core workflows.
          </p>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                  isActive
                    ? 'bg-brand-lime text-brand-black border-brand-lime font-semibold shadow-md shadow-brand-lime/10'
                    : 'bg-brand-surface text-brand-grey border-brand-border hover:border-brand-grey/60 hover:text-brand-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-black' : 'text-brand-grey'}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Main Display Window */}
        <div className="bg-brand-card/70 rounded-2xl border border-brand-border/80 shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Mock Window Titlebar */}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-black/60 border-b border-brand-border/60">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56]/80" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]/80" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F]/80" />
              <span className="ml-3 text-xs font-mono text-brand-grey">
                DROPZONE Desktop · {current.title}
              </span>
            </div>
            <div className="text-[11px] font-mono text-brand-lime/80 hidden sm:block">
              1240 × 820 px · Near Black Dark Theme
            </div>
          </div>

          {/* Screenshot Display */}
          <div className="relative aspect-[16/10] bg-brand-black overflow-hidden flex items-center justify-center p-2 sm:p-4">
            <AnimatePresence mode="wait">
              <motion.img
                key={current.image}
                src={current.image}
                alt={current.title}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full object-contain rounded-lg shadow-lg"
              />
            </AnimatePresence>
          </div>

          {/* Contextual Feature Strip under image */}
          <div className="p-6 sm:p-8 bg-brand-surface/60 border-t border-brand-border/60">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-1">
                <h3 className="text-xl font-bold text-brand-white">{current.title}</h3>
                <p className="mt-2 text-sm text-brand-grey leading-relaxed">
                  {current.description}
                </p>
              </div>

              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {current.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-brand-black/40 border border-brand-border/50 text-xs text-brand-white"
                  >
                    <CheckCircle2 className="w-4 h-4 text-brand-lime shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

