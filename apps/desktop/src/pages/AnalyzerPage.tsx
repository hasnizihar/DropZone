import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Plus,
  Clock,
  Folder,
  Check,
  Video,
  Music,
  ExternalLink,
  AlertCircle,
  X,
  FileVideo,
  Volume2,
  Calendar,
  Eye,
  ThumbsUp,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { MediaFormat } from '@dropzone/shared';

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatCount(count?: number | null): string {
  if (!count || count <= 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

type FormatFilter = 'all' | 'combined' | 'video' | 'audio';

export const AnalyzerPage: React.FC = () => {
  const analyzedMedia = useAppStore((state) => state.analyzedMedia);
  const analysisStatus = useAppStore((state) => state.analysisStatus);
  const selectedFormatId = useAppStore((state) => state.selectedFormatId);
  const setSelectedFormatId = useAppStore((state) => state.setSelectedFormatId);
  const isAnalyzing = useAppStore((state) => state.isAnalyzing);
  const analyzeError = useAppStore((state) => state.analyzeError);
  const analysisDurationMs = useAppStore((state) => state.analysisDurationMs);
  const inspectUrl = useAppStore((state) => state.inspectUrl);
  const resetAnalysis = useAppStore((state) => state.resetAnalysis);
  const addJob = useAppStore((state) => state.addJob);
  const settings = useAppStore((state) => state.settings);
  const selectDownloadDirectory = useAppStore((state) => state.selectDownloadDirectory);
  const showToast = useAppStore((state) => state.showToast);

  const [inputUrl, setInputUrl] = useState(analyzedMedia?.url || '');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [customFilename, setCustomFilename] = useState(analyzedMedia?.title || '');
  const [targetDir, setTargetDir] = useState(settings.defaultDownloadDir);

  // Sync state when new media is analyzed
  useEffect(() => {
    if (analyzedMedia) {
      setInputUrl(analyzedMedia.url);
      setCustomFilename(analyzedMedia.title);
    }
  }, [analyzedMedia]);

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    await inspectUrl(inputUrl.trim());
  };

  const handleClear = () => {
    setInputUrl('');
    setCustomFilename('');
    resetAnalysis();
  };

  const handleSelectFolder = async () => {
    const chosen = await selectDownloadDirectory();
    if (chosen) {
      setTargetDir(chosen);
    }
  };

  const handleQueueOrDownloadAction = (actionName: string) => {
    if (!analyzedMedia) return;
    showToast(
      `Format [${selectedFormatId || 'optimal'}] selected. Download queue & execution engine activates in Milestone 4.`,
      'info'
    );
  };

  const allFormats: MediaFormat[] = analyzedMedia?.formats || [];
  const filteredFormats = allFormats.filter((fmt) => {
    if (formatFilter === 'combined') return fmt.isCombined;
    if (formatFilter === 'video') return fmt.isVideo;
    if (formatFilter === 'audio') return fmt.isAudio;
    return true;
  });

  const selectedFormat = allFormats.find((f) => f.formatId === selectedFormatId) || allFormats[0];
  const metadata = analyzedMedia?.metadata;

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Search Header */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-brand-lime" />
            <h2 className="text-xl font-bold text-brand-white">Media & URL Inspector</h2>
          </div>
          {analysisDurationMs !== null && analysisStatus === 'completed' && (
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-brand-lime/10 border border-brand-lime/20 text-brand-lime flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Extracted in {analysisDurationMs}ms</span>
            </span>
          )}
        </div>
        <p className="text-xs text-brand-grey mb-4">
          Deep inspect video streams, audio codecs, containers, exact vs estimated sizes using Python yt-dlp.
        </p>

        <form onSubmit={handleInspect} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-grey">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste media link (e.g. YouTube, Vimeo, Reddit, direct HTTP)..."
              disabled={isAnalyzing}
              className="w-full bg-brand-black border border-brand-border rounded-lg pl-10 pr-10 py-3 text-sm text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime transition-colors disabled:opacity-50"
            />
            {inputUrl && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-grey hover:text-brand-white"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !inputUrl.trim()}
            className="px-6 py-3 bg-brand-lime text-brand-black rounded-lg font-semibold text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center space-x-2 flex-shrink-0"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
                <span>
                  {analysisStatus === 'validating' ? 'Validating...' : 'Extracting...'}
                </span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Inspect URL</span>
              </>
            )}
          </button>
        </form>

        {/* Status Alert */}
        {analyzeError && (
          <div className="mt-4 p-3.5 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start space-x-3 text-red-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-red-200">Extraction Error</div>
              <p className="leading-relaxed opacity-90">{analyzeError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Result Card */}
      {analyzedMedia ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-6">
          {/* Media Header & Metadata */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {analyzedMedia.thumbnail ? (
              <img
                src={analyzedMedia.thumbnail}
                alt="Media thumbnail"
                className="w-full md:w-64 h-40 object-cover rounded-lg border border-brand-border bg-brand-black flex-shrink-0"
              />
            ) : (
              <div className="w-full md:w-64 h-40 bg-brand-black rounded-lg border border-brand-border flex items-center justify-center text-brand-grey flex-shrink-0">
                <Video className="w-12 h-12 opacity-30 text-brand-lime" />
              </div>
            )}

            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded bg-brand-lime/10 text-brand-lime border border-brand-lime/20 font-bold">
                  {metadata?.platform || analyzedMedia.source}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-black text-brand-grey border border-brand-border">
                  Extractor: {metadata?.extractor || analyzedMedia.extractor?.key || 'yt-dlp'}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-black text-brand-grey border border-brand-border">
                  Type: {metadata?.mediaType || analyzedMedia.category}
                </span>
                {metadata?.isPlaylist && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                    Playlist {metadata.playlistCount ? `(${metadata.playlistCount} items)` : ''}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-brand-white leading-snug line-clamp-2">
                {analyzedMedia.title}
              </h3>

              {/* Statistics & Metadata Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-grey">
                {metadata?.uploader && (
                  <div className="flex items-center space-x-1.5 text-brand-white">
                    <span>by</span>
                    {metadata.uploaderUrl ? (
                      <a
                        href={metadata.uploaderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-lime hover:underline font-semibold flex items-center space-x-1"
                      >
                        <span>{metadata.uploader}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-semibold text-brand-white">{metadata.uploader}</span>
                    )}
                  </div>
                )}

                {(metadata?.durationFormatted || analyzedMedia.duration) && (
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-brand-lime" />
                    <span>
                      {metadata?.durationFormatted ||
                        `${Math.floor((analyzedMedia.duration || 0) / 60)}m ${(analyzedMedia.duration || 0) % 60}s`}
                    </span>
                  </div>
                )}

                {metadata?.uploadDate && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{metadata.uploadDate}</span>
                  </div>
                )}

                {metadata?.viewCount !== undefined && metadata?.viewCount !== null && (
                  <div className="flex items-center space-x-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{formatCount(metadata.viewCount)} views</span>
                  </div>
                )}

                {metadata?.likeCount !== undefined && metadata?.likeCount !== null && (
                  <div className="flex items-center space-x-1">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{formatCount(metadata.likeCount)} likes</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-brand-grey truncate font-mono bg-brand-black/40 px-3 py-1.5 rounded border border-brand-border/60">
                {analyzedMedia.url}
              </div>
            </div>
          </div>

          {/* Format Discovery & Quality Selection */}
          <div className="border-t border-brand-border pt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-brand-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-brand-lime" />
                  <span>Available Formats & Streams</span>
                  <span className="text-xs font-mono font-normal text-brand-grey">
                    ({allFormats.length} discovered)
                  </span>
                </h4>
                <p className="text-xs text-brand-grey mt-0.5">
                  Select a stream to configure resolution, container, and codec specifications.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center bg-brand-black p-1 rounded-lg border border-brand-border self-start sm:self-auto">
                {(
                  [
                    { id: 'all', label: 'All', count: allFormats.length },
                    {
                      id: 'combined',
                      label: 'Combined',
                      count: allFormats.filter((f) => f.isCombined).length,
                    },
                    {
                      id: 'video',
                      label: 'Video',
                      count: allFormats.filter((f) => f.isVideo).length,
                    },
                    {
                      id: 'audio',
                      label: 'Audio',
                      count: allFormats.filter((f) => f.isAudio).length,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFormatFilter(tab.id)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                      formatFilter === tab.id
                        ? 'bg-brand-surface text-brand-lime shadow-sm'
                        : 'text-brand-grey hover:text-brand-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Formats Grid / Table */}
            {filteredFormats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredFormats.map((fmt) => {
                  const isSelected = selectedFormatId === fmt.formatId;
                  const hasExactSize = fmt.fileSizeBytes && fmt.fileSizeBytes > 0;
                  const hasApproxSize = fmt.estimatedFileSizeBytes && fmt.estimatedFileSizeBytes > 0;

                  return (
                    <div
                      key={fmt.formatId}
                      onClick={() => setSelectedFormatId(fmt.formatId)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? 'border-brand-lime bg-brand-lime/10 text-brand-white shadow-sm ring-1 ring-brand-lime/40'
                          : 'border-brand-border bg-brand-black/60 hover:border-brand-grey/60 text-brand-grey'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="text-sm font-bold text-brand-white flex items-center space-x-2">
                            <span>{fmt.qualityLabel}</span>
                            {fmt.isCombined && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-brand-lime/20 text-brand-lime border border-brand-lime/30">
                                Video+Audio
                              </span>
                            )}
                            {fmt.isVideo && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Video Only
                              </span>
                            )}
                            {fmt.isAudio && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                Audio Only
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-brand-grey">
                            ID: {fmt.formatId} • {fmt.extension.toUpperCase()}
                            {fmt.container && fmt.container !== fmt.extension
                              ? ` (${fmt.container})`
                              : ''}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-brand-lime text-brand-black flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Codecs & Size info */}
                      <div className="text-[11px] space-y-1 pt-1 border-t border-brand-border/40 font-mono">
                        <div className="flex justify-between text-brand-grey">
                          <span>Video: {fmt.videoCodec || 'None'}</span>
                          <span>Audio: {fmt.audioCodec || 'None'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-brand-grey">
                            {fmt.resolution ? fmt.resolution : fmt.isAudio ? 'Audio Stream' : ''}
                            {fmt.fps && fmt.fps > 0 ? ` @ ${Math.round(fmt.fps)}fps` : ''}
                          </span>
                          <span
                            className={`font-semibold ${
                              hasExactSize
                                ? 'text-brand-white'
                                : hasApproxSize
                                ? 'text-brand-lime'
                                : 'text-brand-grey'
                            }`}
                          >
                            {hasExactSize
                              ? formatBytes(fmt.fileSizeBytes)
                              : hasApproxSize
                              ? `~ ${formatBytes(fmt.estimatedFileSizeBytes)}`
                              : 'Unknown size'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-brand-black/40 rounded-lg border border-brand-border text-brand-grey text-xs">
                No formats found for the filter "{formatFilter}".
              </div>
            )}

            {/* Destination folder */}
            <div className="space-y-2 pt-2 border-t border-brand-border">
              <label className="text-xs font-semibold text-brand-grey">Destination Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetDir || settings.defaultDownloadDir}
                  onChange={(e) => setTargetDir(e.target.value)}
                  className="flex-1 bg-brand-black border border-brand-border rounded-lg px-3 py-2 text-xs text-brand-white font-mono"
                />
                <button
                  onClick={handleSelectFolder}
                  className="px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-brand-white hover:bg-brand-black flex items-center space-x-1.5 transition-colors"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Action Buttons & Milestone Notice */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleQueueOrDownloadAction('start')}
                className="flex-1 py-3 bg-brand-lime text-brand-black font-bold rounded-lg text-sm hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Select Format for Download</span>
              </button>
              <button
                onClick={() => handleQueueOrDownloadAction('queue')}
                className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-white font-semibold rounded-lg text-sm hover:bg-brand-black transition-colors flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Queue</span>
              </button>
            </div>

            <div className="text-[11px] text-brand-grey/80 text-center pt-1 font-mono">
              Milestone 3 active: Media format discovery & inspection complete. Download execution engine connects in Milestone 4.
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <Search className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">No Active URL Inspected</h3>
          <p className="text-xs text-brand-grey max-w-sm mx-auto">
            Paste a video, audio, or media link above to inspect metadata, formats, streams, and codecs.
          </p>
        </div>
      )}
    </div>
  );
};
