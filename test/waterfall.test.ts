import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  barGeometry,
  barShape,
  cascade,
  connectorPath,
  headroom,
  hollowAt,
  isFinal,
  isTotal,
  jointPlan,
  kindOf,
  labelPlan,
  placeLabels,
  signed,
  steps,
  waterfall,
  type LabelInput,
} from '../src/series/waterfall';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { prepare } from '../src/core/prepare';
import { buildFrame, collapse } from '../src/core/frame';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT, type Theme } from '../src/core/theme';
import { round } from './helpers';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

type Row = [label: string, value: number | null, total?: boolean];

/** Estado de resultados: ventas, costos, un subtotal, gastos, impuestos y la utilidad. */
const RESULTADOS: Row[] = [
  ['Ventas', 1200],
  ['Costo de ventas', -500],
  ['Utilidad bruta', null, true],
  ['Gastos', -300],
  ['Otros ingresos', 50],
  ['Impuestos', -135],
  ['Utilidad neta', null, true],
];

const registry = new Map([['waterfall', waterfall]]);

function prepared(rows: Row[], extra: Record<string, unknown> = {}) {
  const data = rows.map(([x, v, t]) => ({ x, v, t: t ?? false }));
  return prepare(
    {
      data,
      xField: 'x',
      xType: 'category',
      series: [{ type: 'waterfall', field: 'v', total: 't', name: 'Resultado', ...extra }],
    },
    registry,
    8,
  );
}

function series(rows: Row[], extra: Record<string, unknown> = {}): PreparedSeries {
  return prepared(rows, extra).series[0];
}

function context(
  ps: PreparedSeries,
  { width = 640, height = 320, y1 = ps.values, theme = LIGHT as Theme, d0 = NaN, d1 = NaN, horizontal = false } = {},
): DrawContext {
  const n = ps.values.length;
  const finite = [0, ...y1.filter(isFinite)];
  const lo = isFinite(d0) ? d0 : Math.min(...finite);
  const hi = isFinite(d1) ? d1 : Math.max(...finite) * 1.1 || 1;
  return {
    frame: { ps, y0: y1.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#5e2dad',
    pointColor: () => '#5e2dad',
    x: new BandScale(n, width),
    y: horizontal ? new LinearScale(lo, hi, 0, height) : new LinearScale(lo, hi, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => String(i),
    measure,
    format: (v) => String(v),
    compact: (v) => `${Math.round(v / 1000)} mil`,
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const format: TooltipFormat = {
  value: String,
  number: String,
  percent: (p) => `${Math.round(p * 100)} %`,
  isHidden: () => false,
  difference: (d) => signed(String, d),
};

const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test('marca de total: cualquier valor salvo vacío, false, 0 o "no"', () => {
  for (const t of ['true', '1', 'sí', 'x', 'Total']) assert.ok(isTotal(t), t);
  for (const t of ['', ' ', 'false', 'FALSE', '0', 'no', 'null', 'undefined']) assert.ok(!isTotal(t), t);
});

test('acumulados: las variaciones suman y un total sin valor muestra lo acumulado', () => {
  const { levels, gaps } = cascade(
    RESULTADOS.map((r) => r[1] ?? NaN),
    RESULTADOS.map((r) => !!r[2]),
  );
  assert.deepEqual(levels, [1200, 700, 700, 400, 450, 315, 315]);
  assert.deepEqual(gaps, [0, 0, 0, 0, 0, 0, 0]);
});

test('acumulados: un total con valor manda; si no coincide queda la diferencia, salvo al inicio', () => {
  // Saldo inicial marcado como total: no contradice nada.
  const a = cascade([500, 120, -80, 540], [true, false, false, true]);
  assert.deepEqual(a.levels, [500, 620, 540, 540]);
  assert.deepEqual(a.gaps, [0, 0, 0, 0]);
  // Un cierre que no cuadra: el acumulado sigue desde el valor dado.
  const b = cascade([100, 20, 130, 10], [false, false, true, false]);
  assert.deepEqual(b.levels, [100, 120, 130, 140]);
  assert.deepEqual(b.gaps, [0, 0, 10, 0]);
  // El redondeo de coma flotante no cuenta como diferencia.
  assert.deepEqual(cascade([0.1, 0.2, 0.3], [false, false, true]).gaps, [0, 0, 0]);
});

test('casos límite: vacío, un dato, ceros, huecos, todo negativo y totales seguidos', () => {
  assert.deepEqual(cascade([], []), { levels: [], gaps: [] });
  assert.deepEqual(cascade([42], [false]).levels, [42]);
  assert.deepEqual(cascade([0, 0], [false, false]).levels, [0, 0]);
  // Un hueco no cambia el acumulado; Infinity tampoco es un dato.
  assert.deepEqual(cascade([10, NaN, 5, Infinity, 1], [false, false, false, false, false]).levels, [10, NaN, 15, NaN, 16]);
  assert.deepEqual(cascade([-10, -20, NaN], [false, false, true]).levels, [-10, -30, -30]);
  // Totales seguidos repiten el acumulado; un total al inicio sin valor vale cero.
  assert.deepEqual(cascade([NaN, 5, NaN, NaN], [true, false, true, true]).levels, [0, 5, 5, 5]);
});

test('tramos: del acumulado anterior al nuevo; un total desde el cero; un hueco se salta', () => {
  assert.deepEqual(steps([100, 70, NaN, 90, 90], [false, false, false, false, true]), [
    { from: 0, to: 100 },
    { from: 100, to: 70 },
    null,
    { from: 70, to: 90 },
    { from: 0, to: 90 },
  ]);
  // Cruzar el cero: la barra va de un lado al otro.
  assert.deepEqual(steps([40, -60], [false, false])[1], { from: 40, to: -60 });
});

test('tipo de cada fila, total o subtotal y signo', () => {
  assert.deepEqual(
    [kindOf(5, false), kindOf(-5, false), kindOf(0, false), kindOf(-5, true), kindOf(NaN, true)],
    ['up', 'down', 'flat', 'total', 'total'],
  );
  const d = [10, NaN, 5, NaN, NaN];
  const t = [false, true, false, true, true];
  assert.deepEqual([isFinal(d, t, 1), isFinal(d, t, 3), isFinal(d, t, 4)], [false, true, true]);
  assert.deepEqual([signed(String, 12), signed(String, -12), signed(String, 0)], ['+12', '−12', '0']);
});

test('geometría: 24 px como máximo y grupos con 2 px entre barras', () => {
  assert.deepEqual(barGeometry(200, 0, 1), { width: 24, offset: -12, group: 24 });
  assert.ok(Math.abs(barGeometry(10, 0, 1).width - 7.2) < 1e-9);
  const a = barGeometry(40, 0, 2);
  const b = barGeometry(40, 1, 2);
  assert.ok(Math.abs(b.offset - (a.offset + a.width) - 2) < 1e-9);
});

test('barras huecas: el borde va por dentro y las muy bajas se rellenan', () => {
  assert.ok(hollowAt('down', 20, 24));
  assert.ok(!hollowAt('down', 3, 24) && !hollowAt('down', 20, 3) && !hollowAt('up', 20, 24) && !hollowAt('total', 20, 24));
  // Rellena: de 10 a 34 en X; hueca: medio trazo adentro por cada lado.
  assert.ok(barShape(10, 24, 100, 50, false).startsWith('M10,100'));
  assert.ok(barShape(10, 24, 100, 50, true).startsWith('M10.75,99.25'));
  // Una bajada tiene la punta abajo (la base arriba, en 50).
  assert.ok(barShape(10, 24, 50, 100, true).startsWith('M10.75,50.75'));
});

test('conectores: 1 px nítido del borde de una barra al de la siguiente; se cortan en un hueco', () => {
  const t = steps([100, 70, NaN, 90], [false, false, false, false]);
  const d = connectorPath(
    t,
    (i) => 50 + i * 100,
    (v) => 200 - v,
    24,
  );
  assert.equal(d, 'M62,100.5H138');
  // Con dos series, de grupo a grupo: la línea no cruza las barras de la otra.
  const two = barGeometry(100, 0, 2);
  assert.equal(
    connectorPath(
      t,
      (i) => 50 + i * 100,
      (v) => 200 - v,
      two.group,
    ),
    `M${50 + two.group / 2},100.5H${150 - two.group / 2}`,
  );
  // Totales seguidos: el conector corre a la altura del acumulado.
  const s = steps([5, 5, 5], [false, true, true]);
  assert.equal(
    connectorPath(
      s,
      (i) => i * 50,
      (v) => 100 - v,
      10,
    ),
    'M5,95.5H45M55,95.5H95',
  );
});

function labelInput(over: Partial<LabelInput>): LabelInput {
  const tramos = over.tramos ?? steps([100, 60], [false, false]);
  return {
    tramos,
    kinds: ['up', 'down'],
    exact: ['+100', '−40'],
    compact: ['+0 mil', '−0 mil'],
    center: (i) => 40 + i * 80,
    map: (v) => 220 - v * 2,
    measure,
    room: 76,
    length: 240,
    horizontal: false,
    ...over,
  };
}

test('etiquetas: encima de una subida, debajo de una bajada', () => {
  const [up, down] = placeLabels(labelInput({}));
  // Subida de 0 a 100: tope en 20 px; la etiqueta, 4 px arriba y centrada en su alto (12 px).
  assert.deepEqual(up, { i: 0, text: '+100', cross: 40, along: 10 });
  // Bajada de 100 a 60: borde inferior en 100 px.
  assert.deepEqual(down, { i: 1, text: '−40', cross: 120, along: 110 });
});

test('etiquetas: si se salen del área van del otro lado y, si tampoco caben, se omiten', () => {
  const tramos = steps([109, 60], [false, false]);
  const [up] = placeLabels(labelInput({ tramos }));
  // El tope queda a 2 px del borde: la etiqueta pasa debajo de la base (el cero, 220 px).
  assert.equal(up.along, 230);
  assert.deepEqual(
    placeLabels(labelInput({ tramos, length: 224 })).map((l) => l.i),
    [1],
  );
});

test('etiquetas: todas exactas o todas compactas; variaciones todas o ninguna, totales una por una', () => {
  const exact = ['+1200000000', '−4'];
  const compact = ['+1 mil M', '−4'];
  const both = placeLabels(labelInput({ exact, compact, room: 64 }));
  assert.deepEqual(
    both.map((l) => l.text),
    ['+1 mil M', '−4'],
  );
  // Si una variación no cabe ni compacta, no va ninguna.
  assert.deepEqual(placeLabels(labelInput({ exact, compact, room: 30 })), []);
  // Los totales van uno por uno: el que cabe se pone aunque las variaciones no quepan.
  const tramos = steps([1000, 1000, 1000], [false, false, true]);
  const kinds = ['up', 'flat', 'total'] as const;
  const totals = placeLabels(
    labelInput({
      tramos,
      kinds: [...kinds],
      exact: ['+1000000', '0', '1000000'],
      compact: ['+1.000 mil', '0', '1 M'],
      room: 40,
      map: (v) => 220 - v / 10,
    }),
  );
  assert.deepEqual(
    totals.map((l) => l.text),
    ['1 M'],
  );
  // Nunca más anchas que su banda: no se enciman con las vecinas.
  for (const l of placeLabels(labelInput({ room: 60 }))) assert.ok(measure(l.text) <= 60);
});

test('etiquetas en horizontal: el texto se extiende a lo largo del valor', () => {
  const [up] = placeLabels(labelInput({ horizontal: true, map: (v) => v * 2, length: 400 }));
  // Tope en 200 px; la etiqueta, 4 px a la derecha y centrada en su ancho (4 × 7 px).
  assert.equal(up.along, 218);
});

test('preparar: al eje van los acumulados y la variación queda como columna', () => {
  const ps = series(RESULTADOS);
  assert.deepEqual(ps.values, [1200, 700, 700, 400, 450, 315, 315]);
  assert.deepEqual(round(ps.columns.delta), [1200, -500, NaN, -300, 50, -135, NaN]);
  // El aire de las etiquetas: 8 % del recorrido (de 0 a 1200) hacia afuera del cero.
  assert.deepEqual(round(ps.columns.room), [1296, 796, 796, 496, 546, 411, 411]);
  assert.deepEqual(headroom([10, -30, NaN, 0], 0.1), [14, -34, NaN, 0]);
  assert.deepEqual(series(RESULTADOS, { labels: false }).columns.room, series(RESULTADOS, { labels: false }).values);
  assert.deepEqual(waterfall.texts!({ type: 'waterfall', field: 'v', total: 't' }, 'x'), { total: 't' });
  // El dominio no baja de cero aunque haya bajadas: cuenta el acumulado, no la variación.
  const f = buildFrame(prepared(RESULTADOS), new Set(), { ticks: 5 });
  assert.equal(f.d0, 0);
  assert.ok(f.d1 >= 1200);
});

test('preparar: un acumulado que cruza el cero amplía el eje abajo; un total que no cuadra avisa', () => {
  const f = buildFrame(
    prepared([
      ['Caja', 200],
      ['Pago', -500],
      ['Cobro', 150],
    ]),
    new Set(),
    { ticks: 5 },
  );
  assert.ok(f.d0 <= -300 && f.d1 >= 200);
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (s: string) => warnings.push(s);
  try {
    series([
      ['A', 100],
      ['B', 20],
      ['Cierre', 130, true],
    ]);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('"Resultado"') && warnings[0].includes('fila 3'));
});

test('dibujo: subidas rellenas, bajadas huecas y totales neutros, con conectores', () => {
  const ps = series(RESULTADOS);
  const d = waterfall.draw(context(ps));
  assert.ok(d.includes(`fill="#5e2dad"`), 'subidas del color de la serie');
  assert.ok(d.includes(`fill="${LIGHT.surface}" stroke="#5e2dad" stroke-width="1.5"`), 'bajadas huecas');
  assert.ok(d.includes(`fill="${LIGHT.other}"/>`), 'totales en el gris neutro');
  assert.ok(d.includes(`stroke="${LIGHT.zero}" stroke-width="1"`), 'conectores de 1 px');
  // Con una sola serie, los totales no llevan punta de color: un solo relleno del color, las subidas.
  assert.equal(d.match(/<path d="[^"]*" fill="#5e2dad"/g)?.length, 1);
  // Con varias cascadas lado a lado, sí: cada total dice de qué serie es.
  const ctx = context(ps);
  const two = waterfall.draw({ ...ctx, frame: { ...ctx.frame, slots: 2 } });
  assert.equal(two.match(/<path d="[^"]*" fill="#5e2dad"/g)?.length, 2);
  assert.deepEqual(texts(d), ['+1200', '−500', '700', '−300', '+50', '−135', '315']);
  // En oscuro, los colores del tema oscuro.
  const dark = waterfall.draw(context(ps, { theme: DARK }));
  assert.ok(dark.includes(`fill="${DARK.other}"/>`) && dark.includes(`fill="${DARK.surface}"`));
  assert.ok(!dark.includes(LIGHT.surface));
});

test('dibujo: todo negativo, un dato, ceros y huecos', () => {
  const neg = series([
    ['A', -100],
    ['B', -50],
    ['Total', null, true],
  ]);
  const d = waterfall.draw(context(neg, { d0: -200, d1: 0 }));
  // El total negativo lleva su etiqueta debajo, con el mismo signo menos que las variaciones.
  assert.deepEqual(texts(d), ['−100', '−50', '−150']);
  const one = waterfall.draw(context(series([['Solo', 42]])));
  assert.ok(one.includes('<path') && !one.includes('stroke-width="1"'), 'una barra, sin conectores');
  const zeros = waterfall.draw(
    context(
      series([
        ['A', 0],
        ['B', 0],
      ]),
      { d0: 0, d1: 1 },
    ),
  );
  assert.ok(!zeros.includes('fill="#5e2dad"'), 'una variación nula no dibuja barra');
  const gaps = series([
    ['A', 10],
    ['B', null],
    ['C', 5],
  ]);
  assert.ok(!waterfall.draw(context(gaps)).includes('stroke-width="1"'), 'el conector se corta en el hueco');
  assert.deepEqual(waterfall.navigable!(gaps), [0, 2]);
  assert.equal(waterfall.draw(context(series([]))), '');
});

test('animación: en el primer cuadro todo está en el cero y las barras se arman desde ahí', () => {
  const p = prepared(RESULTADOS);
  const start = collapse(buildFrame(p, new Set(), { ticks: 5 })).series[0];
  assert.ok(start.y1.every((v) => v === 0));
  const ps = p.series[0];
  // Solo los conectores, sobre el cero: ninguna barra tiene alto todavía.
  const first = waterfall.draw(context(ps, { y1: start.y1, d0: 0, d1: 1400 }));
  assert.equal(first.match(/<path/g)?.length, 1);
  assert.ok(first.includes(`stroke="${LIGHT.zero}"`));
  // A mitad de camino, cada acumulado va por la mitad y las etiquetas ya dicen el valor final.
  const half = ps.values.map((v) => v / 2);
  const mid = waterfall.draw(context(ps, { y1: half, d0: 0, d1: 1400 }));
  assert.ok(texts(mid).includes('+1200'));
});

test('horizontal: los textos se enderezan con el mismo reflejo del plano', () => {
  const d = waterfall.draw(context(series(RESULTADOS), { horizontal: true }));
  assert.ok(d.includes('transform="matrix(0 1 1 0 0 0)"'));
});

test('hover: un anillo de texto principal alrededor de la barra; nada en un hueco', () => {
  const ps = series([
    ['A', 10],
    ['B', null],
    ['C', -4],
  ]);
  const ctx = context(ps);
  assert.ok(waterfall.hover!(ctx, 0).includes(`stroke="${LIGHT.text}" stroke-width="2"`));
  assert.equal(waterfall.hover!(ctx, 1), '');
  assert.ok(waterfall.hover!(ctx, 2).startsWith('<path'));
});

test('tooltip: variación con signo, acumulado y tipo; los totales dicen si son subtotal', () => {
  const ps = series(RESULTADOS);
  assert.deepEqual(waterfall.tooltip!(ps, 1, format), {
    value: '−500',
    details: [
      ['Acumulado', '700'],
      ['Paso', 'Bajada'],
    ],
  });
  assert.deepEqual(waterfall.tooltip!(ps, 2, format), { value: '700', details: [['Paso', 'Subtotal']] });
  assert.deepEqual(waterfall.tooltip!(ps, 6, format), { value: '315', details: [['Paso', 'Total']] });
  const flat = series([['A', 0]]);
  assert.deepEqual(waterfall.tooltip!(flat, 0, format)?.details?.[1], ['Paso', 'Sin cambio']);
  assert.deepEqual(waterfall.tooltip!(series([['A', null]]), 0, format), { value: 'Sin dato' });
});

test('tooltip: un total que no cuadra da la diferencia sin explicar', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const ps = series([
      ['A', 100],
      ['B', 20],
      ['Cierre', 130, true],
    ]);
    assert.deepEqual(waterfall.tooltip!(ps, 2, format), {
      value: '130',
      details: [
        ['Paso', 'Total'],
        ['Diferencia sin explicar', '+10'],
      ],
    });
  } finally {
    console.warn = warn;
  }
});

test('textos escapados y opción labels: false', () => {
  const ps = series([['A', 10]]);
  const ctx = { ...context(ps), format: () => '<b>10 & "más"</b>' };
  const d = waterfall.draw(ctx);
  assert.ok(d.includes('&lt;b&gt;10 &amp; &quot;más&quot;&lt;/b&gt;'));
  assert.ok(!d.includes('<b>'));
  const off = waterfall.draw(context(series(RESULTADOS, { labels: false })));
  assert.ok(off.includes('<path') && !off.includes('<text'));
});

test('muestra del tooltip: un total en el gris de su barra; con varias cascadas, la serie', () => {
  const ps = series(RESULTADOS);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(ps, { theme });
    assert.ok(waterfall.draw(ctx).includes(`fill="${theme.other}"`));
    // Subidas y bajadas (la hueca también, rellena en la muestra) van en el color de la serie.
    assert.deepEqual(
      RESULTADOS.map((_, i) => waterfall.swatch!(ctx, i)),
      [null, null, theme.other, null, null, null, theme.other],
    );
  }
  // Lado a lado, los totales se distinguen por la punta del color de su serie: la muestra también.
  const base = context(ps);
  const clustered: DrawContext = { ...base, frame: { ...base.frame, slot: 0, slots: 2 } };
  assert.ok(RESULTADOS.every((_, i) => waterfall.swatch!(clustered, i) === null));
});

test('varias cascadas lado a lado deciden juntas sus etiquetas', () => {
  const base = (exact: string[]): LabelInput => ({
    tramos: exact.map((_, i) => ({ from: 0, to: 10 + i })),
    kinds: exact.map(() => 'up' as const),
    exact,
    compact: exact.map((t) => t.slice(0, 2)),
    center: (i) => i * 40,
    map: (v) => 300 - v,
    measure,
    room: 30,
    length: 300,
    horizontal: false,
  });
  // A cabe exacta; B solo compacta: las dos van compactas.
  const a = base(['+12', '+15']);
  const b = base(['+12000', '+15000']);
  assert.deepEqual(labelPlan(a), { compact: false, steps: true });
  assert.deepEqual(labelPlan(b), { compact: true, steps: true });
  assert.deepEqual(jointPlan([a, b]), { compact: true, steps: true });
  // Si en una no caben ni compactas, ninguna lleva las variaciones.
  const c = { ...base(['+123456', '+1']), compact: ['+12345', '+1'] };
  const plan = jointPlan([a, c]);
  assert.equal(plan.steps, false);
  assert.equal(placeLabels(a, plan).length, 0);
  assert.ok(placeLabels(a).length > 0, 'sola, A sí las llevaría');
});
