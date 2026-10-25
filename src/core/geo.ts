/**
 * Geografía: de contornos en longitud y latitud a caminos SVG.
 *
 * - TopoJSON: los países comparten sus fronteras como "arcos" (cada frontera se guarda una
 *   vez) y las coordenadas van cuantizadas en enteros con diferencias. `features` lo decodifica.
 *   También se acepta GeoJSON (FeatureCollection de Polygon y MultiPolygon).
 * - Proyecciones: Equal Earth (Šavrič, Patterson y Jenny, 2018), de áreas iguales, que es la
 *   honesta para colorear países por valor (Groenlandia no parece más grande que África), y
 *   Mercator, la conocida, que conserva formas pero infla las zonas polares.
 * - Ajuste: la proyección se escala y centra para que lo pedido llene el área sin deformarse.
 * Todo es puro (sin DOM), así que se prueba sin navegador.
 */

export interface Topology {
  type: 'Topology';
  transform?: { scale: [number, number]; translate: [number, number] };
  objects: Record<string, { type: 'GeometryCollection'; geometries: TopoGeometry[] }>;
  arcs: number[][][];
}

interface TopoGeometry {
  type: 'Polygon' | 'MultiPolygon' | string;
  id?: string | number;
  arcs?: number[][] | number[][][];
  properties?: Record<string, unknown>;
}

interface GeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  properties?: Record<string, unknown> | null;
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] } | null;
}

export interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type MapSource = Topology | GeoJSON;

/** Un lugar del mapa: sus polígonos (anillos de [lon, lat]) y sus propiedades. */
export interface GeoFeature {
  id: string;
  properties: Record<string, unknown>;
  /** Polígonos; cada uno es una lista de anillos (el primero, el borde; los demás, huecos). */
  polygons: [number, number][][][];
}

// ------------------------------------------------------------ Registro de mapas

const maps = new Map<string, GeoFeature[]>();

/** Registra un mapa con un nombre ('mundo'); se decodifica una sola vez. */
export function registerMap(name: string, source: MapSource): void {
  maps.set(name, features(source));
}

export function getMap(name: string): GeoFeature[] | undefined {
  return maps.get(name);
}

// ------------------------------------------------------------ Decodificación

/** Lugares de un TopoJSON (el primer objeto, o el que se nombre) o de un GeoJSON. */
export function features(source: MapSource, object?: string): GeoFeature[] {
  if (source.type === 'FeatureCollection') {
    return source.features
      .filter((f) => f.geometry)
      .map((f, k) => ({
        id: String(f.id ?? f.properties?.id ?? k),
        properties: f.properties ?? {},
        polygons: (f.geometry!.type === 'Polygon' ? [f.geometry!.coordinates] : f.geometry!.coordinates) as [
          number,
          number,
        ][][][],
      }));
  }
  const arcs = decodeArcs(source);
  const name = object ?? Object.keys(source.objects)[0];
  const geometries = source.objects[name]?.geometries ?? [];
  const ring = (indexes: number[]) => {
    const out: [number, number][] = [];
    for (const k of indexes) {
      // Un índice negativo (~k) es el arco k recorrido al revés.
      const arc = k < 0 ? arcs[~k].slice().reverse() : arcs[k];
      // Arcos seguidos comparten el punto de unión: se omite el repetido.
      out.push(...(out.length ? arc.slice(1) : arc));
    }
    return out;
  };
  return geometries
    .filter((g) => g.type === 'Polygon' || g.type === 'MultiPolygon')
    .map((g, k) => {
      const polys = (g.type === 'Polygon' ? [g.arcs] : g.arcs) as number[][][];
      return {
        id: String(g.id ?? g.properties?.id ?? k),
        properties: g.properties ?? {},
        polygons: cutAntimeridian(polys.map((poly) => poly.map(ring))),
      };
    });
}

/**
 * Polígonos que cruzan el meridiano 180 (el extremo de Rusia, Fiyi): en longitud saltan de 179
 * a −179 y, proyectados tal cual, cruzarían todo el mapa con una franja. Se "desenrollan" (sin
 * saltos de más de 180°) y se cortan en dos: lo que pasa de 180 se dibuja del otro lado.
 */
export function cutAntimeridian(polys: [number, number][][][]): [number, number][][][] {
  const out: [number, number][][][] = [];
  for (const poly of polys) {
    const crosses = poly.some((ring) => ring.some((p, i) => i > 0 && Math.abs(p[0] - ring[i - 1][0]) > 180));
    if (!crosses) {
      out.push(poly);
      continue;
    }
    const unwrapped = poly.map(unwrap);
    const east = unwrapped.map((r) => clipLon(r, 180, -1)).filter((r) => r.length >= 3);
    const west = unwrapped
      .map((r) => clipLon(r, 180, 1).map(([lon, lat]) => [lon - 360, lat] as [number, number]))
      .filter((r) => r.length >= 3);
    const eastLow = unwrapped.map((r) => clipLon(r, -180, 1)).filter((r) => r.length >= 3);
    const westLow = unwrapped
      .map((r) => clipLon(r, -180, -1).map(([lon, lat]) => [lon + 360, lat] as [number, number]))
      .filter((r) => r.length >= 3);
    // Desenrollado hacia el este (pasa de 180) o hacia el oeste (baja de −180): se usa el que aplique.
    const over = unwrapped.some((r) => r.some(([lon]) => lon > 180));
    const [a, b] = over ? [east, west] : [eastLow, westLow];
    if (a.length) out.push(a);
    if (b.length) out.push(b);
  }
  return out;
}

/** Quita los saltos de más de 180° sumando o restando 360 a lo que sigue. */
function unwrap(ring: [number, number][]): [number, number][] {
  let shift = 0;
  return ring.map((p, i) => {
    if (i > 0) {
      const d = p[0] - ring[i - 1][0];
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
    }
    return [p[0] + shift, p[1]] as [number, number];
  });
}

/**
 * Recorta un anillo contra el meridiano `at` (Sutherland–Hodgman con un solo borde): `side` −1
 * conserva lo que está al oeste (lon ≤ at), 1 lo que está al este. Los cruces se interpolan.
 */
function clipLon(ring: [number, number][], at: number, side: -1 | 1): [number, number][] {
  const inside = (p: [number, number]) => (side < 0 ? p[0] <= at : p[0] >= at);
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i + ring.length - 1) % ring.length];
    const cin = inside(cur);
    if (cin !== inside(prev)) {
      const t = (at - prev[0]) / (cur[0] - prev[0]);
      out.push([at, prev[1] + t * (cur[1] - prev[1])]);
    }
    if (cin) out.push(cur);
  }
  return out;
}

/** Arcos en coordenadas reales: en TopoJSON cuantizado cada punto es la diferencia con el anterior. */
function decodeArcs(t: Topology): [number, number][][] {
  const tr = t.transform;
  return t.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([a, b]) => {
      if (!tr) return [a, b] as [number, number];
      x += a;
      y += b;
      return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]] as [number, number];
    });
  });
}

// ------------------------------------------------------------ Proyecciones

export type ProjectionName = 'equalEarth' | 'mercator';

/** Proyección sin escalar: [lon, lat] en grados → [x, y] (y crece hacia abajo, como en SVG). */
export type RawProjection = (lon: number, lat: number) => [number, number];

const RAD = Math.PI / 180;
// Coeficientes de Equal Earth (Šavrič, Patterson y Jenny, 2018).
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;
/** Mercator no llega a los polos (y → ∞): se corta en ±85°, como los mapas web. */
const MERCATOR_LIMIT = 85;

export function rawProjection(name: ProjectionName): RawProjection {
  if (name === 'mercator') {
    return (lon, lat) => {
      const phi = Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat)) * RAD;
      return [lon * RAD, -Math.log(Math.tan(Math.PI / 4 + phi / 2))];
    };
  }
  return (lon, lat) => {
    const theta = Math.asin(M * Math.sin(lat * RAD));
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    const x = (lon * RAD * Math.cos(theta)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
    const y = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
    return [x, -y];
  };
}

/** Proyección ajustada a un área: [lon, lat] → px. */
export type Projection = (lon: number, lat: number) => [number, number];

/**
 * Escala y centra la proyección para que `fit` (los lugares que deben verse) quepan en
 * width × height con `pad` de margen, sin deformar: la misma escala en X y en Y.
 */
export function fitProjection(
  raw: RawProjection,
  fit: readonly GeoFeature[],
  width: number,
  height: number,
  pad = 4,
): Projection {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of fit) {
    for (const poly of f.polygons) {
      for (const [lon, lat] of poly[0] ?? []) {
        const [x, y] = raw(lon, lat);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!(x1 > x0) || !(y1 > y0)) return (lon, lat) => raw(lon, lat);
  const k = Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (y1 - y0));
  const ox = (width - k * (x1 - x0)) / 2 - k * x0;
  const oy = (height - k * (y1 - y0)) / 2 - k * y0;
  return (lon, lat) => {
    const [x, y] = raw(lon, lat);
    return [ox + k * x, oy + k * y];
  };
}

// ------------------------------------------------------------ Dibujo y puntero

/** Anillos de un lugar ya proyectados a px. */
export function projectFeature(f: GeoFeature, project: Projection): [number, number][][][] {
  return f.polygons.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => project(lon, lat))));
}

/** Camino SVG de anillos proyectados (relleno par-impar: los huecos quedan huecos). */
export function geoPath(polys: [number, number][][][]): string {
  let d = '';
  for (const poly of polys) {
    for (const ring of poly) {
      if (ring.length < 3) continue;
      d += 'M' + ring.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join('L') + 'Z';
    }
  }
  return d;
}

/** ¿El punto (x, y) está dentro del lugar? Rayo horizontal: se cuentan los cruces con sus bordes. */
export function contains(polys: [number, number][][][], x: number, y: number): boolean {
  let inside = false;
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}

/** Centro del polígono más grande del lugar (por área), en px: ahí va su tooltip o su burbuja. */
export function featureCenter(polys: [number, number][][][]): [number, number] {
  let best: [number, number] = [NaN, NaN];
  let bestArea = -1;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += cross;
      cx += (ring[j][0] + ring[i][0]) * cross;
      cy += (ring[j][1] + ring[i][1]) * cross;
    }
    if (Math.abs(a) > bestArea && a !== 0) {
      bestArea = Math.abs(a);
      best = [cx / (3 * a), cy / (3 * a)];
    }
  }
  return best;
}

// ------------------------------------------------------------ Cruce con los datos

/** Texto para comparar nombres: sin acentos, sin mayúsculas y sin signos ("Côte d'Ivoire" = "cote divoire"). */
export function normalizeKey(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Índice para encontrar un lugar por cualquiera de sus claves: el id y las propiedades de texto
 * (en el mapa del mundo: código numérico, ISO alfa-3, nombre en inglés y en español).
 */
export function featureIndex(list: readonly GeoFeature[]): Map<string, number> {
  const index = new Map<string, number>();
  list.forEach((f, k) => {
    const keys = [f.id, ...Object.values(f.properties).filter((v) => typeof v === 'string' || typeof v === 'number')];
    for (const key of keys) {
      const norm = normalizeKey(key);
      // Un código numérico también se encuentra sin ceros a la izquierda ("32" = "032").
      if (norm && !index.has(norm)) index.set(norm, k);
      if (/^\d+$/.test(norm)) index.set(String(Number(norm)), k);
    }
  });
  return index;
}
