import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignRight, buildFrame } from '../src/core/frame';
import { prepare } from '../src/core/prepare';
import { registry } from './helpers';

const data = [
  { x: 'ene', ventas: 92000, visitas: 41000 },
  { x: 'feb', ventas: 105000, visitas: 46500 },
  { x: 'mar', ventas: 118000, visitas: 52300 },
];
const series = [
  { type: 'bar', field: 'ventas', name: 'Ventas' },
  { type: 'line', field: 'visitas', name: 'Visitas', axis: 'right' as const },
];

test('una serie con axis: "right" va al eje derecho solo si está permitido', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const si = prepare({ data, xField: 'x', xType: 'category', series, rightAxis: true }, registry, 8);
  assert.deepEqual(
    si.series.map((s) => s.axis),
    ['left', 'right'],
  );
  const no = prepare({ data, xField: 'x', xType: 'category', series, rightAxis: false }, registry, 8);
  assert.deepEqual(
    no.series.map((s) => s.axis),
    ['left', 'left'],
  );
  assert.equal(warn.mock.callCount(), 1);
});

test('doble eje: los dos incluyen el cero y tienen la misma cantidad de ticks', () => {
  const p = prepare({ data, xField: 'x', xType: 'category', series, rightAxis: true }, registry, 8);
  const f = buildFrame(p, new Set(), { ticks: 5 });
  assert.ok(f.right);
  assert.equal(f.d0, 0);
  assert.equal(f.right.d0, 0);
  const ticksLeft = Math.round((f.d1 - f.d0) / f.step);
  const ticksRight = Math.round((f.right.d1 - f.right.d0) / f.right.step);
  assert.equal(ticksLeft, ticksRight);
  assert.ok(f.right.d1 >= 52300);
});

test('doble eje: aunque la línea no lo pida, el eje derecho arranca en cero', () => {
  const p = prepare({ data, xField: 'x', xType: 'category', series, rightAxis: true }, registry, 8);
  assert.equal(buildFrame(p, new Set(), { ticks: 5 }).right!.d0, 0);
});

test('alinear: con negativos, el cero queda a la misma altura en los dos ejes', () => {
  const left = { d0: -20, d1: 60, step: 20 }; // 1 tick abajo del cero, 3 arriba
  const right = alignRight([-3, 11], left, {});
  assert.equal(right.d0 / right.step, -1);
  assert.equal(right.d1 / right.step, 3);
  assert.ok(right.d1 >= 11 && right.d0 <= -3);
});

test('alinear: el paso derecho es el menor "bonito" donde caben los datos', () => {
  assert.deepEqual(alignRight([0, 52300], { d0: 0, d1: 150000, step: 50000 }, {}), { d0: 0, d1: 60000, step: 20000 });
  assert.deepEqual(alignRight([0, 23], { d0: 0, d1: 100, step: 25 }, {}), { d0: 0, d1: 10 * 4, step: 10 });
});

test('alinear: si los signos no encajan, el eje derecho queda con su propio dominio desde cero', () => {
  const right = alignRight([0, 80], { d0: -60, d1: 0, step: 20 }, {});
  assert.equal(right.d0, 0);
  assert.ok(right.d1 >= 80);
});

test('sin series en el eje derecho no hay eje derecho', () => {
  const p = prepare({ data, xField: 'x', xType: 'category', series: [series[0]], rightAxis: true }, registry, 8);
  assert.equal(buildFrame(p, new Set(), { ticks: 5 }).right, null);
});
