/**
 * Formatos de números y fechas con Intl, en el idioma del gráfico (ver i18n.ts).
 * Los objetos Intl son caros de crear, así que se guardan en caché.
 */
import type { FormatSpec } from '../types';
import { MAX_DECIMALS, stepDecimals, type TimeUnit } from './ticks';
import { intlFallback, messages } from './i18n';

const numCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Formateador de números en caché. Siempre agrupa los miles: en español la norma omite el punto
 * en cifras de cuatro dígitos (6830), pero en una columna junto a 48.210 eso se lee mal.
 */
function nf(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const opts: Intl.NumberFormatOptions = { useGrouping: true, ...options };
  const key = locale + JSON.stringify(opts);
  let f = numCache.get(key);
  if (!f) {
    const near = intlFallback(locale);
    f = safely(
      locale,
      () => new Intl.NumberFormat(locale, opts),
      () => new Intl.NumberFormat(near, opts),
      // Una moneda que no existe ('EURO', 'S/'): el número sin símbolo, antes que no dibujar nada.
      () => new Intl.NumberFormat(near, { ...opts, style: 'decimal', currency: undefined, currencyDisplay: undefined }),
      () => new Intl.NumberFormat('en'),
    );
    numCache.set(key, f);
  }
  return f;
}

function df(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = dateCache.get(key);
  if (!f) {
    // Un locale mal escrito ('es_ES') cae en su idioma ('es'); unas opciones que Intl no acepta, en la fecha corta.
    const near = intlFallback(locale);
    f = safely(
      locale,
      () => new Intl.DateTimeFormat(locale, opts),
      () => new Intl.DateTimeFormat(near, opts),
      () => new Intl.DateTimeFormat(near),
      () => new Intl.DateTimeFormat('en'),
    );
    dateCache.set(key, f);
  }
  return f;
}

/**
 * El primer formateador que se deja crear. Avisa una vez (en el idioma del gráfico) por cada caso
 * que no se pudo usar tal cual.
 */
function safely<T>(locale: string, ...tries: (() => T)[]): T {
  let first: unknown;
  for (const make of tries) {
    try {
      const f = make();
      if (first !== undefined) warnFormat(first, locale);
      return f;
    } catch (err) {
      first ??= err;
    }
  }
  throw first;
}

const warned = new Set<string>();

function warnFormat(err: unknown, locale: string): void {
  const message = err instanceof Error ? err.message : String(err);
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(messages(locale).warnings.intl(message));
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
    s === 'currency' ? { style: 'currency', currency: ctx.currency, currencyDisplay: 'narrowSymbol' } : {};
  if (compact) {
    // En compacto el paso relativo al orden de magnitud decide los decimales (1,5 mil).
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, maxAbs)) / 3) * 3);
    const d = stepDecimals(step / mag);
    return (v) => nf(ctx.locale, { ...base, notation: 'compact', maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
  }
  const d = stepDecimals(step);
  return (v) =>
    nf(ctx.locale, { ...base, maximumFractionDigits: d, minimumFractionDigits: s === 'currency' ? Math.min(d, 2) : 0 }).format(v);
}

/** Índice base 100: un decimal ("112,4"). */
export function indexFormatter(locale: string): (v: number) => string {
  return (v) => nf(locale, { maximumFractionDigits: 1 }).format(v);
}

/**
 * Decimales para mostrar un valor sin borrarlo: 2 para números normales, y los necesarios para
 * números chicos (0,0049 no debe leerse "0").
 */
export function exactDecimals(v: number): number {
  const a = Math.abs(v);
  if (!(a > 0) || a >= 1) return 2;
  return Math.min(MAX_DECIMALS, Math.max(2, Math.ceil(-Math.log10(a)) + 1));
}

/** Formato compacto ("506 mil M"): para totales grandes donde el espacio es poco. */
export function compactFormatter(ctx: NumberContext): (v: number) => string {
  return (v) => nf(ctx.locale, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
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
      return compactFormatter(ctx);
    default:
      return (v) => nf(ctx.locale, { maximumFractionDigits: exactDecimals(v) }).format(v);
  }
}

// ---------------------------------------------------------------- Fechas

/**
 * Convierte el valor de un campo en timestamp. Acepta Date, número (ms) o texto.
 * 'AAAA', 'AAAA-MM' y 'AAAA-MM-DD' se leen en hora LOCAL: Date.parse los leería
 * en UTC y, en cualquier zona al oeste de Greenwich, '2026-01' caería el 31 de diciembre.
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
      s = messages(locale).chart.weekOf(df(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d));
      break;
    case 'day':
      s = df(locale, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      break;
    default:
      s = df(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(d);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "sept." → "sept": en ejes el punto de abreviatura es ruido. */
function cleanMonth(s: string): string {
  return s.replace(/\.$/, '').replace(/\. /g, ' ');
}
