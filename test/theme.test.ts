import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DARK, LIGHT, resolveTheme } from '../src/core/theme';

test('sin paleta propia se usa la de LozChart en cada modo', () => {
  assert.equal(resolveTheme('light'), LIGHT);
  assert.equal(resolveTheme('dark'), DARK);
});

test('un arreglo vale para los dos modos; superficies y textos no cambian', () => {
  const marca = ['#0a7d4f', '#6b3fa0', '#d9480f'];
  const dark = resolveTheme('dark', marca);
  assert.deepEqual(dark.palette, marca);
  assert.equal(dark.surface, DARK.surface);
});

test('con light y dark, cada modo usa la suya; sin dark, se usa light', () => {
  const p = { light: ['#111111'], dark: ['#eeeeee'] };
  assert.deepEqual(resolveTheme('light', p).palette, ['#111111']);
  assert.deepEqual(resolveTheme('dark', p).palette, ['#eeeeee']);
  assert.deepEqual(resolveTheme('dark', { light: ['#111111'] }).palette, ['#111111']);
});

test('más de 8 colores: se usan los primeros 8, con aviso', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const nueve = Array.from({ length: 9 }, (_, i) => `#00000${i}`);
  assert.equal(resolveTheme('light', nueve).palette.length, 8);
  assert.equal(warn.mock.callCount(), 1);
});

test('una paleta vacía se ignora', () => {
  assert.equal(resolveTheme('light', []), LIGHT);
});
