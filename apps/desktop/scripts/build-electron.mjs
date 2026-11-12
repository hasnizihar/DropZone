import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');

try {
  // Build Main process
  await esbuild.build({
    entryPoints: [path.join(desktopRoot, 'electron/main/index.ts')],
    outfile: path.join(desktopRoot, 'dist/main/index.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
  });

  // Build Preload script
  await esbuild.build({
    entryPoints: [path.join(desktopRoot, 'electron/preload/index.ts')],
    outfile: path.join(desktopRoot, 'dist/preload/index.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
  });

  console.log('Electron main & preload compiled successfully.');
} catch (err) {
  console.error('Failed to compile electron:', err);
  process.exit(1);
}
