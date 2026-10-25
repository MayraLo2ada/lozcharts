/**
 * Nube de palabras (LozWordcloud): cada fila es una palabra (el campo de la X) con su peso
 * (`field`). Una palabra repetida es una sola, con la suma de sus pesos; las vacías y los pesos
 * cero, negativos, infinitos o faltantes no se dibujan (la tabla las lista igual).
 *
 * Tamaño: el área del texto es proporcional al peso, así que el cuerpo de letra crece con la
 * raíz del peso (el área de una palabra va con el cuadrado de su cuerpo). Nada baja de 12 px, el
 * mínimo legible; el máximo sale del área disponible: se busca el cuerpo que hace que las cajas
 * de todas las palabras cubran una fracción fija del rectángulo (si después la nube no llega a
 * los bordes, se agranda), con un tope por el alto y para que la más pesada quepa a lo ancho. Una palabra que no cabe a lo ancho se achica sola y, si ni
 * a 12 px cabe, se recorta con "…" (el tooltip y la tabla la dan completa).
 *
 * Colocación: de la más pesada a la más liviana, cada palabra recorre una espiral de Arquímedes
 * desde el centro hasta el primer lugar donde su caja no toca a ninguna otra. La espiral se
 * estira con la proporción del área y sus vueltas son superelipses (casi rectángulos de puntas
 * redondas): en un área ancha la nube ocupa todo el ancho, no un círculo al centro. Las cajas ya puestas viven en una rejilla espacial, así que cada prueba mira
 * solo las celdas vecinas, y una palabra empieza a buscar donde terminó la última que era más
 * chica en las dos medidas (lo que no cabía para una caja más chica no cabe para una más
 * grande: es exacto, no una aproximación). 300 palabras se colocan en milisegundos. No hay azar:
 * el mismo resultado en cada carga.
 *
 * Todas horizontales: una palabra girada se lee más despacio y obliga a torcer la cabeza, y en
 * una nube el único dato es la palabra. No se ofrece rotación.
 *
 * Lo que no cabe se omite, siempre desde las más livianas: si una palabra no encuentra lugar,
 * ella y todas las que pesan menos quedan fuera (antes se prueba achicar la escala). Se avisa
 * una vez en consola con cuántas quedaron fuera; siguen en la tabla y en el tooltip.
 *
 * Color: sin `group`, el de la serie en tres intensidades por peso (las livianas se mezclan
 * hacia el texto secundario: pierden croma, no contraste). Con `group`, un color por grupo en el
 * orden de la paleta según su primera aparición, nunca se cicla: desde el noveno, el gris de
 * "Otros". Las palabras son texto, así que todo color se oscurece (o aclara, en oscuro) hasta
 * llegar a 4,5:1 contra la superficie: el ocre y el cielo del claro no llegan solos.
 *
 * Toda la geometría (modelo, cuerpos, espiral, colocación, colores, hit-test) son funciones puras.
 */
import type { DrawContext, PreparedSeries, SeriesImpl, TooltipFormat, TooltipValue } from '../core/series';
import type { Theme } from '../core/theme';
import { MAX_COLORS } from '../core/theme';
import { attrs, esc } from '../core/dom';
import { contrast, mixOklab, parseColor, toHex } from '../core/color';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';

/** Cuerpo de letra mínimo legible y máximo absoluto (px). */
export const MIN_FONT = 12;
const MAX_FONT = 128;
/** La palabra más pesada no pasa de esta fracción del alto. */
const MAX_HEIGHT_SHARE = 0.3;
/** Fracción del área que cubren las cajas de las palabras: deja aire sin dejar huecos grandes. */
const FILL = 0.6;
/** Cuerpo mínimo de la palabra más pesada (si el alto y el ancho lo permiten). */
const HIERARCHY = 4.5 * MIN_FONT;
/** Al omitir palabras se achica la escala, sin bajar el máximo de este cuerpo. */
const OMIT_FLOOR = 2.5 * MIN_FONT;
/** Si quedan fuera más que esta parte de las palabras, se prueba una escala menor. */
const OMIT_SHARE = 0.08;
const SHRINK = 0.86;
const ATTEMPTS = 6;
/** Si todo cupo y la nube no cubre estas partes del ancho y del alto, se prueba un cuerpo mayor. */
const REACH_X = 0.92;
const REACH_Y = 0.85;
const GROW = 1.12;
const GROW_ATTEMPTS = 4;
/** measure() mide a 12 px con peso normal; con 500 y 600 el texto es algo más ancho. */
const FONT = 12;
const WEIGHT_500 = 1.05;
const WEIGHT_600 = 1.09;
/** Desde este cuerpo, las palabras van en 600. */
const BOLD_FROM = 24;
/** Alto de la caja por px de cuerpo (con acentos y descendentes) y aire alrededor. */
const LINE_H = 1.12;
const GAP = 2;
/** Distancia mínima al borde del área. */
const EDGE = 2;
/** Espiral: avance radial por vuelta (en el eje corto) y paso a lo largo de la curva (px). */
const PITCH = 3;
const STEP = 3;
/** Exponente de la superelipse de cada vuelta: 2 sería una elipse; más alto, más rectangular. */
const SHAPE = 4;
/**
 * Estiramiento horizontal extra de la espiral: las palabras son anchas y bajas, así que la nube
 * toca arriba y abajo antes que los costados y se reparte a lo ancho en vez de amontonarse.
 */
const STRETCH = 1.25;
/** Celdas de la rejilla espacial (px). */
const CELL = 32;
/** Intensidades sin grupo: tanto de mezcla con el texto secundario por nivel. */
const LEVEL_MIX = [0, 0.4, 0.68];
/** Desde qué cuerpo relativo (raíz del peso / raíz del mayor) va cada nivel. */
const LEVEL_FROM = [0.55, 0.3];
/** Contraste mínimo de texto (WCAG AA). */
const AA = 4.5;
/** Velo de superficie sobre las demás palabras al pasar el puntero. */
const VEIL_ALPHA = 0.72;
/** Animación: la última palabra empieza a aparecer en esta fracción del recorrido. */
const STAGGER = 0.6;
// Leyenda de grupos.
const LEGEND_ROW = 20;
const LEGEND_GAP = 16;
const LEGEND_DOT = 4;
const MAX_LEGEND = 160;

export interface CloudWord {
  /** Texto normalizado (sin espacios a los lados, espacios internos simples). */
  text: string;
  /** Suma de los pesos de sus filas. */
  weight: number;
  /** Fila que la representa (la primera) y todas las que la forman. */
  row: number;
  rows: number[];
  /** Grupo (el de su primera fila con grupo), o -1. */
  group: number;
}

export interface CloudModel {
  /** Palabras de la más pesada a la más liviana (empates: orden de los datos). */
  words: CloudWord[];
  /** Grupos por primera aparición. */
  groups: string[];
  /** Posición en la paleta de cada palabra: su grupo hasta `maxColors`; -1 el gris "otros". */
  slots: number[];
  /** Palabra de cada fila, o -1. */
  rowWord: number[];
  /** Filas que no se dibujan: sin palabra o con peso no positivo. */
  ignored: number[];
  /** Suma de todos los pesos dibujables. */
  total: number;
}

/** Texto de una palabra: forma canónica de Unicode y espacios simples. */
export function normalizeWord(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Modelo de la nube a partir de las columnas de la tabla. */
export function buildCloud(
  texts: readonly string[],
  values: readonly number[],
  groups: readonly string[] = [],
  maxColors = MAX_COLORS,
): CloudModel {
  const byText = new Map<string, CloudWord>();
  const list: CloudWord[] = [];
  const groupNames: string[] = [];
  const groupIds = new Map<string, number>();
  const ignored: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const text = normalizeWord(texts[i] ?? '');
    const v = values[i];
    if (!text || !(isFinite(v) && v > 0)) {
      ignored.push(i);
      continue;
    }
    let w = byText.get(text);
    if (!w) {
      w = { text, weight: 0, row: i, rows: [], group: -1 };
      byText.set(text, w);
      list.push(w);
    }
    w.weight += v;
    w.rows.push(i);
    const g = groups[i] ?? '';
    if (g !== '' && w.group < 0) {
      let k = groupIds.get(g);
      if (k === undefined) {
        k = groupNames.length;
        groupIds.set(g, k);
        groupNames.push(g);
      }
      w.group = k;
    }
  }
  // sort es estable: los empates quedan en el orden de los datos.
  const words = list.slice().sort((a, b) => b.weight - a.weight);
  const rowWord = new Array<number>(values.length).fill(-1);
  words.forEach((w, k) => w.rows.forEach((r) => (rowWord[r] = k)));
  const any = groupNames.length > 0;
  const slots = words.map((w) => (!any ? 0 : w.group >= 0 && w.group < maxColors ? w.group : -1));
  const total = words.reduce((s, w) => s + w.weight, 0);
  return { words, groups: groupNames, slots, rowWord, ignored, total };
}

// ------------------------------------------------------------ Cuerpos

/** Cuerpo de una palabra: el área con el peso (cuerpo con la raíz), nunca bajo el mínimo. */
export function fontSize(weight: number, top: number, max: number, min = MIN_FONT): number {
  if (!(top > 0) || !(weight > 0)) return min;
  return Math.max(min, max * Math.sqrt(Math.min(1, weight / top)));
}

/** Ancho del texto por px de cuerpo, con el peso con que se dibuja. */
function widthPerPx(text: string, size: number, measure: (s: string) => number): number {
  return (measure(text) / FONT) * (size >= BOLD_FROM ? WEIGHT_600 : WEIGHT_500);
}

/** Tope del cuerpo de la palabra más pesada: el absoluto, una parte del alto y caber a lo ancho. */
export function fontCap(
  words: readonly Pick<CloudWord, 'text' | 'weight'>[],
  width: number,
  height: number,
  measure: (s: string) => number,
): number {
  const fitTop = words.length
    ? (width - 2 * EDGE - 2 * GAP) / Math.max(1e-9, widthPerPx(words[0].text, BOLD_FROM, measure))
    : MAX_FONT;
  return Math.max(MIN_FONT, Math.min(MAX_FONT, height * MAX_HEIGHT_SHARE, fitTop));
}

/**
 * Cuerpo de la palabra más pesada para un área: el que hace que las cajas cubran FILL del
 * rectángulo (las que quedan en el mínimo ocupan su área fija), con tope por el alto, por el
 * máximo absoluto y para que la más pesada quepa a lo ancho, y sin bajar de HIERARCHY.
 */
export function maxFontSize(
  words: readonly Pick<CloudWord, 'text' | 'weight'>[],
  width: number,
  height: number,
  measure: (s: string) => number,
): number {
  if (!words.length || !(width > 0) || !(height > 0)) return MIN_FONT;
  const top = words[0].weight;
  const per = words.map((w) => ({ rel: w.weight / top, cw: widthPerPx(w.text, BOLD_FROM, measure) }));
  const budget = FILL * width * height;
  let s = MAX_FONT;
  // Punto fijo: con s se sabe qué palabras quedan en el mínimo; con eso, s otra vez.
  for (let it = 0; it < 4; it++) {
    let fixed = 0;
    let scaled = 0;
    for (const p of per) {
      if (s * Math.sqrt(p.rel) <= MIN_FONT) fixed += MIN_FONT * MIN_FONT * p.cw * LINE_H;
      else scaled += p.rel * p.cw * LINE_H;
    }
    const room = budget - fixed;
    s = scaled > 0 && room > 0 ? Math.sqrt(room / scaled) : MIN_FONT;
  }
  const cap = fontCap(words, width, height, measure);
  // Con muchas palabras el presupuesto las dejaría a todas en el mínimo: sin jerarquía no hay
  // nube. Se conserva un cuerpo mayor y se omiten las más livianas.
  return Math.max(MIN_FONT, Math.min(Math.max(s, HIERARCHY), cap));
}

// ------------------------------------------------------------ Espiral y colocación

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Puntos de una espiral de Arquímedes desde el centro (relativos a él), con dos ajustes para que
 * la nube tome la forma del área: se estira con su proporción (y algo más a lo ancho) y cada vuelta es una superelipse
 * (|x|⁴ + |y|⁴ = r⁴) en vez de una elipse, que llega más cerca de las esquinas sin volverse un
 * rectángulo. Avanza PITCH px por vuelta en el eje corto y deja STEP px entre puntos, hasta
 * cubrir las esquinas del rectángulo.
 */
export function spiral(width: number, height: number): { x: Float64Array; y: Float64Array } {
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const ax = Math.max(1, W / H) * STRETCH;
  const ay = Math.max(1, H / W);
  const reach = (Math.min(W, H) / 2) * 2 ** (1 / SHAPE) + PITCH;
  const e = 2 / SHAPE;
  const bend = (c: number) => Math.sign(c) * Math.abs(c) ** e;
  const xs: number[] = [0];
  const ys: number[] = [0];
  let lx = 0;
  let ly = 0;
  // Se recorre la curva en pasos finos y se guarda un punto cada STEP px de camino.
  for (let t = 0; ;) {
    const r = (PITCH * t) / (2 * Math.PI);
    if (r > reach) break;
    t += STEP / 6 / Math.max(PITCH, r * Math.max(ax, ay));
    const rr = (PITCH * t) / (2 * Math.PI);
    const x = rr * ax * bend(Math.cos(t));
    const y = rr * ay * bend(Math.sin(t));
    if ((x - lx) ** 2 + (y - ly) ** 2 < STEP * STEP) continue;
    xs.push(x);
    ys.push(y);
    lx = x;
    ly = y;
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys) };
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Coloca cajas de w × h (en orden) en un rectángulo de width × height, cada una centrada en el
 * primer punto de la espiral donde no toca a ninguna anterior ni se sale. Devuelve la caja de
 * cada una, o null si no encontró lugar.
 */
export function placeBoxes(
  items: readonly { w: number; h: number }[],
  width: number,
  height: number,
  path: { x: Float64Array; y: Float64Array } = spiral(width, height),
): (Box | null)[] {
  const cols = Math.max(1, Math.ceil(width / CELL));
  const rows = Math.max(1, Math.ceil(height / CELL));
  const grid: number[][] = Array.from({ length: cols * rows }, () => []);
  const boxes: Box[] = [];
  const out: (Box | null)[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const n = path.x.length;
  // Dónde terminó cada caja anterior: lo que estaba ocupado para ella también lo está para una mayor.
  const memo: { w: number; h: number; at: number }[] = [];
  const cell = (v: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(v / CELL)));
  const free = (b: Box) => {
    const gx0 = cell(b.x0, cols);
    const gx1 = cell(b.x1, cols);
    for (let gy = cell(b.y0, rows); gy <= cell(b.y1, rows); gy++)
      for (let gx = gx0; gx <= gx1; gx++) for (const k of grid[gy * cols + gx]) if (overlaps(boxes[k], b)) return false;
    return true;
  };
  for (const it of items) {
    let start = 0;
    for (const m of memo) if (m.w <= it.w && m.h <= it.h && m.at > start) start = m.at;
    let placed: Box | null = null;
    let k = start;
    if (it.w <= width - 2 * EDGE && it.h <= height - 2 * EDGE) {
      for (; k < n; k++) {
        const x = cx + path.x[k];
        const y = cy + path.y[k];
        const b = { x0: x - it.w / 2, x1: x + it.w / 2, y0: y - it.h / 2, y1: y + it.h / 2 };
        if (b.x0 < EDGE || b.y0 < EDGE || b.x1 > width - EDGE || b.y1 > height - EDGE) continue;
        if (free(b)) {
          placed = b;
          break;
        }
      }
    } else k = n;
    memo.push({ w: it.w, h: it.h, at: k });
    out.push(placed);
    if (!placed) continue;
    const id = boxes.length;
    boxes.push(placed);
    for (let gy = cell(placed.y0, rows); gy <= cell(placed.y1, rows); gy++)
      for (let gx = cell(placed.x0, cols); gx <= cell(placed.x1, cols); gx++) grid[gy * cols + gx].push(id);
  }
  return out;
}

type Segmenter = new (
  locale?: string,
  options?: { granularity: 'grapheme' },
) => {
  segment(s: string): Iterable<{ segment: string }>;
};

/** Grafemas de un texto: un emoji compuesto o una letra con su acento son uno solo. */
function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: Segmenter }).Segmenter;
  return Seg ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment) : Array.from(text);
}

/** Recorta un texto con "…" sin partir grafemas. */
export function clipText(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  const parts = graphemes(text);
  const cut = (k: number) => parts.slice(0, k).join('').trimEnd() + '…';
  let lo = 0;
  let hi = parts.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (measure(cut(mid)) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo ? cut(lo) : '…';
}

export interface PlacedWord {
  /** Índice en `words`. */
  word: number;
  /** Lo que se dibuja (recortado si no cabía) y su cuerpo. */
  text: string;
  size: number;
  /** Centro del texto y su caja (con el aire). */
  x: number;
  y: number;
  box: Box;
}

export interface LegendItem {
  slot: number;
  name: string;
  x: number;
  y: number;
}

export interface CloudGeometry {
  /** Palabra colocada por índice de `words`, o null si quedó fuera. */
  placed: (PlacedWord | null)[];
  /** Índices de `words` que no cupieron (siempre las más livianas). */
  omitted: number[];
  /** Cuerpo de la palabra más pesada. */
  maxSize: number;
  legend: LegendItem[];
  /** Alto de la leyenda: la nube empieza debajo. */
  top: number;
}

/**
 * Leyenda de grupos, de izquierda a derecha y en hasta 3 filas (lo que no cabe se omite: la
 * tabla y el tooltip dan el grupo de cada palabra). Solo con 2 o más grupos.
 */
export function legendLayout(
  m: Pick<CloudModel, 'groups' | 'slots'>,
  width: number,
  measure: (s: string) => number,
  maxColors = MAX_COLORS,
): { items: LegendItem[]; height: number } {
  if (m.groups.length < 2) return { items: [], height: 0 };
  const entries = m.groups.slice(0, maxColors).map((name, g) => ({ slot: g, name }));
  if (m.slots.some((s) => s < 0)) entries.push({ slot: -1, name: m.groups.length > maxColors ? 'Otros' : 'Sin grupo' });
  const items: LegendItem[] = [];
  let x = 0;
  let row = 0;
  for (const e of entries) {
    const name = fitText(e.name, Math.min(MAX_LEGEND, Math.max(0, width - 2 * LEGEND_DOT - 6)), measure);
    const w = 2 * LEGEND_DOT + 6 + measure(name);
    if (x > 0 && x + w > width) {
      x = 0;
      row++;
    }
    if (row >= 3) break;
    items.push({ slot: e.slot, name, x, y: row * LEGEND_ROW + LEGEND_ROW / 2 });
    x += w + LEGEND_GAP;
  }
  const rows = items.length ? items[items.length - 1].y / LEGEND_ROW + 0.5 : 0;
  return { items, height: rows * LEGEND_ROW + (items.length ? 8 : 0) };
}

/** Cajas y textos de las palabras con el cuerpo mayor `max`, en un área de width × height. */
function attempt(
  m: CloudModel,
  max: number,
  width: number,
  height: number,
  measure: (s: string) => number,
  path: { x: Float64Array; y: Float64Array },
) {
  const top = m.words[0]?.weight ?? 0;
  const room = width - 2 * EDGE - 2 * GAP;
  const items = m.words.map((w) => {
    let size = Math.min(fontSize(w.weight, top, max), (height - 2 * EDGE - 2 * GAP) / LINE_H);
    // La que no cabe a lo ancho se achica; si ni en el mínimo cabe, se recorta.
    size = Math.max(MIN_FONT, Math.min(size, room / Math.max(1e-9, widthPerPx(w.text, size, measure))));
    const at = (s: string) => widthPerPx(s, size, measure) * size;
    const text = clipText(w.text, room, at);
    return { text, size, w: at(text) + 2 * GAP, h: size * LINE_H + 2 * GAP };
  });
  return { items, boxes: placeBoxes(items, width, height, path) };
}

/** ¿Las cajas cubren casi todo el ancho y el alto del área? */
function reachesEdges(boxes: readonly (Box | null)[], width: number, height: number): boolean {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    x0 = Math.min(x0, b.x0);
    x1 = Math.max(x1, b.x1);
    y0 = Math.min(y0, b.y0);
    y1 = Math.max(y1, b.y1);
  }
  return x1 - x0 >= REACH_X * width && y1 - y0 >= REACH_Y * height;
}

/**
 * Geometría de la nube: leyenda, escala, colocación y omitidas. Primero el cuerpo que da el
 * presupuesto de área; si no caben, uno menor; si sobra lugar, uno mayor.
 */
export function layoutCloud(
  m: CloudModel,
  width: number,
  height: number,
  measure: (s: string) => number,
  maxColors = MAX_COLORS,
): CloudGeometry {
  const legend = legendLayout(m, width, measure, maxColors);
  const top = legend.height;
  const h = Math.max(0, height - top);
  const n = m.words.length;
  const path = spiral(width, h);
  let max = maxFontSize(m.words, width, h, measure);
  let run = attempt(m, max, width, h, measure, path);
  for (let k = 1; k < ATTEMPTS; k++) {
    const first = run.boxes.indexOf(null);
    if (first < 0) break;
    // No cupo una palabra grande: la escala es demasiado ambiciosa. O quedan fuera demasiadas.
    const big = run.items[first].size > MIN_FONT + 0.5 && max > MIN_FONT;
    const many = n - first > OMIT_SHARE * n && max > OMIT_FLOOR;
    if (!big && !many) break;
    max = Math.max(big ? MIN_FONT : OMIT_FLOOR, max * SHRINK);
    run = attempt(m, max, width, h, measure, path);
  }
  // Todo cupo pero la nube no llega a los bordes (el presupuesto es una estimación): se prueba
  // un cuerpo mayor mientras siga cabiendo todo.
  const cap = fontCap(m.words, width, h, measure);
  for (let k = 0; k < GROW_ATTEMPTS && max < cap && run.boxes.every((b) => b) && !reachesEdges(run.boxes, width, h); k++) {
    const next = Math.min(cap, max * GROW);
    const bigger = attempt(m, next, width, h, measure, path);
    if (!bigger.boxes.every((b) => b)) break;
    max = next;
    run = bigger;
  }
  const first = run.boxes.indexOf(null);
  const cut = first < 0 ? n : first;
  const placed: (PlacedWord | null)[] = run.items.map((it, k) => {
    const b = run.boxes[k];
    if (!b || k >= cut) return null;
    const box = { x0: b.x0, x1: b.x1, y0: b.y0 + top, y1: b.y1 + top };
    return { word: k, text: it.text, size: it.size, x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, box };
  });
  const omitted: number[] = [];
  for (let k = cut; k < n; k++) omitted.push(k);
  return { placed, omitted, maxSize: max, legend: legend.items, top };
}

/** Palabra bajo el punto (por su caja), o -1. */
export function hitWord(placed: readonly (PlacedWord | null)[], px: number, py: number): number {
  for (const p of placed) if (p && px >= p.box.x0 && px <= p.box.x1 && py >= p.box.y0 && py <= p.box.y1) return p.word;
  return -1;
}

// ------------------------------------------------------------ Color

/**
 * El color, oscurecido o aclarado hacia `toward` (el texto del tema) en pasos de 5 % hasta llegar
 * a `min`:1 contra la superficie. Un color que no se puede leer (un nombre, hsl) queda como está.
 */
export function ensureContrast(color: string, surface: string, toward: string, min = AA): string {
  const c = parseColor(color);
  const s = parseColor(surface);
  const t = parseColor(toward);
  if (!c || !s || !t) return color;
  if (contrast(c, s) >= min) return color;
  for (let k = 1; k <= 20; k++) {
    const mixed = mixOklab(c, t, k / 20);
    if (contrast(mixed, s) >= min) return toHex(mixed);
  }
  return toward;
}

/** Las tres intensidades del color de la serie: cada una pierde croma hacia el texto secundario. */
export function levelColors(color: string, theme: Pick<Theme, 'surface' | 'text' | 'textMuted'>): string[] {
  const base = ensureContrast(color, theme.surface, theme.text);
  const rgb = parseColor(base);
  const muted = parseColor(theme.textMuted);
  return LEVEL_MIX.map((t) =>
    t === 0 || !rgb || !muted ? base : ensureContrast(toHex(mixOklab(rgb, muted, t)), theme.surface, theme.text),
  );
}

/** Nivel de intensidad de una palabra según su cuerpo relativo (la raíz del peso). */
export function levelOf(weight: number, top: number): number {
  const rel = top > 0 ? Math.sqrt(weight / top) : 1;
  return rel >= LEVEL_FROM[0] ? 0 : rel >= LEVEL_FROM[1] ? 1 : 2;
}

/** Color de un grupo legible como texto: la paleta en orden, desde el noveno el gris de "Otros". */
export function groupInk(slot: number, theme: Pick<Theme, 'palette' | 'other' | 'surface' | 'text'>): string {
  const c = slot >= 0 && slot < Math.min(MAX_COLORS, theme.palette.length) ? theme.palette[slot] : theme.other;
  return ensureContrast(c, theme.surface, theme.text);
}

/** Color de cada palabra. */
export function wordColors(m: CloudModel, theme: Theme, color: string): string[] {
  if (m.groups.length) return m.slots.map((s) => groupInk(s, theme));
  const levels = levelColors(color, theme);
  const top = m.words[0]?.weight ?? 0;
  return m.words.map((w) => levels[levelOf(w.weight, top)]);
}

/**
 * Opacidad de la palabra de rango k (de n) cuando su peso va en `p` (0 a 1) del recorrido: las
 * pesadas aparecen primero y ninguna se mueve; al final, todas enteras.
 */
export function appearance(p: number, k: number, n: number): number {
  const delay = n > 1 ? (STAGGER * k) / (n - 1) : 0;
  return Math.max(0, Math.min(1, (p - delay) / (1 - STAGGER)));
}

// ------------------------------------------------------------ Plugin

const models = new WeakMap<readonly number[], CloudModel>();

function modelOf(ps: PreparedSeries): CloudModel {
  let m = models.get(ps.values);
  if (m) return m;
  const empty = ps.values.map(() => '');
  m = buildCloud(ps.texts.word ?? empty, ps.values, ps.options.group ? (ps.texts.group ?? empty) : empty);
  models.set(ps.values, m);
  return m;
}

/** Geometría por modelo y tamaño: el puntero y cada cuadro de la animación la reutilizan. */
const geoCache = new WeakMap<CloudModel, { w: number; h: number; g: CloudGeometry }>();
/** Omitidas en la última geometría: el teclado y el tooltip las conocen sin el área. */
const omittedOf = new WeakMap<CloudModel, Set<number>>();
const warned = new WeakSet<CloudModel>();

function geometryOf(ctx: DrawContext): { m: CloudModel; g: CloudGeometry } {
  const ps = ctx.frame.ps;
  const m = modelOf(ps);
  const c = geoCache.get(m);
  if (c && c.w === ctx.width && c.h === ctx.height) return { m, g: c.g };
  const g = layoutCloud(m, ctx.width, ctx.height, ctx.measure, ctx.theme.palette.length || MAX_COLORS);
  geoCache.set(m, { w: ctx.width, h: ctx.height, g });
  omittedOf.set(m, new Set(g.omitted));
  // Un aviso por conjunto de datos, no uno por cuadro ni por cada cambio de tamaño.
  if (g.omitted.length && !warned.has(m)) {
    warned.add(m);
    const k = g.omitted.length;
    console.warn(
      `LozChart: en la nube "${ps.name}" no caben ${k} ${k === 1 ? 'palabra' : 'palabras'} (las de menor peso); ` +
        'siguen en la tabla de datos.',
    );
  }
  return { m, g };
}

const colorCache = new WeakMap<CloudModel, { theme: Theme; color: string; inks: string[] }>();

function colorsOf(ctx: DrawContext, m: CloudModel): string[] {
  const c = colorCache.get(m);
  if (c && c.theme === ctx.theme && c.color === ctx.color) return c.inks;
  const inks = wordColors(m, ctx.theme, ctx.color);
  colorCache.set(m, { theme: ctx.theme, color: ctx.color, inks });
  return inks;
}

function wordMarkup(p: PlacedWord, fill: string, opacity = 1): string {
  if (!(opacity > 0.005)) return '';
  const a = {
    x: r2(p.x),
    y: r2(p.y),
    'font-size': r2(p.size),
    'font-weight': p.size >= BOLD_FROM ? 600 : 500,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    fill,
    opacity: opacity < 1 ? r2(opacity) : undefined,
  };
  return `<text${attrs(a)}>${esc(p.text)}</text>`;
}

function legendMarkup(ctx: DrawContext, items: readonly LegendItem[]): string {
  let s = '';
  for (const it of items) {
    const color = groupInk(it.slot, ctx.theme);
    s += `<circle${attrs({ cx: r2(it.x + LEGEND_DOT), cy: r2(it.y), r: LEGEND_DOT, fill: color })}/>`;
    const t = {
      x: r2(it.x + 2 * LEGEND_DOT + 6),
      y: r2(it.y),
      'font-size': FONT,
      'dominant-baseline': 'central',
      fill: ctx.theme.textMuted,
    };
    s += `<text${attrs(t)}>${esc(it.name)}</text>`;
  }
  return s;
}

/** Recorrido de cada palabra en este cuadro (0 a 1): la suma animada de sus filas sobre su peso. */
function progress(ctx: DrawContext, w: CloudWord): number {
  let now = 0;
  for (const r of w.rows) {
    const v = ctx.frame.y1[r];
    if (isFinite(v)) now += v;
  }
  return w.weight > 0 ? Math.max(0, Math.min(1, now / w.weight)) : 1;
}

export const wordcloud: SeriesImpl = {
  coords: 'free',
  // Los pesos nacen en cero: el recorrido de cada palabra da su aparición.
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'nube',
  items: ['palabra', 'palabras'],
  texts: (o, x) => ({ word: x, group: o.group }),
  draw(ctx) {
    if (!(ctx.width > 0 && ctx.height > 0)) return '';
    const { m, g } = geometryOf(ctx);
    if (!m.words.length) return '';
    const inks = colorsOf(ctx, m);
    const n = m.words.length;
    let s = legendMarkup(ctx, g.legend);
    for (const p of g.placed) {
      if (p) s += wordMarkup(p, inks[p.word], appearance(progress(ctx, m.words[p.word]), p.word, n));
    }
    return s;
  },
  hit(ctx, px, py) {
    const { m, g } = geometryOf(ctx);
    const k = hitWord(g.placed, px, py);
    return k >= 0 ? m.words[k].row : -1;
  },
  anchor(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const k = m.rowWord[i];
    const p = k >= 0 ? g.placed[k] : null;
    return p ? [p.x, p.box.y0] : null;
  },
  hover(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const k = m.rowWord[i];
    const p = k >= 0 ? g.placed[k] : null;
    if (!p) return '';
    const th = ctx.theme;
    // Velo sobre el resto; encima, un fondo suave detrás de la palabra y la palabra entera.
    const veil = `<rect${attrs({ x: -2, y: -2, width: r2(ctx.width + 4), height: r2(ctx.height + 4), fill: th.surface, 'fill-opacity': VEIL_ALPHA })}/>`;
    const b = p.box;
    const back = `<rect${attrs({ x: r2(b.x0), y: r2(b.y0), width: r2(b.x1 - b.x0), height: r2(b.y1 - b.y0), rx: 4, fill: th.highlight })}/>`;
    return veil + back + wordMarkup(p, colorsOf(ctx, m)[k]);
  },
  headline(ps, i, x) {
    const m = modelOf(ps);
    const k = m.rowWord[i];
    return k >= 0 ? m.words[k].text : x;
  },
  navigable(ps) {
    const m = modelOf(ps);
    const out = omittedOf.get(m);
    return m.words.filter((_, k) => !out?.has(k)).map((w) => w.row);
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const m = modelOf(ps);
    const k = m.rowWord[i];
    const v = ps.values[i];
    if (k < 0) {
      if (!normalizeWord(ps.texts.word?.[i] ?? ''))
        return { value: isFinite(v) ? format.value(v) : 'Sin dato', details: [['No se dibuja', 'sin palabra']] };
      // Sin dato: el núcleo escribe "Sin dato".
      if (Number.isNaN(v)) return null;
      return { value: format.value(v), details: [['No se dibuja', 'el peso no es positivo']] };
    }
    const w = m.words[k];
    if (w.row !== i) return { value: format.value(v), details: [['Se suma en', `${w.text} (${format.value(w.weight)})`]] };
    const details: [string, string][] = [['Del total', format.percent(w.weight / m.total)]];
    if (w.rows.length > 1) details.push(['Filas sumadas', format.number(w.rows.length)]);
    if (m.groups.length) details.push(['Grupo', w.group >= 0 ? m.groups[w.group] : 'Sin grupo']);
    if (omittedOf.get(m)?.has(k)) details.push(['No se dibuja', 'no cabe']);
    return { value: format.value(w.weight), details };
  },
};
