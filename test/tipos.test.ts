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
import { bubbleMax } from '../src/series/scatter';
import type { DrawContext, PreparedSeries } from '../src/core/series';

const svgOf = (o: Partial<LozChartOptions> & Pick<LozChartOptions, 'data' | 'xAxis' | 'series'>) =>
  new LozChart(host(), { animate: false, ...o }).toSVG();

/** Radio mayor de los círculos de cada color de relleno. */
function radiiByFill(markup: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of markup.matchAll(/<circle[^>]* r="([\d.]+)" fill="([^"]+)" fill-opacity="0.75"/g)) {
    out.set(m[2], Math.max(out.get(m[2]) ?? 0, Number(m[1])));
  }
  return out;
}

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

test('burbujas: varias series comparten la escala del tamaño', () => {
  // La mayor de "Kioscos" vale la cuarta parte de la mayor de "Tiendas": la mitad del radio.
  const data = [10, 20, 30].map((x, i) => ({ x, a: 5 + i, b: 9 - i, s: [100, 400, 50][i], t: [25, 100, 10][i] }));
  const markup = svgOf({
    data,
    xAxis: { field: 'x', type: 'linear' },
    series: [
      { type: 'bubble', field: 'a', size: 's', name: 'Tiendas' },
      { type: 'bubble', field: 'b', size: 't', name: 'Kioscos' },
    ],
  });
  const radii = [...radiiByFill(markup).values()].sort((p, q) => q - p);
  assert.equal(radii.length, 2);
  assert.ok(Math.abs(radii[1] / radii[0] - 0.5) < 0.01, `radios ${radii.join(' y ')}`);

  // Con un contexto armado a mano (sin siblings), la escala es la de la propia serie.
  const ps = { columns: { size: [1, 8, NaN] } } as unknown as PreparedSeries;
  assert.equal(bubbleMax({ frame: { ps } } as unknown as DrawContext), 8);
});
