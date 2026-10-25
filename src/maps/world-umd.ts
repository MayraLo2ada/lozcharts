/**
 * Mapa del mundo para `<script>`: se carga después de lozcharts.umd.js y registra el mapa en
 * window.LozChart como 'mundo' y 'world'. También queda en window.LozChartWorld.
 */
import type { MapSource } from '../core/geo';
import { world } from './world';

const host = (globalThis as { LozChart?: { registerMap(name: string, source: MapSource): void } }).LozChart;
if (host) {
  host.registerMap('mundo', world);
  host.registerMap('world', world);
} else {
  console.warn('LozChart: carga lozcharts.umd.js antes del mapa del mundo.');
}

export default world;
