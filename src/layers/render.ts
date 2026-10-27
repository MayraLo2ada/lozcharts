/**
 * Dibujo de los gráficos por capas: el tipo de serie 'layers' y las opciones que lo usan.
 *
 * El núcleo ve una sola serie libre ('free') con un dato por cada fila que se puede apuntar (una
 * celda, un punto, un ícono): así el tooltip, el teclado, la selección, el anuncio a lectores de
 * pantalla y la tabla oculta son los de siempre. La serie dibuja todas las capas en un área sin
 * ejes del núcleo, con sus propias escalas compartidas entre capas.
 *
 * Tres pasos con caché propio: el modelo (compile.ts; depende solo de la especificación), la
 * geometría (depende del tamaño) y la pintura (depende del tema). La animación de entrada sale
 * de `frame.alpha`, que el núcleo lleva de 0 a 1 con su curva: cada marca entra con un pequeño
 * retraso según su lugar, de izquierda a derecha.
 */
import {
  attrs,
  barPath,
  chooseTimeInterval,
  esc,
  fitPositions,
  fitProjection,
  fitText,
  forceLayout,
  geoPath,
  getMap,
  linePath,
  makeRamp,
  messages,
  mixOklab,
  niceDomain,
  numberTicks,
  paint,
  parseColor,
  projectFeature,
  r2,
  rawProjection,
  textOn,
  timeTickLabel,
  timeTicks,
  toHex,
  valueFormatter,
  type DrawContext,
  type GeoFeature,
  type LozChartOptions,
  type PreparedSeries,
  type RGB,
  type SeriesImpl,
  type SeriesOptions,
  type Theme,
  type TooltipFormat,
  type TooltipValue,
} from '@lozcharts/core';
import { fillTemplate, toNumber } from './expr';
import { ICONS } from './icons';
import { layerTexts } from './texts';
import {
  axisValue,
  bandKey,
  buildModel,
  mainLayer,
  scalePosition,
  type AxisModel,
  type ColorRef,
  type ColorScaleModel,
  type IconRef,
  type Item,
  type LayerModel,
  type Model,
  type TooltipLine,
} from './compile';
import type { LayerFormat, LayerSpec } from './spec';

type Row = Record<string, unknown>;
type Pt = [number, number];

const FONT = 12;
const SMALL = 11;
const GAP = 2;
const RADIUS = 3;
const LEGEND_H = 30;
const AXIS_H = 22;
const TITLE_H = 18;
const PAD = 8;
/** Alto de fila de una tabla de celdas y de una fila de barras horizontales, y su tope si sobra alto. */
const ROW_PITCH = 46;
const MAX_ROW_PITCH = 64;
const BAR_MAX = 24;
/** Ancho mínimo de una columna agrandada con `widths`. */
const WIDE_MIN = 56;
const ICON_SIZE = 22;
const POINT_SIZE = 10;
/** Tamaño de las marcas que vienen de un campo: diámetros mínimo y máximo (el área va con el valor). */
const SIZE_RANGE: [number, number] = [8, 34];
const GRID_OPACITY = 0.55;
/** Parte de la animación que se reparte en retrasos de izquierda a derecha. */
const STAGGER = 0.45;

const PALETTE_NAMES = ['violet', 'pink', 'ochre', 'wine', 'green', 'sky', 'coral', 'teal'];

// ------------------------------------------------------------ Opciones

/** El modelo de cada serie 'layers', por el objeto de sus opciones. */
const models = new WeakMap<SeriesOptions, Model>();

function modelOf(ps: PreparedSeries): Model | undefined {
  return models.get(ps.options);
}

/**
 * Las opciones de LozChart que dibujan una especificación por capas. No avisa nada en la consola:
 * para revisar, checkLayers; LozChart.layers avisa y dibuja.
 */
export function layerOptions(spec: LayerSpec): LozChartOptions {
  return optionsOf(buildModel(spec));
}

export function optionsOf(model: Model): LozChartOptions {
  const spec = model.spec;
  const series: SeriesOptions = { type: 'layers', field: '__v', name: typeof spec.name === 'string' ? spec.name : model.T.value };
  models.set(series, model);
  const data = model.items.map((it) => ({ __t: headline(model, it), __v: primaryValue(it) }));
  return {
    title: typeof spec.title === 'string' ? spec.title : undefined,
    subtitle: typeof spec.subtitle === 'string' ? spec.subtitle : undefined,
    ariaLabel: typeof spec.description === 'string' ? spec.description : undefined,
    locale: model.locale,
    currency: typeof spec.currency === 'string' ? spec.currency : undefined,
    theme: spec.theme,
    height: typeof spec.height === 'number' ? spec.height : undefined,
    animate: spec.animate,
    background: typeof spec.background === 'boolean' ? spec.background : undefined,
    data,
    xAxis: { field: '__t', title: model.T.item },
    series: [series],
    legend: false,
  };
}

/** Un número que representa al dato (para la descripción accesible): el primero que tenga. */
function primaryValue(it: Item): number {
  const row = it.ds.rows[it.row];
  for (const L of it.layers) {
    for (const f of [...L.valueFields, ...(L.placeFields.y ?? [])]) {
      const v = toNumber(row[f]);
      if (isFinite(v)) return v;
    }
  }
  return NaN;
}

// ------------------------------------------------------------ Formato

function numberFormat(format: LayerFormat | undefined, locale: string, currency = 'USD'): (v: number) => string {
  if (format && typeof format === 'object') {
    try {
      const nf = new Intl.NumberFormat(locale, format);
      return (v) => nf.format(v);
    } catch {
      // Opciones que Intl no acepta: el formato de siempre.
    }
  }
  const spec = typeof format === 'string' && format !== 'auto' ? format : 'number';
  return valueFormatter(spec, { locale, currency });
}

/** Escribe cualquier valor de una fila: números con el formato de la capa, fechas en el idioma. */
function writer(format: LayerFormat | undefined, locale: string, currency?: string): (v: unknown) => string {
  const num = numberFormat(format, locale, currency);
  return (v) => {
    if (typeof v === 'number') return isFinite(v) ? num(v) : '–';
    if (v instanceof Date) return v.toLocaleDateString(locale);
    if (typeof v === 'boolean') return String(v);
    return String(v ?? '');
  };
}

// ------------------------------------------------------------ Encabezado y tooltip de cada dato

function headline(model: Model, it: Item): string {
  const row = it.ds.rows[it.row];
  const write = writer(undefined, model.locale);
  for (const L of it.layers) {
    const t = L.title?.(row);
    if (t) return fillTemplate(t, row, write);
  }
  const L = mainLayer(it);
  if (model.coords === 'network') return bandKey(L.ch.node?.(row) ?? L.ch.from?.(row));
  if (model.coords === 'geo') {
    // El primer texto de la fila que no sea un número: el nombre de la ciudad o del sitio.
    for (const [k, v] of Object.entries(row)) if (typeof v === 'string' && !(L.placeFields.lon ?? []).includes(k)) return v;
    return '';
  }
  const parts: string[] = [];
  const add = (a: AxisModel | null, ch: 'x' | 'y') => {
    const r = L.ch[ch];
    if (!a || !r) return;
    const v = r(row);
    if (a.type === 'band') parts.push(bandKey(v));
    else if (a.type === 'time') parts.push(String(v ?? ''));
  };
  // En una tabla, primero la fila y después la columna: "COSTA · W35".
  add(model.y, 'y');
  add(model.x, 'x');
  const group = L.ch.group?.(row);
  if (group !== undefined && group !== null) parts.unshift(bandKey(group));
  return parts.filter(Boolean).join(' · ');
}

/** Líneas del tooltip de una capa: las que pidió o, por defecto, los campos que dicen algo del dato. */
function linesOf(model: Model, L: LayerModel): TooltipLine[] {
  if (L.tooltip === false) return [];
  if (L.tooltip !== 'auto') return L.tooltip;
  const fields = [...L.valueFields];
  // Un eje de números o fechas también es un dato (la altura de una barra), no solo un lugar.
  for (const [ch, a] of [
    ['y', model.y],
    ['x', model.x],
  ] as const) {
    if (a && a.type !== 'band') for (const f of L.placeFields[ch] ?? []) if (!fields.includes(f)) fields.push(f);
  }
  return fields.map((f) => ({
    label: f,
    value: (row: Row, w: (v: unknown) => string) => (row[f] === null || row[f] === undefined ? '–' : w(row[f])),
  }));
}

function iconAlt(model: Model, L: LayerModel, row: Row, ref: IconRef | null): string {
  if (!ref) return '';
  const own = L.alt?.(row);
  if (own) return fillTemplate(own, row, writer(L.format, model.locale));
  if (ref.alt) return ref.alt;
  if (ref.kind === 'named') return model.T.icons[ref.name] ?? ref.name;
  if (ref.kind === 'glyph') return ref.text;
  return model.T.icon;
}

function tooltipOf(model: Model, i: number, locale: string | undefined): TooltipValue {
  const it = model.items[i];
  if (!it) return { value: messages(locale).data.noData };
  const row = it.ds.rows[it.row];
  const loc = locale ?? model.locale;
  const main = mainLayer(it);
  if (it.spark && main.mark === 'spark') return sparkTooltip(model, main, it.spark, loc);
  const seen = new Set<string>();
  const details: [string, string][] = [];
  let alt = '';
  for (const L of it.layers) {
    // Lo que dice el dato en palabras: el `alt` de la capa o el nombre de su ícono.
    // Una capa con `tooltip: false` (un emoji de adorno encima de una barra) no habla por el dato.
    const speaks = L.tooltip !== false;
    if (!alt && speaks && L.alt) alt = fillTemplate(L.alt(row) ?? [], row, writer(L.format, model.locale));
    if (!alt && speaks && L.icon) alt = iconAlt(model, L, row, L.icon(row));
    for (const line of linesOf(model, L)) {
      if (seen.has(line.label)) continue;
      seen.add(line.label);
      details.push([line.label, line.value(row, writer(line.format ?? L.format, loc, model.spec.currency))]);
    }
  }
  // Lo que dice el ícono va primero: es la lectura del dato ("carita triste"), y así también lo oye
  // quien usa un lector de pantalla.
  if (alt) return { value: alt, details };
  const [first, ...rest] = details;
  if (!first) return { value: '' };
  return { value: `${first[0]}: ${first[1]}`, details: rest.length ? rest : undefined };
}

/** El minigráfico en palabras: de dónde a dónde fue, cuánto cambió y, si se marcan, sus extremos. */
function sparkTooltip(model: Model, L: LayerModel, group: number[], locale: string): TooltipValue {
  const T = model.T.spark;
  const write = writer(L.format, locale, model.spec.currency);
  const values = group.map((k) => toNumber(L.ch.value?.(L.ds.rows[k]))).filter(isFinite);
  if (!values.length) return { value: messages(locale).data.noData };
  const first = values[0];
  const last = values[values.length - 1];
  let change: string;
  try {
    const opts = L.format && typeof L.format === 'object' ? L.format : { maximumFractionDigits: 2 };
    change = new Intl.NumberFormat(locale, { ...opts, signDisplay: 'exceptZero' }).format(last - first);
  } catch {
    change = write(last - first);
  }
  const details: [string, string][] = [
    [T.first, write(first)],
    [T.last, write(last)],
    [T.change, change],
  ];
  if (L.extremes) details.push([T.lowest, write(Math.min(...values))], [T.highest, write(Math.max(...values))]);
  return { value: `${write(first)} → ${write(last)}`, details };
}

// ------------------------------------------------------------ Escalas de posición

interface PosScale {
  type: AxisModel['type'];
  /** px del centro (band) o del valor. */
  at(v: unknown): number;
  /** Paso de una categoría de ancho 1 (band), o 0. */
  pitch: number;
  /** Paso de la categoría de un valor: más ancho si `widths` se lo da (band). */
  pitchOf(v: unknown): number;
  ticks: { at: number; label: string }[];
  /** Para un eje de números: dónde está el cero (o la base visible). */
  base: number;
}

/**
 * Escala de categorías. Cada una ocupa lo mismo, salvo las que `widths` agranda ({ "Racha": 3 }):
 * una columna de resumen junto a una tabla de días entra sin achicar las demás.
 */
function bandScale(a: AxisModel, from: number, length: number, maxPitch = Infinity): PosScale {
  const widths = a.spec.widths ?? {};
  const weight = (k: string) => {
    const w = widths[k];
    return typeof w === 'number' && w > 0 ? w : 1;
  };
  const total = Math.max(
    1,
    a.keys.reduce((s, k) => s + weight(k), 0),
  );
  let pitch = Math.min(maxPitch, length / total);
  // En una pantalla angosta, una columna ancha no baja de WIDE_MIN px (su ícono y su número
  // tienen que caber); las demás se reparten lo que queda.
  const wide = a.keys.filter((k) => weight(k) > 1);
  const wideW = wide.reduce((s, k) => s + weight(k), 0);
  if (wide.length && pitch * Math.min(...wide.map(weight)) < WIDE_MIN) {
    const rest = total - wideW;
    const fixed = wide.length * WIDE_MIN;
    if (rest > 0 && length > fixed) pitch = Math.min(maxPitch, (length - fixed) / rest);
  }
  const widthOf = (k: string) => (weight(k) > 1 ? Math.max(weight(k) * pitch, WIDE_MIN) : pitch);
  const start = new Map<string, number>();
  let acc = 0;
  for (const k of a.keys) {
    start.set(k, acc);
    acc += widthOf(k);
  }
  const center = (k: string) => from + start.get(k)! + widthOf(k) / 2;
  return {
    type: 'band',
    pitch,
    pitchOf: (v) => widthOf(bandKey(v)),
    at: (v) => {
      const k = bandKey(v);
      return start.has(k) ? center(k) : NaN;
    },
    ticks: a.keys.map((k) => ({ at: center(k), label: k })),
    base: from,
  };
}

function continuousScale(a: AxisModel, from: number, to: number, count: number, locale: string): PosScale {
  let d0 = a.min;
  let d1 = a.max;
  if (!isFinite(d0) || !isFinite(d1)) [d0, d1] = [0, 1];
  let ticks: { at: number; label: string }[] = [];
  const map = (v: number) => from + ((v - d0) / (d1 - d0 || 1)) * (to - from);
  if (a.type === 'linear') {
    const [n0, n1, step] = niceDomain(d0, d1, count);
    [d0, d1] = [n0, n1];
    const maxAbs = Math.max(Math.abs(d0), Math.abs(d1));
    const fmt = a.spec.format ? numberFormat(a.spec.format, locale) : compactAxis(locale, maxAbs, step);
    ticks = numberTicks(d0, d1, step).map((v) => ({ at: map(v), label: fmt(v) }));
  } else {
    if (d1 === d0) [d0, d1] = [d0 - 864e5, d1 + 864e5];
    const iv = chooseTimeInterval(d0, d1, count);
    ticks = timeTicks(d0, d1, iv).map((t) => ({ at: map(t), label: timeTickLabel(t, iv.unit, locale) }));
  }
  const base = d0 <= 0 && d1 >= 0 ? map(0) : map(d0);
  return {
    type: a.type,
    pitch: 0,
    pitchOf: () => 0,
    at: (v) => {
      const n = axisValue(a, v) as number;
      return isFinite(n) ? map(n) : NaN;
    },
    ticks,
    base,
  };
}

/** Números del eje: compactos desde mil, con los decimales que pide el paso. */
function compactAxis(locale: string, maxAbs: number, step: number): (v: number) => string {
  const compact = maxAbs >= 10000;
  const digits = compact ? 1 : Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  try {
    const nf = new Intl.NumberFormat(
      locale,
      compact ? { notation: 'compact', maximumFractionDigits: 1 } : { maximumFractionDigits: digits },
    );
    return (v) => nf.format(v);
  } catch {
    return (v) => String(v);
  }
}

// ------------------------------------------------------------ Geometría

type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'circle'; cx: number; cy: number; r: number };

interface Mark {
  /** Fila de los datos de la capa. */
  row: number;
  /** Dato al que pertenece (−1: ninguno). */
  item: number;
  /** Centro de la marca y su tamaño (lado de un ícono, diámetro de un punto, cuerpo de un texto). */
  cx: number;
  cy: number;
  size: number;
  shape: Shape | null;
  /** Para barras: la base y la punta en el eje del valor, y si crece en horizontal. */
  bar?: { along: number; thick: number; base: number; end: number; horizontal: boolean };
  /** Para un minigráfico: sus puntos, cuál es el mínimo y el máximo, y la base del área. */
  spark?: { pts: Pt[]; min: number; max: number; floor: number };
  /** Para reglas y enlaces: los dos extremos. */
  seg?: [number, number, number, number];
  /** Texto: anclaje. */
  anchor?: 'start' | 'middle' | 'end';
  /** Clave de la celda que tiene debajo (para el color de la tinta), si cae en una, y su ancho. */
  cell?: string;
  cellW?: number;
  /** Fracción de 0 a 1 de su lugar de izquierda a derecha: el retraso de su entrada. */
  delay: number;
}

interface LineGeo {
  group: string;
  points: Pt[];
  rows: number[];
}

interface Geometry {
  key: string;
  width: number;
  height: number;
  plot: { x0: number; y0: number; x1: number; y1: number };
  X: PosScale | null;
  Y: PosScale | null;
  xAxisAt: 'top' | 'bottom' | null;
  /** Línea central del título del eje Y. */
  yTitleAt: number;
  yAxisAt: 'left' | 'right' | null;
  rowLabels: string[];
  marks: Mark[][];
  lines: LineGeo[][];
  /** Contornos del mapa de fondo. */
  land: string[];
  legend: ColorScaleModel | null;
  /** Centro de cada dato y su forma de hover, en el orden de los datos. */
  centers: ([number, number] | null)[];
  shapes: (Shape | null)[];
  /** Formas que se apuntan, de arriba hacia abajo (la última capa primero). */
  hits: { item: number; shape: Shape }[];
}

const geometries = new WeakMap<Model, Geometry>();
/** La última geometría dibujada de cada serie, para el recorrido con flechas. */
const lastGeometry = new WeakMap<PreparedSeries, Geometry>();

function geometry(ctx: DrawContext, model: Model): Geometry {
  const key = `${ctx.width}|${ctx.height}`;
  const cached = geometries.get(model);
  if (cached && cached.key === key) return cached;
  const g = build(ctx, model, key);
  geometries.set(model, g);
  return g;
}

function legendScale(model: Model): ColorScaleModel | null {
  return model.scales.find((s) => s.spec.legend !== false && s.domains.size > 0) ?? null;
}

function build(ctx: DrawContext, model: Model, key: string): Geometry {
  const width = ctx.width;
  const height = ctx.height;
  const measure = ctx.measure;
  const scale = legendScale(model);
  const top0 = scale ? LEGEND_H : 0;
  const g: Geometry = {
    key,
    width,
    height,
    plot: { x0: 0, y0: top0, x1: width, y1: height },
    X: null,
    Y: null,
    xAxisAt: null,
    yAxisAt: null,
    yTitleAt: 0,
    rowLabels: [],
    marks: model.layers.map(() => []),
    lines: model.layers.map(() => []),
    land: [],
    legend: scale,
    centers: model.items.map(() => null),
    shapes: model.items.map(() => null),
    hits: [],
  };
  let place: (L: LayerModel, row: Row) => [number, number];
  if (model.coords === 'cartesian') place = cartesian(g, model, measure);
  else if (model.coords === 'geo') place = geo(g, model);
  else place = network(g, model);

  const { x0, x1 } = g.plot;
  const W = Math.max(1, x1 - x0);
  const bothBand = g.X?.type === 'band' && g.Y?.type === 'band';
  const cellW = g.X?.type === 'band' ? g.X.pitch : 0;
  const cellH = g.Y?.type === 'band' ? g.Y.pitch : 0;
  const gap = Math.min(cellW || 99, cellH || 99) < 8 ? 1 : GAP;
  /** Ancho de la columna de una fila (las de `widths` son más anchas). */
  const colW = (L: LayerModel, row: Row) => (g.X?.type === 'band' ? g.X.pitchOf(L.ch.x?.(row)) : 0);
  // En un mapa o una red grandes, íconos, puntos y nombres crecen con el área (hasta un 60 %): a
  // 2560 px no quedan como hormigas. En ejes, el tamaño es el pedido.
  const zoom = model.coords === 'cartesian' ? 1 : Math.max(1, Math.min(1.6, Math.min(width, height) / 620));
  // El tamaño del ícono o del punto más grande de cada fila: los textos de esa fila se apartan de él.
  const markers = new Map<string, number>();
  for (const L of model.layers) {
    // Solo las marcas que van justo en el punto: un emoji puesto encima de una barra no cuenta.
    if ((L.mark !== 'icon' && L.mark !== 'point') || L.position !== 'center' || L.dx || L.dy) continue;
    const sizeOf = sizer(L);
    const fallback = L.mark === 'icon' ? ICON_SIZE : POINT_SIZE;
    for (const k of L.rows) {
      const key = `${L.ds.name}\u0000${k}`;
      markers.set(key, Math.max(markers.get(key) ?? 0, (sizeOf(L.ds.rows[k]) ?? fallback) * zoom));
    }
  }

  model.layers.forEach((L, li) => {
    const marks = g.marks[li];
    const sizeOf = sizer(L);
    if (L.mark === 'line') {
      const groups = new Map<string, LineGeo>();
      for (const k of L.rows) {
        const row = L.ds.rows[k];
        const name = bandKey(L.ch.group?.(row) ?? '');
        let line = groups.get(name);
        if (!line) groups.set(name, (line = { group: name, points: [], rows: [] }));
        const [px, py] = place(L, row);
        line.points.push([px, py]);
        line.rows.push(k);
        marks.push(mark(model, L, k, px, py, sizeOf(row) ?? 8, { kind: 'circle', cx: px, cy: py, r: 6 }, x0, W));
      }
      // Una línea sobre números o fechas va en el orden del eje, no en el de las filas.
      for (const line of groups.values()) {
        if (g.X && g.X.type !== 'band') {
          const order = line.points.map((_, j) => j).sort((a, b) => line.points[a][0] - line.points[b][0]);
          line.points = order.map((j) => line.points[j]);
          line.rows = order.map((j) => line.rows[j]);
        }
      }
      g.lines[li] = [...groups.values()];
      return;
    }
    if (L.mark === 'spark') {
      for (const group of L.sparks ?? []) {
        const m = sparkMark(model, L, group, place, colW(L, L.ds.rows[group[0]]), cellH, gap, x0, W);
        if (m) marks.push(m);
      }
      return;
    }
    for (const k of L.rows) {
      const row = L.ds.rows[k];
      if (L.mark === 'cell') {
        const [cx, cy] = place(L, row);
        if (!isFinite(cx) || !isFinite(cy)) continue;
        const w = (colW(L, row) || 14) - gap;
        const h = (cellH || 14) - gap;
        const m = mark(model, L, k, cx, cy, Math.min(w, h), { kind: 'rect', x: cx - w / 2, y: cy - h / 2, w, h }, x0, W);
        m.cell = cellKey(L, row);
        marks.push(m);
        continue;
      }
      if (L.mark === 'bar') {
        const m = barMark(g, model, L, k, row, sizeOf(row), x0, W);
        if (m) marks.push(m);
        continue;
      }
      if (L.mark === 'rule' || L.mark === 'link') {
        const m = segmentMark(g, model, L, k, row, x0, W);
        if (m) marks.push(m);
        continue;
      }
      // Texto, ícono y punto: en su lugar, movidos según `position` dentro de la celda o junto al punto.
      let [cx, cy] = place(L, row);
      if (!isFinite(cx) || !isFinite(cy)) continue;
      const fallback =
        L.mark === 'icon' ? (bothBand ? Math.min(ICON_SIZE, cellH * 0.62) : ICON_SIZE) : L.mark === 'point' ? POINT_SIZE : FONT;
      const inCell = bothBand && model.coords === 'cartesian';
      const cw = inCell ? colW(L, row) : 0;
      let size = (sizeOf(row) ?? fallback) * zoom;
      // En una celda angosta (una tabla en un teléfono) el ícono se achica hasta caber; si ni así
      // se distingue, no va: el color y el tooltip siguen diciendo lo mismo.
      if (inCell && L.mark === 'icon') {
        size = Math.min(size, (cw - gap) * 0.8, (cellH - gap) * 0.8);
        if (size < 9) continue;
      }
      const marker = L.mark === 'text' && !inCell ? markers.get(`${L.ds.name}\u0000${k}`) : undefined;
      const [ox, oy, anchor] = offset(
        L.position,
        inCell ? cw - gap : 0,
        inCell ? cellH - gap : 0,
        size,
        L.mark === 'text',
        marker ?? size,
      );
      cx += ox + L.dx;
      cy += oy + L.dy;
      const shape: Shape | null = L.mark === 'text' ? null : { kind: 'circle', cx, cy, r: size / 2 };
      const m = mark(model, L, k, cx, cy, size, shape, x0, W);
      m.anchor = anchor;
      if (inCell) {
        m.cell = cellKey(L, row);
        m.cellW = cw;
      }
      marks.push(m);
    }
  });

  // Centro y forma de cada dato: la de su capa principal (la primera con tooltip que lo dibuja).
  model.layers.forEach((L, li) => {
    for (const m of g.marks[li]) {
      if (m.item < 0 || !m.shape) continue;
      if (mainLayer(model.items[m.item]) === L && !g.shapes[m.item]) {
        g.shapes[m.item] = m.shape;
        g.centers[m.item] = [m.cx, m.cy];
      }
      if (L.tooltip !== false) g.hits.push({ item: m.item, shape: m.shape });
    }
  });
  for (let i = 0; i < g.centers.length; i++) {
    if (g.centers[i]) continue;
    // Un dato sin forma propia (una línea, un texto con tooltip): su primera marca.
    for (const marks of g.marks) {
      const m = marks.find((x) => x.item === i);
      if (m) {
        g.centers[i] = [m.cx, m.cy];
        g.shapes[i] = m.shape ?? { kind: 'circle', cx: m.cx, cy: m.cy, r: 6 };
        break;
      }
    }
  }
  g.hits.reverse();
  avoidLabels(g, model, measure);
  return g;
}

/**
 * Textos sueltos (nombres de ciudades, de nodos) que no se pisan: en orden, cada uno se queda si
 * no choca con uno anterior ni con un ícono o un punto; si choca, prueba del otro lado del punto
 * y, si tampoco cabe, no se dibuja (su dato sigue en el tooltip y en la tabla).
 */
function avoidLabels(g: Geometry, model: Model, measure: (s: string) => number): void {
  const boxes: [number, number, number, number][] = [];
  const hit = (b: [number, number, number, number]) =>
    boxes.some((o) => b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]);
  model.layers.forEach((L, li) => {
    if (L.mark === 'icon' || L.mark === 'point')
      for (const m of g.marks[li])
        if (!m.cell) boxes.push([m.cx - m.size / 2, m.cy - m.size / 2, m.cx + m.size / 2, m.cy + m.size / 2]);
  });
  const width = (m: Mark, L: LayerModel) => {
    const pieces = L.text?.(L.ds.rows[m.row]);
    const str = pieces ? fillTemplate(pieces, L.ds.rows[m.row], writer(L.format, model.locale)) : '';
    return measure(str) * (m.size / FONT);
  };
  model.layers.forEach((L, li) => {
    if (L.mark !== 'text') return;
    g.marks[li] = g.marks[li].filter((m) => {
      // Dentro de una celda, el texto va solo si cabe entero (como los valores de un mapa de calor).
      if (m.cell) return width(m, L) <= (m.cellW ?? Infinity) - 6;
      const w = width(m, L);
      const h = m.size + 2;
      const box = (x: number, anchor: Mark['anchor']): [number, number, number, number] => {
        const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        return [x0, m.cy - h / 2, x0 + w, m.cy + h / 2];
      };
      let b = box(m.cx, m.anchor);
      if (hit(b) && m.anchor !== 'middle') {
        // Del otro lado del punto: el mismo aire, en espejo.
        const anchor = m.anchor === 'start' ? 'end' : 'start';
        const origin = m.cx - (m.anchor === 'start' ? 1 : -1) * (m.size / 2 + 6 + L.dx);
        const x = 2 * origin - m.cx;
        const flipped = box(x, anchor);
        if (!hit(flipped)) {
          m.cx = x;
          m.anchor = anchor;
          b = flipped;
        }
      }
      if (hit(b)) return false;
      boxes.push(b);
      return true;
    });
  });
}

/**
 * Aire arriba de un eje de números: la mitad de la etiqueta de arriba y lo que sube una marca
 * puesta encima de su dato (position "top" y un dy negativo), para que no la corte el borde.
 */
function headroom(model: Model): number {
  let room = FONT / 2 + 2;
  for (const L of model.layers) {
    if (L.mark !== 'icon' && L.mark !== 'text') continue;
    const up = Math.max(0, -L.dy);
    const size = L.mark === 'text' ? FONT : ICON_SIZE;
    const fixed = L.ch.size && !L.sizeField ? toNumber(L.ch.size({})) : NaN;
    const s = isFinite(fixed) ? fixed : size;
    const rise = (L.position.includes('top') ? s + 6 : s / 2) + up;
    room = Math.max(room, rise + 2);
  }
  return room;
}

/**
 * Un minigráfico en su celda: los puntos repartidos a lo ancho en el orden del periodo y, en alto,
 * del mínimo al máximo de su propia serie (cada fila se compara consigo misma, como al leerla).
 */
function sparkMark(
  model: Model,
  L: LayerModel,
  group: number[],
  place: (L: LayerModel, row: Row) => [number, number],
  cellW: number,
  cellH: number,
  gap: number,
  x0: number,
  W: number,
): Mark | null {
  const [cx, cy] = place(L, L.ds.rows[group[0]]);
  if (!isFinite(cx) || !isFinite(cy)) return null;
  const boxW = (cellW || 80) - gap;
  const boxH = (cellH || 30) - gap;
  // Aire para el punto final y los extremos: no tocan el borde de la celda.
  const w = Math.max(8, boxW - 16);
  const h = Math.max(6, boxH - 14);
  const values = group.map((k) => toNumber(L.ch.value?.(L.ds.rows[k])));
  const ok = values.filter(isFinite);
  if (!ok.length) return null;
  const lo = Math.min(...ok);
  const hi = Math.max(...ok);
  const n = values.length;
  const pts: Pt[] = values.map((v, i) => [
    cx - w / 2 + (n > 1 ? (i / (n - 1)) * w : w / 2),
    isFinite(v) ? cy + h / 2 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * h : NaN,
  ]);
  const m = mark(
    model,
    L,
    group[0],
    cx,
    cy,
    Math.min(boxW, boxH),
    { kind: 'rect', x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH },
    x0,
    W,
  );
  m.spark = { pts, min: values.indexOf(lo), max: values.indexOf(hi), floor: cy + h / 2 };
  m.cell = cellKey(L, L.ds.rows[group[0]]);
  return m;
}

function cellKey(L: LayerModel, row: Row): string {
  return `${bandKey(L.ch.x?.(row))}\u0000${bandKey(L.ch.y?.(row))}`;
}

function mark(
  model: Model,
  L: LayerModel,
  row: number,
  cx: number,
  cy: number,
  size: number,
  shape: Shape | null,
  x0: number,
  W: number,
): Mark {
  const item = model.itemOf.get(`${L.ds.name}\u0000${row}`) ?? -1;
  return { row, item, cx, cy, size, shape, delay: Math.max(0, Math.min(1, (cx - x0) / W)) };
}

/** El tamaño de cada fila: un número fijo, o un campo escalado por área entre SIZE_RANGE. */
function sizer(L: LayerModel): (row: Row) => number | undefined {
  const r = L.ch.size;
  if (!r) return () => undefined;
  if (!L.sizeField) {
    return (row) => {
      const v = toNumber(r(row));
      return isFinite(v) && v > 0 ? v : undefined;
    };
  }
  let max = 0;
  for (const k of L.rows) {
    const v = toNumber(r(L.ds.rows[k]));
    if (isFinite(v) && Math.abs(v) > max) max = Math.abs(v);
  }
  const [lo, hi] = L.mark === 'bar' || L.mark === 'rule' || L.mark === 'link' ? [0.75, 4] : SIZE_RANGE;
  return (row) => {
    const v = Math.abs(toNumber(r(row)));
    if (!isFinite(v) || !(max > 0)) return undefined;
    return lo + (hi - lo) * Math.sqrt(v / max);
  };
}

/**
 * Desplazamiento de una marca según `position`: dentro de una celda de w × h (pegada al borde
 * con 6 px de aire) o, sin celda, al lado del punto (a medio tamaño más 6 px).
 */
function offset(
  position: string,
  w: number,
  h: number,
  size: number,
  text: boolean,
  marker = size,
): [number, number, 'start' | 'middle' | 'end'] {
  const inset = 6;
  // Fuera de una celda, un texto se aparta del ícono o del punto que hay en su lugar (`marker`).
  const reachX = w > 0 ? w / 2 - inset - (text ? 0 : size / 2) : (text ? marker : size) / 2 + inset;
  const reachY = h > 0 ? h / 2 - inset - (text ? FONT / 2 : size / 2) : (text ? marker / 2 + size / 2 : size / 2) + inset;
  let dx = 0;
  let dy = 0;
  let anchor: 'start' | 'middle' | 'end' = 'middle';
  if (position.includes('left')) {
    dx = -Math.max(0, reachX);
    if (text) anchor = w > 0 ? 'start' : 'end';
  }
  if (position.includes('right')) {
    dx = Math.max(0, reachX);
    if (text) anchor = w > 0 ? 'end' : 'start';
  }
  if (position.includes('top')) dy = -Math.max(0, reachY);
  if (position.includes('bottom')) dy = Math.max(0, reachY);
  if (text && w > 0 && anchor !== 'middle') dx = anchor === 'start' ? -w / 2 + inset : w / 2 - inset;
  return [dx, dy, anchor];
}

function barMark(
  g: Geometry,
  model: Model,
  L: LayerModel,
  k: number,
  row: Row,
  size: number | undefined,
  x0: number,
  W: number,
): Mark | null {
  const { X, Y } = g;
  if (!X || !Y) return null;
  const horizontal = Y.type === 'band' && X.type !== 'band';
  const cat = horizontal ? Y : X;
  const val = horizontal ? X : Y;
  const along = cat.at(horizontal ? L.ch.y?.(row) : L.ch.x?.(row));
  const end = val.at(horizontal ? L.ch.x?.(row) : L.ch.y?.(row));
  const base2 = horizontal ? L.ch.x2 : L.ch.y2;
  const base = base2 ? val.at(base2(row)) : val.base;
  if (!isFinite(along) || !isFinite(end) || !isFinite(base)) return null;
  const thick = size ?? Math.max(2, Math.min(BAR_MAX, (cat.pitch || 20) * 0.62));
  const shape: Shape = horizontal
    ? { kind: 'rect', x: Math.min(base, end), y: along - thick / 2, w: Math.abs(end - base), h: thick }
    : { kind: 'rect', x: along - thick / 2, y: Math.min(base, end), w: thick, h: Math.abs(end - base) };
  const [cx, cy] = horizontal ? [end, along] : [along, end];
  const m = mark(model, L, k, cx, cy, thick, shape, x0, W);
  m.bar = { along, thick, base, end, horizontal };
  return m;
}

function segmentMark(g: Geometry, model: Model, L: LayerModel, k: number, row: Row, x0: number, W: number): Mark | null {
  let seg: [number, number, number, number];
  if (L.mark === 'link') {
    const a = nodeAt(g, model, L.ch.from?.(row));
    const b = nodeAt(g, model, L.ch.to?.(row));
    if (!a || !b) return null;
    seg = [a[0], a[1], b[0], b[1]];
  } else {
    const { x0: px0, y0: py0, x1: px1, y1: py1 } = g.plot;
    const xs = L.ch.x ? g.X?.at(L.ch.x(row)) : undefined;
    const ys = L.ch.y ? g.Y?.at(L.ch.y(row)) : undefined;
    const x2 = L.ch.x2 ? g.X?.at(L.ch.x2(row)) : undefined;
    const y2 = L.ch.y2 ? g.Y?.at(L.ch.y2(row)) : undefined;
    if (xs !== undefined && ys !== undefined && (x2 !== undefined || y2 !== undefined)) seg = [xs, ys, x2 ?? xs, y2 ?? ys];
    else if (ys !== undefined) seg = [px0, ys, px1, ys];
    else if (xs !== undefined) seg = [xs, py0, xs, py1];
    else return null;
  }
  if (!seg.every(isFinite)) return null;
  const m = mark(model, L, k, (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2, 0, null, x0, W);
  m.seg = seg;
  m.delay = Math.max(0, Math.min(1, (Math.min(seg[0], seg[2]) - x0) / W));
  return m;
}

/** Posiciones de los nodos de la red, por su identificador. */
const nodePositions = new WeakMap<Geometry, { x: Float64Array; y: Float64Array }>();

function nodeAt(g: Geometry, model: Model, id: unknown): [number, number] | null {
  const pos = nodePositions.get(g);
  const k = model.network?.index.get(bandKey(id));
  if (!pos || k === undefined) return null;
  return [pos.x[k], pos.y[k]];
}

function cartesian(g: Geometry, model: Model, measure: (s: string) => number): (L: LayerModel, row: Row) => [number, number] {
  const { width, height } = g;
  const xa = model.x;
  const ya = model.y;
  const top0 = g.plot.y0;
  const xAt = xa && xa.spec.axis !== false ? (xa.spec.axis === 'top' ? 'top' : 'bottom') : null;
  const yAt = ya && ya.spec.axis !== false ? (ya.spec.axis === 'right' ? 'right' : 'left') : null;
  g.xAxisAt = xAt;
  g.yAxisAt = yAt;
  const xTitle = xa?.spec.title ? TITLE_H : 0;
  const yTitle = ya?.spec.title ? TITLE_H : 0;
  // Arriba: el eje X (si va arriba), el título del eje Y y, sobre números, aire para lo que se
  // dibuja encima del dato (el emoji sobre una barra, la estrella sobre un punto).
  const titleTop = top0 + (xAt === 'top' ? AXIS_H + xTitle : 0);
  g.yTitleAt = titleTop + TITLE_H / 2;
  const top = titleTop + yTitle + (ya && ya.type !== 'band' ? headroom(model) : 0);
  const bottom = height - (xAt === 'bottom' ? AXIS_H + xTitle : 4);
  // Etiquetas del eje Y: las categorías (recortadas al 32 % del ancho) o los números.
  let labelW = 0;
  let Y: PosScale | null = null;
  const plotH = Math.max(20, bottom - top);
  const cells = model.layers.some((L) => L.mark === 'cell');
  if (ya) {
    if (ya.type === 'band') {
      const max = width * 0.32;
      g.rowLabels = ya.keys.map((k) => fitText(k, max, measure));
      // Las categorías van en 500: un poco más anchas que lo que mide la letra normal.
      labelW = yAt ? Math.min(max, Math.max(0, ...g.rowLabels.map(measure)) * 1.06 + 2) : 0;
      Y = bandScale(ya, top, plotH, cells ? MAX_ROW_PITCH : MAX_ROW_PITCH * 1.5);
    } else {
      // y crece hacia arriba: se arma del borde de abajo al de arriba.
      Y = continuousScale(ya, bottom, top, Math.max(2, Math.round(plotH / 56)), model.locale);
      labelW = yAt ? Math.max(0, ...Y.ticks.map((t) => measure(t.label))) : 0;
    }
  }
  const left = yAt === 'left' && labelW ? labelW + PAD : 0;
  const right = width - (yAt === 'right' && labelW ? labelW + PAD : xa && xa.type !== 'band' ? 12 : 0);
  let X: PosScale | null = null;
  if (xa) {
    X =
      xa.type === 'band'
        ? bandScale(xa, left, Math.max(20, right - left))
        : continuousScale(xa, left, right, Math.max(2, Math.round((right - left) / 96)), model.locale);
  }
  g.X = X;
  g.Y = Y;
  g.plot = { x0: left, y0: top, x1: right, y1: Y?.type === 'band' ? top + Y.pitch * Math.max(1, ya!.keys.length) : bottom };
  return (L, row) => [X && L.ch.x ? X.at(L.ch.x(row)) : NaN, Y && L.ch.y ? Y.at(L.ch.y(row)) : NaN];
}

function geo(g: Geometry, model: Model): (L: LayerModel, row: Row) => [number, number] {
  const spec = model.spec.geo ?? {};
  const all = getMap(spec.map || 'mundo') ?? [];
  const land = all.filter((f) => !Object.values(f.properties).some((v) => v === 'ATA' || v === 'Antarctica'));
  // Los puntos de todas las capas: con fit 'data' (por defecto) el mapa se encuadra en ellos.
  let lo0 = Infinity;
  let lo1 = -Infinity;
  let la0 = Infinity;
  let la1 = -Infinity;
  for (const L of model.layers) {
    for (const k of L.rows) {
      const row = L.ds.rows[k];
      const lon = toNumber(L.ch.lon?.(row));
      const lat = toNumber(L.ch.lat?.(row));
      if (!isFinite(lon) || !isFinite(lat)) continue;
      lo0 = Math.min(lo0, lon);
      lo1 = Math.max(lo1, lon);
      la0 = Math.min(la0, lat);
      la1 = Math.max(la1, lat);
    }
  }
  const { y0 } = g.plot;
  const w = g.width;
  const h = Math.max(40, g.height - y0);
  let framed: GeoFeature[] = land;
  if (spec.fit !== 'all' && lo1 >= lo0) {
    // Una caja alrededor de los puntos, con aire: un 18 % de cada lado y al menos 3 grados.
    const px = Math.max(3, (lo1 - lo0) * 0.18);
    const py = Math.max(3, (la1 - la0) * 0.18);
    const a = Math.max(-180, lo0 - px);
    const b = Math.min(180, lo1 + px);
    const c = Math.max(-85, la0 - py);
    const d = Math.min(85, la1 + py);
    const ring: [number, number][] = [];
    for (let t = 0; t <= 8; t++) ring.push([a + ((b - a) * t) / 8, c], [a + ((b - a) * t) / 8, d]);
    framed = [{ id: '', properties: {}, polygons: [[ring]] }];
  }
  const raw = rawProjection(spec.projection === 'mercator' ? 'mercator' : 'equalEarth');
  const fitted = fitProjection(raw, framed.length ? framed : land, w, h, 24);
  const project = (lon: number, lat: number): [number, number] => {
    const [x, y] = fitted(lon, lat);
    return [x, y + y0];
  };
  g.land = land.map((f) => geoPath(projectFeature(f, project)));
  g.plot = { x0: 0, y0, x1: w, y1: g.height };
  return (L, row) => {
    const lon = toNumber(L.ch.lon?.(row));
    const lat = toNumber(L.ch.lat?.(row));
    return isFinite(lon) && isFinite(lat) ? project(lon, lat) : [NaN, NaN];
  };
}

function network(g: Geometry, model: Model): (L: LayerModel, row: Row) => [number, number] {
  const net = model.network;
  const { y0 } = g.plot;
  const w = g.width;
  const h = Math.max(40, g.height - y0);
  const n = net?.ids.length ?? 0;
  const pos = forceLayout(n, net?.links ?? [], w, h);
  // Aire para el ícono más grande y una etiqueta debajo.
  fitPositions(pos.x, pos.y, w, h, 34);
  for (let k = 0; k < n; k++) pos.y[k] += y0;
  nodePositions.set(g, pos);
  g.plot = { x0: 0, y0, x1: w, y1: g.height };
  return (L, row) => nodeAt(g, model, L.ch.node?.(row)) ?? [NaN, NaN];
}

// ------------------------------------------------------------ Color

/**
 * Un color con nombre, del tema del gráfico: el estado (good, warn, bad), los grises y la paleta
 * (la de LozCharts o la de la opción `palette`) por nombre o por lugar. Un #hex queda tal cual.
 */
function named(token: string, th: Theme): string {
  switch (token) {
    case 'bad':
      return th.bad;
    case 'warn':
      return th.warn;
    case 'good':
      return th.good;
    case 'text':
      return th.text;
    case 'muted':
      return th.textMuted;
    case 'grid':
      return th.grid;
  }
  const slot = PALETTE_NAMES.indexOf(token);
  if (slot >= 0) return th.palette[slot] ?? th.other;
  if (/^[1-8]$/.test(token)) return th.palette[Number(token) - 1] ?? th.other;
  return token;
}

/** Semáforo en OKLab con los colores de estado del tema: de mal a cuidado y de cuidado a bien. */
function trafficLight(p: number, th: Theme): RGB {
  const [bad, warn, good] = [th.bad, th.warn, th.good].map((c) => parseColor(c) ?? [0.5, 0.5, 0.5]) as RGB[];
  const q = Math.max(0, Math.min(1, p));
  return q < 0.5 ? mixOklab(bad, warn, q * 2) : mixOklab(warn, good, (q - 0.5) * 2);
}

/** Color de un valor en su escala. `base`: el color de la serie, del que salen las escalas de un tono. */
function scaleColor(s: ColorScaleModel, v: number, group: string, th: Theme, base: string): string {
  const p = scalePosition(s, v, group);
  if (s.kind === 'traffic-light') return toHex(trafficLight(p, th));
  return paint(makeRamp(s.kind, th, base), p).fill;
}

function resolveColor(ref: ColorRef | null, th: Theme, base: string): string | null {
  if (ref === null) return null;
  if (typeof ref === 'string') return named(ref, th);
  return scaleColor(ref.scale, ref.v, ref.group, th, base);
}

// ------------------------------------------------------------ Dibujo

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Progreso de una marca con retraso `delay` (0 a 1) cuando el gráfico va en `t`. */
const progress = (t: number, delay: number) => (t >= 0.999 ? 1 : clamp01((t - STAGGER * delay) / (1 - STAGGER)));
/** Un pequeño rebote al aparecer (íconos y puntos), sin pasarse más de un 10 %. */
const pop = (p: number) => (p >= 1 ? 1 : 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2));

function draw(ctx: DrawContext, model: Model): string {
  const g = geometry(ctx, model);
  lastGeometry.set(ctx.frame.ps, g);
  const th = ctx.theme;
  // El color de la serie: el primero de la paleta del gráfico (la de LozCharts o la de `palette`).
  const base = ctx.color;
  const t = ctx.purpose === 'export' ? 1 : ctx.frame.alpha;
  const dimmed = (item: number) => item >= 0 && !!ctx.isDimmed?.(item);
  let out = '';
  if (g.land.length) {
    out += `<g${attrs({ fill: th.grid, stroke: th.surface, 'stroke-width': 0.6, 'stroke-linejoin': 'round' })}>${g.land.map((d) => `<path d="${d}"/>`).join('')}</g>`;
  }
  out += gridMarkup(g, th);
  /** Color de cada celda dibujada, por su clave: la tinta de lo que va encima se elige contra él. */
  const cells = new Map<string, RGB | null>();

  model.layers.forEach((L, li) => {
    const marks = g.marks[li];
    const write = writer(L.format, model.locale, model.spec.currency);
    let s = '';
    if (L.mark === 'line') {
      s += lineMarkup(ctx, L, g.lines[li], t, base);
      out += s;
      return;
    }
    for (const m of marks) {
      const row = L.ds.rows[m.row];
      const p = progress(t, m.delay);
      if (p <= 0) continue;
      const colorRef = L.color?.(row) ?? null;
      const own = resolveColor(colorRef, th, base);
      const opacity = dimmed(m.item) ? 0.25 : L.opacity;
      const under = m.cell !== undefined ? cells.get(m.cell) : undefined;
      // Sobre una celda, la tinta de más contraste con ella; fuera de una celda, con un halo.
      const ink = under ? textOn(under, [th.text, th.surface, '#000000', '#ffffff']) : th.text;
      switch (L.mark) {
        case 'cell': {
          const fill = own ?? base;
          cells.set(m.cell!, parseColor(fill));
          const sh = m.shape as Extract<Shape, { kind: 'rect' }>;
          const k = 0.55 + 0.45 * p;
          const w = sh.w * k;
          const h = sh.h * k;
          s += `<rect${attrs({ x: r2(m.cx - w / 2), y: r2(m.cy - h / 2), width: r2(w), height: r2(h), rx: Math.min(RADIUS, w / 4, h / 4), fill, opacity: mul(opacity, p) })}/>`;
          break;
        }
        case 'bar': {
          const b = m.bar!;
          const end = b.base + (b.end - b.base) * p;
          // La barra vertical se dibuja en su plano; la horizontal, en el plano reflejado.
          const d = barPath(b.along - b.thick / 2, b.thick, b.base, end, 4);
          if (!d) break;
          s += `<path${attrs({ d, fill: own ?? base, opacity, transform: b.horizontal ? 'matrix(0 1 1 0 0 0)' : undefined })}/>`;
          break;
        }
        case 'point': {
          const r = (m.size / 2) * pop(p);
          s += `<circle${attrs({ cx: r2(m.cx), cy: r2(m.cy), r: r2(Math.max(0, r)), fill: own ?? base, stroke: th.surface, 'stroke-width': 1.5, opacity })}/>`;
          break;
        }
        case 'icon': {
          const ref = L.icon?.(row) ?? null;
          if (!ref) break;
          // Sin color propio: sobre una celda, la tinta de más contraste; fuera, el de la serie.
          const color = own ?? (under ? ink : base);
          s += iconMarkup(ref, m.cx, m.cy, m.size * pop(p), color, th, !under, mul(opacity, Math.min(1, p * 2)));
          break;
        }
        case 'text': {
          const pieces = L.text?.(row);
          if (!pieces) break;
          const str = fillTemplate(pieces, row, write);
          if (!str) break;
          const fill = own ?? (under ? ink : th.text);
          const halo = under
            ? {}
            : { stroke: th.surface, 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' };
          s += `<text${attrs({
            x: r2(m.cx),
            y: r2(m.cy),
            fill,
            'font-size': m.size,
            'font-weight': L.weight,
            'text-anchor': m.anchor ?? 'middle',
            'dominant-baseline': 'central',
            opacity: mul(opacity, p),
            ...halo,
          })}>${esc(str)}</text>`;
          break;
        }
        case 'spark':
          s += sparkMarkup(m, own ?? base, th, L, p, opacity);
          break;
        case 'rule':
        case 'link': {
          const [ax, ay, bx, by] = m.seg!;
          const dash = L.dash?.(row) ?? L.mark === 'rule';
          const stroke = own ?? (L.mark === 'rule' ? th.textMuted : th.textMuted);
          const width = L.ch.size ? (sizer(L)(row) ?? 1.5) : L.mark === 'link' ? 1.5 : 1;
          const alpha = L.mark === 'link' && !own ? (th.name === 'dark' ? 0.5 : 0.42) : 1;
          s += `<line${attrs({
            x1: r2(ax),
            y1: r2(ay),
            x2: r2(ax + (bx - ax) * (L.mark === 'link' ? p : 1)),
            y2: r2(ay + (by - ay) * (L.mark === 'link' ? p : 1)),
            stroke,
            'stroke-width': r2(width),
            'stroke-linecap': 'round',
            'stroke-dasharray': dash ? '4 3' : undefined,
            'stroke-opacity': alpha < 1 ? alpha : undefined,
            opacity: mul(opacity, L.mark === 'rule' ? p : 1),
          })}/>`;
          const lab = L.label?.(row);
          if (lab && L.mark === 'rule') {
            const str = fillTemplate(lab, row, write);
            const horizontal = Math.abs(by - ay) < 0.5;
            s += `<text${attrs({
              x: r2(horizontal ? Math.max(ax, bx) : ax + 4),
              y: r2(horizontal ? ay - 7 : Math.min(ay, by) + 8),
              fill: th.textMuted,
              'font-size': FONT,
              'font-weight': 500,
              'text-anchor': horizontal ? 'end' : 'start',
              stroke: th.surface,
              'stroke-width': 3,
              'paint-order': 'stroke',
              opacity: mul(opacity, p),
            })}>${esc(str)}</text>`;
          }
          break;
        }
      }
    }
    out += s;
  });
  out += axesMarkup(ctx, model, g);
  out += legendMarkup(ctx, model, g);
  return out;
}

/** Opacidad combinada para attrs(): undefined si queda en 1. */
function mul(a: number | undefined, b: number): number | undefined {
  const v = (a ?? 1) * b;
  return v >= 0.999 ? undefined : r2(v);
}

function lineMarkup(ctx: DrawContext, L: LayerModel, lines: LineGeo[], t: number, base: string): string {
  const th = ctx.theme;
  let s = '';
  lines.forEach((line, k) => {
    const row = L.ds.rows[line.rows[0]];
    // Una línea va en el color de la serie; con `group`, cada grupo con el suyo, en el orden de la paleta.
    const own = resolveColor(L.color?.(row) ?? null, th, base);
    const color = own ?? (lines.length > 1 ? (th.palette[k % th.palette.length] ?? base) : base);
    const width = L.ch.size ? (sizer(L)(row) ?? 2) : 2;
    const d = linePath(line.points, L.curve === 'smooth');
    const p = t >= 0.999 ? 1 : clamp01(t);
    s += `<path${attrs({
      d,
      fill: 'none',
      stroke: color,
      'stroke-width': width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      pathLength: p < 1 ? 1 : undefined,
      'stroke-dasharray': p < 1 ? `${r2(p)} 1` : undefined,
    })}/>`;
    if (L.points) {
      for (const [x, y] of line.points) {
        if (!isFinite(x) || !isFinite(y)) continue;
        s += `<circle${attrs({ cx: r2(x), cy: r2(y), r: 3.5, fill: color, stroke: th.surface, 'stroke-width': 1.5, opacity: mul(undefined, p) })}/>`;
      }
    }
  });
  return s;
}

/** Ícono centrado en (cx, cy) de lado `size`. Fuera de una celda lleva un halo de superficie. */
export function iconMarkup(
  ref: IconRef,
  cx: number,
  cy: number,
  size: number,
  color: string,
  th: Theme,
  halo: boolean,
  opacity?: number,
): string {
  if (!(size > 0)) return '';
  const k = size / 24;
  const open = (s: number) =>
    `<g${attrs({ transform: `translate(${r2(cx - size / 2)} ${r2(cy - size / 2)}) scale(${r2(s * 1000) / 1000})`, opacity })}>`;
  if (ref.kind === 'glyph') {
    return `<text${attrs({ x: r2(cx), y: r2(cy), 'font-size': r2(size), 'text-anchor': 'middle', 'dominant-baseline': 'central', opacity, fill: color })}>${esc(ref.text)}</text>`;
  }
  if (ref.kind === 'image') {
    return `<image${attrs({ href: ref.href, x: r2(cx - size / 2), y: r2(cy - size / 2), width: r2(size), height: r2(size), preserveAspectRatio: 'xMidYMid meet', opacity })}/>`;
  }
  // El halo mide 3 px en pantalla, sea cual sea el tamaño del ícono.
  const haloW = 2 + 3 / k;
  if (ref.kind === 'path') {
    const s = size / ref.box;
    const hw = (ref.filled ? 0 : 2) + 3 / s;
    const body = ref.filled
      ? `<path${attrs({ d: ref.d, fill: color })}/>`
      : `<path${attrs({ d: ref.d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })}/>`;
    const under = halo
      ? `<path${attrs({ d: ref.d, fill: ref.filled ? th.surface : 'none', stroke: th.surface, 'stroke-width': r2(hw), 'stroke-linejoin': 'round' })}/>`
      : '';
    return open(s) + under + body + '</g>';
  }
  const shape = ICONS[ref.name];
  if (!shape) return '';
  const all = [...shape.stroke, ...(shape.fill ?? [])].join('');
  let s = open(k);
  if (halo)
    s += `<path${attrs({ d: all, fill: th.surface, stroke: th.surface, 'stroke-width': r2(haloW), 'stroke-linejoin': 'round' })}/>`;
  if (shape.stroke.length)
    s += `<path${attrs({ d: shape.stroke.join(''), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })}/>`;
  if (shape.fill) s += `<path${attrs({ d: shape.fill.join(''), fill: color })}/>`;
  if (shape.hole) s += `<path${attrs({ d: shape.hole.join(''), fill: th.surface })}/>`;
  return s + '</g>';
}

function gridMarkup(g: Geometry, th: Theme): string {
  const { x0, y0, x1, y1 } = g.plot;
  let s = '';
  const line = (a: number, b: number, c: number, d: number, stroke: string, opacity?: number) =>
    `<line${attrs({ x1: r2(a), y1: r2(b), x2: r2(c), y2: r2(d), stroke, 'stroke-width': 1, 'stroke-opacity': opacity, 'shape-rendering': 'crispEdges' })}/>`;
  if (g.Y && g.Y.type !== 'band') {
    for (const tk of g.Y.ticks) s += line(x0, tk.at, x1, tk.at, th.grid, GRID_OPACITY);
    s += line(x0, g.Y.base, x1, g.Y.base, th.zero);
  }
  if (g.X && g.X.type !== 'band') {
    for (const tk of g.X.ticks) s += line(tk.at, y0, tk.at, y1, th.grid, GRID_OPACITY);
    if (g.Y?.type === 'band') s += line(g.X.base, y0, g.X.base, y1, th.zero);
  }
  return s;
}

function axesMarkup(ctx: DrawContext, model: Model, g: Geometry): string {
  const th = ctx.theme;
  let s = '';
  const text = (x: number, y: number, str: string, anchor: string, extra: Record<string, string | number | undefined> = {}) =>
    `<text${attrs({ x: r2(x), y: r2(y), fill: th.textMuted, 'font-size': FONT, 'text-anchor': anchor, 'dominant-baseline': 'central', ...extra })}>${esc(str)}</text>`;
  const { x0, y0, x1, y1 } = g.plot;
  if (g.X && g.xAxisAt) {
    const y = g.xAxisAt === 'top' ? y0 - AXIS_H / 2 : y1 + AXIS_H / 2 + 2;
    // Las categorías no se recortan: si no caben todas, se salta alguna (abajo), como en el eje del núcleo.
    const max = g.X.type === 'band' ? 140 : 96;
    let lastRight = -Infinity;
    for (const tk of g.X.ticks) {
      const label = fitText(tk.label, max, ctx.measure);
      const w = ctx.measure(label);
      const left = Math.max(0, Math.min(ctx.width - w, tk.at - w / 2));
      if (left < lastRight + 6) continue;
      s += text(left + w / 2, y, label, 'middle', g.X.type === 'band' ? { 'font-weight': 500 } : {});
      lastRight = left + w;
    }
    const title = model.x?.spec.title;
    if (title)
      s += text(
        (x0 + x1) / 2,
        g.xAxisAt === 'top' ? y - AXIS_H / 2 - TITLE_H / 2 : y + AXIS_H / 2 + TITLE_H / 2,
        title,
        'middle',
        { fill: th.text },
      );
  }
  if (g.Y && g.yAxisAt) {
    const right = g.yAxisAt === 'left';
    const x = right ? x0 - PAD : x1 + PAD;
    let lastY = -Infinity;
    g.Y.ticks.forEach((tk, k) => {
      if (Math.abs(tk.at - lastY) < 13) return;
      lastY = tk.at;
      const label = g.Y!.type === 'band' ? (g.rowLabels[k] ?? tk.label) : tk.label;
      s += text(x, tk.at, label, right ? 'end' : 'start', g.Y!.type === 'band' ? { fill: th.text, 'font-weight': 500 } : {});
    });
    const title = model.y?.spec.title;
    if (title) s += text(right ? 0 : ctx.width, g.yTitleAt, title, right ? 'start' : 'end', { fill: th.text });
  }
  return s;
}

/**
 * Leyenda de la escala de color, arriba a la derecha como la del mapa de calor: una barra de 120 px
 * con sus extremos debajo (los números o, si cada fila o columna tiene los suyos, peor y mejor). Con
 * umbrales, una muestra por tramo con su rango.
 */
function legendMarkup(ctx: DrawContext, model: Model, g: Geometry): string {
  const s = g.legend;
  if (!s) return '';
  const th = ctx.theme;
  const T = model.T;
  const base = ctx.color;
  const fmt = numberFormat(undefined, model.locale);
  const small = (str: string) => ctx.measure(str) * (SMALL / FONT);
  let out = '';
  const label = (x: number, y: number, str: string, anchor: string) =>
    `<text${attrs({ x: r2(x), y: r2(y), fill: th.textMuted, 'font-size': SMALL, 'text-anchor': anchor, 'dominant-baseline': 'central' })}>${esc(str)}</text>`;
  if (s.thresholds) {
    const cuts = s.thresholds.map(fmt);
    const bins = cuts.length + 1;
    const items: { text: string; color: string }[] = [];
    for (let b = 0; b < bins; b++) {
      const text = b === 0 ? T.below(cuts[0]) : b === bins - 1 ? T.above(cuts[b - 1]) : T.between(cuts[b - 1], cuts[b]);
      const v = b === 0 ? s.thresholds[0] - 1 : s.thresholds[b - 1];
      items.push({ text, color: scaleColor(s, v, '', th, base) });
    }
    if (s.better === 'low') items.reverse();
    let x = ctx.width;
    for (let k = items.length - 1; k >= 0; k--) {
      x -= small(items[k].text);
      out = label(x, 6, items[k].text, 'start') + out;
      x -= 16;
      out = `<rect${attrs({ x: r2(x), y: 1, width: 10, height: 10, rx: 2, fill: items[k].color })}/>` + out;
      x -= 14;
    }
    return `<g aria-hidden="true">${out}</g>`;
  }
  const d = s.domains.get('') ?? [...s.domains.values()][0];
  const words = s.by !== 'all' && s.kind === 'traffic-light';
  const [lo, hi] = words
    ? [T.worse, T.better]
    : s.better === 'low' && s.kind === 'traffic-light'
      ? [fmt(d[1]), fmt(d[0])]
      : [fmt(d[0]), fmt(d[1])];
  const barW = Math.min(120, Math.max(64, ctx.width * 0.2));
  const x0 = ctx.width - barW;
  const steps = 30;
  for (let k = 0; k < steps; k++) {
    const p = (k + 0.5) / steps;
    const color =
      s.kind === 'traffic-light'
        ? toHex(trafficLight(p, th))
        : paint(makeRamp(s.kind, th, base), s.kind === 'diverging' ? p * 2 - 1 : p).fill;
    out += `<rect${attrs({ x: r2(x0 + (k * barW) / steps), y: 0, width: r2(barW / steps + (k < steps - 1 ? 0.5 : 0)), height: 8, fill: color })}/>`;
  }
  const y = 8 + 4 + SMALL / 2;
  out += label(x0, y, lo, 'start') + label(ctx.width, y, hi, 'end');
  // "por fila": a la izquierda de la barra, a su altura.
  const caption = s.by === 'row' ? T.byRow : s.by === 'column' ? T.byColumn : '';
  if (caption) out += label(x0 - 8, 4, caption, 'end');
  return `<g aria-hidden="true">${out}</g>`;
}

/** Minigráfico: la línea, el área si se pide, los extremos huecos y el último punto lleno. */
function sparkMarkup(m: Mark, color: string, th: Theme, L: LayerModel, p: number, opacity?: number): string {
  const sp = m.spark;
  if (!sp || !sp.pts.length) return '';
  let s = '';
  const d = linePath(sp.pts, L.curve === 'smooth');
  if (L.area && sp.pts.length > 1) {
    const first = sp.pts[0];
    const last = sp.pts[sp.pts.length - 1];
    s += `<path${attrs({ d: `${d}L${r2(last[0])},${r2(sp.floor)}L${r2(first[0])},${r2(sp.floor)}Z`, fill: color, 'fill-opacity': r2(0.16 * p) })}/>`;
  }
  s += `<path${attrs({
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': 1.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    pathLength: p < 1 ? 1 : undefined,
    'stroke-dasharray': p < 1 ? `${r2(p)} 1` : undefined,
  })}/>`;
  if (p >= 1) {
    if (L.extremes)
      for (const k of [sp.min, sp.max])
        s += `<circle${attrs({ cx: r2(sp.pts[k][0]), cy: r2(sp.pts[k][1]), r: 2.25, fill: th.surface, stroke: color, 'stroke-width': 1.25 })}/>`;
    const [lx, ly] = sp.pts[sp.pts.length - 1];
    s += `<circle${attrs({ cx: r2(lx), cy: r2(ly), r: 2.75, fill: color, stroke: th.surface, 'stroke-width': 1.25 })}/>`;
  }
  return opacity !== undefined ? `<g opacity="${opacity}">${s}</g>` : s;
}

// ------------------------------------------------------------ Hover, puntero y teclado

function hoverMarkup(ctx: DrawContext, model: Model, i: number): string {
  const g = geometry(ctx, model);
  const sh = g.shapes[i];
  if (!sh) return '';
  const th = ctx.theme;
  if (sh.kind === 'rect') {
    const ring = (out: number, stroke: string, width: number, opacity?: number) =>
      `<rect${attrs({ x: r2(sh.x - out), y: r2(sh.y - out), width: r2(sh.w + 2 * out), height: r2(sh.h + 2 * out), rx: RADIUS + out, fill: 'none', stroke, 'stroke-width': width, 'stroke-opacity': opacity })}/>`;
    return ring(2, th.surface, 4) + ring(1, th.text, 2, 0.85);
  }
  const r = sh.r + 4;
  return (
    `<circle${attrs({ cx: r2(sh.cx), cy: r2(sh.cy), r: r2(r + 1), fill: 'none', stroke: th.surface, 'stroke-width': 4 })}/>` +
    `<circle${attrs({ cx: r2(sh.cx), cy: r2(sh.cy), r: r2(r), fill: 'none', stroke: th.text, 'stroke-width': 2, 'stroke-opacity': 0.85 })}/>`
  );
}

function inside(sh: Shape, px: number, py: number, slop: number): boolean {
  if (sh.kind === 'rect') return px >= sh.x - slop && px <= sh.x + sh.w + slop && py >= sh.y - slop && py <= sh.y + sh.h + slop;
  return Math.hypot(px - sh.cx, py - sh.cy) <= sh.r + slop;
}

export function hitItem(g: Pick<Geometry, 'hits'>, px: number, py: number): number {
  // Primero lo que está justo debajo (de la capa de arriba a la de abajo); después, lo que queda a
  // 6 px: un ícono chico se apunta sin puntería fina.
  for (const h of g.hits) if (inside(h.shape, px, py, 0)) return h.item;
  let best = -1;
  let bestD = Infinity;
  for (const h of g.hits) {
    if (!inside(h.shape, px, py, 6)) continue;
    const c = h.shape.kind === 'rect' ? [h.shape.x + h.shape.w / 2, h.shape.y + h.shape.h / 2] : [h.shape.cx, h.shape.cy];
    const d = Math.hypot(px - c[0], py - c[1]);
    if (d < bestD) [best, bestD] = [h.item, d];
  }
  return best;
}

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

/**
 * Flechas en el plano: el dato más cercano hacia ese lado, prefiriendo el que está en línea (en
 * una tabla, la celda vecina; en un mapa, la ciudad que queda a la derecha). En el borde se queda.
 */
export function spatialStep(centers: readonly ([number, number] | null)[], i: number, key: string): number | undefined {
  const dir = DIRECTIONS[key];
  const from = centers[i];
  if (!dir || !from) return undefined;
  let best = i;
  let bestScore = Infinity;
  centers.forEach((c, j) => {
    if (!c || j === i) return;
    const dx = c[0] - from[0];
    const dy = c[1] - from[1];
    const along = dx * dir[0] + dy * dir[1];
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    if (along <= 1 || across > along * 2.5) return;
    const score = along + across * 3;
    if (score < bestScore) [best, bestScore] = [j, score];
  });
  return best;
}

// ------------------------------------------------------------ Tipo de serie

export const layers: SeriesImpl = {
  coords: 'free',
  dimmable: true,
  label: (locale) => layerTexts(locale).label,
  items: (locale) => layerTexts(locale).items,
  legendSymbol: 'square',
  preferredHeight(ps, width) {
    const model = modelOf(ps);
    if (!model) return undefined;
    const legend = legendScale(model) ? LEGEND_H : 0;
    if (model.coords === 'geo') {
      // El mundo entero es el doble de ancho que de alto; una región encuadrada, más alta.
      const share = model.spec.geo?.fit === 'all' ? 0.52 : 0.78;
      return Math.round(Math.max(300, Math.min(860, width * share + legend)));
    }
    if (model.coords === 'network') return Math.round(Math.max(380, Math.min(780, width * 0.66)));
    if (model.y?.type === 'band') {
      const rows = model.y.keys.length;
      const axis = model.x?.spec.axis === false ? 4 : AXIS_H + 4;
      return Math.round(Math.max(160, Math.min(1600, rows * ROW_PITCH + axis + legend + 16)));
    }
    return Math.round(Math.max(280, Math.min(560, width * 0.42)));
  },
  draw(ctx) {
    const model = modelOf(ctx.frame.ps);
    return model ? draw(ctx, model) : '';
  },
  hit(ctx, px, py) {
    const model = modelOf(ctx.frame.ps);
    return model ? hitItem(geometry(ctx, model), px, py) : -1;
  },
  anchor(ctx, i) {
    const model = modelOf(ctx.frame.ps);
    if (!model) return null;
    const g = geometry(ctx, model);
    const sh = g.shapes[i];
    const c = g.centers[i];
    if (!sh || !c) return null;
    const top = sh.kind === 'rect' ? sh.y : sh.cy - sh.r;
    const bottom = sh.kind === 'rect' ? sh.y + sh.h : sh.cy + sh.r;
    return [c[0], c[1] < ctx.height / 2 ? top : bottom];
  },
  hover(ctx, i) {
    const model = modelOf(ctx.frame.ps);
    return model ? hoverMarkup(ctx, model, i) : '';
  },
  swatch(ctx, i) {
    const model = modelOf(ctx.frame.ps);
    const it = model?.items[i];
    if (!model || !it) return null;
    const L = mainLayer(it);
    const own = resolveColor(L.color?.(it.ds.rows[it.row]) ?? null, ctx.theme, ctx.color);
    return own ?? ctx.color;
  },
  step(ps, i, key) {
    const g = lastGeometry.get(ps);
    return g ? spatialStep(g.centers, i, key) : undefined;
  },
  tooltip(ps, i, format: TooltipFormat) {
    const model = modelOf(ps);
    return model ? tooltipOf(model, i, format.locale) : null;
  },
};
