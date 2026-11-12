import React, { useState } from 'react';
import { Layers, FileUp, Play, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';

export const BatchPage: React.FC = () => {
  const [urlText, setUrlText] = useState('');
  const [parsedUrls, setParsedUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const addJob = useAppStore((state) => state.addJob);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const showToast = useAppStore((state) => state.showToast);

  const handleParse = () => {
    const lines = urlText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    const unique = Array.from(new Set(lines));
    setParsedUrls(unique);
    if (unique.length > 0) {
      showToast(`Parsed ${unique.length} valid URLs`, 'success');
    } else {
      showToast('No valid HTTP/HTTPS URLs found in text', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setUrlText(content);
        const lines = content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('http://') || l.startsWith('https://'));
        const unique = Array.from(new Set(lines));
        setParsedUrls(unique);
        showToast(`Loaded ${unique.length} URLs from file`, 'success');
      }
    };
    reader.readAsText(file);
  };

  const handleStartBatch = async () => {
    if (parsedUrls.length === 0) return;
    setIsProcessing(true);

    for (const url of parsedUrls) {
      await addJob({
        url,
        selectedFormatId: 'best',
        category: 'video',
      });
    }

    setIsProcessing(false);
    showToast(`Queued ${parsedUrls.length} downloads`, 'success');
    setActiveTab('downloads');
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-brand-white">Batch Ingestion</h1>
        <p className="text-xs text-brand-grey">
          Queue multiple URLs simultaneously from text or imported text files.
        </p>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-brand-grey uppercase tracking-wider">
            Paste URL List (One per line)
          </label>
          <label className="cursor-pointer text-xs font-semibold text-brand-lime hover:underline flex items-center space-x-1.5">
            <FileUp className="w-3.5 h-3.5" />
            <span>Import from .txt</span>
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={7}
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          placeholder={`https://www.youtube.com/watch?v=...\nhttps://example.com/files/archive.zip\nhttps://vimeo.com/...`}
          className="w-full bg-brand-black border border-brand-border rounded-lg p-3 text-xs font-mono text-brand-white placeholder-brand-grey focus:outline-none focus:border-brand-lime"
        />

        <div className="flex justify-between items-center pt-2">
          <button
            onClick={handleParse}
            disabled={!urlText.trim()}
            className="px-4 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs font-semibold text-brand-white hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            Validate & Parse URLs
          </button>

          {parsedUrls.length > 0 && (
            <button
              onClick={() => {
                setParsedUrls([]);
                setUrlText('');
              }}
              className="text-xs text-brand-grey hover:text-red-400 flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear List</span>
            </button>
          )}
        </div>
      </div>

      {parsedUrls.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-brand-white flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-brand-lime" />
              <span>Recognized URLs ({parsedUrls.length})</span>
            </h3>

            <button
              onClick={handleStartBatch}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-brand-lime text-brand-black font-bold rounded-lg text-xs hover:brightness-105 active:scale-[0.98] transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isProcessing ? 'Enqueuing...' : 'Enqueue All to Downloads'}</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-brand-border/40">
            {parsedUrls.map((url, i) => (
              <div key={i} className="pt-1.5 flex items-center justify-between text-xs text-brand-grey font-mono">
                <span className="truncate pr-4">{url}</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-brand-black text-brand-lime border border-brand-border flex-shrink-0">
                  Ready
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

