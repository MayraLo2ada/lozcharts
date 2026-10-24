/** Línea escalonada: el valor se mantiene hasta el cambio siguiente (tarifas, tasas, inventario). */
import type { SeriesImpl } from '../core/series';
import { stepPath } from '../core/shapes';
import { hoverDot, points, stroke } from './common';

export const step: SeriesImpl = {
  layer: 2,
  legendSymbol: 'line',
  label: 'líneas escalonadas',
  draw(ctx) {
    const d = stepPath(points(ctx, ctx.frame.y1), ctx.frame.ps.options.step ?? 'after');
    return d ? stroke(d, ctx.color) : '';
  },
  hover: hoverDot,
};
