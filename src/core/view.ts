/**
 * Ventana del zoom: qué parte del eje X se ve.
 *
 * Se guarda como fracciones del largo total del eje: { start: 0.25, end: 0.5 } es el segundo
 * cuarto. Así la misma ventana vale para barras (bandas), fechas y números, y no depende del
 * ancho en px: si el gráfico cambia de tamaño, se sigue viendo lo mismo.
 * Las escalas reciben la ventana y estiran el eje: lo que queda fuera cae fuera del área.
 */
import type { XScale } from './scales';

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
