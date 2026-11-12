import React, { useState } from 'react';
import {
  Download,
  Play,
  Pause,
  X,
  RotateCcw,
  Trash2,
  Folder,
  FileCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const DownloadsPage: React.FC = () => {
  const jobs = useAppStore((state) => state.jobs);
  const pauseJob = useAppStore((state) => state.pauseJob);
  const resumeJob = useAppStore((state) => state.resumeJob);
  const cancelJob = useAppStore((state) => state.cancelJob);
  const retryJob = useAppStore((state) => state.retryJob);
  const removeJob = useAppStore((state) => state.removeJob);
  const clearCompleted = useAppStore((state) => state.clearCompleted);
  const openFolder = useAppStore((state) => state.openFolder);

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'queued' | 'completed' | 'failed'>('all');

  const filteredJobs = jobs.filter((job) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return job.status === 'downloading';
    if (activeFilter === 'queued') return job.status === 'pending';
    if (activeFilter === 'completed') return job.status === 'completed';
    if (activeFilter === 'failed') return job.status === 'failed' || job.status === 'cancelled';
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-white">Download Queue</h1>
          <p className="text-xs text-brand-grey">
            Manage concurrent tasks, track real-time speeds, and control downloads.
          </p>
        </div>

        <button
          onClick={() => clearCompleted()}
          className="px-3.5 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs font-semibold text-brand-grey hover:text-brand-white hover:bg-brand-hover transition-colors flex items-center space-x-1.5 self-start"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Completed</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-brand-border space-x-2">
        {[
          { id: 'all', label: 'All Jobs', count: jobs.length },
          { id: 'active', label: 'Active', count: jobs.filter((j) => j.status === 'downloading').length },
          { id: 'queued', label: 'Queued', count: jobs.filter((j) => j.status === 'pending').length },
          { id: 'completed', label: 'Completed', count: jobs.filter((j) => j.status === 'completed').length },
          { id: 'failed', label: 'Failed', count: jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`pb-3 px-3 text-xs font-semibold transition-all relative flex items-center space-x-2 ${
              activeFilter === tab.id
                ? 'text-brand-lime font-bold'
                : 'text-brand-grey hover:text-brand-white'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilter === tab.id
                  ? 'bg-brand-lime text-brand-black font-bold'
                  : 'bg-brand-surface text-brand-grey'
              }`}
            >
              {tab.count}
            </span>
            {activeFilter === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-lime" />
            )}
          </button>
        ))}
      </div>

      {/* Downloads List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-24 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <Download className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">Queue is Empty</h3>
          <p className="text-xs text-brand-grey">
            No downloads match the current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-3 hover:border-brand-grey/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-black border border-brand-border text-brand-lime">
                      {job.source}
                    </span>
                    <span className="text-xs text-brand-grey font-mono">•</span>
                    <span className="text-xs font-semibold text-brand-grey uppercase">
                      {job.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-brand-white truncate">{job.title}</h4>
                </div>

                {/* Status Badge */}
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                    job.status === 'completed'
                      ? 'bg-brand-lime/10 text-brand-lime border-brand-lime/30'
                      : job.status === 'downloading'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : job.status === 'paused'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-brand-black text-brand-grey border-brand-border'
                  }`}
                >
                  {job.status}
                </span>
              </div>

              {/* Progress Bar (Acid Lime) */}
              <div className="space-y-1">
                <div className="w-full bg-brand-black h-2 rounded-full overflow-hidden border border-brand-border">
                  <div
                    className="h-full bg-brand-lime transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-brand-grey font-mono">
                  <span>{job.progress.toFixed(1)}%</span>
                  <div className="flex space-x-3">
                    {job.speedBytesPerSec > 0 && (
                      <span>{formatBytes(job.speedBytesPerSec)}/s</span>
                    )}
                    <span>
                      {formatBytes(job.downloadedBytes)} / {job.totalBytes ? formatBytes(job.totalBytes) : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-brand-border/60">
                <span className="text-[11px] text-brand-grey truncate max-w-sm">
                  {job.targetDirectory}
                </span>

                <div className="flex items-center space-x-1.5">
                  {job.status === 'downloading' && (
                    <button
                      onClick={() => pauseJob(job.id)}
                      className="p-1.5 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-brand-white transition-colors"
                      title="Pause"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {job.status === 'paused' && (
                    <button
                      onClick={() => resumeJob(job.id)}
                      className="p-1.5 rounded bg-brand-lime text-brand-black font-bold hover:brightness-105 transition-colors"
                      title="Resume"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {(job.status === 'failed' || job.status === 'cancelled') && (
                    <button
                      onClick={() => retryJob(job.id)}
                      className="p-1.5 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-brand-white transition-colors"
                      title="Retry"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {job.status !== 'completed' && (
                    <button
                      onClick={() => cancelJob(job.id)}
                      className="p-1.5 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-red-400 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {job.outputPath && (
                    <button
                      onClick={() => openFolder(job.outputPath!)}
                      className="p-1.5 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-brand-white transition-colors"
                      title="Show in Folder"
                    >
                      <Folder className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => removeJob(job.id)}
                    className="p-1.5 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-red-400 transition-colors"
                    title="Remove Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
