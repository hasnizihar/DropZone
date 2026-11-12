import React, { useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  Folder,
  FileCheck,
  RotateCcw,
  Trash2,
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  FileX,
  Sparkles,
  Layers,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
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
  const historyItems = useAppStore((state) => state.historyItems);
  const totalCount = useAppStore((state) => state.historyTotalCount);
  const page = useAppStore((state) => state.historyPage);
  const totalPages = useAppStore((state) => state.historyTotalPages);
  const searchTerm = useAppStore((state) => state.historySearchTerm);
  const categoryFilter = useAppStore((state) => state.historyCategoryFilter);
  const statusFilter = useAppStore((state) => state.historyStatusFilter);
  const isLoading = useAppStore((state) => state.isHistoryLoading);

  const setHistoryPage = useAppStore((state) => state.setHistoryPage);
  const setHistorySearchTerm = useAppStore((state) => state.setHistorySearchTerm);
  const setHistoryCategoryFilter = useAppStore((state) => state.setHistoryCategoryFilter);
  const setHistoryStatusFilter = useAppStore((state) => state.setHistoryStatusFilter);
  const removeHistoryItem = useAppStore((state) => state.removeHistoryItem);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const deleteDownloadedFile = useAppStore((state) => state.deleteDownloadedFile);
  const openFolder = useAppStore((state) => state.openFolder);
  const openPath = useAppStore((state) => state.openPath);
  const retryJob = useAppStore((state) => state.retryJob);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [deleteFileConfirmJobId, setDeleteFileConfirmJobId] = useState<string | null>(null);

  const handleClearHistory = async () => {
    await clearHistory();
    setConfirmClearOpen(false);
  };

  const handleDeleteFile = async (jobId: string) => {
    await deleteDownloadedFile(jobId);
    setDeleteFileConfirmJobId(null);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'video':
        return <Film className="w-3.5 h-3.5 text-sky-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-amber-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />;
      case 'batch':
      case 'playlist':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-brand-grey" />;
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-white flex items-center space-x-2.5">
            <HistoryIcon className="w-6 h-6 text-brand-lime" />
            <span>Download History</span>
          </h1>
          <p className="text-xs text-brand-grey mt-0.5">
            Durable SQLite records of all captured media, conversions, and completed files.
          </p>
        </div>

        {totalCount > 0 && (
          <button
            onClick={() => setConfirmClearOpen(true)}
            className="px-3.5 py-1.5 bg-brand-surface border border-brand-border hover:border-red-500/50 hover:bg-red-500/10 text-xs text-brand-grey hover:text-red-400 rounded-lg flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Clear History */}
      {confirmClearOpen && (
        <div className="bg-brand-surface border border-amber-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-brand-white">Clear All History Records?</div>
              <div className="text-[11px] text-brand-grey">
                This removes all completed, failed, and cancelled records from the database. Downloaded files on disk will NOT be deleted.
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <button
              onClick={() => setConfirmClearOpen(false)}
              className="px-3 py-1 bg-brand-black border border-brand-border text-brand-grey hover:text-brand-white rounded text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearHistory}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded text-xs transition-colors"
            >
              Confirm Clear
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-grey">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setHistorySearchTerm(e.target.value)}
            placeholder="Search persistent history by title, filename, or URL..."
            className="w-full bg-brand-surface border border-brand-border rounded-lg pl-9 pr-9 py-2.5 text-xs text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime"
          />
          {searchTerm && (
            <button
              onClick={() => setHistorySearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-grey hover:text-brand-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setHistoryCategoryFilter(e.target.value)}
          className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 text-xs text-brand-white focus:outline-none focus:border-brand-lime cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
          <option value="image">Images</option>
          <option value="file">Files & Docs</option>
          <option value="playlist">Playlists</option>
          <option value="batch">Batch Jobs</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setHistoryStatusFilter(e.target.value)}
          className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 text-xs text-brand-white focus:outline-none focus:border-brand-lime cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed / Interrupted</option>
          <option value="cancelled">Cancelled</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* History Table */}
      {historyItems.length === 0 ? (
        <div className="text-center py-20 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <HistoryIcon className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">
            {isLoading ? 'Querying SQLite Records...' : 'No History Records Found'}
          </h3>
          <p className="text-xs text-brand-grey max-w-sm mx-auto">
            {isLoading
              ? 'Loading durable history from disk...'
              : searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'No downloads match your active search filter.'
              : 'Completed, failed, and cancelled downloads are automatically saved to your local SQLite database.'}
          </p>
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-border text-[11px] font-semibold text-brand-grey uppercase tracking-wider bg-brand-black/40">
                <th className="py-3 px-4">Title & Source</th>
                <th className="py-3 px-4">Type</th>
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
                    <div className="flex items-center space-x-2">
                      <span className="shrink-0">{getCategoryIcon(item.category)}</span>
                      <span className="font-semibold text-brand-white truncate">{item.title}</span>
                    </div>
                    <div className="text-[11px] text-brand-grey font-mono truncate pl-5">
                      {item.url}
                    </div>
                    {item.postProcess && (
                      <div className="pl-5 text-[10px] text-brand-lime/80 font-mono flex items-center space-x-1 mt-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>FX: {item.postProcess.action} ({item.postProcess.audioFormat || item.postProcess.remuxContainer})</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-brand-grey font-mono text-[11px] uppercase">
                    {item.engine}
                  </td>
                  <td className="py-3 px-4 font-mono text-brand-grey whitespace-nowrap">
                    {formatBytes(item.downloadedBytes || item.totalBytes)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                        item.status === 'completed'
                          ? 'bg-brand-lime/10 text-brand-lime border-brand-lime/30'
                          : item.status === 'failed'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : item.status === 'processing'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-brand-black text-brand-grey border-brand-border'
                      }`}
                      title={item.error ? `${item.error.code}: ${item.error.message}` : undefined}
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
                        title="Re-download / Retry"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeHistoryItem(item.id)}
                        className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-amber-400 transition-colors"
                        title="Remove Record (Keeps file)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {item.outputPath && (
                        <button
                          onClick={() => setDeleteFileConfirmJobId(item.id)}
                          className="p-1.5 rounded hover:bg-brand-black text-brand-grey hover:text-red-400 transition-colors"
                          title="Delete Downloaded File"
                        >
                          <FileX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inline Delete File Confirmation */}
                    {deleteFileConfirmJobId === item.id && (
                      <div className="mt-2 bg-red-950/40 border border-red-500/40 rounded p-2 text-left flex items-center justify-between gap-2">
                        <span className="text-[10px] text-red-200">Delete physical file permanently?</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setDeleteFileConfirmJobId(null)}
                            className="px-2 py-0.5 bg-brand-black text-[10px] text-brand-grey rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteFile(item.id)}
                            className="px-2 py-0.5 bg-red-600 text-white font-bold text-[10px] rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="py-3 px-4 border-t border-brand-border bg-brand-black/20 flex items-center justify-between text-xs text-brand-grey font-mono">
              <div>
                Showing page {page} of {totalPages} ({totalCount} total records)
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setHistoryPage(page - 1)}
                  className="p-1.5 rounded bg-brand-surface border border-brand-border disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-lime text-brand-white transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-bold text-brand-white">{page}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setHistoryPage(page + 1)}
                  className="p-1.5 rounded bg-brand-surface border border-brand-border disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-lime text-brand-white transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
