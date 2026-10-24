import { defineConfig } from 'vite';

// Dos pasadas: ESM (dist/lozchart.js) y UMD (dist/lozchart.umd.js, global window.LozChart).
const umd = process.env.LC_FORMAT === 'umd';

export default defineConfig({
  build: {
    emptyOutDir: !umd,
    sourcemap: true,
    minify: umd ? 'esbuild' : false,
    lib: umd
      ? { entry: 'src/umd.ts', name: 'LozChart', formats: ['umd'], fileName: () => 'lozchart.umd.js' }
      : { entry: 'src/index.ts', formats: ['es'], fileName: () => 'lozchart.js' },
    rollupOptions: { output: umd ? { exports: 'default' } : {} },
  },
});
