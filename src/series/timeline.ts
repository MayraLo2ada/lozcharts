/**
 * Línea de tiempo (LozTimeline): tramos en el tiempo. Cada fila es un tramo que empieza en la X
 * (una fecha) y termina en `end`; sin fin, o con el mismo instante, es un hito (un rombo). El
 * nombre del tramo sale de `label` o, si no se da, de `field`: la X ya es la fecha y `field` es
 * obligatorio, así que aquí nombra en vez de medir (no hay un valor que comparar, solo fechas).
 * Con `label`, `field` queda libre para un número (un avance, un costo) que lea quien extienda el tipo.
 *
 * Carriles: con `group`, uno por grupo en el orden en que aparecen en el tiempo, con su nombre
 * a la izquierda y su color de la paleta; con más de 8, los 7 primeros llevan color y el resto se
 * junta en "Otros", en gris: nunca se cicla. Sin `group`, un solo carril y el color de la serie.
 * Dentro de cada carril, los tramos que se solapan bajan a otra fila: cada tramo va a la primera
 * fila libre, recorriendo por inicio (greedy). Para intervalos ese recorrido usa el mínimo de
 * filas posible, y es determinista: los empates se ordenan por fin (el más largo arriba) y por
 * fila de datos. El solape se mide en px, con el rombo y el ancho mínimo de cada marca, así
 * nada se toca aunque dos hitos caigan el mismo día.
 *
 * Fechas: como la X de un eje de tiempo ('AAAA', 'AAAA-MM' y 'AAAA-MM-DD' en hora local, Date,
 * milisegundos o texto ISO). Un fin anterior al inicio se toma como un error de orden: se
 * invierten y se avisa una vez en consola. Un fin que no es fecha deja el tramo como hito (el
 * tooltip lo dice). Una fila sin inicio válido no se dibuja; con `xAxis.type: 'time'` el núcleo
 * ya la descarta y además ordena las filas por inicio.
 *
 * Eje: ticks de calendario del núcleo (horas, días, meses, años, décadas o siglos según el
 * rango), nunca más finos que la precisión de los datos: con fechas por año no aparecen meses.
 * Los nombres de los tramos van adentro si caben, si no a la derecha si hay lugar hasta la marca
 * siguiente de su fila (o a la izquierda si es la última, contra el borde), si no adentro
 * recortados con "…" o se omiten: nunca hay texto sobre texto ni sobre otra marca. Las fechas
 * del eje y del tooltip y la duración ("3 meses y 12 días") van en el idioma del gráfico.
 *
 * Hoy: con `today`, una línea vertical discontinua (4 3) en texto secundario en el día de hoy o en
 * la fecha dada, con su texto arriba ("Hoy" o la fecha), en una franja que se reserva solo si la
 * fecha cae dentro del eje. Va encima de las marcas, que siguen leyéndose a través de los huecos.
 *
 * Toda la geometría (lectura de fechas, carriles, filas, layout, ticks, etiquetas, hit-test y
 * duraciones) son funciones puras.
 */
import {
  dimmed,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { MAX_COLORS } from '../core/theme';
import { attrs, esc } from '../core/dom';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';
import { parseTime, timeTickLabel } from '../core/format';
import { chooseTimeInterval, timeTicks, type TimeUnit } from '../core/ticks';
import { inkFor } from '../core/color';

/** Barras de hasta 24 px de alto (como todas las barras), en filas de hasta 34 px. */
const BAR_MAX = 24;
const ROW_MAX = 34;
/** Parte de la fila que ocupa la barra cuando hay que achicar: el resto es aire entre filas. */
const BAR_SHARE = 0.72;
const RADIUS = 4;
/** Un tramo muy corto se ve igual: nunca menos de este ancho. */
export const MIN_BAR = 2;
/** Medio alto del rombo de un hito, en px (se achica con la fila). */
export const MILESTONE_R = 8;
/** Aire mínimo entre dos marcas de una misma fila, en px. */
export const MARK_GAP = 4;
/** Aire entre carriles; a la mitad va una línea de la rejilla. */
const LANE_GAP = 12;
/** Alto reservado abajo para las fechas del eje. */
export const AXIS_H = 28;
/** Aire entre el borde del área de las marcas y la primera o última fecha. */
export const INSET = 10;
/** Separación mínima entre dos fechas del eje. */
const TICK_GAP = 12;
// Etiquetas.
const FONT = 12;
const PAD = 6;
const SPACE = 6;
const SWATCH = 10;
/** Alto de fila desde el que un nombre se lee sin tocar la fila de al lado. */
const MIN_TEXT_ROW = 15;
/** Alto de barra para un nombre adentro. */
const MIN_TEXT_BAR = 14;
/** Debajo de este ancho, un nombre recortado adentro ya no se lee. */
const MIN_CUT = 48;
/** Un nombre recortado conserva al menos esta parte de sus letras, o no va. */
const MIN_KEPT = 0.7;
/** Aire entre lo anterior de la fila y un nombre puesto a la izquierda de su marca. */
const LEFT_CLEAR = 18;
/** Los nombres de los carriles ocupan como máximo esta parte del ancho. */
const GUTTER_SHARE = 0.28;
/** Tolerancia del puntero alrededor de una marca angosta (px). */
const HIT_SLOP = 4;
/** Idioma de las fechas y duraciones si el contexto no da uno. */
const LOCALE = 'es';
/** Franja de arriba para el texto de la línea de hoy, y su trazo discontinuo. */
const TODAY_H = 20;
const TODAY_DASH = '4 3';
export const OTHERS = 'Otros';
const NO_GROUP = 'Sin grupo';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const UNIT_MS: Record<TimeUnit, number> = { minute: MIN, hour: HOUR, day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY };

// ------------------------------------------------------------ Fechas

/**
 * Timestamp de una celda que llega como texto (el núcleo entrega las columnas de texto con
 * String()). Lee lo mismo que un eje de tiempo: 'AAAA', 'AAAA-MM' y 'AAAA-MM-DD' en hora local,
 * milisegundos, un Date convertido a texto o ISO con hora. Un número de cuatro cifras es un año:
 * en una cronología, 1914 es un año y no 1,914 s después de 1970. Vacío o ilegible: NaN.
 */
export function readTime(text: string): number {
  const s = text.trim();
  if (!s) return NaN;
  if (/^\d{4}(?:-\d{1,2}(?:-\d{1,2})?)?$/.test(s)) return parseTime(s);
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return parseTime(s);
}

/**
 * Precisión de las fechas: la unidad más fina que de verdad usan. Si todas caen el 1 de enero,
 * son años; el día 1, meses; a medianoche, días. Decide los ticks mínimos, cómo se escriben las
 * fechas y hasta dónde baja la duración.
 */
export function timePrecision(times: readonly number[]): TimeUnit {
  let level = 0;
  for (const t of times) {
    if (!isFinite(t)) continue;
    const d = new Date(t);
    if (d.getMinutes() || d.getSeconds() || d.getMilliseconds()) return 'minute';
    if (d.getHours()) level = Math.max(level, 3);
    else if (d.getDate() !== 1) level = Math.max(level, 2);
    else if (d.getMonth()) level = Math.max(level, 1);
  }
  return (['year', 'month', 'day', 'hour'] as const)[level];
}

/** Suma meses de calendario; el 31 de enero más un mes es el último día de febrero. */
function addMonths(t: number, k: number): number {
  const d = new Date(t);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + k);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

function addDays(t: number, k: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + k);
  return d.getTime();
}

/**
 * Duración de calendario entre dos instantes: [años, meses, días, horas, minutos]. Meses y días
 * se cuentan en el calendario local (no en bloques de 30 días ni de 24 horas), así un tramo del
 * 1 de marzo al 1 de abril dura "1 mes" aunque cruce un cambio de horario.
 */
export function durationParts(a: number, b: number): number[] {
  if (!(b > a)) return [0, 0, 0, 0, 0];
  const s = new Date(a);
  const e = new Date(b);
  let months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth();
  if (addMonths(a, months) > b) months--;
  let cur = addMonths(a, months);
  let days = 0;
  for (let next = addDays(cur, 1); next <= b; next = addDays(cur, 1)) {
    cur = next;
    days++;
  }
  const rest = b - cur;
  return [Math.floor(months / 12), months % 12, days, Math.floor(rest / HOUR), Math.floor((rest % HOUR) / MIN)];
}

const UNIT_NAMES: readonly (readonly [string, string])[] = [
  ['año', 'años'],
  ['mes', 'meses'],
  ['día', 'días'],
  ['hora', 'horas'],
  ['minuto', 'minutos'],
];
/** Las mismas unidades para Intl, en el idioma del gráfico. */
const INTL_UNITS = ['year', 'month', 'day', 'hour', 'minute'] as const;

/** Intl.ListFormat es de ES2021 y el build apunta a ES2020: se usa si el entorno lo tiene. */
interface ListFormat {
  format(list: string[]): string;
}
type ListFormatConstructor = new (locale: string, options: { type: 'conjunction' }) => ListFormat;
const ListFormatImpl = (Intl as unknown as { ListFormat?: ListFormatConstructor }).ListFormat;

const unitFormats = new Map<string, Intl.NumberFormat>();
const listFormats = new Map<string, ListFormat>();

/** "3 meses", "3 months": la cantidad con su unidad en el idioma dado; en español si Intl no puede. */
function unitText(v: number, k: number, locale: string): string {
  const key = `${locale}|${k}`;
  let f = unitFormats.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: 'unit', unit: INTL_UNITS[k], unitDisplay: 'long' });
    } catch {
      return `${v} ${UNIT_NAMES[k][v === 1 ? 0 : 1]}`;
    }
    unitFormats.set(key, f);
  }
  return f.format(v);
}

/** "3 meses y 12 días": las partes unidas como en el idioma dado. */
function joinParts(parts: string[], locale: string): string {
  let f = listFormats.get(locale);
  if (!f) {
    try {
      if (!ListFormatImpl) throw new Error('sin Intl.ListFormat');
      f = new ListFormatImpl(locale, { type: 'conjunction' });
    } catch {
      return parts.join(' y ');
    }
    listFormats.set(locale, f);
  }
  return f.format(parts);
}
/** Cuántas unidades de UNIT_NAMES tienen sentido con cada precisión. */
const PRECISION_DEPTH: Record<TimeUnit, number> = { year: 1, month: 2, week: 3, day: 3, hour: 4, minute: 5 };

/**
 * Duración legible: las dos unidades mayores que no son cero ("3 meses y 12 días", "2 años",
 * "5 horas y 20 minutos"), sin bajar de la precisión de los datos. '' si no dura nada.
 */
export function durationText(a: number, b: number, precision: TimeUnit = 'minute', locale = LOCALE): string {
  const parts = durationParts(a, b);
  const pick = (limit: number) =>
    parts
      .map((v, k) => [v, k] as const)
      .filter(([v, k]) => v > 0 && k < limit)
      .slice(0, 2);
  // Un tramo más corto que la precisión (dos horas en datos por día) dice igual cuánto duró.
  let shown = pick(PRECISION_DEPTH[precision]);
  if (!shown.length) shown = pick(UNIT_NAMES.length);
  return joinParts(
    shown.map(([v, k]) => unitText(v, k, locale)),
    locale,
  );
}

/** Opciones de Intl según la precisión; con `year: false`, sin el año (va al final del rango). */
function dateOptions(precision: TimeUnit, year = true): Intl.DateTimeFormatOptions {
  const y: Intl.DateTimeFormatOptions = year ? { year: 'numeric' } : {};
  switch (precision) {
    case 'year':
      return { year: 'numeric' };
    case 'month':
      return { month: 'short', ...y };
    case 'week':
    case 'day':
      return { day: 'numeric', month: 'short', ...y };
    default:
      return { day: 'numeric', month: 'short', ...y, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  }
}

/** "sept." → "sept": el punto de abreviatura es ruido junto a una fecha. */
const clean = (s: string) => s.replace(/\./g, '');

/** Fecha con la precisión de los datos: "1914", "mar 2026", "3 mar 2026", "3 mar 2026, 14:30". */
export function formatTime(t: number, precision: TimeUnit, locale = LOCALE): string {
  return clean(timeTickLabel(t, 'day', locale, dateOptions(precision)));
}

/**
 * Inicio y fin juntos, sin repetir lo que comparten: "3 mar – 15 jun 2026" en un mismo año y
 * "3 mar 2026, 09:00 – 11:30" en un mismo día.
 */
export function formatRange(a: number, b: number, precision: TimeUnit, locale = LOCALE): string {
  const s = new Date(a);
  const e = new Date(b);
  const sameYear = s.getFullYear() === e.getFullYear();
  const timed = precision === 'hour' || precision === 'minute';
  if (timed && sameYear && s.getMonth() === e.getMonth() && s.getDate() === e.getDate()) {
    const hm: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    return `${formatTime(a, precision, locale)} – ${clean(timeTickLabel(b, 'day', locale, hm))}`;
  }
  if (sameYear && !timed && precision !== 'year') {
    return `${clean(timeTickLabel(a, 'day', locale, dateOptions(precision, false)))} – ${formatTime(b, precision, locale)}`;
  }
  return `${formatTime(a, precision, locale)} – ${formatTime(b, precision, locale)}`;
}

// ------------------------------------------------------------ Modelo

export interface Span {
  /** Fila en los datos. */
  index: number;
  start: number;
  /** Igual a `start` en un hito. */
  end: number;
  milestone: boolean;
  /** El fin venía antes que el inicio: se invirtieron. */
  swapped: boolean;
  /** Tenía un fin que no era fecha: queda como hito. */
  badEnd: boolean;
  /** Carril (0 sin grupos). */
  lane: number;
}

export interface Lane {
  name: string;
  /** Posición en la paleta, o -1 para "Otros". */
  slot: number;
}

/** Todo lo que no depende del tamaño del gráfico. */
export interface TimelineModel {
  /** Tramos dibujables en orden temporal: por inicio, el más largo primero y por fila. */
  spans: Span[];
  byRow: Map<number, Span>;
  /** Carriles con nombre (con `group`); sin grupos, vacío: un solo carril sin nombre. */
  lanes: Lane[];
  grouped: boolean;
  /** Primer inicio y último fin. */
  t0: number;
  t1: number;
  precision: TimeUnit;
  /** Filas sin inicio válido y filas con fin antes del inicio. */
  invalid: number[];
  swapped: number[];
}

/**
 * Carriles de los grupos, en el orden dado (el de su primera aparición en el tiempo). Hasta
 * `maxColors` grupos, cada uno con su color; con más, los primeros `maxColors − 1` y "Otros".
 */
export function laneSlots(names: readonly string[], maxColors = MAX_COLORS): { lanes: Lane[]; laneOf: Map<string, number> } {
  const fold = names.length > maxColors;
  const kept = fold ? names.slice(0, maxColors - 1) : names;
  const lanes: Lane[] = kept.map((name, slot) => ({ name, slot }));
  const laneOf = new Map(kept.map((name, k) => [name, k] as const));
  if (fold) {
    lanes.push({ name: OTHERS, slot: -1 });
    for (const name of names.slice(maxColors - 1)) laneOf.set(name, lanes.length - 1);
  }
  return { lanes, laneOf };
}

/** Modelo a partir de las columnas de texto: inicio, fin y, si hay, el grupo de cada fila. */
export function buildModel(
  starts: readonly string[],
  ends: readonly string[],
  groups: readonly string[] | null,
  maxColors = MAX_COLORS,
): TimelineModel {
  const spans: Span[] = [];
  const invalid: number[] = [];
  const swapped: number[] = [];
  for (let i = 0; i < starts.length; i++) {
    const s = readTime(starts[i] ?? '');
    if (!isFinite(s)) {
      invalid.push(i);
      continue;
    }
    const raw = ends[i] ?? '';
    const e = readTime(raw);
    const badEnd = raw.trim() !== '' && !isFinite(e);
    let [a, b] = [s, isFinite(e) ? e : s];
    const sw = b < a;
    if (sw) {
      [a, b] = [b, a];
      swapped.push(i);
    }
    spans.push({ index: i, start: a, end: b, milestone: a === b, swapped: sw, badEnd, lane: 0 });
  }
  spans.sort((p, q) => p.start - q.start || q.end - p.end || p.index - q.index);
  let lanes: Lane[] = [];
  if (groups) {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const sp of spans) {
      const g = groups[sp.index] || NO_GROUP;
      if (!seen.has(g)) {
        seen.add(g);
        names.push(g);
      }
    }
    const slots = laneSlots(names, maxColors);
    lanes = slots.lanes;
    for (const sp of spans) sp.lane = slots.laneOf.get(groups[sp.index] || NO_GROUP)!;
  }
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const sp of spans) {
    t0 = Math.min(t0, sp.start);
    t1 = Math.max(t1, sp.end);
  }
  return {
    spans,
    byRow: new Map(spans.map((sp) => [sp.index, sp])),
    lanes,
    grouped: !!groups,
    t0: spans.length ? t0 : 0,
    t1: spans.length ? t1 : 0,
    precision: timePrecision(spans.flatMap((sp) => [sp.start, sp.end])),
    invalid,
    swapped,
  };
}

/**
 * Fila de cada marca dentro de un carril: la primera cuyo último extremo deja `gap` px antes del
 * inicio. Las marcas llegan por inicio; así se usa el mínimo de filas (para intervalos, el
 * mayor número que se solapan a la vez).
 */
export function packRows(items: readonly { a: number; b: number }[], gap = MARK_GAP): number[] {
  const ends: number[] = [];
  return items.map(({ a, b }) => {
    let r = ends.findIndex((end) => end + gap <= a);
    if (r < 0) r = ends.push(-Infinity) - 1;
    ends[r] = b;
    return r;
  });
}

// ------------------------------------------------------------ Layout

export interface Mark {
  index: number;
  lane: number;
  row: number;
  milestone: boolean;
  /** Extremos de la barra (en un hito, los dos son el centro del rombo). */
  x0: number;
  x1: number;
  /** Lo que ocupa en su fila, con el ancho mínimo o el rombo. */
  a: number;
  b: number;
  /** Arriba y alto de la barra; la fila empieza en `rowTop`. */
  y: number;
  h: number;
  rowTop: number;
}

export interface LaneBox {
  name: string;
  slot: number;
  y0: number;
  y1: number;
  rows: number;
}

export interface Tick {
  x: number;
  label: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface Label {
  index: number;
  x: number;
  y: number;
  text: string;
  /** Adentro de la barra (con la tinta de mayor contraste con el relleno) o a su derecha. */
  inside: boolean;
}

/** La línea de hoy (o de la fecha dada) en px, con su texto centrado arriba. */
export interface TodayLine {
  x: number;
  text: string;
  /** Dónde va el texto: centrado en la línea, salvo contra un borde. */
  textX: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface Geometry {
  /** Ancho de los nombres de los carriles, a la izquierda (0 sin grupos). */
  gutter: number;
  /** Extremos en px del primer y el último instante. */
  left: number;
  right: number;
  /** Dominio del tiempo. */
  d0: number;
  d1: number;
  marks: Mark[];
  byRow: Map<number, Mark>;
  lanes: LaneBox[];
  rowH: number;
  barH: number;
  /** Línea del eje: debajo de los carriles. */
  baseline: number;
  /** Entre carriles: dónde va la línea que los separa. */
  separators: number[];
  ticks: Tick[];
  laneLabels: { y: number; text: string }[];
  /** Nombres de los tramos que caben (vacío con `labels: false`). */
  labels: Label[];
  /** La línea de hoy, si se pidió y cae dentro del eje. */
  today: TodayLine | null;
  /** Arriba de los carriles: la franja del texto de la línea de hoy (0 sin ella). */
  top: number;
}

/** px de un instante en el área de las marcas. */
export function timeToPx(g: Pick<Geometry, 'left' | 'right' | 'd0' | 'd1'>, t: number): number {
  return g.left + ((t - g.d0) / (g.d1 - g.d0)) * (g.right - g.left);
}

/**
 * Fechas del eje que caben sin encimarse: el intervalo de calendario más fino que entra (nunca
 * más fino que los datos), las de los bordes alineadas hacia adentro y las que chocan, fuera.
 */
export function axisTicks(
  d0: number,
  d1: number,
  left: number,
  right: number,
  minX: number,
  maxX: number,
  precision: TimeUnit,
  measure: (s: string) => number,
  locale = LOCALE,
): Tick[] {
  const fits = Math.max(1, Math.floor((right - left) / (measure('30 sept') + TICK_GAP)));
  const iv = chooseTimeInterval(d0, d1, fits, precision);
  const out: Tick[] = [];
  let lastRight = -Infinity;
  for (const t of timeTicks(d0, d1, iv)) {
    const label = timeTickLabel(t, iv.unit, locale);
    const w = measure(label);
    let x = timeToPx({ left, right, d0, d1 }, t);
    let anchor: Tick['anchor'] = 'middle';
    let l = x - w / 2;
    if (l < minX) [anchor, x, l] = ['start', minX, minX];
    else if (l + w > maxX) [anchor, x, l] = ['end', maxX, maxX - w];
    if (l < lastRight + TICK_GAP / 2) continue;
    out.push({ x, label, anchor });
    lastRight = l + w;
  }
  return out;
}

/**
 * Layout en px de todo el gráfico: carriles, filas y marcas, eje y nombres. Las filas se reparten
 * el alto (hasta ROW_MAX cada una) y el bloque queda centrado sobre el eje. Con muchísimas filas
 * las barras se afinan hasta 1 px: todo se sigue viendo, y los nombres solo van donde caben.
 *
 * @param names nombre de cada fila de datos ('' si no tiene).
 * @param today la línea de hoy: instante y texto. Si cae dentro del eje, arriba se reserva su franja.
 * @param locale idioma de las fechas del eje.
 */
export function layoutTimeline(
  m: TimelineModel,
  width: number,
  height: number,
  measure: (s: string) => number,
  names: readonly string[] = [],
  labels = true,
  today: { time: number; text: string } | null = null,
  locale = LOCALE,
): Geometry {
  const laneNames = m.grouped ? m.lanes.map((l) => l.name) : [];
  const widest = Math.max(0, ...laneNames.map(measure));
  const gutter = laneNames.length ? Math.ceil(Math.min(width * GUTTER_SHARE, 2 * PAD + SWATCH + SPACE + widest)) : 0;
  const left = gutter + INSET;
  const right = Math.max(left + 10, width - INSET);
  // Un solo instante (un hito, o todos el mismo día) se centra en una unidad de su precisión.
  const pad = m.t1 > m.t0 ? 0 : UNIT_MS[m.precision];
  const d0 = m.t0 - pad;
  const d1 = m.t1 + pad;
  const map = (t: number) => timeToPx({ left, right, d0, d1 }, t);
  const todayIn = !!today && isFinite(today.time) && today.time >= d0 && today.time <= d1;
  const top = todayIn ? TODAY_H : 0;

  const laneCount = Math.max(1, m.lanes.length);
  const perLane: Mark[][] = Array.from({ length: laneCount }, () => []);
  for (const sp of m.spans) {
    const x0 = map(sp.start);
    const x1 = sp.milestone ? x0 : map(sp.end);
    const [a, b] = sp.milestone ? [x0 - MILESTONE_R, x0 + MILESTONE_R] : [x0, Math.max(x1, x0 + MIN_BAR)];
    perLane[sp.lane].push({
      index: sp.index,
      lane: sp.lane,
      row: 0,
      milestone: sp.milestone,
      x0,
      x1,
      a,
      b,
      y: 0,
      h: 0,
      rowTop: 0,
    });
  }
  const rowsOf = perLane.map((marks) => {
    const rows = packRows(marks);
    marks.forEach((mk, k) => (mk.row = rows[k]));
    return Math.max(1, ...rows.map((r) => r + 1));
  });
  const totalRows = rowsOf.reduce((s, r) => s + r, 0);
  const baseline = Math.max(10, height - AXIS_H);
  const gaps = (laneCount - 1) * LANE_GAP;
  const room = Math.max(10, baseline - top);
  const rowH = Math.max(1, Math.min(ROW_MAX, (room - gaps) / totalRows));
  const barH = Math.max(Math.min(1, rowH), Math.min(BAR_MAX, rowH * BAR_SHARE, rowH - 2));
  let y = top + Math.max(0, (room - totalRows * rowH - gaps) / 2);
  const lanes: LaneBox[] = [];
  const separators: number[] = [];
  for (let l = 0; l < laneCount; l++) {
    if (l > 0) separators.push(y - LANE_GAP / 2);
    const y0 = y;
    for (const mk of perLane[l]) {
      mk.rowTop = y0 + mk.row * rowH;
      mk.h = barH;
      mk.y = mk.rowTop + (rowH - barH) / 2;
    }
    y += rowsOf[l] * rowH;
    const lane = m.lanes[l];
    lanes.push({ name: lane?.name ?? '', slot: lane?.slot ?? 0, y0, y1: y, rows: rowsOf[l] });
    y += LANE_GAP;
  }
  const marks = perLane.flat();
  const laneRoom = gutter - 2 * PAD - SWATCH - SPACE;
  const g: Geometry = {
    gutter,
    left,
    right,
    d0,
    d1,
    marks,
    byRow: new Map(marks.map((mk) => [mk.index, mk])),
    lanes,
    rowH,
    barH,
    baseline,
    separators,
    ticks: axisTicks(d0, d1, left, right, gutter + 2, width - 2, m.precision, measure, locale),
    laneLabels: laneNames.map((name, l) => ({
      y: (lanes[l].y0 + lanes[l].y1) / 2,
      text: laneRoom >= FONT ? fitText(name, laneRoom, measure) : '',
    })),
    labels: [],
    today: todayIn ? todayLine(map(today!.time), today!.text, gutter, width, measure) : null,
    top,
  };
  if (labels) g.labels = placeLabels(g, width, names, measure);
  return g;
}

/** La línea de hoy en x, con su texto centrado arriba y corrido hacia adentro contra los bordes. */
function todayLine(x: number, text: string, from: number, to: number, measure: (s: string) => number): TodayLine {
  const half = measure(text) / 2;
  if (x - half < from) return { x, text, textX: from, anchor: 'start' };
  if (x + half > to) return { x, text, textX: to, anchor: 'end' };
  return { x, text, textX: x, anchor: 'middle' };
}

/**
 * Instante y texto de la línea de hoy según la opción `today`: true es hoy (a medianoche, o ahora
 * si los datos tienen horas) con "Hoy" en el idioma dado; una fecha, esa fecha escrita con su
 * propia precisión ('2026-06' es un mes; '2026-06-01', un día). null si no se pide o no es una fecha.
 */
export function todayMark(
  option: unknown,
  precision: TimeUnit,
  locale = LOCALE,
  now = Date.now(),
): { time: number; text: string } | null {
  if (option === undefined || option === null || option === false) return null;
  if (option === true) {
    const d = new Date(now);
    const timed = precision === 'hour' || precision === 'minute';
    // Al minuto: el puntero pide la geometría muchas veces y no debe rehacerla en cada una.
    const time = timed ? Math.floor(now / MIN) * MIN : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { time, text: todayWord(locale) };
  }
  const time = option instanceof Date || typeof option === 'number' ? +option : readTime(String(option));
  if (!isFinite(time)) return null;
  // Una fecha con día ('2026-12-01', un Date) se escribe con su día aunque caiga el 1.
  const own = timePrecision([time]);
  const withDay = typeof option !== 'string' || /^\d{4}-\d{1,2}-\d{1,2}/.test(option.trim());
  return { time, text: formatTime(time, withDay && (own === 'year' || own === 'month') ? 'day' : own, locale) };
}

/** "Hoy", "Today": la palabra del idioma dado, con mayúscula inicial. */
function todayWord(locale: string): string {
  try {
    const w = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'day');
    return w.charAt(0).toLocaleUpperCase(locale) + w.slice(1);
  } catch {
    return 'Hoy';
  }
}

/**
 * Nombres de los tramos. Adentro si el nombre entero cabe en la barra; si no, a la derecha si
 * cabe antes de la marca siguiente de su fila (o del borde); contra el borde derecho, a la
 * izquierda; si no, adentro recortado con "…" si la barra es ancha; si no, nada. Cada nombre se queda en su fila, entre su marca y la siguiente:
 * nunca hay texto sobre texto ni sobre otra marca.
 */
export function placeLabels(
  g: Pick<Geometry, 'marks' | 'rowH' | 'barH' | 'gutter'>,
  width: number,
  names: readonly string[],
  measure: (s: string) => number,
): Label[] {
  if (g.rowH < MIN_TEXT_ROW && g.barH < MIN_TEXT_BAR) return [];
  // Marcas de cada fila en orden, para saber dónde empieza la siguiente.
  const rows = new Map<string, Mark[]>();
  for (const mk of g.marks) {
    const key = `${mk.lane}:${mk.row}`;
    const list = rows.get(key);
    if (list) list.push(mk);
    else rows.set(key, [mk]);
  }
  const out: Label[] = [];
  const roomy = g.rowH >= MIN_TEXT_ROW;
  for (const list of rows.values()) {
    list.sort((p, q) => p.a - q.a);
    /** Hasta dónde llega lo ya ocupado en la fila: la marca anterior o su nombre. */
    let taken = -Infinity;
    list.forEach((mk, k) => {
      const name = names[mk.index] ?? '';
      const w = name ? measure(name) : 0;
      const cy = mk.y + mk.h / 2;
      const inner = mk.x1 - mk.x0 - 2 * PAD;
      const tall = !mk.milestone && mk.h >= MIN_TEXT_BAR;
      const lastInRow = k === list.length - 1;
      // A la derecha, el nombre deja más aire con la marca siguiente que con la suya: se lee como suyo.
      const next = lastInRow ? width : list[k + 1].a - 2 * PAD;
      let label: Label | null = null;
      if (!name) label = null;
      else if (tall && w <= inner) label = { index: mk.index, x: mk.x0 + PAD, y: cy, text: name, inside: true };
      else if (roomy && mk.b + PAD + w <= next) label = { index: mk.index, x: mk.b + PAD, y: cy, text: name, inside: false };
      else if (roomy && lastInRow && mk.a - PAD - w >= Math.max(g.gutter, taken + LEFT_CLEAR)) {
        // Contra el borde derecho (el último hito, un cierre) el nombre va a la izquierda, solo
        // si queda bien separado de lo anterior: que no se lea como el nombre de otra marca.
        label = { index: mk.index, x: mk.a - PAD - w, y: cy, text: name, inside: false };
      } else if (tall && inner >= MIN_CUT) {
        // Recortado solo si conserva la mayor parte: "Inciden…" no distingue nada.
        const cut = fitText(name, inner, measure);
        if (cut.length - 1 >= name.length * MIN_KEPT) label = { index: mk.index, x: mk.x0 + PAD, y: cy, text: cut, inside: true };
      }
      if (label) out.push(label);
      taken = Math.max(mk.b, label && !label.inside ? label.x + measure(label.text) : -Infinity);
    });
  }
  return out;
}

/**
 * Fila de datos de la marca bajo el punto, o -1. Cuenta toda la fila (una barra de 2 px se
 * apunta igual) y unos px de cada lado; si dos quedan cerca, gana la más cercana.
 */
export function hitMark(g: Pick<Geometry, 'marks' | 'rowH'>, px: number, py: number): number {
  let best = -1;
  let dist = Infinity;
  for (const mk of g.marks) {
    if (py < mk.rowTop || py > mk.rowTop + g.rowH) continue;
    const d = px < mk.a ? mk.a - px : px > mk.b ? px - mk.b : 0;
    if (d <= HIT_SLOP && d < dist) [best, dist] = [mk.index, d];
  }
  return best;
}

/** Rombo de un hito centrado en (cx, cy). */
export function diamondPath(cx: number, cy: number, r: number): string {
  if (!(r > 0)) return '';
  return `M${r2(cx)},${r2(cy - r)}L${r2(cx + r)},${r2(cy)}L${r2(cx)},${r2(cy + r)}L${r2(cx - r)},${r2(cy)}Z`;
}

// ------------------------------------------------------------ Plugin

/** Modelos por conjunto de datos: la tabla, el tooltip y el teclado lo usan antes del primer dibujo. */
const models = new WeakMap<readonly number[], TimelineModel>();

function modelOf(ps: PreparedSeries): TimelineModel {
  let m = models.get(ps.values);
  if (m) return m;
  const empty = ps.values.map(() => '');
  m = buildModel(ps.texts.start ?? empty, ps.texts.end ?? empty, ps.options.group ? (ps.texts.group ?? empty) : null);
  models.set(ps.values, m);
  // Un aviso por conjunto de datos, no uno por cuadro.
  if (m.swapped.length) {
    const list = m.swapped.map((i) => `"${ps.texts.name?.[i] || ps.texts.start?.[i]}"`).join(', ');
    console.warn(`LozChart: en la línea de tiempo "${ps.name}", ${list} termina antes de empezar; se invirtieron sus fechas.`);
  }
  return m;
}

/** Última geometría: el puntero pregunta muchas veces por lo mismo. */
let last: { m: TimelineModel; key: string; g: Geometry } | null = null;

function geometryOf(ctx: DrawContext): { m: TimelineModel; g: Geometry } {
  const ps = ctx.frame.ps;
  const m = modelOf(ps);
  const labels = ps.options.labels !== false;
  const locale = ctx.locale ?? LOCALE;
  const today = todayMark(ps.options.today, m.precision, locale);
  const key = `${ctx.width}|${ctx.height}|${labels}|${locale}|${today?.time}|${today?.text}`;
  const c = last;
  if (c && c.m === m && c.key === key) return { m, g: c.g };
  const g = layoutTimeline(m, ctx.width, ctx.height, ctx.measure, ps.texts.name ?? [], labels, today, locale);
  last = { m, key, g };
  return { m, g };
}

function colorOf(ctx: DrawContext, m: TimelineModel, lane: number): string {
  if (!m.grouped) return ctx.color;
  const s = m.lanes[lane]?.slot ?? -1;
  return s >= 0 && s < ctx.theme.palette.length ? ctx.theme.palette[s] : ctx.theme.other;
}

/** Medio alto del rombo de un hito: hasta MILESTONE_R, algo más que la barra en filas chicas. */
const diamondR = (mk: Mark) => Math.min(MILESTONE_R, Math.max(1.5, mk.h / 2 + 1));

/** Marca de un tramo o hito; `p` (0 a 1) la hace crecer desde el inicio al entrar. */
function markMarkup(ctx: DrawContext, m: TimelineModel, mk: Mark, p = 1): string {
  const fill = colorOf(ctx, m, mk.lane);
  if (mk.milestone) {
    const d = diamondPath(mk.x0, mk.y + mk.h / 2, diamondR(mk) * p);
    // Anillo de superficie: dos hitos vecinos, o un hito junto a una barra, no se funden.
    return d ? `<path${attrs({ d, fill, stroke: ctx.theme.surface, 'stroke-width': 1.5, 'stroke-linejoin': 'round' })}/>` : '';
  }
  const w = Math.max(MIN_BAR, mk.x1 - mk.x0) * p;
  if (!(w > 0.01)) return '';
  const a = { x: r2(mk.x0), y: r2(mk.y), width: r2(w), height: r2(mk.h), rx: r2(Math.min(RADIUS, w / 2, mk.h / 2)), fill };
  return `<rect${attrs(a)}/>`;
}

function text(x: number, y: number, s: string, fill: string, extra: Record<string, string | number> = {}): string {
  return `<text${attrs({ x: r2(x), y: r2(y), fill, 'font-size': FONT, 'dominant-baseline': 'central', ...extra })}>${esc(s)}</text>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  extra: Record<string, string | number> = {},
): string {
  const a = { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke, 'stroke-width': 1, 'shape-rendering': 'crispEdges' };
  return `<line${attrs({ ...a, ...extra })}/>`;
}

const crisp = (v: number) => Math.round(v) + 0.5;

/** Rejilla, separadores, eje y nombres de los carriles: todo lo que no es un tramo. */
function frameMarkup(ctx: DrawContext, m: TimelineModel, g: Geometry): string {
  const th = ctx.theme;
  let s = '';
  // Rejilla vertical de 1 px en cada fecha del eje (no en las de los bordes, corridas hacia
  // adentro); la línea del eje, un poco más marcada, como la del cero.
  for (const t of g.ticks) if (t.anchor === 'middle') s += line(crisp(t.x), 0, crisp(t.x), g.baseline, th.grid);
  for (const y of g.separators) s += line(0, crisp(y), ctx.width, crisp(y), th.grid);
  s += line(g.gutter, crisp(g.baseline), ctx.width, crisp(g.baseline), th.zero);
  for (const t of g.ticks) {
    const extra = { 'text-anchor': t.anchor, 'dominant-baseline': 'hanging', 'font-variant-numeric': 'tabular-nums' };
    s += text(t.x, g.baseline + 10, t.label, th.textMuted, extra);
  }
  // Nombre de cada carril en texto principal; la identidad la da una muestra de su color al lado.
  g.laneLabels.forEach((L, l) => {
    const fill = colorOf(ctx, m, l);
    s += `<rect${attrs({ x: PAD, y: r2(L.y - SWATCH / 2), width: SWATCH, height: SWATCH, rx: 2, fill })}/>`;
    if (L.text) s += text(PAD + SWATCH + SPACE, L.y, L.text, th.text);
  });
  return s;
}

/** La línea de hoy: discontinua, en texto secundario, desde su texto hasta el eje. */
function todayMarkup(ctx: DrawContext, g: Geometry): string {
  const t = g.today;
  if (!t) return '';
  const th = ctx.theme;
  const x = crisp(t.x);
  const extra = { 'stroke-dasharray': TODAY_DASH, 'shape-rendering': 'auto' };
  return (
    line(x, g.top - 2, x, g.baseline, th.textMuted, extra) +
    text(t.textX, g.top / 2 - 1, t.text, th.textMuted, { 'text-anchor': t.anchor })
  );
}

function labelsMarkup(ctx: DrawContext, m: TimelineModel, labels: readonly Label[], alpha = 1): string {
  const th = ctx.theme;
  let s = '';
  for (const L of labels) {
    const sp = m.byRow.get(L.index);
    const fill = L.inside && sp ? inkFor(colorOf(ctx, m, sp.lane), th) : th.text;
    s += dimmed(ctx, L.index, text(L.x, L.y, L.text, fill, alpha < 1 ? { 'fill-opacity': r2(alpha) } : {}));
  }
  return s;
}

export const timeline: SeriesImpl = {
  coords: 'free',
  layer: 0,
  legendSymbol: 'square',
  label: 'línea de tiempo',
  items: ['tramo', 'tramos'],
  dimmable: true,
  texts: (o, x) => ({ name: o.label ?? o.field, start: x, end: o.end, group: o.group }),
  draw(ctx) {
    const { m, g } = geometryOf(ctx);
    if (!m.spans.length) return '';
    // Al entrar, los tramos crecen desde su inicio: se lee hacia dónde corre el tiempo. Los
    // nombres salen de la geometría final: no saltan ni aparecen a mitad de camino.
    const p = Math.max(0, Math.min(1, ctx.frame.alpha));
    let s = frameMarkup(ctx, m, g);
    for (const mk of g.marks) s += dimmed(ctx, mk.index, markMarkup(ctx, m, mk, p));
    return s + todayMarkup(ctx, g) + labelsMarkup(ctx, m, g.labels, p);
  },
  hit(ctx, px, py) {
    return hitMark(geometryOf(ctx).g, px, py);
  },
  anchor(ctx, i) {
    const mk = geometryOf(ctx).g.byRow.get(i);
    if (!mk) return [ctx.width / 2, ctx.height / 2];
    // El núcleo abre el tooltip hacia afuera del punto: se apoya en el extremo que mira al borde,
    // así no tapa la barra que se está leyendo.
    const right = (mk.a + mk.b) / 2 >= ctx.width / 2;
    return [right ? mk.b : mk.a, mk.y + mk.h / 2];
  },
  hover(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const mk = g.byRow.get(i);
    if (!mk) return '';
    const th = ctx.theme;
    const guide = { 'stroke-opacity': 0.6 };
    const bottom = mk.y + mk.h;
    // Guías hasta el eje en el inicio y en el fin: las fechas se leen contra las del eje.
    let s = line(crisp(mk.x0), bottom, crisp(mk.x0), g.baseline, th.textMuted, guide);
    if (!mk.milestone) s += line(crisp(mk.x1), bottom, crisp(mk.x1), g.baseline, th.textMuted, guide);
    s += markMarkup(ctx, m, mk);
    // Anillo de 2 px en texto principal, separado de la marca por 1 px de aire.
    if (mk.milestone) {
      const d = diamondPath(mk.x0, mk.y + mk.h / 2, diamondR(mk) + 3);
      s += `<path${attrs({ d, fill: 'none', stroke: th.text, 'stroke-width': 2, 'stroke-linejoin': 'round' })}/>`;
    } else {
      const w = Math.max(MIN_BAR, mk.x1 - mk.x0);
      const a = {
        x: r2(mk.x0 - 2.5),
        y: r2(mk.y - 2.5),
        width: r2(w + 5),
        height: r2(mk.h + 5),
        rx: r2(Math.min(RADIUS + 2, (mk.h + 5) / 2)),
      };
      s += `<rect${attrs({ ...a, fill: 'none', stroke: th.text, 'stroke-width': 2 })}/>`;
    }
    return (
      s +
      labelsMarkup(
        ctx,
        m,
        g.labels.filter((L) => L.index === i),
      )
    );
  },
  headline(ps, i, x) {
    return ps.texts.name?.[i] || x;
  },
  // El color del carril del tramo (con grupos), como su barra o su rombo.
  swatch(ctx, i) {
    const m = modelOf(ctx.frame.ps);
    const sp = m.byRow.get(i);
    return sp ? colorOf(ctx, m, sp.lane) : null;
  },
  navigable(ps) {
    return modelOf(ps).spans.map((sp) => sp.index);
  },
  tooltip(ps: PreparedSeries, i: number, f: TooltipFormat): TooltipValue {
    const locale = f.locale ?? LOCALE;
    const m = modelOf(ps);
    const sp = m.byRow.get(i);
    if (!sp) return { value: 'Sin fecha válida' };
    const details: [string, string][] = [];
    let value: string;
    if (sp.milestone) {
      value = formatTime(sp.start, m.precision, locale);
      if (sp.badEnd) details.push(['Fin', 'no es una fecha válida']);
    } else {
      value = formatRange(sp.start, sp.end, m.precision, locale);
      details.push(['Duración', durationText(sp.start, sp.end, m.precision, locale)]);
      if (sp.swapped) details.push(['Nota', 'el fin venía antes del inicio']);
    }
    if (m.grouped) details.push(['Grupo', ps.texts.group?.[i] || NO_GROUP]);
    return details.length ? { value, details } : { value };
  },
};
