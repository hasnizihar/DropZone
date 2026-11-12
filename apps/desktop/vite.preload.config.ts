import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';

export default defineConfig({
  resolve: {
    alias: {
      '@dropzone/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    target: 'node20',
    outDir: 'dist/preload',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'electron/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    minify: false,
  },
});
