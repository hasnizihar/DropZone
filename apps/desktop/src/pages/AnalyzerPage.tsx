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
  FileText,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ShieldCheck,
  HelpCircle,
  Loader2,
  RefreshCw,
  ClipboardPaste,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import type { MediaFormat, PostProcessOptions } from '@dropzone/shared';

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
  const analyzedFile = useAppStore((state) => state.analyzedFile);
  const analyzedGallery = useAppStore((state) => state.analyzedGallery);
  const analyzedPlaylist = useAppStore((state) => state.analyzedPlaylist);
  const toggleGalleryAssetSelected = useAppStore((state) => state.toggleGalleryAssetSelected);
  const selectAllGalleryAssets = useAppStore((state) => state.selectAllGalleryAssets);
  const togglePlaylistItem = useAppStore((state) => state.togglePlaylistItem);
  const selectAllPlaylistItems = useAppStore((state) => state.selectAllPlaylistItems);
  const analysisStatus = useAppStore((state) => state.analysisStatus);
  const selectedFormatId = useAppStore((state) => state.selectedFormatId);
  const setSelectedFormatId = useAppStore((state) => state.setSelectedFormatId);
  const isAnalyzing = useAppStore((state) => state.isAnalyzing);
  const analyzingUrl = useAppStore((state) => state.analyzingUrl);
  const analyzeError = useAppStore((state) => state.analyzeError);
  const analysisDurationMs = useAppStore((state) => state.analysisDurationMs);
  const inspectUrl = useAppStore((state) => state.inspectUrl);
  const resetAnalysis = useAppStore((state) => state.resetAnalysis);
  const addJob = useAppStore((state) => state.addJob);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const settings = useAppStore((state) => state.settings);
  const selectDownloadDirectory = useAppStore((state) => state.selectDownloadDirectory);
  const showToast = useAppStore((state) => state.showToast);

  const [inputUrl, setInputUrl] = useState(analyzedMedia?.url || '');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [customFilename, setCustomFilename] = useState(analyzedMedia?.title || '');
  const [targetDir, setTargetDir] = useState(settings.defaultDownloadDir);
  const [isStartingDownload, setIsStartingDownload] = useState(false);

  // Post-processing options (Milestone 7)
  const [postProcessMode, setPostProcessMode] = useState<'original' | 'audio' | 'remux'>('original');
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<'mp3' | 'm4a' | 'wav' | 'flac' | 'opus'>(
    settings.defaultAudioFormat || 'mp3'
  );
  const [selectedAudioBitrate, setSelectedAudioBitrate] = useState<'128k' | '192k' | '256k' | '320k'>(
    settings.defaultAudioBitrate || '192k'
  );
  const [selectedRemuxContainer, setSelectedRemuxContainer] = useState<'mp4' | 'mkv' | 'webm'>(
    settings.defaultRemuxContainer || 'mp4'
  );
  const [embedMetadata, setEmbedMetadata] = useState<boolean>(true);
  const [preserveSource, setPreserveSource] = useState<boolean>(settings.preserveDownloadedSource || false);

  // Sync state when new media is analyzed or when analysis begins from Dashboard
  useEffect(() => {
    if (analyzedMedia) {
      setInputUrl(analyzedMedia.url);
      setCustomFilename(analyzedMedia.title);
    } else if (analyzingUrl) {
      setInputUrl(analyzingUrl);
    }
  }, [analyzedMedia, analyzingUrl]);

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

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setInputUrl(text.trim());
          showToast('Pasted URL from clipboard', 'info');
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleSelectFolder = async () => {
    const chosen = await selectDownloadDirectory();
    if (chosen) {
      setTargetDir(chosen);
    }
  };

  const handleStartDownload = async (action: 'start' | 'queue') => {
    if (isStartingDownload || !analyzedMedia) return;
    setIsStartingDownload(true);

    try {
      // Playlist download
      if (analyzedPlaylist && analyzedPlaylist.entries.length > 0) {
        const selectedEntries = analyzedPlaylist.entries.filter((e) => e.selected && e.isAvailable);
        if (selectedEntries.length === 0) {
          showToast('Please select at least one available video from the playlist.', 'error');
          return;
        }
        const ok = await addJob({
          url: analyzedMedia.url,
          customFilename: customFilename.trim() || analyzedPlaylist.title,
          targetDirectory: targetDir || settings.defaultDownloadDir,
          category: 'playlist',
          engine: 'playlist',
          playlistItems: selectedEntries,
        });
        if (ok) {
          showToast(action === 'start' ? 'Playlist download started!' : 'Playlist added to download queue', 'success');
          setActiveTab('downloads');
        }
        return;
      }

      // Gallery download
      if (analyzedGallery && analyzedGallery.assets.length > 0) {
        const selectedAssets = analyzedGallery.assets.filter((a) => a.selected !== false);
        if (selectedAssets.length === 0) {
          showToast('Please select at least one image to download.', 'error');
          return;
        }
        const ok = await addJob({
          url: analyzedMedia.url,
          customFilename: customFilename.trim() || analyzedGallery.title,
          targetDirectory: targetDir || settings.defaultDownloadDir,
          category: 'image',
          engine: 'image-gallery',
          assets: selectedAssets,
        });
        if (ok) {
          showToast(action === 'start' ? 'Gallery download started!' : 'Gallery added to download queue', 'success');
          setActiveTab('downloads');
        }
        return;
      }

      // Direct File download
      if (analyzedFile) {
        const ok = await addJob({
          url: analyzedFile.url,
          customFilename: customFilename.trim() || analyzedFile.filename,
          targetDirectory: targetDir || settings.defaultDownloadDir,
          category: analyzedFile.category,
          engine: 'direct-http',
        });
        if (ok) {
          showToast(action === 'start' ? 'Direct download started!' : 'Added to download queue', 'success');
          setActiveTab('downloads');
        }
        return;
      }

      // Standard media download
      const isAudio = analyzedMedia.metadata?.mediaType === 'audio' || selectedFormat?.isAudio;
      let postProcess: PostProcessOptions | undefined = undefined;

      if (postProcessMode === 'audio') {
        postProcess = {
          action: 'extract_audio',
          audioFormat: selectedAudioFormat,
          audioBitrate: selectedAudioBitrate,
          embedMetadata,
          preserveSource,
        };
      } else if (postProcessMode === 'remux') {
        postProcess = {
          action: 'remux',
          remuxContainer: selectedRemuxContainer,
          embedMetadata,
          preserveSource,
        };
      }

      const ok = await addJob({
        url: analyzedMedia.url,
        selectedFormatId: selectedFormatId || undefined,
        customFilename: customFilename.trim() || analyzedMedia.title,
        targetDirectory: targetDir || settings.defaultDownloadDir,
        category: (isAudio || postProcessMode === 'audio') ? 'file' : analyzedMedia.category,
        engine: 'yt-dlp',
        postProcess,
      });
      if (ok) {
        showToast(action === 'start' ? 'Download started!' : 'Added to download queue', 'success');
        setActiveTab('downloads');
      }
    } finally {
      setIsStartingDownload(false);
    }
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

  const isPlaylistType = Boolean(analyzedPlaylist || analyzedMedia?.engine === 'playlist' || analyzedMedia?.category === 'playlist');
  const isGalleryType = Boolean(!isPlaylistType && (analyzedGallery || analyzedMedia?.engine === 'image-gallery'));
  const isDirectFileType = Boolean(!isPlaylistType && !isGalleryType && (analyzedFile || (analyzedMedia?.engine === 'direct-http' && analyzedMedia?.category !== 'image')));
  const isDirectImageType = Boolean(!isPlaylistType && !analyzedGallery && (analyzedMedia?.category === 'image' || analyzedFile?.category === 'image'));

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
          Inspect and download video/audio streams (yt-dlp), direct files (chunked HTTP streaming with resume), and image galleries (gallery-dl).
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
              placeholder="Paste any link (YouTube, Vimeo, Reddit, direct HTTP file, image, or gallery)..."
              disabled={isAnalyzing}
              className="w-full bg-brand-black border border-brand-border rounded-lg pl-10 pr-20 py-3 text-sm text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime transition-colors disabled:opacity-50"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-0.5">
              <button
                type="button"
                onClick={handlePaste}
                disabled={isAnalyzing}
                className="p-1.5 text-brand-grey hover:text-brand-lime hover:bg-white/5 rounded transition-colors disabled:opacity-40"
                title="Paste URL from clipboard"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
              {inputUrl && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-brand-grey hover:text-brand-white hover:bg-white/5 rounded transition-colors"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
          <div className="mt-4 p-3.5 bg-red-950/40 border border-red-500/40 rounded-lg flex items-start justify-between gap-3 text-red-300 text-xs animate-in fade-in">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-red-200">Inspection Error</div>
                <p className="leading-relaxed opacity-90">{analyzeError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInspect}
              disabled={isAnalyzing || !inputUrl.trim()}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded font-semibold text-xs flex items-center space-x-1.5 flex-shrink-0 transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Analysis Result Card */}
      {analyzedMedia ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-6">
          {/* Header & Badges */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {analyzedMedia.thumbnail ? (
              <img
                src={analyzedMedia.thumbnail}
                alt="Media thumbnail"
                className="w-full md:w-64 h-40 object-cover rounded-lg border border-brand-border bg-brand-black flex-shrink-0"
              />
            ) : (
              <div className="w-full md:w-64 h-40 bg-brand-black rounded-lg border border-brand-border flex items-center justify-center text-brand-grey flex-shrink-0">
                {isGalleryType ? (
                  <ImageIcon className="w-12 h-12 opacity-30 text-brand-lime" />
                ) : isDirectFileType ? (
                  <FileText className="w-12 h-12 opacity-30 text-brand-lime" />
                ) : (
                  <Video className="w-12 h-12 opacity-30 text-brand-lime" />
                )}
              </div>
            )}

            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {/* Primary Type Badge */}
                <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded bg-brand-lime text-brand-black font-extrabold shadow-sm">
                  {isPlaylistType ? 'PLAYLIST' : isGalleryType ? 'GALLERY' : isDirectImageType ? 'IMAGE' : isDirectFileType ? 'FILE' : 'MEDIA'}
                </span>

                <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded bg-brand-lime/10 text-brand-lime border border-brand-lime/20 font-bold">
                  {metadata?.platform || analyzedMedia.source}
                </span>

                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-black text-brand-grey border border-brand-border">
                  Engine: {analyzedMedia.engine}
                </span>

                {analyzedFile?.supportsResume && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Resumable (Range 206)</span>
                  </span>
                )}

                {analyzedFile?.fileSizeBytes && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-black text-brand-white border border-brand-border font-bold">
                    {formatBytes(analyzedFile.fileSizeBytes)}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-bold text-brand-white leading-snug line-clamp-2">
                {analyzedMedia.title}
              </h3>

              {/* Statistics & Metadata Row */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-grey">
                {analyzedFile?.mimeType && (
                  <span className="font-mono text-brand-lime">
                    MIME: {analyzedFile.mimeType}
                  </span>
                )}

                {metadata?.uploader && (
                  <div className="flex items-center space-x-1.5 text-brand-white">
                    <span>by</span>
                    <span className="font-semibold text-brand-white">{metadata.uploader}</span>
                  </div>
                )}

                {(metadata?.durationFormatted || analyzedMedia.duration) && (
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-brand-lime" />
                    <span>{metadata?.durationFormatted}</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-brand-grey truncate font-mono bg-brand-black/40 px-3 py-1.5 rounded border border-brand-border/60">
                {analyzedMedia.url}
              </div>
            </div>
          </div>

          {/* GALLERY CONTENT: Multi-Asset Grid with Selection Controls */}
          {isGalleryType && analyzedGallery && (
            <div className="border-t border-brand-border pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-brand-white flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-brand-lime" />
                    <span>Gallery Images ({analyzedGallery.assets.length})</span>
                  </h4>
                  <p className="text-xs text-brand-grey mt-0.5">
                    Select images to download through the unified queue.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => selectAllGalleryAssets(true)}
                    className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-lime hover:text-brand-white transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => selectAllGalleryAssets(false)}
                    className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-grey hover:text-brand-white transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto pr-1">
                {analyzedGallery.assets.map((asset, idx) => {
                  const isSelected = asset.selected !== false;
                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleGalleryAssetSelected(idx)}
                      className={`relative group rounded-lg border overflow-hidden cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-lime ring-1 ring-brand-lime bg-brand-lime/5'
                          : 'border-brand-border bg-brand-black/40 opacity-50'
                      }`}
                    >
                      <img
                        src={asset.thumbnail || asset.url}
                        alt={asset.filename}
                        className="w-full h-28 object-cover bg-brand-black"
                      />
                      <div className="p-2 text-[10px] font-mono text-brand-grey truncate">
                        {asset.filename}
                      </div>
                      <div className="absolute top-1.5 right-1.5 bg-brand-black/80 rounded p-1">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-lime" />
                        ) : (
                          <Square className="w-4 h-4 text-brand-grey" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PLAYLIST CONTENT: Multi-Item Table with Selection Controls */}
          {isPlaylistType && analyzedPlaylist && (
            <div className="border-t border-brand-border pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-brand-white flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-brand-lime" />
                    <span>Playlist Items ({analyzedPlaylist.entries.length} loaded{analyzedPlaylist.totalCount > analyzedPlaylist.entries.length ? ` of ${analyzedPlaylist.totalCount}` : ''})</span>
                  </h4>
                  <p className="text-xs text-brand-grey mt-0.5">
                    Select videos to download through the unified queue.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => selectAllPlaylistItems(true)}
                    className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-lime hover:text-brand-white transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAllPlaylistItems(false)}
                    className="px-2.5 py-1 text-xs bg-brand-black border border-brand-border rounded text-brand-grey hover:text-brand-white transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Truncation Warning */}
              {analyzedPlaylist.isTruncated && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <span>
                    Playlist bounded: Loaded first {analyzedPlaylist.extractedCount} of {analyzedPlaylist.totalCount} items to protect system resources.
                  </span>
                </div>
              )}

              {/* Entries list */}
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-brand-border/40">
                {analyzedPlaylist.entries.map((entry, idx) => {
                  const isSelected = entry.selected && entry.isAvailable;
                  return (
                    <div
                      key={entry.id}
                      onClick={() => entry.isAvailable && togglePlaylistItem(idx)}
                      className={`pt-2 flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        !entry.isAvailable
                          ? 'opacity-40 cursor-not-allowed bg-brand-black/20'
                          : isSelected
                          ? 'bg-brand-lime/5 border border-brand-lime/30'
                          : 'hover:bg-brand-black/40 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-4">
                        <div className="flex-shrink-0 text-xs font-mono text-brand-grey w-6 text-right">
                          #{entry.index}
                        </div>
                        {entry.thumbnail ? (
                          <img
                            src={entry.thumbnail}
                            alt=""
                            className="w-16 h-10 object-cover rounded border border-brand-border bg-brand-black flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-10 bg-brand-black rounded border border-brand-border flex items-center justify-center text-brand-grey flex-shrink-0">
                            <Video className="w-4 h-4 opacity-40 text-brand-lime" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-brand-white truncate">
                            {entry.title}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-brand-grey">
                            {entry.uploader && <span>{entry.uploader}</span>}
                            {entry.durationFormatted && (
                              <span className="font-mono text-brand-lime">{entry.durationFormatted}</span>
                            )}
                            {!entry.isAvailable && (
                              <span className="text-red-400 uppercase font-mono">[Unavailable]</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 pr-1">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-lime" />
                        ) : (
                          <Square className={`w-4 h-4 ${entry.isAvailable ? 'text-brand-grey' : 'text-brand-grey/40'}`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STREAM FORMATS (for Video / Audio yt-dlp) */}
          {!isPlaylistType && !isGalleryType && !isDirectFileType && !isDirectImageType && allFormats.length > 0 && (
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

              {/* Formats Grid */}
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
                          </div>
                          <div className="text-[11px] font-mono text-brand-grey">
                            ID: {fmt.formatId} • {fmt.extension.toUpperCase()}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-brand-lime text-brand-black flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] space-y-1 pt-1 border-t border-brand-border/40 font-mono">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-brand-grey">
                            {fmt.resolution || (fmt.isAudio ? 'Audio Stream' : '')}
                          </span>
                          <span className="font-semibold text-brand-white">
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
            </div>
          )}

          {/* POST-PROCESSING & CONVERSION PANEL (FFmpeg Milestone 7) */}
          {!isGalleryType && !isDirectFileType && !isDirectImageType && (
            <div className="border-t border-brand-border pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-brand-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-brand-lime" />
                    <span>Post-Processing & Conversion (FFmpeg)</span>
                  </h4>
                  <p className="text-xs text-brand-grey mt-0.5">
                    Extract audio tracks, remux video containers, and embed metadata.
                  </p>
                </div>

                {/* Conversion Mode Tabs */}
                <div className="flex items-center bg-brand-black p-1 rounded-lg border border-brand-border self-start sm:self-auto">
                  {(
                    [
                      { id: 'original', label: 'Original Stream' },
                      { id: 'audio', label: 'Extract Audio' },
                      { id: 'remux', label: 'Remux Container' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setPostProcessMode(mode.id)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                        postProcessMode === mode.id
                          ? 'bg-brand-surface text-brand-lime shadow-sm'
                          : 'text-brand-grey hover:text-brand-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode-specific configuration */}
              {postProcessMode === 'audio' && (
                <div className="p-4 bg-brand-black/60 border border-brand-border rounded-xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Audio Format Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-brand-white">Target Audio Codec & Format</label>
                      <div className="flex flex-wrap gap-2">
                        {(['mp3', 'm4a', 'wav', 'flac', 'opus'] as const).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => setSelectedAudioFormat(fmt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition-all ${
                              selectedAudioFormat === fmt
                                ? 'bg-brand-lime text-brand-black border-brand-lime'
                                : 'bg-brand-surface text-brand-grey border-brand-border hover:text-brand-white'
                            }`}
                          >
                            {fmt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audio Bitrate Selector */}
                    {['mp3', 'm4a', 'opus'].includes(selectedAudioFormat) && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-brand-white">Audio Bitrate</label>
                        <div className="flex flex-wrap gap-2">
                          {(['320k', '256k', '192k', '128k'] as const).map((br) => (
                            <button
                              key={br}
                              type="button"
                              onClick={() => setSelectedAudioBitrate(br)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                                selectedAudioBitrate === br
                                  ? 'bg-brand-lime text-brand-black font-bold border-brand-lime'
                                  : 'bg-brand-surface text-brand-grey border-brand-border hover:text-brand-white'
                              }`}
                            >
                              {br}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Options Checkboxes */}
                  <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-brand-border/60 text-xs">
                    <label className="flex items-center space-x-2 text-brand-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={embedMetadata}
                        onChange={(e) => setEmbedMetadata(e.target.checked)}
                        className="accent-brand-lime rounded cursor-pointer"
                      />
                      <span>Embed ID3 Metadata & Album Art</span>
                    </label>

                    <label className="flex items-center space-x-2 text-brand-grey cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={preserveSource}
                        onChange={(e) => setPreserveSource(e.target.checked)}
                        className="accent-brand-lime rounded cursor-pointer"
                      />
                      <span>Keep downloaded source file</span>
                    </label>
                  </div>
                </div>
              )}

              {postProcessMode === 'remux' && (
                <div className="p-4 bg-brand-black/60 border border-brand-border rounded-xl space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-brand-white">Destination Video Container</label>
                    <div className="flex flex-wrap gap-2">
                      {(['mp4', 'mkv', 'webm'] as const).map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setSelectedRemuxContainer(cnt)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase border transition-all ${
                            selectedRemuxContainer === cnt
                              ? 'bg-brand-lime text-brand-black border-brand-lime'
                              : 'bg-brand-surface text-brand-grey border-brand-border hover:text-brand-white'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 pt-2 border-t border-brand-border/60 text-xs">
                    <label className="flex items-center space-x-2 text-brand-grey cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={preserveSource}
                        onChange={(e) => setPreserveSource(e.target.checked)}
                        className="accent-brand-lime rounded cursor-pointer"
                      />
                      <span>Keep original source file</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Destination Folder Selector */}
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

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleStartDownload('start')}
              disabled={isStartingDownload}
              className="flex-1 py-3 bg-brand-lime text-brand-black font-bold rounded-lg text-sm hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStartingDownload ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting Download...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    {isGalleryType
                      ? `Download Selected (${analyzedGallery?.assets.filter((a) => a.selected !== false).length || 0} images)`
                      : 'Start Download'}
                  </span>
                </>
              )}
            </button>
            <button
              onClick={() => handleStartDownload('queue')}
              disabled={isStartingDownload}
              className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-white font-semibold rounded-lg text-sm hover:bg-brand-black transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Queue</span>
            </button>
          </div>
        </div>
      ) : isAnalyzing ? (
        <div className="bg-brand-surface border border-brand-lime/30 rounded-xl p-8 sm:p-12 text-center animate-in fade-in duration-300 relative overflow-hidden shadow-lg">
          {/* Glowing Animated Top Border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-lime to-transparent animate-pulse" />

          {/* Radar / Scanner Pulse Icon */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-lime/10 border border-brand-lime/30 mb-5">
            <span className="absolute inset-0 rounded-full bg-brand-lime/20 animate-ping opacity-75" />
            <Loader2 className="w-8 h-8 text-brand-lime animate-spin relative z-10" />
          </div>

          <h3 className="text-lg font-bold text-brand-white mb-2">
            Inspecting URL & Media Streams
          </h3>
          <p className="text-xs text-brand-grey max-w-md mx-auto mb-5 leading-relaxed">
            Probing remote server for available video resolutions (4K, 1080p, 720p), audio codecs, bitrates, and downloadable streams.
          </p>

          {/* Current URL Pill */}
          <div className="inline-flex items-center max-w-lg px-3.5 py-1.5 rounded-lg bg-brand-black border border-brand-border text-xs font-mono text-brand-lime mb-6 truncate shadow-inner">
            <Search className="w-3.5 h-3.5 mr-2 flex-shrink-0 text-brand-grey" />
            <span className="truncate">{inputUrl || analyzingUrl || 'Connecting to source...'}</span>
          </div>

          {/* Animated Gliding Progress Bar */}
          <div className="w-full max-w-md mx-auto bg-brand-black h-2 rounded-full overflow-hidden border border-brand-border mb-8 relative">
            <div className="h-full bg-brand-lime rounded-full animate-indeterminate" />
          </div>

          {/* Progress Steps Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left text-xs">
            <div className="bg-brand-black/60 border border-brand-border/60 rounded-lg p-3 flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-brand-lime flex-shrink-0" />
              <div>
                <div className="font-semibold text-brand-white">URL Security</div>
                <div className="text-[10px] text-brand-grey">SSRF & scheme passed</div>
              </div>
            </div>

            <div className="bg-brand-black/60 border border-brand-lime/40 rounded-lg p-3 flex items-center space-x-2.5 shadow-sm">
              <Loader2 className="w-4 h-4 text-brand-lime animate-spin flex-shrink-0" />
              <div>
                <div className="font-semibold text-brand-lime">Probing Streams</div>
                <div className="text-[10px] text-brand-grey">yt-dlp engine active</div>
              </div>
            </div>

            <div className="bg-brand-black/40 border border-brand-border/40 rounded-lg p-3 flex items-center space-x-2.5 opacity-60">
              <div className="w-4 h-4 rounded-full border border-brand-grey/50 flex-shrink-0" />
              <div>
                <div className="font-semibold text-brand-white">Normalizing</div>
                <div className="text-[10px] text-brand-grey">Sorting resolutions</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <Search className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">No Active URL Inspected</h3>
          <p className="text-xs text-brand-grey max-w-sm mx-auto">
            Paste a link above to inspect streaming media, direct downloadable files, images, or galleries.
          </p>
        </div>
      )}
    </div>
  );
};
