import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optionsKey, optionsPatch, withLatest } from '../src/core/sync';

test('la clave de opciones ignora los datos y la identidad de las funciones', () => {
  const a = optionsKey({ data: [1], xAxis: { field: 'x' }, onHover: () => 1 });
  const b = optionsKey({ data: [2, 3], xAxis: { field: 'x' }, onHover: () => 1 });
  const c = optionsKey({ data: [1], xAxis: { field: 'y' }, onHover: () => 1 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('una opción que se quita llega como undefined, también dentro de los ejes', () => {
  const prev = { title: 'Ventas', data: [], xAxis: { field: 'mes', title: 'Mes' }, yAxis: { min: 0 } };
  const next = { data: [], xAxis: { field: 'mes' } };
  const patch = optionsPatch(prev, next) as Record<string, unknown>;
  assert.ok('title' in patch && patch.title === undefined);
  assert.deepEqual(patch.xAxis, { field: 'mes', title: undefined });
  // Quitar el eje entero también quita su mínimo (setOptions combina los ejes con los anteriores).
  assert.deepEqual(patch.yAxis, { min: undefined });
  assert.equal(optionsPatch(null, next), next);
});

test('las funciones anidadas llaman siempre a su versión más reciente', () => {
  const latest = {
    current: { data: [1], yAxis: { format: (v: number) => `${v} USD` }, series: [{ format: (v: number) => `#${v}` }] },
  };
  const wrapped = withLatest(latest.current, latest);
  assert.equal(wrapped.data, latest.current.data, 'los datos no se copian');
  assert.equal(wrapped.yAxis.format(5), '5 USD');
  latest.current = {
    ...latest.current,
    yAxis: { format: (v: number) => `${v} EUR` },
    series: [{ format: (v: number) => `n${v}` }],
  };
  assert.equal(wrapped.yAxis.format(5), '5 EUR');
  assert.equal(wrapped.series[0].format(2), 'n2');
});
