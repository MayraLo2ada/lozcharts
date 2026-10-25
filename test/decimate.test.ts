import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawIndices } from '../src/core/decimate';
import { toCSV } from '../src/core/export';
import { ContinuousScale } from '../src/core/scales';

const xs = (n: number) => Array.from({ length: n }, (_, i) => i);

test('con pocos datos se dibujan todos', () => {
  const x = new ContinuousScale(xs(50), 100);
  assert.deepEqual(drawIndices(x, 100, xs(50)), xs(50));
});

test('con muchos datos: los extremos de cada columna de px, ningún pico se pierde', () => {
  const n = 10_000;
  const values = xs(n).map((i) => Math.sin(i / 50));
  values[4321] = 99; // un pico aislado
  values[8765] = -99;
  const x = new ContinuousScale(xs(n), 100);
  const idx = drawIndices(x, 100, values);
  assert.ok(idx.length <= 100 * 4 + 2, `${idx.length} índices`);
  assert.ok(idx.includes(4321) && idx.includes(8765));
  assert.ok(idx.includes(0) && idx.includes(n - 1));
  assert.deepEqual(
    idx,
    [...idx].sort((a, b) => a - b),
  );
});

test('un hueco sigue siendo hueco al reducir', () => {
  const n = 10_000;
  const values = xs(n).map((i) => (i >= 5000 && i < 5003 ? NaN : i % 7));
  const idx = drawIndices(new ContinuousScale(xs(n), 100), 100, values);
  assert.ok(idx.some((i) => Number.isNaN(values[i])));
});

test('con zoom solo se dibuja la ventana, más un vecino de cada lado', () => {
  const x = new ContinuousScale(xs(1000), 100, undefined, { start: 0.5, end: 0.55 });
  const idx = drawIndices(x, 100, xs(1000));
  assert.equal(idx[0], 499);
  assert.equal(idx[idx.length - 1], 550);
});

test('CSV: comillas, comas y saltos de línea escapados; BOM para Excel', () => {
  const csv = toCSV([
    ['Mes', 'Ventas'],
    ['Enero, 2026', 1200.5],
    ['Dijo "hola"', NaN],
  ]);
  assert.equal(csv, '﻿Mes,Ventas\r\n"Enero, 2026",1200.5\r\n"Dijo ""hola""",\r\n');
});

test('CSV: un texto que parece fórmula no se ejecuta en la hoja de cálculo', () => {
  const csv = toCSV([['=HYPERLINK("x")', '@SUM(1)', '-5', -5, 'normal']]);
  assert.equal(csv, '\ufeff"\'=HYPERLINK(""x"")",\'@SUM(1),\'-5,-5,normal\r\n');
});
