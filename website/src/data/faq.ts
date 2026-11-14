export interface FAQItem {
  question: string;
  answer: string;
  category: 'General' | 'Installation' | 'Features' | 'Security';
}

export const FAQS: FAQItem[] = [
  {
    category: 'General',
    question: 'What is DROPZONE?',
    answer:
      'DROPZONE is a modern, open-source desktop download manager built specifically for Windows 10 and 11 (64-bit). It unifies direct HTTP/HTTPS file downloads, video and audio stream extraction (powered by yt-dlp), multi-image gallery downloading (powered by gallery-dl), and FFmpeg-based audio conversion into a single, cohesive, dark-mode interface.',
  },
  {
    category: 'Installation',
    question: 'Do I need to install Python on my computer to use DROPZONE?',
    answer:
      'No. DROPZONE bundles a fully self-contained Python 3.12 companion worker (dropzone-worker.exe) that packages yt-dlp, gallery-dl, requests, and psutil into a single executable. Everything runs out of the box with zero external runtime requirements.',
  },
  {
    category: 'Security',
    question: 'Why does Windows SmartScreen or Smart App Control show a warning?',
    answer:
      'DROPZONE is an independent, non-commercial open-source project. Because we do not pay for costly enterprise Extended Validation (EV) certificates, Microsoft Defender SmartScreen displays an "Unknown Publisher" notification until the release builds cryptographic download reputation. You can safely click "More info" and "Run anyway". On machines with Windows 11 Smart App Control enforced, unsigned binaries are blocked by kernel Code Integrity; we document the exact security diagnosis and signing paths in our repository.',
  },
  {
    category: 'Installation',
    question: 'Is FFmpeg required to run DROPZONE?',
    answer:
      'FFmpeg is optional for basic file downloads, but recommended if you want to merge separate high-resolution DASH video and audio streams, extract MP3 audio from videos, or remux video containers. DROPZONE detects FFmpeg automatically if installed via WinGet (`winget install Gyan.FFmpeg`) or placed in `%APPDATA%\\DROPZONE\\resources\\ffmpeg\\`.',
  },
  {
    category: 'Features',
    question: 'How does DROPZONE handle duplicate downloads and rate limits?',
    answer:
      'DROPZONE features atomic filename reservation (Stage 8.2), ensuring that queuing the same link multiple times produces unique filenames (e.g. video.mp4, video (1).mp4) rather than silently overwriting your files. It also implements RFC 9110 compliant HTTP 429 Retry-After parsing with exponential backoff and sidecar metadata caching to prevent server bans on resume.',
  },
  {
    category: 'Security',
    question: 'Does DROPZONE collect any telemetry or browsing data?',
    answer:
      'Zero telemetry. DROPZONE has no analytics trackers, no advertising beacons, and no cloud synchronization. Your download URLs, history, and preferences are stored exclusively on your own machine in a local SQLite database located at `%APPDATA%\\DROPZONE\\dropzone.db`.',
  },
  {
    category: 'General',
    question: 'What license is DROPZONE released under?',
    answer:
      'DROPZONE is released under the permissive MIT License. You are free to inspect, modify, fork, and contribute to the source code on GitHub. Third-party components like gallery-dl and FFmpeg are governed by strict subprocess isolation boundaries in full compliance with GPL licenses.',
  },
];
