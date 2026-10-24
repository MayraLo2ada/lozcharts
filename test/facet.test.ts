import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facetPanels } from '../src/core/facet';
import type { LozChartOptions, MultiplesOptions } from '../src/types';

const series = [
  { type: 'line', field: 'online', name: 'Online' },
  { type: 'line', field: 'tienda', name: 'Tienda' },
];

const ventas = [
  { mes: 'ene', region: 'Norte', online: 1, tienda: 2 },
  { mes: 'feb', region: 'Norte', online: 3, tienda: 4 },
  { mes: 'ene', region: 'Sur', online: 5, tienda: 6 },
  { mes: 'mar', region: 'Sur', online: 7, tienda: 8 },
];

const base = (o: MultiplesOptions): LozChartOptions => ({ ...o, legend: false });

test('por serie: un panel por serie, con su color original', () => {
  const o: MultiplesOptions = { facet: 'series', data: ventas, xAxis: { field: 'mes' }, series };
  const panels = facetPanels(o, base(o));
  assert.deepEqual(
    panels.map((p) => [p.name, p.options.title, p.options.series.length, p.options.series[0].color]),
    [
      ['Online', 'Online', 1, 1],
      ['Tienda', 'Tienda', 1, 2],
    ],
  );
});

test('por campo: un panel por valor, en orden de aparición', () => {
  const o: MultiplesOptions = { facet: { field: 'region' }, data: ventas, xAxis: { field: 'mes' }, series };
  assert.deepEqual(
    facetPanels(o, base(o)).map((p) => p.name),
    ['Norte', 'Sur'],
  );
});

test('por campo: `order` fija el orden y descarta valores que no existen', () => {
  const o: MultiplesOptions = {
    facet: { field: 'region', order: ['Sur', 'Este', 'Norte'] },
    data: ventas,
    xAxis: { field: 'mes' },
    series,
  };
  assert.deepEqual(
    facetPanels(o, base(o)).map((p) => p.name),
    ['Sur', 'Norte'],
  );
});

test('por campo: todos los paneles tienen las mismas X, en el mismo orden; las que faltan son huecos', () => {
  const o: MultiplesOptions = { facet: { field: 'region' }, data: ventas, xAxis: { field: 'mes' }, series };
  const [norte, sur] = facetPanels(o, base(o));
  assert.deepEqual(
    norte.options.data.map((r) => r.mes),
    ['ene', 'feb', 'mar'],
  );
  assert.deepEqual(
    sur.options.data.map((r) => r.mes),
    ['ene', 'feb', 'mar'],
  );
  assert.equal(norte.options.data[2].online, undefined);
  assert.equal(sur.options.data[1].online, undefined);
});

test('por campo con fechas: "2026-01" y una Date del mismo día son la misma X', () => {
  const data = [
    { d: '2026-01', g: 'A', v: 1 },
    { d: new Date(2026, 0, 1), g: 'B', v: 2 },
  ];
  const o: MultiplesOptions = {
    facet: { field: 'g' },
    data,
    xAxis: { field: 'd', type: 'time' },
    series: [{ type: 'line', field: 'v' }],
  };
  const panels = facetPanels(o, base(o));
  assert.deepEqual(
    panels.map((p) => p.options.data.length),
    [1, 1],
  );
});

test('por serie: cada panel usa el formato de su serie en el eje', () => {
  const o: MultiplesOptions = {
    facet: 'series',
    data: ventas,
    xAxis: { field: 'mes' },
    yAxis: { format: 'number' },
    series: [
      { type: 'line', field: 'online', name: 'Ventas', format: 'currency' },
      { type: 'line', field: 'tienda', name: 'Visitas' },
    ],
  };
  assert.deepEqual(
    facetPanels(o, base(o)).map((p) => p.options.yAxis?.format),
    ['currency', 'number'],
  );
});
