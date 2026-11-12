import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchPage } from '../pages/BatchPage';
import { useAppStore } from '../stores/useAppStore';

describe('BatchPage Component', () => {
  beforeEach(() => {
    useAppStore.setState({
      batchItems: [],
      isAnalyzingBatch: false,
    });
  });

  it('renders batch input interface cleanly', () => {
    render(<BatchPage />);
    expect(screen.getByText('Batch Processing')).toBeDefined();
    expect(screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/)).toBeDefined();
  });

  it('shows recognized count and warning when input exceeds 50 URLs', () => {
    render(<BatchPage />);
    const textarea = screen.getByPlaceholderText(/https:\/\/www\.youtube\.com/);

    const urls = Array.from({ length: 55 }, (_, i) => `https://example.com/item-${i + 1}.mp4`).join('\n');
    fireEvent.change(textarea, { target: { value: urls } });

    expect(screen.getByText(/50 recognized/)).toBeDefined();
    expect(screen.getByText(/Batch limit reached: only the first 50 URLs will be processed/)).toBeDefined();
  });

  it('renders batch review cards and action buttons when batchItems are present', () => {
    useAppStore.setState({
      batchItems: [
        {
          id: 'item_1',
          url: 'https://example.com/file1.zip',
          status: 'ready',
          title: 'file1.zip',
          downloadType: 'file',
          selected: true,
          fileSizeBytes: 10485760,
        },
        {
          id: 'item_2',
          url: 'https://example.com/video2.mp4',
          status: 'failed',
          title: 'video2.mp4',
          downloadType: 'media',
          selected: false,
          error: 'Connection timeout',
        },
      ],
    });

    render(<BatchPage />);
    expect(screen.getByText('Batch Review (2 items)')).toBeDefined();
    expect(screen.getByText('file1.zip')).toBeDefined();
    expect(screen.getByText('video2.mp4')).toBeDefined();
    expect(screen.getByText('FILE')).toBeDefined();
    expect(screen.getByText('MEDIA')).toBeDefined();
    expect(screen.getByText('Connection timeout')).toBeDefined();
    expect(screen.getByText('Enqueue 1 Downloads')).toBeDefined();
  });
});
