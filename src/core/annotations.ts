/**
 * Anotaciones: líneas de referencia y franjas sobre el área de datos.
 *
 * Una anotación da `x` o `y`. Con un valor es una línea (una meta, un lanzamiento); con dos,
 * una franja (un trimestre, un rango aceptable). Se ubican en el plano lógico (índice, valor),
 * igual que las series, y se pasan a pantalla según la orientación. Las franjas van debajo de
 * las series; las líneas y los textos, encima.
 */
import type { Annotation, XValue } from '../types';
import type { Theme } from './theme';
import { attrs, esc } from './dom';

export interface AnnotationPlane {
  /** Largo del eje del índice y del eje del valor, en px. */
  indexLen: number;
  valueLen: number;
  horizontal: boolean;
  /**
   * Posición en el eje del índice de un valor de X; null si no está en los datos. Con barras,
   * `edge` pide el borde de su banda (una franja cubre las bandas completas).
   */
  index(x: XValue, edge: 'start' | 'center' | 'end'): number | null;
  /** Posición en el eje del valor (izquierdo o derecho). */
  value(v: number, axis: 'left' | 'right'): number;
}

export interface AnnotationMarkup {
  /** Franjas: debajo de las series. */
  under: string;
  /** Líneas y textos: encima. */
  over: string;
}

const LABEL_SIZE = 12;
const PAD = 5;

/** Valores de Y que el eje debe mostrar: una meta fuera del rango de los datos igual se ve. */
export function annotationValues(list: readonly Annotation[] | undefined, axis: 'left' | 'right'): number[] {
  const out: number[] = [];
  for (const a of list ?? []) {
    if (a.y === undefined || (a.axis ?? 'left') !== axis) continue;
    for (const v of Array.isArray(a.y) ? a.y : [a.y]) if (isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * Markup de las anotaciones en px del área de datos (no del plano lógico). Lo que cae fuera del
 * área (por ejemplo, con zoom) no se dibuja; una franja que sale a medias se recorta.
 */
export function renderAnnotations(
  list: readonly Annotation[] | undefined,
  plane: AnnotationPlane,
  theme: Theme,
  measure: (text: string) => number,
): AnnotationMarkup {
  let under = '';
  let over = '';
  const { indexLen, valueLen, horizontal } = plane;
  const width = horizontal ? valueLen : indexLen;
  // Recuadros de los textos ya puestos: uno que chocaría se corre una línea (abajo si cuelga de
  // arriba, arriba si va sobre una línea).
  const taken: { left: number; top: number; right: number; bottom: number }[] = [];
  const place = (x: number, y: number, label: string, w: number, anchor: 'start' | 'end', baseline: 'hanging' | 'auto') => {
    const step = (baseline === 'hanging' ? 1 : -1) * (LABEL_SIZE + 3);
    const left = anchor === 'end' ? x - w : x;
    let top = baseline === 'hanging' ? y : y - LABEL_SIZE;
    for (let k = 0; k < 4; k++) {
      const box = { left, top, right: left + w, bottom: top + LABEL_SIZE };
      if (!taken.some((b) => box.left < b.right && b.left < box.right && box.top < b.bottom && b.top < box.bottom)) break;
      top += step;
      y += step;
    }
    taken.push({ left, top, right: left + w, bottom: top + LABEL_SIZE });
    return text(x, y, label, anchor, baseline, theme);
  };
  /** Del plano lógico a la pantalla: en horizontal, el índice baja y el valor va a la derecha. */
  const screen = (li: number, lv: number): [number, number] => (horizontal ? [lv, li] : [li, lv]);

  for (const a of list ?? []) {
    const onIndex = a.x !== undefined;
    if (onIndex === (a.y !== undefined)) continue;
    const axis = a.axis ?? 'left';
    let span: [number, number] | null;
    let len: number;
    if (onIndex) {
      const x = a.x!;
      span = Array.isArray(x) ? bandSpan(plane.index(x[0], 'start'), plane.index(x[1], 'end')) : point(plane.index(x, 'center'));
      len = indexLen;
    } else {
      const y = a.y!;
      span = Array.isArray(y) ? bandSpan(plane.value(y[0], axis), plane.value(y[1], axis)) : point(plane.value(y, axis));
      len = valueLen;
    }
    if (!span || span[1] < -0.5 || span[0] > len + 0.5) continue;
    const isBand = span[0] !== span[1];
    // ¿La anotación queda horizontal en pantalla? Una del valor en vertical, o del índice en horizontal.
    const flat = onIndex === horizontal;
    const label = a.label ? esc(a.label) : '';
    const w = a.label ? measure(a.label) : 0;

    if (isBand) {
      const lo = Math.max(0, span[0]);
      const hi = Math.min(len, span[1]);
      const [x0, y0] = onIndex ? screen(lo, 0) : screen(0, lo);
      const [x1, y1] = onIndex ? screen(hi, valueLen) : screen(indexLen, hi);
      const box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      under += `<rect${attrs({ x: r1(box.x), y: r1(box.y), width: r1(box.w), height: r1(box.h), fill: theme.highlight })}/>`;
      // El texto, adentro de la franja: arriba a la derecha si es horizontal; arriba a la izquierda si es vertical.
      if (label) {
        over += flat
          ? place(box.x + box.w - PAD, box.y + PAD, label, w, 'end', 'hanging')
          : place(box.x + PAD, PAD, label, w, 'start', 'hanging');
      }
      continue;
    }

    const pos = Math.round(span[0]) + 0.5;
    const [x1, y1] = onIndex ? screen(pos, 0) : screen(0, pos);
    const [x2, y2] = onIndex ? screen(pos, valueLen) : screen(indexLen, pos);
    const line = {
      x1,
      y1,
      x2,
      y2,
      stroke: theme.textMuted,
      'stroke-width': 1,
      'stroke-dasharray': '4 3',
      'shape-rendering': 'crispEdges',
    };
    over += `<line${attrs(line)}/>`;
    if (!label) continue;
    // `pos` es la Y en pantalla si la línea es horizontal, y la X si es vertical.
    if (flat) {
      // Línea horizontal: el texto al final, encima (o debajo si no cabe arriba).
      over +=
        pos - PAD - LABEL_SIZE < 0
          ? place(width - 4, pos + PAD, label, w, 'end', 'hanging')
          : place(width - 4, pos - PAD, label, w, 'end', 'auto');
    } else {
      // Línea vertical: el texto arriba, a su derecha (o a su izquierda si no cabe).
      over +=
        pos + PAD + w > width
          ? place(pos - PAD, PAD, label, w, 'end', 'hanging')
          : place(pos + PAD, PAD, label, w, 'start', 'hanging');
    }
  }
  return { under, over };
}

/** Un solo valor: [p, p]; null si no se ubicó. */
function point(p: number | null): [number, number] | null {
  return p === null || !isFinite(p) ? null : [p, p];
}

/** Dos extremos, en orden; si falta uno, la franja no se dibuja. */
function bandSpan(a: number | null, b: number | null): [number, number] | null {
  if (a === null || b === null || !isFinite(a) || !isFinite(b)) return null;
  return a <= b ? [a, b] : [b, a];
}

/** Texto con halo del color de la superficie: se lee aunque cruce una línea o una barra. */
function text(x: number, y: number, label: string, anchor: string, baseline: string, theme: Theme): string {
  const a = {
    x: r1(x),
    y: r1(y),
    fill: theme.textMuted,
    'font-size': LABEL_SIZE,
    'font-weight': 500,
    'text-anchor': anchor,
    'dominant-baseline': baseline,
    stroke: theme.surface,
    'stroke-width': 3,
    'stroke-linejoin': 'round',
    'paint-order': 'stroke',
  };
  return `<text${attrs(a)}>${label}</text>`;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
