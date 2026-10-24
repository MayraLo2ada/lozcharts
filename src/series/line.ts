/** Serie de línea: 2 px, uniones redondeadas, suave = curva monótona. */
import type { DrawContext, SeriesImpl } from '../core/series';
import { linePath, type Pt } from '../core/shapes';
import { attrs } from '../core/dom';

export function points(ctx: DrawContext, values: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctx.n; i++) out.push([ctx.x.at(i), ctx.y.map(values[i])]);
  return out;
}

/** Punto de hover: radio 4 px con anillo de 2 px del color de la superficie. */
export function hoverDot(ctx: DrawContext, i: number): string {
  const v = ctx.frame.y1[i];
  if (!isFinite(v)) return '';
  return `<circle${attrs({
    cx: ctx.x.at(i).toFixed(2),
    cy: ctx.y.map(v).toFixed(2),
    r: 4.5,
    fill: ctx.frame.ps.color,
    stroke: ctx.theme.surface,
    'stroke-width': 2,
  })}/>`;
}

export const line: SeriesImpl = {
  layer: 2,
  legendSymbol: 'line',
  label: 'líneas',
  draw(ctx) {
    const d = linePath(points(ctx, ctx.frame.y1), !!ctx.frame.ps.options.smooth);
    if (!d) return '';
    return `<path${attrs({
      d,
      fill: 'none',
      stroke: ctx.frame.ps.color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    })}/>`;
  },
  hover: hoverDot,
};
