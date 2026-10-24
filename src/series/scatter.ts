/**
 * Dispersión y burbujas: un punto por fila. El puntero busca el punto más cercano en el
 * plano (no hay crosshair). Los puntos llevan un anillo de 2 px del color de la superficie
 * para separarse cuando se tocan.
 */
import type { DrawContext, SeriesImpl } from '../core/series';
import { attrs } from '../core/dom';

const DOT_RADIUS = 4;
const RING = 2;
/** Radio de la burbuja más grande, como fracción del lado corto del gráfico. */
const BUBBLE_SHARE = 0.08;
const BUBBLE_MAX = 32;
const BUBBLE_MIN = 2;

/** Círculo con anillo exterior: el trazo se pinta debajo del relleno (paint-order). */
function dot(ctx: DrawContext, i: number, r: number, opacity?: number): string {
  const v = ctx.frame.y1[i];
  if (!isFinite(v) || !(r > 0)) return '';
  return `<circle${attrs({
    cx: ctx.x.at(i).toFixed(2),
    cy: ctx.y.map(v).toFixed(2),
    r: r.toFixed(2),
    fill: ctx.color,
    'fill-opacity': opacity,
    stroke: ctx.theme.surface,
    'stroke-width': RING * 2,
    'paint-order': 'stroke',
  })}/>`;
}

export const scatter: SeriesImpl = {
  layer: 3,
  legendSymbol: 'dot',
  label: 'dispersión',
  pointer: 'nearest',
  draw(ctx) {
    let s = '';
    for (let i = 0; i < ctx.n; i++) s += dot(ctx, i, DOT_RADIUS);
    return s;
  },
  hover: (ctx, i) => dot(ctx, i, DOT_RADIUS + 2),
};

/** El área del círculo, no su radio, es proporcional al valor: r = √(v / máx) · rMáx. */
function bubbleRadius(ctx: DrawContext): (i: number) => number {
  const sizes = ctx.frame.cols.size;
  const max = Math.max(0, ...ctx.frame.ps.columns.size.filter(isFinite));
  const rMax = Math.min(BUBBLE_MAX, Math.min(ctx.width, ctx.height) * BUBBLE_SHARE);
  return (i) => (max > 0 && sizes[i] > 0 ? Math.max(BUBBLE_MIN, Math.sqrt(sizes[i] / max) * rMax) : 0);
}

export const bubble: SeriesImpl = {
  layer: 3,
  legendSymbol: 'dot',
  label: 'burbujas',
  pointer: 'nearest',
  columns: (o) => ({ size: o.size }),
  draw(ctx) {
    const radius = bubbleRadius(ctx);
    // Las grandes primero, para que las chicas queden encima y se puedan señalar.
    const order = [...Array(ctx.n).keys()].sort((a, b) => radius(b) - radius(a));
    return order.map((i) => dot(ctx, i, radius(i), 0.75)).join('');
  },
  hover: (ctx, i) => dot(ctx, i, bubbleRadius(ctx)(i) + 2),
  tooltip(ps, i, format) {
    const v = ps.values[i];
    if (!isFinite(v)) return { value: 'Sin dato' };
    const size = ps.columns.size[i];
    const label = ps.options.sizeName ?? 'Tamaño';
    return { value: format.value(v), details: isFinite(size) ? [[label, format.number(size)]] : undefined };
  },
};
