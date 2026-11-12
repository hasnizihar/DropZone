import React, { useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  Folder,
  FileCheck,
  RotateCcw,
  Trash2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const HistoryPage: React.FC = () => {
  const jobs = useAppStore((state) => state.jobs);
  const openFolder = useAppStore((state) => state.openFolder);
  const openPath = useAppStore((state) => state.openPath);
  const removeJob = useAppStore((state) => state.removeJob);
  const retryJob = useAppStore((state) => state.retryJob);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const historyItems = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || job.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-white">Download History</h1>
          <p className="text-xs text-brand-grey">
            Audit logs and records of all captured media and downloaded files.
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-grey">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, domain, or URL..."
            className="w-full bg-brand-surface border border-brand-border rounded-lg pl-9 pr-4 py-2.5 text-xs text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 text-xs text-brand-white focus:outline-none focus:border-brand-lime"
        >
          <option value="all">All Categories</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
          <option value="file">Files & Docs</option>
        </select>
      </div>

      {/* History Table */}
      {historyItems.length === 0 ? (
        <div className="text-center py-20 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <HistoryIcon className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">No History Records Found</h3>
          <p className="text-xs text-brand-grey">
            Downloads you finish or cancel will appear in this persistent archive.
          </p>
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-border text-[11px] font-semibold text-brand-grey uppercase tracking-wider bg-brand-black/40">
                <th className="py-3 px-4">Title & Source</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-xs">
              {historyItems.map((item) => (
                <tr key={item.id} className="hover:bg-brand-hover/40 transition-colors">
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-semibold text-brand-white truncate">{item.title}</div>
                    <div className="text-[11px] text-brand-grey font-mono truncate">{item.url}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-brand-grey whitespace-nowrap">
                    {formatBytes(item.downloadedBytes || item.totalBytes)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        item.status === 'completed'
                          ? 'bg-brand-lime/10 text-brand-lime border-brand-lime/30'
                          : 'bg-brand-black text-brand-grey border-brand-border'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-brand-grey whitespace-nowrap font-mono text-[11px]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      {item.outputPath && (
                        <>
                          <button
                            onClick={() => openPath(item.outputPath!)}
                            className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-brand-white transition-colors"
                            title="Open File"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openFolder(item.outputPath!)}
                            className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-brand-white transition-colors"
                            title="Open Containing Folder"
                          >
                            <Folder className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => retryJob(item.id)}
                        className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-brand-lime transition-colors"
                        title="Re-download"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeJob(item.id)}
                        className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-red-400 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

