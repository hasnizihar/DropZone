import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { TitleBar } from '../components/layout/TitleBar';
import { Sidebar } from '../components/layout/Sidebar';
import { DashboardPage } from '../pages/DashboardPage';
import { useAppStore } from '../stores/useAppStore';

describe('Application Shell UI Components', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTab: 'dashboard',
      jobs: [],
      systemInfo: {
        version: '1.0.0',
        platform: 'win32',
        engines: {
          ytdlp: { name: 'yt-dlp', version: '2026.10.26', isAvailable: true },
          ffmpeg: { name: 'FFmpeg', version: '9.0.2', isAvailable: true },
          python: { name: 'Python', version: '3.12.10', isAvailable: true },
          workerRunning: false,
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  it('renders TitleBar with DROPZONE brand and version', () => {
    render(<TitleBar />);
    expect(screen.getByText('DROPZONE')).toBeDefined();
    expect(screen.getByText('v1.0.0')).toBeDefined();
  });

  it('renders Sidebar with all 7 navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('URL Analyzer')).toBeDefined();
    expect(screen.getByText('Downloads')).toBeDefined();
    expect(screen.getByText('Batch Process')).toBeDefined();
    expect(screen.getByText('History')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('About')).toBeDefined();
  });

  it('renders DashboardPage hero input and metrics cards', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Universal Downloader')).toBeDefined();
    expect(screen.getByText('Active Jobs')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('Total Downloaded')).toBeDefined();
    expect(screen.getByText('Engines Status')).toBeDefined();
    expect(screen.getByText('Analyze URL')).toBeDefined();
  });
});

