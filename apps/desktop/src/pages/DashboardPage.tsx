import React, { useState } from 'react';
import {
  Download,
  Search,
  CheckCircle2,
  HardDrive,
  Cpu,
  Video,
  Music,
  Image as ImageIcon,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const DashboardPage: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const inspectUrl = useAppStore((state) => state.inspectUrl);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const isAnalyzing = useAppStore((state) => state.isAnalyzing);
  const jobs = useAppStore((state) => state.jobs);
  const systemInfo = useAppStore((state) => state.systemInfo);

  const activeJobs = jobs.filter(
    (j) => j.status === 'downloading' || j.status === 'pending'
  );
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const totalBytesDownloaded = jobs.reduce((acc, j) => acc + (j.downloadedBytes || 0), 0);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const success = await inspectUrl(inputUrl.trim());
    if (success) {
      setActiveTab('analyzer');
    }
  };

  const categories = [
    { name: 'Videos', icon: Video, desc: 'YouTube, TikTok, Reddit, Direct' },
    { name: 'Audio', icon: Music, desc: 'MP3, M4A, FLAC, Audio streams' },
    { name: 'Images', icon: ImageIcon, desc: 'Galleries, High-Res Photos' },
    { name: 'Files', icon: FileText, desc: 'Direct HTTP/HTTPS Archives & Docs' },
    { name: 'Batch', icon: Layers, desc: 'Multi-URL Bulk Ingestion' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      {/* Hero / Quick Input Section */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-brand-white mb-2">
          Universal Downloader
        </h1>
        <p className="text-sm text-brand-grey mb-6">
          Paste any supported media or file URL to automatically analyze formats, extract streams, and download.
        </p>

        <form onSubmit={handleAnalyze} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-grey">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste URL here (e.g. https://www.youtube.com/watch?v=... or direct file link)"
              className="w-full bg-brand-black border border-brand-border rounded-lg pl-10 pr-4 py-3 text-sm text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !inputUrl.trim()}
            className="px-6 py-3 bg-brand-lime text-brand-black rounded-lg font-semibold text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center space-x-2"
          >
            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze URL'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Supported content badges */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="bg-brand-black/50 border border-brand-border/60 rounded-lg p-3 flex flex-col justify-between"
              >
                <div className="flex items-center space-x-2 text-brand-lime mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold text-brand-white">{cat.name}</span>
                </div>
                <span className="text-[11px] text-brand-grey leading-tight">{cat.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <div className="flex items-center justify-between text-brand-grey mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Jobs</span>
            <Download className="w-4 h-4 text-brand-lime" />
          </div>
          <div className="text-2xl font-bold font-mono text-brand-white">
            {activeJobs.length}
          </div>
          <div className="text-xs text-brand-grey mt-1">Currently downloading or queued</div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <div className="flex items-center justify-between text-brand-grey mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-brand-lime" />
          </div>
          <div className="text-2xl font-bold font-mono text-brand-white">
            {completedJobs.length}
          </div>
          <div className="text-xs text-brand-grey mt-1">Finished downloads</div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <div className="flex items-center justify-between text-brand-grey mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Downloaded</span>
            <HardDrive className="w-4 h-4 text-brand-lime" />
          </div>
          <div className="text-2xl font-bold font-mono text-brand-white">
            {formatBytes(totalBytesDownloaded)}
          </div>
          <div className="text-xs text-brand-grey mt-1">Bandwidth processed</div>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
          <div className="flex items-center justify-between text-brand-grey mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Engines Status</span>
            <Cpu className="w-4 h-4 text-brand-lime" />
          </div>
          <div className="text-sm font-bold font-mono text-brand-white flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-lime inline-block" />
            <span>Engines Operational</span>
          </div>
          <div className="text-xs text-brand-grey mt-1 truncate">
            yt-dlp {systemInfo?.engines?.ytdlp?.version || 'Ready'} / FFmpeg
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-brand-white">Recent Downloads</h2>
          <button
            onClick={() => setActiveTab('downloads')}
            className="text-xs font-semibold text-brand-lime hover:underline flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-brand-border rounded-lg">
            <Download className="w-8 h-8 text-brand-grey mx-auto mb-2 opacity-50" />
            <p className="text-sm text-brand-grey">No downloads yet. Submit a URL above to start.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden pr-4">
                  <div className="w-8 h-8 rounded bg-brand-black border border-brand-border flex items-center justify-center flex-shrink-0 text-brand-lime">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-sm font-medium text-brand-white truncate">{job.title}</div>
                    <div className="text-xs text-brand-grey flex items-center space-x-2">
                      <span className="uppercase font-mono text-[10px] bg-brand-black px-1.5 py-0.5 rounded border border-brand-border">
                        {job.source}
                      </span>
                      <span>•</span>
                      <span>{job.status}</span>
                      <span>•</span>
                      <span>{job.progress.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-mono text-[11px] ${
                      job.status === 'completed'
                        ? 'bg-brand-lime/10 text-brand-lime border border-brand-lime/30'
                        : job.status === 'downloading'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : 'bg-brand-black text-brand-grey border border-brand-border'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

