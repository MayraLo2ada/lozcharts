/** Serie de área: relleno del color de la serie al 10 % y su línea encima. Apilable. */
import type { SeriesImpl } from '../core/series';
import { areaPath, linePath } from '../core/shapes';
import { attrs } from '../core/dom';
import { hoverDot, points } from './line';

export const area: SeriesImpl = {
  layer: 1,
  stackable: true,
  includeZero: true,
  legendSymbol: 'square',
  label: 'áreas',
  draw(ctx) {
    const f = ctx.frame;
    const smooth = !!f.ps.options.smooth;
    const top = points(ctx, f.y1);
    const bottom = points(ctx, f.y0);
    const fill = areaPath(top, bottom, smooth);
    const stroke = linePath(top, smooth);
    let s = '';
    if (fill) s += `<path${attrs({ d: fill, fill: f.ps.color, 'fill-opacity': 0.1 })}/>`;
    if (stroke)
      s += `<path${attrs({
        d: stroke,
        fill: 'none',
        stroke: f.ps.color,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      })}/>`;
    return s;
  },
  hover: hoverDot,
};
