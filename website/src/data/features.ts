export interface Feature {
  id: string;
  title: string;
  category: string;
  description: string;
  badge: string;
  highlights: string[];
}

export const FEATURES: Feature[] = [
  {
    id: 'deep-analyzer',
    title: 'Deep Stream & Format Analyzer',
    category: 'Inspection',
    badge: 'Dual Engine',
    description:
      'Paste any video, playlist, or streaming link to inspect all available video streams, audio codecs, bitrates, container formats, and estimated file sizes before initiating the download.',
    highlights: [
      'Visual resolution badges (4K UHD, 1440p, 1080p, 720p)',
      'Dedicated tabs for Video + Audio, Video Only, and Audio Only',
      'Selectable container conversion (MP4, MKV, WebM)',
      'Direct clipboard paste shortcut with one-click inspection',
    ],
  },
  {
    id: 'dual-engine',
    title: 'Dual-Engine Architecture',
    category: 'Throughput',
    badge: 'yt-dlp + HTTP',
    description:
      'High-throughput downloads for traditional direct HTTP/HTTPS files with range resume, paired seamlessly with an embedded Python 3.12 companion worker packaging yt-dlp and gallery-dl.',
    highlights: [
      'Self-contained companion worker — no Python installation required',
      'Accelerated chunked streaming with parallel socket pipelines',
      'Automatic media merging of separate DASH video/audio streams',
      'Bi-directional JSON-Lines IPC with self-healing recovery',
    ],
  },
  {
    id: 'local-first',
    title: '100% Local-First & Zero Telemetry',
    category: 'Privacy',
    badge: 'Private',
    description:
      'Your download habits, queue items, and preferences belong strictly to you. DROPZONE features zero cloud accounts, zero third-party analytics, and zero tracking pings.',
    highlights: [
      'Durable embedded SQLite persistence layer (sql.js WebAssembly)',
      'All history and config saved locally to %APPDATA%\\DROPZONE',
      'Zero remote telemetry, Google Analytics, or diagnostic beacons',
      'Completely functional offline or behind strict network firewalls',
    ],
  },
  {
    id: 'batch-downloader',
    title: 'Batch & Playlist Ingestion',
    category: 'Automation',
    badge: 'Bulk Queues',
    description:
      'Ingest complete media playlists (up to 200 items) or multi-URL batches via plain text or CSV imports, with parallel manifest analysis and per-item quality control.',
    highlights: [
      'Text file, CSV, or direct multi-line text input dropzone',
      'Automatic URL classification into MEDIA, FILE, and IMAGE sets',
      'Batch-wide concurrency management with pause and resume controls',
      'Aggregated progress indicators and real-time failure isolation',
    ],
  },
  {
    id: 'audio-conversion',
    title: 'Audio Extraction & Transcoding',
    category: 'Media Engine',
    badge: 'FFmpeg Ready',
    description:
      'Extract high-fidelity audio tracks from video streams or transcode local files into MP3, FLAC, M4A, WAV, or OPUS with selectable bitrates (128 kbps to 320 kbps).',
    highlights: [
      'Lossless and compressed audio profiles with custom bitrates',
      'Container remuxing without re-encoding to preserve video fidelity',
      'Non-blocking background FFmpeg job queue with progress tracking',
      'Automatic discovery of system-installed FFmpeg via WinGet',
    ],
  },
  {
    id: 'resilience',
    title: 'Rate-Limit Backoff & Collision Safety',
    category: 'Reliability',
    badge: 'Resilient',
    description:
      'Engineered for real-world network edge cases: RFC 9110 HTTP 429 Retry-After handling, sidecar resume caching, and atomic filename reservation preventing silent overwrites.',
    highlights: [
      'Exponential backoff with jitter avoids server rate-limit bans',
      'Atomic filename reservation prevents duplicate file collisions',
      'Windows reserved device name protection (CON, PRN, AUX, NUL)',
      'Crash recovery restores active and pending queues on relaunch',
    ],
  },
];
