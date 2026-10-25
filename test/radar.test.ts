import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DrawContext, PolarPlane } from '../src/core/series';
import type { Pt } from '../src/core/shapes';
import { BandScale, LinearScale } from '../src/core/scales';
import { LIGHT } from '../src/core/theme';
import { radar, radarPaths, radarRuns } from '../src/series/radar';

test('radar: sin huecos, un solo tramo cerrado', () => {
  assert.deepEqual(radarRuns([true, true, true]), { runs: [[0, 1, 2]], closed: true });
  assert.deepEqual(radarRuns([]), { runs: [], closed: false });
});

test('radar: los tramos dan la vuelta por el último índice', () => {
  // Falta el índice 2: el tramo sigue 3 → 4 → 0 → 1, sin partirse en el cero.
  assert.deepEqual(radarRuns([true, true, false, true, true]).runs, [[3, 4, 0, 1]]);
  assert.deepEqual(radarRuns([true, false, true, false]).runs, [[2], [0]]);
  assert.deepEqual(radarRuns([false, false]).runs, []);
});

test('radar: polígono cerrado con relleno cuando no faltan datos', () => {
  const pts: Pt[] = [
    [10, 0],
    [20, 10],
    [10, 20],
    [0, 10],
  ];
  const { fill, edge } = radarPaths(pts);
  assert.equal(fill, 'M10,0L20,10L10,20L0,10Z');
  assert.equal(edge, fill);
});

test('radar: con un hueco se corta el contorno y no se rellena (no se inventa el vértice)', () => {
  const pts: Pt[] = [
    [10, 0],
    [NaN, NaN],
    [10, 20],
    [0, 10],
  ];
  const { fill, edge } = radarPaths(pts);
  assert.equal(fill, '');
  assert.equal(edge, 'M10,20L0,10L10,0');
});

test('radar: un tramo de un solo punto se dibuja como punto', () => {
  const { edge } = radarPaths([
    [1, 2],
    [NaN, NaN],
    [5, 5],
    [NaN, NaN],
  ]);
  assert.equal(edge, 'M5,5h0M1,2h0');
  assert.equal(radarPaths([[3, 4]]).edge, 'M3,4h0');
});

/** Contexto mínimo: 4 categorías, centro (100, 100), radio 50 para el dominio 0–10. */
function context(values: number[]): DrawContext {
  const n = values.length;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const y = new LinearScale(0, 10, 0, 50);
  const polar: PolarPlane = {
    cx: 100,
    cy: 100,
    radius: 50,
    angle,
    point: (i, v) => [100 + y.map(v) * Math.cos(angle(i)), 100 + y.map(v) * Math.sin(angle(i))],
  };
  return {
    frame: {
      ps: {
        key: 'a',
        name: 'a',
        impl: radar,
        slot: 0,
        options: { name: 'a', type: 'radar', field: 'v' },
        values,
        columns: {},
        texts: {},
        stackKey: null,
        axis: 'left',
      },
      y0: values.map(() => 0),
      y1: values,
      cols: {},
      alpha: 1,
      slot: 0,
      slots: 1,
      outer: values.map(() => true),
    },
    color: '#2a78d6',
    pointColor: () => '#2a78d6',
    polar,
    x: new BandScale(n, 200),
    y,
    theme: LIGHT,
    width: 200,
    height: 200,
    n,
    isHidden: () => false,
    label: (i) => String(i),
    measure: (t) => t.length * 7,
    format: (v) => String(v),
    compact: (v: number) => String(Math.round(v)),
    percent: (v: number) => `${Math.round(v * 1000) / 10} %`,
  };
}

test('radar: dibuja relleno al 10 % y borde redondeado de 2 px', () => {
  const out = radar.draw(context([10, 10, 10, 10]));
  assert.match(out, /d="M100,50L150,100L100,150L50,100Z" fill="#2a78d6" fill-opacity="0.1"/);
  assert.match(out, /stroke-width="2" stroke-linejoin="round"/);
});

test('radar: en el primer cuadro (valores en cero) todo nace del centro', () => {
  assert.match(radar.draw(context([0, 0, 0, 0])), /d="M100,100L100,100L100,100L100,100Z"/);
});

test('radar: punto de hover en coordenadas polares, nada donde falta el dato', () => {
  const ctx = context([10, 5, NaN, 10]);
  const dot = radar.hover!(ctx, 1);
  assert.match(dot, /cx="125.00" cy="100.00" r="4.5"/);
  assert.match(dot, new RegExp(`stroke="${LIGHT.surface}" stroke-width="2"`));
  assert.equal(radar.hover!(ctx, 2), '');
});
