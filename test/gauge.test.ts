import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  END_ANGLE,
  START_ANGLE,
  arcPath,
  gauge,
  gaugeLayout,
  hitGauge,
  lastFinite,
  valueAngle,
  valueFraction,
} from '../src/series/gauge';
import { polarPoint } from '../src/core/shapes';
import type { PreparedSeries, TooltipFormat } from '../src/core/series';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('gauge: el mínimo cae en el ángulo inicial y el máximo en el final', () => {
  close(valueAngle(0, 0, 100), START_ANGLE);
  close(valueAngle(100, 0, 100), END_ANGLE);
  close(valueAngle(50, 0, 100), -Math.PI / 2); // la mitad, arriba del todo
  close(END_ANGLE - START_ANGLE, (240 * Math.PI) / 180);
});

test('gauge: los valores fuera de rango se recortan al extremo', () => {
  assert.equal(valueFraction(-20, 0, 100), 0);
  assert.equal(valueFraction(140, 0, 100), 1);
  close(valueAngle(140, 0, 100), END_ANGLE);
  assert.equal(valueFraction(NaN, 0, 100), 0);
  assert.equal(valueFraction(5, 10, 10), 0); // rango vacío
});

test('gauge: ruta del arco con la bandera de arco largo correcta', () => {
  assert.equal(arcPath(0, 0, 10, 0, 0), '');
  assert.match(arcPath(0, 0, 10, START_ANGLE, END_ANGLE), /A10\.00,10\.00 0 1 1 /);
  assert.match(arcPath(0, 0, 10, START_ANGLE, START_ANGLE + 1), /A10\.00,10\.00 0 0 1 /);
  // Termina en el punto del ángulo final.
  const [x, y] = polarPoint(0, 0, 10, END_ANGLE);
  assert.ok(arcPath(0, 0, 10, START_ANGLE, END_ANGLE).endsWith(`${x.toFixed(2)},${y.toFixed(2)}`));
});

test('gauge: el layout cabe en 390 px de ancho', () => {
  for (const [w, h] of [
    [390, 300],
    [800, 300],
    [390, 600],
  ]) {
    const g = gaugeLayout(w, h);
    const half = g.r + g.thickness / 2;
    assert.ok(g.cx - half >= 0 && g.cx + half <= w, 'ancho');
    assert.ok(g.cy - half >= 0, 'arriba');
    assert.ok(g.cy + g.r / 2 + g.thickness / 2 + 18 <= h, 'abajo, con las etiquetas');
    close(g.thickness, g.r * 0.12);
  }
});

test('gauge: el hit-test respeta el grosor del arco', () => {
  const g = { cx: 100, cy: 100, r: 50, thickness: 6 };
  const top = (d: number) => hitGauge(g, 100, 100 - d, 0);
  assert.equal(top(50 + 2.9), true); // dentro del trazo
  assert.equal(top(50 + 3.1), false); // justo afuera
  assert.equal(top(10), true); // el centro, donde está el número
  // En la abertura de abajo, sobre el radio del arco, no hay nada.
  assert.equal(hitGauge(g, 100, 150, 0), false);
  // Sobre el extremo final del arco, sí.
  const [ex, ey] = polarPoint(100, 100, 50, END_ANGLE);
  assert.equal(hitGauge(g, ex, ey, 0), true);
  // La holgura amplía el anillo.
  assert.equal(hitGauge(g, 100, 100 - 55, 4), true);
});

test('gauge: muestra el último valor finito', () => {
  assert.equal(lastFinite([1, 2, NaN]), 1);
  assert.equal(lastFinite([NaN, NaN]), -1);
});

test('gauge: el tooltip trae meta y diferencia con signo', () => {
  const fmt = (v: number) => String(v);
  const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '');
  const format: TooltipFormat = {
    value: fmt,
    number: fmt,
    percent: fmt,
    isHidden: () => false,
    locale: 'es',
    difference: (d) => sign(d) + Math.abs(d),
  };
  const ps = { values: [40, 72], options: { target: 80 } } as unknown as PreparedSeries;
  assert.deepEqual(gauge.tooltip!(ps, 1, format), {
    value: '72',
    details: [
      ['Meta', '80'],
      ['Frente a la meta', '−8'],
    ],
  });
  const plain = { values: [72], options: {} } as unknown as PreparedSeries;
  assert.deepEqual(gauge.tooltip!(plain, 0, format), { value: '72' });
});

test('gauge: el teclado solo recorre el valor que se dibuja', () => {
  const ps = { values: [40, 72, NaN] } as unknown as PreparedSeries;
  assert.deepEqual(gauge.navigable!(ps), [1]);
});

test('gauge: se dibuja en cualquier cuadro de la animación y el número no usa el color de la serie', () => {
  const ctx = (v: number) =>
    ({
      frame: { ps: { name: 'Avance', values: [72], options: { target: 80 } }, y1: [v] },
      color: '#2a78d6',
      theme: { grid: '#eee', text: '#000', textMuted: '#555', surface: '#fff' },
      y: { d0: 0, d1: 100 },
      width: 390,
      height: 300,
      measure: (s: string) => s.length * 7,
      format: (x: number) => String(Math.round(x)),
      compact: (v: number) => String(Math.round(v)),
      percent: (v: number) => `${Math.round(v * 1000) / 10} %`,
    }) as unknown as Parameters<typeof gauge.draw>[0];
  for (const v of [0, 0.01, 36, 72, 150, NaN]) {
    const svg = gauge.draw(ctx(v));
    assert.ok(!svg.includes('NaN'), `sin NaN en ${v}`);
    assert.match(svg, /fill="#000"[^>]*font-weight="600"/);
  }
  // En el mínimo no hay arco de valor; con valor, sí.
  assert.ok(!gauge.draw(ctx(0)).includes('stroke="#2a78d6"'));
  assert.ok(gauge.draw(ctx(36)).includes('stroke="#2a78d6"'));
  // Fuera de rango: el arco se recorta, el número dice 150.
  assert.ok(gauge.draw(ctx(150)).includes('>150</text>'));
  assert.equal(gauge.hit!(ctx(72), 195, 150), 0);
  assert.equal(gauge.hit!(ctx(72), 2, 2), -1);
});
