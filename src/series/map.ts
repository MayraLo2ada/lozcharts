/**
 * Mapas (LozMap): países coloreados por su valor (coropletas) y burbujas sobre el mapa.
 *
 * Los contornos vienen de un mapa registrado (`LozChart.registerMap('mundo', topología)`; el del
 * mundo está en 'lozcharts/maps/world'). Cada fila de datos se cruza con un lugar por el campo
 * de la X: sirve el código ISO de 3 letras, el numérico o el nombre en inglés o en español, sin
 * importar mayúsculas ni acentos.
 *
 * - 'choropleth': cada país con datos se pinta con la escala de un solo tono de la serie
 *   (divergente si hay negativos), la misma del mapa de calor; sin datos, en gris. La proyección
 *   por defecto es Equal Earth, de áreas iguales: al colorear superficies, el tamaño aparente no
 *   debe exagerar a los países del norte como lo hace Mercator.
 * - 'mapbubble': el mapa en gris y un círculo por fila, en su latitud y longitud (o en el centro
 *   del país si no las trae), con el área proporcional al valor.
 */
import { dimOpacity, type DrawContext, type PreparedSeries, type SeriesImpl, type TooltipFormat } from '../core/series';
import { attrs, esc } from '../core/dom';
import {
  contains,
  normalizeKey as normalize,
  featureCenter,
  featureIndex,
  fitProjection,
  geoPath,
  globe,
  graticule,
  projectOnGlobe,
  getMap,
  projectFeature,
  rawProjection,
  type GeoFeature,
} from '../core/geo';
import {
  colorDomain,
  legendSpec,
  legendWidth,
  makeRamp,
  paint,
  paintColor,
  position,
  type Domain,
  type Paint,
} from '../core/color';
import { maxOf } from './common';

const FONT = 11;
const LEGEND_BAR_H = 8;
/** Alto que se reserva abajo para la leyenda de color (barra y números). */
const LEGEND_H = LEGEND_BAR_H + 6 + FONT + 6;
const LEGEND_STEPS = 24;
/** Radio de la burbuja mayor como fracción del lado menor del área (y nunca más de 28 px). */
const BUBBLE_SHARE = 0.06;
const MAX_BUBBLE = 28;
const MIN_BUBBLE = 2;
/** Lugares que no se dibujan salvo que tengan datos: la Antártida ocupa mucho y casi nunca es tema. */
const DEFAULT_EXCLUDE = ['ATA'];

interface MapSetup {
  key: string;
  features: GeoFeature[];
  /** Anillos en px, caminos SVG y centro de cada lugar dibujado. */
  shapes: { polys: [number, number][][][]; d: string; center: [number, number] | null; box: [number, number, number, number] }[];
  /** Lugar de cada fila de datos (-1 si no se encontró). */
  place: number[];
  project: (lon: number, lat: number) => [number, number];
  plotH: number;
  /** Con el globo: el disco (mar) y la cuadrícula de meridianos y paralelos visibles. */
  sphere: { cx: number; cy: number; r: number; graticule: string } | null;
}

const setups = new WeakMap<PreparedSeries, MapSetup>();
const warned = new WeakSet<PreparedSeries>();

/** Lugares del mapa, proyección ajustada y cruce con los datos; se rehace solo si cambia el área. */
function setup(ctx: DrawContext, legend: boolean): MapSetup | null {
  legend = legend && showScale(ctx);
  const ps = ctx.frame.ps;
  const name = ps.options.map ?? 'mundo';
  const all = getMap(name);
  if (!all) {
    if (!warned.has(ps)) {
      warned.add(ps);
      console.warn(
        `LozCharts: no hay ningún mapa registrado como "${name}". Regístralo con LozChart.registerMap('${name}', …) antes de dibujar.`,
      );
    }
    return null;
  }
  const plotH = Math.max(40, ctx.height - (legend ? LEGEND_H : 0));
  const projection = ps.options.projection ?? 'equalEarth';
  const fit = ps.options.fit ?? 'all';
  const rotate = ps.options.rotate;
  const key = `${name}|${ctx.width}|${plotH}|${projection}|${fit}|${ctx.n}|${rotate ?? ''}`;
  const cached = setups.get(ps);
  if (cached && cached.key === key) return cached;

  const index = featureIndex(all);
  const place = Array.from({ length: ctx.n }, (_, i) => index.get(normalize(ctx.label(i))) ?? -1);
  // Una burbuja con latitud y longitud no necesita estar en el mapa.
  const { lat, lon } = ps.columns;
  const located = (i: number) => !!lat && !!lon && isFinite(lat[i]) && isFinite(lon[i]);
  const missing = place.map((p, i) => (p < 0 && !located(i) ? ctx.label(i) : '')).filter(Boolean);
  if (missing.length && !warned.has(ps)) {
    warned.add(ps);
    console.warn(
      `LozCharts: no encuentro estos lugares en el mapa "${name}": ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}. ` +
        'Revisa cómo están escritos.',
    );
  }
  // Se excluye lo que no tiene datos y está en la lista de excluidos (la Antártida).
  const used = new Set(place);
  const exclude = new Set(DEFAULT_EXCLUDE.map(normalize));
  const features = all.filter((f, k) => used.has(k) || !Object.values(f.properties).some((v) => exclude.has(normalize(v))));
  const remap = new Map(features.map((f, k) => [all.indexOf(f), k]));
  // Con fit 'data' se encuadran solo los lugares con datos; los demás se dibujan igual y el
  // recorte del área esconde lo que queda fuera.
  const framed = fit === 'data' ? features.filter((f) => used.has(all.indexOf(f))) : features;
  let project: (lon: number, lat: number) => [number, number];
  let toPolys: (f: GeoFeature) => [number, number][][][];
  let sphere: MapSetup['sphere'] = null;
  if (projection === 'orthographic') {
    // El globo mira al centro de los datos (o a donde se pida): lo importante, al frente. Con
    // cualquier `fit`: encuadrar todo el mundo no cabe en una cara, y mirar al centro de todos los
    // países dejaría los datos de espaldas.
    const withData = features.filter((f) => used.has(all.indexOf(f)));
    const points: [number, number][] = [];
    for (let i = 0; i < ctx.n; i++) if (located(i)) points.push([lon[i], lat[i]]);
    const g = globe(ctx.width, plotH, rotate ?? lookAt(withData.length || points.length ? withData : features, points));
    project = (lo, la) => {
      const [x, y, visible] = g.point(lo, la);
      return visible ? [x, y] : [NaN, NaN];
    };
    toPolys = (f) => projectOnGlobe(f, g);
    sphere = { cx: g.cx, cy: g.cy, r: g.r, graticule: graticule(g) };
  } else {
    const fitted = fitProjection(rawProjection(projection), framed.length ? framed : features, ctx.width, plotH);
    project = fitted;
    toPolys = (f) => projectFeature(f, fitted);
  }
  const shapes = features.map((f) => {
    const polys = toPolys(f);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const poly of polys)
      for (const [x, y] of poly[0] ?? []) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    return { polys, d: geoPath(polys), center: featureCenter(polys), box: [x0, y0, x1, y1] as [number, number, number, number] };
  });
  const out: MapSetup = { key, features, shapes, place: place.map((p) => remap.get(p) ?? -1), project, plotH, sphere };
  setups.set(ps, out);
  return out;
}

/**
 * [lon, lat] hacia donde mira el globo si no se dice: el promedio de los lugares, cada uno con el
 * mismo peso (un país con una costa muy recortada no arrastra la vista hacia él), y de los puntos
 * dados por latitud y longitud.
 */
export function lookAt(list: readonly GeoFeature[], points: readonly [number, number][] = []): [number, number] {
  let x = 0;
  let y = 0;
  let z = 0;
  // Promedio en 3D (sobre la esfera), no en grados: así no falla cerca del meridiano 180.
  const add = (lon: number, lat: number, w: number) => {
    const l = (lon * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    x += w * Math.cos(p) * Math.cos(l);
    y += w * Math.cos(p) * Math.sin(l);
    z += w * Math.sin(p);
  };
  for (const f of list) {
    let count = 0;
    for (const poly of f.polygons) count += (poly[0] ?? []).length;
    if (!count) continue;
    for (const poly of f.polygons) for (const [lon, lat] of poly[0] ?? []) add(lon, lat, 1 / count);
  }
  for (const [lon, lat] of points) add(lon, lat, 1);
  if (Math.hypot(x, y, z) < 1e-9) return [0, 0];
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

/** El mar y la cuadrícula del globo, debajo de los países. */
function sphereMarkup(S: MapSetup, ctx: DrawContext): string {
  const s = S.sphere;
  if (!s) return '';
  return (
    `<circle${attrs({ cx: s.cx.toFixed(1), cy: s.cy.toFixed(1), r: s.r.toFixed(1), fill: ctx.theme.highlight, stroke: ctx.theme.grid, 'stroke-width': 1 })}/>` +
    `<path${attrs({ d: s.graticule, fill: 'none', stroke: ctx.theme.grid, 'stroke-width': 0.6 })}/>`
  );
}

/** Índice de claves de cada mapa (se arma una vez por mapa registrado). */
const indexes = new WeakMap<GeoFeature[], Map<string, number>>();

/**
 * Nombre del lugar para el tooltip y la tabla: en español si el mapa lo trae. No depende del
 * dibujo: la tabla se arma antes del primer cuadro.
 */
function placeName(ps: PreparedSeries, _i: number, x: string): string {
  const all = getMap(ps.options.map ?? 'mundo');
  if (!all) return x;
  if (!indexes.has(all)) indexes.set(all, featureIndex(all));
  const k = indexes.get(all)!.get(normalize(x));
  const f = k === undefined ? null : all[k];
  const nombre = f?.properties.nombre ?? f?.properties.name;
  return typeof nombre === 'string' && nombre ? nombre : x;
}

/** La escala de color se muestra salvo `labels: false` (un mapa decorativo, o con su propia leyenda afuera). */
function showScale(ctx: DrawContext): boolean {
  return ctx.frame.ps.options.labels !== false;
}

/** Barra de la escala de color con sus números, abajo a la izquierda. */
function legendMarkup(ctx: DrawContext, d: Domain, plotH: number): string {
  const spec = legendSpec(d, ctx.compact);
  const w = Math.min(legendWidth(spec, ctx.measure), ctx.width - 8);
  const ramp = makeRamp(d.kind, ctx.theme, ctx.color);
  const y = plotH + 6;
  let s = '';
  for (let k = 0; k < LEGEND_STEPS; k++) {
    const p = spec.from + ((spec.to - spec.from) * (k + 0.5)) / LEGEND_STEPS;
    const c = paint(ramp, p);
    s += `<rect${attrs({ x: ((w * k) / LEGEND_STEPS).toFixed(1), y, width: (w / LEGEND_STEPS + 0.5).toFixed(1), height: LEGEND_BAR_H, fill: c.fill, 'fill-opacity': c.opacity })}/>`;
  }
  for (const [text, at] of spec.labels) {
    const anchor = at === 0 ? 'start' : at === 1 ? 'end' : 'middle';
    s += `<text${attrs({ x: (w * at).toFixed(1), y: y + LEGEND_BAR_H + 4, fill: ctx.theme.textMuted, 'font-size': FONT, 'text-anchor': anchor, 'dominant-baseline': 'hanging' })}>${esc(text)}</text>`;
  }
  return s;
}

/** Contorno de un lugar sin datos (o de fondo, en burbujas). */
function basePath(d: string, ctx: DrawContext): string {
  return `<path${attrs({ d, fill: ctx.theme.grid, stroke: ctx.theme.surface, 'stroke-width': 0.5, 'stroke-linejoin': 'round' })}/>`;
}

function hitPlace(S: MapSetup, px: number, py: number, rows: readonly number[]): number {
  for (const i of rows) {
    const k = S.place[i];
    if (k < 0) continue;
    const sh = S.shapes[k];
    const [x0, y0, x1, y1] = sh.box;
    if (px < x0 || px > x1 || py < y0 || py > y1) continue;
    if (contains(sh.polys, px, py)) return i;
  }
  return -1;
}

/** Filas con lugar y valor, de mayor a menor (el orden del teclado). */
function ranked(ps: PreparedSeries, place?: readonly number[]): number[] {
  // Un lugar repetido cuenta una vez, con su última fila: la misma regla que el color.
  const last = new Map<number, number>();
  if (place) place.forEach((k, i) => k >= 0 && isFinite(ps.values[i]) && last.set(k, i));
  return ps.values
    .map((_, i) => i)
    .filter((i) => isFinite(ps.values[i]) && (!place || (place[i] >= 0 && last.get(place[i]) === i)))
    .sort((a, b) => ps.values[b] - ps.values[a]);
}

const tooltip = (ps: PreparedSeries, i: number, format: TooltipFormat) => ({
  value: isFinite(ps.values[i]) ? format.value(ps.values[i]) : 'Sin dato',
});

/** Color de cada lugar con el valor de este cuadro: el de su fila (si una fila se repite, la última). */
function placePaints(ctx: DrawContext, S: MapSetup): Map<number, Paint> {
  const out = new Map<number, Paint>();
  const domain = colorDomain(ctx.frame.ps.values);
  if (!domain) return out;
  const ramp = makeRamp(domain.kind, ctx.theme, ctx.color);
  const y1 = ctx.frame.y1;
  S.place.forEach((k, i) => {
    if (k >= 0 && isFinite(y1[i])) out.set(k, paint(ramp, position(domain, y1[i])));
  });
  return out;
}

export const choropleth: SeriesImpl = {
  coords: 'free',
  label: 'mapa por colores',
  legendSymbol: 'square',
  items: ['lugar', 'lugares'],
  dimmable: true,
  draw(ctx) {
    const S = setup(ctx, true);
    if (!S) return '';
    const domain = colorDomain(ctx.frame.ps.values);
    const paints = placePaints(ctx, S);
    // La fila de cada forma, para atenuar los lugares fuera de la selección.
    const rowOf = new Map<number, number>();
    S.place.forEach((k, i) => k >= 0 && rowOf.set(k, i));
    let s = sphereMarkup(S, ctx);
    S.shapes.forEach((sh, k) => {
      if (!sh.d) return;
      const c = paints.get(k);
      if (!c) {
        s += basePath(sh.d, ctx);
        return;
      }
      const i = rowOf.get(k);
      const opacity = i === undefined ? undefined : dimOpacity(ctx, i);
      s += `<path${attrs({ d: sh.d, fill: c.fill, 'fill-opacity': c.opacity, opacity, stroke: ctx.theme.surface, 'stroke-width': 0.5, 'stroke-linejoin': 'round' })}/>`;
    });
    return s + (domain && showScale(ctx) ? legendMarkup(ctx, domain, S.plotH) : '');
  },
  hit(ctx, px, py) {
    const S = setup(ctx, true);
    return S ? hitPlace(S, px, py, ranked(ctx.frame.ps, S.place)) : -1;
  },
  anchor(ctx, i) {
    const S = setup(ctx, true);
    const k = S?.place[i] ?? -1;
    return S && k >= 0 ? S.shapes[k].center : null;
  },
  hover(ctx, i) {
    const S = setup(ctx, true);
    const k = S?.place[i] ?? -1;
    if (!S || k < 0) return '';
    return `<path${attrs({ d: S.shapes[k].d, fill: 'none', stroke: ctx.theme.text, 'stroke-width': 1.5, 'stroke-linejoin': 'round' })}/>`;
  },
  // El color del lugar en la rampa, como en el mapa.
  swatch(ctx, i) {
    const S = setup(ctx, true);
    const k = S?.place[i] ?? -1;
    const c = S && k >= 0 ? placePaints(ctx, S).get(k) : undefined;
    return c ? paintColor(c) : null;
  },
  navigable: (ps) => ranked(ps, setups.get(ps)?.place),
  headline: (ps, i, x) => placeName(ps, i, x),
  tooltip,
};

/** Radio de cada burbuja: área proporcional al valor respecto del mayor. */
export function bubbleRadius(v: number, max: number, largest: number): number {
  if (!(v > 0) || !(max > 0)) return 0;
  return Math.max(MIN_BUBBLE, largest * Math.sqrt(v / max));
}

/** Centro de cada burbuja: su latitud y longitud, o el centro de su país. */
function bubbleCenters(ctx: DrawContext, S: MapSetup): ([number, number] | null)[] {
  const { lat, lon } = ctx.frame.ps.columns;
  return Array.from({ length: ctx.n }, (_, i) => {
    if (lat && lon && isFinite(lat[i]) && isFinite(lon[i])) {
      // En el globo, lo que queda detrás no se ve.
      const p = S.project(lon[i], lat[i]);
      return isFinite(p[0]) ? p : null;
    }
    const k = S.place[i];
    return k >= 0 ? S.shapes[k].center : null;
  });
}

function bubbleScale(ctx: DrawContext, S: MapSetup) {
  const max = maxOf(
    ctx.frame.ps.values.filter((v) => isFinite(v)),
    0,
  );
  const largest = Math.min(MAX_BUBBLE, Math.min(ctx.width, S.plotH) * BUBBLE_SHARE);
  return { max, largest, centers: bubbleCenters(ctx, S) };
}

export const mapbubble: SeriesImpl = {
  coords: 'free',
  label: 'mapa de burbujas',
  legendSymbol: 'dot',
  items: ['lugar', 'lugares'],
  columns: (o) => ({ lat: o.lat, lon: o.lon }),
  dimmable: true,
  draw(ctx) {
    const S = setup(ctx, false);
    if (!S) return '';
    const { max, largest, centers } = bubbleScale(ctx, S);
    let s = sphereMarkup(S, ctx) + S.shapes.map((sh) => (sh.d ? basePath(sh.d, ctx) : '')).join('');
    // Las grandes primero: las chicas quedan encima y se pueden señalar.
    const order = ranked(ctx.frame.ps);
    for (const i of order) {
      const c = centers[i];
      const r = bubbleRadius(ctx.frame.y1[i], max, largest);
      if (!c || !r) continue;
      s += `<circle${attrs({ cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: r.toFixed(2), fill: ctx.color, 'fill-opacity': 0.7, opacity: dimOpacity(ctx, i), stroke: ctx.theme.surface, 'stroke-width': 1 })}/>`;
    }
    return s;
  },
  hit(ctx, px, py) {
    const S = setup(ctx, false);
    if (!S) return -1;
    const { max, largest, centers } = bubbleScale(ctx, S);
    // De la más chica a la más grande: la de encima gana.
    for (const i of ranked(ctx.frame.ps).reverse()) {
      const c = centers[i];
      const r = bubbleRadius(ctx.frame.y1[i], max, largest);
      if (c && r && Math.hypot(px - c[0], py - c[1]) <= Math.max(r, 6)) return i;
    }
    return -1;
  },
  anchor(ctx, i) {
    const S = setup(ctx, false);
    return S ? bubbleCenters(ctx, S)[i] : null;
  },
  hover(ctx, i) {
    const S = setup(ctx, false);
    if (!S) return '';
    const { max, largest, centers } = bubbleScale(ctx, S);
    const c = centers[i];
    const r = bubbleRadius(ctx.frame.y1[i], max, largest);
    if (!c || !r) return '';
    return `<circle${attrs({ cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: (r + 1).toFixed(2), fill: 'none', stroke: ctx.theme.text, 'stroke-width': 2 })}/>`;
  },
  navigable: (ps) => ranked(ps),
  headline: (ps, i, x) => placeName(ps, i, x),
  tooltip,
};
