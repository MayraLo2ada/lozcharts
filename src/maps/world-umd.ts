/**
 * Mapa del mundo para `<script>`: se carga después de lozcharts.umd.js y registra el mapa en
 * window.LozChart como 'mundo' y 'world'. También queda en window.LozChartWorld.
 */
import type { MapSource } from '../core/geo';
import { world } from './world';
import { withPortuguese } from './nomes';

withPortuguese(world);

const host = (globalThis as { LozChart?: { registerMap(name: string, source: MapSource): void } }).LozChart;
if (host) {
  host.registerMap('mundo', world);
  host.registerMap('world', world);
} else {
  // Sin LozCharts cargado tampoco está su catálogo de idiomas: el aviso trae sus tres versiones.
  const lang = (typeof document !== 'undefined' ? document.documentElement?.lang : '')?.slice(0, 2).toLowerCase();
  console.warn(
    lang === 'es'
      ? 'LozCharts: carga lozcharts.umd.js antes del mapa del mundo; si no, el mapa no queda registrado.'
      : lang === 'pt'
        ? 'LozCharts: carregue lozcharts.umd.js antes do mapa-múndi; senão, o mapa não fica registrado.'
        : "LozCharts: load lozcharts.umd.js before the world map; otherwise the map isn't registered.",
  );
}

export default world;
