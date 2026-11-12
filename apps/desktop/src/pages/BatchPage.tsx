import React, { useState } from 'react';
import {
  Layers,
  FileUp,
  Play,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Folder,
  RefreshCw,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  Video,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { parseBatchUrls } from '@dropzone/shared';

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const BatchPage: React.FC = () => {
  const [urlText, setUrlText] = useState('');
  const [customBatchTitle, setCustomBatchTitle] = useState('');
  const [batchTargetDir, setBatchTargetDir] = useState('');
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const batchItems = useAppStore((state) => state.batchItems);
  const isAnalyzingBatch = useAppStore((state) => state.isAnalyzingBatch);
  const setBatchItems = useAppStore((state) => state.setBatchItems);
  const updateBatchItem = useAppStore((state) => state.updateBatchItem);
  const toggleBatchItem = useAppStore((state) => state.toggleBatchItem);
  const selectAllBatchItems = useAppStore((state) => state.selectAllBatchItems);
  const removeBatchItem = useAppStore((state) => state.removeBatchItem);
  const inspectBatch = useAppStore((state) => state.inspectBatch);
  const inspectUrl = useAppStore((state) => state.inspectUrl);
  const startBatch = useAppStore((state) => state.startBatch);
  const selectDownloadDirectory = useAppStore((state) => state.selectDownloadDirectory);
  const settings = useAppStore((state) => state.settings);
  const showToast = useAppStore((state) => state.showToast);

  const parsed = parseBatchUrls(urlText, 50);

  const handleTextChange = (text: string) => {
    setUrlText(text);
    const res = parseBatchUrls(text, 50);
    setParseWarning(res.warning || null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleTextChange(content);
        const res = parseBatchUrls(content, 50);
        showToast(`Loaded ${res.urls.length} URLs from file`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleStartAnalysis = async () => {
    if (parsed.urls.length === 0) {
      showToast('Please enter at least one valid HTTP/HTTPS URL.', 'error');
      return;
    }
    await inspectBatch(parsed.urls);
  };

  const handleSelectFolder = async () => {
    const chosen = await selectDownloadDirectory();
    if (chosen) {
      setBatchTargetDir(chosen);
    }
  };

  const handleRetrySingle = async (itemId: string, itemUrl: string) => {
    updateBatchItem(itemId, { status: 'analyzing', error: undefined });
    try {
      const win = window.dropzone;
      if (win) {
        const res = await win.inspectUrl(itemUrl);
        if (res.success && res.data) {
          updateBatchItem(itemId, {
            status: 'ready',
            title: res.data.title,
            downloadType: res.data.category === 'playlist' ? 'playlist' : res.data.engine === 'image-gallery' ? 'gallery' : res.data.category === 'image' ? 'image' : res.data.engine === 'direct-http' ? 'file' : 'media',
            selected: true,
            error: undefined,
          });
          showToast(`Re-inspected: ${res.data.title}`, 'success');
        } else {
          updateBatchItem(itemId, {
            status: 'failed',
            error: res.error || 'Failed to inspect',
            selected: false,
          });
        }
      }
    } catch (e: any) {
      updateBatchItem(itemId, {
        status: 'failed',
        error: e.message || 'Inspection error',
        selected: false,
      });
    }
  };

  const handleEnqueueBatch = async () => {
    const ok = await startBatch({
      targetDirectory: batchTargetDir || settings.defaultDownloadDir,
      title: customBatchTitle.trim() || undefined,
    });
    if (ok) {
      setUrlText('');
      setBatchItems([]);
    }
  };

  const readyItems = batchItems.filter((i) => i.status === 'ready');
  const selectedReadyItems = readyItems.filter((i) => i.selected);
  const failedItems = batchItems.filter((i) => i.status === 'failed' || i.status === 'unsupported');

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'playlist':
        return { label: 'PLAYLIST', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'gallery':
        return { label: 'GALLERY', color: 'bg-brand-lime text-brand-black' };
      case 'image':
        return { label: 'IMAGE', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'file':
        return { label: 'FILE', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      default:
        return { label: 'MEDIA', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-white flex items-center space-x-2">
          <Layers className="w-6 h-6 text-brand-lime" />
          <span>Batch Processing</span>
        </h1>
        <p className="text-xs text-brand-grey mt-1">
          Ingest, analyze, and queue multiple URLs independently across media, files, images, galleries, and playlists.
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-brand-grey uppercase tracking-wider flex items-center space-x-2">
            <span>Paste URL List (Up to 50 URLs)</span>
            {parsed.urls.length > 0 && (
              <span className="text-brand-lime font-mono font-bold lowercase">
                ({parsed.urls.length} recognized)
              </span>
            )}
          </label>
          <label className="cursor-pointer text-xs font-semibold text-brand-lime hover:underline flex items-center space-x-1.5">
            <FileUp className="w-3.5 h-3.5" />
            <span>Import from .txt / .csv</span>
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={6}
          value={urlText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`https://www.youtube.com/watch?v=...\nhttps://example.com/files/archive.zip\nhttps://example.com/images/photo.png\nhttps://vimeo.com/...`}
          className="w-full bg-brand-black border border-brand-border rounded-lg p-3 text-xs font-mono text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime"
        />

        {parseWarning && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>{parseWarning}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-1">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzingBatch || parsed.urls.length === 0}
              className="px-5 py-2.5 bg-brand-lime text-brand-black font-bold rounded-lg text-xs hover:brightness-105 active:scale-[0.98] transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isAnalyzingBatch ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
                  <span>Analyzing URLs...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Analyze {parsed.urls.length > 0 ? `${parsed.urls.length} URLs` : 'Batch'}</span>
                </>
              )}
            </button>

            {urlText.trim() && (
              <button
                onClick={() => {
                  setUrlText('');
                  setParseWarning(null);
                }}
                className="px-3 py-2 text-xs text-brand-grey hover:text-brand-white border border-brand-border rounded-lg"
              >
                Clear Text
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Batch Analysis Review Table */}
      {batchItems.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-5">
          {/* Summary & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
            <div className="flex items-center space-x-3">
              <h3 className="text-sm font-bold text-brand-white flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-brand-lime" />
                <span>Batch Review ({batchItems.length} items)</span>
              </h3>
              <div className="flex items-center space-x-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {readyItems.length} Ready
                </span>
                {failedItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    {failedItems.length} Failed
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => selectAllBatchItems(true)}
                className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-lime hover:text-brand-white transition-colors"
              >
                Select All Ready
              </button>
              <button
                onClick={() => selectAllBatchItems(false)}
                className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-grey hover:text-brand-white transition-colors"
              >
                Deselect All
              </button>
              <button
                onClick={() => setBatchItems([])}
                className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-red-400 hover:text-red-300 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Items Review List */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 divide-y divide-brand-border/40">
            {batchItems.map((item) => {
              const badge = getTypeBadge(item.downloadType);
              const isReady = item.status === 'ready';

              return (
                <div
                  key={item.id}
                  className={`pt-2 flex items-center justify-between p-3 rounded-lg border transition-all ${
                    item.selected && isReady
                      ? 'bg-brand-lime/5 border-brand-lime/30'
                      : 'bg-brand-black/30 border-brand-border/60 hover:border-brand-border'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-4">
                    {/* Selection Checkbox */}
                    <button
                      onClick={() => isReady && toggleBatchItem(item.id)}
                      disabled={!isReady}
                      className="flex-shrink-0 disabled:opacity-30"
                    >
                      {item.selected && isReady ? (
                        <CheckSquare className="w-4 h-4 text-brand-lime" />
                      ) : (
                        <Square className="w-4 h-4 text-brand-grey" />
                      )}
                    </button>

                    {/* Type Badge */}
                    <span
                      className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold border flex-shrink-0 ${badge.color}`}
                    >
                      {badge.label}
                    </span>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-brand-white truncate flex items-center space-x-2">
                        <span>{item.title || item.url}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-[10px] text-brand-grey mt-0.5">
                        <span className="font-mono text-brand-grey/80 truncate max-w-xs">{item.url}</span>
                        {item.fileSizeBytes ? (
                          <span className="font-mono text-brand-white">{formatBytes(item.fileSizeBytes)}</span>
                        ) : null}
                        {item.error && (
                          <span className="text-red-400 font-mono truncate max-w-sm">
                            {item.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                        item.status === 'ready'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : item.status === 'analyzing'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-red-500/10 text-red-400 border-red-500/30'
                      }`}
                    >
                      {item.status}
                    </span>

                    {item.status === 'failed' && (
                      <button
                        onClick={() => handleRetrySingle(item.id, item.url)}
                        className="p-1 rounded bg-brand-black border border-brand-border text-brand-lime hover:text-brand-white"
                        title="Retry Analysis"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => removeBatchItem(item.id)}
                      className="p-1 rounded bg-brand-black border border-brand-border text-brand-grey hover:text-red-400"
                      title="Remove Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enqueue Action Footer */}
          <div className="pt-4 border-t border-brand-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-grey uppercase tracking-wider mb-1.5">
                  Custom Batch Name (Optional)
                </label>
                <input
                  type="text"
                  value={customBatchTitle}
                  onChange={(e) => setCustomBatchTitle(e.target.value)}
                  placeholder={`Batch (${selectedReadyItems.length} downloads)`}
                  className="w-full bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-white focus:outline-none focus:border-brand-lime"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-grey uppercase tracking-wider mb-1.5">
                  Destination Directory
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={batchTargetDir || settings.defaultDownloadDir}
                    onChange={(e) => setBatchTargetDir(e.target.value)}
                    className="flex-1 bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-white font-mono focus:outline-none focus:border-brand-lime truncate"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs font-semibold text-brand-grey hover:text-brand-white flex items-center space-x-1 flex-shrink-0"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-brand-grey font-mono">
                {selectedReadyItems.length} of {readyItems.length} ready items selected
              </span>

              <button
                onClick={handleEnqueueBatch}
                disabled={selectedReadyItems.length === 0}
                className="px-6 py-2.5 bg-brand-lime text-brand-black font-bold rounded-lg text-xs hover:brightness-105 active:scale-[0.98] transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Enqueue {selectedReadyItems.length} Downloads</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
