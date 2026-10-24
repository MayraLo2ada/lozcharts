/**
 * Cuadros (frames): el estado completo de un gráfico en un instante, en unidades de datos.
 *
 * Un cuadro guarda el dominio del eje Y y, por cada serie, la base (y0) y la punta (y1) de
 * cada índice. Animar es interpolar entre dos cuadros: el que se ve y el de destino.
 * Todo aquí es puro (sin DOM), así que se prueba sin navegador.
 */
import type { PreparedSeries, SeriesFrame } from './series';
import type { Prepared } from './prepare';
import { niceDomain } from './ticks';

export interface Frame {
  d0: number;
  d1: number;
  n: number;
  series: SeriesFrame[];
}

export interface DomainOptions {
  min?: number;
  max?: number;
  /** Incluir el cero aunque ninguna serie lo pida. */
  zero?: boolean;
  /** Cantidad aproximada de ticks deseados (para redondear el dominio). */
  ticks: number;
}

/** Cuadro destino: apila, ubica las barras en su grupo y calcula el dominio Y. */
export function buildFrame(p: Prepared, hidden: ReadonlySet<string>, domain: DomainOptions): Frame {
  const { n } = p;
  const frames: SeriesFrame[] = p.series.map((ps) => ({
    ps,
    y0: new Array<number>(n).fill(0),
    y1: ps.values.slice(),
    alpha: hidden.has(ps.key) ? 0 : 1,
    slot: 0,
    slots: 1,
    outer: new Array<boolean>(n).fill(true),
  }));
  stack(frames, n);
  placeInClusters(frames);
  const [d0, d1] = yDomain(frames, domain);
  settleUnstacked(frames, d0, d1);
  return { d0, d1, n, series: frames };
}

/**
 * Apila las series de cada grupo. Positivos y negativos se acumulan por separado.
 * Una serie oculta (o un valor vacío) queda con altura cero en su lugar de la pila,
 * así al ocultarse se encoge en el sitio y las demás se reacomodan.
 */
function stack(frames: SeriesFrame[], n: number): void {
  const groups = new Map<string, SeriesFrame[]>();
  for (const f of frames) {
    if (!f.ps.stackKey) continue;
    const group = groups.get(f.ps.stackKey);
    if (group) group.push(f);
    else groups.set(f.ps.stackKey, [f]);
  }
  for (const group of groups.values()) {
    const pos = new Array<number>(n).fill(0);
    const neg = new Array<number>(n).fill(0);
    const posTop = new Array<SeriesFrame | null>(n).fill(null);
    const negTop = new Array<SeriesFrame | null>(n).fill(null);
    for (const f of group) {
      for (let i = 0; i < n; i++) {
        const v = f.ps.values[i];
        const acc = v < 0 ? neg : pos;
        f.y0[i] = acc[i];
        if (f.alpha === 0 || !isFinite(v) || v === 0) {
          f.y1[i] = acc[i];
          continue;
        }
        f.y1[i] = acc[i] += v;
        (v < 0 ? negTop : posTop)[i] = f;
      }
    }
    // Solo el segmento exterior de cada pila lleva la punta redondeada.
    for (const f of group) {
      for (let i = 0; i < n; i++) f.outer[i] = posTop[i] === f || negTop[i] === f;
    }
  }
}

/**
 * Posición de cada barra dentro de su banda. Las visibles se reparten el espacio; una oculta
 * se queda entre sus vecinas para encogerse en su sitio. Una pila ocupa una sola posición.
 */
function placeInClusters(frames: SeriesFrame[]): void {
  const keyOf = (ps: PreparedSeries) => (ps.stackKey ? 'pila:' + ps.stackKey : 'serie:' + ps.key);
  const clustered = frames.filter((f) => f.ps.impl.cluster);
  const order = [...new Set(clustered.map((f) => keyOf(f.ps)))];
  const visible = order.filter((k) => clustered.some((f) => keyOf(f.ps) === k && f.alpha > 0));
  for (const f of clustered) {
    const k = keyOf(f.ps);
    const index = visible.indexOf(k);
    const before = visible.filter((v) => order.indexOf(v) < order.indexOf(k)).length;
    f.slot = index >= 0 ? index : Math.max(0, before - 0.5);
    f.slots = Math.max(1, visible.length);
  }
}

/** Dominio "bonito" del eje Y con las series visibles. */
function yDomain(frames: SeriesFrame[], opts: DomainOptions): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  let zero = !!opts.zero;
  const extend = (v: number) => {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  };
  for (const f of frames) {
    if (f.alpha === 0) continue;
    if (f.ps.impl.includeZero) zero = true;
    for (let i = 0; i < f.y1.length; i++) {
      if (isFinite(f.y1[i])) extend(f.y1[i]);
      if (f.ps.stackKey && isFinite(f.y0[i])) extend(f.y0[i]);
    }
  }
  if (lo > hi) [lo, hi] = [0, 1];
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (opts.min !== undefined) lo = opts.min;
  if (opts.max !== undefined) hi = opts.max;
  const [d0, d1] = niceDomain(lo, hi, opts.ticks);
  return [opts.min ?? d0, opts.max ?? d1];
}

/**
 * Las series sin pila se apoyan en el cero, o en el borde más cercano si el cero no se ve
 * (un precio entre 150 y 200). Ahí crecen al entrar y se encogen al ocultarse.
 */
function settleUnstacked(frames: SeriesFrame[], d0: number, d1: number): void {
  const base = Math.max(d0, Math.min(d1, 0));
  for (const f of frames) {
    if (f.ps.stackKey) continue;
    f.y0.fill(base);
    if (f.alpha === 0) f.y1 = f.ps.values.map((v) => (isFinite(v) ? base : NaN));
  }
}

/** El mismo cuadro con todas las series en su base: el punto de partida de la primera animación. */
export function collapse(frame: Frame): Frame {
  return { ...frame, series: frame.series.map(collapseSeries) };
}

function collapseSeries(f: SeriesFrame): SeriesFrame {
  const base = f.ps.stackKey ? f.y0.map(() => 0) : f.y0.slice();
  return { ...f, y0: base, y1: base.slice(), alpha: 0 };
}

/**
 * Destino de una animación: el cuadro nuevo más las series que ya no existen,
 * encogidas en su base para que salgan con suavidad en vez de desaparecer de golpe.
 */
export function withExits(from: Frame, to: Frame): Frame {
  const keys = new Set(to.series.map((s) => s.ps.key));
  const exiting = from.series
    .filter((s) => !keys.has(s.ps.key) && s.alpha > 0)
    .map((s) => {
      const y0 = resize(s.y0, to.n, NaN);
      return { ...s, y0, y1: y0.slice(), alpha: 0, outer: resize(s.outer, to.n, false) };
    });
  return exiting.length ? { ...to, series: [...to.series, ...exiting] } : to;
}

/**
 * Cuadro intermedio entre `a` y `b` en t ∈ [0, 1]. Las series que no estaban en `a` crecen
 * desde su base; los índices nuevos (más datos que antes) también.
 */
export function interpolate(a: Frame, b: Frame, t: number): Frame {
  const prev = new Map(a.series.map((s) => [s.ps.key, s]));
  return {
    d0: lerp(a.d0, b.d0, t),
    d1: lerp(a.d1, b.d1, t),
    n: b.n,
    series: b.series.map((s) => {
      const from = prev.get(s.ps.key) ?? collapseSeries(s);
      const base = (i: number) => (s.ps.stackKey ? 0 : s.y0[i]);
      const fy0 = resize(from.y0, b.n, NaN).map((v, i) => (isFinite(v) ? v : base(i)));
      const fy1 = resize(from.y1, b.n, NaN).map((v, i) => (isFinite(v) ? v : fy0[i]));
      return {
        ...s,
        y0: s.y0.map((v, i) => lerp(fy0[i], v, t)),
        y1: s.y1.map((v, i) => lerp(fy1[i], v, t)),
        alpha: lerp(from.alpha, s.alpha, t),
        slot: lerp(from.slot, s.slot, t),
        slots: lerp(from.slots, s.slots, t),
      };
    }),
  };
}

/** Interpolación lineal. Si un extremo no es un número (un hueco), se usa el destino. */
export function lerp(a: number, b: number, t: number): number {
  return isFinite(a) && isFinite(b) ? a + (b - a) * t : b;
}

/** Ajusta un arreglo a largo n, recortando o rellenando con `fill`. */
function resize<T>(a: T[], n: number, fill: T): T[] {
  if (a.length === n) return a;
  const out = a.slice(0, n);
  while (out.length < n) out.push(fill);
  return out;
}
