import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARC_WIDTH,
  START,
  TARGET_GAP,
  arcGap,
  arcPath,
  buildGraph,
  buildModel,
  chord,
  chordRadius,
  hitChord,
  layoutChord,
  linkOrder,
  nodeSlots,
  nodeStep,
  nodeTotals,
  orderEnds,
  placeLabels,
  ribbonAnchor,
  ribbonPath,
} from '../src/series/chord';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';
import { polarPoint } from '../src/core/shapes';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;
const TAU = 2 * Math.PI;

type Row = [from: string, to: string, value: number];

/** Migración entre regiones (miles de personas), con ida y vuelta. */
const MIGRA: Row[] = [
  ['Norte', 'Centro', 120],
  ['Norte', 'Sur', 40],
  ['Centro', 'Norte', 60],
  ['Centro', 'Sur', 90],
  ['Sur', 'Centro', 150],
  ['Sur', 'Costa', 30],
  ['Costa', 'Norte', 20],
];

const cols = (rows: Row[]) => ({
  from: rows.map((r) => r[0]),
  to: rows.map((r) => r[1]),
  values: rows.map((r) => r[2]),
});

function model(rows: Row[]) {
  const c = cols(rows);
  return buildModel(c.from, c.to, c.values);
}

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  const c = cols(rows);
  return {
    key: 'Personas',
    name: 'Personas',
    impl: chord,
    slot: 0,
    options: { type: 'chord', field: 'v', to: 'to', ...extra },
    values: c.values,
    columns: {},
    texts: { to: c.to, from: c.from },
    stackKey: null,
    axis: 'left',
  };
}

function context(ps: PreparedSeries, rows: Row[], width = 640, height = 360, y1 = ps.values, theme = LIGHT): DrawContext {
  const n = rows.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#5e2dad',
    pointColor: () => '#5e2dad',
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

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('grafo: nodos por primera aparición; ceros, negativos, NaN, vacíos y bucles se ignoran', () => {
  const g = buildGraph(
    ['A', 'A', 'B', '', 'C', 'C', 'B', 'D'],
    ['B', 'C', 'D', 'D', 'C', 'D', 'D', 'A'],
    [5, 0, NaN, 3, 4, -2, 7, Infinity],
  );
  assert.deepEqual(g.names, ['A', 'B', 'D']);
  assert.deepEqual(
    g.links.map((l) => l.index),
    [0, 6],
  );
  assert.deepEqual(g.ignored, [1, 2, 3, 5, 7]);
  assert.deepEqual(g.loops, [4]);
  // Ida y vuelta son dos flujos distintos: la dirección importa.
  const both = buildGraph(['A', 'B'], ['B', 'A'], [3, 1]);
  assert.equal(both.links.length, 2);
  // Sin ningún flujo válido no hay nada que dibujar.
  const rows: Row[] = [['A', 'B', 0]];
  assert.equal(buildModel(['A'], ['B'], [0]).links.length, 0);
  assert.equal(chord.draw(context(series(rows), rows)), '');
});

test('largo del nodo: lo que sale más lo que entra', () => {
  const m = model(MIGRA);
  const at = (name: string) => m.names.indexOf(name);
  assert.deepEqual(m.names, ['Norte', 'Centro', 'Sur', 'Costa']);
  assert.equal(m.outflow[at('Norte')], 160);
  assert.equal(m.inflow[at('Norte')], 80);
  assert.equal(m.value[at('Norte')], 240);
  assert.equal(m.value[at('Costa')], 50);
  const { value } = nodeTotals(2, [{ index: 0, source: 0, target: 1, value: 3 }], () => 1);
  assert.deepEqual(value, [1, 1]);
});

test('geometría: los arcos suman la vuelta menos los huecos, en orden y sin encimarse', () => {
  const m = model(MIGRA);
  const g = layoutChord(m, cols(MIGRA).values, 640, 360, 160);
  assert.equal(g.outer, 160);
  assert.equal(g.inner, 160 - ARC_WIDTH);
  assert.equal(g.cx, 320);
  assert.equal(g.cy, 180);
  const sum = g.arcs.reduce((s, a) => s + a.a1 - a.a0, 0);
  assert.ok(near(sum, TAU - m.names.length * g.gap));
  // Empieza arriba (con medio hueco) y avanza en sentido horario, con un hueco entre vecinos.
  assert.ok(near(g.arcs[0].a0, START + g.gap / 2));
  for (let v = 1; v < g.arcs.length; v++) assert.ok(near(g.arcs[v].a0 - g.arcs[v - 1].a1, g.gap));
  assert.ok(near(g.arcs[g.arcs.length - 1].a1, START + TAU - g.gap / 2));
  // Cada arco mide en proporción a su valor.
  const k = (g.arcs[0].a1 - g.arcs[0].a0) / m.value[0];
  g.arcs.forEach((a, v) => assert.ok(near(a.a1 - a.a0, m.value[v] * k)));
});

test('geometría: los extremos de cada cinta caben en su arco y lo llenan sin huecos', () => {
  const m = model(MIGRA);
  const g = layoutChord(m, cols(MIGRA).values, 640, 360, 160);
  for (let v = 0; v < m.names.length; v++) {
    let at = g.arcs[v].a0;
    for (const e of m.ends[v]) {
      const r = g.byRow.get(e.link.index)!;
      const [a0, a1] = e.out ? [r.s0, r.s1] : [r.t0, r.t1];
      assert.ok(near(a0, at), m.names[v]);
      assert.ok(a1 <= g.arcs[v].a1 + 1e-9);
      at = a1;
    }
    assert.ok(near(at, g.arcs[v].a1), `${m.names[v]} se llena`);
  }
  // Los dos extremos de una cinta miden lo mismo: su valor.
  for (const r of g.ribbons) {
    assert.ok(near(r.s1 - r.s0, r.t1 - r.t0));
    assert.ok(near(r.s1 - r.s0, m.byRow.get(r.index)!.value * g.k));
  }
  // Las gruesas se dibujan primero.
  for (let j = 1; j < g.ribbons.length; j++)
    assert.ok(g.ribbons[j].s1 - g.ribbons[j].s0 <= g.ribbons[j - 1].s1 - g.ribbons[j - 1].s0);
});

test('extremos: ordenados por la posición del otro nodo; ida y vuelta anidadas', () => {
  // Cuatro nodos repartidos en cruz: arriba (0), derecha (1), abajo (2), izquierda (3).
  const center = [START, START + TAU / 4, START + TAU / 2, START + (3 * TAU) / 4];
  const links = [
    { index: 0, source: 0, target: 1, value: 1 },
    { index: 1, source: 0, target: 3, value: 1 },
    { index: 2, source: 0, target: 2, value: 1 },
    { index: 3, source: 1, target: 0, value: 1 },
  ];
  const ends = orderEnds(4, links, center);
  // En el arco de arriba: primero la izquierda (antihorario), luego abajo, al final la derecha;
  // con la derecha hay ida y vuelta: la salida antes que la llegada.
  assert.deepEqual(
    ends[0].map((e) => [e.link.index, e.out]),
    [
      [1, true],
      [2, true],
      [0, true],
      [3, false],
    ],
  );
  // Y en el de la derecha, la misma regla: la salida (vuelta) antes que la llegada (ida).
  assert.deepEqual(
    ends[1].map((e) => [e.link.index, e.out]),
    [
      [3, true],
      [0, false],
    ],
  );
  // Las dos cintas no se cruzan: la que empieza antes en un arco termina después en el otro.
  const m = buildModel(['A', 'B'], ['B', 'A'], [3, 1]);
  const g = layoutChord(m, [3, 1], 400, 400, 150);
  const ida = g.byRow.get(0)!;
  const vuelta = g.byRow.get(1)!;
  assert.ok(ida.s0 < vuelta.t0, 'en A, la ida primero');
  assert.ok(vuelta.s0 < ida.t0, 'en B, la vuelta primero');
});

test('animación: los arcos crecen en su lugar con la misma escala', () => {
  const m = model(MIGRA);
  const values = cols(MIGRA).values;
  const full = layoutChord(m, values, 640, 360, 160);
  const half = layoutChord(
    m,
    values.map((v) => v / 2),
    640,
    360,
    160,
  );
  assert.equal(half.k, full.k);
  for (let v = 0; v < m.names.length; v++) {
    const mid = (a: { a0: number; a1: number }) => (a.a0 + a.a1) / 2;
    assert.ok(near(mid(half.arcs[v]), mid(full.arcs[v])), 'mismo centro');
    assert.ok(near(half.arcs[v].a1 - half.arcs[v].a0, (full.arcs[v].a1 - full.arcs[v].a0) / 2));
  }
  // En cero (primer cuadro) no hay largo, ni NaN, ni trazos.
  const zero = layoutChord(
    m,
    values.map(() => 0),
    640,
    360,
    160,
  );
  assert.ok(zero.arcs.every((a) => a.a0 === a.a1 && isFinite(a.a0)));
  assert.ok(zero.ribbons.every((r) => ribbonPath(zero, r) === ''));
  // Datos que crecen: la escala de los actuales manda y los arcos no se pisan.
  const big = layoutChord(
    m,
    values.map((v, i) => (i === 0 ? v * 5 : v)),
    640,
    360,
    160,
  );
  for (let v = 1; v < big.arcs.length; v++) assert.ok(big.arcs[v].a0 >= big.arcs[v - 1].a1 + big.gap - 1e-9);
  assert.ok(big.arcs[big.arcs.length - 1].a1 <= START + TAU - big.gap / 2 + 1e-9);
  // Un flujo con un valor raro en un cuadro (NaN) cuenta como cero.
  const odd = layoutChord(m, [NaN, ...values.slice(1)], 640, 360, 160);
  assert.ok(odd.arcs.every((a) => isFinite(a.a0) && isFinite(a.a1)));
});

test('huecos: px fijos sobre el radio, y nunca más de un cuarto de la vuelta', () => {
  assert.equal(arcGap(1, 100), 0);
  assert.equal(arcGap(4, 0), 0);
  assert.ok(near(arcGap(4, 100), 0.05));
  assert.ok(near(arcGap(200, 100) * 200, TAU / 4));
});

test('trazos: sector de anillo y cinta con dos cuadráticas por el centro', () => {
  assert.equal(arcPath(0, 0, 90, 100, 0, Math.PI / 2), 'M100,0A100,100 0 0 1 0,100L0,90A90,90 0 0 0 90,0Z');
  assert.ok(arcPath(0, 0, 90, 100, 0, 4).includes(' 0 1 1 '), 'arco mayor que media vuelta');
  assert.equal(arcPath(0, 0, 90, 100, 1, 1), '');
  const m = buildModel(['A'], ['B'], [1]);
  const g = layoutChord(m, [1], 400, 400, 150);
  const d = ribbonPath(g, g.byRow.get(0)!);
  assert.equal((d.match(/Q200,200 /g) ?? []).length, 2);
  // El origen toca el arco (radio interior) y el destino queda TARGET_GAP más adentro.
  assert.ok(d.includes(`A${g.inner},${g.inner} `));
  assert.ok(d.includes(`A${g.inner - TARGET_GAP},${g.inner - TARGET_GAP} `));
});

test('un solo flujo: dos arcos casi de media vuelta y una cinta que los une', () => {
  const rows: Row[] = [['Prueba', 'Suscripción', 840]];
  const m = model(rows);
  const g = layoutChord(m, [840], 400, 400, 150);
  assert.ok(near(g.arcs[0].a1 - g.arcs[0].a0, Math.PI - g.gap));
  const d = chord.draw(context(series(rows), rows, 400, 300));
  assert.equal((d.match(/<path/g) ?? []).length, 3);
  assert.ok(d.includes('>Prueba<') && d.includes('>Suscripción<'));
});

test('hit: sobre el arco, el flujo cuyo extremo está bajo el puntero; dentro, la cinta', () => {
  const m = model(MIGRA);
  const g = layoutChord(m, cols(MIGRA).values, 640, 360, 160);
  const mid = (g.inner + g.outer) / 2;
  for (const r of g.ribbons) {
    const [sx, sy] = polarPoint(g.cx, g.cy, mid, (r.s0 + r.s1) / 2);
    assert.equal(hitChord(m, g, sx, sy), r.index, 'extremo de origen');
    const [tx, ty] = polarPoint(g.cx, g.cy, mid, (r.t0 + r.t1) / 2);
    assert.equal(hitChord(m, g, tx, ty), r.index, 'extremo de destino');
  }
  // En un hueco entre arcos, fuera del círculo o lejos de todo: nada.
  const [gx, gy] = polarPoint(g.cx, g.cy, mid, g.arcs[1].a0 - g.gap / 2);
  assert.equal(hitChord(m, g, gx, gy), -1);
  assert.equal(hitChord(m, g, 2, 2), -1);
  // Dentro, cerca de cada extremo de origen, la cinta de ese extremo.
  for (const r of g.ribbons) {
    const [x, y] = polarPoint(g.cx, g.cy, g.inner - 1, (r.s0 + r.s1) / 2);
    assert.equal(hitChord(m, g, x, y), r.index);
  }
});

test('hit: una cinta fina encima de una gruesa se alcanza; la gruesa, en el resto', () => {
  // A ↔ B gruesa y A → C fina: cerca del centro se enciman.
  const rows: Row[] = [
    ['A', 'B', 100],
    ['C', 'D', 100],
    ['A', 'C', 2],
  ];
  const m = model(rows);
  const g = layoutChord(m, cols(rows).values, 400, 400, 180);
  const thin = g.byRow.get(2)!;
  const [x, y] = ribbonAnchor(g, thin);
  assert.equal(hitChord(m, g, x, y), 2);
  const [sx, sy] = polarPoint(g.cx, g.cy, g.inner - 1, (thin.s0 + thin.s1) / 2);
  assert.equal(hitChord(m, g, sx, sy), 2);
});

test('hit, anchor y hover en el gráfico', () => {
  const ps = series(MIGRA);
  const ctx = context(ps, MIGRA);
  chord.draw(ctx);
  for (let i = 0; i < MIGRA.length; i++) {
    const [x, y] = chord.anchor!(ctx, i)!;
    assert.ok(x > 0 && x < 640 && y > 0 && y < 360);
  }
  const [x, y] = chord.anchor!(ctx, 4)!;
  assert.equal(chord.hit!(ctx, x, y), 4);
  const h = chord.hover!(ctx, 0);
  assert.ok(h.startsWith('<rect') && h.includes('fill-opacity="0.55"'), 'velo');
  assert.ok(h.includes('fill-opacity="0.65"') && h.includes('stroke-width="1"'), 'cinta activa');
  // La cinta activa y sus dos arcos (Norte y Centro), con sus colores.
  assert.equal((h.match(/<path/g) ?? []).length, 3);
  assert.ok(h.includes(`fill="${LIGHT.palette[0]}"`) && h.includes(`fill="${LIGHT.palette[1]}"`));
  assert.ok(!h.includes(`fill="${LIGHT.palette[2]}"`));
  assert.ok(h.includes('<text'), 'las etiquetas no se apagan');
  assert.equal(chord.hover!(ctx, 99), '');
});

test('colores: paleta en el orden de los arcos, nunca cíclica; las cintas, del origen', () => {
  assert.deepEqual(nodeSlots(10, 8), [0, 1, 2, 3, 4, 5, 6, 7, -1, -1]);
  assert.deepEqual(nodeSlots(2, 0), [-1, -1]);
  const d = chord.draw(context(series(MIGRA), MIGRA));
  // Sur → Centro: la cinta va en el color de Sur (tercero), al 35 %.
  assert.ok(d.includes(`fill="${LIGHT.palette[2]}" fill-opacity="0.35"`));
  // Centro solo recibe de Norte y de Sur, pero su arco lleva su propio color.
  assert.ok(d.includes(`fill="${LIGHT.palette[1]}"/>`));
  // Doce nodos: del noveno en adelante, el gris "otros", y ningún color se repite.
  const many: Row[] = Array.from({ length: 12 }, (_, k) => [`N${k}`, `N${(k + 1) % 12}`, 10 + k]);
  const dm = chord.draw(context(series(many), many));
  const fills = (dm.match(/<path d="M[^"]*" fill="[^"]*"\/>/g) ?? []).map((p) => p.match(/fill="([^"]*)"/)![1]);
  assert.equal(fills.length, 12);
  assert.deepEqual(fills.slice(0, 8), LIGHT.palette);
  assert.ok(fills.slice(8).every((f) => f === LIGHT.other));
  // Los textos van en el color del tema.
  const texts = d.match(/<text[^>]*>/g) ?? [];
  assert.ok(texts.length > 0 && texts.every((t) => !LIGHT.palette.some((c) => t.includes(c))));
});

test('tema oscuro: su paleta, su superficie en el halo y cintas al 38 %', () => {
  const d = chord.draw(context(series(MIGRA), MIGRA, 640, 360, undefined, DARK));
  assert.ok(d.includes(`fill="${DARK.palette[0]}" fill-opacity="0.38"`));
  assert.ok(d.includes(`stroke="${DARK.surface}"`) && d.includes(`fill="${DARK.text}"`));
  assert.ok(!LIGHT.palette.some((c) => d.includes(c)));
});

test('radio: deja lugar a las etiquetas, sin achicar el círculo de más', () => {
  const short = chordRadius(['A', 'B'], 640, 360, measure);
  assert.ok(short.labels);
  assert.equal(short.outer, 360 / 2 - 6 - 15, 'manda el alto');
  // Nombres larguísimos en un móvil: el círculo conserva el 60 % y los nombres se recortan.
  const long = chordRadius(['x'.repeat(80)], 358, 360, measure);
  assert.ok(near(long.outer, (358 / 2 - 2) * 0.6));
  // Sin etiquetas, o sin espacio para ellas, el círculo llena el área.
  assert.deepEqual(chordRadius(['A'], 640, 360, measure, false), { outer: 178, labels: false });
  assert.deepEqual(chordRadius(['A'], 120, 120, measure), { outer: 58, labels: false });
});

test('etiquetas: afuera, horizontales, recortadas con "…" y nunca encimadas', () => {
  const m = model(MIGRA);
  const fit = chordRadius(m.names, 640, 360, measure);
  const g = layoutChord(m, cols(MIGRA).values, 640, 360, fit.outer);
  const labels = placeLabels(m, g, 640, 360, measure);
  assert.equal(labels.length, 4);
  for (const L of labels) {
    const a = (g.arcs[L.node].a0 + g.arcs[L.node].a1) / 2;
    assert.ok(Math.hypot(L.x - g.cx, L.y - g.cy) > g.outer, 'por fuera del círculo');
    // El lado sigue al ángulo: a la derecha empieza en el punto, a la izquierda termina en él.
    if (L.anchor === 'start') assert.ok(Math.cos(a) > 0);
    if (L.anchor === 'end') assert.ok(Math.cos(a) < 0);
  }
  // Treinta y seis nodos en un móvil: se omiten las que chocarían, nunca texto sobre texto.
  const many: Row[] = Array.from({ length: 36 }, (_, k) => [`País número ${k}`, `País número ${(k * 7 + 3) % 36}`, 5 + (k % 9)]);
  const mm = model(many);
  const fm = chordRadius(mm.names, 358, 360, measure);
  const gm = layoutChord(mm, cols(many).values, 358, 360, fm.outer);
  const lm = placeLabels(mm, gm, 358, 360, measure);
  assert.ok(lm.length > 4 && lm.length < 36);
  const box = (L: (typeof lm)[number]) => {
    const w = measure(L.text);
    const x0 = L.anchor === 'start' ? L.x : L.anchor === 'end' ? L.x - w : L.x - w / 2;
    return [x0, L.y - 7.5, x0 + w, L.y + 7.5];
  };
  for (let i = 0; i < lm.length; i++) {
    const a = box(lm[i]);
    assert.ok(a[0] >= -1e-6 && a[2] <= 358 + 1e-6 && a[1] >= -1 && a[3] <= 361, 'dentro del área');
    for (let j = i + 1; j < lm.length; j++) {
      const b = box(lm[j]);
      assert.ok(!(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]), `${lm[i].text} / ${lm[j].text}`);
    }
  }
  assert.ok(lm.some((L) => L.text.endsWith('…')) || lm.every((L) => L.text.startsWith('País')));
  // Un nombre larguísimo se recorta con "…".
  const long: Row[] = [
    ['Campaña de otoño en buscadores, redes sociales y correo', 'Catálogo', 10],
    ['Catálogo', 'Compra', 4],
  ];
  const ml = model(long);
  const gl = layoutChord(ml, cols(long).values, 358, 300, chordRadius(ml.names, 358, 300, measure).outer);
  const ll = placeLabels(ml, gl, 358, 300, measure);
  assert.ok(ll.some((L) => L.node === 0 && L.text.endsWith('…')));
});

test('textos escapados y opción labels: false', () => {
  const rows: Row[] = [['<b>Tienda & "más"</b>', 'Venta', 10]];
  const d = chord.draw(context(series(rows), rows));
  assert.ok(d.includes('&lt;b&gt;Tienda &amp; &quot;más&quot;&lt;/b&gt;'));
  assert.ok(!d.includes('<b>'));
  const off = chord.draw(context(series(MIGRA, { labels: false }), MIGRA));
  assert.ok(off.includes('<path') && !off.includes('<text'));
  // Sin etiquetas, el círculo usa todo el alto.
  assert.ok(off.includes(`A178,178 `));
});

test('encabezado, tooltip y teclado, sin esperar al primer dibujo (la tabla se arma antes)', () => {
  assert.deepEqual(chord.texts!({ type: 'chord', field: 'v', to: 'destino' }, 'origen'), {
    to: 'destino',
    from: 'origen',
  });
  const ps = series(MIGRA);
  assert.equal(chord.headline!(ps, 0, 'Norte'), 'Norte → Centro');
  // Norte → Centro: 120 de 160 que salen de Norte; 120 de 270 que entran a Centro.
  assert.deepEqual(chord.tooltip!(ps, 0, format), {
    value: '120',
    details: [
      ['% de lo que sale de Norte', '75 %'],
      ['% de lo que entra a Centro', '44.4 %'],
    ],
  });
  // El teclado recorre los flujos por arco del origen; ↑/↓ saltan de nodo.
  const m = model(MIGRA);
  const order = chord.navigable!(ps);
  assert.deepEqual(order, linkOrder(m));
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6],
  );
  const src = (i: number) => m.byRow.get(i)!.source;
  for (let j = 1; j < order.length; j++) assert.ok(src(order[j]) >= src(order[j - 1]));
  const firstOf = (v: number) => order.find((i) => src(i) === v)!;
  assert.equal(chord.step!(ps, 0, 'ArrowDown'), firstOf(1));
  assert.equal(chord.step!(ps, firstOf(1), 'ArrowUp'), firstOf(0));
  assert.equal(nodeStep(m, firstOf(0), 'ArrowUp'), firstOf(0), 'en el borde se queda');
  assert.equal(chord.step!(ps, 0, 'ArrowRight'), undefined, '←/→ siguen el recorrido lineal');
});

test('tooltip de flujos que no se dibujan y aviso de bucles', () => {
  const rows: Row[] = [
    ['A', 'B', 5],
    ['B', 'B', 2],
    ['A', 'C', 0],
    ['A', 'C', NaN],
  ];
  const ps = series(rows);
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (s: string) => warnings.push(s);
  try {
    assert.deepEqual(chord.tooltip!(ps, 1, format), { value: '2', details: [['No se dibuja', 'va de un nodo a sí mismo']] });
    const ctx = context(ps, rows);
    chord.draw(ctx);
    chord.draw(ctx);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1, 'un solo aviso por conjunto de datos');
  assert.ok(warnings[0].includes('"B → B"'));
  assert.deepEqual(chord.tooltip!(ps, 2, format), { value: '0' });
  assert.equal(chord.tooltip!(ps, 3, format), null);
  assert.deepEqual(chord.navigable!(ps), [0]);
});

test('área vacía o diminuta: nada que dibujar, sin errores', () => {
  const ps = series(MIGRA);
  assert.equal(chord.draw(context(ps, MIGRA, 0, 0)), '');
  const tiny = chord.draw(context(ps, MIGRA, 30, 30));
  assert.ok(!tiny.includes('NaN') && !tiny.includes('<text'));
});

test('muestra del tooltip: el color del nodo de origen, el mismo de la cinta', () => {
  const m = model(MIGRA);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(series(MIGRA), MIGRA, 640, 360, undefined, theme);
    MIGRA.forEach(([from], i) => {
      const s = m.slots[m.names.indexOf(from)];
      const swatch = chord.swatch!(ctx, i);
      assert.equal(swatch, s >= 0 ? theme.palette[s] : theme.other);
      assert.ok(chord.hover!(ctx, i).includes(`fill="${swatch}"`), `cinta ${i} en ${swatch}`);
    });
  }
  // Sur → Centro va en el color de Sur, no en el de la serie.
  const sur = MIGRA.findIndex(([from, to]) => from === 'Sur' && to === 'Centro');
  assert.equal(chord.swatch!(context(series(MIGRA), MIGRA), sur), LIGHT.palette[2]);
  // Un bucle no se dibuja: sin color propio.
  const rows: Row[] = [
    ['A', 'B', 5],
    ['B', 'B', 2],
  ];
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(chord.swatch!(context(series(rows), rows), 1), null);
  } finally {
    console.warn = warn;
  }
});
