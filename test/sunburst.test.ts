import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TINY,
  UNNAMED,
  buildHierarchy,
  cleanPath,
  fitArcLabel,
  hitArc,
  holeShare,
  layoutSunburst,
  levelFields,
  nodeColor,
  nodeOfRef,
  nodePath,
  radialRoom,
  refOf,
  sunburst,
  tangentialRoom,
  upright,
  type SunModel,
} from '../src/series/sunburst';
import { contrast as wcag, parseColor } from '../src/core/color';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';
import { polarPoint } from '../src/core/shapes';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const TAU = 2 * Math.PI;
const START = -Math.PI / 2;

type Row = [region: string, pais: string, ciudad: string, valor: number];

/** Ventas por región, país y ciudad. */
const VENTAS: Row[] = [
  ['América', 'México', 'Monterrey', 120],
  ['América', 'México', 'CDMX', 300],
  ['América', 'Colombia', 'Bogotá', 180],
  ['Europa', 'España', 'Madrid', 260],
  ['Europa', 'España', 'Sevilla', 40],
  ['América', 'México', 'Guadalajara', 90],
  ['Asia', 'Japón', 'Tokio', 150],
];

const paths = (rows: Row[]) => rows.map((r) => [r[0], r[1], r[2]]);
const values = (rows: Row[]) => rows.map((r) => r[3]);
const model = (rows: Row[], maxColors?: number) => buildHierarchy(paths(rows), values(rows), maxColors);
const byName = (m: SunModel, name: string) => m.nodes.findIndex((n) => n.name === name);

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  return {
    key: 'Ventas',
    name: 'Ventas',
    impl: sunburst,
    slot: 0,
    options: { type: 'sunburst', field: 'v', levels: ['region', 'pais', 'ciudad'], ...extra },
    values: values(rows),
    columns: {},
    texts: { level0: rows.map((r) => r[0]), level1: rows.map((r) => r[1]), level2: rows.map((r) => r[2]) },
    stackKey: null,
    axis: 'left',
  };
}

function context(ps: PreparedSeries, width = 480, height = 480, y1 = ps.values, theme = LIGHT, alpha = 1): DrawContext {
  const n = ps.values.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: {}, alpha, slot: 0, slots: 1, outer: [] },
    color: theme.palette[0],
    pointColor: () => theme.palette[0],
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => ps.texts.level0[i] ?? '',
    measure,
    format: (v) => String(v),
    compact: (v) => `${Math.round(v / 1000)} mil`,
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const format: TooltipFormat = {
  value: String,
  number: String,
  percent: (p) => `${Math.round(p * 1000) / 10} %`,
  isHidden: () => false,
  difference: String,
};

test('jerarquía: los interiores suman a sus hijos y los hermanos van de mayor a menor', () => {
  const m = model(VENTAS);
  assert.equal(m.depth, 3);
  assert.equal(m.total, 1140);
  assert.deepEqual(
    m.roots.map((r) => m.nodes[r].name),
    ['América', 'Europa', 'Asia'],
  );
  const mx = byName(m, 'México');
  assert.equal(m.nodes[mx].value, 510);
  assert.deepEqual(
    m.nodes[mx].children.map((c) => m.nodes[c].name),
    ['CDMX', 'Monterrey', 'Guadalajara'],
  );
  for (const node of m.nodes) {
    if (!node.children.length) continue;
    const sum = node.children.reduce((s, c) => s + m.nodes[c].value, 0);
    assert.equal(node.value, sum);
  }
  // Preorden: cada rama seguida de sus hijos, en el orden del dibujo.
  assert.deepEqual(
    m.order.map((id) => m.nodes[id].name),
    [
      'América',
      'México',
      'CDMX',
      'Monterrey',
      'Guadalajara',
      'Colombia',
      'Bogotá',
      'Europa',
      'España',
      'Madrid',
      'Sevilla',
      'Asia',
      'Japón',
      'Tokio',
    ],
  );
  assert.deepEqual(nodePath(m, byName(m, 'Sevilla')), ['Europa', 'España', 'Sevilla']);
});

test('rutas: huecos al medio son "Sin nombre", al final acortan; mismo nombre en otra rama es otro nodo', () => {
  assert.deepEqual(cleanPath(['América', '', 'Monterrey']), ['América', UNNAMED, 'Monterrey']);
  assert.deepEqual(cleanPath(['América', 'México', '', '']), ['América', 'México']);
  assert.deepEqual(cleanPath(['', '', '']), []);
  const m = buildHierarchy(
    [
      ['Perú', 'Lima'],
      ['EE. UU.', 'Lima'],
      ['Perú', ''],
      ['Perú', 'Lima'],
    ],
    [10, 5, 3, 2],
  );
  assert.equal(m.nodes.filter((n) => n.name === 'Lima').length, 2);
  const peru = byName(m, 'Perú');
  // El valor propio de Perú (la fila sin ciudad) cuenta en su total.
  assert.equal(m.nodes[peru].value, 15);
  // La misma ruta dos veces cae en el mismo nodo.
  const lima = m.nodes[peru].children[0];
  assert.deepEqual(m.nodes[lima].rows, [0, 3]);
  assert.equal(m.nodes[lima].value, 12);
});

test('ceros, negativos, NaN y filas sin ruta se ignoran', () => {
  const m = buildHierarchy(
    [
      ['A', 'x'],
      ['A', 'y'],
      ['B', 'z'],
      ['B', 'w'],
      ['', ''],
      ['C', 'v'],
    ],
    [10, 0, -5, NaN, 7, 4],
  );
  assert.deepEqual(m.ignored, [1, 2, 3, 4]);
  assert.equal(m.total, 14);
  assert.deepEqual(
    m.roots.map((r) => m.nodes[r].name),
    ['A', 'C'],
  );
  const empty = buildHierarchy([], []);
  assert.equal(empty.depth, 0);
  const g = layoutSunburst(empty, [], 300, 300);
  assert.equal(g.arcs.length, 0);
  // Sin nada que dibujar: el anillo vacío de la rejilla y el total en cero.
  const rows: Row[] = [['A', 'x', 'y', 0]];
  const d = sunburst.draw(context(series(rows), 300, 300));
  assert.ok(d.includes(`fill="${LIGHT.grid}"`) && d.includes('>0<'));
  assert.equal(sunburst.hit!(context(series(rows), 300, 300), 150, 40), -1);
});

test('índices: una hoja usa su fila; los interiores y las rutas repetidas, uno virtual', () => {
  const m = model(VENTAS);
  const cdmx = byName(m, 'CDMX');
  assert.equal(refOf(m, cdmx), 1);
  assert.equal(nodeOfRef(m, 1), cdmx);
  const america = byName(m, 'América');
  assert.equal(refOf(m, america), VENTAS.length + america);
  assert.equal(nodeOfRef(m, VENTAS.length + america), america);
  assert.equal(nodeOfRef(m, VENTAS.length + m.nodes.length), -1);
});

test('geometría: los ángulos suman 360° y cada hijo queda dentro de su padre', () => {
  const m = model(VENTAS);
  const g = layoutSunburst(m, values(VENTAS), 400, 400);
  const span = (id: number) => g.arcs[id].a1 - g.arcs[id].a0;
  near(
    m.roots.reduce((s, r) => s + span(r), 0),
    TAU,
  );
  // Empieza arriba y avanza en sentido horario.
  near(g.arcs[m.roots[0]].a0, START);
  near(g.arcs[m.roots[m.roots.length - 1]].a1, START + TAU);
  for (let id = 0; id < m.nodes.length; id++) {
    const node = m.nodes[id];
    near(span(id), (node.value / m.total) * TAU);
    if (node.parent < 0) continue;
    const p = g.arcs[node.parent];
    assert.ok(g.arcs[id].a0 >= p.a0 - 1e-9 && g.arcs[id].a1 <= p.a1 + 1e-9);
    near(g.arcs[id].r0, p.r1);
  }
  // Anillos parejos entre el agujero y el borde.
  near(g.hole, g.outer * holeShare(3));
  near(g.hole + 3 * g.ring, g.outer);
  assert.equal(holeShare(1), 0.6);
  assert.ok(holeShare(7) < holeShare(3));
});

test('animación: con los valores del cuadro y el giro creciendo con la opacidad', () => {
  const m = model(VENTAS);
  const half = layoutSunburst(m, values(VENTAS), 400, 400, 0.5);
  const top = m.roots.reduce((s, r) => s + half.arcs[r].a1 - half.arcs[r].a0, 0);
  near(top, Math.PI);
  // Valores a mitad de camino: el total cambia, el orden no.
  const sizes = values(VENTAS).map((v, i) => (i === 3 ? v * 3 : v));
  const g = layoutSunburst(m, sizes, 400, 400);
  assert.ok(g.arcs[m.roots[1]].a0 > g.arcs[m.roots[0]].a0);
  near(
    m.roots.reduce((s, r) => s + g.arcs[r].a1 - g.arcs[r].a0, 0),
    TAU,
  );
  assert.equal(g.total, 1140 + 520);
  // Todo en cero (el primer cuadro): ningún arco, un anillo de rejilla.
  const d = sunburst.draw(
    context(
      series(VENTAS),
      400,
      400,
      VENTAS.map(() => 0),
      LIGHT,
      0,
    ),
  );
  assert.ok(d.includes(LIGHT.grid));
});

test('un solo nivel: se comporta como un donut', () => {
  const m = buildHierarchy([['A'], ['B'], ['C']], [50, 30, 20]);
  assert.equal(m.depth, 1);
  const g = layoutSunburst(m, [50, 30, 20], 300, 300);
  near(g.hole, g.outer * 0.6);
  near(g.arcs[0].a1 - g.arcs[0].a0, TAU / 2);
  assert.deepEqual(levelFields({ type: 'sunburst', field: 'v' }, 'categoria'), ['categoria']);
  assert.deepEqual(levelFields({ type: 'sunburst', field: 'v', levels: ['a', '', 'b'] }, 'x'), ['a', 'b']);
  assert.deepEqual(sunburst.texts!({ type: 'sunburst', field: 'v', levels: ['region', 'pais'] }, 'x'), {
    level0: 'region',
    level1: 'pais',
  });
});

test('jerarquías profundas: seis niveles con anillos parejos', () => {
  const rows = [
    ['a', 'b', 'c', 'd', 'e', 'f'],
    ['a', 'b', 'c', 'd', 'e', 'g'],
    ['a', 'b', 'h'],
    ['i', 'j', 'k', 'l', 'm', 'n'],
  ];
  const m = buildHierarchy(rows, [4, 3, 2, 5]);
  assert.equal(m.depth, 6);
  const g = layoutSunburst(m, [4, 3, 2, 5], 500, 500);
  for (let id = 0; id < m.nodes.length; id++) near(g.arcs[id].r0, g.hole + m.nodes[id].depth * g.ring);
  // El tramo propio de "b" (la fila que termina en "h" es su hija; la de "c" ocupa el resto).
  const b = byName(m, 'b');
  const kids = m.nodes[b].children.reduce((s, c) => s + g.arcs[c].a1 - g.arcs[c].a0, 0);
  near(kids, g.arcs[b].a1 - g.arcs[b].a0);
});

test('hit-test: anillo por distancia y segmento por ángulo; el agujero y afuera no apuntan', () => {
  const ps = series(VENTAS);
  const ctx = context(ps, 400, 400);
  const m = model(VENTAS);
  const g = layoutSunburst(m, ps.values, 400, 400);
  for (let id = 0; id < m.nodes.length; id++) {
    const a = g.arcs[id];
    const [x, y] = polarPoint(g.cx, g.cy, (a.r0 + a.r1) / 2, (a.a0 + a.a1) / 2);
    assert.equal(hitArc(m, g, x, y), id);
    assert.equal(sunburst.hit!(ctx, x, y), refOf(m, id));
  }
  assert.equal(sunburst.hit!(ctx, 200, 200), -1);
  assert.equal(sunburst.hit!(ctx, 0, 0), -1);
  const [ax, ay] = sunburst.anchor!(ctx, 1)!;
  const cdmx = g.arcs[byName(m, 'CDMX')];
  near(Math.hypot(ax - g.cx, ay - g.cy), cdmx.r1);
});

test('segmentos diminutos: van juntos, sin etiqueta, pero se apuntan uno por uno', () => {
  const rows: Row[] = [['Grande', 'g', 'g1', 10000]];
  rows.push(['Chico', 'cGrande', 'cGrande1', 2000]);
  for (let k = 0; k < 6; k++) rows.push(['Chico', `c${k}`, `c${k}a`, 1]);
  const ps = series(rows);
  const m = model(rows);
  const g = layoutSunburst(m, ps.values, 300, 300);
  const chico = byName(m, 'Chico');
  const kids = m.nodes[chico].children.slice(1);
  assert.ok(!g.tiny[chico] && !g.tiny[m.nodes[chico].children[0]]);
  for (const c of kids) assert.ok(g.tiny[c] && (g.arcs[c].a1 - g.arcs[c].a0) * g.arcs[c].r1 < TINY);
  // Lo que cuelga de un diminuto no se dibuja ni se apunta.
  for (const c of kids) assert.ok(g.buried[m.nodes[c].children[0]]);
  const a = g.arcs[kids[2]];
  const [x, y] = polarPoint(g.cx, g.cy, (a.r0 + a.r1) / 2, (a.a0 + a.a1) / 2);
  assert.equal(hitArc(m, g, x, y), kids[2]);
  const d = sunburst.draw(context(ps, 300, 300));
  const paths = d.match(/<path/g)!.length;
  // Grande, g, g1, Chico, cGrande, cGrande1 y una sola banda para los seis diminutos.
  assert.equal(paths, 7);
  assert.ok(!d.includes('>c0<'));
});

test('colores: cada rama con su color en orden, más de 8 en gris, nunca cíclico', () => {
  const m = model(VENTAS);
  assert.deepEqual(
    m.roots.map((r) => m.nodes[r].slot),
    [0, 1, 2],
  );
  for (const node of m.nodes) assert.equal(node.slot, m.nodes[node.branch].slot);
  const many = buildHierarchy(
    Array.from({ length: 11 }, (_, k) => [`R${k}`, 'x']),
    Array.from({ length: 11 }, (_, k) => 100 - k),
  );
  assert.deepEqual(
    many.roots.map((r) => many.nodes[r].slot),
    [0, 1, 2, 3, 4, 5, 6, -1, -1, -1, -1],
  );
  // Justo 8 ramas: las 8 con color.
  const eight = buildHierarchy(
    Array.from({ length: 8 }, (_, k) => [`R${k}`]),
    Array.from({ length: 8 }, () => 1),
  );
  assert.ok(eight.roots.every((r) => eight.nodes[r].slot >= 0));
  // Una paleta de 3 con 4 ramas: dos colores y dos en gris (nunca un "Otros" de una).
  const short = buildHierarchy([['a'], ['b'], ['c'], ['d']], [4, 3, 2, 1], 3);
  assert.deepEqual(
    short.roots.map((r) => short.nodes[r].slot),
    [0, 1, -1, -1],
  );
  assert.equal(nodeColor(0, 0, LIGHT), LIGHT.palette[0]);
  assert.equal(nodeColor(-1, 0, DARK), DARK.other);
  // Por nivel, hacia la superficie: más claro en claro, más oscuro en oscuro.
  const L = (c: string) => wcag(parseColor(c)!, parseColor(LIGHT.surface)!);
  assert.ok(L(nodeColor(0, 1, LIGHT)) < L(nodeColor(0, 0, LIGHT)));
  assert.ok(L(nodeColor(0, 2, LIGHT)) < L(nodeColor(0, 1, LIGHT)));
  const D = (c: string) => wcag(parseColor(c)!, parseColor(DARK.surface)!);
  assert.ok(D(nodeColor(0, 1, DARK)) < D(nodeColor(0, 0, DARK)));
  // Con un tope: un nivel muy profundo no se funde con la superficie.
  assert.equal(nodeColor(2, 9, LIGHT), nodeColor(2, 12, LIGHT));
  assert.ok(D(nodeColor(5, 9, DARK)) > 1.5);
});

test('texto sobre relleno: la tinta llega a 4,5:1 en todos los colores y niveles (salvo el violeta del oscuro)', () => {
  const ps = series(VENTAS);
  for (const theme of [LIGHT, DARK]) {
    const d = sunburst.draw(context(ps, 520, 520, ps.values, theme));
    const m = model(VENTAS);
    for (const node of m.nodes) {
      const fill = nodeColor(node.slot, node.depth, theme);
      const re = new RegExp(`fill="(#[0-9a-f]{6})"[^>]*>${node.name}<`);
      const hit = re.exec(d);
      if (!hit) continue;
      const ratio = wcag(parseColor(fill)!, parseColor(hit[1])!);
      assert.ok(ratio >= 4.5 || (theme === DARK && node.slot === 0 && ratio >= 4), `${node.name}: ${ratio}`);
    }
  }
});

test('etiquetas: tangenciales si el arco es ancho, radiales si es angosto; nunca de cabeza', () => {
  assert.equal(upright(0), 0);
  assert.equal(upright(135), -45);
  assert.equal(upright(180), 0);
  assert.equal(upright(270), 90);
  assert.equal(upright(-100), 80);
  const wide = { a0: START, a1: START + 1.2, r0: 80, r1: 130 };
  assert.ok(tangentialRoom(wide) > 60);
  const L = fitArcLabel(wide, 0, 0, 'América', measure)!;
  assert.equal(L.mode, 'tangential');
  assert.equal(L.text, 'América');
  const narrow = { a0: 0, a1: 0.12, r0: 150, r1: 230 };
  assert.ok(tangentialRoom(narrow) < measure('Monterrey'));
  const R = fitArcLabel(narrow, 0, 0, 'Monterrey', measure)!;
  assert.equal(R.mode, 'radial');
  assert.ok(R.rotate > -90 && R.rotate <= 90);
  // Un nombre largo se recorta; si no quedan 4 letras, no va.
  const cut = fitArcLabel(narrow, 0, 0, 'Ciudad de México y su zona metropolitana', measure)!;
  assert.ok(cut.text.endsWith('…') && cut.text.length >= 5);
  assert.equal(fitArcLabel({ a0: 0, a1: 0.02, r0: 150, r1: 170 }, 0, 0, 'Monterrey', measure), null);
  assert.equal(radialRoom({ a0: 0, a1: 0.02, r0: 150, r1: 230 }), 0);
  // Cada etiqueta queda dentro de su segmento: sus esquinas no salen del arco.
  const m = model(VENTAS);
  const g = layoutSunburst(m, values(VENTAS), 520, 520);
  for (let id = 0; id < m.nodes.length; id++) {
    const arc = g.arcs[id];
    const lab = fitArcLabel(arc, g.cx, g.cy, m.nodes[id].name, measure);
    if (!lab) continue;
    const w = measure(lab.text) * 1.05;
    const rad = (lab.rotate * Math.PI) / 180;
    for (const [u, v] of [
      [-w / 2, -7],
      [w / 2, -7],
      [-w / 2, 7],
      [w / 2, 7],
    ]) {
      const x = lab.x + u * Math.cos(rad) - v * Math.sin(rad) - g.cx;
      const y = lab.y + u * Math.sin(rad) + v * Math.cos(rad) - g.cy;
      const r = Math.hypot(x, y);
      let a = Math.atan2(y, x);
      while (a < arc.a0) a += TAU;
      assert.ok(r >= arc.r0 - 0.5 && r <= arc.r1 + 0.5, `${m.nodes[id].name} radio`);
      assert.ok(a <= arc.a1 + 1e-6, `${m.nodes[id].name} ángulo`);
    }
  }
});

test('dibujo: segmentos con aire de superficie, total al centro, textos escapados y labels: false', () => {
  const ps = series(VENTAS);
  const d = sunburst.draw(context(ps));
  const m = model(VENTAS);
  assert.equal(d.match(/<path/g)!.length, m.nodes.length);
  assert.ok(d.includes(`stroke="${LIGHT.surface}" stroke-width="2"`));
  assert.ok(d.includes('>1140<') && d.includes('>Total<'));
  assert.ok(d.includes('>América<'));
  const rows: Row[] = [['<b>Tienda & "más"</b>', 'x', 'y', 10]];
  const esc = sunburst.draw(context(series(rows), 800, 800));
  assert.ok(esc.includes('&lt;b&gt;Tienda &amp; &quot;más&quot;&lt;/b&gt;'));
  assert.ok(!esc.includes('<b>'));
  const off = sunburst.draw(context(series(VENTAS, { labels: false })));
  assert.ok(off.includes('<path'));
  // Sin etiquetas en los segmentos; el total del centro sigue.
  assert.ok(!off.includes('>América<') && off.includes('>Total<'));
  const dark = sunburst.draw(context(ps, 480, 480, ps.values, DARK));
  assert.ok(dark.includes(DARK.palette[0]) && dark.includes(`stroke="${DARK.surface}"`));
  assert.ok(!dark.includes(LIGHT.palette[0]));
  // Un área diminuta no dibuja nada que se salga.
  assert.equal(sunburst.draw(context(ps, 2, 2)), '');
});

test('hover: la ruta hasta la raíz sobre un velo y el nodo enfocado en el centro', () => {
  const ps = series(VENTAS);
  const ctx = context(ps);
  const m = model(VENTAS);
  const h = sunburst.hover!(ctx, 0);
  assert.ok(h.includes('fill-opacity="0.62"'));
  // Monterrey, México y América: tres segmentos más el contorno del activo.
  assert.equal(h.match(/<path/g)!.length, 4);
  assert.ok(h.includes('>120<') && h.includes('>Monterrey<'));
  const america = refOf(m, byName(m, 'América'));
  const hr = sunburst.hover!(ctx, america);
  assert.equal(hr.match(/<path/g)!.length, 2);
  assert.ok(hr.includes('>690<'));
  assert.equal(sunburst.hover!(ctx, 999), '');
});

test('encabezado, tooltip y teclado, sin esperar al primer dibujo', () => {
  const ps = series(VENTAS);
  const m = model(VENTAS);
  assert.equal(sunburst.headline!(ps, 0, 'Monterrey'), 'América › México › Monterrey');
  const mx = refOf(m, byName(m, 'México'));
  assert.equal(sunburst.headline!(ps, mx, ''), 'América › México');
  assert.deepEqual(sunburst.tooltip!(ps, 0, format), {
    value: '120',
    details: [
      ['De México', '23.5 %'],
      ['Del total', '10.5 %'],
    ],
  });
  const america = refOf(m, byName(m, 'América'));
  assert.deepEqual(sunburst.tooltip!(ps, america, format), { value: '690', details: [['Del total', '60.5 %']] });
  // El teclado recorre en preorden y cubre todos los nodos.
  const order = sunburst.navigable!(ps);
  assert.equal(order.length, m.nodes.length);
  assert.deepEqual(
    order.map((i) => m.nodes[nodeOfRef(m, i)].name),
    m.order.map((id) => m.nodes[id].name),
  );
  // Arriba al padre, abajo al hijo mayor; en una hoja o en la raíz, el recorrido lineal.
  assert.equal(sunburst.step!(ps, 0, 'ArrowUp'), mx);
  assert.equal(sunburst.step!(ps, mx, 'ArrowDown'), 1);
  assert.equal(sunburst.step!(ps, 0, 'ArrowDown'), undefined);
  assert.equal(sunburst.step!(ps, america, 'ArrowUp'), undefined);
  assert.equal(sunburst.step!(ps, 0, 'ArrowRight'), undefined);
});

test('tooltip de filas que no se dibujan o que son parte de un nodo', () => {
  const rows: Row[] = [
    ['A', 'x', 'y', 10],
    ['A', 'x', 'z', 0],
    ['', '', '', 5],
    ['A', 'x', 'y', 30],
    ['B', '', '', 20],
  ];
  const ps = series(rows);
  ps.values[4] = NaN;
  assert.deepEqual(sunburst.tooltip!(ps, 1, format), { value: '0', details: [['No aparece', 'vale cero o menos']] });
  assert.deepEqual(sunburst.tooltip!(ps, 2, format), { value: '5', details: [['No aparece', 'le falta la ruta']] });
  assert.equal(sunburst.tooltip!(ps, 4, format), null);
  // Dos filas con la misma ruta: cada una dice su parte del nodo.
  assert.deepEqual(sunburst.tooltip!(ps, 0, format), {
    value: '10',
    details: [
      ['De y', '25 %'],
      ['Del total', '25 %'],
    ],
  });
  assert.equal(sunburst.headline!(ps, 2, 'fila 3'), 'fila 3');
  assert.equal(sunburst.headline!(ps, 0, ''), 'A › x › y');
});

test('muestra del tooltip: el color del segmento, también en los nodos interiores', () => {
  const m = model(VENTAS);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(series(VENTAS), 480, 480, undefined, theme);
    m.nodes.forEach((node, id) => {
      const ref = refOf(m, id);
      const swatch = sunburst.swatch!(ctx, ref);
      assert.equal(swatch, nodeColor(node.slot, node.depth, theme), node.name);
      assert.ok(sunburst.hover!(ctx, ref).includes(`fill="${swatch}"`), `${node.name} en ${swatch}`);
    });
  }
  // Cada rama con su color y, dentro de ella, aclarado por nivel.
  const ctx = context(series(VENTAS));
  const at = (name: string) => sunburst.swatch!(ctx, refOf(m, byName(m, name)));
  assert.notEqual(at('América'), at('Europa'));
  assert.notEqual(at('Europa'), at('Madrid'));
  assert.equal(at('España'), sunburst.swatch!(ctx, VENTAS.length + byName(m, 'España')));
  // Una fila que no se dibuja no tiene color propio.
  const rows: Row[] = [...VENTAS, ['Asia', 'Corea', 'Seúl', 0]];
  assert.equal(sunburst.swatch!(context(series(rows)), rows.length - 1), null);
});
