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
  normalizeKey,
  rawProjection,
  type Topology,
} from '../src/core/geo';
import { world } from '../src/maps/world';
import { bubbleRadius } from '../src/series/map';

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
