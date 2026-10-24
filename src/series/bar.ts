/**
 * Serie de barras (agrupadas o apiladas).
 * Máximo 24 px de grosor, punta de datos redondeada 4 px, base recta y 2 px de
 * separación (espacio, no borde) entre barras vecinas y entre segmentos apilados.
 */
import type { DrawContext, SeriesImpl } from '../core/series';
import { barPath } from '../core/shapes';
import { attrs } from '../core/dom';

export const BAR_MAX = 24;
export const BAR_GAP = 2;
export const BAR_RADIUS = 4;

/** Geometría del grupo de barras de una banda: ancho de cada barra y desplazamiento de la posición. */
export function barGeometry(ctx: DrawContext): { w: number; offset: number } {
  const slots = Math.max(1, ctx.frame.slots);
  const usable = ctx.x.step * 0.72;
  const w = Math.max(1, Math.min(BAR_MAX, (usable - (slots - 1) * BAR_GAP) / slots));
  const groupW = slots * w + (slots - 1) * BAR_GAP;
  return { w, offset: -groupW / 2 + ctx.frame.slot * (w + BAR_GAP) };
}

export const bar: SeriesImpl = {
  band: true,
  cluster: true,
  stackable: true,
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'barras',
  draw(ctx) {
    const f = ctx.frame;
    const { w, offset } = barGeometry(ctx);
    let d = '';
    for (let i = 0; i < ctx.n; i++) {
      const v0 = f.y0[i];
      const v1 = f.y1[i];
      if (!isFinite(v0) || !isFinite(v1) || v0 === v1) continue;
      let yb = ctx.y.map(v0);
      const ye = ctx.y.map(v1);
      // Segmento apilado sobre otro: dejar 2 px de aire en su base.
      if (v0 !== 0) yb += ye < yb ? -BAR_GAP : BAR_GAP;
      if ((ye < yb) !== (ctx.y.map(v1) < ctx.y.map(v0))) continue; // el aire se comió el segmento
      d += barPath(ctx.x.at(i) + offset, w, yb, ye, BAR_RADIUS, f.outer[i]);
    }
    return d ? `<path${attrs({ d, fill: f.ps.color })}/>` : '';
  },
};
