import { defineConfig } from 'vite';

// Dos pasadas: ESM (dist/lozcharts.js) y UMD (dist/lozcharts.umd.js, global window.LozChart).
const umd = process.env.LC_FORMAT === 'umd';

export default defineConfig({
  build: {
    emptyOutDir: !umd,
    sourcemap: true,
    minify: umd ? 'esbuild' : false,
    lib: umd
      ? { entry: 'src/umd.ts', name: 'LozChart', formats: ['umd'], fileName: () => 'lozcharts.umd.js' }
      : { entry: 'src/index.ts', formats: ['es'], fileName: () => 'lozcharts.js' },
    rollupOptions: { output: umd ? { exports: 'default' } : {} },
  },
});
