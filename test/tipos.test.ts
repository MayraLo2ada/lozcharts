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
import { lookAt } from '../src/series/map';
import { registerMap } from '../src/core/geo';
import { world } from '../src/maps/world';
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

test('globo: por defecto mira a los países con datos, aunque fit sea "all"', () => {
  registerMap('revision', world);
  const markup = svgOf({
    data: [
      { pais: 'Colombia', v: 10 },
      { pais: 'Perú', v: 20 },
    ],
    xAxis: { field: 'pais' },
    series: [{ type: 'choropleth', field: 'v', map: 'revision', projection: 'orthographic', name: 'V' }],
  });
  // Los dos países con datos se dibujan: están del lado que mira al frente.
  const fills = [...markup.matchAll(/<path[^>]* fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  const painted = new Set(fills.filter((f) => f !== '#e7e6e1' && f !== '#f2f1ee'));
  assert.ok(painted.size >= 2, `colores de los países: ${[...painted].join(', ')}`);

  // lookAt: cada lugar pesa lo mismo, y los puntos sueltos también cuentan.
  const square = (lon: number, lat: number, n: number) => ({
    properties: {},
    polygons: [[Array.from({ length: n }, (_, k) => [lon + Math.cos(k) * 0.1, lat + Math.sin(k) * 0.1] as [number, number])]],
  });
  const [lon, lat] = lookAt([square(10, 0, 4), square(30, 0, 400)] as never);
  assert.ok(Math.abs(lon - 20) < 0.5 && Math.abs(lat) < 0.5, `${lon}, ${lat}`);
  const [plon] = lookAt([], [[-70, 0]]);
  assert.ok(Math.abs(plon + 70) < 1e-6);
});
