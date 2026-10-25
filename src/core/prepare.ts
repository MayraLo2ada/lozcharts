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
  /** Sistema de coordenadas común a todas las series. */
  coords: 'cartesian' | 'polar' | 'free';
  /** La leyenda lista categorías (porciones de un pie), no series. */
  pointLegend: boolean;
  /** Con pointLegend: posición en la paleta de cada punto (-1 para "Otros"). */
  pointSlots: number[];
  /** Categorías sumadas en "Otros", con su valor: el tooltip y la tabla las detallan. */
  others: { label: string; value: number }[];
}

export interface PrepareInput {
  data: Datum[];
  xField: string;
  xType: XAxisType;
  series: SeriesOptions[];
  /** Convertir cada serie a índice base 100 (ver yAxis.index). */
  index?: boolean;
  /** Usar escala de banda aunque ninguna serie la pida (ver xAxis.band). */
  band?: boolean;
  /** Se permite el eje derecho (no en índice ni en horizontal, donde no tiene sentido). */
  rightAxis?: boolean;
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

  // Todas las series comparten el sistema de coordenadas de la primera.
  const coords = (defs[0] && registry.get(defs[0].type)!.coords) ?? 'cartesian';
  defs = defs.filter((s) => {
    if ((registry.get(s.type)!.coords ?? 'cartesian') === coords) return true;
    console.warn(`LozChart: "${s.name ?? s.field}" (${s.type}) no se puede mezclar con series de tipo ${defs[0].type}.`);
    return false;
  });
  // Leyenda por categorías (pie): cada categoría con su color. Los tipos libres (pie, gauge,
  // embudo) usan toda el área: una sola serie por gráfico (para varios, small multiples).
  const pointLegend = !!defs[0] && registry.get(defs[0].type)!.legendBy === 'points';
  if ((pointLegend || coords === 'free') && defs.length > 1) {
    console.warn(
      `LozChart: un gráfico de tipo ${defs[0].type} muestra una sola serie; se usa "${defs[0].name ?? defs[0].field}".`,
    );
    defs = defs.slice(0, 1);
  }
  let pointSlots: number[] = [];
  let others: { label: string; value: number }[] = [];
  if (pointLegend) {
    // Más categorías que colores: las primeras llevan los colores de la paleta y el resto (al menos
    // dos, nunca un "Otros" de una sola) se suma en "Otros", en gris neutro. Nunca se repite un color, y ninguna categoría desaparece: su
    // detalle queda en `others`. Los negativos no cuentan (en una proporción valen 0).
    const field = defs[0].field;
    if (rows.length > maxSeries) {
      const tail = rows.slice(maxSeries - 1);
      others = tail.map((r) => ({ label: String(r[xField] ?? ''), value: toNumber(r[field]) }));
      const parts = others.map((o) => o.value).filter(isFinite);
      const sum = parts.length ? parts.reduce((acc, v) => acc + Math.max(0, v), 0) : NaN;
      rows = [...rows.slice(0, maxSeries - 1), { [xField]: OTHERS, [field]: sum }];
      if (xNum.length) xNum = [...xNum.slice(0, maxSeries - 1), NaN];
    }
    pointSlots = rows.map((_, i) => (others.length && i === rows.length - 1 ? -1 : i));
  }

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
  const axisOf = (options: SeriesOptions): 'left' | 'right' => {
    if (options.axis !== 'right') return 'left';
    if (input.rightAxis) return 'right';
    console.warn(`LozChart: "${options.name ?? options.field}" pide el eje derecho, que no aplica en índice ni en horizontal.`);
    return 'left';
  };
  const series: PreparedSeries[] = defs.map((options, index) => {
    const impl = registry.get(options.type)!;
    const axis = axisOf(options);
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
      texts: textColumns(options, impl, rows, xField),
      stackKey: stackKeyOf(options, impl, axis),
      axis,
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
      texts: {},
      stackKey: stackKeyOf(first, registry.get(first.type)!, axisOf(first)),
      axis: axisOf(first),
    });
  }

  if (input.index) for (const s of series) toIndex(s);

  return {
    n: rows.length,
    xType,
    xRaw: rows.map((r) => r[xField]),
    xNum,
    timeUnit: xType === 'time' ? detectTimeUnit(xNum) : null,
    series,
    band: !!input.band || series.some((s) => s.impl.band),
    coords,
    pointLegend,
    pointSlots,
    others,
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

/** Columnas de texto que pide el tipo de serie; vacío o ausente es ''. */
function textColumns(options: SeriesOptions, impl: SeriesImpl, rows: Datum[], xField: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, field] of Object.entries(impl.texts?.(options, xField) ?? {})) {
    out[name] = rows.map((r) => (field && r[field] !== null && r[field] !== undefined ? String(r[field]) : ''));
  }
  return out;
}

/**
 * Índice base 100: divide por el primer valor y multiplica por 100 (también las columnas en
 * unidades del eje, como el máximo y el mínimo de una vela). Guarda los originales en `raw`.
 */
function toIndex(s: PreparedSeries): void {
  const base = s.values.find((v) => isFinite(v) && v !== 0);
  if (base === undefined || base < 0) {
    console.warn(`LozChart: la serie "${s.name}" no tiene un primer valor positivo; no se puede convertir a índice.`);
    s.raw = s.values;
    s.values = s.values.map(() => NaN);
    return;
  }
  const k = 100 / base;
  s.raw = s.values;
  s.values = s.values.map((v) => v * k);
  for (const name of s.impl.valueColumns ?? []) if (s.columns[name]) s.columns[name] = s.columns[name].map((v) => v * k);
}

/** Las series se apilan con otras del mismo tipo, el mismo grupo y el mismo eje. */
function stackKeyOf(s: SeriesOptions, impl: SeriesImpl, axis: 'left' | 'right'): string | null {
  if (!impl.stackable || !s.stack) return null;
  return `${s.type}:${axis}:${s.stack === true ? '' : s.stack}`;
}
