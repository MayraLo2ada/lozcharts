/** LozCharts: gráficos SVG interactivos, accesibles y sin dependencias. Cada gráfico es un LozChart. */
import { LozChart } from './chart';
import { LozMultiples } from './multiples';
import { line } from './series/line';
import { bar } from './series/bar';
import { area } from './series/area';
import { step } from './series/step';
import { range } from './series/range';
import { bubble, scatter } from './series/scatter';
import { candlestick, ohlc } from './series/candlestick';
import { donut, pie } from './series/pie';
import { gauge } from './series/gauge';
import { radar } from './series/radar';
import { funnel } from './series/funnel';
import { heatmap } from './series/heatmap';
import { treemap } from './series/treemap';
import { sankey } from './series/sankey';
import { choropleth, mapbubble } from './series/map';
import { waterfall } from './series/waterfall';
import { bullet } from './series/bullet';
import { sunburst } from './series/sunburst';
import { chord } from './series/chord';
import { timeline } from './series/timeline';
import { wordcloud } from './series/wordcloud';
import { network } from './series/network';
import { layers, layerOptions, optionsOf } from './layers/render';
import { buildModel } from './layers/compile';

LozChart.registerSeries('line', line);
LozChart.registerSeries('bar', bar);
LozChart.registerSeries('area', area);
LozChart.registerSeries('step', step);
LozChart.registerSeries('range', range);
LozChart.registerSeries('scatter', scatter);
LozChart.registerSeries('bubble', bubble);
LozChart.registerSeries('candlestick', candlestick);
LozChart.registerSeries('ohlc', ohlc);
LozChart.registerSeries('pie', pie);
LozChart.registerSeries('donut', donut);
LozChart.registerSeries('gauge', gauge);
LozChart.registerSeries('radar', radar);
LozChart.registerSeries('funnel', funnel);
LozChart.registerSeries('heatmap', heatmap);
LozChart.registerSeries('treemap', treemap);
LozChart.registerSeries('sankey', sankey);
LozChart.registerSeries('choropleth', choropleth);
LozChart.registerSeries('mapbubble', mapbubble);
LozChart.registerSeries('waterfall', waterfall);
LozChart.registerSeries('bullet', bullet);
LozChart.registerSeries('sunburst', sunburst);
LozChart.registerSeries('chord', chord);
LozChart.registerSeries('timeline', timeline);
LozChart.registerSeries('wordcloud', wordcloud);
LozChart.registerSeries('network', network);
LozChart.registerSeries('layers', layers);

LozChart.multiples = (target, options) => new LozMultiples(target, options);
// Gráficos por capas: se revisa la especificación, se avisa en la consola lo que esté mal (en el
// idioma del gráfico) y se dibuja lo demás.
LozChart.layers = (target, spec) => {
  const model = buildModel(spec);
  for (const p of model.problems) console.warn(`LozCharts: ${p.path ? p.path + ': ' : ''}${p.message}`);
  return new LozChart(target, optionsOf(model));
};

export { LozChart, LozMultiples };
export default LozChart;
export { LIGHT, DARK } from './core/theme';
// Idiomas: el catálogo de textos (para extensiones y tipos de serie propios) y cómo se elige.
export { messages, registerLocale, defaultLocale, localized } from './core/i18n';
export type { Messages, PartialMessages, TypeTexts, Words, Localized } from './core/i18n';
export type { Theme } from './core/theme';
export type {
  SeriesImpl,
  DrawContext,
  DrawPurpose,
  SeriesFrame,
  PreparedSeries,
  TooltipValue,
  TooltipFormat,
} from './core/series';
export type { XScale } from './core/scales';
export type { MapSource, Topology, GeoJSON } from './core/geo';
export { LinearScale, LogScale, BandScale, ContinuousScale } from './core/scales';
export { linePath, areaPath, barPath, stepPath, polarPoint, r2 } from './core/shapes';
export type * from './types';

// Piezas del núcleo para quien crea tipos de serie o extensiones: las mismas con las que se dibujan
// los tipos de la librería, para que lo nuevo se vea y se comporte igual.
export { swatchOf, DIM_OPACITY, dimOpacity, dimmed, paintDimmed } from './core/series';
export { MAX_COLORS } from './core/theme';
export type { RGB, Lab, Ramp, Paint, Domain, LegendSpec } from './core/color';
export {
  parseColor,
  toHex,
  toOklab,
  fromOklab,
  mixOklab,
  luminance,
  contrast,
  textOn,
  inkFor,
  colorDomain,
  makeRamp,
  paint,
  paintColor,
  legendSpec,
  legendWidth,
} from './core/color';
export type { NumberContext } from './core/format';
export { valueFormatter, compactFormatter, axisFormatter, parseTime, timeTickLabel, timeFullLabel } from './core/format';
export type { TimeUnit, TimeInterval } from './core/ticks';
export {
  niceStep,
  niceDomain,
  numberTicks,
  logTicks,
  logDomain,
  chooseTimeInterval,
  timeTicks,
  detectTimeUnit,
} from './core/ticks';
export { esc, attrs, textWidth } from './core/dom';
export { fitText } from './core/axis';
export { toCSV, slug } from './core/export';

// Gráficos por capas: las opciones de una especificación, su revisión y las piezas para el editor.
export { layerOptions };
export { checkLayers } from './layers/compile';
export { ICON_NAMES } from './layers/icons';
export type {
  LayerSpec,
  Layer,
  LayerProblem,
  LayerFormat,
  ColorScale,
  Cond,
  Mapping,
  PathIcon,
  ImageIcon,
  AxisSpec,
  GeoSpec,
  NetworkSpec,
} from './layers/spec';
