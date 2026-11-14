import React from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { CURRENT_RELEASE } from '../data/releases';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-black border-t border-brand-border/60 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/icon.png" alt="DROPZONE Logo" className="w-8 h-8 rounded-lg" />
              <span className="font-bold text-lg tracking-wider text-brand-white">
                DROP<span className="text-brand-lime">ZONE</span>
              </span>
            </div>
            <p className="text-sm text-brand-grey leading-relaxed max-w-sm mb-6">
              A modern, high-contrast Windows desktop download manager engineered for media, streams,
              and files with deep format inspection and zero telemetry.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={CURRENT_RELEASE.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center text-brand-grey hover:text-brand-lime hover:border-brand-lime/40 transition-colors"
                aria-label="GitHub Repository"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-mono font-semibold text-brand-white uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-brand-grey">
              <li>
                <a href="#showcase" className="hover:text-brand-lime transition-colors">
                  Showcase
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-brand-lime transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-brand-lime transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#download" className="hover:text-brand-lime transition-colors">
                  Download
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brand-lime transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-mono font-semibold text-brand-white uppercase tracking-wider mb-4">
              Documentation
            </h4>
            <ul className="space-y-2.5 text-sm text-brand-grey">
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/docs/INSTALLATION.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors flex items-center gap-1"
                >
                  <span>Installation Guide</span>
                  <ExternalLink className="w-3 h-3 text-brand-grey/70" />
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/docs/RELEASE_CHECKSUMS.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors flex items-center gap-1"
                >
                  <span>Release Checksums</span>
                  <ExternalLink className="w-3 h-3 text-brand-grey/70" />
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/docs/WINDOWS_SIGNING_GUIDE.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors flex items-center gap-1"
                >
                  <span>Code Signing Guide</span>
                  <ExternalLink className="w-3 h-3 text-brand-grey/70" />
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/docs/TROUBLESHOOTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors flex items-center gap-1"
                >
                  <span>Troubleshooting</span>
                  <ExternalLink className="w-3 h-3 text-brand-grey/70" />
                </a>
              </li>
            </ul>
          </div>

          {/* Open Source Governance */}
          <div>
            <h4 className="text-xs font-mono font-semibold text-brand-white uppercase tracking-wider mb-4">
              Governance
            </h4>
            <ul className="space-y-2.5 text-sm text-brand-grey">
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/LICENSE`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors"
                >
                  MIT License
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/THIRD_PARTY_NOTICES.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors"
                >
                  Third-Party Notices
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/PRIVACY.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href={`${CURRENT_RELEASE.githubRepoUrl}/blob/master/SECURITY.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors"
                >
                  Security Policy
                </a>
              </li>
              <li>
                <a
                  href={CURRENT_RELEASE.issuesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-lime transition-colors"
                >
                  Report an Issue
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-brand-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-grey">
          <div>
            Copyright © 2026 <strong className="text-brand-white">Hz Creatives</strong> (KR Hasni
            Zihar). All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span>Built with precision for Windows desktop users</span>
            <span>·</span>
            <span className="text-brand-lime font-mono">v{CURRENT_RELEASE.version}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
