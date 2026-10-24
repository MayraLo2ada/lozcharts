/**
 * Preparación: de las opciones del usuario a datos listos para apilar y dibujar.
 * Lee cada campo, ordena por X cuando es tiempo o número, descarta tipos no registrados
 * y asigna a cada serie su posición en la paleta (según su orden, no su visibilidad).
 */
import type { Datum, SeriesOptions, XAxisType } from '../types';
import type { PreparedSeries, SeriesImpl } from './series';
import { parseTime } from './format';
import { detectTimeUnit, type TimeUnit } from './ticks';

export interface Prepared {
  n: number;
  xType: XAxisType;
  /** Valor original de X en cada índice. */
  xRaw: unknown[];
  /** Valor numérico de X (timestamp o número). Vacío en 'category'. */
  xNum: number[];
  /** Granularidad de las fechas, o null si X no es tiempo. */
  timeUnit: TimeUnit | null;
  series: PreparedSeries[];
  /** Alguna serie necesita escala de banda (barras). */
  band: boolean;
}

export interface PrepareInput {
  data: Datum[];
  xField: string;
  xType: XAxisType;
  series: SeriesOptions[];
}

export const OTHERS = 'Otros';

/** Convierte un valor de celda en número; vacío o ausente es NaN (un hueco). */
export function toNumber(v: unknown): number {
  return v === null || v === undefined || v === '' ? NaN : Number(v);
}

/**
 * @param maxSeries colores disponibles en la paleta. Si sobran series apilables del mismo
 *   grupo, las sobrantes se suman en "Otros"; si no, se muestran solo las primeras.
 */
export function prepare(input: PrepareInput, registry: ReadonlyMap<string, SeriesImpl>, maxSeries: number): Prepared {
  const { xField, xType } = input;
  let rows = input.data;
  let xNum: number[] = [];
  if (xType !== 'category') {
    const read = xType === 'time' ? parseTime : toNumber;
    const keyed = rows.map((row) => ({ row, x: read(row[xField]) })).filter((r) => isFinite(r.x));
    keyed.sort((a, b) => a.x - b.x);
    rows = keyed.map((r) => r.row);
    xNum = keyed.map((r) => r.x);
  }

  let defs = input.series.filter((s) => {
    if (registry.has(s.type)) return true;
    console.warn(`LozChart: el tipo de serie "${s.type}" no está registrado.`);
    return false;
  });

  let folded: SeriesOptions[] = [];
  if (defs.length > maxSeries) {
    const tail = defs.slice(maxSeries - 1);
    const sameStack = tail.every((s) => s.type === tail[0].type && s.stack && s.stack === tail[0].stack);
    if (sameStack && registry.get(tail[0].type)!.stackable) {
      folded = tail;
      defs = defs.slice(0, maxSeries - 1);
    } else {
      console.warn(
        `LozChart: hay ${defs.length} series y la paleta tiene ${maxSeries} colores. ` +
          `Se muestran las primeras ${maxSeries}; agrupa el resto o divide el gráfico.`,
      );
      defs = defs.slice(0, maxSeries);
    }
  }

  const column = (field: string) => rows.map((r) => toNumber(r[field]));
  const series: PreparedSeries[] = defs.map((options, index) => {
    const impl = registry.get(options.type)!;
    const slot =
      Number.isInteger(options.color) && options.color! >= 1 && options.color! <= maxSeries ? options.color! - 1 : index;
    return {
      key: options.name ?? options.field,
      name: options.name ?? options.field,
      impl,
      slot,
      options,
      values: column(options.field),
      columns: extraColumns(options, impl, column),
      stackKey: stackKeyOf(options, impl),
    };
  });

  if (folded.length) {
    const first = folded[0];
    const parts = folded.map((s) => column(s.field));
    series.push({
      key: OTHERS,
      name: OTHERS,
      impl: registry.get(first.type)!,
      slot: -1,
      options: { ...first, name: OTHERS },
      values: rows.map((_, i) => parts.reduce((sum, col) => sum + (isFinite(col[i]) ? col[i] : 0), 0)),
      columns: {},
      stackKey: stackKeyOf(first, registry.get(first.type)!),
    });
  }

  return {
    n: rows.length,
    xType,
    xRaw: rows.map((r) => r[xField]),
    xNum,
    timeUnit: xType === 'time' ? detectTimeUnit(xNum) : null,
    series,
    band: series.some((s) => s.impl.band),
  };
}

/** Columnas extra que pide el tipo de serie; un campo sin indicar queda vacío (NaN). */
function extraColumns(options: SeriesOptions, impl: SeriesImpl, column: (field: string) => number[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, field] of Object.entries(impl.columns?.(options) ?? {})) {
    out[name] = field ? column(field) : column(options.field).map(() => NaN);
  }
  return out;
}

/** Las series se apilan con otras del mismo tipo y el mismo grupo. */
function stackKeyOf(s: SeriesOptions, impl: SeriesImpl): string | null {
  if (!impl.stackable || !s.stack) return null;
  return `${s.type}:${s.stack === true ? '' : s.stack}`;
}
