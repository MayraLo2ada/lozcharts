import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampView,
  FULL_VIEW,
  isFull,
  minSpan,
  panView,
  valueAt,
  valueFraction,
  valueTicks,
  visibleIndices,
  windowDomain,
  zoomView,
} from '../src/core/view';
import { BandScale, ContinuousScale } from '../src/core/scales';
import { buildFrame } from '../src/core/frame';
import { chooseTimeInterval, detectTimeUnit } from '../src/core/ticks';
import { parseTime } from '../src/core/format';
import { prep } from './helpers';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('ventana: nunca sale de [0, 1] ni queda más angosta que el mínimo', () => {
  assert.deepEqual(clampView(-0.2, 0.3, 0.1), { start: 0, end: 0.5 });
  const v = clampView(0.9, 1.3, 0.1);
  assert.ok(near(v.start, 0.6) && near(v.end, 1));
  const tiny = clampView(0.5, 0.5001, 0.1);
  assert.ok(near(tiny.end - tiny.start, 0.1) && near((tiny.start + tiny.end) / 2, 0.50005));
  assert.equal(clampView(0, 1.5, 0.1), FULL_VIEW);
  assert.ok(isFull(clampView(NaN, 1, 0.1)));
});

test('acercar deja quieto lo que está bajo el puntero', () => {
  const v = { start: 0.2, end: 0.6 };
  // El puntero a un cuarto de lo visible: en el eje completo, 0,3.
  const z = zoomView(v, 0.25, 2, 0.01);
  assert.ok(near(z.end - z.start, 0.2));
  assert.ok(near(z.start + 0.25 * (z.end - z.start), 0.3));
  // Alejar más allá de todo vuelve a todo.
  assert.ok(isFull(zoomView(v, 0.5, 0.1, 0.01)));
});

test('mover la ventana conserva su tamaño y frena en los bordes', () => {
  const v = panView({ start: 0.7, end: 0.9 }, 0.5);
  assert.ok(near(v.start, 0.8) && near(v.end, 1));
  const w = panView({ start: 0.1, end: 0.3 }, -1);
  assert.ok(near(w.start, 0) && near(w.end, 0.2));
});

test('tramo mínimo: cinco bandas o cinco puntos', () => {
  assert.equal(minSpan(10, true), 0.5);
  assert.ok(near(minSpan(11, false), 0.4));
  assert.equal(minSpan(4, true), 1);
  assert.equal(minSpan(2, true), 1);
});

test('con zoom sobre datos diarios, el eje no muestra horas', () => {
  const t0 = parseTime('2026-03-10');
  assert.notEqual(chooseTimeInterval(t0, t0 + 4 * 86_400_000, 12).unit, 'day');
  assert.equal(chooseTimeInterval(t0, t0 + 4 * 86_400_000, 12, 'day').unit, 'day');
});

test('escala de banda con zoom: estira y corre el eje', () => {
  // 10 bandas en 100 px; se ve de la 3.ª a la 4.ª (fracción 0,2 a 0,4).
  const x = new BandScale(10, 100, { start: 0.2, end: 0.4 });
  assert.equal(x.bandwidth, 50);
  assert.ok(near(x.at(2), 25));
  assert.ok(near(x.at(3), 75));
  assert.ok(x.at(1) < 0 && x.at(4) > 100);
  assert.equal(x.indexAt(10), 2);
  assert.equal(x.indexAt(60), 3);
  assert.deepEqual(visibleIndices(x, 100), [2, 3]);
});

test('escala continua con zoom: el dominio visible es la ventana', () => {
  const x = new ContinuousScale([0, 10, 20, 30, 40], 200, undefined, { start: 0.25, end: 0.75 });
  assert.deepEqual(x.domain, [10, 30]);
  assert.equal(x.at(1), 0);
  assert.equal(x.at(3), 200);
  assert.equal(x.indexAt(90), 2);
  assert.deepEqual(visibleIndices(x, 200), [1, 3]);
  assert.equal(visibleIndices(new ContinuousScale([0, 10], 100, undefined, { start: 0.3, end: 0.6 }), 100), null);
});

test('con zoom, el eje del valor se ajusta a lo visible', () => {
  const p = prep(
    [0, 1, 2, 3, 4, 5].map((x) => ({ x, v: [10, 12, 95, 98, 11, 13][x] })),
    [{ type: 'line', field: 'v' }],
    'linear',
  );
  const all = buildFrame(p, new Set(), { ticks: 5 });
  const left = buildFrame(p, new Set(), { ticks: 5, range: [0, 1] });
  assert.ok(all.d1 >= 98);
  assert.ok(left.d1 < 20, `el eje llega a ${left.d1}`);
  // Una ventana sin datos (un hueco) deja el eje como sin zoom.
  const empty = buildFrame(p, new Set(), { ticks: 5, range: [7, 9] });
  assert.equal(empty.d1, all.d1);
});

test('una meta fuera de los datos amplía el eje', () => {
  const p = prep(
    [0, 1, 2].map((x) => ({ x, v: 40 + x })),
    [{ type: 'line', field: 'v' }],
  );
  assert.ok(buildFrame(p, new Set(), { ticks: 5 }).d1 < 60);
  assert.ok(buildFrame(p, new Set(), { ticks: 5, include: [80] }).d1 >= 80);
});

test('datos diarios que cruzan el cambio de horario siguen siendo diarios', () => {
  // Un día de 23 horas (el cambio de horario) no los vuelve datos por hora.
  const days = [0, 1, 2].map((i) => parseTime('2026-03-07') + i * 86_400_000 - (i === 2 ? 3_600_000 : 0));
  assert.equal(detectTimeUnit(days), 'day');
});

test('con barras cuenta toda banda que asoma; en continua, los vecinos si se piden', () => {
  // 10 bandas; ventana de 0,03 a 0,53: la banda 5 asoma aunque su centro (0,55) quede fuera.
  const band = new BandScale(10, 1000, { start: 0.03, end: 0.53 });
  assert.deepEqual(visibleIndices(band, 1000), [0, 5]);
  // Una ventana sobre un hueco de los datos: sin puntos, pero con vecinos.
  const gap = new ContinuousScale([0, 1, 2, 3, 100], 1000, undefined, { start: 0.1, end: 0.35 });
  assert.equal(visibleIndices(gap, 1000), null);
  assert.deepEqual(visibleIndices(gap, 1000, true), [3, 4]);
});

test('ventana sobre un hueco con una meta: el eje no se arma solo con la meta', () => {
  const p = prep(
    [0, 1, 2, 3].map((x) => ({ x, v: [10, 50, 30, 40][x] })),
    [{ type: 'line', field: 'v' }],
    'linear',
  );
  const all = buildFrame(p, new Set(), { ticks: 5, include: [100] });
  const gap = buildFrame(p, new Set(), { ticks: 5, include: [100], range: [6, 8] });
  assert.deepEqual([gap.d0, gap.d1], [all.d0, all.d1]);
});

test('ventana Y: el dominio es el tramo exacto, con un paso redondo para sus marcas', () => {
  const d = windowDomain({ d0: 0, d1: 200, step: 50 }, { start: 0.25, end: 0.6 }, 5);
  assert.deepEqual([d.d0, d.d1], [50, 120]);
  assert.equal(d.step, 10);
  assert.deepEqual(valueTicks(d, 5), [50, 60, 70, 80, 90, 100, 110, 120]);
  // Los extremos no tienen que ser marcas: estas empiezan en la primera redonda.
  assert.deepEqual(valueTicks(windowDomain({ d0: 0, d1: 200, step: 50 }, { start: 0.23, end: 0.6 }, 3), 3), [60, 80, 100, 120]);
  // Toda la ventana es el dominio de siempre.
  const all = windowDomain({ d0: 0, d1: 200, step: 50 }, FULL_VIEW, 5);
  assert.deepEqual([all.d0, all.d1], [0, 200]);
});

test('ventana Y en log: se mide en su escala y, si no caben marcas redondas, van lineales', () => {
  const log = { d0: 1, d1: 10_000, step: 1, log: true };
  // La mitad de cuatro décadas: de 1 a 100.
  const half = windowDomain(log, { start: 0, end: 0.5 }, 5);
  assert.ok(near(half.d0, 1) && near(half.d1, 100));
  assert.ok(near(valueFraction(log, 100), 0.5) && near(valueAt(log, 0.25), 10));
  // De 23 a 41 no hay ningún 1, 2 o 5 × 10ⁿ: las marcas son lineales y redondas.
  const narrow = { d0: 23, d1: 41, step: 23, log: true };
  assert.deepEqual(valueTicks(narrow, 5), [25, 30, 35, 40]);
  const w = windowDomain(log, { start: valueFraction(log, 23), end: valueFraction(log, 41) }, 5);
  assert.equal(w.step, 5);
});
