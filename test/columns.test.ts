import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrame, collapse, interpolate } from '../src/core/frame';
import { stepPath } from '../src/core/shapes';
import { fitText } from '../src/core/axis';
import { prep, registry } from './helpers';
import { prepare } from '../src/core/prepare';

const ticks = { ticks: 5 };
const none = new Set<string>();

const temperaturas = prep(
  [
    { x: 'lun', max: 31, min: 24 },
    { x: 'mar', max: 33, min: 18 },
  ],
  [{ type: 'range', field: 'max', low: 'min' }],
);

test('las columnas extra se leen por el nombre que pide el tipo de serie', () => {
  assert.deepEqual(temperaturas.series[0].columns, { low: [24, 18] });
});

test('una columna sin campo indicado queda vacía', () => {
  const p = prep([{ x: 'a', v: 1 }], [{ type: 'range', field: 'v' }]);
  assert.ok(Number.isNaN(p.series[0].columns.low[0]));
});

test('las columnas en unidades del eje cuentan para el dominio', () => {
  const f = buildFrame(temperaturas, none, ticks);
  assert.ok(f.d0 <= 18 && f.d1 >= 33);
});

test('al ocultarse, las columnas en unidades del eje se encogen con la serie', () => {
  const f = buildFrame(temperaturas, new Set([temperaturas.series[0].key]), ticks);
  const s = f.series[0];
  assert.deepEqual(s.cols.low, s.y1);
});

test('las columnas extra se animan igual que el valor', () => {
  const to = buildFrame(temperaturas, none, ticks);
  const mid = interpolate(collapse(to), to, 0.5).series[0];
  const base = to.series[0].y0[0];
  assert.equal(mid.cols.low[0], base + (24 - base) * 0.5);
});

test('las columnas que no son del eje (tamaño) no se encogen ni cuentan para el dominio', () => {
  const p = prep(
    [
      { x: 1, v: 10, t: 5000 },
      { x: 2, v: 20, t: 100 },
    ],
    [{ type: 'bubble', field: 'v', size: 't' }],
    'linear',
  );
  const f = buildFrame(p, none, ticks);
  assert.ok(f.d1 < 100);
  assert.deepEqual(collapse(f).series[0].cols.size, [5000, 100]);
});

test('línea escalonada: después, antes y a mitad de camino', () => {
  const pts: [number, number][] = [
    [0, 10],
    [10, 20],
  ];
  assert.equal(stepPath(pts, 'after'), 'M0,10H10V20');
  assert.equal(stepPath(pts, 'before'), 'M0,10V20H10');
  assert.equal(stepPath(pts, 'middle'), 'M0,10H5V20H10');
});

test('recorte de etiquetas con "…" cuando no caben', () => {
  const measure = (s: string) => s.length * 10;
  assert.equal(fitText('Corto', 100, measure), 'Corto');
  assert.equal(fitText('Una categoría muy larga', 100, measure), 'Una categ…');
  assert.equal(fitText('Larga', 5, measure), '…');
});

test('domainValues: valores fijos de la serie (como la meta de un gauge) entran en el dominio', () => {
  const reg = new Map(registry);
  reg.set('meta', { domainValues: (o) => (o.target === undefined ? [] : [o.target]), draw: () => '' });
  const p = prepare(
    { data: [{ x: 'a', v: 72 }], xField: 'x', xType: 'category', series: [{ type: 'meta', field: 'v', target: 130 }] },
    reg,
    8,
  );
  assert.ok(buildFrame(p, new Set(), { ticks: 5 }).d1 >= 130);
});
