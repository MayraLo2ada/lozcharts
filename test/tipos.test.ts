/**
 * Casos de la revisión de los tipos uno por uno: lo que se veía mal o daba un dato falso con datos
 * difíciles (muchas filas, nombres larguísimos, varias series, negativos).
 */
import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { host } from './dom';
import { LozChart, type LozChartOptions } from '../src/index';
import { maxOf } from '../src/series/common';

const svgOf = (o: Partial<LozChartOptions> & Pick<LozChartOptions, 'data' | 'xAxis' | 'series'>) =>
  new LozChart(host(), { animate: false, ...o }).toSVG();

test('maxOf: como Math.max con un piso, sin tope de largo y sin contar huecos', () => {
  assert.equal(maxOf([3, NaN, 7, Infinity, -2]), 7);
  assert.equal(maxOf([], 0), 0);
  assert.equal(maxOf([-5, -3], 0), 0);
  const big = Array.from({ length: 200_000 }, (_, i) => i % 1000);
  assert.equal(maxOf(big, 0), 999);
});

test('dispersión y burbujas con 200 000 filas: se dibujan sin reventar la pila', () => {
  const data = Array.from({ length: 200_000 }, (_, i) => ({ x: i, y: (i * 7) % 101, s: 1 + (i % 50) }));
  const markup = svgOf({
    data,
    xAxis: { field: 'x', type: 'linear' },
    series: [
      { type: 'scatter', field: 'y', name: 'Puntos' },
      { type: 'bubble', field: 'y', size: 's', name: 'Burbujas' },
    ],
  });
  assert.ok(markup.includes('<circle'));
  assert.ok(!/NaN|Infinity/.test(markup));
});
