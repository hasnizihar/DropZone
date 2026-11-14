import React, { useState } from 'react';
import { Download, Check, Copy, Terminal, ShieldAlert } from 'lucide-react';
import { CURRENT_RELEASE } from '../data/releases';

export const CTA: React.FC = () => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <section id="download" className="py-20 md:py-28 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-brand-lime/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Section Header */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs text-brand-white mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-lime" />
          <span>CURRENT RELEASE: {CURRENT_RELEASE.tag}</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-brand-white tracking-tight leading-tight">
          Download DROPZONE for <span className="text-brand-lime">Windows</span>.
        </h2>

        <p className="mt-4 text-base sm:text-lg text-brand-grey max-w-2xl mx-auto font-normal">
          Get the fast, local-first desktop download manager. Choose between our lightweight Inno
          Setup wizard or the zero-install portable binary.
        </p>

        {/* Release Cards Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {CURRENT_RELEASE.assets.map((asset) => (
            <div
              key={asset.filename}
              className={`p-6 sm:p-8 rounded-2xl bg-brand-surface/70 border transition-all flex flex-col justify-between ${
                asset.recommended
                  ? 'border-brand-lime/70 shadow-xl shadow-brand-lime/5 ring-1 ring-brand-lime/30'
                  : 'border-brand-border/70 hover:border-brand-grey/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-brand-card border border-brand-border text-brand-white">
                    {asset.type}
                  </span>
                  {asset.recommended && (
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-brand-lime text-brand-black">
                      RECOMMENDED
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-brand-white">{asset.name}</h3>
                <p className="mt-2 text-sm text-brand-grey leading-relaxed">{asset.description}</p>

                <div className="mt-4 flex items-center gap-4 text-xs font-mono text-brand-grey">
                  <span>Size: {asset.size}</span>
                  <span>·</span>
                  <span>Arch: Windows x64</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-brand-border/50">
                <a
                  href={asset.downloadUrl}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                    asset.recommended
                      ? 'bg-brand-lime text-brand-black hover:bg-[#e0ff80]'
                      : 'bg-brand-card text-brand-white border border-brand-border hover:border-brand-grey/60'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Download {asset.filename}</span>
                </a>

                {/* SHA256 Snippet */}
                <div className="mt-4 flex items-center justify-between p-2.5 rounded-lg bg-brand-black/60 border border-brand-border/40 text-[11px] font-mono text-brand-grey">
                  <span className="truncate mr-2">SHA-256: {asset.sha256}</span>
                  <button
                    onClick={() => copyToClipboard(asset.sha256, asset.filename)}
                    className="p-1 rounded hover:text-brand-lime shrink-0"
                    title="Copy SHA-256 Checksum"
                  >
                    {copiedHash === asset.filename ? (
                      <Check className="w-3.5 h-3.5 text-brand-lime" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Verification Note */}
        <div className="mt-10 p-5 rounded-2xl bg-brand-surface/40 border border-brand-border/60 max-w-3xl mx-auto flex items-start gap-4 text-left">
          <Terminal className="w-5 h-5 text-brand-lime shrink-0 mt-0.5" />
          <div className="text-xs text-brand-grey leading-relaxed">
            <span className="font-semibold text-brand-white">Verify Integrity in PowerShell:</span>{' '}
            Run{' '}
            <code className="text-brand-lime bg-brand-black px-1.5 py-0.5 rounded font-mono">
              Get-FileHash -Algorithm SHA256 &lt;downloaded-file&gt;
            </code>{' '}
            and compare with our published hashes. Because DROPZONE is an independent open-source
            pre-release, Windows SmartScreen will display an &ldquo;Unknown Publisher&rdquo; prompt on first launch
            — click <strong className="text-brand-white">More info &rarr; Run anyway</strong>.
          </div>
        </div>
      </div>
    </section>
  );
};
