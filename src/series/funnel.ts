/**
 * Embudo (LozFunnel): una barra horizontal centrada por etapa, de arriba abajo, en el orden
 * de los datos (Visitas → Carrito → Pago → Compra).
 *
 * Barras rectas y no trapecios: en un trapecio el lector compara pendientes y áreas, que
 * engañan; con barras centradas compara largos sobre un eje común de simetría, que es la
 * lectura más precisa. Todas llevan el color de la serie: la etapa la dice la etiqueta.
 *
 * Etiquetas: el nombre a la izquierda; a la derecha el valor y su porcentaje del inicio; y en
 * una columna propia, a la altura del borde entre dos filas, la conversión de un paso al
 * siguiente ("↓ 44 %"): así no se confunde con el porcentaje de la fila de arriba.
 */
import {
  dimmed,
  dimOpacity,
  DIM_OPACITY,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { attrs, esc } from '../core/dom';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';
import { maxOf } from './common';

/** Separación entre barras vecinas (espacio, no borde). */
const GAP = 2;
const RADIUS = 4;
/** Alto máximo de una fila: con pocas etapas el bloque se centra en vez de engordar. */
const MAX_ROW = 64;
/** Debajo de este alto de fila no caben las etiquetas de 12 px sin encimarse. */
const MIN_ROW_LABELS = 14;
/** Alto de fila desde el que cabe la conversión en el borde, entre dos valores. */
const MIN_ROW_CONVERSION = 30;
/** El nombre ocupa como máximo esta fracción del ancho y se recorta con "…" (como en barras horizontales). */
const MAX_NAME_SHARE = 0.4;
/** Las barras deben conservar al menos esta fracción del ancho; si no, se sueltan etiquetas. */
const MIN_BAR_SHARE = 0.3;
/** Aire entre las etiquetas y la zona de barras, y entre valor y porcentaje. */
const PAD = 8;
const INNER = 6;
const FONT_SIZE = 12;
const SMALL_FONT = 11;

/** Proporción a / b, o NaN si no se puede calcular (base cero, negativa o faltante). */
export function ratio(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b) || b <= 0) return NaN;
  return Math.max(0, a) / b;
}

/** Porcentaje de cada etapa respecto de la primera y respecto de la anterior (NaN en la primera). */
export function conversions(values: readonly number[]): { fromStart: number[]; fromPrev: number[] } {
  const first = values[0];
  return {
    fromStart: values.map((v) => ratio(v, first)),
    fromPrev: values.map((v, i) => (i === 0 ? NaN : ratio(v, values[i - 1]))),
  };
}

/** La etapa mayor (referencia de los anchos); 0 si no hay valores positivos. */
export function stageMax(values: readonly number[]): number {
  let max = 0;
  for (const v of values) if (isFinite(v) && v > max) max = v;
  return max;
}

/** Ancho de la barra de un valor, proporcional a la etapa mayor y acotado al área. */
export function barWidth(v: number, max: number, area: number): number {
  if (!isFinite(v) || v <= 0 || max <= 0 || area <= 0) return 0;
  return Math.min(area, (v / max) * area);
}

/**
 * Porcentaje entero con espacio fino ("42 %"). Entero porque en un embudo importa el orden de
 * magnitud y así no depende del separador decimal del idioma; el tooltip da el valor exacto.
 */
export function percentLabel(p: number, percent: (v: number) => string): string {
  if (!isFinite(p)) return '';
  if (p > 0 && p < 0.01) return '<' + percent(0.01);
  return percent(Math.round(p * 100) / 100);
}

/** Anchos medidos de las etiquetas (el máximo de todas las etapas). */
export interface LabelWidths {
  name: number;
  value: number;
  percent: number;
  conversion: number;
}

export interface FunnelLayout {
  /** Borde superior de la primera fila y alto de cada fila (incluye los 2 px de separación). */
  top: number;
  rowH: number;
  /** Zona de las barras: desde `areaX`, `areaW` de ancho, centradas en `center`. */
  areaX: number;
  areaW: number;
  center: number;
  /** Ancho disponible para el nombre (0 sin etiquetas) y X donde empieza la columna derecha. */
  nameW: number;
  valueX: number;
  /** X donde terminan los valores (alineados a la derecha, como una columna de tabla) y empiezan los porcentajes. */
  valueEnd: number;
  /** X de la columna de conversiones. */
  conversionX: number;
  showLabels: boolean;
  showPercent: boolean;
  showConversion: boolean;
}

/**
 * Reparte el área: filas de alto igual (con tope y centradas) y columnas de etiquetas medidas.
 * Si las barras quedarían muy angostas, se sueltan etiquetas en orden de prioridad:
 * nombre y valor > porcentaje > conversión.
 */
export function funnelLayout(width: number, height: number, n: number, labels: LabelWidths | null): FunnelLayout {
  const rowH = n > 0 ? Math.min(MAX_ROW, height / n) : 0;
  const top = (height - rowH * n) / 2;
  const showLabels = labels !== null && rowH >= MIN_ROW_LABELS;
  let showPercent = showLabels && labels.percent > 0;
  let showConversion = showLabels && rowH >= MIN_ROW_CONVERSION && labels.conversion > 0;
  let nameW = 0;
  let right = 0;
  if (showLabels) {
    nameW = Math.min(labels.name, width * MAX_NAME_SHARE);
    const rightCol = () =>
      labels.value + (showPercent ? INNER + labels.percent : 0) + (showConversion ? PAD + labels.conversion : 0);
    const fits = () => width - (nameW + PAD) - (rightCol() + PAD) >= width * MIN_BAR_SHARE;
    if (!fits()) showPercent = false;
    if (!fits()) showConversion = false;
    right = rightCol();
  }
  const left = showLabels ? nameW + PAD : 0;
  const areaW = Math.max(0, width - left - (showLabels ? right + PAD : 0));
  return {
    top,
    rowH,
    areaX: left,
    areaW,
    center: left + areaW / 2,
    nameW,
    valueX: left + areaW + PAD,
    valueEnd: left + areaW + PAD + (showLabels ? labels.value : 0),
    conversionX: left + areaW + PAD + (showLabels ? labels.value + (showPercent ? INNER + labels.percent : 0) + PAD : 0),
    showLabels,
    showPercent,
    showConversion,
  };
}

/** Fila bajo `py` (todo el ancho de la fila, no solo la barra), o -1. */
export function rowAt(py: number, top: number, rowH: number, n: number): number {
  if (rowH <= 0 || py < top) return -1;
  const i = Math.floor((py - top) / rowH);
  return i < n ? i : -1;
}

/** Rectángulo con las cuatro esquinas redondeadas (el radio se achica si la barra es corta). */
export function roundedBar(x: number, y: number, w: number, h: number, radius: number): string {
  if (w < 0.01 || h < 0.01) return '';
  const r = Math.min(radius, w / 2, h / 2);
  const x1 = x + w;
  const y1 = y + h;
  const a = (ex: number, ey: number) => `A${r2(r)},${r2(r)} 0 0 1 ${r2(ex)},${r2(ey)}`;
  return (
    `M${r2(x + r)},${r2(y)}H${r2(x1 - r)}${a(x1, y + r)}V${r2(y1 - r)}${a(x1 - r, y1)}` +
    `H${r2(x + r)}${a(x, y1 - r)}V${r2(y + r)}${a(x + r, y)}Z`
  );
}

type StageTexts = { names: string[]; values: string[]; shares: string[]; steps: string[] };

/** Textos ya formateados por conjunto de datos: no se reformatean en cada cuadro de la animación. */
const textCache = new WeakMap<readonly number[], StageTexts>();

/** Textos de cada etapa con los valores finales (no los animados): el layout no salta al animar. */
function stageTexts(ctx: DrawContext): StageTexts {
  const values = ctx.frame.ps.values;
  const cached = textCache.get(values);
  if (cached) return cached;
  const { fromStart, fromPrev } = conversions(values);
  const texts: StageTexts = {
    names: values.map((_, i) => ctx.label(i)),
    values: values.map((v) => (isFinite(v) ? ctx.format(v) : '')),
    shares: fromStart.map((p) => percentLabel(p, ctx.percent)),
    steps: fromPrev.map((p) => (isFinite(p) ? '↓ ' + percentLabel(p, ctx.percent) : '')),
  };
  textCache.set(values, texts);
  return texts;
}

/** Layout del contexto: mide las etiquetas solo si están encendidas. */
function layoutOf(ctx: DrawContext): { L: FunnelLayout; texts: StageTexts | null } {
  if (ctx.frame.ps.options.labels === false) return { L: funnelLayout(ctx.width, ctx.height, ctx.n, null), texts: null };
  const texts = stageTexts(ctx);
  const widest = (list: string[]) =>
    maxOf(
      list.map((s) => (s ? ctx.measure(s) : 0)),
      0,
    );
  const widths: LabelWidths = {
    name: widest(texts.names),
    value: widest(texts.values),
    percent: widest(texts.shares),
    conversion: widest(texts.steps),
  };
  return { L: funnelLayout(ctx.width, ctx.height, ctx.n, widths), texts };
}

/** Ancho animado de la barra i (crece desde el centro); `max` es la etapa mayor, calculada una vez. */
function widthAt(ctx: DrawContext, L: FunnelLayout, i: number, max: number): number {
  return barWidth(ctx.frame.y1[i], max, L.areaW);
}

function text(x: number, y: number, s: string, fill: string, extra: Record<string, string | number> = {}): string {
  return `<text${attrs({ x: r2(x), y: r2(y), fill, 'font-size': FONT_SIZE, 'dominant-baseline': 'central', ...extra })}>${esc(s)}</text>`;
}

export const funnel: SeriesImpl = {
  coords: 'free',
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'embudo',
  items: ['etapa', 'etapas'],
  dimmable: true,
  draw(ctx) {
    const { L, texts } = layoutOf(ctx);
    const th = ctx.theme;
    const max = stageMax(ctx.frame.ps.values);
    let d = '';
    let faded = '';
    let labels = '';
    for (let i = 0; i < ctx.n; i++) {
      const y = L.top + i * L.rowH;
      const dim = dimOpacity(ctx, i);
      const row = labels.length;
      const mid = y + (L.rowH - GAP) / 2;
      const w = widthAt(ctx, L, i, max);
      if (dim) faded += roundedBar(L.center - w / 2, y, w, L.rowH - GAP, RADIUS);
      else d += roundedBar(L.center - w / 2, y, w, L.rowH - GAP, RADIUS);
      if (!texts || !L.showLabels) continue;
      // Si ni una letra cabe, mejor sin nombre que un "…" suelto.
      const fitted = fitText(texts.names[i], L.nameW, ctx.measure);
      const name = fitted === '…' ? '' : fitted;
      if (name) labels += text(0, mid, name, th.textMuted);
      const value = texts.values[i];
      if (value) {
        labels += text(L.valueEnd, mid, value, th.text, { 'text-anchor': 'end' });
        if (L.showPercent && texts.shares[i]) {
          labels += text(L.valueEnd + INNER, mid, texts.shares[i], th.textMuted);
        }
        // La conversión, en su columna, a la altura del borde entre esta fila y la anterior.
        if (L.showConversion && texts.steps[i]) {
          labels += text(L.conversionX, y - GAP / 2, texts.steps[i], th.textMuted, { 'font-size': SMALL_FONT });
        }
      }
      // Los textos de una etapa atenuada se atenúan con ella.
      if (dim) labels = labels.slice(0, row) + dimmed(ctx, i, labels.slice(row));
    }
    const bars = d ? `<path${attrs({ d, fill: ctx.color })}/>` : '';
    const dims = faded ? `<path${attrs({ d: faded, fill: ctx.color, opacity: DIM_OPACITY })}/>` : '';
    return dims + bars + labels;
  },
  hit(ctx, _px, py) {
    const { L } = layoutOf(ctx);
    return rowAt(py, L.top, L.rowH, ctx.n);
  },
  anchor(ctx, i) {
    const { L } = layoutOf(ctx);
    return [L.center + widthAt(ctx, L, i, stageMax(ctx.frame.ps.values)) / 2, L.top + i * L.rowH + (L.rowH - GAP) / 2];
  },
  hover(ctx, i) {
    const { L } = layoutOf(ctx);
    if (i < 0 || i >= ctx.n) return '';
    const a = {
      x: 0,
      y: r2(L.top + i * L.rowH),
      width: r2(ctx.width),
      height: r2(L.rowH - GAP),
      fill: ctx.theme.highlight,
      rx: 4,
    };
    return `<rect${attrs(a)}/>`;
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const v = ps.values[i];
    if (!isFinite(v)) return null;
    const { fromStart, fromPrev } = conversions(ps.values);
    const details: [string, string][] = [];
    if (isFinite(fromStart[i])) details.push(['Del inicio', format.percent(fromStart[i])]);
    if (i > 0 && isFinite(fromPrev[i])) details.push(['Del paso anterior', format.percent(fromPrev[i])]);
    return { value: format.value(v), details: details.length ? details : undefined };
  },
};
