/** Utilidades de SVG/HTML y medición de texto. */

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
  return node;
}

export function html<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') node.className = attrs[k];
    else node.setAttribute(k, attrs[k]);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Escapa texto para meterlo en markup SVG/XML construido como string. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Atributos a string: { x: 1, fill: 'red' } → ' x="1" fill="red"'. */
export function attrs(a: Record<string, string | number | undefined>): string {
  let s = '';
  for (const k in a) {
    const v = a[k];
    if (v !== undefined && v !== '') s += ' ' + k + '="' + esc(String(v)) + '"';
  }
  return s;
}

let canvasCtx: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/**
 * Ancho de un texto en px con la fuente dada (ej. '12px Inter').
 * Usa un canvas oculto; si no hay canvas, estima con 0,58 em por carácter.
 */
export function textWidth(text: string, font: string): number {
  const key = font + '|' + text;
  const hit = widthCache.get(key);
  if (hit !== undefined) return hit;
  if (canvasCtx === undefined) {
    try {
      canvasCtx = document.createElement('canvas').getContext('2d');
    } catch {
      canvasCtx = null;
    }
  }
  let w: number;
  if (canvasCtx) {
    canvasCtx.font = font;
    w = canvasCtx.measureText(text).width;
  } else {
    const size = parseFloat(font) || 12;
    w = text.length * size * 0.58;
  }
  if (widthCache.size > 5000) widthCache.clear();
  widthCache.set(key, w);
  return w;
}

export function resolveElement(target: string | HTMLElement): HTMLElement {
  if (typeof target !== 'string') return target;
  const el = document.querySelector<HTMLElement>(target);
  if (!el)
    throw new Error(
      `LozCharts: no encontré nada que coincida con "${target}" en la página. Revisa el selector o crea el gráfico cuando el elemento ya exista.`,
    );
  return el;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
