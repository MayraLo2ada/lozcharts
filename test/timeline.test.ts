import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AXIS_H,
  MARK_GAP,
  MILESTONE_R,
  OTHERS,
  axisTicks,
  buildModel,
  diamondPath,
  durationParts,
  durationText,
  formatRange,
  formatTime,
  hitMark,
  laneSlots,
  layoutTimeline,
  packRows,
  readTime,
  timePrecision,
  timeToPx,
  timeline,
  type Geometry,
} from '../src/series/timeline';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT, type Theme } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

type Row = [name: string, start: string, end?: string, group?: string];

/** Un proyecto chico, por equipo, con dos hitos. */
const PROJECT: Row[] = [
  ['Investigación', '2026-01-12', '2026-02-27', 'Producto'],
  ['Prototipos', '2026-03-02', '2026-04-10', 'Diseño'],
  ['API', '2026-03-16', '2026-06-19', 'Ingeniería'],
  ['App', '2026-04-20', '2026-08-28', 'Ingeniería'],
  ['Integración', '2026-06-01', '2026-07-31', 'Ingeniería'],
  ['Beta', '2026-08-03', '', 'Producto'],
  ['Lanzamiento', '2026-09-15', '', 'Marketing'],
];

const cols = (rows: Row[]) => ({
  name: rows.map((r) => r[0]),
  start: rows.map((r) => r[1]),
  end: rows.map((r) => r[2] ?? ''),
  group: rows.map((r) => r[3] ?? ''),
});

function model(rows: Row[], grouped = false) {
  const c = cols(rows);
  return buildModel(c.start, c.end, grouped ? c.group : null);
}

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  const c = cols(rows);
  return {
    key: 'Proyecto',
    name: 'Proyecto',
    impl: timeline,
    slot: 0,
    options: { type: 'timeline', field: 'nombre', end: 'fin', ...extra },
    values: rows.map(() => NaN),
    columns: {},
    texts: c,
    stackKey: null,
    axis: 'left',
  };
}

function context(ps: PreparedSeries, width = 800, height = 320, theme: Theme = LIGHT, alpha = 1): DrawContext {
  const n = ps.values.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1: ps.values, cols: {}, alpha, slot: 0, slots: 1, outer: [] },
    color: theme.palette[0],
    pointColor: () => theme.palette[0],
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => ps.texts.start[i],
    measure,
    format: String,
    compact: String,
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const format: TooltipFormat = { value: String, number: String, percent: String, isHidden: () => false, difference: String };

const local = (y: number, m = 1, d = 1, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

/** Cajas de texto de una etiqueta de 12 px. */
const box = (L: { x: number; y: number; text: string }) => ({ x0: L.x, x1: L.x + measure(L.text), y0: L.y - 6, y1: L.y + 6 });
const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('fechas: años, meses y días en hora local; milisegundos, Date y texto ISO', () => {
  assert.equal(readTime('1914'), local(1914));
  assert.equal(readTime('2026-03'), local(2026, 3));
  assert.equal(readTime(' 2026-03-05 '), local(2026, 3, 5));
  assert.equal(readTime('1700000000000'), 1_700_000_000_000);
  const d = new Date(2026, 9, 25, 14, 30);
  assert.equal(readTime(String(d)), d.getTime());
  assert.equal(readTime('2026-11-04T08:30'), local(2026, 11, 4, 8, 30));
  assert.ok(Number.isNaN(readTime('')));
  assert.ok(Number.isNaN(readTime('pronto')));
});

test('precisión: la unidad más fina que de verdad usan las fechas', () => {
  assert.equal(timePrecision([local(1914), local(1918)]), 'year');
  assert.equal(timePrecision([local(2026, 1), local(2026, 3)]), 'month');
  assert.equal(timePrecision([local(2026, 1), local(2026, 3, 12)]), 'day');
  assert.equal(timePrecision([local(2026, 1, 1, 9)]), 'hour');
  assert.equal(timePrecision([local(2026, 1, 1, 9, 30)]), 'minute');
  assert.equal(timePrecision([NaN]), 'year');
});

test('duración de calendario y en palabras', () => {
  assert.deepEqual(durationParts(local(2026, 3, 3), local(2026, 6, 15)), [0, 3, 12, 0, 0]);
  assert.equal(durationText(local(2026, 3, 3), local(2026, 6, 15), 'day'), '3 meses y 12 días');
  // Un mes de calendario, aunque febrero sea corto o cruce un cambio de horario.
  assert.equal(durationText(local(2026, 1, 31), local(2026, 2, 28), 'day'), '1 mes');
  assert.equal(durationText(local(2026, 3, 1), local(2026, 4, 1), 'day'), '1 mes');
  assert.equal(durationText(local(1946), local(1952), 'year'), '6 años');
  // Sin bajar de la precisión: con años no aparecen días sueltos.
  assert.equal(durationText(local(1543), local(1687, 3, 5), 'year'), '144 años');
  assert.equal(durationText(local(2026, 1, 1), local(2027, 3, 1), 'month'), '1 año y 2 meses');
  assert.equal(durationText(local(2026, 11, 4, 9, 30), local(2026, 11, 4, 12), 'minute'), '2 horas y 30 minutos');
  assert.equal(durationText(local(2026, 1, 1), local(2026, 1, 2), 'day'), '1 día');
  // Más corto que la precisión: se dice igual cuánto duró.
  assert.equal(durationText(local(2026, 1, 1), local(2026, 1, 1, 3), 'day'), '3 horas');
  assert.equal(durationText(local(2026, 1, 1), local(2026, 1, 1)), '');
  assert.equal(durationText(local(2026, 1, 2), local(2026, 1, 1)), '');
});

test('fechas escritas con la precisión de los datos, sin repetir el año', () => {
  assert.equal(formatTime(local(1914), 'year'), '1914');
  assert.equal(formatTime(local(2026, 3, 3), 'day'), '3 mar 2026');
  assert.equal(formatRange(local(2026, 3, 3), local(2026, 6, 15), 'day'), '3 mar – 15 jun 2026');
  assert.equal(formatRange(local(2025, 12, 1), local(2026, 2, 1), 'month'), 'dic 2025 – feb 2026');
  assert.equal(formatRange(local(1946), local(1952), 'year'), '1946 – 1952');
  assert.equal(formatRange(local(2026, 11, 4, 9), local(2026, 11, 4, 11, 30), 'minute'), '4 nov 2026, 09:00 – 11:30');
});

test('modelo: orden temporal, hitos, fin al revés, fin e inicio inválidos', () => {
  const m = model([
    ['C', '2026-05-01', '2026-06-01'],
    ['Al revés', '2026-05-01', '2026-03-01'],
    ['Hito', '2026-04-01'],
    ['Cero', '2026-04-01', '2026-04-01'],
    ['Fin raro', '2026-02-01', 'pronto'],
    ['Sin inicio', 'nunca', '2026-07-01'],
  ]);
  // Por inicio; a igual inicio, el más largo primero; luego por fila.
  assert.deepEqual(
    m.spans.map((s) => s.index),
    [4, 1, 2, 3, 0],
  );
  const by = (i: number) => m.byRow.get(i)!;
  assert.deepEqual([by(1).start, by(1).end, by(1).swapped], [local(2026, 3), local(2026, 5), true]);
  assert.ok(by(2).milestone && by(3).milestone && by(4).milestone);
  assert.ok(by(4).badEnd && !by(2).badEnd);
  assert.deepEqual(m.invalid, [5]);
  assert.deepEqual(m.swapped, [1]);
  assert.equal(m.t0, local(2026, 2));
  assert.equal(m.t1, local(2026, 6));
  assert.equal(m.precision, 'month');
  assert.equal(m.grouped, false);
  assert.deepEqual(m.lanes, []);
});

test('carriles: en orden de aparición en el tiempo, sin ciclar; más de 8 van a "Otros"', () => {
  const m = model(PROJECT, true);
  assert.deepEqual(
    m.lanes.map((l) => [l.name, l.slot]),
    [
      ['Producto', 0],
      ['Diseño', 1],
      ['Ingeniería', 2],
      ['Marketing', 3],
    ],
  );
  assert.equal(m.byRow.get(3)!.lane, 2);
  const { lanes, laneOf } = laneSlots(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  assert.equal(lanes.length, 8);
  assert.deepEqual(lanes[7], { name: OTHERS, slot: -1 });
  assert.deepEqual([laneOf.get('g'), laneOf.get('h'), laneOf.get('j')], [6, 7, 7]);
  // Con 8 justos, todos con color.
  assert.ok(laneSlots(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).lanes.every((l, k) => l.slot === k));
  // Un tramo sin grupo va a "Sin grupo".
  const g = model([['x', '2026-01-01', '2026-02-01', '']], true);
  assert.equal(g.lanes[0].name, 'Sin grupo');
});

test('empaquetado: primera fila libre, el mínimo de filas y determinista', () => {
  const items = [
    { a: 0, b: 50 },
    { a: 10, b: 30 },
    { a: 40, b: 80 },
    { a: 52, b: 60 },
    { a: 90, b: 100 },
  ];
  assert.deepEqual(packRows(items), [0, 1, 1, 2, 0]);
  // Con el aire mínimo exacto, entra en la misma fila; con un px menos, no.
  assert.deepEqual(
    packRows([
      { a: 0, b: 10 },
      { a: 10 + MARK_GAP, b: 20 },
    ]),
    [0, 0],
  );
  assert.deepEqual(
    packRows([
      { a: 0, b: 10 },
      { a: 9 + MARK_GAP, b: 20 },
    ]),
    [0, 1],
  );
  // Filas = el mayor número de tramos que se solapan a la vez (intervalos al azar, semilla fija).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1000;
  const random = Array.from({ length: 200 }, () => {
    const a = rnd();
    return { a, b: a + rnd() / 8 };
  }).sort((p, q) => p.a - q.a);
  const rows = packRows(random, 0);
  let most = 0;
  for (const p of random) most = Math.max(most, random.filter((q) => q.a <= p.a && q.b > p.a).length);
  assert.equal(Math.max(...rows) + 1, most);
  assert.deepEqual(packRows(random, 0), rows);
});

test('layout: marcas dentro del área, sin solaparse en su fila, carriles en orden', () => {
  const m = model(PROJECT, true);
  const g = layoutTimeline(m, 800, 320, measure, cols(PROJECT).name);
  assert.ok(g.gutter > 0);
  for (const mk of g.marks) {
    assert.ok(mk.a >= g.gutter && mk.b <= 800, `marca ${mk.index} dentro`);
    assert.ok(mk.y >= 0 && mk.y + mk.h <= g.baseline);
    assert.ok(mk.h <= 24, 'barras de hasta 24 px');
  }
  for (const p of g.marks) {
    for (const q of g.marks) {
      if (p === q || p.lane !== q.lane || p.row !== q.row) continue;
      assert.ok(p.b + MARK_GAP <= q.a || q.b + MARK_GAP <= p.a, `${p.index} y ${q.index} se tocan`);
    }
  }
  // API, App e Integración se solapan: tres filas en Ingeniería.
  assert.deepEqual(
    g.lanes.map((l) => l.rows),
    [1, 1, 3, 1],
  );
  for (let l = 1; l < g.lanes.length; l++) assert.ok(g.lanes[l].y0 > g.lanes[l - 1].y1);
  assert.equal(g.separators.length, 3);
  assert.equal(g.baseline, 320 - AXIS_H);
  // El primer inicio y el último fin quedan en los bordes del área de las marcas.
  assert.equal(g.byRow.get(0)!.x0, g.left);
  assert.ok(Math.abs(g.byRow.get(3)!.x1 - timeToPx(g, local(2026, 8, 28))) < 1e-9);
  // Un hito ocupa el rombo; una barra cortísima, el ancho mínimo.
  const beta = g.byRow.get(5)!;
  assert.equal(beta.b - beta.a, 2 * MILESTONE_R);
});

test('layout: un solo hito se centra; sin grupos, un carril sin nombres', () => {
  const m = model([['Hoy', '2026-10-25']]);
  const g = layoutTimeline(m, 400, 200, measure, ['Hoy']);
  assert.equal(g.gutter, 0);
  assert.equal(g.lanes.length, 1);
  assert.deepEqual(g.laneLabels, []);
  assert.equal(g.byRow.get(0)!.x0, (g.left + g.right) / 2);
  assert.ok(g.ticks.length > 0);
});

test('layout: 150 tramos caben en el alto, aunque las barras se afinen', () => {
  const rows: Row[] = Array.from({ length: 150 }, (_, k) => [`T${k}`, `2026-01-${1 + (k % 28)}`, `2026-03-${1 + (k % 28)}`]);
  const g = layoutTimeline(model(rows), 600, 320, measure, cols(rows).name);
  assert.equal(g.marks.length, 150);
  const bottom = Math.max(...g.marks.map((mk) => mk.rowTop + g.rowH));
  assert.ok(bottom <= g.baseline + 1e-6);
  assert.ok(g.barH >= 1);
  // Filas tan finas no llevan nombres.
  assert.ok(g.labels.length < 150);
});

test('eje: marcas de calendario según el rango, nunca más finas que los datos', () => {
  const ticks = (t0: number, t1: number, unit: Parameters<typeof axisTicks>[6], w = 800) =>
    axisTicks(t0, t1, 0, w, 0, w, unit, measure).map((t) => t.label);
  // Siglos: cada 50 años.
  assert.deepEqual(ticks(local(1450), local(1930), 'year'), [
    '1450',
    '1500',
    '1550',
    '1600',
    '1650',
    '1700',
    '1750',
    '1800',
    '1850',
    '1900',
  ]);
  // Décadas.
  assert.deepEqual(ticks(local(1946), local(2026), 'year').slice(0, 3), ['1950', '1960', '1970']);
  // Un año por meses: el año aparece en enero.
  const months = ticks(local(2025, 11, 15), local(2026, 4, 1), 'day');
  assert.ok(months.includes('2026') && months.includes('dic'));
  // Horas de un día.
  assert.deepEqual(ticks(local(2026, 11, 4, 8), local(2026, 11, 4, 17), 'minute', 400), ['09:00', '12:00', '15:00']);
  // Datos por año en un rango de tres años: sin meses.
  assert.deepEqual(ticks(local(2024), local(2027), 'year'), ['2024', '2025', '2026', '2027']);
  // Ninguna etiqueta se sale ni choca con la vecina.
  const t = axisTicks(local(2026), local(2026, 12, 31), 0, 300, 0, 300, 'day', measure);
  for (let k = 1; k < t.length; k++) {
    const right = (x: (typeof t)[0]) =>
      x.anchor === 'start' ? x.x + measure(x.label) : x.anchor === 'end' ? x.x : x.x + measure(x.label) / 2;
    const left = (x: (typeof t)[0]) =>
      x.anchor === 'start' ? x.x : x.anchor === 'end' ? x.x - measure(x.label) : x.x - measure(x.label) / 2;
    assert.ok(left(t[k]) >= right(t[k - 1]));
    assert.ok(left(t[k]) >= 0 && right(t[k]) <= 300);
  }
});

test('nombres: adentro si caben, a la derecha si hay lugar, nunca texto sobre texto', () => {
  const rows: Row[] = [
    ['Enero', '2026-01-01', '2026-01-20'],
    ['Ancho', '2026-03-01', '2026-06-01'],
    ['Pegado', '2026-06-02', '2026-06-10'],
    ['Al final', '2026-12-31'],
  ];
  const names = cols(rows).name;
  const g = layoutTimeline(model(rows), 800, 200, measure, names);
  const by = (i: number) => g.labels.find((L) => L.index === i);
  assert.equal(by(1)!.inside, true);
  assert.equal(by(1)!.x, g.byRow.get(1)!.x0 + 6);
  // "Enero" no cabe en su barra y tiene lugar antes de la siguiente.
  assert.equal(by(0)!.inside, false);
  assert.equal(by(0)!.x, g.byRow.get(0)!.b + 6);
  // El hito del borde derecho lleva el nombre a la izquierda, bien separado de lo anterior.
  const end = by(3)!;
  assert.ok(end.x + measure(end.text) <= g.byRow.get(3)!.a);
  // Ningún nombre toca a otro ni a una marca ajena.
  for (const a of g.labels) {
    for (const b of g.labels) if (a !== b) assert.ok(!overlaps(box(a), box(b)), `${a.text} / ${b.text}`);
    for (const mk of g.marks) {
      if (mk.index === a.index) continue;
      const ba = box(a);
      assert.ok(!(ba.x0 < mk.b && mk.a < ba.x1 && ba.y0 < mk.y + mk.h && mk.y < ba.y1), `${a.text} sobre ${mk.index}`);
    }
  }
  // Con 160 tramos apretados tampoco hay choques.
  const many: Row[] = Array.from({ length: 160 }, (_, k) => [
    `Incidente ${k + 1}`,
    `2025-01-${1 + (k % 28)}`,
    `2025-0${2 + (k % 7)}-10`,
  ]);
  const gm = layoutTimeline(model(many), 900, 600, measure, cols(many).name);
  for (let i = 0; i < gm.labels.length; i++) {
    for (let j = i + 1; j < gm.labels.length; j++) assert.ok(!overlaps(box(gm.labels[i]), box(gm.labels[j])));
  }
  // Un recorte que deja casi nada ("Incid…") no va.
  assert.ok(gm.labels.every((L) => !L.text.endsWith('…') || L.text.length - 1 >= 0.7 * names.length));
});

test('hit-test: toda la fila de la marca, con tolerancia, y nada fuera', () => {
  const g: Pick<Geometry, 'marks' | 'rowH'> = layoutTimeline(model(PROJECT, true), 800, 320, measure);
  const api = (g as Geometry).byRow.get(2)!;
  assert.equal(hitMark(g, (api.x0 + api.x1) / 2, api.y + api.h / 2), 2);
  assert.equal(hitMark(g, api.x0 - 3, api.rowTop + 1), 2);
  assert.equal(hitMark(g, api.x0 - 20, api.y + api.h / 2), -1);
  const beta = (g as Geometry).byRow.get(5)!;
  assert.equal(hitMark(g, beta.x0 + MILESTONE_R, beta.y + beta.h / 2), 5);
  assert.equal(hitMark(g, 5, 5), -1);
});

test('dibujo: colores por carril en orden de la paleta, "Otros" en gris, rombos con anillo', () => {
  const ps = series(PROJECT, { group: 'grupo' });
  const d = timeline.draw(context(ps));
  for (const c of LIGHT.palette.slice(0, 4)) assert.ok(d.includes(`fill="${c}"`), c);
  assert.ok(!d.includes(`fill="${LIGHT.palette[4]}"`), 'sin ciclar ni saltar colores');
  assert.ok(d.includes('<path d="M') && d.includes(`stroke="${LIGHT.surface}"`));
  assert.ok(d.includes('rx="4"'), 'barras redondeadas de 4 px');
  // Nombres de los carriles en texto principal, con su muestra de color.
  assert.ok(d.includes(`fill="${LIGHT.text}" font-size="12" dominant-baseline="central">Ingeniería</text>`));
  // Sin grupos, todo del color de la serie.
  const plain = timeline.draw(context(series(PROJECT)));
  assert.ok(!plain.includes(`fill="${LIGHT.palette[1]}"`));
  // Diez grupos: 7 con color y "Otros" en gris.
  const ten: Row[] = Array.from({ length: 10 }, (_, k) => [`O${k}`, `2026-0${1 + (k % 9)}-01`, '2026-12-01', `G${k}`]);
  const dt = timeline.draw(context(series(ten, { group: 'grupo' }), 800, 400));
  assert.ok(dt.includes(`fill="${LIGHT.other}"`) && dt.includes('>Otros</text>'));
  assert.ok(!dt.includes(`fill="${LIGHT.palette[7]}"`));
});

test('dibujo: tema oscuro, entrada animada y vacío', () => {
  const ps = series(PROJECT, { group: 'grupo' });
  const d = timeline.draw(context(ps, 800, 320, DARK));
  assert.ok(d.includes(DARK.palette[0]) && !d.includes(LIGHT.palette[0]));
  assert.ok(d.includes(`stroke="${DARK.surface}"`) && d.includes(`stroke="${DARK.zero}"`));
  // A mitad de la entrada las barras miden la mitad y los nombres están a media opacidad.
  const widths = (s: string) =>
    [...s.matchAll(/<rect x="[^"]+" y="[^"]+" width="([^"]+)" height="([^"]+)" rx/g)].map((x) => +x[1]);
  const full = widths(timeline.draw(context(ps)));
  const half = timeline.draw(context(ps, 800, 320, LIGHT, 0.5));
  const hw = widths(half);
  assert.equal(full.length, hw.length);
  full.forEach((w, k) => assert.ok(w <= 10 || Math.abs(hw[k] - w / 2) < 0.02, `${w} → ${hw[k]}`));
  assert.ok(half.includes('fill-opacity="0.5"'));
  assert.equal(timeline.draw(context(series([['x', 'nunca']]))), '');
});

test('textos escapados y opción labels: false', () => {
  const rows: Row[] = [
    ['<b>Tramo & "comillas"</b>', '2026-01-01', '2026-12-01', '<i>grupo</i>'],
    ['Otro', '2026-02-01', '2026-03-01', '<i>grupo</i>'],
  ];
  const d = timeline.draw(context(series(rows, { group: 'grupo' })));
  assert.ok(d.includes('&lt;b&gt;Tramo &amp; &quot;comillas&quot;&lt;/b&gt;'));
  assert.ok(d.includes('&lt;i&gt;grupo&lt;/i&gt;'));
  assert.ok(!d.includes('<b>') && !d.includes('<i>'));
  const off = timeline.draw(context(series(PROJECT, { labels: false })));
  assert.ok(off.includes('<rect') && !off.includes('>Investigación<') && !off.includes('>API<'));
  // El eje sigue.
  assert.ok(off.includes('>feb</text>') || off.includes('>mar</text>'));
});

test('hover: guías hasta el eje, anillo y su nombre encima', () => {
  const ctx = context(series(PROJECT, { group: 'grupo' }));
  const h = timeline.hover!(ctx, 2);
  assert.equal((h.match(/<line/g) ?? []).length, 2);
  assert.ok(h.includes(`stroke="${LIGHT.text}" stroke-width="2"`));
  // Un hito: una sola guía y un rombo de anillo.
  const hm = timeline.hover!(ctx, 5);
  assert.equal((hm.match(/<line/g) ?? []).length, 1);
  assert.equal((hm.match(/<path/g) ?? []).length, 2);
  assert.equal(timeline.hover!(ctx, 99), '');
  // El tooltip se apoya en el extremo que mira al borde más cercano.
  const g = layoutTimeline(model(PROJECT, true), 800, 320, measure, cols(PROJECT).name);
  const first = g.byRow.get(0)!;
  assert.deepEqual(timeline.anchor!(ctx, 0), [first.a, first.y + first.h / 2]);
  const last = g.byRow.get(6)!;
  assert.deepEqual(timeline.anchor!(ctx, 6), [last.b, last.y + last.h / 2]);
  assert.equal(timeline.hit!(ctx, first.x0 + 2, first.y + 2), 0);
});

test('encabezado, tooltip con duración y teclado en orden temporal', () => {
  assert.deepEqual(timeline.texts!({ type: 'timeline', field: 'nombre', end: 'fin', group: 'equipo' }, 'inicio'), {
    name: 'nombre',
    start: 'inicio',
    end: 'fin',
    group: 'equipo',
  });
  const ps = series(PROJECT, { group: 'grupo' });
  assert.equal(timeline.headline!(ps, 2, '16 mar 2026'), 'API');
  assert.equal(timeline.headline!(series([['', '2026-01-01']]), 0, '1 ene 2026'), '1 ene 2026');
  assert.deepEqual(timeline.tooltip!(ps, 2, format), {
    value: '16 mar – 19 jun 2026',
    details: [
      ['Duración', '3 meses y 3 días'],
      ['Grupo', 'Ingeniería'],
    ],
  });
  assert.deepEqual(timeline.tooltip!(ps, 5, format), { value: '3 ago 2026', details: [['Grupo', 'Producto']] });
  // Datos desordenados (eje de categorías): el teclado los recorre igual por inicio.
  const messy: Row[] = [
    ['C', '2026-05-01', '2026-06-01'],
    ['A', '2026-01-01', '2026-02-01'],
    ['B', '2026-03-01'],
    ['X', 'nunca'],
  ];
  const pm = series(messy);
  assert.deepEqual(timeline.navigable!(pm), [1, 2, 0]);
  assert.deepEqual(timeline.tooltip!(pm, 3, format), { value: 'Sin fecha válida' });
  assert.deepEqual(timeline.tooltip!(pm, 0, format), { value: 'may – jun 2026', details: [['Duración', '1 mes']] });
});

test('fin antes del inicio: se invierte, el tooltip lo dice y se avisa una sola vez', () => {
  const rows: Row[] = [
    ['Al revés', '2026-05-01', '2026-03-01'],
    ['Fin raro', '2026-06-01', 'pronto'],
  ];
  const ps = series(rows);
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (s: string) => warnings.push(s);
  try {
    // Primero el tooltip (como la tabla oculta), después dos cuadros.
    assert.deepEqual(timeline.tooltip!(ps, 0, format), {
      value: 'mar – may 2026',
      details: [
        ['Duración', '2 meses'],
        ['Nota', 'el fin venía antes del inicio'],
      ],
    });
    const ctx = context(ps);
    timeline.draw(ctx);
    timeline.draw(ctx);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('"Al revés"'));
  assert.deepEqual(timeline.tooltip!(ps, 1, format), { value: 'jun 2026', details: [['Fin', 'no es una fecha válida']] });
});

test('rombo: cuatro vértices alrededor del centro', () => {
  assert.equal(diamondPath(10, 20, 5), 'M10,15L15,20L10,25L5,20Z');
  assert.equal(diamondPath(10, 20, 0), '');
});

test('muestra del tooltip: el color del carril, el mismo de la barra o el rombo', () => {
  const ps = series(PROJECT, { group: 'equipo' });
  // Carriles por aparición en el tiempo: Producto, Diseño, Ingeniería, Marketing.
  const lane = [0, 1, 2, 2, 2, 0, 3];
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(ps, 800, 320, theme);
    PROJECT.forEach(([name], i) => {
      const swatch = timeline.swatch!(ctx, i);
      assert.equal(swatch, theme.palette[lane[i]], name);
      assert.ok(timeline.hover!(ctx, i).includes(`fill="${swatch}"`), `${name} en ${swatch}`);
    });
  }
  // Sin grupos, el color de la serie; una fila sin fecha válida no tiene color propio.
  const plain = context(series(PROJECT));
  for (let i = 0; i < PROJECT.length; i++) assert.equal(timeline.swatch!(plain, i), plain.color);
  assert.equal(timeline.swatch!(context(series([['Sin fecha', 'pronto']])), 0), null);
});
