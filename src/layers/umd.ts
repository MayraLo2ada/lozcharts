/**
 * Gráficos por capas para <script>: se carga después de lozcharts.umd.js y conecta todo en
 * window.LozChart: LozChart.layers(el, spec), LozChart.layerOptions, LozChart.checkLayers y
 * LozChart.ICON_NAMES. También queda en window.LozChartLayers.
 */
import { register } from './register';
import { layerOptions } from './render';
import { checkLayers } from './compile';
import { ICON_NAMES } from './icons';

const host = (globalThis as { LozChart?: Parameters<typeof register>[0] }).LozChart;
if (host) {
  register(host);
  Object.assign(host, { layerOptions, checkLayers, ICON_NAMES });
} else {
  // Sin LozCharts cargado tampoco está su catálogo de idiomas: el aviso trae sus tres versiones.
  const lang = (typeof document !== 'undefined' ? document.documentElement?.lang : '')?.slice(0, 2).toLowerCase();
  console.warn(
    lang === 'es'
      ? 'LozCharts: carga lozcharts.umd.js antes de layers.umd.js; si no, los gráficos por capas no quedan conectados.'
      : lang === 'pt'
        ? 'LozCharts: carregue lozcharts.umd.js antes de layers.umd.js; senão, os gráficos em camadas não ficam conectados.'
        : "LozCharts: load lozcharts.umd.js before layers.umd.js; otherwise layered charts aren't connected.",
  );
}

export default { layerOptions, checkLayers, ICON_NAMES };
