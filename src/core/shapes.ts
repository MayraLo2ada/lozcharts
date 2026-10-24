/**
 * Trazos SVG: línea, curva monótona, área y barra con punta redondeada.
 * Todas las funciones devuelven el atributo `d` de un <path>.
 */

export type Pt = [number, number];

/** Redondeo a centésimas para el markup SVG: archivos más chicos, sin perder nitidez. */
export const r2 = (v: number) => Math.round(v * 100) / 100;

/** Punto a distancia `r` del centro (cx, cy), en el ángulo `a` (radianes, sentido horario en SVG). */
export function polarPoint(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Parte una lista de puntos en tramos sin huecos (un NaN corta la línea). */
export function segments(points: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of points) {
    if (isFinite(p[0]) && isFinite(p[1])) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Tramos rectos: M x,y L x,y L … */
function straight(pts: Pt[], move = true): string {
  return pts.map((p, i) => (i === 0 && move ? 'M' : 'L') + r2(p[0]) + ',' + r2(p[1])).join('');
}

/**
 * Curva monótona (método de Fritsch–Carlson).
 *
 * Una curva suave "normal" (Catmull-Rom, Bézier libre) puede pasarse de los datos:
 * entre un 10 y un 50 dibuja un 52 que no existe. La monótona lo impide:
 * 1. Calcula la pendiente de cada tramo (dy/dx).
 * 2. La tangente en cada punto es el promedio de las pendientes vecinas, pero si cambian
 *    de signo (un pico o un valle) la tangente es 0: el punto queda plano.
 * 3. Si una tangente es demasiado empinada respecto a su tramo, se recorta (α²+β² ≤ 9).
 * 4. Cada tramo se dibuja como una Bézier cúbica con puntos de control a un tercio.
 * Resultado: suave, pero nunca sale del rango entre dos puntos consecutivos.
 */
function monotone(pts: Pt[], move = true): string {
  const n = pts.length;
  if (n < 3) return straight(pts, move);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1][0] - pts[i][0];
    dx.push(h);
    slope.push(h === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / h);
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = (move ? 'M' : 'L') + r2(pts[0][0]) + ',' + r2(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    d +=
      'C' + r2(x0 + h) + ',' + r2(y0 + m[i] * h) + ' ' + r2(x1 - h) + ',' + r2(y1 - m[i + 1] * h) + ' ' + r2(x1) + ',' + r2(y1);
  }
  return d;
}

/** Línea (con huecos donde falten datos). */
export function linePath(points: Pt[], smooth: boolean): string {
  return segments(points)
    .map((seg) => (seg.length === 1 ? point(seg[0]) : smooth ? monotone(seg) : straight(seg)))
    .join('');
}

/** Un punto aislado: un trazo de largo cero se ve como un punto con stroke-linecap round. */
function point(p: Pt): string {
  return 'M' + r2(p[0]) + ',' + r2(p[1]) + 'h0';
}

/**
 * Área entre una línea superior y una inferior (la base o la serie de abajo en un apilado).
 * `top[i]` y `bottom[i]` comparten la X.
 */
export function areaPath(top: Pt[], bottom: Pt[], smooth: boolean): string {
  const n = top.length;
  let d = '';
  let start = -1;
  const flush = (end: number) => {
    if (start < 0) return;
    const t = top.slice(start, end);
    const b = bottom.slice(start, end).reverse();
    const draw = smooth ? monotone : straight;
    d += draw(t) + draw(b, false) + 'Z';
    start = -1;
  };
  for (let i = 0; i < n; i++) {
    const ok = isFinite(top[i][1]) && isFinite(bottom[i][1]) && isFinite(top[i][0]);
    if (ok && start < 0) start = i;
    if (!ok) flush(i);
  }
  flush(n);
  return d;
}

/**
 * Barra vertical con la punta de datos redondeada y la base recta.
 * `yBase` es el lado de la base, `yEnd` el de la punta (puede estar arriba o abajo).
 */
export function barPath(x: number, w: number, yBase: number, yEnd: number, radius: number, rounded = true): string {
  const h = Math.abs(yEnd - yBase);
  if (h < 0.01 || w <= 0) return '';
  const r = rounded ? Math.min(radius, w / 2, h) : 0;
  const up = yEnd < yBase; // la punta queda arriba (valor positivo)
  const x0 = r2(x);
  const x1 = r2(x + w);
  const yb = r2(yBase);
  const ye = r2(yEnd);
  if (r <= 0) return `M${x0},${yb}V${ye}H${x1}V${yb}Z`;
  const rr = r2(r);
  if (up) {
    return `M${x0},${yb}V${r2(yEnd + r)}A${rr},${rr} 0 0 1 ${r2(x + r)},${ye}H${r2(x + w - r)}A${rr},${rr} 0 0 1 ${x1},${r2(yEnd + r)}V${yb}Z`;
  }
  return `M${x0},${yb}V${r2(yEnd - r)}A${rr},${rr} 0 0 0 ${r2(x + r)},${ye}H${r2(x + w - r)}A${rr},${rr} 0 0 0 ${x1},${r2(yEnd - r)}V${yb}Z`;
}

/**
 * Línea escalonada. `mode` dice dónde cambia de nivel entre dos puntos:
 * 'after' mantiene el valor hasta el punto siguiente (precios, tarifas), 'before' salta
 * de inmediato y 'middle' cambia a mitad de camino.
 */
export function stepPath(points: Pt[], mode: 'before' | 'after' | 'middle'): string {
  return segments(points)
    .map((seg) => {
      let d = 'M' + r2(seg[0][0]) + ',' + r2(seg[0][1]);
      for (let i = 1; i < seg.length; i++) {
        const x0 = seg[i - 1][0];
        const [x1, y1] = seg[i];
        if (mode === 'after') d += 'H' + r2(x1) + 'V' + r2(y1);
        else if (mode === 'before') d += 'V' + r2(y1) + 'H' + r2(x1);
        else d += 'H' + r2((x0 + x1) / 2) + 'V' + r2(y1) + 'H' + r2(x1);
      }
      return seg.length === 1 ? point(seg[0]) : d;
    })
    .join('');
}
