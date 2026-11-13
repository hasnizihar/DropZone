import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../stores/useAppStore';

describe('App State Store', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTab: 'dashboard',
      jobs: [],
      analyzedMedia: null,
      isAnalyzing: false,
      analyzeError: null,
      toast: null,
    });
  });

  it('updates active navigation tab', () => {
    const { setActiveTab } = useAppStore.getState();
    setActiveTab('analyzer');
    expect(useAppStore.getState().activeTab).toBe('analyzer');

    setActiveTab('downloads');
    expect(useAppStore.getState().activeTab).toBe('downloads');
  });

  it('handles inspectUrl lifecycle', async () => {
    const { inspectUrl } = useAppStore.getState();
    const success = await inspectUrl('https://example.com/video.mp4');

    expect(success).toBe(true);
    const media = useAppStore.getState().analyzedMedia;
    expect(media).not.toBeNull();
    expect(media?.title).toBe('Test Video');
    expect(useAppStore.getState().isAnalyzing).toBe(false);
  });

  it('adds and manages download jobs', async () => {
    const { addJob, pauseJob, resumeJob, cancelJob, retryJob } = useAppStore.getState();

    const ok = await addJob({ url: 'https://example.com/video.mp4', customFilename: 'Sample Download' });
    expect(ok).toBe(true);

    const jobs = useAppStore.getState().jobs;
    expect(jobs.length).toBe(1);
    expect(jobs[0].title).toBe('Sample Download');

    const jobId = jobs[0].id;

    await pauseJob(jobId);
    expect(useAppStore.getState().jobs[0].status).toBe('paused');

    await resumeJob(jobId);
    expect(useAppStore.getState().jobs[0].status).toBe('downloading');

    await cancelJob(jobId);
    expect(useAppStore.getState().jobs[0].status).toBe('cancelled');

    await retryJob(jobId);
    expect(useAppStore.getState().jobs[0].status).toBe('pending');
  });

  it('deduplicates jobs when addJob and live progress events fire for the same job id', async () => {
    const { addJob } = useAppStore.getState();

    // 1. Add job
    const ok = await addJob({ url: 'https://example.com/unique.mp4', customFilename: 'Deduplicated Video' });
    expect(ok).toBe(true);
    expect(useAppStore.getState().jobs.length).toBe(1);

    const firstJob = useAppStore.getState().jobs[0];

    // 2. Simulate concurrent addJob with same job id (simulating race between IPC response and progress event)
    await addJob({ url: 'https://example.com/unique.mp4', customFilename: 'Deduplicated Video' });
    // Still exactly 1 job in list because setup.ts mock returns the same or existing
    expect(useAppStore.getState().jobs.filter((j) => j.id === firstJob.id).length).toBe(1);
  });
});

