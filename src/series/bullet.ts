/**
 * Bala (LozBullet): el gráfico de bala de Stephen Few. Una fila por indicador (la X es su
 * nombre): el valor es una barra delgada, la meta (`targetField`) una marca perpendicular y,
 * detrás, los rangos de calidad (`ranges`, como [50, 75, 100]: malo, aceptable, bueno).
 *
 * Escala compartida por todas las filas, con un solo eje abajo y su rejilla entre las filas:
 * los rangos son una sola lista para la serie, así que solo significan lo mismo en cada fila si
 * la escala es la misma, y comparar largos entre indicadores es justamente lo que se busca. Para
 * indicadores con unidades distintas, un gráfico por indicador (o paneles alineados): mezclar
 * pesos y porcentajes en una escala sería engañar con la longitud.
 *
 * Los rangos van en grises del tono neutro del tema, más intensos cuanto peor es el rango (como
 * en el original de Few): el valor, en el color de la serie, es lo único con color. Nunca
 * semáforo rojo-amarillo-verde, que no se distingue con daltonismo y compite con el dato. El
 * primer rango empieza donde empieza la escala; lo que sigue al último queda sin fondo, así un
 * valor que lo supera se ve salir de la zona de calidad.
 *
 * El valor parte del cero (o del borde de la escala, si el cero no está a la vista), con un
 * anillo de superficie que lo despega de las bandas. La meta, en texto principal con halo de
 * superficie, es más alta que la barra: se lee aunque el valor la cruce. La etiqueta del valor
 * va al final de la barra si cabe y nunca encima de la meta: si chocan, salta al otro lado de la
 * meta o al otro lado de la base; si no cabe en ningún lado, no se dibuja (el tooltip la tiene).
 *
 * Toda la geometría (rangos, tonos, filas, escala, etiquetas y hit-test) son funciones puras.
 */
import { messages } from '../core/i18n';
import {
  dimmed,
  type DrawContext,
  type PreparedSeries,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from '../core/series';
import type { Theme } from '../core/theme';
import { attrs, esc } from '../core/dom';
import { r2 } from '../core/shapes';
import { fitText } from '../core/axis';
import { mixOklab, parseColor, toHex } from '../core/color';
import { niceStep, numberTicks } from '../core/ticks';

const FONT = 12;
/** Los nombres ocupan como máximo esta parte del ancho y se recortan con "…" (como en las barras horizontales). */
const MAX_NAME_SHARE = 0.4;
/** Aire entre el nombre y el comienzo de la escala. */
const NAME_GAP = 10;
/** Alto reservado abajo para los números del eje, y su distancia a la última fila. */
const AXIS_SPACE = 24;
const AXIS_GAP = 8;
/** Separación entre centros de fila: tope para que pocas filas no se estiren sin sentido. */
const MAX_PITCH = 56;
/** Grosor de las bandas como parte de la fila, con tope de 24 px (el de las barras). */
const BAND_SHARE = 0.6;
const MAX_BAND = 24;
const MIN_BAND = 4;
/** La barra del valor mide un tercio de las bandas: se lee como una barra "dentro" del fondo. */
const BAR_SHARE = 1 / 3;
const MIN_BAR = 2;
const BAR_RADIUS = 2;
/** La meta mide tres cuartos de la banda y al menos 3 px más que la barra por cada lado. */
const TARGET_SHARE = 0.75;
const TARGET_OVER_BAR = 6;
export const TARGET_WIDTH = 3;
/** Halo de superficie alrededor de la barra y de la meta, en px. */
const HALO = 1;
/** Distancia de la etiqueta del valor a la barra o a la meta. */
const LABEL_GAP = 6;
/** Por debajo de esto los nombres de filas vecinas se tocarían: se muestra uno de cada tantos. */
const NAME_LINE = FONT + 2;
/** Separación mínima entre ticks del eje, en px. */
const TICK_SPACING = 90;
/** La franja del hover deja 2 px de aire con la fila vecina. */
const HOVER_INSET = 2;

/**
 * Mezcla del texto sobre la superficie para el rango más intenso y el más tenue. Validado: el
 * texto secundario pasa 4,5:1 sobre el más intenso en los dos temas, y el oscuro va algo más
 * alto porque ahí la diferencia entre grises se percibe menos.
 */
const SHADE = { light: { max: 0.17, min: 0.055 }, dark: { max: 0.21, min: 0.07 } };

/** Límites de los rangos utilizables: finitos, de menor a mayor y sin repetir. */
export function cleanRanges(ranges: readonly number[] | undefined): number[] {
  const list = (ranges ?? []).filter((v) => typeof v === 'number' && isFinite(v));
  return [...new Set(list)].sort((a, b) => a - b);
}

function mix(theme: Theme, t: number): string {
  const surface = parseColor(theme.surface);
  const text = parseColor(theme.text);
  return surface && text ? toHex(mixOklab(surface, text, t)) : theme.grid;
}

/**
 * Tonos de `count` rangos, del primero (el peor, el más intenso) al último (el más tenue). Uno
 * solo va en el tono medio.
 */
export function bandShades(count: number, theme: Theme): string[] {
  const { max, min } = SHADE[theme.name];
  if (count <= 0) return [];
  if (count === 1) return [mix(theme, (max + min) / 2)];
  return Array.from({ length: count }, (_, k) => mix(theme, max - ((max - min) * k) / (count - 1)));
}

/** Sin rangos, una pista en el tono más tenue marca de dónde a dónde va la escala. */
export function trackShade(theme: Theme): string {
  return mix(theme, SHADE[theme.name].min);
}

/** Un rango de fondo ya recortado a la escala: de `from` a `to`, y su posición en la lista. */
export interface Band {
  index: number;
  from: number;
  to: number;
}

/**
 * Bandas visibles entre d0 y d1. El rango k va del límite anterior (o del comienzo de la escala)
 * a `ranges[k]`; las que quedan fuera de la escala o sin ancho no se devuelven.
 */
export function bandSegments(ranges: readonly number[], d0: number, d1: number): Band[] {
  const out: Band[] = [];
  for (let k = 0; k < ranges.length; k++) {
    const from = Math.max(d0, k === 0 ? d0 : ranges[k - 1]);
    const to = Math.min(d1, ranges[k]);
    if (to > from) out.push({ index: k, from, to });
  }
  return out;
}

/**
 * Rango en que cae v: el primero cuyo límite alcanza (un valor justo en el límite cuenta en el
 * rango que termina ahí); `ranges.length` si los supera todos; -1 sin rangos o sin valor.
 */
export function rangeIndex(v: number, ranges: readonly number[]): number {
  if (!ranges.length || !isFinite(v)) return -1;
  const k = ranges.findIndex((r) => v <= r);
  return k < 0 ? ranges.length : k;
}

/**
 * "Hasta 50 (1 de 3)", "Entre 50 y 75 (2 de 3)" o "Más de 100 (pasa la última)", en el idioma
 * dado; null sin franjas.
 */
export function rangeText(v: number, ranges: readonly number[], format: (v: number) => string, locale?: string): string | null {
  const k = rangeIndex(v, ranges);
  if (k < 0) return null;
  const t = messages(locale).bullet;
  const n = ranges.length;
  if (k === n) return t.above(format(ranges[n - 1]));
  const span = k === 0 ? t.upTo(format(ranges[0])) : t.between(format(ranges[k - 1]), format(ranges[k]));
  return `${span} ${t.position(k + 1, n)}`;
}

export interface BulletLayout {
  /** Comienzo y fin de la escala del valor, en px. */
  x0: number;
  x1: number;
  /** Ancho disponible para los nombres. */
  nameWidth: number;
  /** Distancia entre centros de fila. */
  pitch: number;
  band: number;
  bar: number;
  target: number;
  /** Línea donde van los números del eje. */
  axisY: number;
  /** Con filas muy juntas, se nombra una de cada `every`. */
  every: number;
  /**
   * ¿Caben los valores junto a las barras? Solo si cada fila tiene el alto de una línea de texto:
   * un valor por fila no se puede saltear como los nombres sin que el lector pierda a cuál va.
   */
  values: boolean;
  n: number;
}

/**
 * Filas de arriba hacia abajo, alineadas arriba: el eje queda pegado a la última fila y no
 * flota lejos de los datos cuando sobra alto. `labelWidth` es el ancho del nombre más largo y
 * `rightPad`, lo que se reserva a la derecha para las etiquetas del valor.
 */
export function bulletLayout(n: number, width: number, height: number, labelWidth: number, rightPad = 0): BulletLayout {
  const nameWidth = Math.max(0, Math.min(labelWidth, width * MAX_NAME_SHARE));
  const x0 = nameWidth > 0 ? nameWidth + NAME_GAP : 0;
  const x1 = Math.max(x0 + 1, width - rightPad);
  const pitch = n > 0 ? Math.min(MAX_PITCH, Math.max(1, height - AXIS_SPACE) / n) : 0;
  const band = Math.max(Math.min(MIN_BAND, pitch), Math.min(MAX_BAND, pitch * BAND_SHARE));
  const bar = Math.max(MIN_BAR, Math.round(band * BAR_SHARE));
  const target = Math.min(pitch * 0.9, Math.max(band * TARGET_SHARE, bar + TARGET_OVER_BAR));
  return {
    x0,
    x1,
    nameWidth,
    pitch,
    band,
    bar,
    target,
    axisY: pitch * n + AXIS_GAP,
    every: pitch > 0 ? Math.max(1, Math.ceil(NAME_LINE / pitch)) : 1,
    values: pitch >= NAME_LINE,
    n,
  };
}

/** Centro vertical de la fila i. */
export function rowCenter(L: BulletLayout, i: number): number {
  return L.pitch * (i + 0.5);
}

/** Posición en px de v sobre la escala; lo que se sale (con yAxis.min o max fijos), al borde. */
export function valueX(L: BulletLayout, d0: number, d1: number, v: number): number {
  const span = d1 - d0;
  if (!(span > 0) || !isFinite(v)) return L.x0;
  const t = Math.min(1, Math.max(0, (v - d0) / span));
  return L.x0 + t * (L.x1 - L.x0);
}

/** Base de las barras: el cero, o el borde de la escala más cercano si el cero no se ve. */
export function baseValue(d0: number, d1: number): number {
  return Math.max(d0, Math.min(d1, 0));
}

/** Fila bajo la altura py (en todo el ancho de la fila), o -1. */
export function hitRow(L: BulletLayout, py: number): number {
  if (!(L.pitch > 0) || py < 0 || py >= L.pitch * L.n) return -1;
  return Math.floor(py / L.pitch);
}

/**
 * Ticks del eje: los "bonitos" del dominio con al menos 90 px entre vecinos. niceStep apunta a
 * una cantidad aproximada, así que se pide menos hasta que el paso respete esa distancia.
 */
export function axisTicks(d0: number, d1: number, length: number): number[] {
  const span = d1 - d0;
  if (!(span > 0)) return [d0];
  const room = Math.max(1, length / TICK_SPACING);
  let step = niceStep(span, Math.max(1, Math.floor(room)));
  for (let count = Math.floor(room) - 1; count >= 1 && span / step > room; count--) step = niceStep(span, count);
  return numberTicks(d0, d1, step);
}

/**
 * Dónde va la etiqueta del valor, o null si no cabe. Se prueba, en orden: al final de la barra;
 * pasando la meta, si la meta está adelante y estorba; al otro lado de la base; y pasando la
 * meta de ese lado (un negativo con la meta positiva cerca del cero). Nunca se
 * superpone a la meta (`target` es su centro en px, o NaN) ni se sale de [lo, hi].
 */
export function placeValueLabel(
  base: number,
  end: number,
  target: number,
  width: number,
  lo: number,
  hi: number,
): { x: number; anchor: 'start' | 'end' } | null {
  const dir = end >= base ? 1 : -1;
  const half = TARGET_WIDTH / 2 + HALO;
  const blocked = (a: number, b: number) => isFinite(target) && b > target - half && a < target + half;
  const at = (from: number, d: number) => {
    const x = from + d * LABEL_GAP;
    const [a, b] = d > 0 ? [x, x + width] : [x - width, x];
    return a >= lo && b <= hi && !blocked(a, b) ? { x, anchor: d > 0 ? ('start' as const) : ('end' as const) } : null;
  };
  const ahead = isFinite(target) && (target - end) * dir >= -half;
  const behind = isFinite(target) && (target - base) * dir < 0;
  return (
    at(end, dir) ??
    (ahead ? at(target + dir * half, dir) : null) ??
    at(base, -dir) ??
    (behind ? at(target - dir * half, -dir) : null)
  );
}

/** Trazo de una barra horizontal de xa (base, recta) a xb (punta, redondeada), centrada en cy. */
export function barShape(xa: number, xb: number, cy: number, h: number, radius = BAR_RADIUS): string {
  const len = Math.abs(xb - xa);
  if (!(len > 0.01) || !(h > 0)) return '';
  const dir = xb >= xa ? 1 : -1;
  const r = Math.min(radius, h / 2, len);
  const k = r2(xb - dir * r);
  const sweep = dir > 0 ? 1 : 0;
  const [top, bottom] = [r2(cy - h / 2), r2(cy + h / 2)];
  return (
    `M${r2(xa)},${top}H${k}A${r2(r)},${r2(r)} 0 0 ${sweep} ${r2(xb)},${r2(cy - h / 2 + r)}` +
    `V${r2(cy + h / 2 - r)}A${r2(r)},${r2(r)} 0 0 ${sweep} ${k},${bottom}H${r2(xa)}Z`
  );
}

// ------------------------------------------------------------ Plugin

/** Meta de la fila i, o NaN. Siempre la final: la meta es un punto fijo, no algo que crece. */
function targetOf(ps: PreparedSeries, i: number): number {
  const v = ps.columns.target?.[i];
  return v !== undefined && isFinite(v) ? v : NaN;
}

/** Layout por conjunto de datos y tamaño: el puntero pregunta muchas veces por el mismo. */
const layouts = new WeakMap<readonly number[], { key: string; L: BulletLayout }>();

function layoutOf(ctx: DrawContext): BulletLayout {
  const ps = ctx.frame.ps;
  const labels = ps.options.labels !== false;
  const key = `${ctx.width}|${ctx.height}|${ctx.n}|${labels}|${ctx.y.d0}|${ctx.y.d1}`;
  const hit = layouts.get(ps.values);
  if (hit && hit.key === key) return hit.L;
  let names = 0;
  for (let i = 0; i < ctx.n; i++) names = Math.max(names, ctx.measure(ctx.label(i)));
  // A la derecha: lo que pide la etiqueta del valor más ancha (con tope) o, al menos, que el
  // último número del eje no se corte.
  const ticks = axisTicks(ctx.y.d0, ctx.y.d1, ctx.width * (1 - MAX_NAME_SHARE));
  let pad = ctx.measure(tickText(ctx, ticks[ticks.length - 1] ?? 0)) / 2 + 2;
  // Sin lugar para los valores no se les reserva espacio: las barras usan todo el ancho.
  if (labels && bulletLayout(ctx.n, ctx.width, ctx.height, Math.ceil(names)).values) {
    let widest = 0;
    for (const v of ps.values) if (isFinite(v)) widest = Math.max(widest, ctx.measure(ctx.format(v)));
    pad = Math.max(pad, Math.min(widest + LABEL_GAP + 2, ctx.width * 0.2));
  }
  const L = bulletLayout(ctx.n, ctx.width, ctx.height, Math.ceil(names), Math.ceil(pad));
  layouts.set(ps.values, { key, L });
  return L;
}

/** Número del eje: exacto bajo mil, compacto desde mil (0 / 1 mil / 2 mil), como en los demás ejes. */
function tickText(ctx: DrawContext, v: number): string {
  return Math.abs(v) < 1000 ? ctx.format(v) : ctx.compact(v);
}

function text(x: number, y: number, body: string, a: Record<string, string | number>): string {
  return `<text${attrs({ x: r2(x), y: r2(y), 'font-size': FONT, 'font-variant-numeric': 'tabular-nums', ...a })}>${esc(body)}</text>`;
}

/** Rejilla entre las filas y números del eje, debajo de todo. */
function axisMarkup(ctx: DrawContext, L: BulletLayout): string {
  const th = ctx.theme;
  const { d0, d1 } = ctx.y;
  let s = '';
  for (const v of axisTicks(d0, d1, L.x1 - L.x0)) {
    const x = Math.round(valueX(L, d0, d1, v)) + 0.5;
    const line = { x1: x, x2: x, y1: 0, y2: r2(L.axisY - AXIS_GAP / 2), 'stroke-width': 1, 'shape-rendering': 'crispEdges' };
    s += `<line${attrs({ ...line, stroke: v === 0 ? th.zero : th.grid })}/>`;
    s += text(x, L.axisY, tickText(ctx, v), { fill: th.textMuted, 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });
  }
  return s;
}

/** Una fila: fondo, cero, barra, meta, etiqueta del valor y nombre. */
function rowMarkup(ctx: DrawContext, L: BulletLayout, i: number, ranges: readonly number[], shades: readonly string[]): string {
  const th = ctx.theme;
  const ps = ctx.frame.ps;
  const { d0, d1 } = ctx.y;
  const cy = rowCenter(L, i);
  const X = (v: number) => valueX(L, d0, d1, v);
  let s = '';

  // Fondo: los rangos, o una pista tenue si no hay.
  const rect = (a: number, b: number, fill: string) =>
    `<rect${attrs({ x: r2(a), y: r2(cy - L.band / 2), width: r2(b - a), height: r2(L.band), fill })}/>`;
  if (ranges.length) for (const b of bandSegments(ranges, d0, d1)) s += rect(X(b.from), X(b.to), shades[b.index]);
  else s += rect(L.x0, L.x1, trackShade(th));
  // Con negativos, el cero se marca dentro de la fila: es de donde parten las barras.
  if (d0 < 0 && d1 > 0) {
    const z = Math.round(X(0)) + 0.5;
    const zero = { x1: z, x2: z, y1: r2(cy - L.band / 2), y2: r2(cy + L.band / 2) };
    s += `<line${attrs({ ...zero, stroke: th.zero, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
  }

  const xb = X(baseValue(d0, d1));
  const v = ctx.frame.y1[i];
  if (isFinite(v)) {
    const xe = X(v);
    const dir = xe >= xb ? 1 : -1;
    const halo = barShape(xb, xe + dir * HALO, cy, L.bar + 2 * HALO, BAR_RADIUS + HALO);
    if (halo) s += `<path${attrs({ d: halo, fill: th.surface })}/>`;
    const d = barShape(xb, xe, cy, L.bar);
    if (d) s += `<path${attrs({ d, fill: ctx.color })}/>`;
  }

  const t = targetOf(ps, i);
  const tx = isFinite(t) ? X(t) : NaN;
  if (isFinite(tx)) {
    const mark = (pad: number, fill: string) =>
      `<rect${attrs({
        x: r2(tx - TARGET_WIDTH / 2 - pad),
        y: r2(cy - L.target / 2 - pad),
        width: r2(TARGET_WIDTH + 2 * pad),
        height: r2(L.target + 2 * pad),
        rx: 1,
        fill,
      })}/>`;
    s += mark(HALO, th.surface) + mark(0, th.text);
  }

  // Etiqueta con el valor final: no salta ni cambia de lado a mitad de la animación.
  const final = ps.values[i];
  if (ps.options.labels !== false && L.values && isFinite(final)) {
    for (const body of [ctx.format(final), ctx.compact(final)]) {
      const at = placeValueLabel(xb, X(final), tx, ctx.measure(body), L.x0, ctx.width);
      if (!at) continue;
      s += text(at.x, cy, body, { fill: th.textMuted, 'text-anchor': at.anchor, 'dominant-baseline': 'central' });
      break;
    }
  }

  // El nombre en texto principal (es el título de la fila); los números, en secundario.
  if (L.nameWidth > 0 && i % L.every === 0) {
    const name = fitText(ctx.label(i), L.nameWidth, ctx.measure);
    s += text(L.x0 - NAME_GAP, cy, name, { fill: th.text, 'text-anchor': 'end', 'dominant-baseline': 'central' });
  }
  return s;
}

function rangesOf(ctx: DrawContext): { ranges: number[]; shades: string[] } {
  const ranges = cleanRanges(ctx.frame.ps.options.ranges);
  return { ranges, shades: bandShades(ranges.length, ctx.theme) };
}

export const bullet: SeriesImpl = {
  coords: 'free',
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  columns: (o) => ({ target: o.targetField }),
  // La meta y los rangos también deben caber en la escala, aunque ningún valor los alcance.
  valueColumns: ['target'],
  domainValues: (o) => cleanRanges(o.ranges),
  dimmable: true,
  draw(ctx) {
    if (!ctx.n) return '';
    const L = layoutOf(ctx);
    const { ranges, shades } = rangesOf(ctx);
    let s = axisMarkup(ctx, L);
    for (let i = 0; i < ctx.n; i++) s += dimmed(ctx, i, rowMarkup(ctx, L, i, ranges, shades));
    return s;
  },
  hit(ctx, _px, py) {
    return ctx.n ? hitRow(layoutOf(ctx), py) : -1;
  },
  anchor(ctx, i) {
    const L = layoutOf(ctx);
    const v = ctx.frame.ps.values[i];
    const t = targetOf(ctx.frame.ps, i);
    const at = isFinite(v) ? v : isFinite(t) ? t : baseValue(ctx.y.d0, ctx.y.d1);
    return [valueX(L, ctx.y.d0, ctx.y.d1, at), rowCenter(L, i)];
  },
  hover(ctx, i) {
    if (i < 0 || i >= ctx.n) return '';
    const L = layoutOf(ctx);
    const cy = rowCenter(L, i);
    // Franja de resaltado con un hueco donde va la escala: rodea la fila sin teñir los datos.
    const top = cy - L.pitch / 2 + HOVER_INSET / 2;
    const h = Math.max(0, L.pitch - HOVER_INSET);
    const r = Math.min(4, h / 2);
    // El hueco cubre el fondo dibujado: con rangos, hasta donde termina el último.
    const ranges = cleanRanges(ctx.frame.ps.options.ranges);
    const end = ranges.length ? valueX(L, ctx.y.d0, ctx.y.d1, ranges[ranges.length - 1]) : L.x1;
    const [x0, x1, b0, b1] = [r2(L.x0), r2(end), r2(cy - L.band / 2), r2(cy + L.band / 2)];
    const d =
      `M${r},${r2(top)}H${r2(ctx.width - r)}A${r},${r} 0 0 1 ${r2(ctx.width)},${r2(top + r)}V${r2(top + h - r)}` +
      `A${r},${r} 0 0 1 ${r2(ctx.width - r)},${r2(top + h)}H${r}A${r},${r} 0 0 1 0,${r2(top + h - r)}V${r2(top + r)}A${r},${r} 0 0 1 ${r},${r2(top)}Z` +
      `M${x0},${b0}V${b1}H${x1}V${b0}Z`;
    return `<path${attrs({ d, fill: ctx.theme.highlight, 'fill-rule': 'evenodd' })}/>`;
  },
  tooltip(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null {
    const v = ps.values[i];
    const t = targetOf(ps, i);
    const details: [string, string][] = [];
    const m = messages(format.locale);
    if (isFinite(t)) details.push([m.data.target, format.value(t)]);
    if (isFinite(v) && isFinite(t)) {
      const d = v - t;
      // También como parte de la meta, con signo; con meta cero no hay proporción que dar.
      const sign = d > 0 ? '+' : '−';
      const pct = t !== 0 && d !== 0 ? ` (${sign}${format.percent(Math.abs(d / t))})` : '';
      details.push([m.data.vsTarget, format.difference(d) + pct]);
    }
    const range = rangeText(v, cleanRanges(ps.options.ranges), format.value, format.locale);
    if (range) details.push([m.bullet.band, range]);
    const value = isFinite(v) ? format.value(v) : m.data.noData;
    return details.length ? { value, details } : { value };
  },
};
