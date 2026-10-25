import { defineConfig } from 'vite';

// Tres pasadas:
// - ESM (dist/lozcharts.js), para import.
// - UMD (dist/lozcharts.umd.js, global window.LozChart), para <script>.
// - React (dist/react.js), que importa 'lozcharts' y 'react' sin copiarlos.
const format = process.env.LC_FORMAT;

const lib =
  format === 'umd'
    ? { entry: 'src/umd.ts', name: 'LozChart', formats: ['umd' as const], fileName: () => 'lozcharts.umd.js' }
    : format === 'react'
      ? { entry: 'src/react.ts', formats: ['es' as const], fileName: () => 'react.js' }
      : { entry: 'src/index.ts', formats: ['es' as const], fileName: () => 'lozcharts.js' };

export default defineConfig({
  build: {
    emptyOutDir: !format,
    sourcemap: true,
    minify: format === 'umd' ? 'esbuild' : false,
    lib,
    rollupOptions: {
      external: format === 'react' ? ['react', 'lozcharts'] : [],
      output: format === 'umd' ? { exports: 'default' } : {},
    },
  },
});
