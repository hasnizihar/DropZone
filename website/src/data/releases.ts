export interface ReleaseAsset {
  name: string;
  type: string;
  filename: string;
  size: string;
  sha256: string;
  recommended: boolean;
  description: string;
  downloadUrl: string;
}

export const CURRENT_RELEASE = {
  version: '1.0.0-alpha.12',
  tag: 'v1.0.0-alpha.12',
  date: 'November 13, 2026',
  license: 'MIT',
  platform: 'Windows 10 / 11 (64-bit)',
  websiteUrl: 'https://get-drop-zone.vercel.app',
  githubRepoUrl: 'https://github.com/hasnizihar/DropZone',
  releasesUrl: 'https://github.com/hasnizihar/DropZone/releases',
  latestReleaseUrl: 'https://github.com/hasnizihar/DropZone/releases/latest',
  issuesUrl: 'https://github.com/hasnizihar/DropZone/issues',
  assets: [
    {
      name: 'Windows Setup Installer',
      type: 'Installer (.exe)',
      filename: 'DROPZONE-Setup-1.0.0-alpha.12-x64.exe',
      size: '115.28 MB',
      sha256: '6f5df74630cf3f03c5ff973efd83530e8324dddf99bf60dacf5adae4703ed95f',
      recommended: true,
      description: 'Clean Inno Setup installation wizard with Desktop & Start Menu shortcuts. Seamless updates and uninstallation.',
      downloadUrl: 'https://github.com/hasnizihar/DropZone/releases/latest',
    },
    {
      name: 'Portable Standalone',
      type: 'Standalone (.exe)',
      filename: 'DROPZONE-Portable-1.0.0-alpha.12-x64.exe',
      size: '113.19 MB',
      sha256: '39c2edcbddb4ea897e2f5dd00fbea9840f9a08ea7056ec91780082afb26993e2',
      recommended: false,
      description: 'Zero-install portable binary. Ideal for USB drives and restricted environments with no admin privileges needed.',
      downloadUrl: 'https://github.com/hasnizihar/DropZone/releases/latest',
    },
  ] as ReleaseAsset[],
};

