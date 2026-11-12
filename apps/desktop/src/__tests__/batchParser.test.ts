import { describe, it, expect } from 'vitest';
import { parseBatchUrls } from '@dropzone/shared';

describe('parseBatchUrls', () => {
  it('parses newline-separated URLs cleanly', () => {
    const input = `https://example.com/video1.mp4\nhttps://example.com/video2.mp4\nhttps://example.com/file.zip`;
    const res = parseBatchUrls(input);
    expect(res.urls).toHaveLength(3);
    expect(res.urls[0]).toBe('https://example.com/video1.mp4');
    expect(res.urls[1]).toBe('https://example.com/video2.mp4');
    expect(res.urls[2]).toBe('https://example.com/file.zip');
    expect(res.excessCount).toBe(0);
    expect(res.totalFound).toBe(3);
  });

  it('handles empty input and whitespace safely', () => {
    const res1 = parseBatchUrls('');
    expect(res1.urls).toHaveLength(0);
    expect(res1.totalFound).toBe(0);

    const res2 = parseBatchUrls('   \n\n\t  \n  ');
    expect(res2.urls).toHaveLength(0);
    expect(res2.totalFound).toBe(0);
  });

  it('deduplicates duplicate URLs while preserving original insertion order', () => {
    const input = `
      https://example.com/first.mp4
      https://example.com/second.mp4
      https://example.com/first.mp4
      https://example.com/third.mp4
      https://example.com/second.mp4
    `;
    const res = parseBatchUrls(input);
    expect(res.urls).toHaveLength(3);
    expect(res.urls).toEqual([
      'https://example.com/first.mp4',
      'https://example.com/second.mp4',
      'https://example.com/third.mp4',
    ]);
  });

  it('extracts URLs embedded in free text or prose without parsing non-URLs', () => {
    const input = `
      Check out this link: https://youtube.com/watch?v=12345, and also
      download the package from https://github.com/project/releases/tag/v1.0.tar.gz.
      Do not parse regular words like not-a-url or ftp://unsupported.
    `;
    const res = parseBatchUrls(input);
    expect(res.urls).toHaveLength(2);
    expect(res.urls[0]).toBe('https://youtube.com/watch?v=12345');
    expect(res.urls[1]).toBe('https://github.com/project/releases/tag/v1.0.tar.gz');
  });

  it('enforces maximum batch limit (default 50) and reports excess count', () => {
    // Generate 65 unique URLs
    const urls = Array.from({ length: 65 }, (_, i) => `https://example.com/item-${i + 1}.mp4`);
    const input = urls.join('\n');

    const res = parseBatchUrls(input, 50);
    expect(res.urls).toHaveLength(50);
    expect(res.totalFound).toBe(65);
    expect(res.excessCount).toBe(15);
    expect(res.warning).toContain('Batch limit reached: only the first 50 URLs will be processed. 15 excess URLs were omitted.');
  });
});
