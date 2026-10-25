import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotationValues, renderAnnotations, type AnnotationPlane } from '../src/core/annotations';
import { spreadLabels } from '../src/core/labels';
import { LIGHT } from '../src/core/theme';

/** Plano de 200 × 100 px: el índice va de 0 a 10 y el valor de 0 a 100 (crece hacia arriba). */
function plane(horizontal = false): AnnotationPlane {
  const indexLen = horizontal ? 100 : 200;
  const valueLen = horizontal ? 200 : 100;
  return {
    indexLen,
    valueLen,
    horizontal,
    index: (x) => (typeof x === 'number' ? (x / 10) * indexLen : null),
    value: (v) => (horizontal ? (v / 100) * valueLen : valueLen - (v / 100) * valueLen),
  };
}
const measure = (t: string) => t.length * 6;

test('una meta en Y amplía el eje solo del lado que corresponde', () => {
  const list = [{ y: 80 }, { y: [10, 20] as [number, number], axis: 'right' as const }, { x: 3 }];
  assert.deepEqual(annotationValues(list, 'left'), [80]);
  assert.deepEqual(annotationValues(list, 'right'), [10, 20]);
});

test('línea del valor: horizontal en pantalla, con su texto encima al final', () => {
  const { under, over } = renderAnnotations([{ y: 50, label: 'Meta' }], plane(), LIGHT, measure);
  assert.equal(under, '');
  assert.match(over, /<line x1="0" y1="50.5" x2="200" y2="50.5"/);
  assert.match(over, /<text x="196" y="45.5"[^>]*text-anchor="end"[^>]*>Meta<\/text>/);
});

test('cerca del borde de arriba, el texto va debajo de la línea', () => {
  const { over } = renderAnnotations([{ y: 98, label: 'Tope' }], plane(), LIGHT, measure);
  assert.match(over, /dominant-baseline="hanging"[^>]*>Tope/);
});

test('línea del índice: vertical, con el texto arriba a su derecha', () => {
  const { over } = renderAnnotations([{ x: 5, label: 'Lanzamiento' }], plane(), LIGHT, measure);
  assert.match(over, /<line x1="100.5" y1="0" x2="100.5" y2="100"/);
  assert.match(over, /<text x="105.5" y="5"[^>]*text-anchor="start"/);
  // Si no cabe a la derecha, se pasa a la izquierda.
  const edge = renderAnnotations([{ x: 9.5, label: 'Lanzamiento' }], plane(), LIGHT, measure).over;
  assert.match(edge, /text-anchor="end"/);
});

test('franja: debajo de las series, recortada al área', () => {
  const { under, over } = renderAnnotations([{ x: [8, 14], label: 'Q4' }], plane(), LIGHT, measure);
  assert.match(under, /<rect x="160" y="0" width="40" height="100"/);
  assert.match(over, />Q4</);
});

test('en horizontal, una línea del valor queda vertical', () => {
  const { over } = renderAnnotations([{ y: 50 }], plane(true), LIGHT, measure);
  assert.match(over, /<line x1="100.5" y1="0" x2="100.5" y2="100"/);
});

test('lo que no está en los datos o cae fuera del área no se dibuja', () => {
  const out = renderAnnotations([{ x: 'no existe' }, { x: 30 }, { y: 50, x: 2 }, {}], plane(), LIGHT, measure);
  assert.deepEqual(out, { under: '', over: '' });
});

test('el texto se escapa', () => {
  const { over } = renderAnnotations([{ y: 50, label: '<b>Meta</b> & más' }], plane(), LIGHT, measure);
  assert.ok(over.includes('&lt;b&gt;Meta&lt;/b&gt; &amp; más') && !over.includes('<b>'));
});

test('etiquetas al final: sin choques, cerca de su dato y dentro del área', () => {
  // Tres etiquetas que quieren casi el mismo lugar se reparten alrededor del promedio.
  const ys = spreadLabels([50, 52, 51], 14, 0, 100);
  const sorted = [...ys].sort((a, b) => a - b);
  assert.ok(sorted[1] - sorted[0] >= 14 - 1e-9 && sorted[2] - sorted[1] >= 14 - 1e-9);
  assert.ok(Math.abs((sorted[0] + sorted[2]) / 2 - 51) < 1e-9);
  // Conservan el orden de sus datos: la de 50 queda arriba de la de 52.
  assert.ok(ys[0] < ys[2] && ys[2] < ys[1]);
  // Las que no chocan no se mueven.
  assert.deepEqual(spreadLabels([10, 60], 14, 0, 100), [10, 60]);
  // Contra el borde, el grupo se corre hacia adentro.
  assert.deepEqual(spreadLabels([99, 100], 14, 0, 100), [86, 100]);
});

test('dos textos que chocarían: el segundo se corre una línea', () => {
  const { over } = renderAnnotations(
    [
      { x: [0, 2], label: 'Excelente' },
      { x: 2.5, label: 'Acuerdo de servicio' },
    ],
    plane(),
    LIGHT,
    measure,
  );
  const ys = [...over.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)].map((m) => +m[1]);
  assert.deepEqual(ys, [5, 20]);
});
