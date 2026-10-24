import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseTimeInterval, detectTimeUnit, niceDomain, niceStep, numberTicks, timeTicks } from '../src/core/ticks';
import { axisFormatter, parseTime, timeFullLabel, timeTickLabel, valueFormatter } from '../src/core/format';
import { linePath } from '../src/core/shapes';

/** Intl separa número y unidad con espacios de no separación; para comparar, espacios normales. */
const plain = (s: string) => s.replace(/[  ]/g, ' ');
const es = { locale: 'es', currency: 'USD' };

test('ticks bonitos: pasos de 1, 2 o 5 × 10ⁿ', () => {
  assert.equal(niceStep(2350, 5), 500);
  assert.deepEqual(niceDomain(0, 2350, 5), [0, 2500, 500]);
  assert.deepEqual(niceDomain(-37, 112, 5).slice(0, 2), [-50, 150]);
  assert.deepEqual(numberTicks(0, 1, 0.2), [0, 0.2, 0.4, 0.6, 0.8, 1]);
});

test('dominio de un solo valor: se abre alrededor', () => {
  const [lo, hi] = niceDomain(50, 50, 5);
  assert.ok(lo < 50 && hi > 50);
  assert.deepEqual(niceDomain(0, 0, 5).slice(0, 2), [0, 1]);
});

test('eje Y compacto desde mil', () => {
  assert.deepEqual([0, 1000, 2000].map(axisFormatter('auto', es, 1000, 4000)).map(plain), ['0', '1 mil', '2 mil']);
  assert.equal(plain(axisFormatter('auto', es, 500, 3000)(1500)), '1,5 mil');
  assert.equal(plain(axisFormatter('currency', es, 20000, 80000)(40000)), '40 mil $');
});

test('valores exactos en el tooltip', () => {
  assert.equal(valueFormatter('number', es)(12345.678), '12.345,68');
  assert.equal(plain(valueFormatter('percent', es)(0.256)), '25,6 %');
  assert.equal(plain(valueFormatter('currency', es)(85391)), '85.391 $');
  assert.equal(plain(valueFormatter('currency', es)(19.5)), '19,50 $');
});

test('fechas AAAA-MM se leen en hora local', () => {
  const d = new Date(parseTime('2026-01'));
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 0, 1]);
});

test('etiquetas de fecha', () => {
  assert.equal(timeTickLabel(parseTime('2026-09'), 'month', 'es'), 'sept');
  assert.equal(timeTickLabel(parseTime('2026-01'), 'month', 'es'), '2026');
  assert.equal(timeFullLabel(parseTime('2026-03'), 'month', 'es'), 'Marzo de 2026');
});

test('intervalos de fecha según el espacio', () => {
  const months = Array.from({ length: 12 }, (_, i) => parseTime(`2026-${i + 1}`));
  assert.equal(detectTimeUnit(months), 'month');
  const iv = chooseTimeInterval(months[0], months[11], 6);
  assert.deepEqual([iv.unit, iv.every], ['month', 2]);
  assert.equal(timeTicks(months[0], months[11], iv).length, 6);
});

test('la curva monótona no se pasa de los datos', () => {
  const d = linePath(
    [
      [0, 10],
      [10, 50],
      [20, 52],
      [30, 10],
    ],
    true,
  );
  const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
  assert.ok(Math.max(...ys) <= 52 && Math.min(...ys) >= 10);
});

test('un hueco en los datos corta la línea', () => {
  const d = linePath(
    [
      [0, 1],
      [1, 2],
      [2, NaN],
      [3, 4],
      [4, 5],
    ],
    false,
  );
  assert.equal(d.match(/M/g)?.length, 2);
});
