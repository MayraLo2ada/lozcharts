/**
 * Sunburst (LozSunburst): una jerarquía en anillos concéntricos. Cada fila es una hoja con su
 * ruta (`levels`, del nivel más alto al más bajo: ['region', 'pais', 'ciudad']) y su valor
 * (`field`); cada nodo interior mide lo que suman sus hijos. Sin `levels`, la ruta es el campo
 * de la X: un solo anillo, que se lee como un donut.
 *
 * Empieza arriba y avanza en sentido horario. Los hermanos van de mayor a menor (el primero
 * aparecido gana los empates): las sumas de los nodos interiores no están en los datos, así que
 * quien los arma no puede ordenarlos, y el orden por tamaño es el que mejor se compara de un
 * vistazo. El orden sale de los valores finales, no de los animados: nada salta de lugar.
 *
 * Color: cada rama de primer nivel toma la paleta en ese orden, sin ciclar. Con más ramas que
 * colores, las primeras siete los llevan y el resto (al menos dos) va en el gris de "Otros",
 * cada una con su anillo y su detalle: ninguna desaparece. Los anillos de afuera heredan el
 * color de su rama, mezclado en OKLab hacia la superficie un paso por nivel: se sigue la rama
 * hacia afuera y la profundidad se lee sin leyenda. Entre segmentos, 2 px de superficie.
 *
 * Etiquetas adentro, solo si caben enteras o recortadas con al menos 4 letras: tangenciales si
 * el arco es ancho, radiales si el anillo es más largo que el arco; nunca de cabeza. Cada texto
 * queda dentro de su propio segmento, así que nunca hay texto sobre texto. La tinta es la del
 * tema de mayor contraste con el relleno (ver inkFor). En el centro, el total; al pasar el
 * puntero, el nodo enfocado, con su ruta hasta la raíz resaltada y el resto atenuado.
 *
 * Segmentos diminutos (arco exterior de menos de 3 px): los hermanos seguidos se dibujan como
 * una sola banda sin etiqueta y sin aire entre ellos (2 px de superficie se comerían cada uno);
 * el puntero sigue apuntando a cada uno por su ángulo y el teclado los recorre todos. Lo que
 * cuelga de un segmento diminuto no se dibuja: sería más fino que un píxel.
 *
 * Casos límite: un nivel vacío en medio de la ruta se muestra como "Sin nombre" (cada anillo
 * sigue siendo un nivel); los vacíos al final acortan la ruta, y la fila es entonces el valor
 * propio de ese nodo, que se ve como el tramo del arco que sus hijos no cubren. Dos filas con la
 * misma ruta se suman en un nodo. Las filas sin valor positivo y finito, o sin ruta, no se
 * dibujan (la tabla y el tooltip las muestran igual, con el motivo).
 *
 * Teclado y puntero: el núcleo indexa filas, pero los nodos interiores no son filas. Una hoja
 * se nombra con el índice de su fila; los demás nodos, con índices virtuales a partir de n (la
 * cantidad de filas). Las flechas izquierda y derecha recorren en preorden (la rama, sus hijos,
 * la rama siguiente), en el sentido del dibujo; arriba sube al padre y abajo baja al hijo mayor.
 *
 * Animación: los ángulos salen de los valores del cuadro (frame.y1) y, al entrar, el giro
 * completo crece con la opacidad de la serie: los anillos se abren desde arriba en sentido horario.
 *
 * Toda la geometría (jerarquía, ángulos, hit-test, etiquetas, colores) son funciones puras.
 */
import type { DrawContext, PreparedSeries, SeriesImpl, TooltipFormat, TooltipValue } from '../core/series';
import type { SeriesOptions } from '../types';
import type { Theme } from '../core/theme';
import { MAX_COLORS } from '../core/theme';
import { attrs, esc } from '../core/dom';
import { mixOklab, parseColor, toHex } from '../core/color';
import { polarPoint, r2 } from '../core/shapes';
import { fitText } from '../core/axis';
import { slicePath } from './pie';
import { inkFor } from './treemap';

/** Arranque arriba; en SVG la Y crece hacia abajo, así que sumar ángulo es ir en sentido horario. */
const START = -Math.PI / 2;
const TAU = 2 * Math.PI;
/** Aire entre segmentos y entre anillos: un trazo de superficie, 1 px a cada lado del borde. */
const GAP = 2;
/** Margen respecto al borde del área. */
const EDGE = 2;
/** Agujero central como fracción del radio, según la cantidad de anillos (5 o más: el último). */
const HOLES = [0.6, 0.42, 0.34, 0.3, 0.26];
/** Un segmento cuyo arco exterior mide menos que esto (px) se dibuja junto a sus hermanos diminutos. */
export const TINY = 3;
/** Paso de mezcla hacia la superficie por nivel, y su tope (en oscuro, menos: se perdería en el fondo). */
const FADE = { light: 0.16, dark: 0.12 };
const MAX_FADE = { light: 0.56, dark: 0.4 };
/** Velo de superficie sobre lo que no es la ruta activa. */
const VEIL_ALPHA = 0.62;
/** Nombre de un nivel vacío en medio de una ruta. */
export const UNNAMED = 'Sin nombre';
/** Separador de la ruta en el encabezado del tooltip. */
const SEP = ' › ';

// Etiquetas.
const FONT = 12;
/** Alto que ocupa una línea de 12 px. */
const LINE = 14;
/** Aire entre el borde del segmento y su texto. */
const PAD = 4;
/** measure() mide con peso normal; las etiquetas van en 500, algo más anchas. */
const WEIGHT_500 = 1.05;
/** Un nombre recortado con menos letras que esto no identifica nada: mejor sin etiqueta. */
const MIN_CHARS = 4;

// Centro.
const TOTAL_MAX = 28;
const TOTAL_MIN = 14;
const CAPTION = 'Total';
/** El total solo cabe si el agujero tiene al menos este radio. */
const HOLE_MIN_FOR_TOTAL = 28;

// ------------------------------------------------------------ Jerarquía

export interface SunNode {
  name: string;
  /** Anillo: 0 es el primer nivel (el de adentro). */
  depth: number;
  /** Nodo padre, o -1 en el primer nivel. */
  parent: number;
  /** Hijos ya ordenados de mayor a menor. */
  children: number[];
  /** Filas cuya ruta termina en este nodo (una hoja normal tiene una). */
  rows: number[];
  /** Valor final: sus filas más sus hijos. */
  value: number;
  /** Rama de primer nivel a la que pertenece y su posición en la paleta (-1: "Otros"). */
  branch: number;
  slot: number;
}

export interface SunModel {
  nodes: SunNode[];
  /** Nodos del primer nivel, de mayor a menor. */
  roots: number[];
  /** Cantidad de anillos. */
  depth: number;
  /** Suma de las filas que se dibujan. */
  total: number;
  /** Cantidad de filas de los datos: los nodos sin fila propia se indexan desde aquí. */
  rowCount: number;
  /** Nodo de cada fila, o -1 si la fila no se dibuja. */
  rowNode: number[];
  /** Ruta de cada fila (con "Sin nombre" en los huecos), aunque no se dibuje. */
  rowPath: string[][];
  /** Filas sin valor positivo y finito, o sin ruta. */
  ignored: number[];
  /** Preorden en el sentido del dibujo: el recorrido del teclado. */
  order: number[];
}

const positive = (v: number) => isFinite(v) && v > 0;

/** Ruta de una fila: los vacíos del final se quitan; los del medio se nombran "Sin nombre". */
export function cleanPath(raw: readonly string[]): string[] {
  let end = raw.length;
  while (end > 0 && !(raw[end - 1] ?? '').trim()) end--;
  return raw.slice(0, end).map((s) => (s ?? '').trim() || UNNAMED);
}

/**
 * Jerarquía a partir de la ruta y el valor de cada fila. Los nodos se crean por primera
 * aparición (dos filas con la misma ruta caen en el mismo nodo); luego cada nodo suma lo suyo y
 * lo de sus hijos, los hermanos se ordenan de mayor a menor y las ramas reciben su color.
 */
export function buildHierarchy(
  paths: readonly (readonly string[])[],
  values: readonly number[],
  maxColors: number = MAX_COLORS,
): SunModel {
  const nodes: SunNode[] = [];
  const roots: number[] = [];
  const index = new Map<string, number>();
  const rowNode = values.map(() => -1);
  const rowPath: string[][] = [];
  const ignored: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const path = cleanPath(paths[i] ?? []);
    rowPath.push(path);
    if (!path.length || !positive(values[i])) {
      ignored.push(i);
      continue;
    }
    let parent = -1;
    let key = '';
    for (let d = 0; d < path.length; d++) {
      // La clave es la ruta entera: "Lima" de Perú y "Lima" de Ohio son nodos distintos.
      key += (d ? '\u0000' : '') + path[d];
      let id = index.get(key);
      if (id === undefined) {
        id = nodes.length;
        nodes.push({ name: path[d], depth: d, parent, children: [], rows: [], value: 0, branch: -1, slot: -1 });
        index.set(key, id);
        if (parent < 0) roots.push(id);
        else nodes[parent].children.push(id);
      }
      parent = id;
    }
    nodes[parent].rows.push(i);
    rowNode[i] = parent;
  }
  // Cada hijo se crea después que su padre: de atrás hacia adelante, cada hijo ya está sumado.
  for (let id = nodes.length - 1; id >= 0; id--) {
    const node = nodes[id];
    node.value = node.rows.reduce((s, i) => s + values[i], 0) + node.children.reduce((s, c) => s + nodes[c].value, 0);
  }
  // sort es estable: en empate, el primero que apareció.
  const bySize = (a: number, b: number) => nodes[b].value - nodes[a].value;
  roots.sort(bySize);
  for (const node of nodes) node.children.sort(bySize);
  const colors = Math.max(0, Math.min(MAX_COLORS, maxColors));
  // Nunca un "Otros" de una sola rama: con una de más, se quita un color para que sean dos.
  const colored = roots.length > colors ? Math.max(0, colors - 1) : roots.length;
  const order: number[] = [];
  const visit = (id: number, branch: number, slot: number) => {
    nodes[id].branch = branch;
    nodes[id].slot = slot;
    order.push(id);
    for (const c of nodes[id].children) visit(c, branch, slot);
  };
  roots.forEach((r, k) => visit(r, r, k < colored ? k : -1));
  const depth = nodes.reduce((d, n) => Math.max(d, n.depth + 1), 0);
  const total = roots.reduce((s, r) => s + nodes[r].value, 0);
  return { nodes, roots, depth, total, rowCount: values.length, rowNode, rowPath, ignored, order };
}

/**
 * Índice con el que el núcleo conoce a un nodo: el de su fila si es una hoja con una sola fila;
 * si no (un nodo interior, o una ruta repetida), uno virtual desde la cantidad de filas.
 */
export function refOf(m: SunModel, id: number): number {
  const node = m.nodes[id];
  return node.children.length === 0 && node.rows.length === 1 ? node.rows[0] : m.rowCount + id;
}

/** Nodo de un índice del núcleo, o -1 (una fila que no se dibuja o que es parte de un nodo). */
export function nodeOfRef(m: SunModel, ref: number): number {
  if (ref >= m.rowCount) return ref - m.rowCount < m.nodes.length ? ref - m.rowCount : -1;
  const id = m.rowNode[ref] ?? -1;
  return id >= 0 && refOf(m, id) === ref ? id : -1;
}

/** Nombres desde el primer nivel hasta el nodo. */
export function nodePath(m: SunModel, id: number): string[] {
  const out: string[] = [];
  for (let k = id; k >= 0; k = m.nodes[k].parent) out.unshift(m.nodes[k].name);
  return out;
}

// ------------------------------------------------------------ Geometría

export interface Arc {
  a0: number;
  a1: number;
  r0: number;
  r1: number;
}

export interface SunGeometry {
  cx: number;
  cy: number;
  /** Radio del agujero, grosor de cada anillo y radio exterior. */
  hole: number;
  ring: number;
  outer: number;
  /** Arco de cada nodo (alineado con model.nodes). */
  arcs: Arc[];
  /** ¿El segmento es diminuto? ¿Cuelga de uno diminuto (no se dibuja ni se apunta)? */
  tiny: boolean[];
  buried: boolean[];
  /** Total del cuadro (lo que muestra el centro). */
  total: number;
}

/** Radio del agujero como fracción del radio exterior para `depth` anillos. */
export function holeShare(depth: number): number {
  return HOLES[Math.min(HOLES.length, Math.max(1, depth)) - 1];
}

/**
 * Layout en px. `sizes` es el valor de cada fila en este cuadro (la animación); el orden y la
 * cantidad de anillos salen del modelo. `sweep` (0 a 1) es la parte del giro completo que se
 * reparte: al entrar, los anillos se abren en sentido horario. Cada hijo empieza donde empieza
 * su padre; el valor propio del padre queda al final, como el tramo que sus hijos no cubren.
 */
export function layoutSunburst(m: SunModel, sizes: readonly number[], width: number, height: number, sweep = 1): SunGeometry {
  const n = m.nodes.length;
  const current = new Array<number>(n).fill(0);
  for (let id = n - 1; id >= 0; id--) {
    const node = m.nodes[id];
    let v = 0;
    for (const i of node.rows) if (positive(sizes[i])) v += sizes[i];
    for (const c of node.children) v += current[c];
    current[id] = v;
  }
  const total = m.roots.reduce((s, r) => s + current[r], 0);
  const outer = Math.max(0, Math.min(width, height) / 2 - EDGE);
  const hole = outer * holeShare(m.depth);
  const ring = m.depth ? (outer - hole) / m.depth : 0;
  const k = total > 0 ? (TAU * Math.max(0, Math.min(1, sweep))) / total : 0;
  const arcs: Arc[] = new Array(n);
  const tiny = new Array<boolean>(n).fill(false);
  const buried = new Array<boolean>(n).fill(false);
  const place = (ids: readonly number[], from: number, under: boolean) => {
    let a = from;
    for (const id of ids) {
      const r0 = hole + m.nodes[id].depth * ring;
      const arc = { a0: a, a1: a + current[id] * k, r0, r1: r0 + ring };
      arcs[id] = arc;
      buried[id] = under;
      tiny[id] = (arc.a1 - arc.a0) * arc.r1 < TINY;
      a = arc.a1;
      place(m.nodes[id].children, arc.a0, under || tiny[id]);
    }
  };
  place(m.roots, START, false);
  return { cx: width / 2, cy: height / 2, hole, ring, outer, arcs, tiny, buried, total };
}

/** Ángulo llevado al rango de los arcos: [START, START + 2π). */
function normalize(a: number): number {
  while (a < START) a += TAU;
  while (a >= START + TAU) a -= TAU;
  return a;
}

/**
 * Nodo bajo (px, py), o -1: en el agujero, afuera, en un tramo sin hijos o sobre algo que cuelga
 * de un segmento diminuto (no se dibuja). Un segmento diminuto sí se apunta, por su ángulo.
 */
export function hitArc(m: SunModel, g: SunGeometry, px: number, py: number): number {
  const dist = Math.hypot(px - g.cx, py - g.cy);
  if (!(g.ring > 0) || dist < g.hole || dist > g.outer) return -1;
  const depth = Math.min(m.depth - 1, Math.floor((dist - g.hole) / g.ring));
  const a = normalize(Math.atan2(py - g.cy, px - g.cx));
  for (let id = 0; id < m.nodes.length; id++) {
    if (m.nodes[id].depth !== depth || g.buried[id]) continue;
    const arc = g.arcs[id];
    if (arc.a1 > arc.a0 && a >= arc.a0 && a < arc.a1) return id;
  }
  return -1;
}

// ------------------------------------------------------------ Color

/** Mezcla hacia la superficie de un nodo de profundidad `depth` (0 en el primer anillo). */
export function fadeFor(depth: number, theme: Pick<Theme, 'name'>): number {
  return Math.min(MAX_FADE[theme.name], depth * FADE[theme.name]);
}

/** Color de un nodo: el de su rama (o el gris de "Otros"), aclarado hacia la superficie por nivel. */
export function nodeColor(slot: number, depth: number, theme: Pick<Theme, 'name' | 'palette' | 'other' | 'surface'>): string {
  const base = slot >= 0 && slot < Math.min(MAX_COLORS, theme.palette.length) ? theme.palette[slot] : theme.other;
  const t = fadeFor(depth, theme);
  if (!t) return base;
  const a = parseColor(base);
  const b = parseColor(theme.surface);
  return a && b ? toHex(mixOklab(a, b, t)) : base;
}

// ------------------------------------------------------------ Etiquetas

export interface ArcLabel {
  text: string;
  x: number;
  y: number;
  /** Giro del texto en grados (ya corregido para no quedar de cabeza). */
  rotate: number;
  mode: 'tangential' | 'radial';
}

/** Giro legible: dentro de (−90°, 90°]; un texto que quedaría de cabeza se voltea media vuelta. */
export function upright(deg: number): number {
  let d = ((deg % 360) + 360) % 360;
  if (d > 90 && d <= 270) d -= 180;
  if (d > 270) d -= 360;
  return d;
}

/**
 * Largo disponible para un texto tangencial (perpendicular al radio, en el centro del anillo):
 * sus esquinas exteriores no pasan del borde de afuera y las interiores no salen del ángulo.
 */
export function tangentialRoom(arc: Arc): number {
  const rm = (arc.r0 + arc.r1) / 2;
  const lo = rm - LINE / 2;
  const hi = rm + LINE / 2;
  if (lo < arc.r0 + PAD / 2 || hi > arc.r1 - PAD / 2) return 0;
  const reach = arc.r1 - PAD / 2;
  const byRadius = 2 * Math.sqrt(Math.max(0, reach * reach - hi * hi));
  const half = (arc.a1 - arc.a0) / 2 - PAD / lo;
  if (half <= 0) return 0;
  const byAngle = half >= Math.PI / 2 ? Infinity : 2 * lo * Math.tan(half);
  return Math.max(0, Math.min(byRadius, byAngle) - 2 * PAD);
}

/**
 * Largo disponible para un texto radial (a lo largo del radio): el grosor del anillo menos el
 * aire, si el arco es lo bastante ancho para el alto de la línea en su extremo de adentro.
 */
export function radialRoom(arc: Arc): number {
  const inner = arc.r0 + PAD;
  const half = (arc.a1 - arc.a0) / 2;
  if (half <= 0 || (half < Math.PI / 2 && inner * Math.sin(half) < LINE / 2 + 1)) return 0;
  return Math.max(0, arc.r1 - arc.r0 - 2 * PAD);
}

/**
 * Etiqueta de un segmento. Si el nombre cabe entero de las dos formas, va en la más cercana a
 * la horizontal (tangencial arriba y abajo, radial a los costados): se lee sin girar la cabeza.
 * Si cabe de una sola, en esa. Si no cabe entero, recortado con "…" en la de más espacio,
 * siempre que queden al menos 4 letras. null si no cabe.
 */
export function fitArcLabel(arc: Arc, cx: number, cy: number, name: string, measure: (s: string) => number): ArcLabel | null {
  if (!name) return null;
  const m500 = (s: string) => measure(s) * WEIGHT_500;
  const mid = (arc.a0 + arc.a1) / 2;
  const deg = (mid * 180) / Math.PI;
  const turn = { tangential: upright(deg + 90), radial: upright(deg) };
  const room = { tangential: tangentialRoom(arc), radial: radialRoom(arc) };
  const w = m500(name);
  const fits = (['tangential', 'radial'] as const).filter((k) => w <= room[k]);
  let mode: ArcLabel['mode'];
  let text = name;
  if (fits.length === 2) mode = Math.abs(turn.radial) < Math.abs(turn.tangential) ? 'radial' : 'tangential';
  else if (fits.length === 1) mode = fits[0];
  else {
    mode = room.tangential >= room.radial ? 'tangential' : 'radial';
    text = fitText(name, room[mode], m500);
    if (text.length - 1 < Math.min(MIN_CHARS, name.length)) return null;
  }
  const [x, y] = polarPoint(cx, cy, (arc.r0 + arc.r1) / 2, mid);
  return { text, x, y, rotate: turn[mode], mode };
}

// ------------------------------------------------------------ Plugin

/** Campos de la ruta: `levels`, o el de la X si no se dan (un solo anillo). */
export function levelFields(o: SeriesOptions, xField: string): string[] {
  const levels = (o.levels ?? []).filter((f) => typeof f === 'string' && f);
  return levels.length ? levels : [xField];
}

/** Las columnas de texto se piden como level0, level1…: el núcleo admite cualquier nombre. */
function pathsOf(ps: PreparedSeries): string[][] {
  const cols: string[][] = [];
  for (let k = 0; ps.texts[`level${k}`]; k++) cols.push(ps.texts[`level${k}`]);
  return ps.values.map((_, i) => cols.map((c) => c[i] ?? ''));
}

/** Modelos por conjunto de datos: la tabla, el tooltip y el teclado lo tienen antes del primer dibujo. */
const models = new WeakMap<readonly number[], SunModel>();

function modelOf(ps: PreparedSeries): SunModel {
  let m = models.get(ps.values);
  if (!m) {
    m = buildHierarchy(pathsOf(ps), ps.values);
    models.set(ps.values, m);
  }
  return m;
}

interface Drawn {
  m: SunModel;
  g: SunGeometry;
  /** Etiqueta ya ubicada de cada nodo, o null. */
  labels: (ArcLabel | null)[];
  colors: string[];
}

/** Último cálculo: el puntero pregunta muchas veces por el mismo cuadro. */
let last: {
  y1: readonly number[];
  alpha: number;
  w: number;
  h: number;
  theme: Theme;
  labels: boolean;
  m: SunModel;
  d: Drawn;
} | null = null;

function drawnOf(ctx: DrawContext): Drawn {
  const { frame, width: w, height: h, theme } = ctx;
  const m = modelOf(frame.ps);
  const show = frame.ps.options.labels !== false;
  const c = last;
  if (
    c &&
    c.y1 === frame.y1 &&
    c.alpha === frame.alpha &&
    c.w === w &&
    c.h === h &&
    c.theme === theme &&
    c.labels === show &&
    c.m === m
  )
    return c.d;
  const g = layoutSunburst(m, frame.y1, w, h, frame.alpha);
  const labels = m.nodes.map((node, id) =>
    show && !g.tiny[id] && !g.buried[id] ? fitArcLabel(g.arcs[id], g.cx, g.cy, node.name, ctx.measure) : null,
  );
  const colors = m.nodes.map((node) => nodeColor(node.slot, node.depth, theme));
  const d = { m, g, labels, colors };
  last = { y1: frame.y1, alpha: frame.alpha, w, h, theme, labels: show, m, d };
  return d;
}

function segment(d: Drawn, theme: Theme, arc: Arc, color: string, gap = GAP): string {
  const path = slicePath(d.g.cx, d.g.cy, arc.r0, arc.r1, arc.a0, arc.a1);
  if (!path) return '';
  const a: Record<string, string | number> = { d: path, fill: color, 'fill-rule': 'evenodd' };
  if (gap) Object.assign(a, { stroke: theme.surface, 'stroke-width': gap, 'stroke-linejoin': 'round' });
  return `<path${attrs(a)}/>`;
}

function labelMarkup(d: Drawn, theme: Theme, id: number): string {
  const L = d.labels[id];
  if (!L) return '';
  const a = {
    x: r2(L.x),
    y: r2(L.y),
    transform: L.rotate ? `rotate(${r2(L.rotate)} ${r2(L.x)} ${r2(L.y)})` : undefined,
    fill: inkFor(d.colors[id], theme),
    'font-size': FONT,
    'font-weight': 500,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
  };
  return `<text${attrs(a)}>${esc(L.text)}</text>`;
}

/**
 * Segmentos de un grupo de hermanos, y lo que cuelga de cada uno: los diminutos seguidos van
 * juntos en una sola banda sin aire (los hermanos comparten color).
 */
function siblingsMarkup(d: Drawn, theme: Theme, ids: readonly number[]): string {
  let s = '';
  let run: number[] = [];
  const flush = () => {
    if (!run.length) return;
    const arc = { ...d.g.arcs[run[0]], a1: d.g.arcs[run[run.length - 1]].a1 };
    s += segment(d, theme, arc, d.colors[run[0]], 0);
    run = [];
  };
  for (const id of ids) {
    if (d.g.tiny[id]) {
      run.push(id);
      continue;
    }
    flush();
    s += segment(d, theme, d.g.arcs[id], d.colors[id]);
    s += siblingsMarkup(d, theme, d.m.nodes[id].children);
  }
  flush();
  return s;
}

/** Número del centro con su texto debajo: el total, o el nodo enfocado. */
function centerMarkup(ctx: DrawContext, g: SunGeometry, value: number, caption: string): string {
  if (g.hole < HOLE_MIN_FOR_TOTAL) return '';
  // measure() mide a 12 px: el tamaño se escala para que el número quepa en el 80 % del agujero.
  const room = g.hole * 2 * 0.8;
  const sizeFor = (t: string) => Math.min(TOTAL_MAX, (room * FONT) / Math.max(1, ctx.measure(t)), g.hole * 0.5);
  let text = ctx.format(value);
  if (sizeFor(text) < TOTAL_MIN) text = ctx.compact(value);
  const size = sizeFor(text);
  if (size < TOTAL_MIN) return '';
  const th = ctx.theme;
  // El texto de abajo queda más cerca del borde del agujero: algo más angosto que el número.
  const label = fitText(caption, room * 0.85, ctx.measure);
  const common = { x: r2(g.cx), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-variant-numeric': 'tabular-nums' };
  const number = `<text${attrs({ ...common, y: r2(g.cy - FONT / 2), fill: th.text, 'font-size': r2(size), 'font-weight': 600 })}>${esc(text)}</text>`;
  if (label === '…') return number;
  return (
    number +
    `<text${attrs({ ...common, y: r2(g.cy + size / 2 + 4), fill: th.textMuted, 'font-size': FONT })}>${esc(label)}</text>`
  );
}

/** Partes de un valor: de su padre (si no es del primer nivel) y del total. */
function shares(m: SunModel, parent: number, v: number, format: TooltipFormat): [string, string][] {
  const out: [string, string][] = [];
  const p = parent >= 0 ? m.nodes[parent] : null;
  if (p && p.value > 0) out.push([`De ${p.name}`, format.percent(v / p.value)]);
  if (m.total > 0) out.push(['Del total', format.percent(v / m.total)]);
  return out;
}

export const sunburst: SeriesImpl = {
  coords: 'free',
  // Los segmentos nacen en cero: el dominio debe incluirlo para que la animación parta de ahí.
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'sunburst',
  items: ['elemento', 'elementos'],
  texts: (o, x) => Object.fromEntries(levelFields(o, x).map((f, k) => [`level${k}`, f])),
  draw(ctx) {
    const d = drawnOf(ctx);
    const { g, m } = d;
    const th = ctx.theme;
    if (!(g.outer > 0)) return '';
    let s = siblingsMarkup(d, th, m.roots);
    if (!s) {
      // Todo en cero (inicio de la animación, o nada que dibujar): el primer anillo vacío, del
      // color de la rejilla, y el total en cero: se ve que no hay datos, no un gráfico roto.
      const ring = slicePath(g.cx, g.cy, g.hole, m.depth ? g.hole + g.ring : g.outer, 0, TAU);
      s = ring ? `<path${attrs({ d: ring, fill: th.grid, 'fill-rule': 'evenodd' })}/>` : '';
    }
    for (let id = 0; id < m.nodes.length; id++) s += labelMarkup(d, th, id);
    return s + centerMarkup(ctx, g, g.total, CAPTION);
  },
  hit(ctx, px, py) {
    const { m, g } = drawnOf(ctx);
    const id = hitArc(m, g, px, py);
    return id >= 0 ? refOf(m, id) : -1;
  },
  anchor(ctx, i) {
    const { m, g } = drawnOf(ctx);
    const id = nodeOfRef(m, i);
    if (id < 0) return [g.cx, g.cy];
    const arc = g.arcs[id];
    return polarPoint(g.cx, g.cy, arc.r1, (arc.a0 + arc.a1) / 2);
  },
  hover(ctx, i) {
    const d = drawnOf(ctx);
    const { m, g } = d;
    const id = nodeOfRef(m, i);
    if (id < 0 || !(g.arcs[id].a1 > g.arcs[id].a0)) return '';
    const th = ctx.theme;
    // Velo sobre todo; encima, la ruta hasta la raíz con sus etiquetas, y el nodo en el centro.
    const veil = `<rect${attrs({ x: -2, y: -2, width: r2(ctx.width + 4), height: r2(ctx.height + 4), fill: th.surface, 'fill-opacity': VEIL_ALPHA })}/>`;
    let s = veil;
    const chain: number[] = [];
    for (let k = id; k >= 0; k = m.nodes[k].parent) chain.unshift(k);
    for (const k of chain) s += segment(d, th, g.arcs[k], d.colors[k], g.tiny[k] ? 0 : GAP);
    // Contorno del activo en texto principal, por dentro: el foco se ve sobre cualquier relleno.
    const a = g.arcs[id];
    const ring = slicePath(g.cx, g.cy, a.r0 + 1.75, a.r1 - 1.75, a.a0, a.a1);
    if (ring && !g.tiny[id]) {
      s += `<path${attrs({ d: ring, fill: 'none', stroke: th.text, 'stroke-width': 1.5, 'stroke-linejoin': 'round' })}/>`;
    }
    for (const k of chain) s += labelMarkup(d, th, k);
    if (g.hole >= HOLE_MIN_FOR_TOTAL) {
      s += `<circle${attrs({ cx: r2(g.cx), cy: r2(g.cy), r: r2(g.hole - GAP / 2), fill: th.surface })}/>`;
      s += centerMarkup(ctx, g, m.nodes[id].value, m.nodes[id].name);
    }
    return s;
  },
  headline(ps, i, x) {
    const m = modelOf(ps);
    const id = nodeOfRef(m, i);
    if (id >= 0) return nodePath(m, id).join(SEP);
    const path = m.rowPath[i];
    return path && path.length ? path.join(SEP) : x;
  },
  navigable(ps) {
    const m = modelOf(ps);
    return m.order.map((id) => refOf(m, id));
  },
  // El color del segmento: su rama, aclarada por nivel. Una fila que es parte de un nodo, el de él.
  swatch(ctx, i) {
    const m = modelOf(ctx.frame.ps);
    const ref = nodeOfRef(m, i);
    const id = ref >= 0 ? ref : (m.rowNode[i] ?? -1);
    return id >= 0 ? nodeColor(m.nodes[id].slot, m.nodes[id].depth, ctx.theme) : null;
  },
  step(ps, i, key) {
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return undefined;
    const m = modelOf(ps);
    const id = nodeOfRef(m, i);
    if (id < 0) return undefined;
    const node = m.nodes[id];
    // Arriba, al padre; abajo, al hijo mayor. Donde no hay, sigue el recorrido lineal.
    const next = key === 'ArrowUp' ? node.parent : (node.children[0] ?? -1);
    return next >= 0 ? refOf(m, next) : undefined;
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const m = modelOf(ps);
    const id = nodeOfRef(m, i);
    if (id >= 0) {
      const v = m.nodes[id].value;
      return { value: format.value(v), details: shares(m, m.nodes[id].parent, v, format) };
    }
    const v = ps.values[i];
    // Sin dato: el núcleo escribe "Sin dato".
    if (!isFinite(v)) return null;
    if (m.rowNode[i] < 0) {
      const why = m.rowPath[i]?.length ? 'valor cero o negativo' : 'sin ruta';
      return { value: format.value(v), details: [['No se dibuja', why]] };
    }
    // Una fila que es parte de un nodo: su valor propio, o una de varias filas con la misma ruta.
    return { value: format.value(v), details: shares(m, m.rowNode[i], v, format) };
  },
};
