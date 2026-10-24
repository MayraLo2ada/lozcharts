/**
 * Formatos de números y fechas con Intl (locale 'es' por defecto).
 * Los objetos Intl son caros de crear, así que se guardan en caché.
 */
import type { FormatSpec } from '../types';
import { stepDecimals, type TimeUnit } from './ticks';

const numCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = numCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, opts);
    } catch {
      f = new Intl.NumberFormat('es', opts);
    }
    numCache.set(key, f);
  }
  return f;
}

function df(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = dateCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      f = new Intl.DateTimeFormat('es', opts);
    }
    dateCache.set(key, f);
  }
  return f;
}

export interface NumberContext {
  locale: string;
  currency: string;
}

/**
 * Formato para las etiquetas del eje: redondeado y compacto desde mil
 * (0 / 1 mil / 2 mil). `step` es el paso entre ticks, para saber cuántos decimales hacen falta.
 */
export function axisFormatter(
  spec: FormatSpec | undefined,
  ctx: NumberContext,
  step: number,
  maxAbs: number,
): (v: number) => string {
  if (typeof spec === 'function') return spec;
  const s = spec ?? 'auto';
  const compact = s === 'compact' || ((s === 'auto' || s === 'currency') && maxAbs >= 1000);
  if (s === 'percent') {
    const d = stepDecimals(step * 100);
    return (v) => nf(ctx.locale, { style: 'percent', maximumFractionDigits: d }).format(v);
  }
  const base: Intl.NumberFormatOptions =
    s === 'currency'
      ? { style: 'currency', currency: ctx.currency, currencyDisplay: 'narrowSymbol' }
      : {};
  if (compact) {
    // En compacto el paso relativo al orden de magnitud decide los decimales (1,5 mil).
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, maxAbs)) / 3) * 3);
    const d = stepDecimals(step / mag);
    return (v) =>
      nf(ctx.locale, { ...base, notation: 'compact', maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
  }
  const d = stepDecimals(step);
  return (v) =>
    nf(ctx.locale, { ...base, maximumFractionDigits: d, minimumFractionDigits: s === 'currency' ? Math.min(d, 2) : 0 }).format(v);
}

/** Formato exacto para el tooltip y la tabla. */
export function valueFormatter(spec: FormatSpec | undefined, ctx: NumberContext): (v: number) => string {
  if (typeof spec === 'function') return spec;
  switch (spec) {
    case 'percent':
      return (v) => nf(ctx.locale, { style: 'percent', maximumFractionDigits: 1 }).format(v);
    case 'currency':
      // Montos redondos sin ",00"; con centavos, siempre dos decimales.
      return (v) =>
        nf(ctx.locale, {
          style: 'currency',
          currency: ctx.currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
          maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
        }).format(v);
    case 'compact':
      return (v) => nf(ctx.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    default:
      return (v) => nf(ctx.locale, { maximumFractionDigits: 2 }).format(v);
  }
}

// ---------------------------------------------------------------- Fechas

/**
 * Convierte el valor de un campo en timestamp. Acepta Date, número (ms) o texto.
 * 'AAAA', 'AAAA-MM' y 'AAAA-MM-DD' se leen en hora LOCAL: Date.parse los leería
 * en UTC y, en Miami, '2026-01' caería el 31 de diciembre.
 */
export function parseTime(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(v.trim());
    if (m) return new Date(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1).getTime();
    return Date.parse(v);
  }
  return NaN;
}

/** Etiqueta corta de un tick de fecha. Marca el cambio de año o de día. */
export function timeTickLabel(t: number, unit: TimeUnit, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(t);
  if (opts) return df(locale, opts).format(d);
  switch (unit) {
    case 'year':
      return String(d.getFullYear());
    case 'month':
      return d.getMonth() === 0 ? String(d.getFullYear()) : cleanMonth(df(locale, { month: 'short' }).format(d));
    case 'week':
    case 'day':
      return d.getDate() === 1 && d.getMonth() === 0
        ? String(d.getFullYear())
        : cleanMonth(df(locale, { day: 'numeric', month: 'short' }).format(d));
    case 'hour':
    case 'minute':
      return d.getHours() === 0 && d.getMinutes() === 0
        ? cleanMonth(df(locale, { day: 'numeric', month: 'short' }).format(d))
        : df(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  }
}

/** Fecha completa para el tooltip, según la granularidad de los datos. */
export function timeFullLabel(t: number, unit: TimeUnit, locale: string): string {
  const d = new Date(t);
  let s: string;
  switch (unit) {
    case 'year':
      s = String(d.getFullYear());
      break;
    case 'month':
      s = df(locale, { month: 'long', year: 'numeric' }).format(d);
      break;
    case 'week':
      s = (locale.startsWith('es') ? 'Semana del ' : '') + df(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      break;
    case 'day':
      s = df(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      break;
    default:
      s = df(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "sept." → "sept": en ejes el punto de abreviatura es ruido. */
function cleanMonth(s: string): string {
  return s.replace(/\.$/, '').replace(/\. /g, ' ');
}
