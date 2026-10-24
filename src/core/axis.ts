/**
 * Eje X: textos de cada punto y etiquetas que caben sin encimarse.
 */
import type { XAxisOptions } from '../types';
import type { Prepared } from './prepare';
import type { ContinuousScale, XScale } from './scales';
import { timeFullLabel, timeTickLabel, valueFormatter, type NumberContext } from './format';
import { chooseTimeInterval, niceStep, numberTicks, timeTicks } from './ticks';

export interface XTick {
  px: number;
  label: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface XLabelContext extends NumberContext {
  format: XAxisOptions['format'];
}

/** Separación mínima entre dos etiquetas, en px. */
const LABEL_GAP = 12;

/** Texto de la X en el índice i: corto para el eje, completo para el tooltip y la tabla. */
export function xLabel(p: Prepared, i: number, short: boolean, ctx: XLabelContext): string {
  const fmt = ctx.format;
  if (p.xType === 'time') {
    const t = p.xNum[i];
    const unit = p.timeUnit!;
    if (!short) return timeFullLabel(t, unit, ctx.locale);
    if (typeof fmt === 'object') return timeTickLabel(t, unit, ctx.locale, fmt);
    // Meses en banda: "ene", "feb"… y el año en enero solo si los datos cruzan de año.
    if (unit === 'month' && !(crossesYear(p) && new Date(t).getMonth() === 0)) {
      return timeTickLabel(t, unit, ctx.locale, { month: 'short' }).replace(/\.$/, '');
    }
    return timeTickLabel(t, unit, ctx.locale);
  }
  if (p.xType === 'linear') return numberFormat(ctx)(p.xNum[i]);
  const raw = p.xRaw[i];
  return raw === null || raw === undefined ? '' : String(raw);
}

/**
 * Etiquetas del eje X que caben sin encimarse.
 * Por índice (banda o categorías): una de cada k. En tiempo o números: ticks "bonitos".
 * Luego se descartan las que choquen y las de los bordes se alinean hacia adentro.
 *
 * @param minX límite izquierdo disponible (negativo: puede invadir el margen del eje Y).
 * @param maxX límite derecho disponible.
 */
export function xTicks(
  p: Prepared,
  x: XScale,
  plotW: number,
  minX: number,
  maxX: number,
  measure: (text: string) => number,
  ctx: XLabelContext,
): XTick[] {
  if (!p.n) return [];
  const ticks: XTick[] = [];

  if (x.kind === 'band' || p.xType === 'category') {
    const labels = p.xRaw.map((_, i) => xLabel(p, i, true, ctx));
    const widest = Math.max(...labels.map(measure));
    const every = Math.max(1, Math.ceil((widest + LABEL_GAP) / Math.max(1, x.step)));
    for (let i = 0; i < p.n; i += every) ticks.push({ px: x.at(i), label: labels[i], anchor: 'middle' });
  } else {
    const cs = x as ContinuousScale;
    const [t0, t1] = cs.domain;
    if (p.xType === 'time') {
      const fits = Math.max(1, Math.floor(plotW / (measure('30 sept') + LABEL_GAP)));
      const interval = chooseTimeInterval(t0, t1, fits);
      const opts = typeof ctx.format === 'object' ? ctx.format : undefined;
      for (const t of timeTicks(t0, t1, interval)) {
        ticks.push({ px: cs.lin.map(t), label: timeTickLabel(t, interval.unit, ctx.locale, opts), anchor: 'middle' });
      }
    } else {
      const fmt = numberFormat(ctx);
      const step = niceStep(t1 - t0, Math.max(1, Math.floor(plotW / 70)));
      for (const v of numberTicks(t0, t1, step)) ticks.push({ px: cs.lin.map(v), label: fmt(v), anchor: 'middle' });
    }
  }

  const kept: XTick[] = [];
  let lastRight = -Infinity;
  for (const tk of ticks) {
    const w = measure(tk.label);
    let left = tk.px - w / 2;
    if (left < minX) {
      tk.anchor = 'start';
      tk.px = left = minX;
    } else if (left + w > maxX) {
      tk.anchor = 'end';
      tk.px = maxX;
      left = maxX - w;
    }
    if (left >= lastRight + LABEL_GAP / 2) {
      kept.push(tk);
      lastRight = left + w;
    }
  }
  return kept;
}

function crossesYear(p: Prepared): boolean {
  return new Date(p.xNum[0]).getFullYear() !== new Date(p.xNum[p.n - 1]).getFullYear();
}

function numberFormat(ctx: XLabelContext): (v: number) => string {
  const fmt = ctx.format;
  if (typeof fmt === 'function') return fmt;
  return valueFormatter(typeof fmt === 'string' ? fmt : 'number', ctx);
}

/**
 * Etiquetas del índice cuando el eje es vertical (barras horizontales): una por categoría si
 * hay altura, si no una de cada k. Las que no caben a lo ancho se recortan con "…".
 */
export function indexLabels(
  p: Prepared,
  x: XScale,
  lineHeight: number,
  maxWidth: number,
  measure: (text: string) => number,
  ctx: XLabelContext,
): { pos: number; label: string }[] {
  const every = Math.max(1, Math.ceil(lineHeight / Math.max(1, x.step)));
  const out: { pos: number; label: string }[] = [];
  for (let i = 0; i < p.n; i += every) out.push({ pos: x.at(i), label: fitText(xLabel(p, i, true, ctx), maxWidth, measure) });
  return out;
}

/** Recorta un texto con "…" hasta que quepa en `maxWidth`. */
export function fitText(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(text.slice(0, mid).trimEnd() + '…') <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo ? text.slice(0, lo).trimEnd() + '…' : '…';
}
