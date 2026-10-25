/**
 * Reparto de etiquetas en un eje sin que se encimen.
 *
 * Cada etiqueta quiere ir a la altura de su dato. Las que chocan forman un grupo que se centra
 * en el promedio de lo que pedían sus miembros; si el grupo choca con el siguiente, se juntan y
 * se vuelve a centrar. Así nadie se aleja de su dato más de lo necesario, a diferencia de
 * empujar todo hacia abajo.
 */

/**
 * @param wanted posición deseada de cada etiqueta (px).
 * @param gap separación mínima entre dos etiquetas (su alto más un respiro).
 * @param min @param max límites del área: ninguna etiqueta sale de ahí si caben todas.
 * @returns la posición de cada etiqueta, en el mismo orden de `wanted`.
 */
export function spreadLabels(wanted: readonly number[], gap: number, min: number, max: number): number[] {
  const order = wanted.map((_, i) => i).sort((a, b) => wanted[a] - wanted[b]);
  interface Group {
    members: number[];
    /** Posición de la primera etiqueta del grupo. */
    top: number;
  }
  const place = (members: number[]): Group => {
    const mean = members.reduce((sum, i) => sum + wanted[i], 0) / members.length;
    const size = (members.length - 1) * gap;
    // Centrado en el promedio, sin salirse del área (si cabe).
    const top = Math.max(min, Math.min(max - size, mean - size / 2));
    return { members, top };
  };
  const groups: Group[] = [];
  for (const i of order) {
    groups.push(place([i]));
    // Mientras el último grupo choque con el anterior, se juntan.
    while (groups.length > 1) {
      const b = groups[groups.length - 1];
      const a = groups[groups.length - 2];
      if (a.top + a.members.length * gap <= b.top + 1e-9) break;
      groups.splice(groups.length - 2, 2, place([...a.members, ...b.members]));
    }
  }
  const out = new Array<number>(wanted.length);
  for (const g of groups) g.members.forEach((i, k) => (out[i] = g.top + k * gap));
  return out;
}
