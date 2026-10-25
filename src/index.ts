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

LozChart.multiples = (target, options) => new LozMultiples(target, options);

export { LozChart, LozMultiples };
export default LozChart;
export { LIGHT, DARK } from './core/theme';
export type { Theme } from './core/theme';
export type { SeriesImpl, DrawContext, SeriesFrame, PreparedSeries, TooltipValue } from './core/series';
export type { XScale } from './core/scales';
export { LinearScale, BandScale, ContinuousScale } from './core/scales';
export { linePath, areaPath, barPath, stepPath } from './core/shapes';
export type * from './types';
