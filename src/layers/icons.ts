/**
 * Íconos propios de LozCharts, dibujados en una cuadrícula de 24 × 24 con trazo de 2 px, extremos y
 * uniones redondeados: el mismo trazo de las líneas del gráfico. Cada ícono tiene trazos (`stroke`)
 * y, si hace falta, partes rellenas (`fill`: los ojos de una carita, el punto de una alerta), todo
 * del color del ícono. Se escalan con el tamaño pedido, así el trazo crece con él.
 */

export interface IconShape {
  /** Caminos que se trazan (sin relleno). */
  stroke: string[];
  /** Caminos que se rellenan del color del ícono. */
  fill?: string[];
  /** Partes rellenas del color de la superficie (el hueco de un marcador relleno). */
  hole?: string[];
}

/** Un círculo como camino SVG (dos arcos), para juntarlo con el resto de los trazos. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

/** Estrella de cinco puntas, con la de arriba centrada y el radio interior al 45 %. */
function star(cx: number, cy: number, r: number): string {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    d += `${k ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return d + 'z';
}

const FACE = circle(12, 12, 9);
const EYES = [circle(9, 10, 1.15), circle(15, 10, 1.15)];

export const ICONS: Record<string, IconShape> = {
  pin: {
    stroke: [],
    fill: ['M12 22.2s-7-6.6-7-12a7 7 0 0 1 14 0c0 5.4-7 12-7 12z'],
    hole: [circle(12, 10.2, 2.6)],
  },
  smile: { stroke: [FACE, 'M8.3 14.2c.9 1.4 2.2 2.2 3.7 2.2s2.8-.8 3.7-2.2'], fill: EYES },
  meh: { stroke: [FACE, 'M8.8 15.3h6.4'], fill: EYES },
  sad: { stroke: [FACE, 'M8.3 16.6c.9-1.4 2.2-2.2 3.7-2.2s2.8.8 3.7 2.2'], fill: EYES },
  alert: { stroke: ['M12 3.6 21.4 19.8H2.6z', 'M12 9.4v4.8'], fill: [circle(12, 17, 1.15)] },
  check: { stroke: ['M4.8 12.6l4.6 4.6L19.2 7.4'] },
  cross: { stroke: ['M6.4 6.4l11.2 11.2', 'M17.6 6.4 6.4 17.6'] },
  'arrow-up': { stroke: ['M12 19.5V4.8', 'M5.8 11 12 4.8l6.2 6.2'] },
  'arrow-down': { stroke: ['M12 4.5v14.7', 'M5.8 13l6.2 6.2 6.2-6.2'] },
  antenna: {
    stroke: ['M8.6 21.2 12 10.4l3.4 10.8', 'M9.7 17.4h4.6', 'M8.3 4.4a5.2 5.2 0 0 0 0 7.2', 'M15.7 4.4a5.2 5.2 0 0 1 0 7.2'],
    fill: [circle(12, 8, 1.7)],
  },
  star: { stroke: [star(12, 12.6, 9.4)] },
  fire: {
    stroke: [
      'M12 21.2c-3.8 0-6.6-2.6-6.6-6.3 0-3.6 2.7-5.4 3.8-8.3.9 1.5 1.7 2.4 2.8 2.9.3-2.8 1.5-4.9 3.3-6.7.4 3.1 3.9 5.9 3.9 10.6 0 4.6-3.2 7.8-7.2 7.8z',
      'M12 21.2c-1.6 0-2.7-1.2-2.7-2.8 0-1.6 1.2-2.6 2.7-4.3 1.5 1.7 2.7 2.7 2.7 4.3 0 1.6-1.1 2.8-2.7 2.8z',
    ],
  },
  bolt: { stroke: ['M13.4 2.6 5.2 13.6h6.2l-1 7.8 8.2-11h-6.2z'] },
  heart: { stroke: ['M12 20.2s-8-4.8-8-10.6a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 5.8-8 10.6-8 10.6z'] },
  flag: { stroke: ['M5.6 21.4V3.6', 'M5.6 4.2h11.6l-2.4 4.1 2.4 4.1H5.6'] },
  dot: { stroke: [], fill: [circle(12, 12, 6)] },
  info: { stroke: [FACE, 'M12 11.2v5.6'], fill: [circle(12, 7.9, 1.15)] },
  clock: { stroke: [FACE, 'M12 7.2V12l3.4 2.2'] },
  signal: { stroke: ['M5 19.5v-2', 'M9.7 19.5v-5.2', 'M14.3 19.5v-8.6', 'M19 19.5V7.4'] },
  home: { stroke: ['M3.8 11.2 12 4l8.2 7.2', 'M6.2 9.4v11h11.6v-11', 'M10 20.4v-5.6h4v5.6'] },
  user: { stroke: [circle(12, 8.2, 3.7), 'M4.8 20.6c.9-3.8 3.7-6 7.2-6s6.3 2.2 7.2 6'] },
};

/** Otros nombres que se aceptan para los mismos íconos. */
export const ICON_ALIASES: Record<string, string> = {
  happy: 'smile',
  face: 'smile',
  neutral: 'meh',
  frown: 'sad',
  unhappy: 'sad',
  warning: 'alert',
  ok: 'check',
  x: 'cross',
  up: 'arrow-up',
  down: 'arrow-down',
  tower: 'antenna',
  flame: 'fire',
  lightning: 'bolt',
  marker: 'pin',
  circle: 'dot',
  time: 'clock',
  person: 'user',
};

export const ICON_NAMES = Object.keys(ICONS);

/** El nombre canónico de un ícono propio ('frown' → 'sad'), o '' si no es uno. */
export function iconName(name: string): string {
  const key = name.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ICONS, key)) return key;
  return Object.prototype.hasOwnProperty.call(ICON_ALIASES, key) ? ICON_ALIASES[key] : '';
}

/**
 * ¿Se lee como un emoji o un símbolo, y no como un nombre mal escrito? Lo es si no tiene letras
 * latinas: '😀', '▲', '⚠️'. Así "smiel" da un aviso en vez de escribirse tal cual.
 */
export function isGlyph(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && t.length <= 16 && !/[A-Za-z0-9]/.test(t);
}
