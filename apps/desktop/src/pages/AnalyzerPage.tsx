import React, { useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Clock,
  Folder,
  Layers,
  Check,
  Video,
  Music,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const AnalyzerPage: React.FC = () => {
  const analyzedMedia = useAppStore((state) => state.analyzedMedia);
  const isAnalyzing = useAppStore((state) => state.isAnalyzing);
  const analyzeError = useAppStore((state) => state.analyzeError);
  const inspectUrl = useAppStore((state) => state.inspectUrl);
  const addJob = useAppStore((state) => state.addJob);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const settings = useAppStore((state) => state.settings);
  const selectDownloadDirectory = useAppStore((state) => state.selectDownloadDirectory);

  const [inputUrl, setInputUrl] = useState(analyzedMedia?.url || '');
  const [selectedFormat, setSelectedFormat] = useState('best');
  const [extractAudio, setExtractAudio] = useState(false);
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'm4a' | 'wav' | 'flac'>('mp3');
  const [customFilename, setCustomFilename] = useState(analyzedMedia?.title || '');
  const [targetDir, setTargetDir] = useState(settings.defaultDownloadDir);

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    const ok = await inspectUrl(inputUrl.trim());
    if (ok && analyzedMedia) {
      setCustomFilename(analyzedMedia.title);
    }
  };

  const handleStartDownload = async () => {
    if (!analyzedMedia) return;

    const success = await addJob({
      url: analyzedMedia.url,
      selectedFormatId: selectedFormat,
      extractAudio,
      audioFormat,
      customFilename: customFilename.trim() || analyzedMedia.title,
      targetDirectory: targetDir || settings.defaultDownloadDir,
      category: extractAudio ? 'audio' : analyzedMedia.category,
    });

    if (success) {
      setActiveTab('downloads');
    }
  };

  const handleSelectFolder = async () => {
    const chosen = await selectDownloadDirectory();
    if (chosen) {
      setTargetDir(chosen);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Search Header */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
        <h2 className="text-xl font-bold text-brand-white mb-2">Media & URL Inspector</h2>
        <p className="text-xs text-brand-grey mb-4">
          Deep inspect video formats, streams, audio tracks, and file headers.
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
              placeholder="Paste media link or file URL..."
              className="w-full bg-brand-black border border-brand-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime"
            />
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !inputUrl.trim()}
            className="px-5 py-2.5 bg-brand-lime text-brand-black rounded-lg font-semibold text-sm hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isAnalyzing ? 'Inspecting...' : 'Inspect URL'}
          </button>
        </form>

        {analyzeError && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{analyzeError}</span>
          </div>
        )}
      </div>

      {/* Analysis Result Card */}
      {analyzedMedia ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-6">
          {/* Media Header */}
          <div className="flex flex-col md:flex-row gap-5 items-start">
            {analyzedMedia.thumbnail ? (
              <img
                src={analyzedMedia.thumbnail}
                alt="Media thumbnail"
                className="w-full md:w-56 h-36 object-cover rounded-lg border border-brand-border"
              />
            ) : (
              <div className="w-full md:w-56 h-36 bg-brand-black rounded-lg border border-brand-border flex items-center justify-center text-brand-grey">
                <Video className="w-10 h-10 opacity-40 text-brand-lime" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-lime/10 text-brand-lime border border-brand-lime/20 font-bold">
                  {analyzedMedia.source}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-brand-black text-brand-grey border border-brand-border">
                  {analyzedMedia.engine}
                </span>
                {analyzedMedia.duration && (
                  <span className="text-xs text-brand-grey flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{Math.floor(analyzedMedia.duration / 60)}m {analyzedMedia.duration % 60}s</span>
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-brand-white leading-tight">
                {analyzedMedia.title}
              </h3>

              <div className="text-xs text-brand-grey truncate max-w-xl">
                {analyzedMedia.url}
              </div>
            </div>
          </div>

          {/* Options & Format Selection */}
          <div className="border-t border-brand-border pt-6 space-y-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-brand-grey">
              Format & Quality Selection
            </h4>

            {/* Quality presets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'best', label: 'Best Quality', sub: 'Optimal Resolution' },
                { id: '1080p', label: 'Full HD (1080p)', sub: 'High Definition' },
                { id: '720p', label: 'Standard HD (720p)', sub: 'Balanced Size' },
                { id: 'audio_only', label: 'Audio Only', sub: 'Extract Sound' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setSelectedFormat(fmt.id);
                    if (fmt.id === 'audio_only') setExtractAudio(true);
                    else setExtractAudio(false);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedFormat === fmt.id
                      ? 'border-brand-lime bg-brand-lime/10 text-brand-white'
                      : 'border-brand-border bg-brand-black hover:border-brand-grey text-brand-grey'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{fmt.label}</span>
                    {selectedFormat === fmt.id && <Check className="w-3.5 h-3.5 text-brand-lime" />}
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">{fmt.sub}</div>
                </button>
              ))}
            </div>

            {/* Audio Extraction Options */}
            {extractAudio && (
              <div className="bg-brand-black/60 border border-brand-border rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-brand-white flex items-center space-x-2">
                  <Music className="w-4 h-4 text-brand-lime" />
                  <span>Audio Post-Processing Codec</span>
                </div>
                <div className="flex gap-2">
                  {(['mp3', 'm4a', 'wav', 'flac'] as const).map((codec) => (
                    <button
                      key={codec}
                      onClick={() => setAudioFormat(codec)}
                      className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-all ${
                        audioFormat === codec
                          ? 'bg-brand-lime text-brand-black font-bold'
                          : 'bg-brand-surface text-brand-grey border border-brand-border hover:text-brand-white'
                      }`}
                    >
                      {codec}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Destination folder */}
            <div className="space-y-2">
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
                  className="px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-brand-white hover:bg-brand-hover flex items-center space-x-1.5"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Browse</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex gap-3">
              <button
                onClick={handleStartDownload}
                className="flex-1 py-3 bg-brand-lime text-brand-black font-bold rounded-lg text-sm hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Start Download</span>
              </button>
              <button
                onClick={handleStartDownload}
                className="px-6 py-3 bg-brand-surface border border-brand-border text-brand-white font-semibold rounded-lg text-sm hover:bg-brand-hover transition-colors flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Queue</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-brand-surface/40 border border-dashed border-brand-border rounded-xl">
          <Search className="w-10 h-10 text-brand-grey mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-brand-white mb-1">No Active URL Inspected</h3>
          <p className="text-xs text-brand-grey max-w-sm mx-auto">
            Enter a video, audio, or direct download link above to inspect formats, streams, and quality options.
          </p>
        </div>
      )}
    </div>
  );
};
