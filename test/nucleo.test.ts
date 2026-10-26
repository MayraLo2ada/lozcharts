import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { host, resize } from './dom';
import { LozChart, axisFormatter, niceDomain, numberTicks, valueFormatter, type LozChartOptions } from '../src/index';
import { prepare } from '../src/core/prepare';
import { fileName } from '../src/core/export';
import { registry } from './helpers';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun'];

function chart(options: Partial<LozChartOptions>): LozChart {
  return new LozChart(host(), {
    data: [],
    xAxis: { field: 'x' },
    series: [{ type: 'line', field: 'y' }],
    animate: false,
    ...options,
  } as LozChartOptions);
}

/** Corre `fn` juntando lo que avisa por consola. */
function warnings(fn: () => void): string[] {
  const seen: string[] = [];
  const warn = console.warn;
  console.warn = (s: string) => seen.push(s);
  try {
    fn();
  } finally {
    console.warn = warn;
  }
  return seen;
}

// ------------------------------------------------------------ Formatos

test('una moneda o un locale que Intl no conoce no rompen el gráfico: avisan y formatean igual', () => {
  const seen = warnings(() => {
    const ctx = { locale: 'es', currency: 'EURO' };
    assert.equal(valueFormatter('currency', ctx)(1500), '1.500');
    assert.match(axisFormatter('currency', ctx, 500, 2000)(1500), /^1,5\smil$/);
    assert.equal(valueFormatter('number', { locale: 'es_ES', currency: 'USD' })(1500), '1.500');
    const c = chart({
      currency: 'DOLAR',
      yAxis: { format: 'currency' },
      data: MESES.map((x, i) => ({ x, y: i * 1000 })),
    });
    assert.match(c.toSVG(), />5\smil</);
  });
  assert.ok(seen.length >= 1, 'avisa');
  assert.ok(seen.every((s) => s.startsWith('LozCharts:')));
});

test('números diminutos: el eje no se aplasta en cero y los textos los muestran', () => {
  const [d0, d1, step] = niceDomain(1e-13, 5e-13, 5);
  assert.ok(d1 > d0 && step > 0, `dominio ${d0}..${d1}`);
  const ticks = numberTicks(d0, d1, step);
  const fmt = axisFormatter('auto', { locale: 'es', currency: 'USD' }, step, d1);
  const labels = ticks.map(fmt);
  assert.equal(new Set(labels).size, labels.length, `etiquetas repetidas: ${labels.join(' | ')}`);
  assert.equal(valueFormatter('number', { locale: 'es', currency: 'USD' })(3e-13), '0,0000000000003');
  // El ruido de coma flotante se sigue limpiando.
  assert.deepEqual(numberTicks(0, 0.3, 0.1), [0, 0.1, 0.2, 0.3]);
});

// ------------------------------------------------------------ CSV y descargas

test('CSV: una X numérica negativa sale como número, sin el apóstrofo de las fórmulas', () => {
  const c = chart({
    xAxis: { field: 'x', type: 'linear' },
    data: [-3, -1, 0, 2].map((x) => ({ x, y: x * x })),
  });
  const rows = c.toCSV().replace('﻿', '').trim().split('\r\n');
  assert.deepEqual(rows, ['x,y', '-3,9', '-1,1', '0,0', '2,4']);
  // Un texto que empieza con "-" en una categoría sí se protege.
  const t = chart({ data: [{ x: '-SUMA(A1)', y: 1 }] });
  assert.match(t.toCSV(), /'-SUMA\(A1\)/);
});

test('CSV: las fechas salen en la hora local, sin correrse de día', () => {
  const c = chart({
    xAxis: { field: 'x', type: 'time' },
    data: [
      { x: '2026-01-01', y: 1 },
      { x: new Date(2026, 0, 2, 14, 30), y: 2 },
    ],
  });
  const rows = c.toCSV().replace('﻿', '').trim().split('\r\n');
  assert.deepEqual(rows, ['x,y', '2026-01-01,1', '2026-01-02 14:30,2']);
});

test('descargas: el nombre dado no repite la extensión; sin nombre, el título sin acentos', () => {
  assert.equal(fileName('ventas.csv', 'X', 'csv'), 'ventas');
  assert.equal(fileName('Año fiscal.PNG', undefined, 'png'), 'Año fiscal');
  assert.equal(fileName('informe.csv', undefined, 'png'), 'informe.csv');
  assert.equal(fileName(undefined, 'Ventas por año', 'svg'), 'ventas-por-ano');
  assert.equal(fileName('  ', '', 'svg'), 'lozchart');
});

// ------------------------------------------------------------ Tamaño

test('en horizontal, al ensancharse, el eje del valor se vuelve a redondear con más marcas', () => {
  resize(300);
  try {
    const c = chart({
      orientation: 'horizontal',
      data: [
        { x: 'a', y: 1100 },
        { x: 'b', y: 300 },
      ],
      series: [{ type: 'bar', field: 'y' }],
    });
    assert.match(c.toSVG(), />2\smil</, 'angosto: pocas marcas, el eje llega a 2 mil');
    resize(1400);
    const wide = c.toSVG();
    assert.doesNotMatch(wide, />2\smil</, 'ancho: no queda el eje de antes, con medio gráfico vacío');
    assert.match(wide, />1,1\smil</);
  } finally {
    resize(600);
  }
});

test('cien mil datos con etiquetas al final y su valor no exceden el límite de argumentos', () => {
  const data = Array.from({ length: 200_000 }, (_, i) => ({ x: i, y: Math.sin(i / 100) * 1000 }));
  const c = chart({ xAxis: { field: 'x', type: 'linear' }, endLabels: { value: true }, data });
  assert.match(c.toSVG(), /<svg/);
});

// ------------------------------------------------------------ Datos difíciles

test('avisa de un campo que no existe, de X inválidas y de nombres de serie repetidos', () => {
  const seen = warnings(() =>
    prepare(
      {
        data: [{ x: '2026-01-01', a: 1 }, { x: 'mañana', a: 2 }, { x: null, a: 3 }, null as never, 5 as never],
        xField: 'x',
        xType: 'time',
        series: [
          { type: 'line', field: 'a', name: 'Ventas' },
          { type: 'line', field: 'ventas', name: 'Ventas' },
        ],
      },
      registry,
      8,
    ),
  );
  assert.equal(seen.length, 4, seen.join('\n'));
  assert.match(seen[0], /2 de las filas de data no son objetos/);
  assert.match(seen[1], /2 de 3 filas no tienen una fecha válida .* en "x"/);
  assert.match(seen[2], /ninguna fila tiene el campo "ventas"/);
  assert.match(seen[3], /varias series que se llaman "Ventas"/);
});

test('avisa si ninguna fila tiene el campo de la X; con datos bien escritos, ningún aviso', () => {
  const seen = warnings(() =>
    prepare(
      { data: [{ mes: 'ene', y: 1 }], xField: 'Mes', xType: 'category', series: [{ type: 'line', field: 'y' }] },
      registry,
      8,
    ),
  );
  assert.equal(seen.length, 1);
  assert.match(seen[0], /"Mes"/);
  const none = warnings(() =>
    prepare(
      { data: [{ mes: 'ene', y: 1 }], xField: 'mes', xType: 'category', series: [{ type: 'line', field: 'y' }] },
      registry,
      8,
    ),
  );
  assert.deepEqual(none, []);
});

test('sin opciones o sin xAxis.field: un error que dice qué falta, y el elemento queda como estaba', () => {
  const el = host();
  const before = chart({ data: [{ x: 'a', y: 1 }] });
  assert.throws(() => new LozChart(el, undefined as never), /faltan las opciones/);
  assert.throws(() => new LozChart(el, { data: [], series: [] } as never), /xAxis\.field/);
  assert.equal(LozChart.getChart(el), undefined);
  assert.ok(LozChart.getChart(before.element));
});

test('descripción accesible: sin datos lo dice, y con todos los valores iguales no inventa un máximo', () => {
  const label = (c: LozChart) =>
    (c.element as unknown as { querySelector(s: string): { getAttribute(k: string): string } })
      .querySelector('svg')
      .getAttribute('aria-label');
  assert.match(label(chart({ title: 'Ventas' })), /^Ventas\. Gráfico de líneas, todavía sin datos\.$/);
  const flat = chart({ data: MESES.map((x) => ({ x, y: 7 })) });
  assert.match(label(flat), /Todos valen 7\./);
  assert.doesNotMatch(label(flat), /más alto/);
  const up = chart({ data: MESES.map((x, i) => ({ x, y: i })) });
  assert.match(label(up), /El más alto es jun, con 5\./);
});

test('sin datos: el elemento lleva data-empty, y lo pierde al llegar los datos', () => {
  const vacio = chart({});
  assert.ok(vacio.element.hasAttribute('data-empty'));
  vacio.setData(MESES.map((x, i) => ({ x, y: i })));
  assert.ok(!vacio.element.hasAttribute('data-empty'));
  vacio.setData([]);
  assert.ok(vacio.element.hasAttribute('data-empty'));
});
