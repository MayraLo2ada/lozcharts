/** Piezas compartidas por las series de línea y área. */
import type { DrawContext } from '../core/series';
import type { Pt } from '../core/shapes';
import { attrs } from '../core/dom';
import { drawIndices } from '../core/decimate';

/**
 * Índices que vale la pena dibujar de una serie: los visibles y, con más de dos datos por px,
 * los extremos de cada columna de píxeles (ver core/decimate.ts).
 */
export function visible(ctx: DrawContext, values: readonly number[]): number[] {
  return drawIndices(ctx.x, ctx.width, values);
}

/** Puntos (x, y) en px de una lista de valores; con `idx`, solo esos índices. */
export function points(ctx: DrawContext, values: number[], idx?: readonly number[]): Pt[] {
  const out: Pt[] = [];
  if (idx) for (const i of idx) out.push([ctx.x.at(i), ctx.y.map(values[i])]);
  else for (let i = 0; i < ctx.n; i++) out.push([ctx.x.at(i), ctx.y.map(values[i])]);
  return out;
}

/** Trazo de 2 px con uniones y extremos redondeados. */
export function stroke(d: string, color: string): string {
  return `<path${attrs({ d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`;
}

/** Punto de hover: radio 4,5 px con anillo de 2 px del color de la superficie. */
export function hoverDot(ctx: DrawContext, i: number): string {
  const v = ctx.frame.y1[i];
  if (!isFinite(v)) return '';
  return `<circle${attrs({
    cx: ctx.x.at(i).toFixed(2),
    cy: ctx.y.map(v).toFixed(2),
    r: 4.5,
    fill: ctx.color,
    stroke: ctx.theme.surface,
    'stroke-width': 2,
  })}/>`;
}

/** Radio del punto que marca un dato aislado. */
const ISOLATED_RADIUS = 3;

/**
 * Datos aislados (entre huecos, o una serie de una sola fila): una línea no los puede unir con
 * nada, así que se marcan con un punto visible en vez de un trazo de largo cero.
 */
export function isolatedDots(ctx: DrawContext, values: number[], idx?: readonly number[]): string {
  let s = '';
  for (const i of idx ?? Array.from({ length: ctx.n }, (_, k) => k)) {
    if (!isFinite(values[i]) || isFinite(values[i - 1]) || isFinite(values[i + 1])) continue;
    s += `<circle${attrs({ cx: ctx.x.at(i).toFixed(2), cy: ctx.y.map(values[i]).toFixed(2), r: ISOLATED_RADIUS, fill: ctx.color })}/>`;
  }
  return s;
}
