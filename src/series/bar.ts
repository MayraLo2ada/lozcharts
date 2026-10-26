/**
 * Serie de barras (agrupadas o apiladas).
 * Máximo 24 px de grosor, punta de datos redondeada 4 px, base recta y 2 px de
 * separación (espacio, no borde) entre barras vecinas y entre segmentos apilados.
 */
import { paintDimmed, type DrawContext, type SeriesImpl } from '../core/series';
import { barPath } from '../core/shapes';
import { attrs } from '../core/dom';

const MAX_WIDTH = 24;
const GAP = 2;
const RADIUS = 4;
/** Fracción de la banda que puede ocupar el grupo; el resto es aire entre categorías. */
const GROUP_FILL = 0.72;

/**
 * Ancho de cada barra y su desplazamiento respecto al centro de la banda. Con bandas muy angostas
 * (muchas categorías), primero se achica el aire entre las barras del grupo y después las barras,
 * hasta 1 px: el grupo nunca se sale de su banda ni pisa al de la categoría vecina.
 */
export function barGeometry(step: number, slot: number, slots: number): { width: number; offset: number; group: number } {
  const count = Math.max(1, slots);
  const room = step * GROUP_FILL;
  const gap = count > 1 ? Math.max(0, Math.min(GAP, (room - count) / (count - 1))) : 0;
  const width = Math.max(1, Math.min(MAX_WIDTH, (room - (count - 1) * gap) / count));
  const group = count * width + (count - 1) * gap;
  return { width, offset: -group / 2 + slot * (width + gap), group };
}

function geometry(ctx: DrawContext): { width: number; offset: number } {
  return barGeometry(ctx.x.step, ctx.frame.slot, ctx.frame.slots);
}

export const bar: SeriesImpl = {
  band: true,
  cluster: true,
  stackable: true,
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  dimmable: true,
  draw(ctx) {
    const { frame, x, y } = ctx;
    const { width, offset } = geometry(ctx);
    return paintDimmed(ctx, (include) => {
      let d = '';
      for (let i = 0; i < ctx.n; i++) {
        if (!include(i)) continue;
        const v0 = frame.y0[i];
        const v1 = frame.y1[i];
        if (!isFinite(v0) || !isFinite(v1) || v0 === v1) continue;
        const end = y.map(v1);
        const dir = Math.sign(end - y.map(v0));
        // Un segmento apilado sobre otro deja 2 px de aire en su base.
        const base = y.map(v0) + (v0 !== 0 ? dir * GAP : 0);
        if ((end - base) * dir <= 0) continue;
        d += barPath(x.at(i) + offset, width, base, end, RADIUS, frame.outer[i]);
      }
      return d ? `<path${attrs({ d, fill: ctx.color })}/>` : '';
    });
  },
};
