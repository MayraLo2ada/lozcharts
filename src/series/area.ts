/** Serie de área: relleno del color de la serie al 10 % con su línea encima. Apilable. */
import type { SeriesImpl } from '../core/series';
import { areaPath, linePath } from '../core/shapes';
import { attrs } from '../core/dom';
import { hoverDot, points, stroke } from './common';

export const area: SeriesImpl = {
  layer: 1,
  stackable: true,
  includeZero: true,
  legendSymbol: 'square',
  label: 'áreas',
  draw(ctx) {
    const { frame, color } = ctx;
    const smooth = !!frame.ps.options.smooth;
    const top = points(ctx, frame.y1);
    const fill = areaPath(top, points(ctx, frame.y0), smooth);
    const edge = linePath(top, smooth);
    return (fill ? `<path${attrs({ d: fill, fill: color, 'fill-opacity': 0.1 })}/>` : '') + (edge ? stroke(edge, color) : '');
  },
  hover: hoverDot,
};
