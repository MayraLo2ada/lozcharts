import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contains,
  cutAntimeridian,
  featureCenter,
  featureIndex,
  features,
  fitProjection,
  geoPath,
  globe,
  graticule,
  projectOnGlobe,
  normalizeKey,
  rawProjection,
  registerMap,
  type Topology,
} from '../src/core/geo';
import { world } from '../src/maps/world';
import { bubbleRadius, choropleth } from '../src/series/map';
import { colorDomain, makeRamp, paint, position } from '../src/core/color';
import type { DrawContext, PreparedSeries } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('TopoJSON: arcos compartidos, cuantizados y recorridos al revés', () => {
  // Dos cuadrados que comparten el borde del medio (arco 1, de (1,0) a (1,1)); los dos lo
  // recorren al revés (-2 = ~1). Coordenadas cuantizadas en diferencias, con escala 1.
  const topo: Topology = {
    type: 'Topology',
    transform: { scale: [1, 1], translate: [0, 0] },
    arcs: [
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [1, 0],
      ],
      [
        [1, 0],
        [0, 1],
      ],
      [
        [1, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
      ],
    ],
    objects: {
      cuadros: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Polygon', id: 'A', arcs: [[0, -2]], properties: { name: 'Oeste' } },
          { type: 'Polygon', id: 'B', arcs: [[2, -2]] },
        ],
      },
    },
  };
  const [a, b] = features(topo);
  assert.deepEqual(a.polygons[0][0], [
    [1, 0],
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ]);
  assert.deepEqual(b.polygons[0][0], [
    [1, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [1, 0],
  ]);
  assert.equal(a.properties.name, 'Oeste');
  assert.equal(b.id, 'B');
});

test('GeoJSON también sirve', () => {
  const [f] = features({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'x',
        properties: null,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(f.id, 'x');
  assert.equal(f.polygons.length, 1);
});

test('Equal Earth: el origen en el centro, simétrica y con áreas iguales', () => {
  const p = rawProjection('equalEarth');
  assert.deepEqual(
    p(0, 0).map((v) => Math.abs(v)),
    [0, 0],
  );
  const [x, y] = p(30, 40);
  const [x2, y2] = p(-30, -40);
  assert.ok(near(x, -x2) && near(y, -y2));
  // Norte arriba: una latitud positiva da una y negativa (SVG crece hacia abajo).
  assert.ok(y < 0);
  // Áreas iguales: dos celdas de 10° × 10°, en el ecuador y a 60°, se comparan por su área
  // real en la esfera (cos φ); el cociente proyectado debe coincidir.
  const cellArea = (lat: number) => {
    const [a, b, c, d] = [p(0, lat), p(10, lat), p(10, lat + 10), p(0, lat + 10)];
    const pts = [a, b, c, d];
    let s = 0;
    for (let i = 0; i < 4; i++) s += pts[i][0] * pts[(i + 1) % 4][1] - pts[(i + 1) % 4][0] * pts[i][1];
    return Math.abs(s / 2);
  };
  const sphere = (lat: number) => Math.sin(((lat + 10) * Math.PI) / 180) - Math.sin((lat * Math.PI) / 180);
  assert.ok(near(cellArea(60) / cellArea(0), sphere(60) / sphere(0), 0.01));
});

test('Mercator infla las latitudes altas y se corta en ±85°', () => {
  const p = rawProjection('mercator');
  assert.ok(Math.abs(p(0, 60)[1]) > Math.abs(p(0, 30)[1]) * 2);
  assert.equal(p(0, 89)[1], p(0, 85)[1]);
});

test('el ajuste centra lo pedido en el área sin deformar', () => {
  const sq = features({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-10, -10],
              [10, -10],
              [10, 10],
              [-10, 10],
              [-10, -10],
            ],
          ],
        },
      },
    ],
  });
  const project = fitProjection(rawProjection('mercator'), sq, 300, 200, 0);
  const [x0] = project(-10, 0);
  const [x1] = project(10, 0);
  const [, yTop] = project(0, 10);
  const [, yBottom] = project(0, -10);
  assert.ok(near((x0 + x1) / 2, 150, 1e-6) && near((yTop + yBottom) / 2, 100, 1e-6));
  assert.ok(near(yBottom - yTop, 200, 1e-6));
});

test('meridiano 180: el polígono que lo cruza se corta en dos, sin franja', () => {
  const ring: [number, number][] = [
    [170, 60],
    [-170, 60],
    [-170, 70],
    [170, 70],
    [170, 60],
  ];
  const out = cutAntimeridian([[ring]]);
  assert.equal(out.length, 2);
  for (const poly of out) {
    const lons = poly[0].map(([lon]) => lon);
    assert.ok(Math.max(...lons) - Math.min(...lons) <= 10 + 1e-9, `ancho ${Math.max(...lons) - Math.min(...lons)}`);
  }
});

test('dentro o fuera, con huecos', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  const hole: [number, number][] = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
  ];
  assert.ok(contains([[square]], 2, 2));
  assert.ok(!contains([[square, hole]], 5, 5));
  assert.ok(!contains([[square]], 12, 5));
  assert.deepEqual(featureCenter([[square]]), [5, 5]);
  assert.match(geoPath([[square]]), /^M0,0L10,0L10,10L0,10Z$/);
});

test('el mapa del mundo: 177 lugares, cada uno con su ISO y su nombre en español', () => {
  const list = features(world);
  assert.equal(list.length, 177);
  assert.ok(list.every((f) => typeof f.properties.nombre === 'string' && f.properties.nombre));
  const index = featureIndex(list);
  const nombre = (k: string) => list[index.get(normalizeKey(k))!]?.properties.nombre;
  assert.equal(nombre('COL'), 'Colombia');
  assert.equal(nombre('United States of America'), 'Estados Unidos');
  assert.equal(nombre('méxico'), 'México');
  assert.equal(nombre('Côte d’Ivoire'), 'Costa de Marfil');
  assert.equal(nombre('32'), 'Argentina');
  // Rusia y Fiyi cruzan el meridiano 180: ningún anillo queda con un salto de más de 180°.
  for (const f of list) {
    for (const poly of f.polygons) {
      for (const ring of poly) {
        for (let i = 1; i < ring.length; i++)
          assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) <= 180, f.properties.name as string);
      }
    }
  }
});

test('burbujas: el área es proporcional al valor', () => {
  assert.equal(bubbleRadius(100, 100, 20), 20);
  assert.ok(near(bubbleRadius(25, 100, 20) ** 2 / 20 ** 2, 0.25));
  assert.equal(bubbleRadius(0, 100, 20), 0);
  assert.equal(bubbleRadius(NaN, 100, 20), 0);
});

test('GeoJSON con puntos o líneas: se ignoran, no rompen', () => {
  const list = features({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } as never },
      {
        type: 'Feature',
        id: 'a',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  });
  assert.deepEqual(
    list.map((f) => f.id),
    ['a'],
  );
});

test('una propiedad numérica (población) no es una clave para cruzar datos', () => {
  const list = features({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: '1',
        properties: { name: 'Uno' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        id: '2',
        properties: { name: 'Dos', pop: 1 },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(featureIndex(list).get('1'), 0);
});

test('el centro de un país con un hueco cae en su tierra, no en el hueco', () => {
  const outer: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  const hole: [number, number][] = [
    [3, 3],
    [7, 3],
    [7, 7],
    [3, 7],
  ];
  const c = featureCenter([[outer, hole]])!;
  assert.ok(contains([[outer, hole]], c[0], c[1]), `centro ${c}`);
  assert.equal(featureCenter([]), null);
});

test('globo: el frente se ve, la espalda no, y lo de atrás abraza el horizonte', () => {
  const g = globe(200, 200, [0, 0], 0);
  const [x, y, visible] = g.point(0, 0);
  assert.ok(visible && near(x, 100) && near(y, 100));
  assert.equal(g.point(180, 0)[2], false);
  // Norte arriba: una latitud positiva sube (y menor).
  assert.ok(g.point(0, 45)[1] < 100);
  // Un cuadrado que cruza el horizonte (lon 80 a 100): la parte de atrás queda sobre el borde.
  const sq = features({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [80, -5],
              [100, -5],
              [100, 5],
              [80, 5],
              [80, -5],
            ],
          ],
        },
      },
    ],
  });
  const polys = projectOnGlobe(sq[0], g);
  for (const [px, py] of polys[0][0]) assert.ok(Math.hypot(px - 100, py - 100) <= 100 + 1e-9);
  // Uno entero detrás no se dibuja.
  const back = features({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [170, -5],
              [175, -5],
              [175, 5],
              [170, 5],
              [170, -5],
            ],
          ],
        },
      },
    ],
  });
  assert.deepEqual(projectOnGlobe(back[0], g), []);
  assert.match(graticule(g), /^M/);
});

test('mapa coroplético: la muestra del tooltip es el color del lugar en la rampa', () => {
  registerMap('prueba', world);
  const places = ['Canada', 'Fiji', 'Tanzania', 'Atlántida'];
  const values = [10, 40, 25, 30];
  const ps: PreparedSeries = {
    key: 'v',
    name: 'Índice',
    impl: choropleth,
    slot: 0,
    options: { type: 'choropleth', field: 'v', map: 'prueba' },
    values,
    columns: {},
    texts: {},
    stackKey: null,
    axis: 'left',
    locale: 'es',
  };
  for (const theme of [LIGHT, DARK]) {
    const ctx: DrawContext = {
      frame: { ps, y0: values.map(() => 0), y1: values, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
      color: theme.palette[0],
      pointColor: () => theme.palette[0],
      x: new BandScale(places.length, 640),
      y: new LinearScale(0, 1, 360, 0),
      theme,
      width: 640,
      height: 360,
      n: places.length,
      isHidden: () => false,
      locale: 'es',
      label: (i) => places[i],
      measure: (s) => s.length * 7,
      format: String,
      compact: String,
      percent: String,
    };
    const warn = console.warn;
    console.warn = () => {};
    try {
      const d = choropleth.draw(ctx);
      const domain = colorDomain(values)!;
      const ramp = makeRamp(domain.kind, theme, ctx.color);
      for (let i = 0; i < 3; i++) {
        const swatch = choropleth.swatch!(ctx, i);
        assert.equal(swatch, paint(ramp, position(domain, values[i])).fill);
        assert.ok(d.includes(`fill="${swatch}"`), `${places[i]} en ${swatch}`);
      }
      assert.notEqual(choropleth.swatch!(ctx, 0), choropleth.swatch!(ctx, 1));
      // Un lugar que no está en el mapa no se pinta.
      assert.equal(choropleth.swatch!(ctx, 3), null);
    } finally {
      console.warn = warn;
    }
  }
});
