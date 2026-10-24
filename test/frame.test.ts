import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrame, collapse, interpolate, withExits } from '../src/core/frame';
import { prep, round } from './helpers';

const ticks = { ticks: 5 };
const none = new Set<string>();

const ventas = prep(
  [
    { x: 'ene', a: 10, b: 5 },
    { x: 'feb', a: -4, b: 6 },
    { x: 'mar', a: 3, b: -2 },
  ],
  [
    { type: 'bar', field: 'a', stack: true },
    { type: 'bar', field: 'b', stack: true },
  ],
);

test('apilado: positivos y negativos se acumulan por separado', () => {
  const [a, b] = buildFrame(ventas, none, ticks).series;
  assert.deepEqual(
    [a.y0, a.y1],
    [
      [0, 0, 0],
      [10, -4, 3],
    ],
  );
  assert.deepEqual(
    [b.y0, b.y1],
    [
      [10, 0, 0],
      [15, 6, -2],
    ],
  );
});

test('solo el segmento exterior de cada pila lleva punta redondeada', () => {
  const [a, b] = buildFrame(ventas, none, ticks).series;
  assert.deepEqual(a.outer, [false, true, true]);
  assert.deepEqual(b.outer, [true, true, true]);
});

test('una serie oculta queda en su lugar con altura cero', () => {
  const [a, b] = buildFrame(ventas, new Set(['a']), ticks).series;
  assert.equal(a.alpha, 0);
  assert.deepEqual(a.y0, a.y1);
  assert.deepEqual(
    [b.y0, b.y1],
    [
      [0, 0, 0],
      [5, 6, -2],
    ],
  );
  assert.deepEqual(b.outer, [true, true, true]);
});

test('el dominio incluye el cero con barras y sale "bonito"', () => {
  const f = buildFrame(ventas, none, ticks);
  assert.ok(f.d0 <= -4 && f.d1 >= 15);
  assert.ok(Number.isInteger(f.d0 / 5) && Number.isInteger(f.d1 / 5));
});

test('las líneas no fuerzan el cero; min y max fijos mandan', () => {
  const precios = prep(
    [
      { x: 'a', v: 152 },
      { x: 'b', v: 198 },
    ],
    [{ type: 'line', field: 'v' }],
  );
  const f = buildFrame(precios, none, ticks);
  assert.ok(f.d0 > 0 && f.d0 <= 152);
  const fijo = buildFrame(precios, none, { ticks: 5, min: 0, max: 300 });
  assert.deepEqual([fijo.d0, fijo.d1], [0, 300]);
});

test('una línea oculta se apoya en el borde más cercano al cero', () => {
  const precios = prep(
    [
      { x: 'a', v: 152, w: 160 },
      { x: 'b', v: 198, w: 170 },
    ],
    [
      { type: 'line', field: 'v' },
      { type: 'line', field: 'w' },
    ],
  );
  const f = buildFrame(precios, new Set(['w']), ticks);
  assert.deepEqual(f.series[1].y1, [f.d0, f.d0]);
});

test('barras agrupadas: las visibles se reparten; una oculta queda entre vecinas', () => {
  const p = prep(
    [{ x: 'a', a: 1, b: 2, c: 3 }],
    ['a', 'b', 'c'].map((field) => ({ type: 'bar', field })),
  );
  const all = buildFrame(p, none, ticks).series;
  assert.deepEqual(
    all.map((f) => [f.slot, f.slots]),
    [
      [0, 3],
      [1, 3],
      [2, 3],
    ],
  );
  const sinB = buildFrame(p, new Set(['b']), ticks).series;
  assert.deepEqual(
    sinB.map((f) => [f.slot, f.slots]),
    [
      [0, 2],
      [0.5, 2],
      [1, 2],
    ],
  );
});

test('una pila ocupa una sola posición en el grupo', () => {
  const p = prep(
    [{ x: 'a', a: 1, b: 2, c: 3 }],
    [
      { type: 'bar', field: 'a', stack: true },
      { type: 'bar', field: 'b', stack: true },
      { type: 'bar', field: 'c' },
    ],
  );
  assert.deepEqual(
    buildFrame(p, none, ticks).series.map((f) => f.slot),
    [0, 0, 1],
  );
});

test('interpolar: t=0 es el origen, t=1 el destino, y en medio el promedio', () => {
  const to = buildFrame(ventas, none, ticks);
  const from = collapse(to);
  assert.deepEqual(interpolate(from, to, 0).series[0].y1, [0, 0, 0]);
  assert.deepEqual(round(interpolate(from, to, 1).series[1].y1), [15, 6, -2]);
  assert.deepEqual(round(interpolate(from, to, 0.5).series[0].y1), [5, -2, 1.5]);
  assert.equal(interpolate(from, to, 0.5).series[0].alpha, 0.5);
});

test('una serie que entra crece desde su base', () => {
  const solo = prep([{ x: 'a', a: 10, b: 5 }], [{ type: 'bar', field: 'a', stack: true }]);
  const ambas = prep(
    [{ x: 'a', a: 10, b: 5 }],
    [
      { type: 'bar', field: 'a', stack: true },
      { type: 'bar', field: 'b', stack: true },
    ],
  );
  const mid = interpolate(buildFrame(solo, none, ticks), buildFrame(ambas, none, ticks), 0.5);
  assert.deepEqual(mid.series[1].y1, [0 + (15 - 0) * 0.5]);
  assert.equal(mid.series[1].alpha, 0.5);
});

test('una serie que sale se encoge hacia su base y desaparece', () => {
  const ambas = buildFrame(
    prep(
      [{ x: 'a', a: 10, b: 5 }],
      [
        { type: 'bar', field: 'a', stack: true },
        { type: 'bar', field: 'b', stack: true },
      ],
    ),
    none,
    ticks,
  );
  const solo = buildFrame(prep([{ x: 'a', a: 10 }], [{ type: 'bar', field: 'a', stack: true }]), none, ticks);
  const dest = withExits(ambas, solo);
  assert.equal(dest.series.length, 2);
  const saliente = dest.series[1];
  assert.deepEqual([saliente.y0, saliente.y1, saliente.alpha], [[10], [10], 0]);
});

test('más datos que antes: los índices nuevos crecen desde la base', () => {
  const corto = buildFrame(prep([{ x: 'a', v: 4 }], [{ type: 'bar', field: 'v' }]), none, ticks);
  const largo = buildFrame(
    prep(
      [
        { x: 'a', v: 4 },
        { x: 'b', v: 8 },
      ],
      [{ type: 'bar', field: 'v' }],
    ),
    none,
    ticks,
  );
  assert.deepEqual(interpolate(corto, largo, 0.5).series[0].y1, [4, 4]);
});

test('apilado: un dato que falta es un hueco en su capa, no un cero', () => {
  const p = prep(
    [
      { x: 'a', a: 10, b: 5 },
      { x: 'b', a: null, b: 6 },
    ],
    [
      { type: 'area', field: 'a', stack: true },
      { type: 'area', field: 'b', stack: true },
    ],
  );
  const [a, b] = buildFrame(p, none, ticks).series;
  assert.ok(Number.isNaN(a.y1[1]));
  assert.deepEqual([b.y0[1], b.y1[1]], [0, 6]);
});
