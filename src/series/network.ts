/**
 * Red (LozNetwork): nodos y vínculos. Cada fila de datos es un vínculo, del origen (el campo de
 * la X) al destino (`to`), con su peso (`field`; si falta, 1). La red no tiene dirección: A → B y
 * B → A son el mismo vínculo y sus pesos se suman. Una fila sin destino solo declara el nodo
 * (sirve para nodos sueltos o para darle grupo a un nodo que nunca es origen).
 *
 * `group` es el grupo del nodo ORIGEN de la fila (el primero que aparezca): colorea los nodos
 * con la paleta en el orden de aparición de los grupos, hasta 8; el resto, y los nodos sin
 * grupo, en el gris "otros". Sin `group`, todos los nodos llevan el color de la serie.
 *
 * Layout por fuerzas (Fruchterman–Reingold): repulsión entre nodos, atracción por vínculos,
 * gravedad al centro y enfriamiento. Es determinista (círculo inicial en el orden de los datos
 * más un temblor con semilla fija) y se calcula una vez por conjunto de datos y tamaño. La
 * repulsión usa una rejilla espacial (la variante del propio artículo de FR): cada nodo solo
 * empuja a los que están a menos de 2k, así una iteración cuesta casi O(n) y 300 nodos se
 * ubican en unos milisegundos; con pocos nodos el radio cubre todo y es el cálculo exacto.
 *
 * Teclado y puntero: el núcleo indexa filas, pero quien lee una red piensa en nodos. Cada nodo
 * se representa con una de sus filas (un emparejamiento máximo nodo ↔ fila, por grado): hit,
 * tooltip y teclado hablan de nodos con el índice de esa fila. En un árbol hay una fila menos
 * que nodos, así que su nodo menos conectado queda sin fila: no tiene tooltip propio, aunque
 * aparece entre los vecinos del suyo. Las filas que no representan a nadie siguen en la tabla
 * como vínculos ("A — B").
 *
 * Toda la geometría (grafo, emparejamiento, layout, radios, etiquetas, hit-test) son funciones puras.
 */
import {
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

/** Iteraciones del layout: tope fijo; con miles de nodos se reducen para acotar el costo. */
const MAX_ITERATIONS = 300;
const MIN_ITERATIONS = 60;
/** Presupuesto aproximado de nodos × iteraciones. */
const WORK = 120_000;
/** Distancia ideal entre nodos como fracción de √(área / n). */
const SPRING = 0.8;
/** Gravedad hacia el centro, relativa a k: sostiene los nodos sueltos sin aplastar la red. */
const GRAVITY = 0.6;
const SEED = 20261025;
/** Radio de los nodos: el mayor depende del espacio por nodo, entre estos topes (px). */
const R_MIN = 3;
const R_MAX = 18;
const R_FLOOR = 4.5;
/** Aire entre nodos al separar los que se tocan, y entre la red y el borde. */
const NODE_GAP = 2;
/** Vínculos: grosor por peso entre estos px, con opacidad baja (algo más en oscuro). */
const LINK_MIN = 0.75;
const LINK_MAX = 3;
const LINK_ALPHA = { light: 0.28, dark: 0.34 };
const ACTIVE_LINK_ALPHA = 0.75;
const VEIL_ALPHA = 0.6;
/** Tolerancia del puntero alrededor de un nodo chico (px). */
const HIT_SLOP = 6;
// Etiquetas.
const FONT = 12;
const LABEL_H = 15;
const PAD = 4;
const MAX_LABEL = 140;
const MAX_LABELS = 30;
/** Vecinos que nombra el tooltip. */
const TOP_NEIGHBORS = 3;
// Leyenda de grupos.
const LEGEND_ROW = 20;
const LEGEND_GAP = 16;
const LEGEND_DOT = 4;

/** Un vínculo dibujable (ya fusionado): `rows` son las filas que lo forman. */
export interface NetLink {
  source: number;
  target: number;
  weight: number;
  rows: number[];
}

export interface Neighbor {
  node: number;
  weight: number;
}

export interface NetworkModel {
  /** Nombre de cada nodo, en el orden en que aparece en los datos. */
  names: string[];
  /** Grupos por primera aparición, y el grupo de cada nodo (-1 sin grupo). */
  groups: string[];
  groupOf: number[];
  /** Posición en la paleta de cada nodo: el grupo hasta `maxColors`; -1 el gris "otros". */
  slots: number[];
  links: NetLink[];
  /** Vínculo de cada fila, o -1. */
  rowLink: number[];
  /** Filas que no se dibujan: peso cero, negativo o infinito, o sin origen. */
  ignored: number[];
  /** Grado ponderado (suma de pesos) y cantidad de vecinos distintos. */
  degree: number[];
  count: number[];
  /** Vecinos de cada nodo, del vínculo más pesado al más liviano. */
  neighbors: Neighbor[][];
  /** Nodos del más conectado al menos (empates: orden de los datos). */
  order: number[];
  /** Fila que representa a cada nodo (-1 si no le tocó) y nodo que representa cada fila. */
  nodeRow: number[];
  rowNode: number[];
  /** ¿Alguna fila trae peso? Si no, se cuentan vínculos. */
  weighted: boolean;
}

/** Peso de una fila: un hueco vale 1; cero, negativo o infinito, no se dibuja (NaN). */
export function weightOf(v: number): number {
  if (Number.isNaN(v)) return 1;
  return isFinite(v) && v > 0 ? v : NaN;
}

/**
 * Emparejamiento máximo nodo ↔ fila (algoritmo de Kuhn, caminos de aumento). Se recorren los
 * nodos por prioridad y un nodo emparejado nunca pierde su fila, así que los que quedan sin una
 * son siempre los menos prioritarios. `candidates[v]` son las filas del nodo, en preferencia.
 */
export function matchRows(
  nodeCount: number,
  rowCount: number,
  candidates: readonly (readonly number[])[],
  priority: readonly number[],
) {
  const rowNode = new Array<number>(rowCount).fill(-1);
  const nodeRow = new Array<number>(nodeCount).fill(-1);
  let seen = new Uint8Array(rowCount);
  const augment = (v: number): boolean => {
    for (const r of candidates[v]) {
      if (seen[r]) continue;
      seen[r] = 1;
      if (rowNode[r] < 0 || augment(rowNode[r])) {
        rowNode[r] = v;
        nodeRow[v] = r;
        return true;
      }
    }
    return false;
  };
  for (const v of priority) {
    // Primero sin desplazar a nadie: si el nodo tiene una fila libre, esa es (la preferida).
    const free = candidates[v].find((r) => rowNode[r] < 0);
    if (free !== undefined) {
      rowNode[free] = v;
      nodeRow[v] = free;
      continue;
    }
    seen = new Uint8Array(rowCount);
    augment(v);
  }
  return { rowNode, nodeRow };
}

/** Modelo de la red a partir de las columnas de la tabla. */
export function buildNetwork(
  sources: readonly string[],
  targets: readonly string[],
  values: readonly number[],
  groups: readonly string[] = [],
  maxColors = 8,
): NetworkModel {
  const ids = new Map<string, number>();
  const names: string[] = [];
  const groupNames: string[] = [];
  const groupIds = new Map<string, number>();
  const groupOf: number[] = [];
  const id = (name: string) => {
    let k = ids.get(name);
    if (k === undefined) {
      k = names.length;
      ids.set(name, k);
      names.push(name);
      groupOf.push(-1);
    }
    return k;
  };
  const rows = values.length;
  const rowLink = new Array<number>(rows).fill(-1);
  const ignored: number[] = [];
  // Filas que puede representar cada nodo: las que lo declaran primero, luego los vínculos.
  const declares: number[][] = [];
  const touches: number[][] = [];
  const pairs = new Map<string, number>();
  const links: NetLink[] = [];
  let weighted = false;
  for (let i = 0; i < rows; i++) {
    const s = sources[i] ?? '';
    const t = targets[i] ?? '';
    if (isFinite(values[i])) weighted = true;
    const w = weightOf(values[i]);
    if (s === '' || (t !== '' && t !== s && !(w > 0))) {
      ignored.push(i);
      continue;
    }
    const a = id(s);
    const g = groups[i] ?? '';
    if (g !== '' && groupOf[a] < 0) {
      let gk = groupIds.get(g);
      if (gk === undefined) {
        gk = groupNames.length;
        groupIds.set(g, gk);
        groupNames.push(g);
      }
      groupOf[a] = gk;
    }
    (declares[a] ??= []).push(i);
    if (t === '' || t === s) {
      // Solo declara el nodo; un bucle no se dibuja (no dice nada de la estructura).
      if (t === s) ignored.push(i);
      continue;
    }
    const b = id(t);
    (touches[b] ??= []).push(i);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    let k = pairs.get(key);
    if (k === undefined) {
      k = links.length;
      pairs.set(key, k);
      links.push({ source: a, target: b, weight: 0, rows: [] });
    }
    links[k].weight += w;
    links[k].rows.push(i);
    rowLink[i] = k;
  }
  const n = names.length;
  const degree = new Array<number>(n).fill(0);
  const neighbors: Neighbor[][] = Array.from({ length: n }, () => []);
  for (const l of links) {
    degree[l.source] += l.weight;
    degree[l.target] += l.weight;
    neighbors[l.source].push({ node: l.target, weight: l.weight });
    neighbors[l.target].push({ node: l.source, weight: l.weight });
  }
  for (const list of neighbors) list.sort((p, q) => q.weight - p.weight || p.node - q.node);
  const count = neighbors.map((l) => l.length);
  const order = Array.from({ length: n }, (_, v) => v).sort((a, b) => degree[b] - degree[a] || a - b);
  // Como origen antes que como destino: la fila "es" más de su origen. Dentro, la más pesada.
  const heavy = (r: number) => -(rowLink[r] >= 0 ? links[rowLink[r]].weight : 0);
  const candidates = Array.from({ length: n }, (_, v) => {
    const own = (declares[v] ?? [])
      .slice()
      .sort((p, q) => (rowLink[p] < 0 ? 0 : 1) - (rowLink[q] < 0 ? 0 : 1) || heavy(p) - heavy(q) || p - q);
    const other = (touches[v] ?? []).slice().sort((p, q) => heavy(p) - heavy(q) || p - q);
    return [...own, ...other];
  });
  const { rowNode, nodeRow } = matchRows(n, rows, candidates, order);
  const anyGroup = groupNames.length > 0;
  const slots = groupOf.map((g) => (!anyGroup ? 0 : g >= 0 && g < maxColors ? g : -1));
  return {
    names,
    groups: groupNames,
    groupOf,
    slots,
    links,
    rowLink,
    ignored,
    degree,
    count,
    neighbors,
    order,
    nodeRow,
    rowNode,
    weighted,
  };
}

/** Generador pseudoaleatorio con semilla (mulberry32): el mismo layout en cada carga. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Iteraciones para n nodos: el tope fijo, o menos si son tantos que se pasaría del presupuesto. */
export function iterationsFor(n: number): number {
  return Math.max(MIN_ITERATIONS, Math.min(MAX_ITERATIONS, Math.round(WORK / Math.max(1, n))));
}

/**
 * Posiciones por fuerzas en un rectángulo de width × height, centradas y sin escalar al borde
 * (ver fitPositions). Fruchterman–Reingold: repulsión k²/d (solo a menos de 2k, con rejilla),
 * atracción d²/k por vínculo (más fuerte si pesa más), gravedad elíptica hacia el centro (así
 * la red ocupa el rectángulo y no un círculo) y una temperatura que acota cada paso y baja
 * hasta casi cero.
 */
export function forceLayout(
  nodeCount: number,
  links: readonly NetLink[],
  width: number,
  height: number,
  iterations = iterationsFor(nodeCount),
): { x: Float64Array; y: Float64Array } {
  const n = nodeCount;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const cx = W / 2;
  const cy = H / 2;
  if (n === 0) return { x, y };
  const k = SPRING * Math.sqrt((W * H) / n);
  const rand = random(SEED);
  // Círculo en el orden de los datos, con el aspecto del área, y un temblor: rompe las simetrías.
  for (let v = 0; v < n; v++) {
    const a = (2 * Math.PI * v) / n - Math.PI / 2;
    x[v] = cx + 0.4 * W * Math.cos(a) + (rand() - 0.5) * k * 0.1;
    y[v] = cy + 0.4 * H * Math.sin(a) + (rand() - 0.5) * k * 0.1;
  }
  if (n === 1) {
    x[0] = cx;
    y[0] = cy;
    return { x, y };
  }
  // Peso relativo de cada vínculo: la raíz suaviza pesos muy dispares.
  const mean = links.reduce((s, l) => s + l.weight, 0) / Math.max(1, links.length);
  const pull = links.map((l) => Math.min(2, Math.max(0.5, Math.sqrt(l.weight / (mean || 1)))));
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const reach = 2 * k;
  const k2 = k * k;
  const head = new Int32Array(0);
  let cells = head;
  const next = new Int32Array(n);
  const t0 = Math.max(W, H) / 10;
  for (let it = 0; it < iterations; it++) {
    dx.fill(0);
    dy.fill(0);
    // Rejilla de celdas de 2k sobre la caja actual de los nodos.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let v = 0; v < n; v++) {
      if (x[v] < x0) x0 = x[v];
      if (x[v] > x1) x1 = x[v];
      if (y[v] < y0) y0 = y[v];
      if (y[v] > y1) y1 = y[v];
    }
    const cols = Math.min(1024, Math.floor((x1 - x0) / reach) + 1);
    const rows = Math.min(1024, Math.floor((y1 - y0) / reach) + 1);
    const size = (x1 - x0) / cols || 1;
    const sizeY = (y1 - y0) / rows || 1;
    const cellSize = Math.max(reach, size);
    const cellSizeY = Math.max(reach, sizeY);
    if (cells.length < cols * rows) cells = new Int32Array(cols * rows);
    cells.fill(-1, 0, cols * rows);
    const cellX = (v: number) => Math.min(cols - 1, Math.floor((x[v] - x0) / cellSize));
    const cellY = (v: number) => Math.min(rows - 1, Math.floor((y[v] - y0) / cellSizeY));
    for (let v = 0; v < n; v++) {
      const c = cellY(v) * cols + cellX(v);
      next[v] = cells[c];
      cells[c] = v;
    }
    for (let v = 0; v < n; v++) {
      const gx = cellX(v);
      const gy = cellY(v);
      for (let oy = Math.max(0, gy - 1); oy <= Math.min(rows - 1, gy + 1); oy++) {
        for (let ox = Math.max(0, gx - 1); ox <= Math.min(cols - 1, gx + 1); ox++) {
          for (let u = cells[oy * cols + ox]; u >= 0; u = next[u]) {
            if (u <= v) continue;
            let ex = x[v] - x[u];
            let ey = y[v] - y[u];
            let d2 = ex * ex + ey * ey;
            if (d2 < 1e-6) {
              // Dos nodos en el mismo punto: se separan en una dirección fija por índice.
              ex = Math.cos(v + u);
              ey = Math.sin(v + u);
              d2 = 1e-6;
            }
            if (d2 > reach * reach) continue;
            const f = k2 / d2;
            dx[v] += ex * f;
            dy[v] += ey * f;
            dx[u] -= ex * f;
            dy[u] -= ey * f;
          }
        }
      }
    }
    links.forEach((l, j) => {
      const ex = x[l.source] - x[l.target];
      const ey = y[l.source] - y[l.target];
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d < 1e-9) return;
      const f = (d / k) * pull[j];
      dx[l.source] -= ex * f;
      dy[l.source] -= ey * f;
      dx[l.target] += ex * f;
      dy[l.target] += ey * f;
    });
    // Enfriamiento lineal: pasos largos al principio, ajuste fino al final.
    const t = t0 * (1 - it / iterations) + 0.5;
    for (let v = 0; v < n; v++) {
      dx[v] -= (GRAVITY * k * (x[v] - cx)) / (W / 2);
      dy[v] -= (GRAVITY * k * (y[v] - cy)) / (H / 2);
      const d = Math.sqrt(dx[v] * dx[v] + dy[v] * dy[v]);
      if (d > 0) {
        const step = Math.min(d, t) / d;
        x[v] += dx[v] * step;
        y[v] += dy[v] * step;
      }
    }
  }
  return { x, y };
}

/**
 * Lleva las posiciones al rectángulo con una escala única (las distancias conservan su
 * proporción), dejando `pad` px de borde para el radio de los nodos, y centra la red.
 */
export function fitPositions(x: Float64Array, y: Float64Array, width: number, height: number, pad: number): void {
  const n = x.length;
  if (!n) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let v = 0; v < n; v++) {
    x0 = Math.min(x0, x[v]);
    x1 = Math.max(x1, x[v]);
    y0 = Math.min(y0, y[v]);
    y1 = Math.max(y1, y[v]);
  }
  const w = Math.max(0, width - 2 * pad);
  const h = Math.max(0, height - 2 * pad);
  const sx = x1 - x0 > 1e-9 ? w / (x1 - x0) : Infinity;
  const sy = y1 - y0 > 1e-9 ? h / (y1 - y0) : Infinity;
  const s = Math.min(sx, sy);
  const k = isFinite(s) ? s : 0;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  for (let v = 0; v < n; v++) {
    x[v] = width / 2 + (x[v] - mx) * k;
    y[v] = height / 2 + (y[v] - my) * k;
  }
}

/**
 * Separa los nodos que se tocan (con `gap` px de aire), en unas pocas pasadas, sin salir del
 * rectángulo. El layout no sabe de radios; esto evita círculos encimados en redes densas.
 */
export function separate(
  x: Float64Array,
  y: Float64Array,
  r: readonly number[],
  width: number,
  height: number,
  gap = NODE_GAP,
  passes = 4,
): void {
  const n = x.length;
  const big = maxOf(r, 0);
  const cell = Math.max(1, 2 * big + gap);
  for (let p = 0; p < passes; p++) {
    const grid = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cy * 100_003 + cx;
    for (let v = 0; v < n; v++) {
      const k = key(Math.floor(x[v] / cell), Math.floor(y[v] / cell));
      const list = grid.get(k);
      if (list) list.push(v);
      else grid.set(k, [v]);
    }
    let moved = false;
    for (let v = 0; v < n; v++) {
      const gx = Math.floor(x[v] / cell);
      const gy = Math.floor(y[v] / cell);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          for (const u of grid.get(key(gx + ox, gy + oy)) ?? []) {
            if (u <= v) continue;
            const need = r[v] + r[u] + gap;
            let ex = x[u] - x[v];
            let ey = y[u] - y[v];
            let d = Math.sqrt(ex * ex + ey * ey);
            if (d >= need) continue;
            if (d < 1e-9) {
              ex = Math.cos(v + u);
              ey = Math.sin(v + u);
              d = 1;
            } else {
              ex /= d;
              ey /= d;
            }
            const push = (need - d) / 2;
            x[v] -= ex * push;
            y[v] -= ey * push;
            x[u] += ex * push;
            y[u] += ey * push;
            moved = true;
          }
        }
      }
    }
    for (let v = 0; v < n; v++) {
      x[v] = Math.min(width - r[v], Math.max(r[v], x[v]));
      y[v] = Math.min(height - r[v], Math.max(r[v], y[v]));
    }
    if (!moved) break;
  }
}

/** Radio mayor para n nodos en el área: el espacio por nodo manda, entre R_FLOOR y R_MAX. */
export function maxRadius(n: number, width: number, height: number): number {
  if (n <= 0) return 0;
  return Math.min(R_MAX, Math.max(R_FLOOR, 0.3 * Math.sqrt((Math.max(0, width) * Math.max(0, height)) / n)));
}

/** Radio de un nodo: el área es proporcional al grado (con un mínimo para que se vea y se apunte). */
export function radiusOf(degree: number, top: number, rMax: number): number {
  if (!(top > 0) || !(degree > 0)) return R_MIN;
  return Math.max(R_MIN, rMax * Math.sqrt(Math.min(1, degree / top)));
}

export interface LegendItem {
  slot: number;
  name: string;
  x: number;
  y: number;
}

/**
 * Leyenda de grupos, de izquierda a derecha y en varias filas si hace falta (máximo 3; lo que
 * no cabe se omite: la tabla y el tooltip dan el grupo de cada nodo). Solo con 2 o más grupos.
 */
export function legendLayout(
  m: NetworkModel,
  width: number,
  measure: (s: string) => number,
  maxColors = 8,
): { items: LegendItem[]; height: number } {
  if (m.groups.length < 2) return { items: [], height: 0 };
  const entries = m.groups.slice(0, maxColors).map((name, g) => ({ slot: g, name }));
  if (m.slots.some((s) => s < 0)) entries.push({ slot: -1, name: m.groups.length > maxColors ? 'Otros' : 'Sin grupo' });
  const items: LegendItem[] = [];
  let x = 0;
  let row = 0;
  for (const e of entries) {
    const room = Math.max(0, width - 2 * LEGEND_DOT - 6);
    const name = fitText(e.name, Math.min(MAX_LABEL, room), measure);
    const w = 2 * LEGEND_DOT + 6 + measure(name);
    if (x > 0 && x + w > width) {
      x = 0;
      row++;
    }
    if (row >= 3) break;
    items.push({ slot: e.slot, name, x, y: row * LEGEND_ROW + LEGEND_ROW / 2 });
    x += w + LEGEND_GAP;
  }
  const rows = items.length ? maxOf(items.map((i) => i.y)) / LEGEND_ROW + 0.5 : 0;
  return { items, height: rows * LEGEND_ROW + (items.length ? 8 : 0) };
}

/** Todo lo que depende del tamaño pero no del cuadro de la animación. */
export interface NetworkGeometry {
  /** Centro de cada nodo, en px del área (ya debajo de la leyenda). */
  x: Float64Array;
  y: Float64Array;
  /** Radio final de cada nodo y el mayor posible. */
  r: number[];
  rMax: number;
  top: number;
  legend: LegendItem[];
}

/** Geometría de la red en un área de width × height (layout, separación y leyenda). */
export function layoutNetwork(
  m: NetworkModel,
  width: number,
  height: number,
  measure: (s: string) => number,
  maxColors = 8,
): NetworkGeometry {
  const n = m.names.length;
  const legend = legendLayout(m, width, measure, maxColors);
  const top = legend.height;
  const h = Math.max(0, height - top);
  const rMax = maxRadius(n, width, h);
  const most = maxOf(m.degree, 0);
  const r = m.degree.map((d) => radiusOf(d, most, rMax));
  const { x, y } = forceLayout(n, m.links, width, h);
  fitPositions(x, y, width, h, rMax + NODE_GAP);
  separate(x, y, r, width, h);
  for (let v = 0; v < n; v++) y[v] += top;
  return { x, y, r, rMax, top, legend: legend.items };
}

export interface Label {
  node: number;
  x: number;
  y: number;
  anchor: 'start' | 'end';
  text: string;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** ¿El círculo toca la caja? (distancia del centro al punto más cercano de la caja). */
function circleHits(cx: number, cy: number, r: number, b: Box): boolean {
  const px = Math.min(b.x1, Math.max(b.x0, cx));
  const py = Math.min(b.y1, Math.max(b.y0, cy));
  return (cx - px) ** 2 + (cy - py) ** 2 < r * r;
}

/**
 * Etiquetas para los nodos de `candidates` (en orden de prioridad): a la derecha del nodo, o a
 * la izquierda si no cabe, recortadas con "…". Se omite la que se encimaría con otra etiqueta o
 * con un nodo de `obstacles`, o que se saldría del área: nunca hay texto sobre texto.
 */
export function placeLabels(
  names: readonly string[],
  g: Pick<NetworkGeometry, 'x' | 'y' | 'r'>,
  candidates: readonly number[],
  obstacles: readonly number[],
  width: number,
  height: number,
  measure: (s: string) => number,
  limit = MAX_LABELS,
): Label[] {
  const out: Label[] = [];
  const taken: Box[] = [];
  for (const v of candidates) {
    if (out.length >= limit) break;
    const text = fitText(names[v], MAX_LABEL, measure);
    if (!text || text === '…') continue;
    const w = measure(text);
    const cy = g.y[v];
    if (cy - LABEL_H / 2 < 0 || cy + LABEL_H / 2 > height) continue;
    for (const side of ['start', 'end'] as const) {
      const x = side === 'start' ? g.x[v] + g.r[v] + PAD : g.x[v] - g.r[v] - PAD;
      const box: Box =
        side === 'start'
          ? { x0: x, x1: x + w, y0: cy - LABEL_H / 2, y1: cy + LABEL_H / 2 }
          : { x0: x - w, x1: x, y0: cy - LABEL_H / 2, y1: cy + LABEL_H / 2 };
      if (box.x0 < 0 || box.x1 > width) continue;
      if (taken.some((t) => overlaps(t, box))) continue;
      if (obstacles.some((u) => u !== v && circleHits(g.x[u], g.y[u], g.r[u] + 1, box))) continue;
      taken.push({ x0: box.x0 - 2, x1: box.x1 + 2, y0: box.y0, y1: box.y1 });
      out.push({ node: v, x, y: cy, anchor: side, text });
      break;
    }
  }
  return out;
}

/**
 * Nodo bajo el punto, o -1. Si varios lo contienen, gana el que se dibuja encima (el más chico);
 * si ninguno, el más cercano a menos de HIT_SLOP de su borde (un nodo de 3 px se apunta igual).
 */
export function hitNode(g: Pick<NetworkGeometry, 'x' | 'y' | 'r'>, px: number, py: number): number {
  let inside = -1;
  let near = -1;
  let nearD = Infinity;
  for (let v = 0; v < g.x.length; v++) {
    const d = Math.sqrt((px - g.x[v]) ** 2 + (py - g.y[v]) ** 2);
    if (d <= g.r[v]) {
      if (inside < 0 || g.r[v] < g.r[inside]) inside = v;
    } else if (d - g.r[v] <= HIT_SLOP && d - g.r[v] < nearD) {
      nearD = d - g.r[v];
      near = v;
    }
  }
  return inside >= 0 ? inside : near;
}

/** Orden del teclado: los nodos con fila propia, del más conectado al menos. */
export function nodeStops(m: NetworkModel): number[] {
  return m.order.filter((v) => m.nodeRow[v] >= 0).map((v) => m.nodeRow[v]);
}

// ------------------------------------------------------------ Plugin

const models = new WeakMap<readonly number[], NetworkModel>();

function modelOf(ps: PreparedSeries): NetworkModel {
  let m = models.get(ps.values);
  if (m) return m;
  const empty = ps.values.map(() => '');
  m = buildNetwork(ps.texts.from ?? empty, ps.texts.to ?? empty, ps.values, ps.texts.group ?? empty);
  models.set(ps.values, m);
  return m;
}

/** Layout por modelo y tamaño: el puntero y cada cuadro de la animación lo reutilizan. */
const geoCache = new WeakMap<NetworkModel, { w: number; h: number; g: NetworkGeometry }>();

function geometryOf(ctx: DrawContext): { m: NetworkModel; g: NetworkGeometry } {
  const m = modelOf(ctx.frame.ps);
  const c = geoCache.get(m);
  if (c && c.w === ctx.width && c.h === ctx.height) return { m, g: c.g };
  const g = layoutNetwork(m, ctx.width, ctx.height, ctx.measure, ctx.theme.palette.length || 8);
  geoCache.set(m, { w: ctx.width, h: ctx.height, g });
  return { m, g };
}

const labelCache = new WeakMap<NetworkGeometry, Label[]>();

/** Etiquetas con la geometría final: no aparecen ni saltan a mitad de la animación. */
function labelsOf(ctx: DrawContext, m: NetworkModel, g: NetworkGeometry): Label[] {
  if (ctx.frame.ps.options.labels === false) return [];
  let labels = labelCache.get(g);
  if (!labels) {
    const all = m.order;
    labels = placeLabels(m.names, g, all, all, ctx.width, ctx.height, ctx.measure);
    labelCache.set(g, labels);
  }
  return labels;
}

function colorOf(ctx: DrawContext, m: NetworkModel, v: number): string {
  if (!m.groups.length) return ctx.color;
  const s = m.slots[v];
  return s >= 0 && s < ctx.theme.palette.length ? ctx.theme.palette[s] : ctx.theme.other;
}

/** Pesos de este cuadro: los vínculos y nodos crecen desde cero con la animación. */
function currentWeights(ctx: DrawContext, m: NetworkModel): { link: number[]; degree: number[] } {
  const y1 = ctx.frame.y1;
  const values = ctx.frame.ps.values;
  const link = m.links.map((l) =>
    l.rows.reduce((s, i) => {
      // Una fila sin peso vale 1 siempre; las demás, su valor interpolado.
      const v = Number.isNaN(values[i]) ? 1 : y1[i];
      return s + (isFinite(v) && v > 0 ? v : 0);
    }, 0),
  );
  const degree = new Array<number>(m.names.length).fill(0);
  m.links.forEach((l, j) => {
    degree[l.source] += link[j];
    degree[l.target] += link[j];
  });
  return { link, degree };
}

/** Grosor de un vínculo; con peso cero (primer cuadro de la animación) no se dibuja. */
export function linkWidth(w: number, top: number, weighted: boolean): number {
  if (!(w > 0)) return 0;
  if (!weighted || !(top > 0)) return 1;
  return LINK_MIN + (LINK_MAX - LINK_MIN) * Math.sqrt(Math.max(0, Math.min(1, w / top)));
}

function lineMarkup(g: NetworkGeometry, l: NetLink, width: number, color: string, alpha: number): string {
  if (!(width > 0.05)) return '';
  const a = {
    x1: r2(g.x[l.source]),
    y1: r2(g.y[l.source]),
    x2: r2(g.x[l.target]),
    y2: r2(g.y[l.target]),
    stroke: color,
    'stroke-width': r2(width),
    'stroke-opacity': alpha,
    'stroke-linecap': 'round',
  };
  return `<line${attrs(a)}/>`;
}

function nodeMarkup(ctx: DrawContext, m: NetworkModel, g: NetworkGeometry, v: number, r: number): string {
  if (!(r > 0.05)) return '';
  const a = {
    cx: r2(g.x[v]),
    cy: r2(g.y[v]),
    r: r2(r),
    fill: colorOf(ctx, m, v),
    stroke: ctx.theme.surface,
    'stroke-width': 1.5,
  };
  return `<circle${attrs(a)}/>`;
}

function labelsMarkup(ctx: DrawContext, labels: readonly Label[]): string {
  let s = '';
  for (const L of labels) {
    const a = {
      x: r2(L.x),
      y: r2(L.y),
      'font-size': FONT,
      'text-anchor': L.anchor,
      'dominant-baseline': 'central',
      fill: ctx.theme.text,
      stroke: ctx.theme.surface,
      'stroke-width': 3,
      'stroke-linejoin': 'round',
      'paint-order': 'stroke',
    };
    s += `<text${attrs(a)}>${esc(L.text)}</text>`;
  }
  return s;
}

function legendMarkup(ctx: DrawContext, items: readonly LegendItem[]): string {
  let s = '';
  for (const it of items) {
    const color = it.slot >= 0 && it.slot < ctx.theme.palette.length ? ctx.theme.palette[it.slot] : ctx.theme.other;
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

/** Radios de este cuadro, sobre la escala final (el mayor posible no cambia al animar). */
function radii(m: NetworkModel, g: NetworkGeometry, degree: readonly number[]): number[] {
  const top = maxOf(m.degree, 0);
  return degree.map((d, v) => (m.degree[v] > 0 ? (d > 0 ? radiusOf(d, top, g.rMax) : 0) : R_MIN));
}

export const network: SeriesImpl = {
  coords: 'free',
  layer: 0,
  legendSymbol: 'dot',
  label: 'red',
  items: ['conexión', 'conexiones'],
  dimmable: true,
  texts: (o, x) => ({ from: x, to: o.to, group: o.group }),
  draw(ctx) {
    if (!(ctx.width > 0 && ctx.height > 0)) return '';
    const { m, g } = geometryOf(ctx);
    if (!m.names.length) return '';
    const cur = currentWeights(ctx, m);
    const topLink = maxOf(
      m.links.map((l) => l.weight),
      0,
    );
    const alpha = LINK_ALPHA[ctx.theme.name];
    let s = legendMarkup(ctx, g.legend);
    // Con una selección: un vínculo se ve si alguna de sus filas está en ella, y un nodo si su fila
    // lo está o lo toca un vínculo que se ve.
    const dim = ctx.isDimmed;
    const linkLit = m.links.map((l) => !dim || l.rows.some((row) => !dim(row)));
    const nodeLit = m.names.map((_, v) => !dim || (m.nodeRow[v] >= 0 && !dim(m.nodeRow[v])));
    m.links.forEach((l, j) => {
      if (linkLit[j]) nodeLit[l.source] = nodeLit[l.target] = true;
    });
    const fade = (on: boolean, markup: string) => (on || !markup ? markup : `<g opacity="${DIM_OPACITY}">${markup}</g>`);
    m.links.forEach(
      (l, j) =>
        (s += fade(linkLit[j], lineMarkup(g, l, linkWidth(cur.link[j], topLink, m.weighted), ctx.theme.textMuted, alpha))),
    );
    const r = radii(m, g, cur.degree);
    // Los grandes primero: los chicos quedan encima y se pueden apuntar.
    const byArea = m.names.map((_, v) => v).sort((a, b) => g.r[b] - g.r[a] || a - b);
    for (const v of byArea) s += fade(nodeLit[v], nodeMarkup(ctx, m, g, v, r[v]));
    return s + labelsMarkup(ctx, labelsOf(ctx, m, g));
  },
  hit(ctx, px, py) {
    const { m, g } = geometryOf(ctx);
    const v = hitNode(g, px, py);
    return v >= 0 ? m.nodeRow[v] : -1;
  },
  anchor(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const v = m.rowNode[i];
    return v >= 0 ? [g.x[v], g.y[v] - g.r[v]] : null;
  },
  hover(ctx, i) {
    const { m, g } = geometryOf(ctx);
    const v = m.rowNode[i];
    if (v < 0) return '';
    const th = ctx.theme;
    const topLink = maxOf(
      m.links.map((l) => l.weight),
      0,
    );
    const color = colorOf(ctx, m, v);
    // Velo sobre el resto; encima, los vínculos del nodo en su color, sus vecinos y él mismo.
    let s = `<rect${attrs({ x: -2, y: -2, width: r2(ctx.width + 4), height: r2(ctx.height + 4), fill: th.surface, 'fill-opacity': VEIL_ALPHA })}/>`;
    for (const l of m.links) {
      if (l.source === v || l.target === v)
        s += lineMarkup(g, l, linkWidth(l.weight, topLink, m.weighted), color, ACTIVE_LINK_ALPHA);
    }
    const near = m.neighbors[v].map((nb) => nb.node);
    for (const u of [...near].sort((a, b) => g.r[b] - g.r[a])) s += nodeMarkup(ctx, m, g, u, g.r[u]);
    s += nodeMarkup(ctx, m, g, v, g.r[v]);
    s += `<circle${attrs({ cx: r2(g.x[v]), cy: r2(g.y[v]), r: r2(g.r[v] + 3), fill: 'none', stroke: th.text, 'stroke-width': 1.5 })}/>`;
    if (ctx.frame.ps.options.labels !== false) {
      const shown = [v, ...near];
      s += labelsMarkup(ctx, placeLabels(m.names, g, shown, shown, ctx.width, ctx.height, ctx.measure, 12));
    }
    return s;
  },
  headline(ps, i, x) {
    const m = modelOf(ps);
    const v = m.rowNode[i];
    if (v >= 0) return m.names[v];
    const to = ps.texts.to?.[i] ?? '';
    return to ? `${x} y ${to}` : x;
  },
  navigable(ps) {
    return nodeStops(modelOf(ps));
  },
  // Un nodo, en el color de su grupo; un vínculo, en el gris de sus líneas.
  swatch(ctx, i) {
    const m = modelOf(ctx.frame.ps);
    const v = m.rowNode[i];
    if (v >= 0) return colorOf(ctx, m, v);
    return m.rowLink[i] >= 0 ? ctx.theme.textMuted : null;
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const m = modelOf(ps);
    const v = m.rowNode[i];
    if (v < 0) {
      if (m.rowLink[i] < 0) {
        // Como en los demás tipos: el valor de la fila y por qué no se dibuja.
        const raw = ps.values[i];
        const why = Number.isNaN(weightOf(raw)) ? 'su peso es cero o menos' : 'le falta el origen';
        return { value: Number.isNaN(raw) ? 'Sin dato' : format.value(raw), details: [['No aparece', why]] };
      }
      const w = weightOf(ps.values[i]);
      return { value: m.weighted && isFinite(ps.values[i]) ? format.value(w) : format.number(w) };
    }
    const list = m.neighbors[v];
    const value = m.weighted ? format.value(m.degree[v]) : format.number(m.count[v]);
    const details: [string, string][] = [];
    if (m.weighted) details.push(['Conexiones', format.number(m.count[v])]);
    if (list.length) {
      const top = list
        .slice(0, TOP_NEIGHBORS)
        .map((nb) => (m.weighted ? `${m.names[nb.node]} (${format.value(nb.weight)})` : m.names[nb.node]));
      const rest = list.length - TOP_NEIGHBORS;
      details.push([
        TOP_NEIGHBORS < list.length ? 'Conectado sobre todo con' : 'Conectado con',
        top.join(', ') + (rest > 0 ? ` y ${format.number(rest)} más` : ''),
      ]);
    } else details.push(['Conectado con', 'ningún otro']);
    if (m.groupOf[v] >= 0) details.push(['Grupo', m.groups[m.groupOf[v]]]);
    return { value, details };
  },
};
