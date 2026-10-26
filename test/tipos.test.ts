/**
 * Casos de la revisión de los tipos uno por uno: lo que se veía mal o daba un dato falso con datos
 * difíciles (muchas filas, nombres larguísimos, varias series, negativos).
 */
import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { host, resize } from './dom';
import { LozChart, type LozChartOptions } from '../src/index';
import { countUp, maxOf } from '../src/series/common';
import { barGeometry } from '../src/series/bar';
import { bubbleMax } from '../src/series/scatter';
import { lookAt } from '../src/series/map';
import { sliceTooltip } from '../src/series/pie';
import { registerMap } from '../src/core/geo';
import { world } from '../src/maps/world';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';

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

test('barras agrupadas en bandas angostas: el grupo no se sale de su banda', () => {
  for (const step of [5, 8, 12, 40]) {
    for (const slots of [2, 3, 5]) {
      const g = barGeometry(step, 0, slots);
      assert.ok(g.group <= Math.max(step * 0.72, slots) + 1e-9, `paso ${step}, ${slots} series: grupo ${g.group}`);
      // El aire se achica antes que las barras.
      if (g.width > 1) assert.ok(g.group - slots * g.width >= 0);
    }
  }
  // Con lugar de sobra, todo como siempre: barras de 24 px y 2 px de aire.
  const wide = barGeometry(200, 1, 3);
  assert.equal(wide.width, 24);
  assert.equal(wide.group, 3 * 24 + 2 * 2);
  assert.equal(wide.offset, -wide.group / 2 + 26);
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

test('mapa de calor: con nombres larguísimos, las columnas se recortan y se nombra más de una', () => {
  resize(340);
  try {
    const largo = (k: number) => `Región Autónoma número ${k} de un nombre larguísimo 🌵`;
    const data = [0, 1, 2, 3, 4, 5].flatMap((k) => ['Mañana', 'Tarde'].map((f, j) => ({ c: largo(k), f, v: k + j })));
    const markup = svgOf({ data, xAxis: { field: 'c' }, series: [{ type: 'heatmap', field: 'v', y: 'f', name: 'V' }] });
    const cols = [...markup.matchAll(/>(Región Autónoma[^<]*)</g)].map((m) => m[1]);
    assert.ok(cols.length >= 2, `columnas con nombre: ${cols.length}`);
    assert.ok(cols.every((t) => t.endsWith('…')));
  } finally {
    resize(600);
  }
});

test('bala: con filas muy juntas no se dibujan los valores (se enciman); con lugar, sí', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ x: `P${i}`, v: 1001 + i, meta: 1100 }));
  const values = (markup: string) => (markup.match(/>1\.0\d\d</g) ?? []).length;
  const opts = (n: number): LozChartOptions => ({
    data: rows(n),
    xAxis: { field: 'x' },
    height: 280,
    series: [{ type: 'bullet', field: 'v', targetField: 'meta', name: 'V' }],
  });
  assert.equal(values(svgOf(opts(60))), 0);
  assert.equal(values(svgOf(opts(6))), 6);
});

test('pie: un valor negativo no se dibuja, el tooltip lo dice y la consola avisa una vez', () => {
  const format = {
    value: (v: number) => String(v),
    percent: (v: number) => `${Math.round(v * 1000) / 10} %`,
    isHidden: () => false,
  } as unknown as TooltipFormat;
  const ps = { values: [30, -10, 70] } as unknown as PreparedSeries;
  assert.deepEqual(sliceTooltip(ps, 1, format), { value: '-10', details: [['No aparece', 'vale menos de cero']] });
  assert.deepEqual(sliceTooltip(ps, 2, format), { value: '70 (70 %)' });

  const warn = console.warn;
  const seen: string[] = [];
  console.warn = (m: string) => seen.push(m);
  try {
    const c = new LozChart(host(), {
      data: [
        { x: 'A', v: 30 },
        { x: 'B', v: -10 },
        { x: 'C', v: 70 },
      ],
      xAxis: { field: 'x' },
      series: [{ type: 'pie', field: 'v', name: 'Ventas' }],
      animate: false,
    });
    c.redraw();
  } finally {
    console.warn = warn;
  }
  assert.equal(seen.length, 1);
  assert.match(seen[0], /"Ventas", la fila 2 tiene un valor negativo/);
});

test('countUp: el número que se anima lleva los decimales del valor final', () => {
  assert.equal(countUp(44.77, 75), 45);
  assert.equal(countUp(303.2, 1370), 303);
  assert.equal(countUp(12.345, 1370.5), 12.3);
  assert.equal(countUp(0.123456, 0.25), 0.12);
  assert.equal(countUp(7.5, NaN), 7.5);
});
