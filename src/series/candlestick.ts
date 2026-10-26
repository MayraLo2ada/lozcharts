/**
 * Velas y OHLC para precios: apertura, máximo, mínimo y cierre de cada periodo.
 * `field` es el cierre; `open`, `high` y `low` nombran los otros campos.
 *
 * La dirección no depende del color (no hay verde y rojo): una vela que sube es hueca y una
 * que baja es rellena, siempre del color de su serie. En OHLC, las marcas a la izquierda
 * (apertura) y a la derecha (cierre) cuentan lo mismo.
 */
import {
  paintDimmed,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { attrs } from '../core/dom';
import { r2 } from '../core/shapes';

const MAX_WIDTH = 14;
const BODY_SHARE = 0.6;
const STROKE = 1.5;

/** Una vela en px, más su dirección según los datos. */
interface Candle {
  /** Centro en el eje del índice. */
  c: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** El cierre es mayor o igual que la apertura. */
  up: boolean;
}

/** Posiciones en px de cada vela; se saltan las que tienen algún dato vacío. */
function candles(ctx: DrawContext, include: (i: number) => boolean = () => true): Candle[] {
  const { cols, y1 } = ctx.frame;
  const out: Candle[] = [];
  for (let i = 0; i < ctx.n; i++) {
    if (!include(i)) continue;
    const v = [cols.open[i], cols.high[i], cols.low[i], y1[i]];
    if (!v.every(isFinite)) continue;
    const [open, high, low, close] = v.map((d) => ctx.y.map(d));
    out.push({ c: ctx.x.at(i), open, high, low, close, up: y1[i] >= cols.open[i] });
  }
  return out;
}

function width(ctx: DrawContext): number {
  return Math.max(1, Math.min(MAX_WIDTH, ctx.x.step * BODY_SHARE));
}

const fields = (o: { open?: string; high?: string; low?: string }) => ({ open: o.open, high: o.high, low: o.low });

function ohlcTooltip(ps: PreparedSeries, i: number, { value: format, number }: TooltipFormat): TooltipValue {
  const { open, high, low } = ps.columns;
  const close = ps.values[i];
  if (![open[i], high[i], low[i], close].every(isFinite)) return { value: 'Sin dato' };
  // Variación de la sesión en %, con un decimal y el separador del idioma del gráfico. Sobre el
  // valor absoluto de la apertura: con precios negativos (un futuro de petróleo), subir de −80 a
  // −74 es +7 %, no −7 %.
  const change = open[i] ? Math.round(((close - open[i]) / Math.abs(open[i])) * 1000) / 10 : 0;
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return {
    value: `${format(close)} (${sign}${number(Math.abs(change))} %)`,
    details: [
      ['Apertura', format(open[i])],
      ['Máximo', format(high[i])],
      ['Mínimo', format(low[i])],
      ['Cierre', format(close)],
    ],
  };
}

export const candlestick: SeriesImpl = {
  band: true,
  layer: 2,
  legendSymbol: 'square',
  label: 'velas',
  columns: fields,
  valueColumns: ['open', 'high', 'low'],
  dimmable: true,
  draw(ctx) {
    return paintDimmed(ctx, (include) => candleMarkup(ctx, include));
  },
  tooltip: ohlcTooltip,
};

/** Velas de los índices incluidos: mechas, cuerpos rellenos (bajan) y huecos (suben). */
function candleMarkup(ctx: DrawContext, include: (i: number) => boolean): string {
  const w = width(ctx);
  let wicks = '';
  let filled = '';
  let hollow = '';
  for (const k of candles(ctx, include)) {
    const top = Math.min(k.open, k.close);
    const bottom = Math.max(k.open, k.close);
    const x = r2(k.c);
    // Mecha en dos tramos, sin cruzar el cuerpo (que puede ser hueco).
    wicks += `M${x},${r2(Math.min(k.high, k.low))}V${r2(top)}M${x},${r2(bottom)}V${r2(Math.max(k.high, k.low))}`;
    const body = `M${r2(k.c - w / 2)},${r2(top)}h${r2(w)}v${r2(Math.max(1, bottom - top))}h${r2(-w)}Z`;
    if (k.up) hollow += body;
    else filled += body;
  }
  return (
    `<path${attrs({ d: wicks, stroke: ctx.color, 'stroke-width': 1, fill: 'none' })}/>` +
    `<path${attrs({ d: filled, fill: ctx.color })}/>` +
    `<path${attrs({ d: hollow, fill: ctx.theme.surface, stroke: ctx.color, 'stroke-width': STROKE })}/>`
  );
}

export const ohlc: SeriesImpl = {
  band: true,
  layer: 2,
  legendSymbol: 'line',
  label: 'barras de precios',
  columns: fields,
  valueColumns: ['open', 'high', 'low'],
  dimmable: true,
  draw(ctx) {
    const tick = width(ctx) / 2;
    return paintDimmed(ctx, (include) => {
      let d = '';
      for (const k of candles(ctx, include)) {
        const x = r2(k.c);
        d += `M${x},${r2(k.high)}V${r2(k.low)}M${r2(k.c - tick)},${r2(k.open)}H${x}M${x},${r2(k.close)}H${r2(k.c + tick)}`;
      }
      return `<path${attrs({ d, stroke: ctx.color, 'stroke-width': STROKE, fill: 'none', 'stroke-linecap': 'butt' })}/>`;
    });
  },
  tooltip: ohlcTooltip,
};
