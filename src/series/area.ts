/** Serie de área: relleno del color de la serie al 10 % con su línea encima. Apilable. */
import type { SeriesImpl } from '../core/series';
import { areaPath, linePath } from '../core/shapes';
import { attrs } from '../core/dom';
import { hoverDot, isolatedDots, points, stroke, visible } from './common';

export const area: SeriesImpl = {
  layer: 1,
  stackable: true,
  includeZero: true,
  legendSymbol: 'square',
  endLabel: true,
  draw(ctx) {
    const { frame, color } = ctx;
    const smooth = !!frame.ps.options.smooth;
    // La base usa los mismos índices que la punta: el relleno queda cerrado entre las dos.
    const idx = visible(ctx, frame.y1, frame.ps.stackKey ? frame.y0 : undefined);
    const top = points(ctx, frame.y1, idx);
    const fill = areaPath(top, points(ctx, frame.y0, idx), smooth);
    const edge = linePath(top, smooth);
    return (
      (fill ? `<path${attrs({ d: fill, fill: color, 'fill-opacity': 0.1 })}/>` : '') +
      (edge ? stroke(edge, color) : '') +
      isolatedDots(ctx, frame.y1, idx)
    );
  },
  hover: hoverDot,
};
