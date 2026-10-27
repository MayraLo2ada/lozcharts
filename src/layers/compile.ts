/**
 * De la especificación por capas a un modelo listo para dibujar: revisa cada parte (con avisos
 * claros de qué está mal y dónde), lee las expresiones una sola vez, decide el tipo de cada eje y el
 * rango de cada escala de color, y arma la lista de datos que recorren el teclado, el tooltip y la
 * tabla oculta. Nada de esto depende del tamaño ni del tema: eso queda para render.ts.
 */
import { defaultLocale, getMap, parseTime, type NetLink } from '@lozcharts/core';
import {
  ExprError,
  compile as compileExpr,
  evaluate,
  fieldsOf,
  parse,
  parseTemplate,
  templateFields,
  toNumber,
  truthy,
  fillTemplate,
  type Piece,
} from './expr';
import { ICON_ALIASES, ICON_NAMES, iconName, isGlyph } from './icons';
import { closest, layerTexts, quoteList, type LayerTexts } from './texts';
import type { AxisSpec, ColorScale, Layer, LayerFormat, LayerProblem, LayerSpec, MarkName, Position } from './spec';

type Row = Record<string, unknown>;
export type Resolver<T> = (row: Row) => T | null;

export const MARKS: readonly MarkName[] = ['cell', 'text', 'icon', 'point', 'bar', 'line', 'rule', 'link', 'spark'];

const COMMON = ['mark', 'data', 'filter', 'name', 'tooltip', 'format', 'opacity', 'title', 'alt'];
const PLACE = ['x', 'y', 'lon', 'lat', 'node', 'position', 'dx', 'dy'];
const KEYS: Record<MarkName, string[]> = {
  cell: ['x', 'y', 'color'],
  text: [...PLACE, 'text', 'color', 'size', 'weight'],
  icon: [...PLACE, 'icon', 'color', 'size'],
  point: [...PLACE, 'color', 'size'],
  bar: ['x', 'y', 'x2', 'y2', 'color', 'size'],
  line: ['x', 'y', 'color', 'size', 'group', 'curve', 'points'],
  rule: ['x', 'y', 'x2', 'y2', 'color', 'size', 'dash', 'label'],
  link: ['from', 'to', 'color', 'size', 'dash'],
  spark: ['x', 'y', 'period', 'value', 'color', 'area', 'extremes'],
};
const TOP_KEYS = [
  'title',
  'subtitle',
  'description',
  'name',
  'locale',
  'currency',
  'theme',
  'height',
  'animate',
  'background',
  'data',
  'layers',
  'scales',
  'geo',
  'network',
];
/** Marcas con tooltip por defecto: las que son el dato. Textos, reglas y enlaces acompañan. */
const INTERACTIVE: readonly MarkName[] = ['cell', 'icon', 'point', 'bar', 'line', 'spark'];
const POSITIONS: readonly Position[] = [
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];
/** Canales de posición: sus campos dan el lugar, no el dato (no van al tooltip por defecto). */
const PLACE_CHANNELS = ['x', 'y', 'x2', 'y2', 'lon', 'lat', 'node', 'from', 'to', 'group', 'period'] as const;
type PlaceChannel = (typeof PLACE_CHANNELS)[number];

/** Colores con nombre del tema (los ocho de la paleta, los del semáforo y los grises). */
export const COLOR_NAMES = [
  'good',
  'warn',
  'bad',
  'violet',
  'pink',
  'ochre',
  'wine',
  'green',
  'sky',
  'coral',
  'teal',
  'text',
  'muted',
  'grid',
];

// ------------------------------------------------------------ Modelo

export interface Dataset {
  name: string;
  rows: Row[];
  fields: Set<string>;
}

/** Escala de color de una capa, con su dominio por grupo (fila, columna o todo). */
export interface ColorScaleModel {
  spec: ColorScale;
  value: (row: Row) => unknown;
  kind: 'traffic-light' | 'sequential' | 'diverging';
  by: 'all' | 'row' | 'column';
  better: 'high' | 'low';
  thresholds: number[] | null;
  /** Mínimo y máximo de cada grupo ('' cuando by es 'all'). */
  domains: Map<string, [number, number]>;
}

/** Un color ya resuelto por fila: un nombre o valor fijo, o una posición en una escala. */
export type ColorRef = string | { scale: ColorScaleModel; v: number; group: string };

export type IconRef =
  | { kind: 'named'; name: string; alt?: string }
  | { kind: 'glyph'; text: string; alt?: string }
  | { kind: 'path'; d: string; box: number; filled: boolean; alt?: string }
  | { kind: 'image'; href: string; alt?: string };

export interface TooltipLine {
  label: string;
  value: (row: Row, format: (v: unknown) => string) => string;
  format?: LayerFormat;
}

export interface LayerModel {
  index: number;
  path: string;
  mark: MarkName;
  ds: Dataset;
  /** Filas que dibuja (las que pasan el filtro), en orden. */
  rows: number[];
  ch: Partial<Record<PlaceChannel | 'size' | 'value', Resolver<unknown>>>;
  /** Campos de cada canal de posición, y los de los demás (los que dicen algo del dato). */
  placeFields: Partial<Record<PlaceChannel, string[]>>;
  valueFields: string[];
  color?: Resolver<ColorRef>;
  icon?: Resolver<IconRef>;
  text?: Resolver<Piece[]>;
  alt?: Resolver<Piece[]>;
  title?: Resolver<Piece[]>;
  label?: Resolver<Piece[]>;
  dash?: Resolver<boolean>;
  /** `size` viene de un campo (se escala) y no de un número fijo. */
  sizeField: boolean;
  tooltip: false | TooltipLine[] | 'auto';
  format?: LayerFormat;
  position: Position;
  dx: number;
  dy: number;
  opacity?: number;
  weight?: number;
  curve: 'linear' | 'smooth';
  points: boolean;
  /** Minigráfico: sus series (las filas de cada celda, en el orden del periodo), con área y extremos. */
  sparks?: number[][];
  area: boolean;
  extremes: boolean;
}

export interface AxisModel {
  type: 'band' | 'linear' | 'time';
  /** Categorías en orden (band) o mínimo y máximo (linear y time). */
  keys: string[];
  min: number;
  max: number;
  /** Texto de cada categoría (el valor tal cual). */
  spec: AxisSpec;
  /** Hay barras sobre este eje como valor: incluye el cero. */
  zero: boolean;
}

export interface Item {
  ds: Dataset;
  row: number;
  /** Las capas que dibujan esta fila, en orden. La primera interactiva es la principal. */
  layers: LayerModel[];
  /** En un minigráfico, todas sus filas en orden. */
  spark?: number[];
}

export interface Model {
  spec: LayerSpec;
  locale: string;
  T: LayerTexts;
  coords: 'cartesian' | 'geo' | 'network';
  datasets: Map<string, Dataset>;
  layers: LayerModel[];
  items: Item[];
  /** Índice del dato de cada fila: `${ds}\u0000${fila}`. */
  itemOf: Map<string, number>;
  x: AxisModel | null;
  y: AxisModel | null;
  scales: ColorScaleModel[];
  network: { ids: string[]; index: Map<string, number>; links: NetLink[] } | null;
  problems: LayerProblem[];
}

const DEFAULT_DS = 'data';
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// ------------------------------------------------------------ Lectura de valores

interface Ctx {
  T: LayerTexts;
  locale: string;
  problems: LayerProblem[];
  /** Campos que nombra la capa que se está leyendo. */
  fields: string[];
}

function problem(c: Ctx, path: string, message: string, level: LayerProblem['level'] = 'error'): void {
  c.problems.push({ path, message, level });
}

/** Lee una expresión y anota sus campos; con un error, lo anota y devuelve null. */
function expr(c: Ctx, src: string, path: string): ((row: Row) => unknown) | null {
  try {
    const e = compileExpr(src, c.locale);
    c.fields.push(...e.fields);
    return e.run;
  } catch (err) {
    if (err instanceof ExprError) {
      problem(c, path, c.T.check.badExpr(err.message));
      return null;
    }
    throw err;
  }
}

function template(c: Ctx, src: string, path: string): Piece[] | null {
  try {
    const pieces = parseTemplate(src, c.locale);
    c.fields.push(...templateFields(pieces));
    return pieces;
  } catch (err) {
    if (err instanceof ExprError) {
      problem(c, path, c.T.check.badExpr(err.message));
      return null;
    }
    throw err;
  }
}

/**
 * Un canal con su forma completa: una condición ({ if, then, else }), una tabla ({ field, map,
 * other }) o un valor simple, que lee `leaf`. Devuelve null si no se pudo leer.
 */
function value<T>(
  c: Ctx,
  raw: unknown,
  path: string,
  leaf: (raw: unknown, path: string) => Resolver<T> | null,
  maps = true,
): Resolver<T> | null {
  if (isObject(raw) && own(raw, 'if')) {
    if (typeof raw.if !== 'string' || !own(raw, 'then')) {
      problem(c, path, c.T.check.badCond);
      return null;
    }
    const test = expr(c, raw.if, `${path}.if`);
    const yes = value(c, raw.then, `${path}.then`, leaf, maps);
    const no = own(raw, 'else') ? value(c, raw.else, `${path}.else`, leaf, maps) : () => null;
    if (!test || !yes || !no) return null;
    return (row) => (truthy(test(row)) ? yes(row) : no(row));
  }
  if (maps && isObject(raw) && own(raw, 'map')) {
    if (!isObject(raw.map) || typeof raw.field !== 'string') {
      problem(c, path, c.T.check.badMap);
      return null;
    }
    const key = expr(c, raw.field, `${path}.field`);
    const table = new Map<string, Resolver<T>>();
    for (const [k, v] of Object.entries(raw.map)) {
      const r = leaf(v, `${path}.map.${k}`);
      if (r) table.set(k, r);
    }
    const other = own(raw, 'other') ? leaf(raw.other, `${path}.other`) : null;
    if (!key) return null;
    return (row) => {
      const k = key(row);
      const hit = k === null || k === undefined ? undefined : table.get(String(k));
      return hit ? hit(row) : other ? other(row) : null;
    };
  }
  return leaf(raw, path);
}

/** Posiciones y números: una expresión, un número fijo o { value } (un valor fijo, también un texto). */
function exprLeaf(c: Ctx): (raw: unknown, path: string) => Resolver<unknown> | null {
  return (raw, path) => {
    if (typeof raw === 'number') return () => raw;
    if (typeof raw === 'string') return expr(c, raw, path);
    if (isObject(raw) && own(raw, 'value')) {
      const v = raw.value;
      return () => (v === undefined ? null : v);
    }
    if (isObject(raw) && typeof raw.field === 'string') return expr(c, raw.field, `${path}.field`);
    problem(c, path, c.T.check.badNumber(path.split('.').pop()!));
    return null;
  };
}

function templateLeaf(c: Ctx): (raw: unknown, path: string) => Resolver<Piece[]> | null {
  return (raw, path) => {
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      const pieces = [String(raw)];
      return () => pieces;
    }
    if (typeof raw !== 'string') {
      problem(c, path, c.T.check.badChoice(path.split('.').pop()!, '"texto {campo}"'));
      return null;
    }
    const pieces = template(c, raw, path);
    return pieces && (() => pieces);
  };
}

/** ¿Es un color que se puede escribir tal cual? #hex, rgb()/hsl(), o un número de la paleta. */
export function colorToken(raw: unknown): string | null {
  if (typeof raw === 'number') return Number.isInteger(raw) && raw >= 1 && raw <= 8 ? String(raw) : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([\d\s.,%/]+\)$/i.test(s)) return s;
  if (/^[1-8]$/.test(s)) return s;
  const name = s.toLowerCase();
  return COLOR_NAMES.includes(name) ? name : null;
}

function colorLeaf(
  c: Ctx,
  layer: () => LayerModel | null,
  scales: ColorScaleModel[],
): (raw: unknown, path: string) => Resolver<ColorRef> | null {
  return (raw, path) => {
    if (isObject(raw) && typeof raw.field === 'string') {
      const s = raw as unknown as ColorScale;
      const v = expr(c, s.field, `${path}.field`);
      const kind = s.scale ?? 'traffic-light';
      if (!['traffic-light', 'sequential', 'diverging'].includes(kind))
        problem(c, `${path}.scale`, c.T.check.unknownScale(String(kind)));
      const by = s.by ?? 'all';
      if (!['all', 'row', 'column'].includes(by)) problem(c, `${path}.by`, c.T.check.badBy(String(by)));
      const better = s.better === 'low' ? 'low' : 'high';
      if (s.better !== undefined && s.better !== 'high' && s.better !== 'low')
        problem(c, `${path}.better`, c.T.check.badChoice('better', '"high" o "low"'));
      let thresholds: number[] | null = null;
      if (s.thresholds !== undefined) {
        const ok =
          Array.isArray(s.thresholds) &&
          s.thresholds.length > 0 &&
          s.thresholds.every((t, k) => typeof t === 'number' && (k === 0 || t > s.thresholds![k - 1]));
        if (ok) thresholds = s.thresholds;
        else problem(c, `${path}.thresholds`, c.T.check.badThresholds);
      }
      if (
        s.domain !== undefined &&
        !(Array.isArray(s.domain) && s.domain.length === 2 && s.domain.every((d) => typeof d === 'number'))
      )
        problem(c, `${path}.domain`, c.T.check.badNumber('domain'));
      if (!v) return null;
      const model: ColorScaleModel = {
        spec: s,
        value: v,
        kind: kind === 'sequential' || kind === 'diverging' ? kind : 'traffic-light',
        by: by === 'row' || by === 'column' ? by : 'all',
        better,
        thresholds,
        domains: new Map(),
      };
      scales.push(model);
      return (row) => {
        const n = toNumber(v(row));
        if (!isFinite(n)) return null;
        const L = layer();
        const group = !L || model.by === 'all' ? '' : bandKey(L.ch[model.by === 'row' ? 'y' : 'x']?.(row));
        return { scale: model, v: n, group };
      };
    }
    const token = colorToken(raw);
    if (token) return () => token;
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    // Un color mal escrito deja ese caso con el color de la serie, no la capa sin dibujar.
    problem(c, path, c.T.check.unknownColor(text, c.T.check.hint(closest(String(text), COLOR_NAMES))));
    return () => null;
  };
}

function iconLeaf(c: Ctx): (raw: unknown, path: string) => Resolver<IconRef> | null {
  return (raw, path) => {
    if (typeof raw === 'string') {
      const name = iconName(raw);
      if (name) {
        const ref: IconRef = { kind: 'named', name };
        return () => ref;
      }
      if (isGlyph(raw)) {
        const ref: IconRef = { kind: 'glyph', text: raw.trim() };
        return () => ref;
      }
      // Solo este caso queda sin ícono (el resto de la capa se dibuja), y el aviso dice cuál es.
      problem(c, path, c.T.check.unknownIcon(raw, c.T.check.hint(closest(raw, [...ICON_NAMES, ...Object.keys(ICON_ALIASES)]))));
      return () => null;
    }
    if (isObject(raw) && typeof raw.field === 'string' && !own(raw, 'map')) {
      // El ícono sale de la fila ("emoji": "🍓"): se lee en cada fila y lo que no es un ícono no se dibuja.
      const v = expr(c, raw.field, `${path}.field`);
      if (!v) return null;
      return (row) => {
        const s = v(row);
        if (typeof s !== 'string') return null;
        const name = iconName(s);
        return name ? { kind: 'named', name } : isGlyph(s) ? { kind: 'glyph', text: s.trim() } : null;
      };
    }
    if (isObject(raw) && typeof raw.path === 'string') {
      // Un camino propio: solo comandos y números, nada que el SVG pueda interpretar de otra forma.
      if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(raw.path)) {
        problem(c, `${path}.path`, c.T.check.unknownIcon(raw.path.slice(0, 24), ''));
        return () => null;
      }
      const box = typeof raw.viewBox === 'number' && raw.viewBox > 0 ? raw.viewBox : 24;
      const ref: IconRef = {
        kind: 'path',
        d: raw.path,
        box,
        filled: raw.filled === true,
        alt: typeof raw.alt === 'string' ? raw.alt : undefined,
      };
      return () => ref;
    }
    if (isObject(raw) && typeof raw.image === 'string') {
      const href = raw.image.trim();
      // Solo direcciones web o relativas: nada de javascript: ni data: con scripts.
      if (/^(javascript|vbscript):/i.test(href) || /^data:(?!image\/(png|jpeg|gif|webp|svg\+xml);)/i.test(href)) {
        problem(c, `${path}.image`, c.T.check.unknownIcon(href.slice(0, 24), ''));
        return () => null;
      }
      const ref: IconRef = { kind: 'image', href, alt: typeof raw.alt === 'string' ? raw.alt : undefined };
      return () => ref;
    }
    problem(c, path, c.T.check.unknownIcon(JSON.stringify(raw)?.slice(0, 40) ?? '', ''));
    return () => null;
  };
}

function boolLeaf(c: Ctx): (raw: unknown, path: string) => Resolver<boolean> | null {
  return (raw, path) => {
    if (typeof raw === 'boolean') return () => raw;
    problem(c, path, c.T.check.badChoice(path.split('.').pop()!, 'true o false'));
    return null;
  };
}

/** Clave de una categoría: el valor como texto (una fecha, en ISO). */
export function bandKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// ------------------------------------------------------------ Revisión y armado

/** Revisa una especificación sin dibujarla: la lista de problemas, vacía si todo está bien. */
export function checkLayers(spec: unknown, locale?: string): LayerProblem[] {
  return buildModel(spec, locale).problems;
}

/**
 * Arma el modelo. Nunca lanza: lo que está mal queda en `problems` y esa parte no se dibuja (una
 * capa con una marca desconocida, un canal con una expresión mal escrita); lo demás sigue.
 */
export function buildModel(raw: unknown, localeOverride?: string): Model {
  const spec = (isObject(raw) ? raw : {}) as unknown as LayerSpec;
  const locale = localeOverride ?? (typeof spec.locale === 'string' && spec.locale.trim() ? spec.locale : defaultLocale());
  const T = layerTexts(locale);
  const problems: LayerProblem[] = [];
  const empty: Model = {
    spec,
    locale,
    T,
    coords: 'cartesian',
    datasets: new Map(),
    layers: [],
    items: [],
    itemOf: new Map(),
    x: null,
    y: null,
    scales: [],
    network: null,
    problems,
  };
  if (!isObject(raw)) {
    problems.push({ path: '', message: T.check.notObject, level: 'error' });
    return empty;
  }
  for (const key of Object.keys(spec)) {
    if (!TOP_KEYS.includes(key))
      problems.push({ path: key, message: T.check.unknownKey(key, T.check.hint(closest(key, TOP_KEYS))), level: 'warning' });
  }
  const datasets = readData(spec, T, problems);
  empty.datasets = datasets;
  if (!Array.isArray(spec.layers) || !spec.layers.length) {
    problems.push({ path: 'layers', message: T.check.noLayers, level: 'error' });
    return empty;
  }
  const coords = spec.geo ? 'geo' : spec.network ? 'network' : 'cartesian';
  empty.coords = coords;
  if (coords === 'geo') {
    const name = String((isObject(spec.geo) && spec.geo.map) || 'mundo');
    if (!getMap(name)) problems.push({ path: 'geo.map', message: T.check.noMap(name), level: 'warning' });
  }
  const network = coords === 'network' ? readNetwork(spec, datasets, T, problems) : null;

  const scales: ColorScaleModel[] = [];
  const layers: LayerModel[] = [];
  spec.layers.forEach((layer, index) => {
    const L = readLayer(layer, index, { spec, datasets, T, locale, problems, scales, coords, network });
    if (L) layers.push(L);
  });

  const model: Model = { ...empty, coords, layers, scales, network: network?.model ?? null };
  if (coords === 'cartesian') {
    model.x = axis(layers, ['x', 'x2'], spec.scales?.x, 'x');
    model.y = axis(layers, ['y', 'y2'], spec.scales?.y, 'y');
  }
  colorDomains(model);
  buildItems(model);
  return model;
}

function readData(spec: LayerSpec, T: LayerTexts, problems: LayerProblem[]): Map<string, Dataset> {
  const out = new Map<string, Dataset>();
  const add = (name: string, list: unknown, path: string) => {
    if (!Array.isArray(list)) {
      problems.push({ path, message: T.check.badData, level: 'error' });
      return;
    }
    const rows = list.filter(isObject) as Row[];
    if (rows.length < list.length)
      problems.push({ path, message: T.check.notRows(name, list.length - rows.length), level: 'warning' });
    out.set(name, dataset(name, rows));
  };
  if (spec.data === undefined) return out;
  if (Array.isArray(spec.data)) {
    add(DEFAULT_DS, spec.data, 'data');
    return out;
  }
  if (!isObject(spec.data)) {
    problems.push({ path: 'data', message: T.check.badData, level: 'error' });
    return out;
  }
  // Primero las listas, después las que se arman a partir de otra ({ from, fold }).
  const derived: [string, Record<string, unknown>][] = [];
  for (const [name, list] of Object.entries(spec.data as Record<string, unknown>)) {
    if (isObject(list)) derived.push([name, list]);
    else add(name, list, `data.${name}`);
  }
  for (const [name, d] of derived) {
    const path = `data.${name}`;
    let rows: Row[] | null = null;
    if (Array.isArray(d.rows)) rows = d.rows.filter(isObject) as Row[];
    else if (typeof d.from === 'string') {
      const src = out.get(d.from);
      if (src) rows = src.rows;
      else
        problems.push({ path: `${path}.from`, message: T.check.unknownData(d.from, quoteList([...out.keys()])), level: 'error' });
    } else problems.push({ path, message: T.check.badData, level: 'error' });
    if (!rows) continue;
    if (d.fold !== undefined) {
      const fold = Array.isArray(d.fold) ? d.fold.filter((f): f is string => typeof f === 'string') : [];
      const as = Array.isArray(d.as) && d.as.length === 2 ? d.as.map(String) : ['key', 'value'];
      if (!fold.length)
        problems.push({ path: `${path}.fold`, message: T.check.badChoice('fold', '["W31", "W32", …]'), level: 'error' });
      rows = foldRows(rows, fold, as[0], as[1]);
    }
    out.set(name, dataset(name, rows));
  }
  return out;
}

function dataset(name: string, rows: Row[]): Dataset {
  const fields = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) fields.add(k);
  return { name, rows, fields };
}

/**
 * De ancho a largo: cada fila se vuelve una por cada campo de `fold`, con el nombre del campo en
 * `key` y su valor en `value`; los demás campos se copian. Así una tabla como la de un reporte
 * (una columna por semana) se escribe tal cual.
 */
export function foldRows(rows: readonly Row[], fold: readonly string[], key: string, value: string): Row[] {
  const out: Row[] = [];
  const drop = new Set(fold);
  for (const r of rows) {
    const rest: Row = {};
    for (const [k, v] of Object.entries(r)) if (!drop.has(k)) rest[k] = v;
    for (const f of fold) if (own(r, f)) out.push({ ...rest, [key]: f, [value]: r[f] });
  }
  return out;
}

interface NetworkRead {
  nodes: Dataset;
  id: string;
  links: Dataset;
  from: string;
  to: string;
  model: NonNullable<Model['network']>;
}

function readNetwork(
  spec: LayerSpec,
  datasets: Map<string, Dataset>,
  T: LayerTexts,
  problems: LayerProblem[],
): NetworkRead | null {
  const n = spec.network as unknown;
  if (!isObject(n)) return null;
  const list = quoteList([...datasets.keys()]);
  const nodes = typeof n.nodes === 'string' ? datasets.get(n.nodes) : undefined;
  const links = typeof n.links === 'string' ? datasets.get(n.links) : undefined;
  if (!nodes) problems.push({ path: 'network.nodes', message: T.check.unknownData(String(n.nodes ?? ''), list), level: 'error' });
  if (!links) problems.push({ path: 'network.links', message: T.check.unknownData(String(n.links ?? ''), list), level: 'error' });
  if (!nodes || !links) return null;
  const id = typeof n.id === 'string' ? n.id : 'id';
  const from = typeof n.from === 'string' ? n.from : 'from';
  const to = typeof n.to === 'string' ? n.to : 'to';
  const hint = (f: string, ds: Dataset) => T.check.hint(closest(f, ds.fields));
  if (nodes.rows.length && !nodes.fields.has(id))
    problems.push({ path: 'network.id', message: T.check.noField(id, `"${nodes.name}"`, hint(id, nodes)), level: 'error' });
  for (const [key, f] of [
    ['from', from],
    ['to', to],
  ] as const)
    if (links.rows.length && !links.fields.has(f))
      problems.push({ path: `network.${key}`, message: T.check.noField(f, `"${links.name}"`, hint(f, links)), level: 'error' });
  const ids: string[] = [];
  const index = new Map<string, number>();
  const node = (v: unknown) => {
    const key = bandKey(v);
    if (!key) return -1;
    let k = index.get(key);
    if (k === undefined) {
      k = ids.length;
      ids.push(key);
      index.set(key, k);
    }
    return k;
  };
  for (const r of nodes.rows) node(r[id]);
  const netLinks: NetLink[] = [];
  links.rows.forEach((r, k) => {
    const a = node(r[from]);
    const b = node(r[to]);
    if (a >= 0 && b >= 0 && a !== b) netLinks.push({ source: a, target: b, weight: 1, rows: [k] });
  });
  return { nodes, id, links, from, to, model: { ids, index, links: netLinks } };
}

interface LayerEnv {
  spec: LayerSpec;
  datasets: Map<string, Dataset>;
  T: LayerTexts;
  locale: string;
  problems: LayerProblem[];
  scales: ColorScaleModel[];
  coords: Model['coords'];
  network: NetworkRead | null;
}

function readLayer(raw: Layer, index: number, env: LayerEnv): LayerModel | null {
  const { T, problems } = env;
  const path = `layers[${index}]`;
  if (!isObject(raw)) {
    problems.push({ path, message: T.check.badChoice(path, '{ "mark": … }'), level: 'error' });
    return null;
  }
  const mark = raw.mark as MarkName;
  if (!MARKS.includes(mark)) {
    problems.push({
      path: `${path}.mark`,
      message: T.check.unknownMark(String(mark ?? ''), quoteList(MARKS), T.check.hint(closest(String(mark ?? ''), MARKS))),
      level: 'error',
    });
    return null;
  }
  const allowed = [...COMMON, ...KEYS[mark]];
  for (const key of Object.keys(raw)) {
    if (allowed.includes(key)) continue;
    // Un canal que existe en otra marca dice algo más útil que "no lo conozco".
    if ((key === 'lon' || key === 'lat') && env.coords !== 'geo') continue;
    problems.push({
      path: `${path}.${key}`,
      message: T.check.unknownKey(key, T.check.hint(closest(key, allowed))),
      level: 'warning',
    });
  }

  // Los datos: los del gráfico, una lista con nombre o filas propias.
  let ds: Dataset | undefined;
  if (Array.isArray(raw.data)) {
    const rows = raw.data.filter(isObject) as Row[];
    const fields = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) fields.add(k);
    ds = { name: `${path}.data`, rows, fields };
  } else if (typeof raw.data === 'string') {
    ds = env.datasets.get(raw.data);
    if (!ds)
      problems.push({
        path: `${path}.data`,
        message: T.check.unknownData(raw.data, quoteList([...env.datasets.keys()])),
        level: 'error',
      });
  } else {
    ds = env.datasets.get(DEFAULT_DS) ?? (env.datasets.size === 1 ? [...env.datasets.values()][0] : undefined);
    // Sin datos, la capa todavía puede ser fija (una regla en y: 60): se decide al ver sus campos.
    if (!ds) ds = dataset('', []);
  }
  if (!ds) return null;

  const c: Ctx = { T, locale: env.locale, problems, fields: [] };
  let model: LayerModel | null = null;
  const E = exprLeaf(c);
  const ch: LayerModel['ch'] = {};
  const placeFields: LayerModel['placeFields'] = {};
  for (const key of [...PLACE_CHANNELS, 'size', 'value'] as const) {
    if (!own(raw, key) || !allowed.includes(key) || raw[key] === undefined) continue;
    const before = c.fields.length;
    const r = value(c, raw[key], `${path}.${key}`, E);
    if (r) ch[key] = r;
    if (key !== 'size' && key !== 'value') placeFields[key] = c.fields.splice(before);
  }
  if (mark === 'spark' && !ch.value) {
    if (raw.value === undefined)
      problems.push({ path: `${path}.value`, message: T.check.missing('value', mark), level: 'error' });
    return null;
  }

  // Dónde va la marca, según el sistema de coordenadas del gráfico.
  const net = env.network;
  if (env.coords === 'network' && net) {
    if (mark === 'link') {
      if (!ch.from) ch.from = (row) => row[net.from] ?? null;
      if (!ch.to) ch.to = (row) => row[net.to] ?? null;
    } else if (!ch.node && ds === net.nodes) ch.node = (row) => row[net.id] ?? null;
  } else {
    if (mark === 'link') problems.push({ path, message: T.check.needsNetwork('link'), level: 'error' });
    if (raw.node !== undefined) problems.push({ path: `${path}.node`, message: T.check.needsNetwork('node'), level: 'error' });
  }
  if (env.coords !== 'geo')
    for (const k of ['lon', 'lat'] as const)
      if (raw[k] !== undefined) problems.push({ path: `${path}.${k}`, message: T.check.needsGeo(k), level: 'error' });

  const placed =
    env.coords === 'geo'
      ? !!(ch.lon && ch.lat)
      : env.coords === 'network'
        ? mark === 'link' || !!ch.node
        : mark === 'rule'
          ? !!(ch.x || ch.y)
          : !!(ch.x && ch.y);
  if (!placed && mark !== 'link') {
    if (env.coords === 'cartesian' && (mark === 'cell' || mark === 'bar' || mark === 'line' || mark === 'spark')) {
      for (const k of ['x', 'y'] as const)
        if (!own(raw, k)) problems.push({ path: `${path}.${k}`, message: T.check.missing(k, mark), level: 'error' });
    } else if (env.coords === 'cartesian' && mark === 'rule') {
      problems.push({ path, message: T.check.missing('x / y', mark), level: 'error' });
    } else if (!problems.some((p) => p.path.startsWith(path) && p.level === 'error')) {
      problems.push({ path, message: T.check.needsPosition(mark), level: 'error' });
    }
    return null;
  }

  const color =
    raw.color !== undefined
      ? value(
          c,
          raw.color,
          `${path}.color`,
          colorLeaf(c, () => model, env.scales),
        )
      : null;
  let icon: Resolver<IconRef> | null = null;
  if (mark === 'icon') {
    if (raw.icon === undefined) problems.push({ path: `${path}.icon`, message: T.check.missing('icon', mark), level: 'error' });
    else icon = value(c, raw.icon, `${path}.icon`, iconLeaf(c));
    if (!icon) return null;
  }
  const TL = templateLeaf(c);
  const text = raw.text !== undefined && allowed.includes('text') ? value(c, raw.text, `${path}.text`, TL) : null;
  if (mark === 'text' && !text) {
    if (raw.text === undefined) problems.push({ path: `${path}.text`, message: T.check.missing('text', mark), level: 'error' });
    return null;
  }
  const alt = raw.alt !== undefined && allowed.includes('alt') ? value(c, raw.alt, `${path}.alt`, TL) : null;
  const before = c.fields.length;
  const title = raw.title !== undefined ? value(c, raw.title, `${path}.title`, TL) : null;
  c.fields.splice(before);
  const label = raw.label !== undefined && allowed.includes('label') ? value(c, raw.label, `${path}.label`, TL) : null;
  const dash = raw.dash !== undefined && allowed.includes('dash') ? value(c, raw.dash, `${path}.dash`, boolLeaf(c), false) : null;

  let filter: ((row: Row) => unknown) | null = null;
  if (raw.filter !== undefined) {
    if (typeof raw.filter === 'string') filter = expr(c, raw.filter, `${path}.filter`);
    else problems.push({ path: `${path}.filter`, message: T.check.badChoice('filter', '"campo == \'valor\'"'), level: 'error' });
  }

  const tooltip = readTooltip(c, raw, mark, path);
  const num = (key: 'dx' | 'dy' | 'opacity', fallback?: number): number | undefined => {
    const v = raw[key];
    if (v === undefined) return fallback;
    if (typeof v === 'number' && isFinite(v)) return v;
    problems.push({ path: `${path}.${key}`, message: T.check.badNumber(key), level: 'warning' });
    return fallback;
  };
  if (raw.position !== undefined && !POSITIONS.includes(raw.position))
    problems.push({ path: `${path}.position`, message: T.check.badChoice('position', quoteList(POSITIONS)), level: 'warning' });
  if (raw.curve !== undefined && raw.curve !== 'linear' && raw.curve !== 'smooth')
    problems.push({ path: `${path}.curve`, message: T.check.badChoice('curve', '"linear" o "smooth"'), level: 'warning' });

  // Campos que no existen en ninguna fila: casi siempre un nombre mal escrito.
  const fields = [...new Set([...c.fields, ...Object.values(placeFields).flat()])];
  if (ds.rows.length) {
    for (const f of fields) {
      if (!ds.fields.has(f)) {
        const label = ds.name === DEFAULT_DS ? '"data"' : `"${ds.name}"`;
        problems.push({ path, message: T.check.noField(f, label, T.check.hint(closest(f, ds.fields))), level: 'warning' });
      }
    }
  }

  // Una capa que no nombra ningún campo (una regla en y: 60, un texto fijo) se dibuja una vez, no
  // una por fila.
  if (!fields.length && raw.data === undefined && mark !== 'link') ds = dataset(path, [{}]);
  else if (!ds.name) {
    problems.push({
      path: `${path}.data`,
      message: T.check.unknownData(DEFAULT_DS, quoteList([...env.datasets.keys()])),
      level: 'error',
    });
    return null;
  }
  const rows: number[] = [];
  ds.rows.forEach((r, k) => {
    if (!filter || truthy(filter(r))) rows.push(k);
  });
  const weight =
    raw.weight === 'bold' ? 650 : raw.weight === 'normal' ? 400 : typeof raw.weight === 'number' ? raw.weight : undefined;
  model = {
    index,
    path,
    mark,
    ds,
    rows,
    ch,
    placeFields,
    valueFields: [...new Set(c.fields)],
    color: color ?? undefined,
    icon: icon ?? undefined,
    text: text ?? undefined,
    alt: alt ?? undefined,
    title: title ?? undefined,
    label: label ?? undefined,
    dash: dash ?? undefined,
    // De un campo: se escala por área. Un número, una tabla o una condición con números: px fijos.
    sizeField:
      typeof raw.size === 'string' ||
      (isObject(raw.size) && typeof (raw.size as Record<string, unknown>).field === 'string' && !own(raw.size, 'map')),
    tooltip,
    format: raw.format,
    position: POSITIONS.includes(raw.position!) ? raw.position! : 'center',
    dx: num('dx', 0)!,
    dy: num('dy', 0)!,
    opacity: num('opacity'),
    weight,
    curve: raw.curve === 'smooth' ? 'smooth' : 'linear',
    points: raw.points === true,
    area: raw.area === true,
    extremes: raw.extremes === true,
  };
  if (mark === 'spark') model.sparks = sparkGroups(model);
  return model;
}

function readTooltip(c: Ctx, raw: Layer, mark: MarkName, path: string): LayerModel['tooltip'] {
  const t = raw.tooltip;
  if (t === false) return false;
  if (t === undefined || t === true) return t || INTERACTIVE.includes(mark) ? 'auto' : false;
  if (!Array.isArray(t)) {
    c.problems.push({
      path: `${path}.tooltip`,
      message: c.T.check.badChoice('tooltip', 'true, false o una lista'),
      level: 'warning',
    });
    return 'auto';
  }
  const lines: TooltipLine[] = [];
  t.forEach((entry, k) => {
    const p = `${path}.tooltip[${k}]`;
    if (typeof entry === 'string') {
      const run = expr(c, entry, p);
      if (run) lines.push({ label: entry, value: (row, f) => show(run(row), f) });
    } else if (isObject(entry) && typeof entry.label === 'string' && typeof entry.value === 'string') {
      const pieces = template(c, entry.value, `${p}.value`);
      if (pieces)
        lines.push({ label: entry.label, value: (row, f) => fillTemplate(pieces, row, f), format: entry.format as LayerFormat });
    } else {
      c.problems.push({
        path: p,
        message: c.T.check.badChoice('tooltip', '"campo" o { "label": …, "value": "{campo}" }'),
        level: 'warning',
      });
    }
  });
  return lines;
}

const show = (v: unknown, f: (v: unknown) => string) => (v === null || v === undefined ? '–' : f(v));

/** Fila de un modelo: para evaluar con las funciones del modelo desde afuera. */
export function rowOf(L: LayerModel, k: number): Row {
  return L.ds.rows[k];
}

// ------------------------------------------------------------ Ejes

function axis(
  layers: LayerModel[],
  channels: ('x' | 'x2' | 'y' | 'y2')[],
  spec: AxisSpec | undefined,
  which: 'x' | 'y',
): AxisModel | null {
  const values: unknown[] = [];
  let categoryMark = false;
  let valueBar = false;
  const other = which === 'x' ? 'y' : 'x';
  for (const L of layers) {
    for (const k of L.rows) {
      const row = L.ds.rows[k];
      for (const c of channels) {
        const r = L.ch[c];
        if (r) values.push(r(row));
      }
    }
    if (L.mark === 'cell' && L.ch[which]) categoryMark = true;
    if (L.mark === 'bar' && L.ch[which]) {
      // La barra va sobre la categoría y crece en el otro eje; si los dos son números, crece en Y.
      const mine = L.rows.map((k) => L.ch[which]!(L.ds.rows[k]));
      const theirs = L.rows.map((k) => L.ch[other]?.(L.ds.rows[k]));
      const mineNumeric = mine.every((v) => typeof v === 'number');
      const theirsNumeric = theirs.every((v) => typeof v === 'number');
      if (!mineNumeric || (which === 'x' && theirsNumeric)) categoryMark = true;
      else valueBar = true;
    }
  }
  if (!values.length && !spec?.domain) return null;
  const present = values.filter((v) => v !== null && v !== undefined && v !== '');
  let type = spec?.type;
  if (!type) {
    if (categoryMark) type = 'band';
    else if (present.length && present.every((v) => typeof v === 'number')) type = 'linear';
    else if (
      present.length &&
      present.every((v) => v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{1,2}(-\d{1,2})?([T ][\d:.]+Z?)?$/.test(v)))
    )
      type = 'time';
    else type = 'band';
  }
  const model: AxisModel = { type, keys: [], min: NaN, max: NaN, spec: spec ?? {}, zero: valueBar || !!spec?.zero };
  if (type === 'band') {
    const seen = new Set<string>();
    const domain = Array.isArray(spec?.domain) ? spec!.domain.map(bandKey) : [];
    for (const k of domain) if (!seen.has(k)) seen.add(k) && model.keys.push(k);
    for (const v of present) {
      const k = bandKey(v);
      if (!seen.has(k)) {
        seen.add(k);
        model.keys.push(k);
      }
    }
    return model;
  }
  const read = type === 'time' ? parseTime : toNumber;
  let min = Infinity;
  let max = -Infinity;
  for (const v of present) {
    const n = read(v);
    if (!isFinite(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (Array.isArray(spec?.domain) && spec!.domain.length === 2) {
    const [a, b] = spec!.domain.map(read);
    if (isFinite(a)) min = a;
    if (isFinite(b)) max = b;
  }
  if (model.zero && type === 'linear') {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  model.min = min;
  model.max = max;
  return model;
}

/** Valor de una posición en su eje: la clave de la categoría o el número (las fechas en ms). */
export function axisValue(a: AxisModel, v: unknown): string | number {
  if (a.type === 'band') return bandKey(v);
  return a.type === 'time' ? parseTime(v) : toNumber(v);
}

// ------------------------------------------------------------ Color

/** Mínimo y máximo de cada escala de color, por grupo, con las filas que dibuja cada capa. */
function colorDomains(model: Model): void {
  for (const L of model.layers) {
    if (!L.color) continue;
    for (const k of L.rows) {
      const ref = L.color(L.ds.rows[k]);
      if (!ref || typeof ref === 'string') continue;
      const d = ref.scale.domains.get(ref.group);
      if (!d) ref.scale.domains.set(ref.group, [ref.v, ref.v]);
      else {
        if (ref.v < d[0]) d[0] = ref.v;
        if (ref.v > d[1]) d[1] = ref.v;
      }
    }
  }
  for (const s of model.scales) {
    if (s.spec.domain && s.spec.domain.length === 2)
      for (const key of [...s.domains.keys(), '']) s.domains.set(key, [s.spec.domain[0], s.spec.domain[1]]);
  }
}

/**
 * Posición de un valor en su escala, de 0 (lo peor) a 1 (lo mejor) en el semáforo, o de 0 a 1
 * (secuencial) y de −1 a 1 (divergente). Con umbrales, el centro de su tramo.
 */
export function scalePosition(s: ColorScaleModel, v: number, group: string): number {
  if (s.thresholds) {
    let bin = 0;
    while (bin < s.thresholds.length && v >= s.thresholds[bin]) bin++;
    const p = s.thresholds.length ? bin / s.thresholds.length : 0.5;
    return s.better === 'low' ? 1 - p : p;
  }
  const d = s.domains.get(group) ?? s.domains.get('') ?? [v, v];
  if (s.kind === 'diverging') {
    const m = Math.max(Math.abs(d[0]), Math.abs(d[1]));
    return m > 0 ? Math.max(-1, Math.min(1, v / m)) : 0;
  }
  // Todos iguales: al centro de la escala (ni bien ni mal).
  const p = d[1] > d[0] ? Math.max(0, Math.min(1, (v - d[0]) / (d[1] - d[0]))) : 0.5;
  return s.better === 'low' && s.kind === 'traffic-light' ? 1 - p : p;
}

// ------------------------------------------------------------ Minigráficos

/**
 * Las series de un minigráfico: las filas de cada celda (misma x, misma y), en el orden de su
 * periodo si todos son números o fechas, o en el de los datos si son textos ("ene", "feb").
 */
function sparkGroups(L: LayerModel): number[][] {
  const groups = new Map<string, number[]>();
  for (const k of L.rows) {
    const row = L.ds.rows[k];
    const key = `${bandKey(L.ch.x?.(row))}\u0000${bandKey(L.ch.y?.(row))}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(k);
  }
  const period = L.ch.period;
  const out = [...groups.values()];
  if (!period) return out;
  const all = L.rows.map((k) => period(L.ds.rows[k]));
  const numeric = all.every((v) => typeof v === 'number' || v instanceof Date);
  const dates = !numeric && all.every((v) => typeof v === 'string' && /^\d{4}-\d{1,2}(-\d{1,2})?$/.test(v));
  if (!numeric && !dates) return out;
  const read = (k: number) => (dates ? parseTime(period(L.ds.rows[k])) : toNumber(period(L.ds.rows[k])));
  return out.map((g) => g.slice().sort((a, b) => read(a) - read(b)));
}

// ------------------------------------------------------------ Datos que se recorren

function buildItems(model: Model): void {
  for (const L of model.layers) {
    if (L.sparks) {
      // Un minigráfico es un solo dato: todas sus filas llevan al mismo.
      for (const g of L.sparks) {
        const keys = g.map((k) => `${L.ds.name}\u0000${k}`);
        let i = keys.map((k) => model.itemOf.get(k)).find((x) => x !== undefined);
        if (i === undefined) {
          i = model.items.length;
          model.items.push({ ds: L.ds, row: g[0], layers: [] });
        }
        for (const key of keys) model.itemOf.set(key, i);
        model.items[i].layers.push(L);
        model.items[i].spark = g;
      }
      continue;
    }
    for (const k of L.rows) {
      const key = `${L.ds.name}\u0000${k}`;
      let i = model.itemOf.get(key);
      if (L.tooltip === false && i === undefined) continue;
      if (i === undefined) {
        i = model.items.length;
        model.items.push({ ds: L.ds, row: k, layers: [] });
        model.itemOf.set(key, i);
      }
      model.items[i].layers.push(L);
    }
  }
  // Las capas que solo acompañan (un texto sobre una celda) también pertenecen al dato de su fila.
  // El orden de las capas de cada dato queda como en la especificación.
  for (const it of model.items) it.layers.sort((a, b) => a.index - b.index);
}

/** La primera capa con tooltip que dibuja el dato: la que da su forma, su color y su encabezado. */
export function mainLayer(item: Item): LayerModel {
  return item.layers.find((L) => L.tooltip !== false) ?? item.layers[0];
}

/** Texto de una expresión, para quien la quiera mostrar (por ejemplo, el editor). */
export function describeExpr(src: string, locale?: string): string[] {
  return fieldsOf(parse(src, locale));
}

export { evaluate };
