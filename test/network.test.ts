import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNetwork,
  fitPositions,
  forceLayout,
  hitNode,
  iterationsFor,
  layoutNetwork,
  legendLayout,
  linkWidth,
  matchRows,
  maxRadius,
  network,
  nodeStops,
  placeLabels,
  radiusOf,
  weightOf,
} from '../src/series/network';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

type Row = [from: string, to: string, value: number, group: string];

/** Mensajes por semana entre personas de tres equipos. */
const TEAM: Row[] = [
  ['Ana', 'Luis', 8, 'Diseño'],
  ['Ana', 'Marta', 5, 'Diseño'],
  ['Luis', 'Marta', 3, 'Diseño'],
  ['Pedro', 'Ana', 2, 'Datos'],
  ['Pedro', 'Sofía', 9, 'Datos'],
  ['Sofía', 'Pedro', 1, 'Datos'],
  ['Tomás', '', NaN, 'Ventas'],
];

const cols = (rows: Row[]) => ({
  from: rows.map((r) => r[0]),
  to: rows.map((r) => r[1]),
  values: rows.map((r) => r[2]),
  group: rows.map((r) => r[3]),
});

function model(rows: Row[]) {
  const c = cols(rows);
  return buildNetwork(c.from, c.to, c.values, c.group);
}

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  const c = cols(rows);
  return {
    key: 'Mensajes',
    name: 'Mensajes',
    impl: network,
    slot: 0,
    options: { type: 'network', field: 'v', to: 'to', group: 'g', ...extra },
    values: c.values,
    columns: {},
    texts: { from: c.from, to: c.to, group: c.group },
    stackKey: null,
    axis: 'left',
  };
}

function context(ps: PreparedSeries, rows: Row[], width = 640, height = 360, y1 = ps.values, theme = LIGHT): DrawContext {
  const n = rows.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#2a78d6',
    pointColor: () => '#2a78d6',
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => rows[i][0],
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

const dist = (g: { x: Float64Array; y: Float64Array }, a: number, b: number) => Math.hypot(g.x[a] - g.x[b], g.y[a] - g.y[b]);

test('peso de una fila: un hueco vale 1; cero, negativo o infinito no se dibuja', () => {
  assert.equal(weightOf(NaN), 1);
  assert.equal(weightOf(2.5), 2.5);
  assert.ok(Number.isNaN(weightOf(0)));
  assert.ok(Number.isNaN(weightOf(-1)));
  assert.ok(Number.isNaN(weightOf(Infinity)));
});

test('modelo: nodos por aparición, vínculos sin dirección y sus pesos sumados', () => {
  const m = model(TEAM);
  assert.deepEqual(m.names, ['Ana', 'Luis', 'Marta', 'Pedro', 'Sofía', 'Tomás']);
  // Pedro → Sofía y Sofía → Pedro son el mismo vínculo.
  assert.equal(m.links.length, 5);
  assert.deepEqual(m.rowLink, [0, 1, 2, 3, 4, 4, -1]);
  assert.deepEqual(m.links[4], { source: 3, target: 4, weight: 10, rows: [4, 5] });
  assert.deepEqual(m.degree, [15, 11, 8, 12, 10, 0]);
  assert.deepEqual(m.count, [3, 2, 2, 2, 1, 0]);
  assert.deepEqual(
    m.neighbors[0].map((nb) => m.names[nb.node]),
    ['Luis', 'Marta', 'Pedro'],
  );
  assert.deepEqual(m.order, [0, 3, 1, 4, 2, 5]);
  assert.equal(m.weighted, true);
  assert.deepEqual(m.ignored, []);
});

test('modelo: ceros, negativos, orígenes vacíos y bucles se ignoran; sin pesos se cuentan vínculos', () => {
  const m = buildNetwork(['A', 'A', '', 'B', 'A'], ['B', 'C', 'D', 'B', 'D'], [1, 0, 3, 2, -1]);
  assert.deepEqual(m.names, ['A', 'B']);
  assert.equal(m.links.length, 1);
  assert.deepEqual(m.ignored, [1, 2, 3, 4]);
  const plain = buildNetwork(['A', 'A', 'B'], ['B', 'C', 'C'], [NaN, NaN, NaN]);
  assert.equal(plain.weighted, false);
  assert.deepEqual(plain.degree, [2, 2, 2]);
});

test('grupos: el del origen, por primera aparición; sin grupo o pasado el tope, el gris', () => {
  const m = model(TEAM);
  assert.deepEqual(m.groups, ['Diseño', 'Datos', 'Ventas']);
  // Marta nunca es origen: no tiene grupo.
  assert.deepEqual(m.slots, [0, 0, -1, 1, 1, 2]);
  const many = Array.from({ length: 10 }, (_, k) => `G${k}`);
  const mm = buildNetwork(
    many.map((_, k) => `N${k}`),
    many.map(() => ''),
    many.map(() => NaN),
    many,
  );
  assert.deepEqual(mm.slots, [0, 1, 2, 3, 4, 5, 6, 7, -1, -1]);
  // Sin `group`, todos con el color de la serie.
  assert.deepEqual(buildNetwork(['A'], ['B'], [1]).slots, [0, 0]);
});

test('emparejamiento: cada nodo con una fila; en un árbol queda fuera el menos conectado', () => {
  const m = model(TEAM);
  assert.deepEqual(m.nodeRow, [0, 2, 1, 4, 5, 6]);
  assert.deepEqual(m.rowNode, [0, 2, 1, -1, 3, 4, 5]);
  // Estrella A–B, A–C: dos filas para tres nodos. A cede su primera fila a B; C se queda sin.
  const star = buildNetwork(['A', 'A'], ['B', 'C'], [2, 1]);
  assert.deepEqual(star.nodeRow, [1, 0, -1]);
  // Un camino de aumento: el segundo nodo desplaza al primero a su otra fila.
  assert.deepEqual(matchRows(2, 2, [[0, 1], [0]], [0, 1]), { rowNode: [1, 0], nodeRow: [1, 0] });
});

test('teclado: los nodos con fila, del más conectado al menos', () => {
  const m = model(TEAM);
  assert.deepEqual(nodeStops(m), [0, 4, 2, 5, 1, 6]);
  assert.deepEqual(network.navigable!(series(TEAM)), nodeStops(m));
});

test('layout: determinista, dentro del área y los vecinos más cerca que los extraños', () => {
  const m = model(TEAM);
  const a = forceLayout(m.names.length, m.links, 640, 360);
  const b = forceLayout(m.names.length, m.links, 640, 360);
  assert.deepEqual(a, b);
  // Ana y Luis están unidos; Luis y Sofía, no.
  assert.ok(dist(a, 0, 1) < dist(a, 1, 4));
  assert.deepEqual(forceLayout(0, [], 640, 360), { x: new Float64Array(0), y: new Float64Array(0) });
  const one = forceLayout(1, [], 640, 360);
  assert.deepEqual([one.x[0], one.y[0]], [320, 180]);
});

test('iteraciones: el tope fijo con pocos nodos, menos con muchos, nunca bajo el mínimo', () => {
  assert.equal(iterationsFor(10), 300);
  assert.equal(iterationsFor(1000), 120);
  assert.equal(iterationsFor(100_000), 60);
});

test('ajuste: escala única y centrado, dejando el borde', () => {
  const x = Float64Array.from([0, 10, 20]);
  const y = Float64Array.from([0, 5, 10]);
  fitPositions(x, y, 200, 200, 10);
  assert.deepEqual([...x], [10, 100, 190]);
  // La misma escala en los dos ejes: la red no se deforma.
  assert.deepEqual([...y], [55, 100, 145]);
  const p = Float64Array.from([5]);
  const q = Float64Array.from([5]);
  fitPositions(p, q, 100, 60, 10);
  assert.deepEqual([p[0], q[0]], [50, 30]);
});

test('geometría: nodos dentro del área, debajo de la leyenda y sin encimarse', () => {
  const m = model(TEAM);
  const g = layoutNetwork(m, 640, 360, measure);
  assert.ok(g.top > 0, 'tres grupos: hay leyenda');
  for (let v = 0; v < m.names.length; v++) {
    assert.ok(g.x[v] - g.r[v] >= -1e-6 && g.x[v] + g.r[v] <= 640 + 1e-6, m.names[v]);
    assert.ok(g.y[v] - g.r[v] >= g.top - 1e-6 && g.y[v] + g.r[v] <= 360 + 1e-6, m.names[v]);
    for (let u = v + 1; u < m.names.length; u++) assert.ok(dist(g, u, v) >= g.r[u] + g.r[v], `${m.names[u]} y ${m.names[v]}`);
  }
});

test('radios: el área según el grado, con un mínimo y un tope por el espacio', () => {
  assert.equal(radiusOf(0, 10, 18), 3);
  assert.equal(radiusOf(10, 10, 18), 18);
  assert.equal(radiusOf(2.5, 10, 18), 9);
  assert.equal(maxRadius(1, 1000, 1000), 18);
  assert.equal(maxRadius(10_000, 100, 100), 4.5);
  assert.equal(maxRadius(0, 100, 100), 0);
});

test('leyenda: solo con dos o más grupos; "Sin grupo" al final y hasta tres filas', () => {
  assert.deepEqual(legendLayout(buildNetwork(['A'], ['B'], [1], ['X']), 640, measure), { items: [], height: 0 });
  const m = model(TEAM);
  const wide = legendLayout(m, 640, measure);
  assert.deepEqual(
    wide.items.map((i) => i.name),
    ['Diseño', 'Datos', 'Ventas', 'Sin grupo'],
  );
  assert.deepEqual(
    wide.items.map((i) => i.slot),
    [0, 1, 2, -1],
  );
  assert.ok(wide.items.every((i) => i.y === wide.items[0].y));
  const narrow = legendLayout(m, 80, measure);
  assert.ok(narrow.items.length === 3 && narrow.height > wide.height);
});

test('etiquetas: a la derecha o a la izquierda, nunca encimadas, y se omite la que no cabe', () => {
  const g = { x: Float64Array.from([50, 50, 196]), y: Float64Array.from([50, 58, 50]), r: [3, 3, 3] };
  const labels = placeLabels(['Uno', 'Dos', 'Tres'], g, [0, 1, 2], [0, 1, 2], 200, 100, measure);
  assert.deepEqual(
    labels.map((l) => [l.text, l.anchor]),
    [
      ['Uno', 'start'],
      ['Dos', 'end'],
      ['Tres', 'end'],
    ],
  );
  // En 60 px "Uno" ya no cabe a la derecha y pasa a la izquierda: "Dos" no tiene lugar y se omite.
  const tight = placeLabels(['Uno', 'Dos'], g, [0, 1], [0, 1], 60, 100, measure);
  assert.deepEqual(
    tight.map((l) => [l.text, l.anchor]),
    [['Uno', 'end']],
  );
  assert.equal(placeLabels(['Uno', 'Dos', 'Tres'], g, [0, 1, 2], [], 200, 100, measure, 1).length, 1);
});

test('puntero: dentro gana el nodo chico; cerca, el más próximo; lejos, ninguno', () => {
  const g = { x: Float64Array.from([100, 108, 200]), y: Float64Array.from([100, 100, 100]), r: [15, 4, 3] };
  assert.equal(hitNode(g, 108, 100), 1);
  assert.equal(hitNode(g, 92, 100), 0);
  assert.equal(hitNode(g, 207, 100), 2, 'a 4 px del borde de un nodo de 3 px');
  assert.equal(hitNode(g, 300, 300), -1);
});

test('dibujo: vínculos, nodos y leyenda con los colores del tema', () => {
  const ps = series(TEAM);
  const d = network.draw(context(ps, TEAM));
  assert.equal(d.match(/<line/g)?.length, 5);
  // Seis nodos y cuatro puntos de leyenda.
  assert.equal(d.match(/<circle/g)?.length, 10);
  assert.ok(d.includes(`fill="${LIGHT.palette[0]}"`));
  assert.ok(d.includes(`fill="${LIGHT.other}"`), 'Marta, sin grupo, en gris');
  assert.ok(d.includes('stroke-opacity="0.28"'));
  assert.ok(network.draw(context(ps, TEAM, 640, 360, undefined, DARK)).includes('stroke-opacity="0.34"'));
  assert.equal(network.draw(context(ps, TEAM, 0, 360)), '');
});

test('animación: en el primer cuadro no hay vínculos ni nodos con peso, solo los sueltos', () => {
  const ps = series(TEAM);
  const d = network.draw(
    context(
      ps,
      TEAM,
      640,
      360,
      ps.values.map(() => 0),
    ),
  );
  assert.ok(!d.includes('<line'));
  // Tomás (sin vínculos) y los cuatro puntos de la leyenda.
  assert.equal(d.match(/<circle/g)?.length, 5);
  assert.equal(linkWidth(0, 10, true), 0);
  assert.equal(linkWidth(10, 10, true), 3);
  assert.equal(linkWidth(3, 10, false), 1);
});

test('hit, anchor y hover hablan de nodos', () => {
  const ps = series(TEAM);
  const ctx = context(ps, TEAM);
  network.draw(ctx);
  const [x, y] = network.anchor!(ctx, 4)!;
  assert.equal(network.hit!(ctx, x, y + 1), 4);
  assert.equal(network.anchor!(ctx, 3), null, 'la fila Pedro → Ana no representa a ningún nodo');
  const h = network.hover!(ctx, 4);
  assert.ok(h.includes('fill-opacity="0.6"') && h.includes('stroke-opacity="0.75"'));
  assert.equal(network.hover!(ctx, 3), '');
});

test('textos escapados y opción labels: false', () => {
  const rows: Row[] = [['<b>Ana & "Luis"</b>', 'Marta', 1, '']];
  const d = network.draw(context(series(rows), rows));
  assert.ok(d.includes('&lt;b&gt;Ana &amp; &quot;Luis&quot;&lt;/b&gt;'));
  assert.ok(!d.includes('<b>'));
  const off = network.draw(context(series(TEAM, { labels: false }), TEAM));
  assert.ok(off.includes('<circle') && !off.includes('>Ana<'));
});

test('encabezado y tooltip, sin esperar al primer dibujo', () => {
  assert.deepEqual(network.texts!({ type: 'network', field: 'v', to: 'destino', group: 'equipo' }, 'origen'), {
    from: 'origen',
    to: 'destino',
    group: 'equipo',
  });
  const ps = series(TEAM);
  assert.equal(network.headline!(ps, 4, 'Pedro'), 'Pedro');
  assert.equal(network.headline!(ps, 3, 'Pedro'), 'Pedro — Ana');
  assert.deepEqual(network.tooltip!(ps, 4, format), {
    value: '12',
    details: [
      ['Vínculos', '2'],
      ['Vecinos', 'Sofía (10), Ana (2)'],
      ['Grupo', 'Datos'],
    ],
  });
  assert.deepEqual(network.tooltip!(ps, 3, format), { value: '2' });
  assert.deepEqual(network.tooltip!(ps, 6, format), {
    value: '0',
    details: [
      ['Vínculos', '0'],
      ['Vecinos', 'ninguno'],
      ['Grupo', 'Ventas'],
    ],
  });
});

test('tooltip: más de tres vecinos se resumen', () => {
  const rows: Row[] = ['B', 'C', 'D', 'E', 'F'].map((t, k) => ['A', t, 5 - k, '']);
  const t = network.tooltip!(series(rows), model(rows).nodeRow[0], format)!;
  assert.deepEqual(t.details?.[1], ['Vecinos principales', 'B (5), C (4), D (3) y 2 más']);
});

test('muestra del tooltip: el color del grupo del nodo, el mismo del círculo', () => {
  const m = model(TEAM);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(series(TEAM), TEAM, 640, 360, undefined, theme);
    m.nodeRow.forEach((i, v) => {
      if (i < 0) return;
      const swatch = network.swatch!(ctx, i);
      assert.equal(swatch, m.slots[v] >= 0 ? theme.palette[m.slots[v]] : theme.other);
      assert.ok(network.hover!(ctx, i).includes(`fill="${swatch}"`), `${m.names[v]} en ${swatch}`);
    });
  }
  // Dos equipos, dos muestras distintas.
  const ctx = context(series(TEAM), TEAM);
  const row = (name: string) => m.nodeRow[m.names.indexOf(name)];
  assert.notEqual(network.swatch!(ctx, row('Ana')), network.swatch!(ctx, row('Pedro')));
  // Sin grupos, todos en el color de la serie.
  const plain = TEAM.map(([a, b, v]): Row => [a, b, v, '']);
  const pm = model(plain);
  const pc = context(series(plain), plain);
  for (const i of pm.nodeRow) if (i >= 0) assert.equal(network.swatch!(pc, i), pc.color);
});
