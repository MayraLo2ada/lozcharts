/**
 * Sankey (LozSankey): flujos entre etapas. Cada fila de datos es un flujo, del origen (la X)
 * al destino (`to`), con su valor; los nodos son los nombres que aparecen.
 *
 * Columnas por el camino más largo desde un origen, con los destinos finales alineados a la
 * derecha: son resultados (compra, abandono) y se comparan mejor sobre un borde común. El alto
 * de cada nodo es max(entrada, salida); una escala única para todas las columnas, la que hace
 * caber a la más cargada. El orden dentro de cada columna se mejora con baricentros pesados, y
 * de todos los órdenes probados queda el de menos cruces (nunca peor que el de los datos).
 *
 * Color: cada origen (columna 0) toma la paleta en el orden de los datos, sin ciclar; los demás
 * nodos heredan el color del origen que más flujo les aporta, y cada cinta el de su origen. Así
 * se sigue "de dónde viene" lo que llega a cada nodo. Los textos van en el color del tema.
 *
 * Los flujos sin valor positivo, sin uno de sus extremos o de un nodo a sí mismo no se dibujan
 * (la tabla los lista igual). Si un flujo cierra un ciclo, tampoco: se avisa una vez en consola.
 *
 * Toda la geometría (grafo, columnas, orden, layout, cintas, hit-test) son funciones puras.
 */
import {
  dimmed,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { attrs, esc } from '../core/dom';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';

/** Ancho de los nodos y su radio. */
export const NODE_WIDTH = 12;
const NODE_RADIUS = 2;
/** Separación vertical entre nodos de una columna; se achica si hay muchos. */
const NODE_GAP = 12;
/** Los huecos ocupan como máximo esta fracción del alto: con muchos nodos, los datos mandan. */
const GAP_SHARE = 0.3;
/** Pasadas de baricentro (ida y vuelta cada una). Más no suele mejorar en grafos de este tamaño. */
const ORDER_PASSES = 6;
/** Opacidad de las cintas: dejan ver los cruces sin tapar los nodos. Algo más en oscuro, donde se apagan. */
const LINK_ALPHA = { light: 0.35, dark: 0.38 };
const ACTIVE_ALPHA = 0.65;
/** Velo de superficie sobre lo que no es el flujo activo. */
const VEIL_ALPHA = 0.55;
/** Una cinta finísima se puede apuntar igual: tolerancia mínima de medio alto, en px. */
const HIT_SLOP = 3;
// Etiquetas.
const FONT = 12;
/** Distancia mínima entre centros de dos etiquetas de la misma columna. */
const LINE = 15;
/** Aire entre el nodo y su etiqueta, y entre el nombre y el valor. */
const PAD = 6;
const SPACE = 4;
/** Ancho máximo de una etiqueta: un nombre larguísimo no se come el gráfico. */
const MAX_LABEL = 240;
/** Por debajo de este ancho ni un nombre recortado se lee: mejor sin etiqueta. */
const MIN_LABEL = 28;

/** Un flujo dibujable: `index` es su fila en los datos; `source` y `target`, nodos. */
export interface Link {
  index: number;
  source: number;
  target: number;
  value: number;
}

export interface Graph {
  /** Nombre de cada nodo, en el orden en que aparece en los datos. */
  names: string[];
  /** Flujos que se dibujan, en el orden de los datos. */
  links: Link[];
  /** Filas sin valor positivo, sin un extremo o de un nodo a sí mismo. */
  ignored: number[];
  /** Filas que cerraban un ciclo. */
  dropped: number[];
}

/** ¿Un flujo se puede dibujar? Valor positivo y finito, dos extremos y distintos. */
function valid(source: string, target: string, value: number): boolean {
  return isFinite(value) && value > 0 && source !== '' && target !== '' && source !== target;
}

/**
 * Grafo de los datos: nodos por primera aparición y flujos válidos sin ciclos.
 * Ver removeCycles para cuál flujo se suelta.
 */
export function buildGraph(sources: readonly string[], targets: readonly string[], values: readonly number[]): Graph {
  const ids = new Map<string, number>();
  const names: string[] = [];
  const id = (name: string) => {
    let k = ids.get(name);
    if (k === undefined) {
      k = names.length;
      ids.set(name, k);
      names.push(name);
    }
    return k;
  };
  const candidates: Link[] = [];
  const ignored: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const s = sources[i] ?? '';
    const t = targets[i] ?? '';
    if (!valid(s, t, values[i])) ignored.push(i);
    else candidates.push({ index: i, source: id(s), target: id(t), value: values[i] });
  }
  const { kept, dropped } = removeCycles(names.length, candidates);
  return { names, links: kept, ignored, dropped: dropped.map((l) => l.index) };
}

/**
 * Quita los flujos que cierran un ciclo. Se recorren en el orden de los datos y se suelta el que
 * uniría un destino que ya llega a su origen: el orden de los datos suele ser el de importancia,
 * así que se conserva lo primero que dio la persona. El resultado es determinista.
 */
export function removeCycles(nodeCount: number, links: readonly Link[]): { kept: Link[]; dropped: Link[] } {
  const next: number[][] = Array.from({ length: nodeCount }, () => []);
  const kept: Link[] = [];
  const dropped: Link[] = [];
  const reaches = (from: number, to: number) => {
    const seen = new Uint8Array(nodeCount);
    const stack = [from];
    while (stack.length) {
      const v = stack.pop()!;
      if (v === to) return true;
      if (seen[v]) continue;
      seen[v] = 1;
      for (const w of next[v]) if (!seen[w]) stack.push(w);
    }
    return false;
  };
  for (const l of links) {
    if (reaches(l.target, l.source)) dropped.push(l);
    else {
      kept.push(l);
      next[l.source].push(l.target);
    }
  }
  return { kept, dropped };
}

/**
 * Columna de cada nodo: el camino más largo desde un origen (los orígenes en la 0). Los nodos
 * sin salida van a la última columna: son resultados y se leen juntos, a la derecha.
 * El grafo no debe tener ciclos (ver removeCycles). Todos los flujos quedan de izquierda a derecha.
 */
export function nodeColumns(nodeCount: number, links: readonly Link[]): number[] {
  const indeg = new Array<number>(nodeCount).fill(0);
  const outs: number[][] = Array.from({ length: nodeCount }, () => []);
  for (const l of links) {
    indeg[l.target]++;
    outs[l.source].push(l.target);
  }
  const depth = new Array<number>(nodeCount).fill(0);
  const queue: number[] = [];
  for (let v = 0; v < nodeCount; v++) if (indeg[v] === 0) queue.push(v);
  for (let q = 0; q < queue.length; q++) {
    const v = queue[q];
    for (const w of outs[v]) {
      depth[w] = Math.max(depth[w], depth[v] + 1);
      if (--indeg[w] === 0) queue.push(w);
    }
  }
  const last = Math.max(0, ...depth);
  return depth.map((d, v) => (outs[v].length === 0 && nodeCount > 1 ? last : d));
}

/** Entrada, salida y valor (el mayor de los dos) de cada nodo, con el tamaño dado de cada flujo. */
export function nodeValues(
  nodeCount: number,
  links: readonly Link[],
  size: (l: Link) => number = (l) => l.value,
): { inflow: number[]; outflow: number[]; value: number[] } {
  const inflow = new Array<number>(nodeCount).fill(0);
  const outflow = new Array<number>(nodeCount).fill(0);
  for (const l of links) {
    const v = size(l);
    outflow[l.source] += v;
    inflow[l.target] += v;
  }
  return { inflow, outflow, value: inflow.map((v, k) => Math.max(v, outflow[k])) };
}

/** Centro relativo (0 a 1) de cada nodo dentro de su columna, apilando por valor. */
function relativeCenters(order: readonly (readonly number[])[], value: readonly number[], into: number[]): void {
  for (const col of order) {
    const total = col.reduce((s, v) => s + value[v], 0);
    let acc = 0;
    col.forEach((v, r) => {
      // Una columna sin valor (todo en cero) se reparte por posición.
      into[v] = total > 0 ? (acc + value[v] / 2) / total : (r + 0.5) / col.length;
      acc += value[v];
    });
  }
}

/**
 * Cruces pesados entre flujos que unen las mismas dos columnas: dos flujos se cruzan si sus
 * orígenes y sus destinos quedan en orden inverso. Cada cruce pesa el producto de los valores:
 * cruzar dos cintas gruesas molesta más que dos finas.
 */
export function crossings(links: readonly Link[], columns: readonly number[], center: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < links.length; i++) {
    const a = links[i];
    for (let j = i + 1; j < links.length; j++) {
      const b = links[j];
      if (a.source === b.source || a.target === b.target) continue;
      if (columns[a.source] !== columns[b.source] || columns[a.target] !== columns[b.target]) continue;
      if ((center[a.source] - center[b.source]) * (center[a.target] - center[b.target]) < 0) total += a.value * b.value;
    }
  }
  return total;
}

/**
 * Orden de los nodos en cada columna. Empieza por la primera aparición en los datos y hace
 * pasadas de baricentro pesado: de izquierda a derecha cada nodo va a la altura media de sus
 * orígenes (pesada por flujo) y de derecha a izquierda, a la de sus destinos. Queda el orden
 * con menos cruces de todos los probados, así que nunca empeora el de los datos.
 */
export function orderNodes(
  nodeCount: number,
  links: readonly Link[],
  columns: readonly number[],
  value: readonly number[],
): { order: number[][]; center: number[] } {
  const count = nodeCount ? Math.max(...columns) + 1 : 0;
  const order: number[][] = Array.from({ length: count }, () => []);
  for (let v = 0; v < nodeCount; v++) order[columns[v]].push(v);
  const ins: Link[][] = Array.from({ length: nodeCount }, () => []);
  const outs: Link[][] = Array.from({ length: nodeCount }, () => []);
  for (const l of links) {
    ins[l.target].push(l);
    outs[l.source].push(l);
  }
  const center = new Array<number>(nodeCount).fill(0);
  relativeCenters(order, value, center);
  let best = order.map((c) => c.slice());
  let bestCenter = center.slice();
  let bestCross = crossings(links, columns, center);
  const sweep = (c: number, side: Link[][], other: (l: Link) => number) => {
    const bary = new Map<number, number>();
    for (const v of order[c]) {
      let w = 0;
      let s = 0;
      for (const l of side[v]) {
        w += l.value;
        s += l.value * center[other(l)];
      }
      // Sin vecinos de ese lado, el nodo conserva su altura.
      bary.set(v, w > 0 ? s / w : center[v]);
    }
    // sort es estable: los empates conservan el orden anterior.
    order[c].sort((a, b) => bary.get(a)! - bary.get(b)!);
    relativeCenters([order[c]], value, center);
  };
  for (let pass = 0; pass < ORDER_PASSES && bestCross > 0; pass++) {
    for (let c = 1; c < count; c++) sweep(c, ins, (l) => l.source);
    for (let c = count - 2; c >= 0; c--) sweep(c, outs, (l) => l.target);
    const cross = crossings(links, columns, center);
    if (cross < bestCross) {
      bestCross = cross;
      best = order.map((c) => c.slice());
      bestCenter = center.slice();
    }
  }
  return { order: best, center: bestCenter };
}

/**
 * Posición en la paleta de cada nodo: los orígenes (columna 0), en el orden de los datos, hasta
 * `maxColors`; los que sobran, -1 (el gris "otros"; nunca se cicla). Cada nodo siguiente toma el
 * color del origen que más flujo le aporta, repartiendo lo que llega a cada nodo según su mezcla.
 */
export function nodeSlots(nodeCount: number, links: readonly Link[], columns: readonly number[], maxColors: number): number[] {
  const roots: number[] = [];
  for (let v = 0; v < nodeCount; v++) if (columns[v] === 0) roots.push(v);
  const R = roots.length;
  const mix = Array.from({ length: nodeCount }, () => new Float64Array(R));
  roots.forEach((v, r) => (mix[v][r] = 1));
  const ins: Link[][] = Array.from({ length: nodeCount }, () => []);
  for (const l of links) ins[l.target].push(l);
  // Por columnas: todos los flujos van de izquierda a derecha, así que el origen ya está listo.
  const byColumn = Array.from({ length: nodeCount }, (_, v) => v).sort((a, b) => columns[a] - columns[b]);
  const slots = new Array<number>(nodeCount).fill(-1);
  for (const v of byColumn) {
    if (columns[v] > 0) {
      for (const l of ins[v]) {
        const src = mix[l.source];
        let total = 0;
        for (let r = 0; r < R; r++) total += src[r];
        if (total > 0) for (let r = 0; r < R; r++) mix[v][r] += (l.value * src[r]) / total;
      }
    }
    let top = -1;
    for (let r = 0; r < R; r++) if (top < 0 || mix[v][r] > mix[v][top]) top = r;
    slots[v] = top >= 0 && top < maxColors ? top : -1;
  }
  return slots;
}

/** Todo lo que no depende del tamaño del gráfico ni del cuadro de la animación. */
export interface SankeyModel extends Graph {
  columns: number[];
  columnCount: number;
  order: number[][];
  /** Centro relativo de cada nodo en su columna (0 a 1): ordena puertos y teclado sin saltos. */
  center: number[];
  value: number[];
  inflow: number[];
  outflow: number[];
  slots: number[];
  /** Flujos de salida y de entrada de cada nodo, ya en el orden en que se apilan. */
  outs: Link[][];
  ins: Link[][];
  byRow: Map<number, Link>;
}

/** Modelo del sankey a partir de las columnas de la tabla. */
export function buildModel(
  sources: readonly string[],
  targets: readonly string[],
  values: readonly number[],
  maxColors = 8,
): SankeyModel {
  const graph = buildGraph(sources, targets, values);
  const n = graph.names.length;
  const columns = nodeColumns(n, graph.links);
  const { inflow, outflow, value } = nodeValues(n, graph.links);
  const { order, center } = orderNodes(n, graph.links, columns, value);
  const outs: Link[][] = Array.from({ length: n }, () => []);
  const ins: Link[][] = Array.from({ length: n }, () => []);
  for (const l of graph.links) {
    outs[l.source].push(l);
    ins[l.target].push(l);
  }
  // Dentro de un nodo, cada cinta sale a la altura de su destino y llega a la de su origen:
  // así no se cruzan pegadas al nodo. En empate de altura, primero la columna más cercana.
  const at = (v: number) => columns[v] + center[v];
  for (const list of outs) list.sort((a, b) => center[a.target] - center[b.target] || at(a.target) - at(b.target));
  for (const list of ins) list.sort((a, b) => center[a.source] - center[b.source] || at(a.source) - at(b.source));
  return {
    ...graph,
    columns,
    columnCount: order.length,
    order,
    center,
    value,
    inflow,
    outflow,
    slots: nodeSlots(n, graph.links, columns, maxColors),
    outs,
    ins,
    byRow: new Map(graph.links.map((l) => [l.index, l])),
  };
}

export interface NodeBox {
  x: number;
  y0: number;
  y1: number;
}

/** Una cinta: de (x0, sy) a (x1, ty), con el centro en sy/ty y `width` de alto. */
export interface Ribbon {
  index: number;
  source: number;
  target: number;
  x0: number;
  x1: number;
  sy: number;
  ty: number;
  width: number;
}

export interface Geometry {
  nodes: NodeBox[];
  /** Cintas en orden de dibujo: las gruesas primero, las finas encima. */
  ribbons: Ribbon[];
  byRow: Map<number, Ribbon>;
  /** px por unidad de valor. */
  k: number;
  gap: number;
}

/**
 * Layout en px. `sizes` es el valor de cada fila en este cuadro (la animación); el orden y la
 * escala salen del modelo, así los nodos crecen en su lugar en vez de saltar. La escala es la
 * menor entre la de los valores finales y la de los actuales: al achicarse los datos, nada se
 * sale del área a mitad de la animación.
 */
export function layoutSankey(
  m: SankeyModel,
  sizes: readonly number[],
  width: number,
  height: number,
  nodeWidth = NODE_WIDTH,
): Geometry {
  const n = m.names.length;
  const size = (l: Link) => {
    const v = sizes[l.index];
    return isFinite(v) && v > 0 ? v : 0;
  };
  const current = nodeValues(n, m.links, size).value;
  const most = Math.max(0, ...m.order.map((c) => c.length));
  const gap = most > 1 ? Math.min(NODE_GAP, (height * GAP_SHARE) / (most - 1)) : 0;
  const scaleOf = (value: readonly number[]) => {
    let k = Infinity;
    for (const col of m.order) {
      const total = col.reduce((s, v) => s + value[v], 0);
      if (total > 0) k = Math.min(k, Math.max(0, height - gap * (col.length - 1)) / total);
    }
    return k;
  };
  const kk = Math.min(scaleOf(m.value), scaleOf(current));
  const k = isFinite(kk) ? kk : 0;
  const step = m.columnCount > 1 ? Math.max(0, width - nodeWidth) / (m.columnCount - 1) : 0;
  const nodes: NodeBox[] = new Array(n);
  for (let c = 0; c < m.columnCount; c++) {
    const col = m.order[c];
    const total = col.reduce((s, v) => s + current[v] * k, 0) + gap * (col.length - 1);
    let y = (height - total) / 2;
    for (const v of col) {
      const h = current[v] * k;
      nodes[v] = { x: c * step, y0: y, y1: y + h };
      y += h + gap;
    }
  }
  const byRow = new Map<number, Ribbon>();
  for (const l of m.links) {
    byRow.set(l.index, {
      index: l.index,
      source: l.source,
      target: l.target,
      x0: nodes[l.source].x + nodeWidth,
      x1: nodes[l.target].x,
      sy: 0,
      ty: 0,
      width: size(l) * k,
    });
  }
  for (let v = 0; v < n; v++) {
    let y = nodes[v].y0;
    for (const l of m.outs[v]) {
      const r = byRow.get(l.index)!;
      r.sy = y + r.width / 2;
      y += r.width;
    }
    y = nodes[v].y0;
    for (const l of m.ins[v]) {
      const r = byRow.get(l.index)!;
      r.ty = y + r.width / 2;
      y += r.width;
    }
  }
  const ribbons = [...byRow.values()].sort((a, b) => b.width - a.width || a.index - b.index);
  return { nodes, ribbons, byRow, k, gap };
}

/**
 * Trazo de una cinta: dos curvas cúbicas con tangentes horizontales y puntos de control en la
 * mitad del tramo, unidas por los bordes verticales en cada nodo.
 */
export function ribbonPath(r: Ribbon): string {
  if (!(r.width > 0.01)) return '';
  const h = r.width / 2;
  const xm = r2((r.x0 + r.x1) / 2);
  const [x0, x1] = [r2(r.x0), r2(r.x1)];
  const [s0, s1, t0, t1] = [r2(r.sy - h), r2(r.sy + h), r2(r.ty - h), r2(r.ty + h)];
  return `M${x0},${s0}C${xm},${s0} ${xm},${t0} ${x1},${t0}L${x1},${t1}C${xm},${t1} ${xm},${s1} ${x0},${s1}Z`;
}

/**
 * Centro vertical de la cinta en la X dada, o NaN fuera de su tramo. Con esos puntos de control,
 * la X avanza como 1,5t − 1,5t² + t³ (siempre creciente): t sale por bisección. Los dos bordes
 * comparten esa X, así que el alto de la cinta en cualquier X es exactamente su ancho.
 */
export function ribbonCenterAt(r: Ribbon, px: number): number {
  const d = r.x1 - r.x0;
  if (d <= 0 || px < r.x0 || px > r.x1) return NaN;
  const u = (px - r.x0) / d;
  let lo = 0;
  let hi = 1;
  for (let it = 0; it < 30; it++) {
    const t = (lo + hi) / 2;
    if (1.5 * t - 1.5 * t * t + t * t * t < u) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return r.sy + (r.ty - r.sy) * (3 * t * t - 2 * t * t * t);
}

/**
 * Fila del flujo bajo el punto, o -1. Sobre un nodo, -1: un nodo no es un flujo, y elegir uno
 * de sus flujos por el lector sería engañoso. Si dos cintas se tocan, gana la más fina: es la
 * que se dibuja encima y la gruesa se alcanza en el resto de su alto.
 */
export function hitRibbon(g: Geometry, px: number, py: number, nodeWidth = NODE_WIDTH): number {
  for (const b of g.nodes) {
    if (b && px >= b.x && px <= b.x + nodeWidth && py >= b.y0 - 1 && py <= b.y1 + 1) return -1;
  }
  let best: Ribbon | null = null;
  for (const r of g.ribbons) {
    if (!(r.width > 0)) continue;
    const c = ribbonCenterAt(r, px);
    if (!isFinite(c) || Math.abs(py - c) > Math.max(r.width / 2, HIT_SLOP)) continue;
    if (!best || r.width < best.width) best = r;
  }
  return best ? best.index : -1;
}

export interface NodeLabel {
  node: number;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  name: string;
  /** Valor formateado, o '' si no cabe. */
  value: string;
}

/**
 * Nombre y valor que caben en `room`: los dos; el valor compacto; solo el nombre; el nombre
 * recortado con "…"; o nada.
 */
export function fitLabel(
  name: string,
  full: string,
  compact: string,
  room: number,
  measure: (s: string) => number,
): { name: string; value: string } | null {
  if (room < MIN_LABEL) return null;
  const nameW = measure(name);
  for (const value of [full, compact]) {
    if (value && nameW + SPACE + measure(value) <= room) return { name, value };
  }
  if (nameW <= room) return { name, value: '' };
  const cut = fitText(name, room, measure);
  return cut === '…' ? null : { name: cut, value: '' };
}

/**
 * Etiquetas de los nodos: a la derecha en todas las columnas salvo la última (a la izquierda).
 * Cada una cabe en el hueco hasta la columna siguiente. El hueco antes de la última lo
 * comparten dos columnas: solo se parte por la mitad donde dos etiquetas quedan a la misma
 * altura; si no, cada una usa el hueco entero (en un móvil, eso es la diferencia entre leer
 * "Abandono" y "Ab…"). En cada columna se ubican primero los nodos mayores y se omite la que se
 * encimaría con otra: nunca hay texto sobre texto.
 */
export function placeLabels(
  m: SankeyModel,
  g: Geometry,
  width: number,
  height: number,
  measure: (s: string) => number,
  texts: (node: number) => { full: string; compact: string },
  nodeWidth = NODE_WIDTH,
): NodeLabel[] {
  const C = m.columnCount;
  if (C < 2) return [];
  const step = (width - nodeWidth) / (C - 1);
  const full = Math.min(MAX_LABEL, step - nodeWidth - 2 * PAD);
  const half = Math.min(MAX_LABEL, (step - nodeWidth - 3 * PAD) / 2);
  // Primero, qué nodos llevan etiqueta (por altura, los mayores primero).
  const picked: { v: number; y: number }[][] = m.order.map((col) => {
    const taken: { v: number; y: number }[] = [];
    for (const v of col.slice().sort((a, b) => m.value[b] - m.value[a])) {
      const box = g.nodes[v];
      const y = Math.min(height - FONT / 2, Math.max(FONT / 2, (box.y0 + box.y1) / 2));
      if (!taken.some((t) => Math.abs(t.y - y) < LINE)) taken.push({ v, y });
    }
    return taken;
  });
  const out: NodeLabel[] = [];
  for (let c = 0; c < C; c++) {
    const last = c === C - 1;
    // La columna que mira al mismo hueco: la penúltima y la última se miran entre sí.
    const facing = last ? picked[C - 2] : c === C - 2 ? picked[C - 1] : [];
    for (const { v, y } of picked[c]) {
      const shared = facing.some((t) => Math.abs(t.y - y) < LINE);
      const t = texts(v);
      const fit = fitLabel(m.names[v], t.full, t.compact, shared ? half : full, measure);
      if (!fit) continue;
      const box = g.nodes[v];
      out.push({
        node: v,
        x: last ? box.x - PAD : box.x + nodeWidth + PAD,
        y,
        anchor: last ? 'end' : 'start',
        ...fit,
      });
    }
  }
  return out;
}

/** Orden del teclado: por columna del origen, luego altura del origen y del destino. */
export function linkOrder(m: SankeyModel): number[] {
  const key = (l: Link) => [m.columns[l.source], m.center[l.source], m.columns[l.target], m.center[l.target]];
  return m.links
    .slice()
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j] - kb[j];
      return a.index - b.index;
    })
    .map((l) => l.index);
}

// ------------------------------------------------------------ Plugin

/**
 * Modelos por conjunto de datos: el núcleo entrega el origen (`from`, el campo de la X) y el
 * destino (`to`) como columnas de texto, así la tabla, el tooltip y el teclado tienen el modelo
 * sin esperar al primer dibujo.
 */
const models = new WeakMap<readonly number[], SankeyModel>();

function modelOf(ps: PreparedSeries): SankeyModel {
  let m = models.get(ps.values);
  if (m) return m;
  const empty = ps.values.map(() => '');
  const sources = ps.texts.from ?? empty;
  const targets = ps.texts.to ?? empty;
  m = buildModel(sources, targets, ps.values);
  models.set(ps.values, m);
  // Un aviso por conjunto de datos, no uno por cuadro.
  if (m.dropped.length) {
    const list = m.dropped.map((i) => `"${sources[i]} → ${targets[i]}"`).join(', ');
    const one = m.dropped.length === 1;
    console.warn(
      `LozCharts: en el sankey "${ps.name}", ${one ? '1 fila cierra' : `${m.dropped.length} filas cierran`} un ciclo y no ${one ? 'se dibuja' : 'se dibujan'}: ${list}. ` +
        `Un sankey va siempre hacia adelante; revisa el sentido de ${one ? 'ese flujo' : 'esos flujos'}.`,
    );
  }
  return m;
}

/** Última geometría: el puntero pregunta muchas veces por el mismo cuadro. */
let lastGeo: { sizes: readonly number[]; m: SankeyModel; w: number; h: number; g: Geometry } | null = null;

function geometryOf(ctx: DrawContext, sizes: readonly number[] = ctx.frame.y1): { m: SankeyModel; g: Geometry } {
  const m = modelOf(ctx.frame.ps);
  const c = lastGeo;
  if (c && c.sizes === sizes && c.m === m && c.w === ctx.width && c.h === ctx.height) return { m, g: c.g };
  const g = layoutSankey(m, sizes, ctx.width, ctx.height);
  lastGeo = { sizes, m, w: ctx.width, h: ctx.height, g };
  return { m, g };
}

const labelCache = new WeakMap<SankeyModel, { w: number; h: number; labels: NodeLabel[] }>();

/**
 * Etiquetas con la geometría final, no la del cuadro: no saltan ni aparecen a mitad de la
 * animación; los nodos crecen hacia ellas.
 */
function labelsOf(ctx: DrawContext, m: SankeyModel): NodeLabel[] {
  if (ctx.frame.ps.options.labels === false) return [];
  const hit = labelCache.get(m);
  if (hit && hit.w === ctx.width && hit.h === ctx.height) return hit.labels;
  const g = layoutSankey(m, ctx.frame.ps.values, ctx.width, ctx.height);
  const texts = (v: number) => ({ full: ctx.format(m.value[v]), compact: ctx.compact(m.value[v]) });
  const labels = placeLabels(m, g, ctx.width, ctx.height, ctx.measure, texts);
  labelCache.set(m, { w: ctx.width, h: ctx.height, labels });
  return labels;
}

function colorOf(ctx: DrawContext, m: SankeyModel, node: number): string {
  const s = m.slots[node];
  return s >= 0 && s < ctx.theme.palette.length ? ctx.theme.palette[s] : ctx.theme.other;
}

function nodeMarkup(ctx: DrawContext, m: SankeyModel, g: Geometry, v: number): string {
  const b = g.nodes[v];
  const h = b.y1 - b.y0;
  if (!(h > 0.01)) return '';
  // Un nodo muy delgado se ve igual (1 px): sus flujos existen aunque casi no pesen.
  const shown = Math.max(1, h);
  const y = b.y0 - (shown - h) / 2;
  const a = {
    x: r2(b.x),
    y: r2(y),
    width: NODE_WIDTH,
    height: r2(shown),
    rx: Math.min(NODE_RADIUS, shown / 2),
    fill: colorOf(ctx, m, v),
  };
  return `<rect${attrs(a)}/>`;
}

function labelsMarkup(ctx: DrawContext, labels: readonly NodeLabel[]): string {
  const th = ctx.theme;
  let s = '';
  for (const L of labels) {
    // Halo de superficie: la etiqueta se lee aunque pase sobre una cinta.
    const a = {
      x: r2(L.x),
      y: r2(L.y),
      'font-size': FONT,
      'text-anchor': L.anchor,
      'dominant-baseline': 'central',
      fill: th.text,
      stroke: th.surface,
      'stroke-width': 3,
      'stroke-linejoin': 'round',
      'paint-order': 'stroke',
    };
    const value = L.value ? `<tspan${attrs({ dx: SPACE, fill: th.textMuted })}>${esc(L.value)}</tspan>` : '';
    s += `<text${attrs(a)}>${esc(L.name)}${value}</text>`;
  }
  return s;
}

function ribbonMarkup(ctx: DrawContext, m: SankeyModel, r: Ribbon, alpha: number, outline = false): string {
  const d = ribbonPath(r);
  if (!d) return '';
  const color = colorOf(ctx, m, r.source);
  const a: Record<string, string | number> = { d, fill: color, 'fill-opacity': alpha };
  if (outline) Object.assign(a, { stroke: color, 'stroke-width': 1, 'stroke-opacity': 0.9 });
  return `<path${attrs(a)}/>`;
}

export const sankey: SeriesImpl = {
  coords: 'free',
  layer: 0,
  legendSymbol: 'square',
  label: 'flujos',
  items: ['conexión', 'conexiones'],
  dimmable: true,
  texts: (o, x) => ({ to: o.to, from: x }),
  draw(ctx) {
    const { m, g } = geometryOf(ctx);
    if (!m.links.length) return '';
    const alpha = LINK_ALPHA[ctx.theme.name];
    let s = '';
    // Con una selección se atenúan los flujos de fuera; los nodos siguen dando la estructura.
    for (const r of g.ribbons) s += dimmed(ctx, r.index, ribbonMarkup(ctx, m, r, alpha));
    for (let v = 0; v < m.names.length; v++) s += nodeMarkup(ctx, m, g, v);
    return s + labelsMarkup(ctx, labelsOf(ctx, m));
  },
  hit(ctx, px, py) {
    return hitRibbon(geometryOf(ctx).g, px, py);
  },
  anchor(ctx, i) {
    const r = geometryOf(ctx).g.byRow.get(i);
    return r ? [(r.x0 + r.x1) / 2, (r.sy + r.ty) / 2] : [ctx.width / 2, ctx.height / 2];
  },
  hover(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const r = g.byRow.get(i);
    if (!r) return '';
    // Velo sobre todo lo demás; encima, el flujo con sus dos nodos y las etiquetas, que no se apagan.
    const veil = `<rect${attrs({ x: -2, y: -2, width: r2(ctx.width + 4), height: r2(ctx.height + 4), fill: ctx.theme.surface, 'fill-opacity': VEIL_ALPHA })}/>`;
    return (
      veil +
      ribbonMarkup(ctx, m, r, ACTIVE_ALPHA, true) +
      nodeMarkup(ctx, m, g, r.source) +
      nodeMarkup(ctx, m, g, r.target) +
      labelsMarkup(ctx, labelsOf(ctx, m))
    );
  },
  headline(ps, i, x) {
    const to = ps.texts.to?.[i] ?? '';
    return to ? `${x} → ${to}` : x;
  },
  // El flujo va en el color de su nodo de origen, como su cinta.
  swatch(ctx, i) {
    const m = modelOf(ctx.frame.ps);
    const l = m.byRow.get(i);
    return l ? colorOf(ctx, m, l.source) : null;
  },
  navigable(ps) {
    return linkOrder(modelOf(ps));
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const v = ps.values[i];
    if (!isFinite(v)) return null;
    const value = format.value(v);
    const m = modelOf(ps);
    if (m.dropped.includes(i)) return { value, details: [['No aparece', 'cerraría un ciclo']] };
    const l = m.byRow.get(i);
    if (!l) return { value };
    const details: [string, string][] = [];
    if (m.outflow[l.source] > 0)
      details.push([`De lo que sale de ${m.names[l.source]}`, format.percent(l.value / m.outflow[l.source])]);
    if (m.inflow[l.target] > 0)
      details.push([`De lo que llega a ${m.names[l.target]}`, format.percent(l.value / m.inflow[l.target])]);
    return { value, details };
  },
};
