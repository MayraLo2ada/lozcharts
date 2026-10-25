import { defineConfig } from 'vite';

// Pasadas del build (LC_FORMAT):
// - (ninguna) ESM: dist/lozcharts.js, para import.
// - umd: dist/lozcharts.umd.js (global window.LozChart), para <script>.
// - react: dist/react.js, que importa 'lozcharts' y 'react' sin copiarlos.
// - world: dist/maps/world.js (ESM, registra el mapa en 'lozcharts') y
// - world-umd: dist/maps/world.umd.js (registra el mapa en window.LozChart).
const format = process.env.LC_FORMAT;

const libs = {
  umd: { entry: 'src/umd.ts', name: 'LozChart', formats: ['umd' as const], fileName: () => 'lozcharts.umd.js' },
  react: { entry: 'src/react.ts', formats: ['es' as const], fileName: () => 'react.js' },
  world: { entry: 'src/maps/register-world.ts', formats: ['es' as const], fileName: () => 'maps/world.js' },
  'world-umd': {
    entry: 'src/maps/world-umd.ts',
    name: 'LozChartWorld',
    formats: ['umd' as const],
    fileName: () => 'maps/world.umd.js',
  },
};
const lib = libs[format as keyof typeof libs] ?? {
  entry: 'src/index.ts',
  formats: ['es' as const],
  fileName: () => 'lozcharts.js',
};
const umd = format === 'umd' || format === 'world-umd';

export default defineConfig({
  build: {
    emptyOutDir: !format,
    sourcemap: true,
    minify: umd ? 'esbuild' : false,
    lib,
    rollupOptions: {
      external: format === 'react' ? ['react', 'lozcharts'] : format === 'world' ? ['lozcharts'] : [],
      output: umd ? { exports: 'default' } : {},
    },
  },
});
