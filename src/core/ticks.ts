/**
 * Ticks "bonitos".
 *
 * Números: un paso bonito es 1, 2 o 5 multiplicado por una potencia de 10
 * (…, 0.5, 1, 2, 5, 10, 20, 50, …). Se toma el paso "crudo" (rango / cantidad deseada)
 * y se redondea al bonito más cercano.
 *
 * Fechas: se elige el intervalo de calendario (hora, día, semana, mes, trimestre, año…)
 * más pequeño que no produzca más ticks de los que caben.
 */

/** Paso bonito para cubrir `span` con unos `count` intervalos. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const err = raw / power; // entre 1 y 10
  // Umbrales en la media geométrica entre candidatos (√2≈1.41, √10≈3.16, √50≈7.07).
  const factor = err >= 7.07 ? 10 : err >= 3.16 ? 5 : err >= 1.41 ? 2 : 1;
  return factor * power;
}

/** Extiende [min, max] hasta múltiplos del paso bonito. */
export function niceDomain(min: number, max: number, count: number): [number, number, number] {
  if (min === max) {
    if (min === 0) return [0, 1, 0.2];
    const pad = Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  let step = niceStep(max - min, count);
  let lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  // Una segunda pasada estabiliza el paso tras el redondeo.
  const step2 = niceStep(hi - lo, count);
  if (step2 !== step) {
    step = step2;
    lo = Math.floor(min / step) * step;
    hi = Math.ceil(max / step) * step;
  }
  return [cleanFloat(lo), cleanFloat(hi), step];
}

/** Ticks numéricos dentro de [min, max] con el paso dado. */
export function numberTicks(min: number, max: number, step: number): number[] {
  if (!(step > 0)) return [min];
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let k = first; k <= last && out.length < 1000; k++) out.push(cleanFloat(k * step));
  return out;
}

/** Quita el ruido de coma flotante (0.30000000000000004 → 0.3). */
export function cleanFloat(v: number): number {
  return Math.abs(v) < 1e-12 ? 0 : parseFloat(v.toPrecision(12));
}

/** Decimales necesarios para mostrar un paso sin perder precisión. */
export function stepDecimals(step: number): number {
  if (!(step > 0) || step >= 1) return 0;
  return Math.min(10, Math.ceil(-Math.log10(step) - 1e-9));
}

// ---------------------------------------------------------------- Escala logarítmica

/**
 * Valores redondos de un eje logarítmico: 1, 2 y 5 × 10ⁿ. Si no caben, solo las potencias de 10
 * (y, en rangos de muchas décadas, una de cada k). Los demás múltiplos (3, 4, 6…) no se usan: en
 * una escala logarítmica quedan apretados contra el siguiente y no ayudan a leer.
 */
const LOG_STEPS = [1, 2, 5];

/** Valores m × 10ⁿ de `mantissas` dentro de [d0, d1]. */
function logCandidates(d0: number, d1: number, mantissas: readonly number[]): number[] {
  const out: number[] = [];
  const last = Math.ceil(Math.log10(d1) + 1e-9);
  for (let e = Math.floor(Math.log10(d0) - 1e-9); e <= last && out.length < 1000; e++) {
    for (const m of mantissas) {
      const v = cleanFloat(m * Math.pow(10, e));
      if (v >= d0 * (1 - 1e-9) && v <= d1 * (1 + 1e-9)) out.push(v);
    }
  }
  return out;
}

/** Potencias de 10 en [d0, d1], una de cada k para que no pasen de `count + 1`. */
function powerTicks(d0: number, d1: number, count: number): number[] {
  const powers = logCandidates(d0, d1, [1]);
  const every = Math.max(1, Math.ceil(powers.length / (count + 1)));
  return powers.filter((_, k) => k % every === 0);
}

/**
 * Marcas de un eje logarítmico en [d0, d1]: 1, 2 y 5 × 10ⁿ si caben unas `count` (una más se
 * tolera, como en los ejes lineales); si no, potencias de 10. Vacío si el dominio no es positivo.
 */
export function logTicks(d0: number, d1: number, count: number): number[] {
  if (!(d0 > 0) || !(d1 >= d0)) return [];
  const dense = logCandidates(d0, d1, LOG_STEPS);
  return dense.length <= count + 1 ? dense : powerTicks(d0, d1, count);
}

/** El mayor valor de la forma m × 10ⁿ (m en `mantissas`) que no pasa de v. */
function logFloor(v: number, mantissas: readonly number[]): number {
  const power = Math.pow(10, Math.floor(Math.log10(v) + 1e-9));
  let best = power;
  for (const m of mantissas) if (m * power <= v * (1 + 1e-9)) best = m * power;
  return cleanFloat(best);
}

/** El menor valor de la forma m × 10ⁿ (m en `mantissas`, o 10) que no es menor que v. */
function logCeil(v: number, mantissas: readonly number[]): number {
  const power = Math.pow(10, Math.floor(Math.log10(v) + 1e-9));
  for (const m of [...mantissas, 10]) if (m * power >= v * (1 - 1e-9)) return cleanFloat(m * power);
  return cleanFloat(10 * power);
}

/**
 * Dominio de un eje logarítmico que contiene [lo, hi] (positivos), con extremos redondos: en 1, 2
 * o 5 × 10ⁿ si con esa densidad caben las marcas; si no, en potencias de 10. Así los dos extremos
 * son siempre marcas del eje. Un solo valor queda entre el redondo anterior y el siguiente.
 */
export function logDomain(lo: number, hi: number, count: number): [number, number] {
  if (!(hi > 0)) return [1, 10];
  if (!(lo > 0)) lo = hi;
  for (const mantissas of [LOG_STEPS, [1]]) {
    let d0 = logFloor(lo, mantissas);
    let d1 = logCeil(hi, mantissas);
    if (d1 <= d0) {
      // Un solo valor redondo: un paso de cada lado.
      d0 = logFloor(d0 * (1 - 1e-6), mantissas);
      d1 = logCeil(d1 * (1 + 1e-6), mantissas);
    }
    if (mantissas.length === 1 || logCandidates(d0, d1, mantissas).length <= count + 1) return [d0, d1];
  }
  return [1, 10];
}

// ---------------------------------------------------------------- Fechas

export type TimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface TimeInterval {
  unit: TimeUnit;
  every: number;
  /** Duración aproximada en ms (para comparar). */
  ms: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const INTERVALS: TimeInterval[] = [
  { unit: 'minute', every: 1, ms: MIN },
  { unit: 'minute', every: 5, ms: 5 * MIN },
  { unit: 'minute', every: 15, ms: 15 * MIN },
  { unit: 'minute', every: 30, ms: 30 * MIN },
  { unit: 'hour', every: 1, ms: HOUR },
  { unit: 'hour', every: 3, ms: 3 * HOUR },
  { unit: 'hour', every: 6, ms: 6 * HOUR },
  { unit: 'hour', every: 12, ms: 12 * HOUR },
  { unit: 'day', every: 1, ms: DAY },
  { unit: 'day', every: 2, ms: 2 * DAY },
  { unit: 'week', every: 1, ms: 7 * DAY },
  { unit: 'month', every: 1, ms: 30 * DAY },
  { unit: 'month', every: 2, ms: 61 * DAY },
  { unit: 'month', every: 3, ms: 91 * DAY },
  { unit: 'month', every: 6, ms: 182 * DAY },
  { unit: 'year', every: 1, ms: 365 * DAY },
  { unit: 'year', every: 2, ms: 730 * DAY },
  { unit: 'year', every: 5, ms: 1826 * DAY },
  { unit: 'year', every: 10, ms: 3652 * DAY },
];

/** El intervalo más fino que no genera más de `maxTicks` ticks en [t0, t1]. */
/** Duración aproximada de una unidad: el intervalo de los ticks nunca baja de la de los datos. */
const UNIT_MS: Record<TimeUnit, number> = { minute: MIN, hour: HOUR, day: DAY, week: 7 * DAY, month: 28 * DAY, year: 360 * DAY };

/**
 * @param minUnit granularidad de los datos: con zoom sobre datos diarios no salen ticks por hora.
 */
export function chooseTimeInterval(t0: number, t1: number, maxTicks: number, minUnit?: TimeUnit): TimeInterval {
  const span = Math.max(1, t1 - t0);
  const floor = minUnit ? UNIT_MS[minUnit] : 0;
  for (const iv of INTERVALS) {
    if (iv.ms < floor) continue;
    if (span / iv.ms <= Math.max(1, maxTicks)) return iv;
  }
  const years = Math.ceil(span / (365 * DAY) / Math.max(1, maxTicks));
  const every = niceStep(years, 1);
  return { unit: 'year', every, ms: every * 365 * DAY };
}

/** Redondea hacia abajo al inicio del intervalo (en hora local). */
function floorTo(d: Date, iv: TimeInterval): Date {
  const r = new Date(d.getTime());
  switch (iv.unit) {
    case 'minute':
      r.setSeconds(0, 0);
      r.setMinutes(Math.floor(r.getMinutes() / iv.every) * iv.every);
      break;
    case 'hour':
      r.setMinutes(0, 0, 0);
      r.setHours(Math.floor(r.getHours() / iv.every) * iv.every);
      break;
    case 'day':
      r.setHours(0, 0, 0, 0);
      break;
    case 'week': {
      r.setHours(0, 0, 0, 0);
      const dow = (r.getDay() + 6) % 7; // lunes = 0
      r.setDate(r.getDate() - dow);
      break;
    }
    case 'month':
      r.setHours(0, 0, 0, 0);
      r.setDate(1);
      r.setMonth(Math.floor(r.getMonth() / iv.every) * iv.every);
      break;
    case 'year':
      r.setHours(0, 0, 0, 0);
      r.setMonth(0, 1);
      r.setFullYear(Math.floor(r.getFullYear() / iv.every) * iv.every);
      break;
  }
  return r;
}

function addInterval(d: Date, iv: TimeInterval): Date {
  const r = new Date(d.getTime());
  switch (iv.unit) {
    case 'minute':
      r.setMinutes(r.getMinutes() + iv.every);
      break;
    case 'hour':
      r.setHours(r.getHours() + iv.every);
      break;
    case 'day':
      r.setDate(r.getDate() + iv.every);
      break;
    case 'week':
      r.setDate(r.getDate() + 7 * iv.every);
      break;
    case 'month':
      r.setMonth(r.getMonth() + iv.every);
      break;
    case 'year':
      r.setFullYear(r.getFullYear() + iv.every);
      break;
  }
  return r;
}

/** Ticks de fecha (timestamps) dentro de [t0, t1]. */
export function timeTicks(t0: number, t1: number, iv: TimeInterval): number[] {
  const out: number[] = [];
  let d = floorTo(new Date(t0), iv);
  if (d.getTime() < t0) d = addInterval(d, iv);
  while (d.getTime() <= t1 && out.length < 500) {
    out.push(d.getTime());
    d = addInterval(d, iv);
  }
  return out;
}

/** Unidad natural de una serie de fechas, según la distancia mínima entre puntos. */
export function detectTimeUnit(times: number[]): TimeUnit {
  let min = Infinity;
  for (let i = 1; i < times.length; i++) {
    const d = Math.abs(times[i] - times[i - 1]);
    if (d > 0 && d < min) min = d;
  }
  if (!isFinite(min)) return 'day';
  // El cambio de horario hace días de 23 horas: se tolera esa hora (y un poco más).
  const dst = 2 * HOUR;
  if (min >= 360 * DAY) return 'year';
  if (min >= 28 * DAY - dst) return 'month';
  if (min >= 7 * DAY - dst) return 'week';
  if (min >= DAY - dst) return 'day';
  if (min >= HOUR) return 'hour';
  return 'minute';
}
