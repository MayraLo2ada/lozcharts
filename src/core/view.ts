/**
 * Ventana del zoom: qué parte del eje X (y, si se pide, del Y) se ve.
 *
 * Se guarda como fracciones del largo total del eje: { start: 0.25, end: 0.5 } es el segundo
 * cuarto. Así la misma ventana vale para barras (bandas), fechas y números, y no depende del
 * ancho en px: si el gráfico cambia de tamaño, se sigue viendo lo mismo.
 * Las escalas reciben la ventana y estiran el eje: lo que queda fuera cae fuera del área.
 * En el eje Y la ventana es una fracción del dominio completo, de abajo (0) hacia arriba (1).
 */
import type { AxisDomain } from './frame';
import type { XScale } from './scales';
import { logTicks, niceStep, numberTicks } from './ticks';

export interface View {
  start: number;
  end: number;
}

export const FULL_VIEW: View = Object.freeze({ start: 0, end: 1 });

const EPS = 1e-9;

/** ¿Se ve todo el eje? */
export function isFull(v: View): boolean {
  return v.start <= EPS && v.end >= 1 - EPS;
}

/** Datos que se ven como mínimo con zoom: menos no dicen nada y la ventana se vuelve inmanejable. */
export const MIN_POINTS = 5;

/** Tramo mínimo de la ventana: que se vean al menos MIN_POINTS datos (o bandas con barras). */
export function minSpan(n: number, band: boolean): number {
  const k = Math.min(n, MIN_POINTS);
  if (n <= 2) return 1;
  return Math.min(1, band ? k / n : (k - 1) / (n - 1));
}

/** Ventana válida: dentro de [0, 1] y no más angosta que `min`. Si se sale por un lado, se corre. */
export function clampView(start: number, end: number, min: number): View {
  if (!isFinite(start) || !isFinite(end)) return FULL_VIEW;
  if (end < start) [start, end] = [end, start];
  // Una ventana que ya es válida queda tal cual, sin el ruido de recentrarla: así dos gráficos
  // sincronizados por sus fracciones muestran exactamente lo mismo.
  if (start >= 0 && end <= 1 && end - start >= min && end - start < 1 - EPS) return { start, end };
  let span = Math.min(1, Math.max(min, end - start));
  if (span >= 1 - EPS) return FULL_VIEW;
  const mid = (start + end) / 2;
  start = mid - span / 2;
  if (start < 0) start = 0;
  if (start + span > 1) start = 1 - span;
  span = Math.min(span, 1 - start);
  return { start, end: start + span };
}

/**
 * Acerca (factor > 1) o aleja (factor < 1) dejando quieto el punto `focus`, que es una fracción
 * de lo visible (0 = borde izquierdo, 1 = derecho): lo que está bajo el puntero no se mueve.
 */
export function zoomView(v: View, focus: number, factor: number, min: number): View {
  const span = v.end - v.start;
  const next = Math.min(1, Math.max(min, span / factor));
  const at = v.start + Math.max(0, Math.min(1, focus)) * span;
  const start = at - focus * next;
  return clampView(start, start + next, min);
}

/** Corre la ventana `delta` (fracción del eje completo) sin cambiar su tamaño. */
export function panView(v: View, delta: number): View {
  const span = v.end - v.start;
  const start = Math.max(0, Math.min(1 - span, v.start + delta));
  return { start, end: start + span };
}

// ---------------------------------------------------------------- Eje Y

/**
 * Tramo mínimo de la ventana del eje Y: un cincuentavo del dominio. No depende de los datos;
 * más cerca ya no se ve el detalle de una línea, solo su grosor.
 */
export const MIN_Y_SPAN = 0.02;

/** Dónde cae un valor en el dominio, de 0 (abajo) a 1 (arriba); en log, en su escala. */
export function valueFraction(d: AxisDomain, v: number): number {
  if (d.log) return v > 0 && d.d1 > d.d0 ? Math.log(v / d.d0) / Math.log(d.d1 / d.d0) : 0;
  return d.d1 === d.d0 ? 0 : (v - d.d0) / (d.d1 - d.d0);
}

/** Valor en una fracción del dominio (lo contrario de valueFraction). */
export function valueAt(d: AxisDomain, f: number): number {
  return d.log ? d.d0 * Math.pow(d.d1 / d.d0, f) : d.d0 + f * (d.d1 - d.d0);
}

/**
 * Dominio del eje Y con la ventana `v`: los extremos son los de la ventana, sin redondear (el
 * deslizante manda), y el paso se recalcula para ese tramo, así las marcas siguen siendo redondas.
 */
export function windowDomain(d: AxisDomain, v: View, ticks: number): AxisDomain {
  const d0 = valueAt(d, v.start);
  const d1 = valueAt(d, v.end);
  if (!d.log) return { d0, d1, step: niceStep(d1 - d0, ticks) };
  const marks = valueTicks({ d0, d1, step: 0, log: true }, ticks);
  // En log el paso es la menor marca (decide los decimales); si salieron marcas lineales, la
  // distancia entre ellas.
  const step = marks.length > 1 ? Math.min(marks[0], marks[1] - marks[0]) : d0;
  return { d0, d1, step, log: true };
}

/**
 * Marcas de un eje del valor. En log, las redondas de su escala; si en el tramo caben menos de
 * dos (con zoom en Y: entre 23 y 41 no hay ningún 1, 2 o 5 × 10ⁿ), unas lineales redondas.
 */
export function valueTicks(d: AxisDomain, count: number): number[] {
  if (!d.log) return numberTicks(d.d0, d.d1, d.step);
  const marks = logTicks(d.d0, d.d1, count);
  return marks.length >= 2 ? marks : numberTicks(d.d0, d.d1, niceStep(d.d1 - d.d0, count));
}

/**
 * Primer y último índice que se ven en el área (0 a `length` px); null si ninguno. Con banda
 * cuenta toda banda que asoma, aunque su centro quede fuera. `neighbors` suma el índice de cada
 * lado fuera del área en una escala continua (la línea que sale por el borde va hacia ellos).
 * Las posiciones crecen con el índice, así que basta una búsqueda binaria por cada extremo.
 */
export function visibleIndices(x: XScale, length: number, neighbors = false): [number, number] | null {
  const n = x.n;
  if (!n) return null;
  // Una banda cuenta si asoma más de medio px; un punto, si cae a menos de medio px del borde.
  const tol = x.bandwidth ? x.bandwidth / 2 - 0.5 : 0.5;
  let first = lowerBound(n, (i) => x.at(i) >= -tol);
  let last = lowerBound(n, (i) => x.at(i) > length + tol) - 1;
  // Con banda no hace falta: toda banda que asoma ya cuenta y no hay líneas que salgan hacia otra.
  if (neighbors && x.kind !== 'band') {
    first = Math.max(0, first - 1);
    last = Math.min(n - 1, last + 1);
  }
  return first <= last ? [first, last] : null;
}

/** Primer i en [0, n) donde `ok(i)` es verdad (ok es monótona); n si ninguno. */
function lowerBound(n: number, ok: (i: number) => boolean): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
