/**
 * Serie de radar (LozRadar): un polígono cerrado por serie sobre el plano polar.
 * Relleno del color de la serie al 10 % y borde de 2 px, como las áreas.
 *
 * Huecos (NaN): un polígono con un vértice inventado mentiría, así que el contorno se corta
 * donde falta el dato y la serie pierde el relleno (no hay contorno cerrado que rellenar sin
 * inventar el valor que falta). Tratarlo como cero sería peor: se leería como un dato real.
 */
import type { DrawContext, SeriesImpl } from '../core/series';
import type { Pt } from '../core/shapes';
import { attrs } from '../core/dom';
import { r2 } from '../core/shapes';
import { stroke } from './common';

/** Opacidad del relleno: la misma de las áreas. */
const FILL_OPACITY = 0.1;
/** Punto de hover: radio y anillo, como hoverDot en common.ts. */
const HOVER_RADIUS = 4.5;
const HOVER_RING = 2;
const ok = (p: Pt) => isFinite(p[0]) && isFinite(p[1]);
const xy = (p: Pt) => r2(p[0]) + ',' + r2(p[1]);

/**
 * Tramos de índices consecutivos con dato, en orden circular: el último índice es vecino del
 * primero, así que un tramo puede dar la vuelta (…, n-1, 0, 1, …). Sin huecos devuelve un solo
 * tramo con todos los índices (y `closed` en true).
 */
export function radarRuns(valid: boolean[]): { runs: number[][]; closed: boolean } {
  const n = valid.length;
  const gap = valid.indexOf(false);
  if (gap < 0) return { runs: n ? [Array.from({ length: n }, (_, i) => i)] : [], closed: n > 0 };
  // Se empieza justo después de un hueco para que ningún tramo quede partido en dos.
  const runs: number[][] = [];
  let cur: number[] = [];
  for (let k = 1; k <= n; k++) {
    const i = (gap + k) % n;
    if (valid[i]) cur.push(i);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return { runs, closed: false };
}

/**
 * Rutas del radar a partir de los vértices en px (NaN = sin dato).
 * `fill` es el polígono cerrado (vacío si hay huecos); `edge`, el contorno: cerrado sin huecos,
 * o tramos abiertos si los hay (un tramo de un solo punto se dibuja como punto).
 */
export function radarPaths(pts: Pt[]): { fill: string; edge: string } {
  const { runs, closed } = radarRuns(pts.map(ok));
  if (closed) {
    // Con una sola categoría el "polígono" es un punto: trazo de largo cero con extremo redondo.
    if (pts.length === 1) return { fill: '', edge: 'M' + xy(pts[0]) + 'h0' };
    const d = runs[0].map((i, k) => (k ? 'L' : 'M') + xy(pts[i])).join('') + 'Z';
    return { fill: d, edge: d };
  }
  const edge = runs
    .map((run) => (run.length === 1 ? 'M' + xy(pts[run[0]]) + 'h0' : run.map((i, k) => (k ? 'L' : 'M') + xy(pts[i])).join('')))
    .join('');
  return { fill: '', edge };
}

/** Vértices de todos los índices; NaN donde falta el dato. */
function vertices(ctx: DrawContext): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctx.n; i++) {
    const v = ctx.frame.y1[i];
    out.push(isFinite(v) ? ctx.polar!.point(i, v) : [NaN, NaN]);
  }
  return out;
}

export const radar: SeriesImpl = {
  coords: 'polar',
  layer: 1,
  includeZero: true,
  legendSymbol: 'square',
  label: 'radar',
  items: ['criterio', 'criterios'],
  draw(ctx) {
    if (!ctx.polar) return '';
    const { fill, edge } = radarPaths(vertices(ctx));
    const color = ctx.color;
    return (
      (fill ? `<path${attrs({ d: fill, fill: color, 'fill-opacity': FILL_OPACITY })}/>` : '') + (edge ? stroke(edge, color) : '')
    );
  },
  hover(ctx, i) {
    const v = ctx.frame.y1[i];
    if (!ctx.polar || !isFinite(v)) return '';
    const [cx, cy] = ctx.polar!.point(i, v);
    return `<circle${attrs({
      cx: cx.toFixed(2),
      cy: cy.toFixed(2),
      r: HOVER_RADIUS,
      fill: ctx.color,
      stroke: ctx.theme.surface,
      'stroke-width': HOVER_RING,
    })}/>`;
  },
};
