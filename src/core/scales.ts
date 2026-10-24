/**
 * Escalas: traducen un valor de datos a una posición en píxeles.
 *
 * - LinearScale: regla de tres entre un dominio [d0, d1] y un rango [r0, r1]. Es la del eje Y.
 * - BandScale: reparte el ancho en n "bandas" iguales; at(i) es el centro de la banda i.
 *   Se usa en X cuando hay barras.
 * - ContinuousScale: posiciona cada índice según su valor real (fecha o número), así los
 *   huecos en el tiempo se ven como huecos. Se usa en X cuando no hay barras.
 *
 * Las dos escalas de X comparten la interfaz XScale: todas las series consultan x.at(i).
 */

export class LinearScale {
  constructor(
    public d0: number,
    public d1: number,
    public r0: number,
    public r1: number,
  ) {}

  map(v: number): number {
    const span = this.d1 - this.d0;
    if (span === 0) return (this.r0 + this.r1) / 2;
    return this.r0 + ((v - this.d0) / span) * (this.r1 - this.r0);
  }

  invert(px: number): number {
    const span = this.r1 - this.r0;
    if (span === 0) return this.d0;
    return this.d0 + ((px - this.r0) / span) * (this.d1 - this.d0);
  }
}

export interface XScale {
  kind: 'band' | 'continuous';
  /** Cantidad de puntos (índices). */
  n: number;
  /** Posición en px del índice i. */
  at(i: number): number;
  /** Ancho de una banda (0 en continua). */
  bandwidth: number;
  /** Distancia típica entre dos índices vecinos, en px. */
  step: number;
  /** Índice más cercano a una posición en px. */
  indexAt(px: number): number;
  /** Ancho total del rango. */
  width: number;
}

export class BandScale implements XScale {
  readonly kind = 'band' as const;
  readonly step: number;
  readonly bandwidth: number;

  constructor(
    public n: number,
    public width: number,
  ) {
    this.step = width / Math.max(1, n);
    this.bandwidth = this.step;
  }

  at(i: number): number {
    return this.step * (i + 0.5);
  }

  indexAt(px: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.floor(px / this.step)));
  }
}

export class ContinuousScale implements XScale {
  readonly kind = 'continuous' as const;
  readonly bandwidth = 0;
  readonly step: number;
  readonly n: number;
  readonly lin: LinearScale;

  /** @param values valor numérico (timestamp o número) de cada índice, en orden. */
  constructor(
    public values: number[],
    public width: number,
  ) {
    this.n = values.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    this.lin = new LinearScale(lo, hi, 0, width);
    this.step = this.n > 1 ? width / (this.n - 1) : width;
  }

  get domain(): [number, number] {
    return [this.lin.d0, this.lin.d1];
  }

  at(i: number): number {
    return this.n === 1 ? this.width / 2 : this.lin.map(this.values[i]);
  }

  /** Búsqueda binaria del índice más cercano (los valores vienen ordenados). */
  indexAt(px: number): number {
    const v = this.lin.invert(px);
    const vals = this.values;
    let lo = 0;
    let hi = vals.length - 1;
    if (hi <= 0) return 0;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (vals[mid] < v) lo = mid;
      else hi = mid;
    }
    return Math.abs(vals[lo] - v) <= Math.abs(vals[hi] - v) ? lo : hi;
  }
}
