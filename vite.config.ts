import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Pasadas del build (LC_FORMAT):
// - (ninguna) ESM: dist/lozcharts.js, para import.
// - umd: dist/lozcharts.umd.js (global window.LozChart), para <script>.
// - react: dist/react.js, que importa '@lozcharts/core' y 'react' sin copiarlos.
// - element: dist/element.js, el elemento <loz-chart> (importa '@lozcharts/core').
// - world: dist/maps/world.js (ESM, registra el mapa en '@lozcharts/core') y
// - world-umd: dist/maps/world.umd.js (registra el mapa en window.LozChart), y world-cjs para require.
// Para require, el UMD se copia como lozcharts.umd.cjs: con "type": "module", Node leería un .js como ESM.
const format = process.env.LC_FORMAT;

const libs = {
  umd: { entry: 'src/umd.ts', name: 'LozChart', formats: ['umd' as const], fileName: () => 'lozcharts.umd.js' },
  react: { entry: 'src/react.ts', formats: ['es' as const], fileName: () => 'react.js' },
  world: { entry: 'src/maps/register-world.ts', formats: ['es' as const], fileName: () => 'maps/world.js' },
  element: { entry: 'src/element.ts', formats: ['es' as const], fileName: () => 'element.js' },
  // Para require: el mapa como CommonJS, que hace require('@lozcharts/core') y lo registra ahí.
  'world-cjs': { entry: 'src/maps/register-world.ts', formats: ['cjs' as const], fileName: () => 'maps/world.cjs' },
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
  // En el UMD todo va junto: '@lozcharts/core' (que importa <loz-chart>) es el propio código fuente.
  resolve: umd ? { alias: { '@lozcharts/core': fileURLToPath(new URL('./src/index.ts', import.meta.url)) } } : {},
  build: {
    emptyOutDir: !format,
    // El mapa del mundo son datos: un sourcemap solo duplicaría sus 110 KB.
    sourcemap: !format?.startsWith('world'),
    minify: umd ? 'esbuild' : false,
    lib,
    rollupOptions: {
      external:
        format === 'react'
          ? ['react', '@lozcharts/core']
          : format === 'world' || format === 'world-cjs' || format === 'element'
            ? ['@lozcharts/core']
            : [],
      output: umd ? { exports: 'default' } : {},
    },
  },
});
