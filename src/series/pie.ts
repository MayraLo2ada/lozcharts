/**
 * LozPie y LozDonut: porciones de un total, una por fila de datos.
 *
 * Empiezan arriba (−90°) y avanzan en sentido horario, en el orden de los datos. Entre
 * porciones hay 2 px de aire (un trazo del color de la superficie, no un borde de color).
 * El donut lleva en el centro el total visible. Las etiquetas van afuera, con una línea guía
 * de 1 px, repartidas a izquierda y derecha y empujadas para que nunca se encimen; las que no
 * caben se omiten (el tooltip y la tabla las siguen mostrando).
 *
 * Toda la geometría (ángulos, hit-test, reparto de etiquetas) son funciones puras exportadas.
 */
import type { DrawContext, PreparedSeries, SeriesImpl, TooltipFormat, TooltipValue } from '../core/series';
import { attrs, esc } from '../core/dom';
import { r2, polarPoint } from '../core/shapes';
import { fitText } from '../core/axis';

/** Arranque arriba; en SVG la Y crece hacia abajo, así que sumar ángulo es ir en sentido horario. */
const START = -Math.PI / 2;
const TAU = 2 * Math.PI;
/** Aire entre porciones: el trazo de superficie se reparte 1 px a cada lado del borde. */
const GAP = 2;
/** Con etiquetas, el pie conserva al menos esta fracción del radio que tendría sin ellas. */
const MIN_LABELED_SHARE = 0.6;
const DONUT_HOLE = 0.6;
/** Desplazamiento hacia afuera de la porción activa; se reserva siempre para que no se corte. */
const HOVER_OFFSET = 6;
/** Margen del pie respecto al borde del área cuando no hay etiquetas. */
const EDGE = 2;

// Etiquetas.
const FONT = 12;
/** Separación vertical mínima entre etiquetas del mismo lado. */
export const LABEL_GAP = 16;
/** Tramo radial de la línea guía, desde el borde de la porción hasta el codo. */
const ELBOW = 12;
/** Tramo horizontal de la guía después del codo. */
const RUN = 10;
/** Aire entre el final de la guía y el texto. */
const TEXT_PAD = 4;
/** Radio mínimo aceptable con etiquetas; por debajo se recortan y, si no basta, se quitan. */
const MIN_RADIUS = 48;
/** Muestra de porcentaje para reservar ancho estable mientras se anima (cifras tabulares). */
const PERCENT_SAMPLE = '88,8 %';

// Centro del donut.
const TOTAL_MAX = 28;
const TOTAL_MIN = 14;
const CAPTION = 'Total';
/** El total solo cabe si el agujero tiene al menos este radio. */
const HOLE_MIN_FOR_TOTAL = 28;

/** Una porción en radianes: [start, end), con start ≤ end. */
export interface Slice {
  start: number;
  end: number;
}

/**
 * Ángulos de cada porción. Los valores no finitos (huecos) y los negativos cuentan como cero:
 * un pie no puede mostrar partes negativas. Si todo suma cero, todas las porciones miden cero.
 */
export function sliceAngles(values: readonly number[]): Slice[] {
  const clean = values.map((v) => (isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((a, b) => a + b, 0);
  const out: Slice[] = [];
  let acc = 0;
  for (const v of clean) {
    const start = START + (total > 0 ? (acc / total) * TAU : 0);
    acc += v;
    const end = START + (total > 0 ? (acc / total) * TAU : 0);
    out.push({ start, end });
  }
  return out;
}

/** Parte de la porción i sobre el total de las visibles (0 a 1); 0 si está oculta o no hay total. */
export function visibleShare(values: readonly number[], i: number, isHidden: (i: number) => boolean): number {
  let total = 0;
  for (let k = 0; k < values.length; k++) if (!isHidden(k) && isFinite(values[k]) && values[k] > 0) total += values[k];
  const v = values[i];
  return total > 0 && !isHidden(i) && isFinite(v) && v > 0 ? v / total : 0;
}

/**
 * Índice de la porción bajo (px, py), o -1 fuera del anillo, en el agujero o sobre una
 * porción de tamaño cero. `inner` y `outer` son radios en px.
 */
export function hitSlice(
  slices: readonly Slice[],
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  px: number,
  py: number,
): number {
  const dist = Math.hypot(px - cx, py - cy);
  if (dist > outer || dist < inner) return -1;
  // Ángulo del puntero llevado al mismo rango que las porciones: [START, START + 2π).
  let a = Math.atan2(py - cy, px - cx);
  while (a < START) a += TAU;
  while (a >= START + TAU) a -= TAU;
  for (let i = 0; i < slices.length; i++) {
    const { start, end } = slices[i];
    if (end > start && a >= start && a < end) return i;
  }
  return -1;
}

/** Una etiqueta candidata: dónde querría ir y cuánto pesa su porción (para decidir cuál se omite). */
export interface LabelCandidate {
  index: number;
  side: 'left' | 'right';
  /** Altura deseada (la del codo de su guía). */
  y: number;
  weight: number;
}

export interface PlacedLabel extends LabelCandidate {
  /** Altura final, ya separada de sus vecinas. */
  ly: number;
}

/**
 * Reparte las etiquetas de un lado para que queden al menos `gap` px entre vecinas sin salir
 * de [top, bottom]. Si no caben todas, omite las de menor peso. Luego:
 * 1. Ordena por altura deseada.
 * 2. De arriba hacia abajo, empuja cada una al menos `gap` por debajo de la anterior.
 * 3. Si la última se salió por abajo, de abajo hacia arriba sube cada una lo necesario.
 * El paso 3 solo baja valores y garantiza la separación; el control de capacidad del principio
 * garantiza que la primera no quede por encima de `top`.
 */
function placeSide(items: LabelCandidate[], gap: number, top: number, bottom: number): PlacedLabel[] {
  if (bottom < top) return [];
  const capacity = Math.floor((bottom - top) / gap + 1e-9) + 1;
  let kept = items;
  if (kept.length > capacity) {
    kept = kept
      .slice()
      .sort((a, b) => b.weight - a.weight || a.index - b.index)
      .slice(0, capacity);
  }
  const placed: PlacedLabel[] = kept
    .slice()
    .sort((a, b) => a.y - b.y || a.index - b.index)
    .map((c) => ({ ...c, ly: c.y }));
  for (let k = 0; k < placed.length; k++) {
    const floor = k === 0 ? top : placed[k - 1].ly + gap;
    placed[k].ly = Math.max(placed[k].ly, floor);
  }
  for (let k = placed.length - 1; k >= 0; k--) {
    const ceil = k === placed.length - 1 ? bottom : placed[k + 1].ly - gap;
    placed[k].ly = Math.min(placed[k].ly, ceil);
  }
  return placed;
}

/** Reparte las etiquetas de los dos lados por separado (cada lado es una columna de texto). */
export function layoutLabels(candidates: readonly LabelCandidate[], gap: number, top: number, bottom: number): PlacedLabel[] {
  const left = candidates.filter((c) => c.side === 'left');
  const right = candidates.filter((c) => c.side === 'right');
  return [...placeSide(left, gap, top, bottom), ...placeSide(right, gap, top, bottom)];
}

/**
 * Trazo de una porción entre los radios `inner` y `outer`. Con inner 0 es una cuña; una porción
 * de vuelta completa se dibuja como dos círculos (evenodd) para no dejar una costura arriba.
 */
export function slicePath(cx: number, cy: number, inner: number, outer: number, start: number, end: number): string {
  const span = end - start;
  if (!(span > 0) || !(outer > inner)) return '';
  const ro = r2(outer);
  const ri = r2(inner);
  if (span >= TAU - 1e-6) {
    const circle = (r: number) =>
      `M${r2(cx - r)},${r2(cy)}a${r2(r)},${r2(r)} 0 1 0 ${r2(2 * r)},0a${r2(r)},${r2(r)} 0 1 0 ${r2(-2 * r)},0Z`;
    return circle(outer) + (inner > 0 ? circle(inner) : '');
  }
  const large = span > Math.PI ? 1 : 0;
  const [x0, y0] = polarPoint(cx, cy, outer, start);
  const [x1, y1] = polarPoint(cx, cy, outer, end);
  let d = `M${r2(x0)},${r2(y0)}A${ro},${ro} 0 ${large} 1 ${r2(x1)},${r2(y1)}`;
  if (inner > 0) {
    const [x2, y2] = polarPoint(cx, cy, inner, end);
    const [x3, y3] = polarPoint(cx, cy, inner, start);
    d += `L${r2(x2)},${r2(y2)}A${ri},${ri} 0 ${large} 0 ${r2(x3)},${r2(y3)}`;
  } else d += `L${r2(cx)},${r2(cy)}`;
  return d + 'Z';
}

/** Todo lo que necesitan draw, hit, anchor y hover, calculado del mismo modo en cada llamada. */
interface Geometry {
  cx: number;
  cy: number;
  outer: number;
  inner: number;
  slices: Slice[];
  /** Etiqueta (nombre y porcentaje) de cada porción, o null si las etiquetas están apagadas o no caben. */
  labelText: ((i: number) => string) | null;
}

function geometry(ctx: DrawContext, defaultHole: number): Geometry {
  const { width: w, height: h, frame } = ctx;
  const opts = frame.ps.options;
  const hole = Math.max(0, Math.min(0.95, opts.innerRadius ?? defaultHole));
  const cx = w / 2;
  const cy = h / 2;
  const slices = sliceAngles(frame.y1);
  const plain = Math.max(0, Math.min(w, h) / 2 - HOVER_OFFSET - EDGE);
  const done = (outer: number, labelText: Geometry['labelText']): Geometry => ({
    cx,
    cy,
    outer,
    inner: outer * hole,
    slices,
    labelText,
  });
  if (opts.labels === false) return done(plain, null);

  // El ancho reservado sale de los valores finales y una muestra fija de porcentaje, no del cuadro
  // animado: así el radio no tiembla mientras las porciones crecen.
  const names: string[] = [];
  for (let i = 0; i < ctx.n; i++) {
    const v = frame.ps.values[i];
    if (!ctx.isHidden(i) && isFinite(v) && v > 0) names.push(ctx.label(i));
  }
  if (!names.length) return done(plain, null);
  const sampleW = ctx.measure(' ' + PERCENT_SAMPLE);
  const longestName = Math.max(...names.map((s) => ctx.measure(s)));
  const longest = longestName + sampleW;
  // Lo que ocupa la guía más el texto a cada lado del pie.
  const reach = HOVER_OFFSET + ELBOW + RUN + TEXT_PAD;
  const vertical = h / 2 - HOVER_OFFSET - ELBOW - FONT / 2;
  // Primero, el radio con las etiquetas completas; si queda chico, se recortan los nombres.
  let nameMax = longestName;
  let outer = Math.min(w / 2 - reach - longest - EDGE, vertical);
  if (outer < MIN_RADIUS) {
    nameMax = w / 2 - reach - EDGE - MIN_RADIUS - sampleW;
    outer = Math.min(MIN_RADIUS, vertical);
  }
  // Sin etiquetas si no caben (mejor que cortadas) o si achicarían demasiado el pie (en pantallas
  // angostas): la leyenda, el tooltip y la tabla ya dicen lo mismo.
  if (nameMax < ctx.measure('M…') || outer < MIN_RADIUS / 2 || outer < plain * MIN_LABELED_SHARE) return done(plain, null);
  const labelText = (i: number) => {
    // Con los valores animados (las ocultas se van encogiendo): las etiquetas acompañan a las
    // porciones durante la animación en vez de saltar a su porcentaje final.
    const share = visibleShare(frame.y1, i, () => false);
    return fitText(ctx.label(i), nameMax, ctx.measure) + ' ' + ctx.percent(share);
  };
  return done(outer, labelText);
}

/** Etiquetas afuera con su guía de 1 px. Texto en color secundario, nunca del color de la serie. */
function labels(ctx: DrawContext, g: Geometry): string {
  if (!g.labelText) return '';
  const { cx, cy, outer, slices } = g;
  const candidates: LabelCandidate[] = [];
  for (let i = 0; i < slices.length; i++) {
    const { start, end } = slices[i];
    if (!(end > start)) continue;
    const mid = (start + end) / 2;
    candidates.push({
      index: i,
      side: Math.cos(mid) >= 0 ? 'right' : 'left',
      y: polarPoint(cx, cy, outer + HOVER_OFFSET + ELBOW, mid)[1],
      weight: end - start,
    });
  }
  const half = FONT / 2;
  const placed = layoutLabels(candidates, LABEL_GAP, half, ctx.height - half);
  const th = ctx.theme;
  let guides = '';
  let texts = '';
  for (const p of placed) {
    const { start, end } = slices[p.index];
    const mid = (start + end) / 2;
    const dir = p.side === 'right' ? 1 : -1;
    const [x0, y0] = polarPoint(cx, cy, outer + 2, mid);
    // El codo se desliza por el anillo de las guías hasta la altura de su etiqueta: así las
    // diagonales salen casi radiales y no se cruzan con las vecinas al empujarlas.
    const ring = outer + HOVER_OFFSET + ELBOW;
    const elbowX = cx + dir * Math.sqrt(Math.max(0, ring * ring - (p.ly - cy) ** 2));
    // Todas las guías de un lado terminan en la misma columna: el texto queda alineado.
    const endX = cx + dir * (outer + HOVER_OFFSET + ELBOW + RUN);
    guides += `M${r2(x0)},${r2(y0)}L${r2(elbowX)},${r2(p.ly)}H${r2(endX)}`;
    texts += `<text${attrs({
      x: r2(endX + dir * TEXT_PAD),
      y: r2(p.ly),
      fill: th.textMuted,
      'font-size': FONT,
      'text-anchor': dir > 0 ? 'start' : 'end',
      'dominant-baseline': 'central',
      'font-variant-numeric': 'tabular-nums',
    })}>${esc(g.labelText(p.index))}</text>`;
  }
  const path = guides
    ? `<path${attrs({ d: guides, fill: 'none', stroke: th.textMuted, 'stroke-width': 1, 'stroke-opacity': 0.6 })}/>`
    : '';
  return path + texts;
}

/** Total visible en el centro del donut, en el texto principal, y "Total" debajo en secundario. */
function centerTotal(ctx: DrawContext, g: Geometry): string {
  if (g.inner < HOLE_MIN_FOR_TOTAL) return '';
  let total = 0;
  for (const v of ctx.frame.y1) if (isFinite(v) && v > 0) total += v;
  const text = ctx.format(total);
  // measure() mide a 12 px: el tamaño se escala para que el número quepa en el 80 % del agujero.
  const fit = (g.inner * 2 * 0.8 * FONT) / Math.max(1, ctx.measure(text));
  const size = Math.min(TOTAL_MAX, fit, g.inner * 0.5);
  if (size < TOTAL_MIN) return '';
  const th = ctx.theme;
  const common = { x: r2(g.cx), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-variant-numeric': 'tabular-nums' };
  return (
    `<text${attrs({ ...common, y: r2(g.cy - FONT / 2), fill: th.text, 'font-size': r2(size), 'font-weight': 600 })}>${esc(text)}</text>` +
    `<text${attrs({ ...common, y: r2(g.cy + size / 2 + 4), fill: th.textMuted, 'font-size': FONT })}>${CAPTION}</text>`
  );
}

/** Porción con el trazo de superficie que hace de aire entre vecinas. */
function sliceMarkup(ctx: DrawContext, g: Geometry, i: number, outer: number, dx = 0, dy = 0, ring = GAP): string {
  const { start, end } = g.slices[i];
  const d = slicePath(g.cx + dx, g.cy + dy, g.inner, outer, start, end);
  if (!d) return '';
  return `<path${attrs({
    d,
    fill: ctx.pointColor(i),
    'fill-rule': 'evenodd',
    stroke: ctx.theme.surface,
    'stroke-width': ring,
    'stroke-linejoin': 'round',
  })}/>`;
}

function radial(defaultHole: number, label: string): SeriesImpl {
  return {
    coords: 'free',
    legendBy: 'points',
    // Las porciones nacen en cero: el dominio debe incluirlo para que la animación parta de ahí.
    includeZero: true,
    items: ['categoría', 'categorías'],
    legendSymbol: 'square',
    label,
    draw(ctx) {
      const g = geometry(ctx, defaultHole);
      if (!(g.outer > 0)) return '';
      let s = '';
      for (let i = 0; i < g.slices.length; i++) s += sliceMarkup(ctx, g, i, g.outer);
      if (!s) {
        // Todo en cero (inicio de la animación o todo oculto): anillo vacío del color de la rejilla.
        const d = g.inner > 0 ? slicePath(g.cx, g.cy, g.inner, g.outer, 0, TAU) : '';
        s = d
          ? `<path${attrs({ d, fill: ctx.theme.grid, 'fill-rule': 'evenodd' })}/>`
          : `<circle${attrs({ cx: r2(g.cx), cy: r2(g.cy), r: r2(g.outer - 0.5), fill: 'none', stroke: ctx.theme.grid, 'stroke-width': 1 })}/>`;
      }
      return s + labels(ctx, g) + (g.inner > 0 ? centerTotal(ctx, g) : '');
    },
    hit(ctx, px, py) {
      const g = geometry(ctx, defaultHole);
      // El borde exterior admite el desplazamiento del hover: la porción activa no se pierde al salir.
      return hitSlice(g.slices, g.cx, g.cy, g.inner, g.outer + HOVER_OFFSET, px, py);
    },
    anchor(ctx, i) {
      const g = geometry(ctx, defaultHole);
      const s = g.slices[i];
      const mid = s ? (s.start + s.end) / 2 : START;
      return polarPoint(g.cx, g.cy, g.outer + HOVER_OFFSET, mid);
    },
    hover(ctx, i) {
      const g = geometry(ctx, defaultHole);
      const s = g.slices[i];
      if (!s || !(s.end > s.start)) return '';
      // Una porción que es todo el círculo no tiene hacia dónde salir: se agranda en su lugar.
      const whole = s.end - s.start >= TAU - 1e-6;
      const [dx, dy] = whole ? [0, 0] : polarPoint(0, 0, HOVER_OFFSET, (s.start + s.end) / 2);
      const outer = whole ? g.outer + HOVER_OFFSET / 2 : g.outer;
      // Primero se tapa su lugar con la superficie: la porción sale y deja el hueco, sin sombra doble.
      const { start, end } = s;
      const d = whole ? '' : slicePath(g.cx, g.cy, g.inner, g.outer, start, end);
      const hole = d ? `<path${attrs({ d, fill: ctx.theme.surface, stroke: ctx.theme.surface, 'stroke-width': GAP })}/>` : '';
      return hole + sliceMarkup(ctx, g, i, outer, dx, dy, GAP * 2);
    },
    tooltip: sliceTooltip,
  };
}

/** Valor exacto y su parte del total visible: "48.210 (31,2 %)". */
export function sliceTooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue {
  const v = ps.values[i];
  if (!isFinite(v)) return { value: 'Sin dato' };
  if (format.isHidden(i)) return { value: format.value(v) };
  return { value: `${format.value(v)} (${format.percent(visibleShare(ps.values, i, format.isHidden))})` };
}

export const pie: SeriesImpl = radial(0, 'sectores');
export const donut: SeriesImpl = radial(DONUT_HOLE, 'anillo');
