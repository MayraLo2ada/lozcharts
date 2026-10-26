/**
 * Cuerdas (LozChord): flujos entre nodos dispuestos en un círculo. Cada fila de datos es un
 * flujo, del origen (la X) al destino (`to`), con su valor; los nodos son los nombres que
 * aparecen, como arcos alrededor del círculo, y cada flujo es una cinta entre dos arcos.
 *
 * Arcos en el orden de primera aparición en los datos, desde arriba y en sentido horario (como
 * un pie: ordenar los datos ordena el círculo). El largo de cada arco es lo que sale MÁS lo que
 * entra: así cada flujo ocupa su valor en los dos arcos que une y los extremos llenan el arco
 * exacto, sin huecos. Entre arcos hay un hueco fijo en px (se achica si hay muchos nodos).
 *
 * Dirección: A → B y B → A son dos cintas distintas. Cada cinta lleva el color de su origen; su
 * extremo de origen toca el arco y el de destino queda separado unos px: se lee "sale de aquí,
 * llega allá" sin flechas. Dentro de un arco, los extremos se ordenan por la posición del otro
 * nodo (el más cercano en sentido antihorario primero), así las cintas no se cruzan pegadas al
 * arco; con ida y vuelta, la ida va antes que la vuelta y las dos cintas quedan una junto a otra.
 *
 * Color: cada nodo toma la paleta en el orden de los arcos, sin ciclar; del noveno en adelante,
 * el gris "otros". Los textos van en el color del tema.
 *
 * Los flujos sin valor positivo y finito, sin uno de sus extremos o de un nodo a sí mismo no se
 * dibujan (la tabla los lista igual; un bucle se avisa una vez en consola): un bucle no une dos
 * arcos y dibujarlo como una cinta sobre su propio arco se confunde con un nodo más grueso.
 *
 * Puntero y teclado: el núcleo indexa filas, y aquí cada fila es una cinta. Sobre el arco de un
 * nodo, el puntero toma la cinta cuyo extremo está bajo él: el arco está hecho de los extremos de
 * sus flujos, así que recorrer un arco es recorrer sus flujos uno por uno, sin elegir por el
 * lector. ←/→ van de flujo en flujo y ↑/↓ saltan al primer flujo del nodo anterior o siguiente.
 *
 * Toda la geometría (grafo, arcos, extremos, cintas, etiquetas, hit-test) son funciones puras.
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
import { r2, polarPoint } from '../core/shapes';
import { fitText } from '../core/axis';
import { maxOf } from './common';

const TAU = 2 * Math.PI;
/** Arranque arriba; en SVG la Y crece hacia abajo, así que sumar ángulo es ir en sentido horario. */
export const START = -Math.PI / 2;
/** Grosor de los arcos de los nodos. */
export const ARC_WIDTH = 10;
/** Separación entre el arco y el extremo de destino de una cinta: marca la dirección. */
export const TARGET_GAP = 4;
/** Hueco entre arcos, en px sobre el radio interior. */
const GAP_PX = 5;
/** Los huecos ocupan como máximo esta fracción de la vuelta: con muchos nodos, los datos mandan. */
const GAP_SHARE = 0.25;
/** Opacidad de las cintas, como en el sankey: dejan ver los cruces. Algo más en oscuro. */
const LINK_ALPHA = { light: 0.35, dark: 0.38 };
const ACTIVE_ALPHA = 0.65;
/** Velo de superficie sobre lo que no es el flujo activo. */
const VEIL_ALPHA = 0.55;
/** Una cinta finísima se puede apuntar igual: tolerancia alrededor de su borde, en px. */
const HIT_SLOP = 3;
/** Margen del círculo respecto al borde del área. */
const EDGE = 2;
// Etiquetas.
const FONT = 12;
/** Alto de la caja de una etiqueta: dos etiquetas que se tocan en X quedan al menos así de lejos. */
const LINE = 15;
/** Aire entre el arco y su etiqueta. */
const PAD = 6;
/** Ancho máximo de una etiqueta: un nombre larguísimo no achica el círculo. */
const MAX_LABEL = 160;
/** Por debajo de este ancho ni un nombre recortado se lee: mejor sin etiqueta. */
const MIN_LABEL = 28;
/** Con etiquetas, el círculo conserva al menos esta fracción del radio que tendría sin ellas. */
const MIN_LABELED_SHARE = 0.6;
/** Con un radio menor, las etiquetas no van: el círculo usa todo el espacio. */
const MIN_RADIUS = 48;
/** Cerca de arriba y de abajo (a menos de unos 15° de la vertical), la etiqueta va centrada. */
const VERTICAL_COS = 0.26;

/** Un flujo dibujable: `index` es su fila en los datos; `source` y `target`, nodos. */
export interface Link {
  index: number;
  source: number;
  target: number;
  value: number;
}

/** Un extremo de cinta dentro de un arco: el flujo y si sale (`out`) o llega a ese nodo. */
export interface End {
  link: Link;
  out: boolean;
}

export interface ChordGraph {
  /** Nombre de cada nodo, en el orden en que aparece en los datos (el de los arcos). */
  names: string[];
  /** Flujos que se dibujan, en el orden de los datos. */
  links: Link[];
  /** Filas sin valor positivo y finito o sin uno de sus extremos. */
  ignored: number[];
  /** Filas de un nodo a sí mismo. */
  loops: number[];
}

/**
 * Grafo de los datos: nodos por primera aparición entre los flujos válidos (un nombre que solo
 * aparece en filas ignoradas no tiene arco: mediría cero).
 */
export function buildGraph(sources: readonly string[], targets: readonly string[], values: readonly number[]): ChordGraph {
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
  const links: Link[] = [];
  const ignored: number[] = [];
  const loops: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const s = sources[i] ?? '';
    const t = targets[i] ?? '';
    const v = values[i];
    if (!(isFinite(v) && v > 0) || s === '' || t === '') ignored.push(i);
    else if (s === t) loops.push(i);
    else links.push({ index: i, source: id(s), target: id(t), value: v });
  }
  return { names, links, ignored, loops };
}

/** Entrada, salida y largo (entrada + salida) de cada nodo, con el tamaño dado de cada flujo. */
export function nodeTotals(
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
  return { inflow, outflow, value: inflow.map((v, k) => v + outflow[k]) };
}

/**
 * Orden de los extremos dentro del arco de cada nodo. `center` es el ángulo central de cada arco.
 * Primero el flujo cuyo otro nodo queda más cerca en sentido antihorario (el lado donde empieza
 * el arco) y al final el más cercano en sentido horario: las cintas salen hacia su lado y no se
 * cruzan junto al arco. Con el mismo otro nodo, la salida va antes que la llegada; aplicada en
 * los dos arcos, esa regla deja la ida y la vuelta anidadas, sin cruzarse entre sí.
 */
export function orderEnds(nodeCount: number, links: readonly Link[], center: readonly number[]): End[][] {
  const ends: End[][] = Array.from({ length: nodeCount }, () => []);
  for (const link of links) {
    ends[link.source].push({ link, out: true });
    ends[link.target].push({ link, out: false });
  }
  ends.forEach((list, v) => {
    const delta = (e: End) => {
      const other = e.out ? e.link.target : e.link.source;
      const d = (center[other] - center[v]) % TAU;
      return d < 0 ? d + TAU : d;
    };
    list.sort((a, b) => delta(b) - delta(a) || Number(b.out) - Number(a.out) || a.link.index - b.link.index);
  });
  return ends;
}

/**
 * Posición en la paleta de cada nodo, en el orden de los arcos, hasta `maxColors`; los que sobran,
 * -1 (el gris "otros"; nunca se cicla).
 */
export function nodeSlots(nodeCount: number, maxColors: number): number[] {
  return Array.from({ length: nodeCount }, (_, v) => (v < maxColors ? v : -1));
}

/** Todo lo que no depende del tamaño del gráfico ni del cuadro de la animación. */
export interface ChordModel extends ChordGraph {
  inflow: number[];
  outflow: number[];
  value: number[];
  slots: number[];
  /** Extremos de cada arco, ya en el orden en que se apilan. */
  ends: End[][];
  byRow: Map<number, Link>;
}

/** Modelo de las cuerdas a partir de las columnas de la tabla. */
export function buildModel(
  sources: readonly string[],
  targets: readonly string[],
  values: readonly number[],
  maxColors = 8,
): ChordModel {
  const graph = buildGraph(sources, targets, values);
  const n = graph.names.length;
  const { inflow, outflow, value } = nodeTotals(n, graph.links);
  // El orden de los extremos solo necesita dónde cae cada nodo, no el tamaño de los huecos:
  // con la parte de la vuelta de cada uno basta, y no cambia con el tamaño del gráfico.
  const total = value.reduce((s, v) => s + v, 0);
  const center: number[] = [];
  let acc = 0;
  for (let v = 0; v < n; v++) {
    center.push(START + (total > 0 ? ((acc + value[v] / 2) / total) * TAU : 0));
    acc += value[v];
  }
  return {
    ...graph,
    inflow,
    outflow,
    value,
    slots: nodeSlots(n, maxColors),
    ends: orderEnds(n, graph.links, center),
    byRow: new Map(graph.links.map((l) => [l.index, l])),
  };
}

/** Un arco en radianes: [a0, a1], con a0 ≤ a1. */
export interface Arc {
  a0: number;
  a1: number;
}

/** Una cinta: el extremo de origen [s0, s1] y el de destino [t0, t1], en radianes. */
export interface Ribbon {
  index: number;
  source: number;
  target: number;
  s0: number;
  s1: number;
  t0: number;
  t1: number;
}

export interface ChordGeometry {
  cx: number;
  cy: number;
  /** Radio interior de los arcos (donde nacen las cintas) y exterior. */
  inner: number;
  outer: number;
  /** Hueco entre arcos, en radianes. */
  gap: number;
  /** Radianes por unidad de valor. */
  k: number;
  arcs: Arc[];
  /** Cintas en orden de dibujo: las gruesas primero, las finas encima. */
  ribbons: Ribbon[];
  byRow: Map<number, Ribbon>;
}

/** Hueco entre arcos en radianes: GAP_PX sobre el radio, sin pasar de GAP_SHARE de la vuelta. */
export function arcGap(nodeCount: number, inner: number): number {
  if (nodeCount < 2 || !(inner > 0)) return 0;
  return Math.min(GAP_PX / inner, (GAP_SHARE * TAU) / nodeCount);
}

/**
 * Radio exterior del círculo y si llevan etiquetas. Sin etiquetas, el círculo llena el área; con
 * ellas, deja a los lados el ancho del nombre más largo (hasta MAX_LABEL) y arriba y abajo una
 * línea, pero nunca baja del 60 % del radio sin etiquetas: los nombres que no quepan se recortan.
 * Si ni así llega a MIN_RADIUS, las etiquetas no van.
 */
export function chordRadius(
  names: readonly string[],
  width: number,
  height: number,
  measure: (s: string) => number,
  labels = true,
): { outer: number; labels: boolean } {
  const base = Math.max(0, Math.min(width, height) / 2 - EDGE);
  if (!labels || !names.length) return { outer: base, labels: false };
  const wanted = Math.min(MAX_LABEL, maxOf(names.map(measure), 0));
  const vertical = height / 2 - PAD - LINE;
  const horizontal = width / 2 - PAD - wanted;
  const outer = Math.min(base, vertical, Math.max(horizontal, base * MIN_LABELED_SHARE));
  return outer >= MIN_RADIUS ? { outer, labels: true } : { outer: base, labels: false };
}

/**
 * Layout en px y radianes. `sizes` es el valor de cada fila en este cuadro (la animación): cada
 * arco conserva su lugar final y crece desde su centro. La escala es la menor entre la de los
 * valores finales y la de los actuales: si un cuadro suma más que el final, nada da más de una vuelta.
 */
export function layoutChord(
  m: ChordModel,
  sizes: readonly number[],
  width: number,
  height: number,
  outer: number,
): ChordGeometry {
  const n = m.names.length;
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.max(0, outer - ARC_WIDTH);
  const size = (l: Link) => {
    const v = sizes[l.index];
    return isFinite(v) && v > 0 ? v : 0;
  };
  const current = nodeTotals(n, m.links, size).value;
  const gap = arcGap(n, inner);
  const room = Math.max(0, TAU - n * gap);
  const finalTotal = m.value.reduce((s, v) => s + v, 0);
  const currentTotal = current.reduce((s, v) => s + v, 0);
  const kFinal = finalTotal > 0 ? room / finalTotal : 0;
  const k = currentTotal > 0 ? Math.min(kFinal, room / currentTotal) : kFinal;
  // Lugar de cada arco: su largo actual más una parte de lo que sobra de la vuelta, repartida
  // según lo que le falta para su largo final. Si ninguno pasa del final, cada lugar es el final
  // exacto; si alguno lo pasa (al cambiar los datos), los demás le ceden espacio sin encimarse.
  const slack = m.value.map((v, u) => Math.max(0, v * kFinal - current[u] * k));
  const slackTotal = slack.reduce((s, v) => s + v, 0);
  const left = Math.max(0, room - currentTotal * k);
  const arcs: Arc[] = [];
  let a = START + gap / 2;
  for (let v = 0; v < n; v++) {
    const length = current[v] * k;
    const slot = length + (slackTotal > 0 ? (slack[v] * left) / slackTotal : 0);
    const mid = a + slot / 2;
    arcs.push({ a0: mid - length / 2, a1: mid + length / 2 });
    a += slot + gap;
  }
  const byRow = new Map<number, Ribbon>();
  for (const l of m.links) byRow.set(l.index, { index: l.index, source: l.source, target: l.target, s0: 0, s1: 0, t0: 0, t1: 0 });
  for (let v = 0; v < n; v++) {
    let at = arcs[v].a0;
    for (const e of m.ends[v]) {
      const r = byRow.get(e.link.index)!;
      const w = size(e.link) * k;
      if (e.out) [r.s0, r.s1] = [at, at + w];
      else [r.t0, r.t1] = [at, at + w];
      at += w;
    }
  }
  const span = (r: Ribbon) => r.s1 - r.s0;
  const ribbons = [...byRow.values()].sort((p, q) => span(q) - span(p) || p.index - q.index);
  return { cx, cy, inner, outer, gap, k, arcs, ribbons, byRow };
}

const pt = (g: ChordGeometry, r: number, a: number) => polarPoint(g.cx, g.cy, r, a);
const xy = ([x, y]: [number, number]) => `${r2(x)},${r2(y)}`;

/** Trazo de un sector de anillo entre a0 y a1 (sentido horario), de radio r0 a r1. */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (!(a1 - a0 > 1e-4) || !(r1 > r0)) return '';
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => xy(polarPoint(cx, cy, r, a));
  return `M${p(r1, a0)}A${r2(r1)},${r2(r1)} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r2(r0)},${r2(r0)} 0 ${large} 0 ${p(r0, a0)}Z`;
}

/** Radios de los dos extremos: el de origen toca el arco; el de destino queda TARGET_GAP más adentro. */
function endRadii(g: ChordGeometry): [source: number, target: number] {
  return [g.inner, Math.max(0, g.inner - TARGET_GAP)];
}

/**
 * Trazo de una cinta: el arco del origen, una curva cuadrática por el centro hasta el destino,
 * el arco del destino y otra cuadrática de vuelta. Los dos lados quedan anidados, nunca cruzados.
 */
export function ribbonPath(g: ChordGeometry, r: Ribbon): string {
  if (!(r.s1 - r.s0 > 1e-4) || !(g.inner > 0)) return '';
  const [rs, rt] = endRadii(g);
  const c = `${r2(g.cx)},${r2(g.cy)}`;
  const arc = (rad: number, a0: number, a1: number) =>
    `A${r2(rad)},${r2(rad)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${xy(pt(g, rad, a1))}`;
  return (
    `M${xy(pt(g, rs, r.s0))}${arc(rs, r.s0, r.s1)}` +
    `Q${c} ${xy(pt(g, rt, r.t0))}${arc(rt, r.t0, r.t1)}` +
    `Q${c} ${xy(pt(g, rs, r.s0))}Z`
  );
}

/** Contorno de la cinta como polígono, para el hit-test (los arcos y las curvas, muestreados). */
export function ribbonOutline(g: ChordGeometry, r: Ribbon): [number, number][] {
  const [rs, rt] = endRadii(g);
  const out: [number, number][] = [];
  const arc = (rad: number, a0: number, a1: number) => {
    const steps = Math.max(2, Math.ceil((a1 - a0) / 0.08));
    for (let s = 0; s <= steps; s++) out.push(pt(g, rad, a0 + ((a1 - a0) * s) / steps));
  };
  const quad = (p0: [number, number], p2: [number, number]) => {
    for (let s = 1; s < 16; s++) {
      const t = s / 16;
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * g.cx + t * t * p2[0], u * u * p0[1] + 2 * u * t * g.cy + t * t * p2[1]]);
    }
  };
  arc(rs, r.s0, r.s1);
  quad(pt(g, rs, r.s1), pt(g, rt, r.t0));
  arc(rt, r.t0, r.t1);
  quad(pt(g, rt, r.t1), pt(g, rs, r.s0));
  return out;
}

function inside(poly: readonly [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance(poly: readonly [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Ángulo del punto, llevado a la vuelta [START, START + 2π) en la que viven los arcos. */
function angleOf(g: ChordGeometry, px: number, py: number): number {
  let a = Math.atan2(py - g.cy, px - g.cx);
  while (a < START) a += TAU;
  while (a >= START + TAU) a -= TAU;
  return a;
}

const outlines = new WeakMap<Ribbon, [number, number][]>();

/**
 * Fila del flujo bajo el punto, o -1. Sobre el arco de un nodo, el flujo cuyo extremo está bajo
 * el puntero (en un hueco entre arcos, ninguno). Dentro del círculo, la cinta que contiene el
 * punto; si dos se enciman, gana la más fina, que se dibuja encima (la gruesa se alcanza en el
 * resto de su ancho). Una cinta finísima se alcanza a HIT_SLOP de su borde.
 */
export function hitChord(m: ChordModel, g: ChordGeometry, px: number, py: number): number {
  const d = Math.hypot(px - g.cx, py - g.cy);
  if (d > g.outer + HIT_SLOP) return -1;
  if (d >= g.inner) {
    const a = angleOf(g, px, py);
    const v = g.arcs.findIndex((arc) => a >= arc.a0 && a <= arc.a1);
    if (v < 0) return -1;
    for (const e of m.ends[v]) {
      const r = g.byRow.get(e.link.index)!;
      const [a0, a1] = e.out ? [r.s0, r.s1] : [r.t0, r.t1];
      if (a >= a0 && a <= a1 && a1 > a0) return r.index;
    }
    return -1;
  }
  let best: Ribbon | null = null;
  let near: Ribbon | null = null;
  let nearD = HIT_SLOP;
  for (const r of g.ribbons) {
    if (!(r.s1 - r.s0 > 0)) continue;
    let poly = outlines.get(r);
    if (!poly) outlines.set(r, (poly = ribbonOutline(g, r)));
    if (inside(poly, px, py)) {
      if (!best || r.s1 - r.s0 < best.s1 - best.s0) best = r;
    } else if (!best) {
      const e = edgeDistance(poly, px, py);
      if (e <= nearD) {
        nearD = e;
        near = r;
      }
    }
  }
  return (best ?? near)?.index ?? -1;
}

/** Punto de apoyo del tooltip: la mitad de la curva que une los centros de los dos extremos. */
export function ribbonAnchor(g: ChordGeometry, r: Ribbon): [number, number] {
  const [rs, rt] = endRadii(g);
  const [x0, y0] = pt(g, rs, (r.s0 + r.s1) / 2);
  const [x2, y2] = pt(g, rt, (r.t0 + r.t1) / 2);
  return [0.25 * x0 + 0.5 * g.cx + 0.25 * x2, 0.25 * y0 + 0.5 * g.cy + 0.25 * y2];
}

export interface NodeLabel {
  node: number;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  text: string;
}

/**
 * Etiquetas por fuera del círculo, siempre horizontales (nunca de cabeza ni giradas): a la derecha
 * del arco en la mitad derecha, a la izquierda en la otra, y centradas cerca de arriba y de abajo.
 * Cada una cabe hasta el borde del área (y MAX_LABEL) o se recorta con "…". Se ubican primero
 * los nodos mayores y se omite la que se encimaría con otra o tocaría el círculo: nunca hay texto
 * sobre texto ni sobre los arcos.
 */
export function placeLabels(
  m: ChordModel,
  g: ChordGeometry,
  width: number,
  height: number,
  measure: (s: string) => number,
): NodeLabel[] {
  const rl = g.outer + PAD;
  const boxes: [number, number, number, number][] = [];
  const out: NodeLabel[] = [];
  const order = m.names.map((_, v) => v).sort((a, b) => m.value[b] - m.value[a] || a - b);
  for (const v of order) {
    const arc = g.arcs[v];
    if (!(arc.a1 > arc.a0)) continue;
    const a = (arc.a0 + arc.a1) / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x = g.cx + rl * cos;
    // Corrida hacia afuera media línea en vertical: el texto no se apoya sobre el arco.
    const y = g.cy + rl * sin + (sin * FONT) / 2;
    const anchor = Math.abs(cos) < VERTICAL_COS ? 'middle' : cos > 0 ? 'start' : 'end';
    const room = Math.min(MAX_LABEL, anchor === 'middle' ? 2 * Math.min(x, width - x) : anchor === 'start' ? width - x : x);
    if (room < MIN_LABEL) continue;
    const text = fitText(m.names[v], room, measure);
    if (text === '…') continue;
    const w = measure(text);
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
    const box: [number, number, number, number] = [x0, y - LINE / 2, x0 + w, y + LINE / 2];
    if (box[1] < -1 || box[3] > height + 1) continue;
    // El punto de la caja más cercano al centro debe quedar fuera del círculo.
    const nx = Math.max(box[0], Math.min(g.cx, box[2]));
    const ny = Math.max(box[1], Math.min(g.cy, box[3]));
    if (Math.hypot(nx - g.cx, ny - g.cy) < g.outer + 1) continue;
    if (boxes.some((b) => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3])) continue;
    boxes.push(box);
    out.push({ node: v, x, y, anchor, text });
  }
  return out;
}

/** Orden del teclado: por arco del origen y, dentro de él, en el orden de sus extremos. */
export function linkOrder(m: ChordModel): number[] {
  const out: number[] = [];
  for (const list of m.ends) for (const e of list) if (e.out) out.push(e.link.index);
  return out;
}

/**
 * ↑/↓: al primer flujo del nodo anterior o siguiente que tenga salidas (en los bordes, se queda).
 * Las demás teclas siguen el recorrido lineal.
 */
export function nodeStep(m: ChordModel, i: number, key: string): number | undefined {
  if (key !== 'ArrowDown' && key !== 'ArrowUp') return undefined;
  const l = m.byRow.get(i);
  if (!l) return undefined;
  const dir = key === 'ArrowDown' ? 1 : -1;
  for (let v = l.source + dir; v >= 0 && v < m.names.length; v += dir) {
    const first = m.ends[v].find((e) => e.out);
    if (first) return first.link.index;
  }
  return i;
}

// ------------------------------------------------------------ Plugin

/**
 * Modelos por conjunto de datos: el núcleo entrega el origen (`from`, el campo de la X) y el
 * destino (`to`) como columnas de texto, así la tabla, el tooltip y el teclado tienen el modelo
 * sin esperar al primer dibujo.
 */
const models = new WeakMap<readonly number[], ChordModel>();

function modelOf(ps: PreparedSeries): ChordModel {
  let m = models.get(ps.values);
  if (m) return m;
  const empty = ps.values.map(() => '');
  const sources = ps.texts.from ?? empty;
  const targets = ps.texts.to ?? empty;
  m = buildModel(sources, targets, ps.values);
  models.set(ps.values, m);
  // Un aviso por conjunto de datos, no uno por cuadro.
  if (m.loops.length) {
    const list = m.loops.map((i) => `"${sources[i]} → ${targets[i]}"`).join(', ');
    const one = m.loops.length === 1;
    console.warn(
      `LozCharts: en las cuerdas "${ps.name}", ${one ? '1 fila empieza y termina' : `${m.loops.length} filas empiezan y terminan`} en el mismo lugar y no ${one ? 'se dibuja' : 'se dibujan'}: ${list}. ` +
        'Cada cuerda necesita un origen y un destino distintos.',
    );
  }
  return m;
}

/** Radio y etiquetas por modelo y tamaño: no cambian con la animación. */
const frameCache = new WeakMap<ChordModel, { w: number; h: number; on: boolean; outer: number; labels: NodeLabel[] }>();

function staticOf(ctx: DrawContext, m: ChordModel): { outer: number; labels: NodeLabel[] } {
  const on = ctx.frame.ps.options.labels !== false;
  const c = frameCache.get(m);
  if (c && c.w === ctx.width && c.h === ctx.height && c.on === on) return c;
  const fit = chordRadius(m.names, ctx.width, ctx.height, ctx.measure, on);
  // Las etiquetas salen de la geometría final: no saltan ni aparecen a mitad de la animación.
  const labels = fit.labels
    ? placeLabels(m, layoutChord(m, ctx.frame.ps.values, ctx.width, ctx.height, fit.outer), ctx.width, ctx.height, ctx.measure)
    : [];
  const entry = { w: ctx.width, h: ctx.height, on, outer: fit.outer, labels };
  frameCache.set(m, entry);
  return entry;
}

/** Última geometría: el puntero pregunta muchas veces por el mismo cuadro. */
let lastGeo: { sizes: readonly number[]; m: ChordModel; w: number; h: number; outer: number; g: ChordGeometry } | null = null;

function geometryOf(ctx: DrawContext): { m: ChordModel; g: ChordGeometry; labels: NodeLabel[] } {
  const m = modelOf(ctx.frame.ps);
  const { outer, labels } = staticOf(ctx, m);
  const sizes = ctx.frame.y1;
  const c = lastGeo;
  if (c && c.sizes === sizes && c.m === m && c.w === ctx.width && c.h === ctx.height && c.outer === outer)
    return { m, g: c.g, labels };
  const g = layoutChord(m, sizes, ctx.width, ctx.height, outer);
  lastGeo = { sizes, m, w: ctx.width, h: ctx.height, outer, g };
  return { m, g, labels };
}

function colorOf(ctx: DrawContext, m: ChordModel, node: number): string {
  const s = m.slots[node];
  return s >= 0 && s < ctx.theme.palette.length ? ctx.theme.palette[s] : ctx.theme.other;
}

function arcMarkup(ctx: DrawContext, m: ChordModel, g: ChordGeometry, v: number): string {
  const { a0, a1 } = g.arcs[v];
  const d = arcPath(g.cx, g.cy, g.inner, g.outer, a0, a1);
  return d ? `<path${attrs({ d, fill: colorOf(ctx, m, v) })}/>` : '';
}

function ribbonMarkup(ctx: DrawContext, m: ChordModel, g: ChordGeometry, r: Ribbon, alpha: number, outline = false): string {
  const d = ribbonPath(g, r);
  if (!d) return '';
  const color = colorOf(ctx, m, r.source);
  const a: Record<string, string | number> = { d, fill: color, 'fill-opacity': alpha };
  if (outline) Object.assign(a, { stroke: color, 'stroke-width': 1, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' });
  return `<path${attrs(a)}/>`;
}

function labelsMarkup(ctx: DrawContext, labels: readonly NodeLabel[]): string {
  const th = ctx.theme;
  let s = '';
  for (const L of labels) {
    // Halo de superficie, como en el sankey: se lee aunque pase cerca de una cinta.
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
    s += `<text${attrs(a)}>${esc(L.text)}</text>`;
  }
  return s;
}

export const chord: SeriesImpl = {
  coords: 'free',
  layer: 0,
  legendSymbol: 'square',
  label: 'cuerdas',
  items: ['conexión', 'conexiones'],
  dimmable: true,
  texts: (o, x) => ({ to: o.to, from: x }),
  draw(ctx) {
    if (!(ctx.width > 0 && ctx.height > 0)) return '';
    const { m, g, labels } = geometryOf(ctx);
    if (!m.links.length) return '';
    const alpha = LINK_ALPHA[ctx.theme.name];
    let s = '';
    // Con una selección se atenúan los flujos de fuera; los arcos siguen dando la estructura.
    for (const r of g.ribbons) s += dimmed(ctx, r.index, ribbonMarkup(ctx, m, g, r, alpha));
    for (let v = 0; v < m.names.length; v++) s += arcMarkup(ctx, m, g, v);
    return s + labelsMarkup(ctx, labels);
  },
  hit(ctx, px, py) {
    const { m, g } = geometryOf(ctx);
    return hitChord(m, g, px, py);
  },
  anchor(ctx, i) {
    const { g } = geometryOf(ctx);
    const r = g.byRow.get(i);
    return r ? ribbonAnchor(g, r) : [ctx.width / 2, ctx.height / 2];
  },
  hover(ctx, i) {
    const { m, g, labels } = geometryOf(ctx);
    const r = g.byRow.get(i);
    if (!r) return '';
    // Velo sobre todo lo demás; encima, el flujo con sus dos arcos y las etiquetas, que no se apagan.
    const veil = `<rect${attrs({ x: -2, y: -2, width: r2(ctx.width + 4), height: r2(ctx.height + 4), fill: ctx.theme.surface, 'fill-opacity': VEIL_ALPHA })}/>`;
    return (
      veil +
      ribbonMarkup(ctx, m, g, r, ACTIVE_ALPHA, true) +
      arcMarkup(ctx, m, g, r.source) +
      arcMarkup(ctx, m, g, r.target) +
      labelsMarkup(ctx, labels)
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
  step(ps, i, key) {
    return nodeStep(modelOf(ps), i, key);
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const v = ps.values[i];
    if (!isFinite(v)) return null;
    const value = format.value(v);
    const m = modelOf(ps);
    if (m.loops.includes(i)) return { value, details: [['No aparece', 'empieza y termina en el mismo lugar']] };
    const l = m.byRow.get(i);
    // Como en los demás tipos: lo que no se dibuja dice por qué.
    if (!l) return { value, details: [['No aparece', v <= 0 ? 'vale cero o menos' : 'le falta el origen o el destino']] };
    const details: [string, string][] = [
      [`De lo que sale de ${m.names[l.source]}`, format.percent(l.value / m.outflow[l.source])],
      [`De lo que llega a ${m.names[l.target]}`, format.percent(l.value / m.inflow[l.target])],
    ];
    return { value, details };
  },
};
