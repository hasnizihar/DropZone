import React, { useState, useEffect } from 'react';
import { Download, Menu, X, ExternalLink } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { CURRENT_RELEASE } from '../data/releases';

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-brand-black/90 backdrop-blur-md border-b border-brand-border/60 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <a href="#" className="flex items-center gap-3 group">
            <img
              src="/icon.png"
              alt="DROPZONE Logo"
              className="w-8 h-8 rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider text-brand-white">
                DROP<span className="text-brand-lime">ZONE</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface border border-brand-border text-brand-lime font-mono">
                {CURRENT_RELEASE.version}
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-grey">
            <a href="#showcase" className="hover:text-brand-lime transition-colors">
              Showcase
            </a>
            <a href="#features" className="hover:text-brand-lime transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-brand-lime transition-colors">
              How It Works
            </a>
            <a href="#open-source" className="hover:text-brand-lime transition-colors">
              Open Source
            </a>
            <a href="#faq" className="hover:text-brand-lime transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={CURRENT_RELEASE.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-brand-white bg-brand-surface border border-brand-border hover:border-brand-grey/60 hover:text-brand-lime transition-all"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3 text-brand-grey" />
            </a>

            <a
              href={CURRENT_RELEASE.latestReleaseUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-brand-black bg-brand-lime hover:bg-[#e0ff80] transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-brand-grey hover:text-brand-white hover:bg-brand-surface border border-transparent hover:border-brand-border"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 p-4 rounded-xl bg-brand-surface border border-brand-border shadow-xl space-y-3">
            <nav className="flex flex-col space-y-2 text-sm text-brand-white font-medium">
              <a
                href="#showcase"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-brand-card hover:text-brand-lime"
              >
                Showcase
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-brand-card hover:text-brand-lime"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-brand-card hover:text-brand-lime"
              >
                How It Works
              </a>
              <a
                href="#open-source"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-brand-card hover:text-brand-lime"
              >
                Open Source
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-brand-card hover:text-brand-lime"
              >
                FAQ
              </a>
            </nav>

            <div className="pt-3 border-t border-brand-border/60 flex flex-col gap-2">
              <a
                href={CURRENT_RELEASE.githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-brand-white bg-brand-card border border-brand-border"
              >
                <GithubIcon className="w-4 h-4" />
                <span>View on GitHub</span>
              </a>
              <a
                href={CURRENT_RELEASE.latestReleaseUrl}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-brand-black bg-brand-lime"
              >
                <Download className="w-4 h-4" />
                <span>Download for Windows</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
