import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  barWidth,
  conversions,
  funnel,
  funnelLayout,
  percentLabel,
  ratio,
  roundedBar,
  rowAt,
  stageMax,
} from '../src/series/funnel';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { LIGHT } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;
const STAGES = ['Visitas', 'Carrito', 'Pago', 'Compra'];
const VALUES = [1000, 420, 210, 105];

function series(values: number[], labels?: boolean): PreparedSeries {
  return {
    key: 'v',
    name: 'v',
    impl: funnel,
    slot: 0,
    options: { type: 'funnel', field: 'v', labels },
    values,
    columns: {},
    stackKey: null,
    axis: 'left',
  };
}

function context(values: number[], width = 390, height = 240, labels?: boolean, y1 = values): DrawContext {
  const n = values.length;
  return {
    frame: { ps: series(values, labels), y0: values.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#2a78d6',
    pointColor: () => '#2a78d6',
    x: new BandScale(n, width),
    y: new LinearScale(0, 1000, height, 0),
    theme: LIGHT,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => STAGES[i] ?? '',
    measure,
    format: (v) => String(v),
    compact: (v: number) => String(Math.round(v)),
    percent: (v: number) => `${Math.round(v * 1000) / 10} %`,
  };
}

test('conversiones: del inicio y del paso anterior', () => {
  const { fromStart, fromPrev } = conversions(VALUES);
  assert.deepEqual(fromStart, [1, 0.42, 0.21, 0.105]);
  assert.ok(Number.isNaN(fromPrev[0]));
  assert.deepEqual(fromPrev.slice(1), [0.42, 0.5, 0.5]);
});

test('división por cero: etapas vacías dan NaN, no Infinity', () => {
  assert.ok(Number.isNaN(ratio(5, 0)));
  assert.ok(Number.isNaN(ratio(NaN, 10)));
  assert.equal(ratio(0, 10), 0);
  const { fromStart, fromPrev } = conversions([0, 0, 3]);
  assert.ok(fromStart.every(Number.isNaN));
  assert.ok(Number.isNaN(fromPrev[1]) && Number.isNaN(fromPrev[2]));
  assert.equal(stageMax([0, NaN, -2]), 0);
  assert.equal(barWidth(5, 0, 200), 0);
});

test('anchos proporcionales a la etapa mayor, acotados al área', () => {
  assert.equal(stageMax(VALUES), 1000);
  assert.equal(barWidth(1000, 1000, 200), 200);
  assert.equal(barWidth(420, 1000, 200), 84);
  assert.equal(barWidth(-5, 1000, 200), 0);
  assert.equal(barWidth(2000, 1000, 200), 200);
  // La mayor no tiene por qué ser la primera.
  assert.equal(barWidth(50, stageMax([50, 100]), 100), 50);
});

test('porcentajes enteros en las etiquetas, con el formato del gráfico', () => {
  const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;
  assert.equal(percentLabel(0.4237, pct), '42 %');
  assert.equal(percentLabel(0.004, pct), '<1 %');
  assert.equal(percentLabel(0, pct), '0 %');
  assert.equal(percentLabel(NaN, pct), '');
});

test('hit-test por filas: todo el ancho, -1 fuera del bloque', () => {
  assert.equal(rowAt(0, 0, 50, 4), 0);
  assert.equal(rowAt(49.9, 0, 50, 4), 0);
  assert.equal(rowAt(50, 0, 50, 4), 1);
  assert.equal(rowAt(199, 0, 50, 4), 3);
  assert.equal(rowAt(200, 0, 50, 4), -1);
  assert.equal(rowAt(-1, 0, 50, 4), -1);
  assert.equal(rowAt(10, 0, 0, 0), -1);
  const ctx = context(VALUES);
  const L = funnelLayout(390, 240, 4, null);
  // Tanto en la barra (centro) como en el borde izquierdo de la fila.
  assert.equal(funnel.hit!(ctx, 195, L.top + L.rowH * 2.5), 2);
  assert.equal(funnel.hit!(ctx, 1, L.top + L.rowH * 2.5), 2);
  assert.equal(funnel.hit!(ctx, 195, L.top - 1), -1);
});

test('layout: filas con tope y centradas; 2 px de separación', () => {
  const L = funnelLayout(390, 400, 3, null);
  assert.equal(L.rowH, 64);
  assert.equal(L.top, (400 - 64 * 3) / 2);
  assert.equal(L.areaW, 390);
  assert.equal(L.center, 195);
  const d = funnel.draw(context([10, 5, 2], 390, 400, false));
  assert.ok(d.includes(`M4,${L.top}`), 'la barra mayor ocupa todo el ancho');
  assert.ok(!d.includes('<text'), 'labels: false apaga las etiquetas');
});

test('layout a 390 px: prioridad nombre y valor > porcentaje > conversión', () => {
  const all = { name: 70, value: 60, percent: 40, conversion: 50 };
  const L = funnelLayout(390, 240, 4, all);
  assert.ok(L.showLabels && L.showPercent && L.showConversion);
  assert.ok(L.areaW >= 390 * 0.3);
  assert.ok(L.conversionX + all.conversion <= 390, 'nada se corta a la derecha, ni la columna de conversiones');
  // Valores largos: el porcentaje se suelta primero; la conversión se queda si cabe.
  const wide = funnelLayout(390, 240, 4, { name: 100, value: 90, percent: 50, conversion: 50 });
  assert.ok(wide.showLabels && !wide.showPercent && wide.showConversion);
  // Más largos aún: también la conversión; el nombre y el valor se quedan siempre.
  const wider = funnelLayout(390, 240, 4, { name: 150, value: 100, percent: 50, conversion: 130 });
  assert.ok(wider.showLabels && !wider.showPercent && !wider.showConversion);
  // Filas bajas: sin conversión; muy bajas: sin etiquetas.
  assert.ok(!funnelLayout(390, 100, 4, all).showConversion);
  assert.ok(!funnelLayout(390, 40, 4, all).showLabels);
});

test('draw: barras del color de la serie y textos del tema', () => {
  const d = funnel.draw(context(VALUES));
  assert.equal((d.match(/<path/g) ?? []).length, 1);
  assert.ok(d.includes('fill="#2a78d6"'));
  const texts = d.match(/<text[^>]*>/g) ?? [];
  assert.ok(texts.length > 0 && texts.every((t) => !t.includes('#2a78d6')));
  assert.ok(d.includes('>Carrito<') && d.includes('>420<') && d.includes('↓ 42 %'));
  assert.equal((d.match(/↓/g) ?? []).length, 3, 'una conversión entre cada par de etapas');
});

test('animación: las barras crecen desde el centro', () => {
  const half = VALUES.map((v) => v / 2);
  const ctx = context(VALUES, 390, 240, false, half);
  const [x, y] = funnel.anchor!(ctx, 0);
  assert.equal(x, 195 + 390 / 4);
  const L = funnelLayout(390, 240, 4, null);
  assert.equal(y, L.top + (L.rowH - 2) / 2);
});

test('hover: banda de toda la fila con el resaltado del tema', () => {
  const h = funnel.hover!(context(VALUES), 1);
  assert.ok(h.includes(`fill="${LIGHT.highlight}"`) && h.includes('width="390"'));
});

test('tooltip: del inicio y del paso anterior', () => {
  const format: TooltipFormat = {
    difference: (d: number) => String(d),
    value: String,
    number: String,
    percent: (p) => (p * 100).toFixed(1) + ' %',
    isHidden: () => false,
  };
  assert.deepEqual(funnel.tooltip!(series(VALUES), 0, format), { value: '1000', details: [['Del inicio', '100.0 %']] });
  assert.deepEqual(funnel.tooltip!(series(VALUES), 2, format), {
    value: '210',
    details: [
      ['Del inicio', '21.0 %'],
      ['Del paso anterior', '50.0 %'],
    ],
  });
  assert.deepEqual(funnel.tooltip!(series([0, 0]), 1, format), { value: '0', details: undefined });
});

test('roundedBar: radio de 4 px que se achica en barras cortas', () => {
  assert.equal(roundedBar(0, 0, 0, 10, 4), '');
  assert.ok(roundedBar(0, 0, 100, 20, 4).includes('A4,4'));
  assert.ok(roundedBar(0, 0, 4, 20, 4).includes('A2,2'));
});
