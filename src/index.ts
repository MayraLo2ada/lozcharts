/** LozChart: gráficos SVG interactivos, accesibles y sin dependencias. */
import { LozChart } from './chart';
import { LozMultiples } from './multiples';
import { line } from './series/line';
import { bar } from './series/bar';
import { area } from './series/area';
import { step } from './series/step';
import { range } from './series/range';
import { bubble, scatter } from './series/scatter';
import { candlestick, ohlc } from './series/candlestick';

LozChart.registerSeries('line', line);
LozChart.registerSeries('bar', bar);
LozChart.registerSeries('area', area);
LozChart.registerSeries('step', step);
LozChart.registerSeries('range', range);
LozChart.registerSeries('scatter', scatter);
LozChart.registerSeries('bubble', bubble);
LozChart.registerSeries('candlestick', candlestick);
LozChart.registerSeries('ohlc', ohlc);

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
