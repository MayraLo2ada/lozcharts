/** Línea escalonada: el valor se mantiene hasta el cambio siguiente (tarifas, tasas, inventario). */
import type { SeriesImpl } from '../core/series';
import { stepPath } from '../core/shapes';
import { hoverDot, isolatedDots, points, stroke, visible } from './common';

export const step: SeriesImpl = {
  layer: 2,
  legendSymbol: 'line',
  endLabel: true,
  label: 'líneas escalonadas',
  draw(ctx) {
    const idx = visible(ctx, ctx.frame.y1);
    const d = stepPath(points(ctx, ctx.frame.y1, idx), ctx.frame.ps.options.step ?? 'after');
    return (d ? stroke(d, ctx.color) : '') + isolatedDots(ctx, ctx.frame.y1, idx);
  },
  hover: hoverDot,
};
