/**
 * LozGauge: un solo valor (el último finito de la serie) sobre un arco de 240°, abierto abajo.
 * El arco va de −210° a 30° (0° a la derecha, ángulos en sentido horario como en SVG): deja
 * espacio debajo para los extremos y lee mejor que un semicírculo, que desperdicia la mitad del
 * área y obliga a poner el número sobre la línea de base.
 *
 * El rango es el dominio del núcleo (ctx.y.d0 a ctx.y.d1; se fija con yAxis.min y yAxis.max).
 * Si el valor se sale, el arco se recorta al extremo pero el número muestra el valor real.
 */
import type { DrawContext, SeriesImpl } from '../core/series';
import { attrs, esc } from '../core/dom';
import { polarPoint } from '../core/shapes';
import { fitText } from '../core/axis';

const DEG = Math.PI / 180;
export const START_ANGLE = -210 * DEG;
export const END_ANGLE = 30 * DEG;
const SPAN = END_ANGLE - START_ANGLE;

/** Grosor del arco como fracción del radio. */
const THICKNESS = 0.12;
/** Margen a cada lado del área, para que nada se corte en pantallas de 390 px. */
const MARGIN = 12;
const MAX_RADIUS = 240;
const MIN_RADIUS = 24;
/** Etiquetas de mínimo, máximo y meta: 12 px en texto secundario, a 6 px del arco. */
const LABEL_SIZE = 12;
const LABEL_GAP = 6;
const NAME_SIZE = 13;
/** El valor central escala con el radio, entre estos límites. */
const VALUE_MIN = 16;
const VALUE_MAX = 48;
const VALUE_SHARE = 0.36;
/** La marca de meta sobresale de la pista para verse con cualquier valor encima. */
const TARGET_OVERHANG = 4;
/** La etiqueta de la meta se centra si |cos| es menor que esto, y va arriba si −sen lo supera. */
const LABEL_SIDE = 0.3;
const LABEL_TOP = 0.6;
/** Holgura del hit-test, en px, para dedos y punteros imprecisos. */
const HIT_SLOP = 4;

export interface GaugeLayout {
  cx: number;
  cy: number;
  /** Radio de la línea media del arco. */
  r: number;
  /** Grosor del trazo. */
  thickness: number;
}

/** Fracción del arco (0 a 1) que corresponde a v; fuera del rango se recorta al extremo. */
export function valueFraction(v: number, d0: number, d1: number): number {
  const span = d1 - d0;
  if (!isFinite(v) || !(span > 0)) return 0;
  return Math.min(1, Math.max(0, (v - d0) / span));
}

/** Ángulo (radianes) de v sobre el arco. */
export function valueAngle(v: number, d0: number, d1: number): number {
  return START_ANGLE + valueFraction(v, d0, d1) * SPAN;
}

/** Ruta SVG de un arco de a0 a a1 (horario). Vacía si no hay recorrido. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const sweep = a1 - a0;
  if (!(sweep > 0) || !(r > 0)) return '';
  const [x0, y0] = polarPoint(cx, cy, r, a0);
  const [x1, y1] = polarPoint(cx, cy, r, a1);
  const large = sweep > Math.PI ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M${f(x0)},${f(y0)}A${f(r)},${f(r)} 0 ${large} 1 ${f(x1)},${f(y1)}`;
}

/**
 * Centro y radio que aprovechan el área. Arriba el arco llega a r + grosor/2; abajo, los
 * extremos quedan a r · sen 30° = r/2 y debajo van las etiquetas de mínimo y máximo.
 * `padX` y `padTop` reservan espacio extra a los lados y arriba (la etiqueta de la meta va
 * por fuera del arco); abajo no hace falta, porque ahí ya van las del mínimo y el máximo.
 */
export function gaugeLayout(width: number, height: number, padX = 0, padTop = 0): GaugeLayout {
  const half = 1 + THICKNESS / 2;
  const below = LABEL_GAP + LABEL_SIZE;
  const byWidth = (width - 2 * (MARGIN + padX)) / (2 * half);
  const byHeight = (height - 2 * MARGIN - padTop - below) / (half + 0.5 + THICKNESS / 2);
  const r = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, byWidth, byHeight));
  const thickness = r * THICKNESS;
  const top = r + thickness / 2;
  const total = top + r / 2 + thickness / 2 + below;
  return { cx: width / 2, cy: Math.max(top + padTop, (height - padTop - total) / 2 + padTop + top), r, thickness };
}

/** ¿El ángulo a cae dentro del arco, con una tolerancia angular extra (los extremos redondeados)? */
function onArc(a: number, tolerance: number): boolean {
  const rel = (((a - START_ANGLE) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return rel <= SPAN + tolerance || rel >= 2 * Math.PI - tolerance;
}

/** ¿El punto toca el arco (respetando su grosor) o el interior, donde está el número? */
export function hitGauge(g: GaugeLayout, px: number, py: number, slop = HIT_SLOP): boolean {
  const dist = Math.hypot(px - g.cx, py - g.cy);
  const inner = g.r - g.thickness / 2;
  if (dist < inner) return true;
  if (dist > g.r + g.thickness / 2 + slop) return false;
  return onArc(Math.atan2(py - g.cy, px - g.cx), (g.thickness / 2 + slop) / g.r);
}

/** Índice del último valor finito, o -1 si la serie no tiene ninguno. */
export function lastFinite(values: readonly number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (isFinite(values[i])) return i;
  return -1;
}

/** La marca de la meta dice qué es, no solo su número. */
function targetLabel(ctx: DrawContext, t: number): string {
  return `Meta ${ctx.format(t)}`;
}

function target(ctx: DrawContext): number | undefined {
  const t = ctx.frame.ps.options.target;
  return t !== undefined && isFinite(t) ? t : undefined;
}

/**
 * Layout del gráfico actual. La etiqueta de la meta va por fuera del arco: se reserva lugar
 * solo hacia donde cae (a un costado, o arriba si la meta está cerca de la cima), para no
 * achicar el gauge de más.
 */
function layout(ctx: DrawContext): GaugeLayout {
  const t = target(ctx);
  if (t === undefined) return gaugeLayout(ctx.width, ctx.height);
  const a = valueAngle(t, ctx.y.d0, ctx.y.d1);
  const w = ctx.measure(targetLabel(ctx, t));
  const out = LABEL_GAP + TARGET_OVERHANG;
  const padX = Math.abs(Math.cos(a)) < LABEL_SIDE ? w / 2 : w + out;
  const padTop = Math.sin(a) < -LABEL_TOP ? LABEL_SIZE + out : 0;
  return gaugeLayout(ctx.width, ctx.height, padX, padTop);
}

/** Valor que se dibuja en este cuadro: el animado si existe; si no, el mínimo del rango. */
function shown(ctx: DrawContext): { i: number; v: number } {
  const i = lastFinite(ctx.frame.ps.values);
  const v = i >= 0 ? ctx.frame.y1[i] : NaN;
  return { i, v: isFinite(v) ? v : ctx.y.d0 };
}

function text(x: number, y: number, body: string, a: Record<string, string | number>): string {
  return `<text${attrs({ x: x.toFixed(1), y: y.toFixed(1), 'font-variant-numeric': 'tabular-nums', ...a })}>${esc(body)}</text>`;
}

export const gauge: SeriesImpl = {
  coords: 'free',
  // El teclado recorre solo el valor que se dibuja (el último), no las filas anteriores.
  navigable: (ps) => {
    const i = lastFinite(ps.values);
    return i < 0 ? [] : [i];
  },
  // La meta también debe caber en el rango, aunque el valor no la alcance.
  domainValues: (o) => (o.target === undefined ? [] : [o.target]),
  includeZero: true,
  layer: 0,
  legendSymbol: 'square',
  label: 'medidor',
  draw(ctx) {
    const { d0, d1 } = ctx.y;
    const th = ctx.theme;
    const g = layout(ctx);
    const { cx, cy, r, thickness } = g;
    const { i, v } = shown(ctx);
    const stroke = { fill: 'none', 'stroke-width': thickness.toFixed(2), 'stroke-linecap': 'round' };

    let s = `<path${attrs({ d: arcPath(cx, cy, r, START_ANGLE, END_ANGLE), stroke: th.grid, ...stroke })}/>`;
    // En el mínimo exacto no se dibuja nada: un arco de largo cero con punta redonda sería un punto.
    const value = arcPath(cx, cy, r, START_ANGLE, valueAngle(v, d0, d1));
    if (value) s += `<path${attrs({ d: value, stroke: ctx.color, ...stroke })}/>`;

    const t = target(ctx);
    if (t !== undefined) {
      const a = valueAngle(t, d0, d1);
      const [x1, y1] = polarPoint(cx, cy, r - thickness / 2 - TARGET_OVERHANG, a);
      const [x2, y2] = polarPoint(cx, cy, r + thickness / 2 + TARGET_OVERHANG, a);
      const line = { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) };
      // Anillo del color de la superficie debajo, para que la marca se separe del arco de valor.
      s += `<line${attrs({ ...line, stroke: th.surface, 'stroke-width': 4, 'stroke-linecap': 'round' })}/>`;
      s += `<line${attrs({ ...line, stroke: th.text, 'stroke-width': 2, 'stroke-linecap': 'round' })}/>`;
      const [lx, ly] = polarPoint(cx, cy, r + thickness / 2 + TARGET_OVERHANG + LABEL_GAP, a);
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      s += text(lx, ly, targetLabel(ctx, t), {
        fill: th.textMuted,
        'font-size': LABEL_SIZE,
        'text-anchor': Math.abs(cos) < LABEL_SIDE ? 'middle' : cos > 0 ? 'start' : 'end',
        'dominant-baseline': sin < -LABEL_TOP ? 'auto' : sin > LABEL_TOP ? 'hanging' : 'central',
      });
    }

    // Mínimo y máximo bajo cada extremo, sin salirse del área.
    const ends: [number, number][] = [
      [START_ANGLE, d0],
      [END_ANGLE, d1],
    ];
    for (const [a, d] of ends) {
      const label = ctx.format(d);
      const half = ctx.measure(label) / 2;
      const [ex] = polarPoint(cx, cy, r, a);
      const x = Math.min(ctx.width - MARGIN - half, Math.max(MARGIN + half, ex));
      const y = cy + r / 2 + thickness / 2 + LABEL_GAP;
      s += text(x, y, label, {
        fill: th.textMuted,
        'font-size': LABEL_SIZE,
        'text-anchor': 'middle',
        'dominant-baseline': 'hanging',
      });
    }

    // El número en grande, en texto principal: la identidad la da el arco, no el color del texto.
    const inner = 2 * (r - thickness) * 0.8;
    const raw = i >= 0 ? ctx.format(v) : '–';
    const width12 = ctx.measure(raw);
    let size = Math.min(VALUE_MAX, Math.max(VALUE_MIN, r * VALUE_SHARE));
    if (width12 > 0) size = Math.max(LABEL_SIZE, Math.min(size, (LABEL_SIZE * inner) / width12));
    s += text(cx, cy, raw, {
      fill: th.text,
      'font-size': size.toFixed(1),
      'font-weight': 600,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    // El nombre va más abajo, donde la cuerda del círculo es casi el diámetro interior.
    const name = fitText(ctx.frame.ps.name, 2 * (r - thickness) * 0.9, (t) => (ctx.measure(t) * NAME_SIZE) / LABEL_SIZE);
    s += text(cx, cy + size * 0.55 + 6, name, {
      fill: th.textMuted,
      'font-size': NAME_SIZE,
      'text-anchor': 'middle',
      'dominant-baseline': 'hanging',
    });
    return s;
  },
  hit(ctx, px, py) {
    const i = lastFinite(ctx.frame.ps.values);
    return i >= 0 && hitGauge(layout(ctx), px, py) ? i : -1;
  },
  anchor(ctx) {
    const { cx, cy, r } = layout(ctx);
    return polarPoint(cx, cy, r, valueAngle(shown(ctx).v, ctx.y.d0, ctx.y.d1));
  },
  tooltip(ps, i, format) {
    const v = ps.values[i];
    if (!isFinite(v)) return { value: 'Sin dato' };
    const t = ps.options.target;
    if (t === undefined || !isFinite(t)) return { value: format.value(v) };
    return {
      value: format.value(v),
      details: [
        ['Meta', format.value(t)],
        ['Frente a la meta', format.difference(v - t)],
      ],
    };
  },
};
