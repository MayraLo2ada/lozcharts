/**
 * Cascada (LozWaterfall): cómo se llega de un número a otro. Cada fila es una variación sobre el
 * acumulado anterior (ingresos, costos, impuestos…) y su barra flota del acumulado previo al
 * nuevo; las filas marcadas en `total` son subtotales o totales y parten del cero.
 *
 * Al eje van los acumulados, no las variaciones (ver `derive`): el dominio queda justo para lo
 * que se dibuja (una bajada de 600 no estira el eje hasta −600 si el acumulado nunca baja del
 * cero) y la animación interpola cada acumulado desde el cero, así las barras se arman en su
 * lugar. La variación de cada fila se lee del mismo campo como columna (`delta`).
 *
 * Un total sin valor muestra el acumulado hasta ahí. Si trae valor, ese valor manda: es el dato
 * del usuario (un saldo inicial, un cierre auditado) y el acumulado sigue desde él. Si no
 * coincide con la suma de las variaciones, se avisa en consola y el tooltip da la diferencia sin
 * explicar: la cascada no inventa una barra para cubrirla.
 *
 * La dirección no depende de verde y rojo. Una subida es rellena del color de la serie; una
 * bajada es hueca, con borde de 1,5 px del mismo color: lo que se le quitó al acumulado. Un total
 * va relleno en el gris neutro del tema (el de "Otros"), con más de 3:1 contra la superficie en
 * los dos temas: se lee como un resultado, no como un movimiento, y en oscuro no encandila como
 * lo haría el texto secundario. Además la punta redondeada apunta hacia donde
 * se movió el acumulado (abajo en una bajada) y la etiqueta lleva signo: ninguna pista es solo
 * de color, y una barra demasiado baja para verse hueca se rellena sin perder la dirección.
 *
 * Etiquetas: del lado al que se movió el acumulado (encima de una subida, debajo de una bajada)
 * y, si ahí se salen del área, del otro lado; si tampoco caben, se omiten. Todas exactas o todas
 * compactas, nunca mezcladas, y nunca más anchas que su banda: no se enciman con las vecinas ni
 * con los conectores, que corren a la altura de los bordes y no de los textos.
 *
 * Un hueco (NaN) no se dibuja: el acumulado sigue igual y el conector se corta ahí.
 * Toda la geometría (acumulados, tramos, barras, conectores y etiquetas) son funciones puras.
 */
import {
  dimOpacity,
  paintDimmed,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import { attrs, esc } from '../core/dom';
import { barPath, r2 } from '../core/shapes';

/** Marcas de barra (ver DESIGN.md): 24 px como máximo, punta de 4 px y 2 px entre vecinas. */
const MAX_WIDTH = 24;
const GAP = 2;
const RADIUS = 4;
/** Fracción de la banda que puede ocupar el grupo; el resto es aire entre categorías. */
const GROUP_FILL = 0.72;
/** Borde de una bajada (hueca), por dentro de la barra: mide lo mismo que una rellena. */
const STROKE = 1.5;
/** Con menos alto que esto, una barra hueca no se distingue de una raya: se rellena. */
const MIN_HOLLOW = 5;
/** Etiquetas: 12 px, a 4 px de la barra y con 2 px de aire a cada lado dentro de su banda. */
const FONT = 12;
const LABEL_GAP = 4;
const LABEL_SIDE = 2;
const HALO = 3;
/** Una etiqueta puede asomar hasta aquí fuera del área: es el margen del recorte de las series. */
const OVERFLOW = 6;
/** Anillo de hover: 2 px de texto principal, separado 2 px de la barra. */
const RING = 2;
const RING_GAP = 2;
/** Con varias cascadas lado a lado, punta de cada total en el color de su serie, en px. */
const CAP = 3;
/** Reflejo del plano lógico (ver core/series.ts): aplicado otra vez a un texto, lo endereza. */
const SWAP = 'matrix(0 1 1 0 0 0)';
/** Diferencia relativa que se tolera entre un total dado y la suma de sus variaciones (redondeo). */
const TOLERANCE = 1e-9;
/**
 * Aire para las etiquetas en los extremos del eje, como fracción del recorrido de los acumulados:
 * sin él, la barra más alta suele tocar el borde y su etiqueta (la más importante) no cabe.
 * Un 8 % son unos 24 px en un gráfico de 300.
 */
const HEADROOM = 0.08;

/** Qué cuenta una fila: sube, baja, no cambia o es un total (parte del cero). */
export type StepKind = 'up' | 'down' | 'flat' | 'total';

/** Tramo de una fila en unidades del eje: del acumulado anterior (o del cero) al suyo. */
export interface Step {
  from: number;
  to: number;
}

export interface Cascade {
  /** Acumulado después de cada fila (NaN en un hueco). */
  levels: number[];
  /** En un total con valor: lo que difiere de la suma de sus variaciones (0 si coincide). */
  gaps: number[];
}

/** ¿La celda marca un total? Cualquier valor salvo vacío, false, 0 o "no". */
export function isTotal(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t !== '' && t !== 'false' && t !== '0' && t !== 'no' && t !== 'null' && t !== 'undefined';
}

/**
 * Acumulados de una cascada. Una variación suma; un hueco no cambia nada; un total sin valor
 * muestra lo acumulado y, con valor, lo fija. Antes de cualquier dato no hay nada que contradecir:
 * la primera fila puede ser un saldo inicial marcado como total.
 */
export function cascade(deltas: readonly number[], totals: readonly boolean[]): Cascade {
  const levels: number[] = [];
  const gaps: number[] = [];
  let acc = 0;
  let started = false;
  for (let i = 0; i < deltas.length; i++) {
    const v = deltas[i];
    let gap = 0;
    if (totals[i]) {
      if (isFinite(v)) {
        const scale = Math.max(1, Math.abs(v), Math.abs(acc));
        if (started && Math.abs(v - acc) > TOLERANCE * scale) gap = v - acc;
        acc = v;
      }
      started = true;
      levels.push(acc);
    } else if (isFinite(v)) {
      acc += v;
      started = true;
      levels.push(acc);
    } else {
      levels.push(NaN);
    }
    gaps.push(gap);
  }
  return { levels, gaps };
}

/**
 * Tramo de cada fila a partir de los acumulados (los del cuadro, que se animan): una variación
 * va del último acumulado al suyo; un total, del cero al suyo. null en un hueco.
 */
export function steps(levels: readonly number[], totals: readonly boolean[]): (Step | null)[] {
  let prev = 0;
  return levels.map((to, i) => {
    if (!isFinite(to)) return null;
    const from = totals[i] ? 0 : prev;
    prev = to;
    return { from, to };
  });
}

/** Qué cuenta la fila, según los datos (no el cuadro: una barra no cambia de tipo al animarse). */
export function kindOf(delta: number, total: boolean): StepKind {
  if (total) return 'total';
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

/** ¿Es el total final? Ninguna variación con dato después de él; si no, es un subtotal. */
export function isFinal(deltas: readonly number[], totals: readonly boolean[], i: number): boolean {
  for (let j = i + 1; j < deltas.length; j++) if (!totals[j] && isFinite(deltas[j])) return false;
  return true;
}

/** Una variación con signo: "+120", "−80" (con el signo menos tipográfico) o "0". */
export function signed(format: (v: number) => string, d: number): string {
  return (d > 0 ? '+' : d < 0 ? '−' : '') + format(Math.abs(d));
}

/**
 * Ancho de cada barra, su desplazamiento respecto al centro de la banda (como en las barras) y
 * el ancho de todo el grupo, que es lo que saltan los conectores.
 */
export function barGeometry(step: number, slot: number, slots: number): { width: number; offset: number; group: number } {
  const count = Math.max(1, slots);
  const width = Math.max(1, Math.min(MAX_WIDTH, (step * GROUP_FILL - (count - 1) * GAP) / count));
  const group = count * width + (count - 1) * GAP;
  return { width, offset: -group / 2 + slot * (width + GAP), group };
}

/** ¿Esta barra se dibuja hueca? Las bajadas, salvo las que no tienen alto o ancho para verse huecas. */
export function hollowAt(kind: StepKind, length: number, width: number): boolean {
  return kind === 'down' && Math.abs(length) >= MIN_HOLLOW && width >= MIN_HOLLOW;
}

/**
 * Trazo de una barra entre `base` y `end` (px del eje del valor), con la punta en `end`. Hueca,
 * el borde va por dentro (medio trazo hacia adentro en cada lado): mide lo mismo que una rellena.
 */
export function barShape(x: number, width: number, base: number, end: number, hollow: boolean): string {
  if (!hollow) return barPath(x, width, base, end, RADIUS, true);
  const dir = Math.sign(end - base);
  const inset = STROKE / 2;
  return barPath(x + inset, width - STROKE, base + dir * inset, end - dir * inset, RADIUS - inset, true);
}

/**
 * Conectores de 1 px a la altura del acumulado, entre una categoría y la siguiente; se cortan en
 * un hueco. Van del borde de un grupo al del siguiente (con una sola serie, de barra a barra):
 * con varias cascadas lado a lado, ninguna línea cruza por encima de las barras de otra serie.
 * `at` lleva un índice al centro de su banda y `map`, un valor a px; `group` es el ancho del grupo.
 */
export function connectorPath(
  tramos: readonly (Step | null)[],
  at: (i: number) => number,
  map: (v: number) => number,
  group: number,
): string {
  let d = '';
  for (let i = 0; i + 1 < tramos.length; i++) {
    const a = tramos[i];
    if (!a || !tramos[i + 1]) continue;
    const x1 = at(i) + group / 2;
    const x2 = at(i + 1) - group / 2;
    if (x2 - x1 < 1) continue;
    // Al medio píxel: una línea de 1 px queda nítida.
    const y = Math.round(map(a.to)) + 0.5;
    d += `M${r2(x1)},${y}H${r2(x2)}`;
  }
  return d;
}

/** Una etiqueta en el plano lógico: `cross` sobre el eje del índice y `along` sobre el del valor. */
export interface PlacedLabel {
  i: number;
  text: string;
  cross: number;
  along: number;
}

export interface LabelInput {
  tramos: readonly (Step | null)[];
  kinds: readonly StepKind[];
  /** Texto exacto y compacto de cada fila. */
  exact: readonly string[];
  compact: readonly string[];
  /** Centro de la barra i sobre el eje del índice. */
  center: (i: number) => number;
  map: (v: number) => number;
  measure: (text: string) => number;
  /** Lo que puede ocupar una etiqueta sobre el eje del índice (su banda, o su lugar en el grupo). */
  room: number;
  /** Largo del eje del valor, en px. */
  length: number;
  /** En horizontal, el valor crece hacia px mayores y el texto se extiende a lo largo del valor. */
  horizontal: boolean;
}

/** Lo que se decide de las etiquetas de una cascada: si van compactas y si van las variaciones. */
export interface LabelPlan {
  compact: boolean;
  steps: boolean;
}

/** Filas con barra, y si un texto cabe a lo ancho en su lugar. */
function fitting(o: LabelInput): { drawn: number[]; fits: (t: string) => boolean } {
  const drawn = o.tramos.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
  const cross = (t: string) => (o.horizontal ? FONT : o.measure(t));
  return { drawn, fits: (t) => !!t && cross(t) <= o.room };
}

/**
 * Exactas si todas caben a lo ancho; si no, todas compactas (o lo que diga `compact`). Las
 * variaciones van todas o ninguna: unas pocas sueltas entre treinta barras parecen elegidas y no
 * lo son.
 */
export function labelPlan(o: LabelInput, compact?: boolean): LabelPlan {
  const { drawn, fits } = fitting(o);
  const c = compact ?? !drawn.every((i) => fits(o.exact[i]));
  const texts = c ? o.compact : o.exact;
  return { compact: c, steps: drawn.every((i) => o.kinds[i] === 'total' || fits(texts[i])) };
}

/**
 * Plan común de varias cascadas lado a lado: compactas si alguna lo necesita, y las variaciones
 * solo si caben en todas. Así nunca queda una serie con etiquetas y su vecina sin ellas.
 */
export function jointPlan(inputs: readonly LabelInput[]): LabelPlan {
  const compact = inputs.some((o) => labelPlan(o).compact);
  return { compact, steps: inputs.every((o) => labelPlan(o, compact).steps) };
}

/**
 * Etiquetas de valor, según el plan (por defecto, el de esta cascada sola). Los totales se ponen
 * uno por uno si caben: son el principio y el final del relato. Cada una va del lado al que se
 * movió el acumulado o, si ahí se sale del área, del otro; si tampoco, se omite. Como no salen de
 * su banda, nunca se enciman.
 */
export function placeLabels(o: LabelInput, plan: LabelPlan = labelPlan(o)): PlacedLabel[] {
  const { drawn, fits } = fitting(o);
  const texts = plan.compact ? o.compact : o.exact;
  const steps = plan.steps;
  // Hacia valores mayores: arriba en vertical (px menores), a la derecha en horizontal.
  const s = o.horizontal ? 1 : -1;
  const out: PlacedLabel[] = [];
  for (const i of drawn) {
    const text = texts[i];
    if (!fits(text) || (!steps && o.kinds[i] !== 'total')) continue;
    const { from, to } = o.tramos[i]!;
    const size = o.horizontal ? o.measure(text) : FONT;
    const above = o.map(Math.max(from, to)) + s * (LABEL_GAP + size / 2);
    const below = o.map(Math.min(from, to)) - s * (LABEL_GAP + size / 2);
    const k = o.kinds[i];
    const sides = k === 'down' || (k === 'total' && to < 0) ? [below, above] : [above, below];
    const along = sides.find((c) => c - size / 2 >= -OVERFLOW && c + size / 2 <= o.length + OVERFLOW);
    if (along === undefined) continue;
    out.push({ i, text, cross: o.center(i), along });
  }
  return out;
}

/**
 * Columna `room`: cada acumulado alejado del cero en una fracción del recorrido. Cuenta para el
 * eje (ver `valueColumns`) y nunca se dibuja: deja lugar a las etiquetas de los extremos.
 */
export function headroom(levels: readonly number[], share = HEADROOM): number[] {
  let lo = 0;
  let hi = 0;
  for (const v of levels) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const pad = (hi - lo) * share;
  return levels.map((v) => (v > 0 ? v + pad : v < 0 ? v - pad : v));
}

/** Marcas de total de la serie, leídas de la columna de texto `total`. */
function totalsOf(ps: PreparedSeries): boolean[] {
  const col = ps.texts.total;
  return ps.values.map((_, i) => !!col && isTotal(col[i] ?? ''));
}

/** Variaciones tal como vienen en los datos (columna `delta`, el mismo campo de la serie). */
function deltasOf(ps: PreparedSeries): number[] {
  return ps.columns.delta ?? ps.values;
}

/** ¿Hay varias cascadas lado a lado? Sus totales grises llevan la punta del color de la serie. */
function isClustered(ctx: DrawContext): boolean {
  return Math.round(ctx.frame.slots) > 1;
}

/** ¿El plano está reflejado? En horizontal, el valor crece hacia px mayores. */
function isHorizontal(ctx: DrawContext): boolean {
  return ctx.y.map(ctx.y.d1) > ctx.y.map(ctx.y.d0);
}

/** Lo que comparten el dibujo y el hover de un cuadro. */
function frameModel(ctx: DrawContext) {
  const ps = ctx.frame.ps;
  const totals = totalsOf(ps);
  const deltas = deltasOf(ps);
  const tramos = steps(ctx.frame.y1.slice(0, ctx.n), totals);
  const kinds = deltas.map((d, i) => kindOf(d, totals[i]));
  const { width, offset, group } = barGeometry(ctx.x.step, ctx.frame.slot, ctx.frame.slots);
  return { ps, deltas, tramos, kinds, width, offset, group };
}

/**
 * Lo que necesitan las etiquetas de una cascada en este cuadro. Los textos salen de los datos, no
 * del cuadro: no cambian mientras las barras se animan. Un total negativo lleva el mismo signo
 * menos que las variaciones; uno positivo, ninguno.
 */
function labelInput(ctx: DrawContext): LabelInput {
  const { ps, deltas, tramos, kinds, width, offset } = frameModel(ctx);
  const text = (i: number, fmt: (v: number) => string) =>
    kinds[i] === 'total' ? (ps.values[i] < 0 ? signed(fmt, ps.values[i]) : fmt(ps.values[i])) : signed(fmt, deltas[i]);
  const indices = tramos.map((_, i) => i);
  return {
    tramos,
    kinds,
    exact: indices.map((i) => text(i, ctx.format)),
    compact: indices.map((i) => text(i, ctx.compact)),
    center: (i) => ctx.x.at(i) + offset + width / 2,
    map: (v) => ctx.y.map(v),
    measure: ctx.measure,
    room: Math.round(ctx.frame.slots) > 1 ? width + GAP : ctx.x.step - 2 * LABEL_SIDE,
    length: ctx.height,
    horizontal: isHorizontal(ctx),
  };
}

export const waterfall: SeriesImpl = {
  band: true,
  cluster: true,
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'cascada',
  items: ['paso', 'pasos'],
  columns: (o) => ({ delta: o.field }),
  valueColumns: ['room'],
  texts: (o) => ({ total: o.total }),
  derivedName: 'acumulado',
  dimmable: true,
  derive(ps) {
    const { levels, gaps } = cascade(deltasOf(ps), totalsOf(ps));
    const off = gaps.map((g, i) => (g ? i + 1 : 0)).filter(Boolean);
    if (off.length) {
      const one = off.length === 1;
      console.warn(
        `LozCharts: en la cascada "${ps.name}", ${one ? 'el total de la fila' : 'los totales de las filas'} ${off.join(', ')} ` +
          `no ${one ? 'cuadra' : 'cuadran'} con la suma de los pasos anteriores. Dibujo ${one ? 'el total' : 'los totales'} que diste; revisa los datos si esperabas que cuadraran.`,
      );
    }
    // Sin etiquetas no hace falta el aire: el eje queda justo.
    ps.columns.room = ps.options.labels === false ? levels.slice() : headroom(levels);
    return levels;
  },
  navigable: (ps) => ps.values.map((v, i) => (isFinite(v) ? i : -1)).filter((i) => i >= 0),
  // Un total, en el gris neutro de su barra; con varias cascadas, en el color de la serie, como
  // la punta que dice de cuál es. Una bajada, aunque se dibuje hueca, lleva la muestra rellena:
  // hueca se leería como una serie oculta, igual que en la leyenda.
  swatch(ctx, i) {
    const ps = ctx.frame.ps;
    const total = kindOf(deltasOf(ps)[i], totalsOf(ps)[i]) === 'total';
    return total && !isClustered(ctx) ? ctx.theme.other : null;
  },
  draw(ctx) {
    const { ps, tramos, kinds, width, offset, group } = frameModel(ctx);
    const { x, y, theme } = ctx;
    const clustered = isClustered(ctx);
    // Los conectores no son datos: siguen enteros aunque haya selección.
    const lines = connectorPath(
      tramos,
      (i) => x.at(i),
      (v) => y.map(v),
      group,
    );
    let out = lines ? `<path${attrs({ d: lines, fill: 'none', stroke: theme.zero, 'stroke-width': 1 })}/>` : '';
    out += paintDimmed(ctx, (include) => {
      let up = '';
      let down = '';
      let total = '';
      let caps = '';
      let bars = '';
      tramos.forEach((t, i) => {
        if (!t || !include(i)) return;
        const base = y.map(t.from);
        const end = y.map(t.to);
        const hollow = hollowAt(kinds[i], end - base, width);
        const d = barShape(x.at(i) + offset, width, base, end, hollow);
        if (kinds[i] === 'total') {
          total += d;
          // Con varias cascadas, todos los totales son grises: la punta dice de qué serie es cada uno.
          const dir = Math.sign(end - base);
          if (clustered && Math.abs(end - base) > 2 * CAP)
            caps += barPath(x.at(i) + offset, width, end - dir * CAP, end, RADIUS, true);
        } else if (hollow) down += d;
        else up += d;
      });
      if (up) bars += `<path${attrs({ d: up, fill: ctx.color })}/>`;
      if (down) bars += `<path${attrs({ d: down, fill: theme.surface, stroke: ctx.color, 'stroke-width': STROKE })}/>`;
      if (total) bars += `<path${attrs({ d: total, fill: theme.other })}/>`;
      if (caps) bars += `<path${attrs({ d: caps, fill: ctx.color })}/>`;
      return bars;
    });
    // En el mini gráfico del zoom las etiquetas no se leerían: solo las barras.
    if (ps.options.labels === false || ctx.purpose === 'overview') return out;

    // Varias cascadas lado a lado deciden juntas: o todas llevan sus variaciones, o ninguna.
    const input = labelInput(ctx);
    const peers = (ctx.siblings?.() ?? []).filter((c) => c.frame.ps.options.labels !== false);
    const plan = peers.length > 1 ? jointPlan(peers.map((c) => (c === ctx ? input : labelInput(c)))) : labelPlan(input);
    const horizontal = input.horizontal;
    for (const l of placeLabels(input, plan)) {
      const at = horizontal ? { x: r2(l.along), y: r2(l.cross), transform: SWAP } : { x: r2(l.cross), y: r2(l.along) };
      out += `<text${attrs({
        ...at,
        opacity: dimOpacity(ctx, l.i),
        fill: theme.textMuted,
        'font-size': FONT,
        'font-variant-numeric': 'tabular-nums',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        stroke: theme.surface,
        'stroke-width': HALO,
        'stroke-linejoin': 'round',
        'paint-order': 'stroke',
      })}>${esc(l.text)}</text>`;
    }
    return out;
  },
  hover(ctx, i) {
    const { tramos, width, offset } = frameModel(ctx);
    const t = tramos[i];
    if (!t) return '';
    // Anillo alrededor de la barra activa: con el teclado también se ve dónde se está.
    const pad = RING_GAP + RING / 2;
    const base = ctx.y.map(t.from);
    const end = ctx.y.map(t.to);
    const dir = Math.sign(end - base) || -1;
    const left = ctx.x.at(i) + offset - pad;
    const d = barPath(left, width + 2 * pad, base - dir * pad, end + dir * pad, RADIUS + pad, true);
    return `<path${attrs({ d, fill: 'none', stroke: ctx.theme.text, 'stroke-width': RING })}/>`;
  },
  tooltip(ps: PreparedSeries, i: number, f: TooltipFormat): TooltipValue {
    const totals = totalsOf(ps);
    const deltas = deltasOf(ps);
    const level = ps.values[i];
    if (!isFinite(level)) return { value: 'Sin dato' };
    if (totals[i]) {
      const details: [string, string][] = [['Paso', isFinal(deltas, totals, i) ? 'Total' : 'Subtotal']];
      const gap = cascade(deltas, totals).gaps[i];
      if (gap) details.push(['Diferencia sin explicar', f.difference(gap)]);
      return { value: f.value(level), details };
    }
    const kind = kindOf(deltas[i], false);
    return {
      value: f.difference(deltas[i]),
      details: [
        ['Acumulado', f.value(level)],
        ['Paso', kind === 'up' ? 'Subida' : kind === 'down' ? 'Bajada' : 'Sin cambio'],
      ],
    };
  },
};
