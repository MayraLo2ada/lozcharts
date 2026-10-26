/**
 * Mapa de calor (LozHeatmap): una celda por fila de datos, en formato largo
 * ({ hora: '09:00', dia: 'Lunes', visitas: 120 }). La X da la columna y `y` da la fila.
 *
 * - Columnas: los valores de la X sin repetir, en el orden de los datos (con X de tiempo o
 *   números el núcleo ya los ordenó); se rotulan con el texto corto del eje. Filas: los valores
 *   de `y` en orden de aparición.
 * - Una celda que falta no se dibuja: se ve la superficie. Si dos filas de datos caen en la
 *   misma celda, gana la última (la anterior no se dibuja ni se recorre con el teclado).
 * - Color: un solo tono, el de la serie, mezclado en OKLab desde la superficie (así funciona en
 *   claro y en oscuro). Si hay negativos, escala divergente: los negativos hacia el segundo
 *   color de la paleta, el cero en un gris neutro. Nunca arcoíris: el arcoíris inventa bordes
 *   donde no los hay y no se lee en orden.
 *
 * Toda la geometría (rejilla, colores, contraste, hit-test, etiquetas) son funciones puras.
 */
import {
  dimOpacity,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { attrs, esc } from '../core/dom';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';
import {
  type Domain,
  type LegendSpec,
  type Paint,
  type Ramp,
  colorDomain,
  legendSpec,
  legendWidth,
  makeRamp,
  paint,
  paintColor,
  position,
  textOn,
} from '../core/color';
import { maxOf } from './common';

/** Separación entre celdas vecinas (regla de 2 px entre rellenos). */
const GAP = 2;
/** Con celdas de menos de esto (un calendario de 52 semanas en un teléfono), el aire baja a 1 px: si no, se come la mitad del dato. */
const TIGHT_PITCH = 6;
const RADIUS = 2;
/** Alto máximo de una fila: con pocas filas el bloque se centra en vez de engordar. */
const MAX_PITCH_Y = 48;
const FONT = 12;
const SMALL_FONT = 11;
/** Las etiquetas de fila ocupan como máximo esta fracción del ancho y se recortan con "…". */
const MAX_ROW_SHARE = 0.3;
/** Aire entre las etiquetas de fila y la rejilla, y entre la rejilla y las de columna. */
const PAD = 8;
const COL_GAP = 6;
/** Separación mínima entre dos etiquetas de columna, y alto mínimo de fila por etiqueta. */
const LABEL_SPACING = 12;
const ROW_LABEL_PITCH = 14;
/** Una celda lleva su valor si el texto cabe con 4 px por lado y la celda mide al menos esto de alto. */
const VALUE_PAD = 8;
const VALUE_MIN_H = 18;
/** Con más celdas que esto la rejilla ya es una textura: se lee por color y el tooltip da el número. */
const MAX_VALUE_CELLS = 120;
// Leyenda de color: barra de 8 px, con sus números de 11 px debajo.
const LEGEND_BAR_H = 8;
const LEGEND_H = LEGEND_BAR_H + 4 + SMALL_FONT;
const LEGEND_GAP = 12;
/** Tramos de la barra: rectángulos y no un degradado SVG, que necesita un id único en la página. */
const LEGEND_STEPS = 30;

// ------------------------------------------------------------ Rejilla

export interface Grid {
  /** Claves de columna (la X cruda como texto) y de fila (`y`), sin repetir, en orden de aparición. */
  cols: string[];
  rows: string[];
  /** Primer índice de datos de cada columna: de ahí sale su rótulo. */
  first: number[];
  /** Columna y fila de cada índice de datos. */
  col: number[];
  row: number[];
  /** Índice de datos de cada celda (fila × columnas + columna), o -1 si falta. */
  cell: number[];
}

/** Ubica cada fila de datos en su celda. Con dos datos en la misma celda gana el último. */
export function buildGrid(xKeys: readonly string[], yKeys: readonly string[]): Grid {
  const cols: string[] = [];
  const rows: string[] = [];
  const colOf = new Map<string, number>();
  const rowOf = new Map<string, number>();
  const intern = (list: string[], map: Map<string, number>, key: string) => {
    let k = map.get(key);
    if (k === undefined) {
      k = list.length;
      list.push(key);
      map.set(key, k);
    }
    return k;
  };
  const col = xKeys.map((k) => intern(cols, colOf, k));
  const first = cols.map((_, c) => col.indexOf(c));
  // Sin `y` (o con la fila vacía) el dato va a una fila sin nombre: se ve, no se pierde.
  const row = xKeys.map((_, i) => intern(rows, rowOf, yKeys[i] ?? ''));
  const cell = new Array<number>(rows.length * cols.length).fill(-1);
  for (let i = 0; i < xKeys.length; i++) cell[row[i] * cols.length + col[i]] = i;
  return { cols, rows, col, row, cell, first };
}

const MOVES: Record<string, [dc: number, dr: number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Flecha en dos dimensiones: ← → por columnas dentro de la fila, ↑ ↓ por filas en la misma
 * columna. Salta celdas vacías o sin valor; en el borde se queda donde está. undefined para
 * otras teclas (Inicio, Fin) o un dato que no es dueño de su celda: el recorrido lineal del núcleo.
 */
export function gridStep(grid: Grid, values: readonly number[], i: number, key: string): number | undefined {
  const move = MOVES[key];
  const nc = grid.cols.length;
  if (!move || !(i >= 0 && i < grid.col.length) || grid.cell[grid.row[i] * nc + grid.col[i]] !== i) return undefined;
  let c = grid.col[i] + move[0];
  let r = grid.row[i] + move[1];
  while (c >= 0 && c < nc && r >= 0 && r < grid.rows.length) {
    const j = grid.cell[r * nc + c];
    if (j >= 0 && isFinite(values[j])) return j;
    c += move[0];
    r += move[1];
  }
  return i;
}

/** Celdas con valor en orden de lectura (fila por fila, de izquierda a derecha): así recorre el teclado. */
export function readingOrder(grid: Grid, values: readonly number[]): number[] {
  return grid.cell.filter((i) => i >= 0 && isFinite(values[i]));
}

// ------------------------------------------------------------ Layout

export interface LayoutInput {
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** Ancho de la etiqueta de fila más larga (0: sin columna de etiquetas). */
  rowLabel: number;
  /** Ancho de la etiqueta de columna más larga (0: sin etiquetas abajo). */
  colLabel: number;
  /** Ancho que pide la leyenda (0: sin leyenda). */
  legend: number;
}

export interface HeatLayout {
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  /** Paso entre celdas (celda + aire) y tamaño de cada celda. */
  pitchX: number;
  pitchY: number;
  cellW: number;
  cellH: number;
  gap: number;
  /** Ancho para las etiquetas de fila (alineadas a la derecha, a PAD de la rejilla). */
  rowLabelW: number;
  /** Se etiqueta una fila de cada `rowEvery` y una columna de cada `colEvery`. */
  rowEvery: number;
  colEvery: number;
  /** Línea central de las etiquetas de columna. */
  colLabelY: number;
  legendX: number;
  legendY: number;
  legendW: number;
}

/**
 * Reparte el área: leyenda arriba a la derecha, etiquetas de fila a la izquierda (hasta el 30 %
 * del ancho), de columna abajo, y la rejilla en lo que queda. Las celdas llenan el ancho; la
 * altura de fila tiene tope y el bloque va arriba, junto al título: lo que sobra queda abajo,
 * donde no separa la leyenda del encabezado.
 */
export function heatLayout(o: LayoutInput): HeatLayout {
  const rows = Math.max(1, o.rows);
  const cols = Math.max(1, o.cols);
  const legendBlock = o.legend > 0 ? LEGEND_H + LEGEND_GAP : 0;
  const colBlock = o.colLabel > 0 ? COL_GAP + FONT + 2 : 0;
  const rowLabelW = Math.min(o.rowLabel, o.width * MAX_ROW_SHARE);
  const gridX = rowLabelW > 0 ? rowLabelW + PAD : 0;
  const pitchX = Math.max(0, o.width - gridX + GAP) / cols;
  const pitchY = Math.min(MAX_PITCH_Y, Math.max(0, o.height - legendBlock - colBlock + GAP) / rows);
  const gap = Math.min(pitchX, pitchY) < TIGHT_PITCH ? 1 : GAP;
  const gridW = Math.max(0, cols * pitchX - gap);
  const gridH = Math.max(0, rows * pitchY - gap);
  const top = 0;
  const gridY = top + legendBlock;
  const legendW = o.legend > 0 ? Math.min(o.legend, gridW) : 0;
  return {
    gridX,
    gridY,
    gridW,
    gridH,
    pitchX,
    pitchY,
    cellW: Math.max(0, pitchX - gap),
    cellH: Math.max(0, pitchY - gap),
    gap,
    rowLabelW,
    rowEvery: labelStep(ROW_LABEL_PITCH, pitchY, 0),
    colEvery: o.colLabel > 0 ? labelStep(o.colLabel, pitchX, LABEL_SPACING) : 1,
    colLabelY: gridY + gridH + COL_GAP + FONT / 2,
    legendX: gridX + gridW - legendW,
    legendY: top,
    legendW,
  };
}

/** Cada cuántas etiquetas se muestra una para que no se encimen: ⌈(tamaño + aire) / paso⌉. */
export function labelStep(size: number, pitch: number, spacing: number): number {
  if (!(pitch > 0)) return Number.MAX_SAFE_INTEGER;
  return Math.max(1, Math.ceil((size + spacing - 1e-9) / pitch));
}

export function cellRect(L: HeatLayout, c: number, r: number): { x: number; y: number; w: number; h: number } {
  return { x: L.gridX + c * L.pitchX, y: L.gridY + r * L.pitchY, w: L.cellW, h: L.cellH };
}

/** Columna y fila bajo (px, py), o null fuera de la rejilla. El aire cuenta para la celda de antes: el tooltip no parpadea entre celdas. */
export function cellAt(L: HeatLayout, cols: number, rows: number, px: number, py: number): [number, number] | null {
  if (px < L.gridX || py < L.gridY || px > L.gridX + L.gridW || py > L.gridY + L.gridH) return null;
  const c = Math.min(cols - 1, Math.floor((px - L.gridX) / L.pitchX));
  const r = Math.min(rows - 1, Math.floor((py - L.gridY) / L.pitchY));
  return c >= 0 && r >= 0 ? [c, r] : null;
}

/** Etiqueta de columna ubicada: centrada en su celda, o alineada hacia adentro en los bordes. */
export interface ColTick {
  c: number;
  x: number;
  anchor: 'start' | 'middle' | 'end';
}

/** Una columna de cada `colEvery`, sin salirse del área y sin chocar con la anterior. */
export function columnTicks(L: HeatLayout, widths: readonly number[], width: number): ColTick[] {
  const out: ColTick[] = [];
  let lastRight = -Infinity;
  for (let c = 0; c < widths.length; c += L.colEvery) {
    const w = widths[c];
    if (!(w > 0)) continue;
    const center = L.gridX + c * L.pitchX + L.cellW / 2;
    let left = center - w / 2;
    let tick: ColTick = { c, x: center, anchor: 'middle' };
    if (left < 0) {
      left = 0;
      tick = { c, x: 0, anchor: 'start' };
    } else if (left + w > width) {
      left = width - w;
      tick = { c, x: width, anchor: 'end' };
    }
    if (left < lastRight + LABEL_SPACING / 2) continue;
    out.push(tick);
    lastRight = left + w;
  }
  return out;
}

/** ¿Caben los valores en las celdas? El exacto si cabe el más ancho; si no, el compacto; si no, ninguno (todas iguales, no a saltos). */
export function valueMode(L: HeatLayout, exactW: number, compactW: number, cells = 0): 'exact' | 'compact' | null {
  if (L.cellH < VALUE_MIN_H || cells > MAX_VALUE_CELLS) return null;
  if (exactW + VALUE_PAD <= L.cellW) return 'exact';
  if (compactW + VALUE_PAD <= L.cellW) return 'compact';
  return null;
}

// ------------------------------------------------------------ Contexto

/** La rejilla depende solo de los datos: se arma una vez por serie preparada. */
const grids = new WeakMap<PreparedSeries, Grid>();

function gridOf(ps: PreparedSeries): Grid {
  let g = grids.get(ps);
  if (!g) {
    // La columna sale de la X cruda (texts.x), no del texto corto: dos fechas distintas con el
    // mismo rótulo abreviado siguen siendo dos columnas.
    g = buildGrid(ps.texts.x ?? ps.values.map(() => ''), ps.texts.y ?? []);
    grids.set(ps, g);
  }
  return g;
}

interface Setup {
  grid: Grid;
  L: HeatLayout;
  domain: Domain | null;
  ramp: Ramp | null;
  legend: LegendSpec | null;
  /** Etiquetas de fila ya recortadas, de columna y de valor de cada índice ('' sin valor). */
  rowTexts: string[];
  colTexts: string[];
  values: string[] | null;
}

/** Dominio y rampa del color: los mismos para las celdas, la leyenda y la muestra del tooltip. */
function colorScale(ctx: DrawContext): Pick<Setup, 'domain' | 'ramp'> {
  const domain = colorDomain(ctx.frame.ps.values);
  return { domain, ramp: domain ? makeRamp(domain.kind, ctx.theme, ctx.color) : null };
}

/** Color de la celda i con el valor de este cuadro, o null si no tiene valor. */
function cellPaint({ domain, ramp }: Pick<Setup, 'domain' | 'ramp'>, y1: readonly number[], i: number): Paint | null {
  return domain && ramp && isFinite(y1[i]) ? paint(ramp, position(domain, y1[i])) : null;
}

function setup(ctx: DrawContext): Setup {
  const ps = ctx.frame.ps;
  const grid = gridOf(ps);
  const { domain, ramp } = colorScale(ctx);
  const legend = domain ? legendSpec(domain, ctx.format) : null;
  const colTexts = grid.first.map((i) => ctx.label(i));
  const colWidths = colTexts.map((t) => ctx.measure(t));
  const rowLabel = maxOf(
    grid.rows.map((t) => ctx.measure(t)),
    0,
  );
  const L = heatLayout({
    width: ctx.width,
    height: ctx.height,
    cols: grid.cols.length,
    rows: grid.rows.length,
    rowLabel,
    colLabel: maxOf(colWidths, 0),
    legend: legend ? legendWidth(legend, ctx.measure) : 0,
  });
  // Si ni una letra cabe, mejor sin nombre que un "…" suelto.
  const rowTexts = grid.rows.map((t) => {
    const f = fitText(t, L.rowLabelW, ctx.measure);
    return f === '…' ? '' : f;
  });
  let values: string[] | null = null;
  if (ps.options.labels !== false) {
    const exact = ps.values.map((v) => (isFinite(v) ? ctx.format(v) : ''));
    const widest = (list: string[]) =>
      maxOf(
        list.map((s) => (s ? ctx.measure(s) : 0)),
        0,
      );
    const compact = exact.map((s, i) => (s ? ctx.compact(ps.values[i]) : ''));
    const mode = valueMode(L, widest(exact), widest(compact), grid.rows.length * grid.cols.length);
    if (mode === 'exact') values = exact;
    else if (mode === 'compact') values = compact;
  }
  return {
    grid,
    L,
    domain,
    ramp,
    legend,
    rowTexts,
    colTexts,
    values,
  };
}

function text(x: number, y: number, s: string, fill: string, extra: Record<string, string | number | undefined> = {}): string {
  return `<text${attrs({ x: r2(x), y: r2(y), fill, 'font-size': FONT, 'dominant-baseline': 'central', ...extra })}>${esc(s)}</text>`;
}

function rect(x: number, y: number, w: number, h: number, a: Record<string, string | number | undefined>): string {
  return `<rect${attrs({ x: r2(x), y: r2(y), width: r2(w), height: r2(h), ...a })}/>`;
}

/** Barra de color con sus números debajo, en texto secundario. */
function legendMarkup(ctx: DrawContext, S: Setup): string {
  const { L, legend, ramp } = S;
  if (!legend || !ramp || L.legendW <= 0) return '';
  let s = '';
  const step = L.legendW / LEGEND_STEPS;
  for (let k = 0; k < LEGEND_STEPS; k++) {
    const p = legend.from + ((legend.to - legend.from) * (k + 0.5)) / LEGEND_STEPS;
    const c = paint(ramp, p);
    // Medio píxel de traslape: sin costuras de antialiasing entre tramos.
    s += rect(L.legendX + k * step, L.legendY, step + (k < LEGEND_STEPS - 1 ? 0.5 : 0), LEGEND_BAR_H, {
      fill: c.fill,
      'fill-opacity': c.opacity,
    });
  }
  const y = L.legendY + LEGEND_BAR_H + 4 + SMALL_FONT / 2;
  for (const [t, at] of legend.labels) {
    const anchor = at === 0 ? 'start' : at === 1 ? 'end' : 'middle';
    s += text(L.legendX + at * L.legendW, y, t, ctx.theme.textMuted, { 'font-size': SMALL_FONT, 'text-anchor': anchor });
  }
  return `<g${attrs({ 'aria-hidden': 'true' })}>${s}</g>`;
}

export const heatmap: SeriesImpl = {
  coords: 'free',
  layer: 0,
  legendSymbol: 'square',
  label: 'mapa de calor',
  items: ['celda', 'celdas'],
  texts: (o, x) => ({ y: o.y, x }),
  dimmable: true,
  draw(ctx) {
    const S = setup(ctx);
    const { grid, L } = S;
    if (!grid.cols.length || L.cellW <= 0 || L.cellH <= 0) return '';
    const th = ctx.theme;
    const radius = Math.min(RADIUS, L.cellW / 4, L.cellH / 4);
    const y1 = ctx.frame.y1;
    let cells = '';
    let labels = '';
    for (let r = 0; r < grid.rows.length; r++) {
      for (let c = 0; c < grid.cols.length; c++) {
        const i = grid.cell[r * grid.cols.length + c];
        // Los colores salen del valor animado: un cambio de datos se ve como un cambio de color.
        const p = i < 0 ? null : cellPaint(S, y1, i);
        if (!p) continue;
        const b = cellRect(L, c, r);
        const opacity = dimOpacity(ctx, i);
        cells += rect(b.x, b.y, b.w, b.h, { rx: r2(radius), fill: p.fill, 'fill-opacity': p.opacity, opacity });
        const v = S.values?.[i];
        if (v) {
          const fill = textOn(p.rgb, [th.text, th.surface, '#000000', '#ffffff']);
          labels += text(b.x + b.w / 2, b.y + b.h / 2, v, fill, { 'text-anchor': 'middle', opacity });
        }
      }
    }
    let axes = '';
    for (let r = 0; r < grid.rows.length; r += L.rowEvery) {
      if (!S.rowTexts[r]) continue;
      axes += text(L.rowLabelW, L.gridY + r * L.pitchY + L.cellH / 2, S.rowTexts[r], th.textMuted, { 'text-anchor': 'end' });
    }
    for (const t of columnTicks(
      L,
      S.colTexts.map((s) => ctx.measure(s)),
      ctx.width,
    )) {
      axes += text(t.x, L.colLabelY, S.colTexts[t.c], th.textMuted, { 'text-anchor': t.anchor });
    }
    return cells + labels + axes + legendMarkup(ctx, S);
  },
  // El color de la celda en la rampa: dice cuánto vale, no solo de qué serie es.
  swatch(ctx, i) {
    const p = cellPaint(colorScale(ctx), ctx.frame.y1, i);
    return p && paintColor(p);
  },
  hit(ctx, px, py) {
    const { grid, L } = setup(ctx);
    const at = cellAt(L, grid.cols.length, grid.rows.length, px, py);
    // Una celda sin valor (NaN) también responde: el tooltip dice "Sin dato".
    return at ? grid.cell[at[1] * grid.cols.length + at[0]] : -1;
  },
  anchor(ctx, i) {
    const { grid, L } = setup(ctx);
    const b = cellRect(L, grid.col[i] ?? 0, grid.row[i] ?? 0);
    // El núcleo pone el tooltip arriba del punto en la mitad de arriba y debajo en la de abajo:
    // se apoya en el borde que corresponde para no tapar la celda que se mira.
    return [b.x + b.w / 2, b.y + b.h / 2 < ctx.height / 2 ? b.y : b.y + b.h];
  },
  hover(ctx, i) {
    const { grid, L } = setup(ctx);
    if (!(i >= 0 && i < grid.col.length) || grid.cell[grid.row[i] * grid.cols.length + grid.col[i]] !== i) return '';
    const b = cellRect(L, grid.col[i], grid.row[i]);
    // Anillo de superficie que la separa de las vecinas y, encima, el anillo de texto en el aire.
    const ring = (out: number, stroke: string, width: number, opacity?: number) =>
      rect(b.x - out, b.y - out, b.w + 2 * out, b.h + 2 * out, {
        rx: RADIUS + out,
        fill: 'none',
        stroke,
        'stroke-width': width,
        'stroke-opacity': opacity,
      });
    return ring(2, ctx.theme.surface, 4) + ring(1, ctx.theme.text, 2, 0.8);
  },
  navigable(ps) {
    return readingOrder(gridOf(ps), ps.values);
  },
  step(ps, i, key) {
    return gridStep(gridOf(ps), ps.values, i, key);
  },
  headline(ps, i, x) {
    // La celda completa: columna y fila. Así el tooltip y la tabla oculta no necesitan detalle aparte.
    const row = ps.texts.y?.[i] ?? '';
    const name = row ? `${x} · ${row}` : x;
    // Un dato repetido que perdió su celda lo dice en la tabla oculta, en vez de contradecir al dibujo.
    const g = gridOf(ps);
    const shadowed = i < g.col.length && g.cell[g.row[i] * g.cols.length + g.col[i]] !== i;
    return shadowed ? `${name} (repetida; se muestra la última)` : name;
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue {
    const v = ps.values[i];
    return { value: isFinite(v) ? format.value(v) : 'Sin dato' };
  },
};
