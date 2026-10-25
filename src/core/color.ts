/**
 * Color: mezclas, contraste y escalas de un solo tono, compartidas por el mapa de calor, el
 * treemap y los mapas. Los colores van en sRGB de 0 a 1.
 */
import type { Theme } from './theme';
import { r2 } from './shapes';

/**
 * El extremo bajo de la escala secuencial arranca con este tanto del color: el valor mínimo se
 * sigue distinguiendo de lo vacío (que es la superficie pura).
 */
const LOW = 0.14;
/** Ancho mínimo de la barra de una leyenda de color y aire mínimo entre sus números. */
const LEGEND_BAR = 120;
const LABEL_SPACING = 12;

export type Domain = { kind: 'sequential'; min: number; max: number } | { kind: 'diverging'; max: number; positive: boolean };

/**
 * Dominio del color con los valores finales (no los animados: la escala no tiembla al animar).
 * Sin negativos, secuencial del mínimo al máximo: en un mapa de calor se buscan patrones dentro
 * de la rejilla, y la leyenda dice el rango real. Con negativos, divergente y simétrico alrededor
 * del cero: la misma intensidad significa la misma magnitud a cada lado.
 */
export function colorDomain(values: readonly number[]): Domain | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min > max) return null;
  if (min < 0) return { kind: 'diverging', max: Math.max(-min, Math.abs(max)), positive: max > 0 };
  return { kind: 'sequential', min, max };
}

/** Posición de un valor en la escala: 0 a 1 en secuencial, −1 a 1 en divergente. */
export function position(d: Domain, v: number): number {
  // Todos iguales (todo ceros, un solo dato): no hay más ni menos, va al centro de la escala.
  if (d.kind === 'sequential') return d.max > d.min ? clamp((v - d.min) / (d.max - d.min), 0, 1) : 0.5;
  return d.max > 0 ? clamp(v / d.max, -1, 1) : 0;
}

export type RGB = [number, number, number];

/** sRGB (0 a 1) de un color #rgb, #rrggbb o rgb(); null si es otro formato (un nombre, hsl…). */
export function parseColor(s: string): RGB | null {
  const t = s.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as RGB;
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(t);
  return fn ? ([fn[1], fn[2], fn[3]].map((v) => Math.min(255, Number(v)) / 255) as RGB) : null;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Un color en OKLab: claridad L (0 a 1) y los ejes a (verde–rojo) y b (azul–amarillo). */
export type Lab = [L: number, a: number, b: number];

// OKLab (Björn Ottosson, 2020): mezclar ahí da pasos de claridad parejos y sin el gris sucio de mezclar en sRGB.
/** sRGB (0 a 1) a OKLab: para medir distancias entre colores o mezclarlos con claridad pareja. */
export function toOklab([r, g, b]: RGB): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab a sRGB (0 a 1), recortado a lo que se puede mostrar. */
export function fromOklab([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin: RGB = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => clamp(toGamma(clamp(c, 0, 1)), 0, 1)) as RGB;
}

export function toHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Mezcla en OKLab: t = 0 es `a`, t = 1 es `b`. */
export function mixOklab(a: RGB, b: RGB, t: number): RGB {
  const A = toOklab(a);
  const B = toOklab(b);
  return fromOklab([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Luminancia relativa y contraste WCAG. */
export function luminance([r, g, b]: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Contraste que pide WCAG AA para texto normal. */
const AA = 4.5;

/**
 * Texto para un relleno: el primer candidato que llega a 4,5:1 (el texto del tema, para que las
 * celdas vecinas no salten entre claro y oscuro sin necesidad); si ninguno llega, el de más contraste.
 */
export function textOn(fill: RGB | null, candidates: readonly string[]): string {
  if (!fill) return candidates[0];
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const rgb = parseColor(c);
    const ratio = rgb ? contrast(fill, rgb) : 0;
    if (ratio >= AA) return c;
    if (ratio > bestRatio) [best, bestRatio] = [c, ratio];
  }
  return best;
}

/**
 * Tinta para escribir sobre un relleno: el texto o la superficie del tema (siempre uno oscuro y
 * otro claro), la de mayor contraste. Con un color que no se puede leer, el texto del tema.
 */
export function inkFor(fill: string, theme: Pick<Theme, 'text' | 'surface'>): string {
  // Si ni el texto ni la superficie del tema llegan a 4,5:1, negro o blanco puros.
  return textOn(parseColor(fill), [theme.text, theme.surface, '#000000', '#ffffff']);
}

/** Relleno de una celda: con colores que no se pueden leer, el color final con opacidad (aproxima la mezcla). */
export interface Paint {
  fill: string;
  opacity?: number;
  rgb: RGB | null;
}

export interface Ramp {
  kind: Domain['kind'];
  /** Punto de partida: la superficie (secuencial) o el gris neutro del cero (divergente). */
  base: string;
  pos: string;
  neg: string;
}

/**
 * Rampa de la serie. El neutro divergente es el gris de la rejilla: un cero se ve como dato,
 * distinto de una celda vacía. Si la serie ya tiene el segundo color de la paleta, los negativos
 * toman el primero, para que los dos lados nunca compartan tono.
 */
export function makeRamp(kind: Domain['kind'], theme: Theme, color: string): Ramp {
  const second = theme.palette[1] ?? theme.other;
  const neg = second.toLowerCase() === color.toLowerCase() ? (theme.palette[0] ?? theme.other) : second;
  return { kind, base: kind === 'sequential' ? theme.surface : theme.grid, pos: color, neg };
}

function mixPaint(from: string, to: string, t: number): Paint {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return { fill: to, opacity: r2(t), rgb: null };
  const rgb = mixOklab(a, b, t);
  return { fill: toHex(rgb), rgb };
}

/** Color en la posición p de la rampa (0 a 1 secuencial, −1 a 1 divergente). */
export function paint(r: Ramp, p: number): Paint {
  if (r.kind === 'sequential') return mixPaint(r.base, r.pos, LOW + (1 - LOW) * clamp(p, 0, 1));
  const q = clamp(p, -1, 1);
  return mixPaint(r.base, q < 0 ? r.neg : r.pos, Math.abs(q));
}

/** Un relleno como color CSS (la muestra del tooltip): con opacidad, mezclado con lo de atrás. */
export function paintColor(p: Paint): string {
  return p.opacity === undefined ? p.fill : `color-mix(in srgb, ${p.fill} ${r2(p.opacity * 100)}%, transparent)`;
}

/** Leyenda: qué tramo de la rampa muestra la barra y qué números van debajo (texto y lugar de 0 a 1). */
export interface LegendSpec {
  from: number;
  to: number;
  labels: [text: string, at: number][];
}

export function legendSpec(d: Domain, format: (v: number) => string): LegendSpec {
  if (d.kind === 'sequential')
    return {
      from: 0,
      to: 1,
      labels: [
        [format(d.min), 0],
        [format(d.max), 1],
      ],
    };
  if (!d.positive)
    return {
      from: -1,
      to: 0,
      labels: [
        [format(-d.max), 0],
        [format(0), 1],
      ],
    };
  return {
    from: -1,
    to: 1,
    labels: [
      [format(-d.max), 0],
      [format(0), 0.5],
      [format(d.max), 1],
    ],
  };
}

/** Ancho de la barra para que sus números no se encimen (con el cero al centro, los extremos no lo pisan). */
export function legendWidth(spec: LegendSpec, measure: (s: string) => number): number {
  const w = spec.labels.map(([t]) => measure(t));
  const need = w.length === 3 ? 2 * Math.max(w[0], w[2]) + w[1] + 2 * LABEL_SPACING : w[0] + w[w.length - 1] + LABEL_SPACING;
  return Math.max(LEGEND_BAR, Math.ceil(need));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
