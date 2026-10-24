/** LozChart: gráficos SVG interactivos, accesibles y sin dependencias. */
import { LozChart } from './chart';
import { line } from './series/line';
import { bar } from './series/bar';
import { area } from './series/area';

LozChart.registerSeries('line', line);
LozChart.registerSeries('bar', bar);
LozChart.registerSeries('area', area);

export { LozChart };
export default LozChart;
export { LIGHT, DARK } from './core/theme';
export type { Theme } from './core/theme';
export type { SeriesImpl, DrawContext, SeriesFrame, PreparedSeries } from './core/series';
export type { XScale } from './core/scales';
export { LinearScale, BandScale, ContinuousScale } from './core/scales';
export { linePath, areaPath, barPath } from './core/shapes';
export type * from './types';
