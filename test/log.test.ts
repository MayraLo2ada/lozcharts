import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logDomain, logTicks } from '../src/core/ticks';
import { LogScale } from '../src/core/scales';
import { buildFrame, interpolate } from '../src/core/frame';
import { prep } from './helpers';

test('marcas logarítmicas: 1, 2 y 5 × 10ⁿ si caben; si no, potencias de 10', () => {
  assert.deepEqual(logTicks(10, 100, 5), [10, 20, 50, 100]);
  assert.deepEqual(logTicks(1, 100000, 5), [1, 10, 100, 1000, 10000, 100000]);
  assert.deepEqual(logTicks(0.01, 10, 5), [0.01, 0.1, 1, 10]);
  // Muchas décadas: una de cada k, desde el mínimo.
  assert.deepEqual(logTicks(1, 1e12, 5), [1, 1e3, 1e6, 1e9, 1e12]);
  assert.deepEqual(logTicks(0, 10, 5), [], 'sin dominio positivo no hay marcas');
});

test('dominio logarítmico: extremos redondos que son marcas del eje', () => {
  assert.deepEqual(logDomain(12, 87, 5), [10, 100]);
  assert.deepEqual(logDomain(23, 47, 5), [20, 50]);
  assert.deepEqual(logDomain(3, 90000, 5), [1, 100000]);
  assert.deepEqual(logDomain(100, 100, 5), [50, 200], 'un solo valor queda entre sus vecinos redondos');
  assert.deepEqual(logDomain(NaN, NaN, 5), [1, 10]);
  for (const [lo, hi] of [
    [12, 87],
    [0.003, 4],
    [7, 7e7],
  ]) {
    const [d0, d1] = logDomain(lo, hi, 5);
    const ticks = logTicks(d0, d1, 5);
    assert.equal(ticks[0], d0);
    assert.ok(d0 <= lo && d1 >= hi);
  }
});

test('escala logarítmica: cada década mide lo mismo y un valor no positivo va al borde', () => {
  const s = new LogScale(1, 1000, 300, 0);
  assert.equal(s.map(1), 300);
  assert.equal(s.map(1000), 0);
  assert.ok(Math.abs(s.map(10) - 200) < 1e-9 && Math.abs(s.map(100) - 100) < 1e-9);
  assert.equal(s.map(0), 300);
  assert.equal(s.map(-5), 300);
  assert.ok(Math.abs(s.invert(100) - 100) < 1e-9);
});

test('cuadro logarítmico: solo cuentan los positivos, sin el cero, y las barras se apoyan en el mínimo', () => {
  const p = prep(
    [
      { x: 'a', v: 0 },
      { x: 'b', v: 30 },
      { x: 'c', v: 800 },
    ],
    [{ type: 'bar', field: 'v' }],
  );
  const f = buildFrame(p, new Set(), { ticks: 5, log: true });
  assert.equal(f.log, true);
  assert.deepEqual([f.d0, f.d1], [20, 1000]);
  assert.deepEqual(f.series[0].y0, [20, 20, 20]);
  // Un mínimo que no es positivo se ignora; uno positivo manda.
  assert.equal(buildFrame(p, new Set(), { ticks: 5, log: true, min: 0 }).d0, 20);
  assert.equal(buildFrame(p, new Set(), { ticks: 5, log: true, min: 25 }).d0, 25);
});

test('al animar un eje logarítmico, el dominio avanza en su escala', () => {
  const p = prep([{ x: 'a', v: 5 }], [{ type: 'line', field: 'v' }]);
  const a = { ...buildFrame(p, new Set(), { ticks: 5, log: true }), d0: 1, d1: 10 };
  const b = { ...a, d0: 100, d1: 1000 };
  const mid = interpolate(a, b, 0.5);
  assert.ok(Math.abs(mid.d0 - 10) < 1e-9 && Math.abs(mid.d1 - 100) < 1e-9);
});
