import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prep, registry } from './helpers';
import { prepare } from '../src/core/prepare';

test('en tiempo, las filas se ordenan por fecha y se descartan las inválidas', () => {
  const p = prep(
    [
      { x: '2026-03', v: 3 },
      { x: 'no es fecha', v: 9 },
      { x: '2026-01', v: 1 },
    ],
    [{ type: 'line', field: 'v' }],
    'time',
  );
  assert.equal(p.n, 2);
  assert.deepEqual(p.series[0].values, [1, 3]);
  assert.equal(p.timeUnit, 'month');
});

test('vacíos y nulos son huecos (NaN), no ceros', () => {
  const p = prep(
    [
      { x: 'a', v: null },
      { x: 'b', v: '' },
      { x: 'c', v: 0 },
    ],
    [{ type: 'line', field: 'v' }],
  );
  assert.ok(Number.isNaN(p.series[0].values[0]) && Number.isNaN(p.series[0].values[1]));
  assert.equal(p.series[0].values[2], 0);
});

test('el color sigue al orden de la serie; `color` lo fija', () => {
  const p = prep(
    [{ x: 'a', a: 1, b: 2 }],
    [
      { type: 'bar', field: 'a' },
      { type: 'bar', field: 'b', color: 5 },
    ],
  );
  assert.deepEqual(
    p.series.map((s) => s.slot),
    [0, 4],
  );
});

test('más de 8 series apiladas del mismo grupo: las sobrantes se suman en "Otros"', () => {
  const fields = 'abcdefghij'.split('');
  const row: Record<string, unknown> = { x: 'ene' };
  fields.forEach((f, i) => (row[f] = i + 1));
  const p = prep(
    [row],
    fields.map((f) => ({ type: 'bar', field: f, stack: true })),
  );
  assert.equal(p.series.length, 8);
  const others = p.series[7];
  assert.equal(others.name, 'Otros');
  assert.equal(others.slot, -1);
  assert.deepEqual(others.values, [8 + 9 + 10]);
});

test('más de 8 series que no se pueden agrupar: se muestran 8', (t) => {
  t.mock.method(console, 'warn', () => {});
  const fields = 'abcdefghij'.split('');
  const p = prep(
    [{ x: 'a' }],
    fields.map((f) => ({ type: 'line', field: f })),
  );
  assert.equal(p.series.length, 8);
});

test('un tipo no registrado se ignora con aviso', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const p = prep(
    [{ x: 'a', v: 1 }],
    [
      { type: 'pastel', field: 'v' },
      { type: 'line', field: 'v' },
    ],
  );
  assert.equal(p.series.length, 1);
  assert.equal(warn.mock.callCount(), 1);
});

test('las barras activan la escala de banda', () => {
  assert.equal(prep([{ x: 'a', v: 1 }], [{ type: 'bar', field: 'v' }]).band, true);
  assert.equal(prep([{ x: 'a', v: 1 }], [{ type: 'line', field: 'v' }]).band, false);
});

test('índice base 100: cada serie se divide por su primer valor; los originales quedan en raw', () => {
  const p = prepare(
    {
      data: [
        { x: 'a', v: 50, w: 2000 },
        { x: 'b', v: 60, w: 1800 },
      ],
      xField: 'x',
      xType: 'category',
      series: [
        { type: 'line', field: 'v' },
        { type: 'line', field: 'w' },
      ],
      index: true,
    },
    registry,
    8,
  );
  assert.deepEqual(p.series[0].values, [100, 120]);
  assert.deepEqual(p.series[1].values, [100, 90]);
  assert.deepEqual(p.series[1].raw, [2000, 1800]);
});

test('índice base 100: un hueco al inicio toma el primer valor que exista como base', () => {
  const p = prepare(
    {
      data: [
        { x: 'a', v: null },
        { x: 'b', v: 40 },
        { x: 'c', v: 50 },
      ],
      xField: 'x',
      xType: 'category',
      series: [{ type: 'line', field: 'v' }],
      index: true,
    },
    registry,
    8,
  );
  assert.ok(Number.isNaN(p.series[0].values[0]));
  assert.deepEqual(p.series[0].values.slice(1), [100, 125]);
});

test('índice base 100: sin un primer valor positivo, la serie queda vacía con aviso', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const p = prepare(
    {
      data: [
        { x: 'a', v: -5 },
        { x: 'b', v: 10 },
      ],
      xField: 'x',
      xType: 'category',
      series: [{ type: 'line', field: 'v' }],
      index: true,
    },
    registry,
    8,
  );
  assert.ok(p.series[0].values.every(Number.isNaN));
  assert.equal(warn.mock.callCount(), 1);
});

test('los tipos libres (pie, gauge, embudo) muestran una sola serie, con aviso', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const libre = new Map(registry);
  libre.set('gauge', { coords: 'free', draw: () => '' });
  const p = prepare(
    {
      data: [{ x: 'a', v: 1, w: 2 }],
      xField: 'x',
      xType: 'category',
      series: [
        { type: 'gauge', field: 'v' },
        { type: 'gauge', field: 'w' },
      ],
    },
    libre,
    8,
  );
  assert.equal(p.series.length, 1);
  assert.equal(warn.mock.callCount(), 1);
});
