/** Serie de línea: 2 px, uniones redondeadas; `smooth` usa la curva monótona. */
import type { SeriesImpl } from '../core/series';
import { linePath } from '../core/shapes';
import { hoverDot, isolatedDots, points, stroke } from './common';

export const line: SeriesImpl = {
  layer: 2,
  legendSymbol: 'line',
  endLabel: true,
  label: 'líneas',
  draw(ctx) {
    const d = linePath(points(ctx, ctx.frame.y1), !!ctx.frame.ps.options.smooth);
    return (d ? stroke(d, ctx.color) : '') + isolatedDots(ctx, ctx.frame.y1);
  },
  hover: hoverDot,
};
