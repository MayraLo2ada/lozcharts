/**
 * Muchos datos en pocos píxeles: qué puntos de una línea vale la pena dibujar.
 *
 * Con 100 000 puntos en 1000 px, cada columna de píxeles recibe 100 puntos y el trazo de 1,3 MB
 * se ve igual que uno de 4000 puntos. Por cada columna se conservan el primero, el mínimo, el
 * máximo y el último: la línea pasa por los mismos extremos (ningún pico desaparece, a
 * diferencia de tomar uno de cada k) y entra y sale de la columna por el mismo lugar.
 * Lo que queda fuera del área (con zoom) no se dibuja, salvo un vecino de cada lado para que la
 * línea llegue al borde. Los huecos (datos que faltan) se conservan como huecos.
 */
import type { XScale } from './scales';
import { visibleIndices } from './view';

/** Por debajo de esta densidad (puntos por px) se dibuja todo, sin reducir. */
const MAX_DENSITY = 2;

/**
 * Índices a dibujar, en orden. `values` decide los extremos de cada columna; si hay que dibujar
 * otra lista con los mismos índices (la base de un área apilada), se usan los mismos.
 */
export function drawIndices(x: XScale, width: number, values: readonly number[]): number[] {
  const range = visibleIndices(x, width, true);
  if (!range) return [];
  const [first, last] = range;
  const count = last - first + 1;
  const all = () => Array.from({ length: count }, (_, k) => first + k);
  if (count <= Math.max(1, width) * MAX_DENSITY) return all();

  const out: number[] = [];
  let column = NaN;
  // Columna en curso: primero, mínimo, máximo, último y el primer hueco (si hay).
  let a = -1;
  let lo = -1;
  let hi = -1;
  let z = -1;
  let gap = -1;
  const flush = () => {
    if (a < 0) return;
    const keep = [a, lo, hi, z, gap].filter((i, k, list) => i >= 0 && list.indexOf(i) === k);
    keep.sort((p, q) => p - q);
    out.push(...keep);
  };
  for (let i = first; i <= last; i++) {
    const c = Math.floor(x.at(i));
    if (c !== column) {
      flush();
      column = c;
      a = lo = hi = z = i;
      gap = -1;
      if (!isFinite(values[i])) {
        lo = hi = -1;
        gap = i;
      }
      continue;
    }
    z = i;
    const v = values[i];
    if (!isFinite(v)) {
      if (gap < 0) gap = i;
      continue;
    }
    if (lo < 0 || v < values[lo]) lo = i;
    if (hi < 0 || v > values[hi]) hi = i;
  }
  flush();
  return out;
}
