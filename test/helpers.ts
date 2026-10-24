import type { SeriesImpl } from '../src/core/series';
import type { SeriesOptions } from '../src/types';
import { prepare } from '../src/core/prepare';

/** Tipos de serie mínimos: solo importan sus banderas, no cómo dibujan. */
export const registry = new Map<string, SeriesImpl>([
  ['bar', { band: true, cluster: true, stackable: true, includeZero: true, draw: () => '' }],
  ['area', { stackable: true, includeZero: true, draw: () => '' }],
  ['line', { draw: () => '' }],
  ['range', { columns: (o) => ({ low: o.low }), valueColumns: ['low'], draw: () => '' }],
  ['bubble', { pointer: 'nearest', columns: (o) => ({ size: o.size }), draw: () => '' }],
]);

export function prep(
  data: Record<string, unknown>[],
  series: SeriesOptions[],
  xType: 'category' | 'time' | 'linear' = 'category',
) {
  return prepare({ data, xField: 'x', xType, series }, registry, 8);
}

/** Compara números ignorando el ruido de coma flotante. */
export const round = (a: number[]) => a.map((v) => (isFinite(v) ? Math.round(v * 1e6) / 1e6 : v));
