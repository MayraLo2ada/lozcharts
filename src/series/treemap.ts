/**
 * Treemap (LozTreemap): cada fila es un rectángulo cuya área es proporcional a su valor; con
 * `group`, los rectángulos se juntan en un bloque por grupo, con su nombre y su total arriba.
 *
 * Distribución "squarified" (Bruls, Huizing y van Wijk, 2000): los rectángulos se acercan a
 * cuadrados, que es donde el ojo compara áreas con menos error que en tiras finas.
 *
 * Color: sin grupos, todos del color de la serie (el tamaño dice el valor; la identidad, la
 * etiqueta). Con grupos, uno por grupo en el orden de la paleta según su primera aparición, y
 * los que pasan de 8 en el gris de "Otros": nunca se cicla. Los textos de adentro van en el
 * color de mayor contraste con el relleno (texto o superficie del tema), nunca del de la serie.
 *
 * Toda la geometría (squarify, bloques, contraste, ajuste de etiquetas) son funciones puras.
 */
import {
  dimOpacity,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { MAX_COLORS } from '../core/theme';
import { attrs, esc } from '../core/dom';
import { inkFor } from '../core/color';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';

/** Aire entre rectángulos vecinos (superficie, no borde). */
const GAP = 2;
/** Aire entre bloques de grupo: el doble, para que cada grupo se lea como un solo bloque. */
const GROUP_GAP = 4;
const RADIUS = 2;
/** Franja del nombre del grupo: 12 px de texto con aire arriba y abajo. */
export const HEADER = 20;
/** Sin este ancho y este alto de cuerpo, el bloque no lleva franja: la sacrificaría entera. */
const HEADER_MIN_W = 56;
const HEADER_MIN_BODY = 24;
/** Aire entre el borde del rectángulo y su texto. */
const PAD = 6;
/** Alto de una línea de 12 px y separación entre nombre y valor. */
const LINE = 14;
const LINE_GAP = 2;
const FONT = 12;
/**
 * measure() mide con peso normal; con 500 y 600 el texto es algo más ancho. Se infla la medida
 * para no rozar el borde.
 */
const WEIGHT_500 = 1.05;
const WEIGHT_600 = 1.08;
/** Un nombre recortado con menos letras que esto no identifica nada: mejor sin etiqueta. */
const MIN_CHARS = 4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const positive = (v: number) => isFinite(v) && v > 0;

/**
 * Orden de distribución: de mayor a menor según `target` (los valores finales), con el índice
 * como desempate. Entran los que tienen valor positivo en `target` o en `current` (el cuadro
 * animado): el que se va a cero se encoge en su lugar en vez de desaparecer de golpe.
 *
 * Se ordena por el final y no por el cuadro animado: si dos rectángulos se cruzan en tamaño a
 * mitad de la animación, ordenar por el valor animado los haría saltar de lugar.
 */
export function layoutOrder(target: readonly number[], current: readonly number[] = target): number[] {
  const out: number[] = [];
  for (let i = 0; i < target.length; i++) if (positive(target[i]) || positive(current[i])) out.push(i);
  const t = (i: number) => (positive(target[i]) ? target[i] : 0);
  return out.sort((a, b) => t(b) - t(a) || a - b);
}

/** Peor proporción (lado largo / lado corto, ≥ 1) de una fila de áreas apoyada sobre un lado `side`. */
function worst(sum: number, min: number, max: number, side: number): number {
  const s2 = sum * sum;
  const w2 = side * side;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

/**
 * Squarified treemap. Devuelve un rectángulo por índice de `values` (null si su valor no es
 * positivo o no está en `order`), cubriendo `rect` exactamente.
 *
 * El algoritmo, tal como lo describe el artículo: se recorren las áreas de mayor a menor y se
 * van agregando a una fila apoyada sobre el lado corto del espacio libre mientras eso no empeore
 * la peor proporción de la fila. Cuando empeoraría, la fila se cierra (ocupa una franja de ese
 * lado) y se empieza otra en lo que queda.
 */
export function squarify(values: readonly number[], rect: Rect, order: readonly number[] = layoutOrder(values)): (Rect | null)[] {
  const out: (Rect | null)[] = values.map(() => null);
  const items = order.filter((i) => positive(values[i]));
  let total = 0;
  for (const i of items) total += values[i];
  if (!items.length || !(rect.w > 0) || !(rect.h > 0)) {
    for (const i of items) out[i] = { x: rect.x, y: rect.y, w: 0, h: 0 };
    return out;
  }
  const scale = (rect.w * rect.h) / total;
  let { x, y, w, h } = rect;
  let row: number[] = [];
  let sum = 0;
  let min = Infinity;
  let max = 0;

  const flush = () => {
    // Fila vertical a la izquierda si el espacio es ancho; horizontal arriba si es alto.
    const vertical = w >= h;
    const side = vertical ? h : w;
    const thick = side > 0 ? sum / side : 0;
    let at = vertical ? y : x;
    for (const i of row) {
      const len = thick > 0 ? (values[i] * scale) / thick : 0;
      out[i] = vertical ? { x, y: at, w: thick, h: len } : { x: at, y, w: len, h: thick };
      at += len;
    }
    if (vertical) {
      x += thick;
      w = Math.max(0, w - thick);
    } else {
      y += thick;
      h = Math.max(0, h - thick);
    }
    row = [];
    sum = 0;
    min = Infinity;
    max = 0;
  };

  for (const i of items) {
    const a = values[i] * scale;
    const side = Math.min(w, h);
    if (row.length && worst(sum + a, Math.min(min, a), Math.max(max, a), side) > worst(sum, min, max, side)) flush();
    row.push(i);
    sum += a;
    min = Math.min(min, a);
    max = Math.max(max, a);
  }
  if (row.length) flush();
  return out;
}

/** Rectángulo achicado `d` px por lado (nunca negativo). */
export function inset(r: Rect, d: number): Rect {
  const w = Math.max(0, r.w - 2 * d);
  const h = Math.max(0, r.h - 2 * d);
  return { x: r.x + Math.min(d, r.w / 2), y: r.y + Math.min(d, r.h / 2), w, h };
}

/** Posición de cada grupo en la paleta por orden de primera aparición en los datos. */
export function groupSlots(groups: readonly string[]): Map<string, number> {
  const slots = new Map<string, number>();
  for (const g of groups) if (!slots.has(g)) slots.set(g, slots.size);
  return slots;
}

/** Color de un grupo: la paleta en orden; desde el noveno (o tras una paleta más corta), "Otros". */
export function groupColor(slot: number, palette: readonly string[], other: string): string {
  return slot >= 0 && slot < Math.min(MAX_COLORS, palette.length) ? palette[slot] : other;
}

/** Sumas positivas por grupo (los valores ≤ 0 o faltantes no ocupan área). */
export function groupTotals(values: readonly number[], groups: readonly string[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (let i = 0; i < values.length; i++) {
    const g = groups[i] ?? '';
    totals.set(g, (totals.get(g) ?? 0) + (positive(values[i]) ? values[i] : 0));
  }
  return totals;
}

/**
 * Orden de lectura (teclado): grupo por grupo, del de mayor total al menor, y dentro de cada uno
 * del mayor al menor. Solo los datos con valor positivo: los demás no tienen rectángulo.
 */
export function readingOrder(values: readonly number[], groups: readonly string[] | null): number[] {
  const order = layoutOrder(values).filter((i) => positive(values[i]));
  if (!groups) return order;
  const totals = groupTotals(values, groups);
  const first = groupSlots(groups);
  const g = (i: number) => groups[i] ?? '';
  // sort es estable: dentro de un grupo se conserva el orden por valor.
  return order.sort((a, b) => totals.get(g(b))! - totals.get(g(a))! || first.get(g(a))! - first.get(g(b))!);
}

/** Un bloque de grupo ya ubicado. */
export interface GroupBox {
  name: string;
  /** Posición en la paleta (orden de primera aparición). */
  slot: number;
  /** Bloque completo (ya sin el aire entre grupos) y si lleva franja con su nombre. */
  box: Rect;
  header: boolean;
}

export interface TreemapLayout {
  /** Celda de cada índice antes del aire: cubre el espacio sin huecos (para el hit-test). */
  cells: (Rect | null)[];
  /** Rectángulo dibujado de cada índice (la celda menos el aire). */
  tiles: (Rect | null)[];
  groups: GroupBox[];
}

/**
 * Distribuye un área de width × height. Las celdas se calculan en el área agrandada medio aire
 * por lado y luego se achican medio aire: entre vecinos queda el aire completo y los bordes
 * exteriores caen justo en el borde del área.
 *
 * `current` son los valores del cuadro (dan las áreas); `target`, los finales (dan el orden).
 * Con grupos, primero se reparten los bloques según sus totales y luego cada bloque, por dentro.
 */
export function treemapLayout(
  current: readonly number[],
  target: readonly number[],
  groups: readonly string[] | null,
  width: number,
  height: number,
): TreemapLayout {
  const area: Rect = { x: 0, y: 0, w: width, h: height };
  const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  const place = (vals: readonly number[], order: number[], into: Rect) => {
    const cells = squarify(vals, grow(into, GAP / 2), order);
    return { cells, tiles: cells.map((c) => c && inset(c, GAP / 2)) };
  };
  if (!groups) return { ...place(current, layoutOrder(target, current), area), groups: [] };

  const cells: (Rect | null)[] = current.map(() => null);
  const tiles: (Rect | null)[] = current.map(() => null);
  const slots = groupSlots(groups);
  const names = [...slots.keys()];
  const now = groupTotals(current, groups);
  const goal = groupTotals(target, groups);
  const boxes = squarify(
    names.map((g) => now.get(g)!),
    grow(area, GROUP_GAP / 2),
    layoutOrder(
      names.map((g) => goal.get(g)!),
      names.map((g) => now.get(g)!),
    ),
  );
  const out: GroupBox[] = [];
  names.forEach((name, k) => {
    const cell = boxes[k];
    if (!cell) return;
    const box = inset(cell, GROUP_GAP / 2);
    const header = box.w >= HEADER_MIN_W && box.h >= HEADER + HEADER_MIN_BODY;
    const body = header ? { ...box, y: box.y + HEADER, h: box.h - HEADER } : box;
    const members = layoutOrder(target, current).filter((i) => (groups[i] ?? '') === name);
    const inner = place(current, members, body);
    for (const i of members) {
      cells[i] = inner.cells[i];
      tiles[i] = inner.tiles[i];
    }
    out.push({ name, slot: k, box, header });
  });
  return { cells, tiles, groups: out };
}

/** Índice de la celda bajo (px, py), o -1 (afuera, en la franja de un grupo o entre grupos). */
export function hitCell(cells: readonly (Rect | null)[], px: number, py: number): number {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c && c.w > 0 && c.h > 0 && px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h) return i;
  }
  return -1;
}

// ------------------------------------------------------------ Contraste

/** La tinta sobre un relleno vive en core/color.ts; se reexporta para los tipos que la tomaban de aquí. */
export { inkFor };

// ------------------------------------------------------------ Etiquetas

/**
 * Qué cabe adentro de un rectángulo de w × h: el nombre (recortado con "…") y el valor debajo.
 * El valor exacto, o el compacto si no cabe, o ninguno; sin nombre, tampoco valor (un número
 * suelto no dice de qué es). Devuelve null si no cabe nada.
 */
export function fitTileLabel(
  w: number,
  h: number,
  name: string,
  values: readonly string[],
  measure: (s: string) => number,
): { name: string; value: string } | null {
  const room = w - 2 * PAD;
  if (!name || room <= 0 || h < PAD + LINE + PAD / 2) return null;
  const m500 = (s: string) => measure(s) * WEIGHT_500;
  const fitted = fitText(name, room, m500);
  if (fitted !== name && fitted.length - 1 < Math.min(MIN_CHARS, name.length)) return null;
  let value = '';
  if (h >= PAD + 2 * LINE + LINE_GAP + PAD / 2) value = values.find((v) => v && measure(v) <= room) ?? '';
  return { name: fitted, value };
}

/** Franja del grupo: el nombre y, si cabe, el total. null si ni el nombre cabe. */
export function fitHeader(
  w: number,
  name: string,
  totals: readonly string[],
  measure: (s: string) => number,
): { name: string; total: string } | null {
  const m600 = (s: string) => measure(s) * WEIGHT_600;
  const full = m600(name);
  const total = totals.find((t) => t && full + PAD + measure(t) <= w) ?? '';
  if (total) return { name, total };
  const fitted = fitText(name, w, m600);
  if (fitted !== name && fitted.length - 1 < Math.min(MIN_CHARS, name.length)) return null;
  return { name: fitted, total: '' };
}

// ------------------------------------------------------------ Serie

const groupsOf = (ps: PreparedSeries): string[] | null => (ps.options.group ? (ps.texts.group ?? null) : null);

/** El layout se calcula una vez por cuadro: draw, hit, anchor y hover reciben el mismo `y1`. */
const layoutCache = new WeakMap<readonly number[], { w: number; h: number; L: TreemapLayout }>();

function layoutOf(ctx: DrawContext): TreemapLayout {
  const { y1, ps } = ctx.frame;
  const hit = layoutCache.get(y1);
  if (hit && hit.w === ctx.width && hit.h === ctx.height) return hit.L;
  const L = treemapLayout(y1, ps.values, groupsOf(ps), ctx.width, ctx.height);
  layoutCache.set(y1, { w: ctx.width, h: ctx.height, L });
  return L;
}

/** Color de relleno del índice i. */
function fillOf(ctx: DrawContext, groups: string[] | null, slots: Map<string, number> | null, i: number): string {
  if (!groups || !slots) return ctx.color;
  return groupColor(slots.get(groups[i] ?? '') ?? -1, ctx.theme.palette, ctx.theme.other);
}

function text(x: number, y: number, s: string, fill: string, extra: Record<string, string | number | undefined> = {}): string {
  return `<text${attrs({ x: r2(x), y: r2(y), fill, 'font-size': FONT, 'dominant-baseline': 'central', ...extra })}>${esc(s)}</text>`;
}

function rect(r: Rect, extra: Record<string, string | number | undefined>): string {
  return `<rect${attrs({ x: r2(r.x), y: r2(r.y), width: r2(r.w), height: r2(r.h), rx: Math.min(RADIUS, r.w / 2, r.h / 2), ...extra })}/>`;
}

/** Nombre del grupo para mostrar: un grupo vacío en los datos no queda sin nombre. */
const groupName = (g: string) => g || 'Sin grupo';

export const treemap: SeriesImpl = {
  coords: 'free',
  // Las áreas nacen en cero: al entrar, todas crecen en proporción (el layout queda quieto y aparece).
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'rectángulos',
  items: ['parte', 'partes'],
  texts: (o) => ({ group: o.group }),
  navigable: (ps) => readingOrder(ps.values, groupsOf(ps)),
  headline(ps, i, x) {
    const groups = groupsOf(ps);
    return groups ? `${groupName(groups[i] ?? '')} › ${x}` : x;
  },
  dimmable: true,
  draw(ctx) {
    const L = layoutOf(ctx);
    const ps = ctx.frame.ps;
    const groups = groupsOf(ps);
    const slots = groups && groupSlots(groups);
    const th = ctx.theme;
    const showLabels = ps.options.labels !== false;
    let shapes = '';
    let labels = '';
    for (let i = 0; i < L.tiles.length; i++) {
      const t = L.tiles[i];
      if (!t || t.w < 0.5 || t.h < 0.5) continue;
      const fill = fillOf(ctx, groups, slots, i);
      const opacity = dimOpacity(ctx, i);
      shapes += rect(t, { fill, opacity });
      if (!showLabels) continue;
      // Textos con el valor final, no el animado: no tiemblan mientras el rectángulo cambia.
      const v = ps.values[i];
      const fit = fitTileLabel(t.w, t.h, ctx.label(i), [ctx.format(v), ctx.compact(v)], ctx.measure);
      if (!fit) continue;
      const ink = inkFor(fill, th);
      const top = t.y + PAD + LINE / 2;
      labels += text(t.x + PAD, top, fit.name, ink, { 'font-weight': 500, opacity });
      if (fit.value)
        labels += text(t.x + PAD, top + LINE + LINE_GAP, fit.value, ink, { 'font-variant-numeric': 'tabular-nums', opacity });
    }
    // Franjas de grupo sobre la superficie: texto principal y total en secundario, como un título.
    if (showLabels && groups) {
      const totals = groupTotals(ps.values, groups);
      for (const g of L.groups) {
        if (!g.header) continue;
        const sum = totals.get(g.name) ?? 0;
        const fit = fitHeader(g.box.w, groupName(g.name), [ctx.format(sum), ctx.compact(sum)], ctx.measure);
        if (!fit) continue;
        const y = g.box.y + HEADER / 2 - 1;
        labels += text(g.box.x, y, fit.name, th.text, { 'font-weight': 600 });
        if (fit.total) {
          const x = g.box.x + ctx.measure(fit.name) * WEIGHT_600 + PAD;
          labels += text(x, y, fit.total, th.textMuted, { 'font-variant-numeric': 'tabular-nums' });
        }
      }
    }
    return shapes + labels;
  },
  hit(ctx, px, py) {
    return hitCell(layoutOf(ctx).cells, px, py);
  },
  // El relleno del rectángulo: el color de su grupo.
  swatch(ctx, i) {
    const groups = groupsOf(ctx.frame.ps);
    return fillOf(ctx, groups, groups && groupSlots(groups), i);
  },
  anchor(ctx, i) {
    const t = layoutOf(ctx).tiles[i];
    return t ? [t.x + t.w / 2, t.y] : [ctx.width / 2, ctx.height / 2];
  },
  hover(ctx, i) {
    const t = layoutOf(ctx).tiles[i];
    if (!t || t.w < 6 || t.h < 6) return '';
    // Anillo por dentro (no invade a los vecinos): 2 px de texto y 1 px de superficie que lo
    // separa del relleno, así se ve sobre cualquier color.
    const outer = inset(t, 1);
    const inner = inset(t, 2.5);
    const th = ctx.theme;
    return (
      rect(outer, { fill: 'none', stroke: th.text, 'stroke-opacity': 0.85, 'stroke-width': 2 }) +
      rect(inner, { fill: 'none', stroke: th.surface, 'stroke-width': 1 })
    );
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const v = ps.values[i];
    // Sin dato: el núcleo escribe "Sin dato".
    if (!isFinite(v)) return null;
    // Cero o negativo: el valor real (está en los datos), sin partes: no ocupa área.
    if (v <= 0) return { value: format.value(v) };
    let total = 0;
    for (const x of ps.values) if (positive(x)) total += x;
    const details: [string, string][] = [['Del total', format.percent(v / total)]];
    const groups = groupsOf(ps);
    if (groups) {
      const g = groups[i] ?? '';
      const sum = groupTotals(ps.values, groups).get(g) ?? 0;
      details.push([`De ${groupName(g)}`, format.percent(v / sum)]);
    }
    return { value: format.value(v), details };
  },
};
