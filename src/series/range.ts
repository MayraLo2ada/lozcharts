/**
 * Banda de rango: el área entre un límite inferior (`low`) y uno superior (`field`).
 * Sirve para mínimos y máximos, intervalos de confianza o metas con tolerancia;
 * suele ir con una línea encima que marque el valor central.
 */
import type { SeriesImpl } from '../core/series';
import { areaPath } from '../core/shapes';
import { attrs } from '../core/dom';
import { points, visible } from './common';

/** Más tenue que un área: la banda es contexto, no protagonista. */
const FILL_OPACITY = 0.16;

export const range: SeriesImpl = {
  layer: 1,
  legendSymbol: 'square',
  label: 'bandas de rango',
  columns: (o) => ({ low: o.low }),
  valueColumns: ['low'],
  draw(ctx) {
    const idx = visible(ctx, ctx.frame.y1, ctx.frame.cols.low);
    const d = areaPath(points(ctx, ctx.frame.y1, idx), points(ctx, ctx.frame.cols.low, idx), !!ctx.frame.ps.options.smooth);
    return d ? `<path${attrs({ d, fill: ctx.color, 'fill-opacity': FILL_OPACITY })}/>` : '';
  },
  tooltip(ps, i, format) {
    const lo = ps.columns.low[i];
    const hi = ps.values[i];
    if (!isFinite(lo) || !isFinite(hi)) return { value: 'Sin dato' };
    return { value: `${format.value(lo)} – ${format.value(hi)}` };
  },
};
