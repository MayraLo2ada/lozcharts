import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prep } from './helpers';

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
