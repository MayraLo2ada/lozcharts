import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsKey } from '../src/react';

test('React: la clave de opciones ignora los datos y la identidad de las funciones', () => {
  const a = optionsKey({ data: [1], xAxis: { field: 'x' }, onHover: () => 1 });
  const b = optionsKey({ data: [2, 3], xAxis: { field: 'x' }, onHover: () => 1 });
  const c = optionsKey({ data: [1], xAxis: { field: 'y' }, onHover: () => 1 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});
