import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TARGET_WIDTH,
  axisTicks,
  bandSegments,
  bandShades,
  barShape,
  baseValue,
  bullet,
  bulletLayout,
  cleanRanges,
  hitRow,
  placeValueLabel,
  rangeIndex,
  rangeText,
  rowCenter,
  trackShade,
  valueX,
} from '../src/series/bullet';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT, type Theme } from '../src/core/theme';
import { contrast, parseColor } from '../src/core/color';
import { prepare } from '../src/core/prepare';
import { buildFrame } from '../src/core/frame';
import { messages } from '../src/core/i18n';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

type Row = [name: string, value: number, target: number];

/** Indicadores comerciales del trimestre, en % de cumplimiento. */
const KPI: Row[] = [
  ['Ventas', 82, 90],
  ['Margen', 64, 70],
  ['Clientes nuevos', 104, 95],
  ['Satisfacción', 71, 80],
];

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  return {
    key: 'Cumplimiento',
    name: 'Cumplimiento',
    impl: bullet,
    slot: 0,
    options: { type: 'bullet', field: 'v', targetField: 'meta', ranges: [50, 75, 100], ...extra },
    values: rows.map((r) => r[1]),
    columns: { target: rows.map((r) => r[2]) },
    texts: {},
    stackKey: null,
    axis: 'left',
    locale: 'es',
  };
}

function context(
  ps: PreparedSeries,
  rows: Row[],
  {
    width = 640,
    height = 300,
    d0 = 0,
    d1 = 120,
    y1 = ps.values,
    theme = LIGHT,
  }: Partial<{ width: number; height: number; d0: number; d1: number; y1: number[]; theme: Theme }> = {},
): DrawContext {
  const n = rows.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: ps.columns, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#5e2dad',
    pointColor: () => '#5e2dad',
    x: new BandScale(n, width),
    y: new LinearScale(d0, d1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    locale: 'es',
    label: (i) => rows[i][0],
    measure,
    format: (v) => String(v),
    compact: (v) => String(Math.round(v)),
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '');
const format: TooltipFormat = {
  value: String,
  number: String,
  percent: (p) => `${Math.round(p * 1000) / 10} %`,
  isHidden: () => false,
  locale: 'es',
  difference: (d) => `${sign(d)}${Math.abs(d)}`,
};

test('rangos: finitos, ordenados y sin repetir; cada valor en el suyo', () => {
  assert.deepEqual(cleanRanges([100, 50, NaN, 75, 50, Infinity]), [50, 75, 100]);
  assert.deepEqual(cleanRanges(undefined), []);
  const r = [50, 75, 100];
  assert.equal(rangeIndex(10, r), 0);
  // Justo en el límite cuenta en el rango que termina ahí.
  assert.equal(rangeIndex(50, r), 0);
  assert.equal(rangeIndex(50.1, r), 1);
  assert.equal(rangeIndex(100, r), 2);
  assert.equal(rangeIndex(130, r), 3);
  assert.equal(rangeIndex(-20, r), 0);
  assert.equal(rangeIndex(NaN, r), -1);
  assert.equal(rangeIndex(10, []), -1);
  assert.equal(rangeText(60, r, String, 'es'), 'Entre 50 y 75 (2 de 3)');
  assert.equal(rangeText(20, r, String, 'es'), 'Hasta 50 (1 de 3)');
  assert.equal(rangeText(130, r, String, 'es'), 'Más de 100 (pasa la última)');
  assert.equal(rangeText(60, r, String, 'en'), '50 to 75 (2 of 3)');
  assert.equal(rangeText(130, r, String, 'en'), 'Over 100 (past the last band)');
  assert.equal(rangeText(60, r, String, 'pt-BR'), 'Entre 50 e 75 (2 de 3)');
  assert.equal(rangeText(20, r, String, 'pt-BR'), 'Até 50 (1 de 3)');
  assert.equal(rangeText(20, [], String), null);
});

test('bandas: del comienzo de la escala a cada límite, recortadas al dominio', () => {
  assert.deepEqual(bandSegments([50, 75, 100], 0, 120), [
    { index: 0, from: 0, to: 50 },
    { index: 1, from: 50, to: 75 },
    { index: 2, from: 75, to: 100 },
  ]);
  // Con negativos, el primer rango arranca donde arranca la escala.
  assert.deepEqual(bandSegments([50, 100], -40, 100)[0], { index: 0, from: -40, to: 50 });
  // Un dominio fijo más corto recorta y omite lo que queda fuera, sin perder el índice del tono.
  assert.deepEqual(bandSegments([50, 75, 100], 60, 90), [
    { index: 1, from: 60, to: 75 },
    { index: 2, from: 75, to: 90 },
  ]);
  assert.deepEqual(bandSegments([], 0, 100), []);
});

test('tonos: grises de intensidad decreciente, del peor al mejor, legibles en los dos temas', () => {
  for (const th of [LIGHT, DARK]) {
    const shades = bandShades(3, th);
    assert.equal(shades.length, 3);
    const surface = parseColor(th.surface)!;
    const c = shades.map((s) => contrast(parseColor(s)!, surface));
    // Cada rango se distingue del siguiente y todos de la superficie.
    assert.ok(c[0] > c[1] && c[1] > c[2] && c[2] > 1.05, `${th.name}: ${c}`);
    // Neutros: los tres canales casi iguales (nada de semáforo).
    for (const s of shades) {
      const [r, g, b] = parseColor(s)!;
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 4, s);
    }
    // El texto secundario (etiquetas) y el principal (meta) se leen sobre el rango más intenso.
    assert.ok(contrast(parseColor(shades[0])!, parseColor(th.textMuted)!) >= 4.5);
    assert.ok(contrast(parseColor(shades[0])!, parseColor(th.text)!) >= 7);
    assert.equal(trackShade(th), bandShades(2, th)[1]);
  }
  assert.deepEqual(bandShades(0, LIGHT), []);
  assert.equal(bandShades(1, LIGHT).length, 1);
  assert.notEqual(bandShades(3, LIGHT)[0], bandShades(3, DARK)[0]);
});

test('layout: nombres hasta el 40 %, filas con tope de alto y el eje pegado a la última', () => {
  const L = bulletLayout(4, 600, 300, 400, 40);
  assert.equal(L.nameWidth, 240);
  assert.equal(L.x0, 250);
  assert.equal(L.x1, 560);
  // 4 filas en 276 px darían 69: el tope deja 56 y el eje justo debajo.
  assert.equal(L.pitch, 56);
  assert.equal(L.axisY, 4 * 56 + 8);
  assert.equal(L.band, 24);
  assert.equal(L.bar, 8);
  // La meta sobresale de la barra y queda dentro de su fila.
  assert.ok(L.target > L.bar + 4 && L.target < L.pitch);
  assert.equal(rowCenter(L, 0), 28);
  // Muchas filas: se achican, la barra no baja de 2 px y se nombra una de cada tantas.
  const M = bulletLayout(60, 600, 300, 50);
  assert.ok(M.pitch < 5);
  assert.ok(M.bar >= 2 && M.band <= M.pitch);
  assert.ok(M.every >= 3);
  // Sin filas no hay nada que ubicar.
  assert.equal(bulletLayout(0, 600, 300, 50).pitch, 0);
});

test('escala: compartida, la base en el cero y lo que se sale va al borde', () => {
  const L = bulletLayout(2, 500, 200, 90, 10);
  assert.equal(valueX(L, 0, 100, 0), L.x0);
  assert.equal(valueX(L, 0, 100, 100), L.x1);
  assert.equal(valueX(L, 0, 100, 50), (L.x0 + L.x1) / 2);
  assert.equal(valueX(L, 0, 100, 140), L.x1);
  assert.equal(valueX(L, 0, 100, NaN), L.x0);
  assert.equal(valueX(L, 5, 5, 5), L.x0);
  assert.equal(baseValue(-20, 100), 0);
  assert.equal(baseValue(40, 100), 40);
  assert.equal(baseValue(-100, -10), -10);
  assert.deepEqual(axisTicks(0, 120, 400), [0, 50, 100]);
  assert.deepEqual(axisTicks(3, 3, 400), [3]);
});

test('etiqueta del valor: al final, saltando la meta o del otro lado; nunca encima', () => {
  const half = TARGET_WIDTH / 2 + 1;
  // Sin meta: al final de la barra.
  assert.deepEqual(placeValueLabel(100, 300, NaN, 30, 100, 600), { x: 306, anchor: 'start' });
  // La meta adelante y en el camino: pasa al otro lado de la meta.
  const past = placeValueLabel(100, 300, 320, 30, 100, 600)!;
  assert.equal(past.anchor, 'start');
  assert.ok(past.x >= 320 + half);
  // La meta detrás de la punta no estorba.
  assert.deepEqual(placeValueLabel(100, 300, 250, 30, 100, 600), { x: 306, anchor: 'start' });
  // Sin lugar a la derecha: al otro lado de la base.
  assert.deepEqual(placeValueLabel(140, 590, NaN, 30, 100, 600), { x: 134, anchor: 'end' });
  // Negativo: hacia la izquierda.
  assert.deepEqual(placeValueLabel(300, 200, NaN, 30, 100, 600), { x: 194, anchor: 'end' });
  // Negativo con la meta positiva cerca del cero: pasa al otro lado de esa meta.
  const neg = placeValueLabel(300, 120, 320, 30, 100, 600)!;
  assert.deepEqual(neg, { x: 320 + half + 6, anchor: 'start' });
  // Ningún lado sirve: no hay etiqueta.
  assert.equal(placeValueLabel(100, 600, NaN, 30, 100, 600), null);
  // Nunca se superpone a la meta en ningún caso.
  for (let t = 100; t <= 600; t += 7) {
    const at = placeValueLabel(100, 300, t, 30, 100, 600);
    if (!at) continue;
    const [a, b] = at.anchor === 'start' ? [at.x, at.x + 30] : [at.x - 30, at.x];
    assert.ok(b <= t - half || a >= t + half, `meta ${t}`);
  }
});

test('barra: base recta, punta redondeada, hacia los dos lados', () => {
  const d = barShape(10, 110, 20, 8);
  assert.match(d, /^M10,16H108A2,2 0 0 1 110,18V22A2,2 0 0 1 108,24H10Z$/);
  const neg = barShape(110, 10, 20, 8);
  assert.match(neg, /^M110,16H12A2,2 0 0 0 10,18/);
  assert.equal(barShape(10, 10, 20, 8), '');
  // Una barra más corta que el radio no se dobla.
  assert.match(barShape(10, 11, 20, 8), /A1,1/);
});

test('hit: toda la altura de la fila; fuera de las filas, ninguna', () => {
  const L = bulletLayout(3, 500, 300, 60);
  assert.equal(hitRow(L, 0), 0);
  assert.equal(hitRow(L, L.pitch - 0.1), 0);
  assert.equal(hitRow(L, L.pitch * 2.5), 2);
  assert.equal(hitRow(L, L.pitch * 3), -1);
  assert.equal(hitRow(L, -1), -1);
});

test('dibujo: bandas en gris, valor en su color, meta en texto principal y nombres', () => {
  const ps = series(KPI);
  const svg = bullet.draw(context(ps, KPI));
  const shades = bandShades(3, LIGHT);
  for (const s of shades) assert.equal(svg.split(`fill="${s}"`).length - 1, 4, s);
  assert.equal(svg.split('fill="#5e2dad"').length - 1, 4);
  // Cuatro metas en texto principal (y los cuatro nombres, también en texto principal).
  assert.equal((svg.match(/<rect[^>]*fill="#0b0b0b"/g) ?? []).length, 4);
  for (const [name] of KPI) assert.ok(svg.includes(`>${name}</text>`), name);
  // Etiquetas del valor y eje.
  assert.ok(svg.includes('>82</text>'));
  assert.ok(svg.includes('>100</text>'));
  // Clientes nuevos supera el último rango: su barra pasa de donde terminan las bandas.
  const ends = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"[^>]*fill="(#[0-9a-f]+)"/g)]
    .filter((m) => m[3] === shades[2])
    .map((m) => Number(m[1]) + Number(m[2]));
  const tips = [...svg.matchAll(/<path d="M[\d.]+,[\d.]+H([\d.]+)A[^"]*" fill="#5e2dad"/g)].map((m) => Number(m[1]));
  assert.ok(tips[2] > ends[2]);
  assert.ok(tips[0] < ends[0]);
  // Sin filas no se dibuja nada.
  assert.equal(bullet.draw(context(series([]), [])), '');
});

test('casos límite: sin meta, sin rangos, negativos, NaN y valor sobre el máximo', () => {
  const rows: Row[] = [
    ['Sin meta', 40, NaN],
    ['Sin dato', NaN, 60],
    ['Pérdida', -25, 10],
    ['Récord', 150, 90],
  ];
  const ps = series(rows, { ranges: undefined });
  const svg = bullet.draw(context(ps, rows, { d0: -40, d1: 160 }));
  // Sin rangos: una pista tenue por fila.
  assert.equal(svg.split(`fill="${trackShade(LIGHT)}"`).length - 1, 4);
  // Tres barras (la fila sin dato no tiene) y tres metas.
  assert.equal(svg.split('fill="#5e2dad"').length - 1, 3);
  assert.equal((svg.match(/<rect[^>]*fill="#0b0b0b"/g) ?? []).length, 3);
  // Con negativos el cero se marca dentro de cada fila, en el color de la línea del cero.
  assert.ok((svg.match(/<line[^>]*stroke="#a9a8a1"/g) ?? []).length >= 4);
  assert.ok(svg.includes('>-25</text>'));
  assert.ok(!svg.includes('NaN'));
  // El tooltip lo dice todo aunque no se dibuje.
  assert.deepEqual(bullet.tooltip!(ps, 0, format), { value: '40' });
  assert.deepEqual(bullet.tooltip!(ps, 1, format), { value: 'Sin dato', details: [['Meta', '60']] });
  assert.deepEqual(bullet.tooltip!(ps, 2, format)!.details![1], ['Frente a la meta', '−35 (−350 %)']);
});

test('dominio: el núcleo hace caber valores, metas y rangos, con el cero', () => {
  const data = [
    { x: 'A', v: 30, meta: 140 },
    { x: 'B', v: 60, meta: 50 },
  ];
  const p = prepare(
    { data, xField: 'x', xType: 'category', series: [{ type: 'bullet', field: 'v', targetField: 'meta', ranges: [100, 200] }] },
    new Map([['bullet', bullet]]),
    8,
  );
  assert.equal(p.coords, 'free');
  assert.deepEqual(p.series[0].columns.target, [140, 50]);
  const f = buildFrame(p, new Set(), { ticks: 5 });
  assert.equal(f.d0, 0);
  assert.ok(f.d1 >= 200);
  // Sin targetField la meta queda vacía, no en cero.
  const q = prepare(
    { data, xField: 'x', xType: 'category', series: [{ type: 'bullet', field: 'v' }] },
    new Map([['bullet', bullet]]),
    8,
  );
  assert.ok(q.series[0].columns.target.every((v) => Number.isNaN(v)));
});

test('animación: la barra crece desde la base y la meta queda quieta', () => {
  const ps = series(KPI);
  const first = bullet.draw(context(ps, KPI, { y1: KPI.map(() => 0) }));
  // En el primer cuadro no hay barras, pero sí metas, bandas y etiquetas finales.
  assert.ok(!first.includes('fill="#5e2dad"'));
  assert.equal((first.match(/<rect[^>]*fill="#0b0b0b"/g) ?? []).length, 4);
  assert.ok(first.includes('>82</text>'));
  const mid = bullet.draw(context(ps, KPI, { y1: KPI.map((r) => r[1] / 2) }));
  const full = bullet.draw(context(ps, KPI));
  const tip = (svg: string) => Number(/fill="#fcfcfb"\/><path d="M[\d.]+,[\d.]+H([\d.]+)/.exec(svg)?.[1]);
  assert.ok(tip(mid) < tip(full));
});

test('hit, anchor y hover', () => {
  const ps = series(KPI);
  const ctx = context(ps, KPI);
  const L = bulletLayout(4, 640, 300, measure('Clientes nuevos'), 0);
  assert.equal(bullet.hit!(ctx, 10, L.pitch * 1.5), 1);
  assert.equal(bullet.hit!(ctx, 10, 290), -1);
  const [ax, ay] = bullet.anchor!(ctx, 2)!;
  assert.equal(ay, L.pitch * 2.5);
  assert.ok(ax > 300);
  const hover = bullet.hover!(ctx, 0);
  assert.ok(hover.includes(LIGHT.highlight));
  // La franja rodea la fila con un hueco en el fondo (evenodd): no tiñe los datos ni los repite.
  assert.ok(hover.includes('fill-rule="evenodd"'));
  assert.equal((hover.match(/M/g) ?? []).length, 2);
  assert.ok(!hover.includes('#5e2dad') && !hover.includes('<text'));
  assert.equal(bullet.hover!(ctx, 9), '');
});

test('tooltip: valor, meta, diferencia con signo y %, y el rango', () => {
  const ps = series(KPI);
  assert.deepEqual(bullet.tooltip!(ps, 0, format), {
    value: '82',
    details: [
      ['Meta', '90'],
      ['Frente a la meta', '−8 (−8.9 %)'],
      ['Franja', 'Entre 75 y 100 (3 de 3)'],
    ],
  });
  assert.deepEqual(bullet.tooltip!(ps, 2, format)!.details, [
    ['Meta', '95'],
    ['Frente a la meta', '+9 (+9.5 %)'],
    ['Franja', 'Más de 100 (pasa la última)'],
  ]);
  // Justo en la meta, o con meta cero: sin porcentaje.
  const even = series([['A', 50, 50]]);
  assert.deepEqual(bullet.tooltip!(even, 0, format)!.details![1], ['Frente a la meta', '0']);
  const zero = series([['A', 5, 0]]);
  assert.deepEqual(bullet.tooltip!(zero, 0, format)!.details![1], ['Frente a la meta', '+5']);
});

test('teclado y accesibilidad: recorre todas las filas y las nombra como indicadores', () => {
  assert.equal(bullet.coords, 'free');
  assert.equal(bullet.navigable, undefined);
  assert.deepEqual(messages('es').types.bullet.items, ['indicador', 'indicadores']);
  assert.equal(messages('es').types.bullet.label, 'metas');
  assert.deepEqual(bullet.domainValues!({ type: 'bullet', field: 'v', ranges: [75, 50, NaN] }), [50, 75]);
});

test('textos escapados, nombres recortados y opción labels: false', () => {
  const rows: Row[] = [
    ['<b>Ventas & "otros"</b>', 80, 90],
    ['Un indicador con un nombre larguísimo que no cabe', 40, 50],
  ];
  const svg = bullet.draw(context(series(rows), rows, { width: 300 }));
  assert.ok(!svg.includes('<b>'));
  assert.ok(svg.includes('&lt;b&gt;'));
  assert.ok(svg.includes('&amp;'));
  assert.ok(svg.includes('…</text>'));
  const off = bullet.draw(context(series(KPI, { labels: false }), KPI));
  assert.ok(!off.includes('>82</text>'));
  // Los nombres y el eje siguen.
  assert.ok(off.includes('>Ventas</text>'));
});

test('tema oscuro: sus propios grises, la meta en el texto claro y el anillo de su superficie', () => {
  const svg = bullet.draw(context(series(KPI), KPI, { theme: DARK }));
  for (const s of bandShades(3, DARK)) assert.ok(svg.includes(`fill="${s}"`));
  assert.equal((svg.match(/<rect[^>]*fill="#f0efec"/g) ?? []).length, 4);
  assert.ok(svg.includes(`fill="${DARK.surface}"`));
  assert.ok(!svg.includes(LIGHT.surface));
});
