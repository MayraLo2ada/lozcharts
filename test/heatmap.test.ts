import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrid,
  gridStep,
  cellAt,
  cellRect,
  columnTicks,
  heatLayout,
  heatmap,
  labelStep,
  readingOrder,
  valueMode,
} from '../src/series/heatmap';
import {
  colorDomain,
  contrast,
  legendSpec,
  legendWidth,
  makeRamp,
  mixOklab,
  paint,
  parseColor,
  position,
  textOn,
  toHex,
} from '../src/core/color';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT, type Theme } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

interface Cell {
  x: string;
  y: string;
  v: number;
}

const CELLS: Cell[] = [
  { x: 'ene', y: 'Norte', v: 10 },
  { x: 'feb', y: 'Norte', v: 20 },
  { x: 'ene', y: 'Sur', v: 30 },
  { x: 'feb', y: 'Sur', v: 40 },
];

function series(cells: Cell[], labels?: boolean): PreparedSeries {
  return {
    key: 'v',
    name: 'v',
    impl: heatmap,
    slot: 0,
    options: { type: 'heatmap', field: 'v', y: 'y', labels },
    values: cells.map((c) => c.v),
    columns: {},
    texts: { y: cells.map((c) => c.y), x: cells.map((c) => c.x) },
    stackKey: null,
    axis: 'left',
    locale: 'es',
  };
}

function context(
  cells: Cell[],
  width = 390,
  height = 240,
  opts: { theme?: Theme; y1?: number[]; labels?: boolean } = {},
): DrawContext {
  const n = cells.length;
  const ps = series(cells, opts.labels);
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1: opts.y1 ?? ps.values, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: (opts.theme ?? LIGHT).palette[0],
    pointColor: () => '#000',
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme: opts.theme ?? LIGHT,
    width,
    height,
    n,
    isHidden: () => false,
    locale: 'es',
    label: (i) => cells[i].x,
    measure,
    format: (v) => String(v),
    compact: (v) => `${Math.round(v / 1000)}k`,
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const rects = (svg: string) => svg.match(/<rect[^>]*>/g) ?? [];
const cellRects = (svg: string) => rects(svg).filter((r) => r.includes('rx="'));

test('rejilla: columnas y filas en orden de aparición, cada dato en su celda', () => {
  const g = buildGrid(['09', '10', '09', '11'], ['Lun', 'Lun', 'Mar', 'Mar']);
  assert.deepEqual(g.cols, ['09', '10', '11']);
  assert.deepEqual(g.rows, ['Lun', 'Mar']);
  assert.deepEqual(g.cell, [0, 1, -1, 2, -1, 3], 'las celdas sin dato quedan en -1');
  assert.deepEqual(readingOrder(g, [1, 2, 3, 4]), [0, 1, 2, 3]);
});

test('duplicados: gana el último y el anterior no se recorre', () => {
  const g = buildGrid(['a', 'a', 'b'], ['F', 'F', 'F']);
  assert.deepEqual(g.cell, [1, 2]);
  assert.deepEqual(readingOrder(g, [5, 6, 7]), [1, 2]);
  const ctx = context([
    { x: 'a', y: 'F', v: 1 },
    { x: 'a', y: 'F', v: 9 },
    { x: 'b', y: 'F', v: 5 },
  ]);
  assert.equal(cellRects(heatmap.draw(ctx)).length, 2);
  // La tabla oculta nombra la fila que perdió su celda.
  assert.equal(heatmap.headline!(ctx.frame.ps, 0, 'a', 'es'), 'a · F (repetida; se muestra la última)');
  assert.equal(heatmap.headline!(ctx.frame.ps, 0, 'a', 'en'), 'a · F (repeated; showing the last one)');
  assert.equal(heatmap.headline!(ctx.frame.ps, 1, 'a'), 'a · F');
});

test('orden de lectura: fila por fila aunque los datos lleguen por columna', () => {
  // Datos ordenados por columna: Lun-09, Mar-09, Lun-10, Mar-10.
  const g = buildGrid(['09', '09', '10', '10'], ['Lun', 'Mar', 'Lun', 'Mar']);
  assert.deepEqual(readingOrder(g, [1, 2, 3, 4]), [0, 2, 1, 3]);
  // Los huecos (NaN) no se recorren.
  assert.deepEqual(readingOrder(g, [1, NaN, 3, 4]), [0, 2, 3]);
});

test('navigable: fila por fila sin necesidad de dibujar antes (la X viene en texts.x)', () => {
  const cells: Cell[] = [
    { x: '09', y: 'Lun', v: 1 },
    { x: '09', y: 'Mar', v: 2 },
    { x: '10', y: 'Lun', v: 3 },
    { x: '10', y: 'Mar', v: NaN },
  ];
  assert.deepEqual(heatmap.navigable!(series(cells)), [0, 2, 1]);
});

test('columnas por la X cruda: dos X con el mismo rótulo corto no se funden', () => {
  const cells: Cell[] = [
    { x: '2025-01-01', y: 'A', v: 1 },
    { x: '2026-01-01', y: 'A', v: 2 },
  ];
  // Las dos se rotulan "ene": siguen siendo dos celdas.
  const ctx = { ...context(cells, 400, 240), label: () => 'ene' };
  assert.equal(cellRects(heatmap.draw(ctx)).length, 2);
});

test('flechas en dos dimensiones: columnas con ← →, filas con ↑ ↓, saltando huecos y quieto en el borde', () => {
  // Fila A: a0 a1 a2; fila B: b0 (hueco) b2; fila C: c0 c1 c2 con c1 sin valor.
  const xs = ['0', '1', '2', '0', '2', '0', '1', '2'];
  const ys = ['A', 'A', 'A', 'B', 'B', 'C', 'C', 'C'];
  const v = [1, 1, 1, 1, 1, 1, NaN, 1];
  const g = buildGrid(xs, ys);
  assert.equal(gridStep(g, v, 0, 'ArrowRight'), 1);
  assert.equal(gridStep(g, v, 2, 'ArrowRight'), 2, 'borde derecho: se queda');
  assert.equal(gridStep(g, v, 0, 'ArrowLeft'), 0, 'borde izquierdo: se queda');
  assert.equal(gridStep(g, v, 3, 'ArrowRight'), 4, 'salta la celda que falta');
  assert.equal(gridStep(g, v, 5, 'ArrowRight'), 7, 'salta la celda sin valor');
  assert.equal(gridStep(g, v, 0, 'ArrowDown'), 3);
  assert.equal(gridStep(g, v, 1, 'ArrowDown'), 1, 'debajo solo hay hueco y NaN: se queda');
  assert.equal(gridStep(g, v, 7, 'ArrowUp'), 4);
  assert.equal(gridStep(g, v, 0, 'ArrowUp'), 0);
  assert.equal(gridStep(g, v, 0, 'Home'), undefined, 'otras teclas: recorrido lineal');
  // Un dato repetido que perdió su celda no tiene lugar en la rejilla.
  const dup = buildGrid(['0', '0'], ['A', 'A']);
  assert.equal(gridStep(dup, [1, 1], 0, 'ArrowRight'), undefined);
  assert.equal(gridStep(dup, [1, 1], 1, 'ArrowRight'), 1);
  const ps = series(xs.map((x, k) => ({ x, y: ys[k], v: v[k] })));
  assert.equal(heatmap.step!(ps, 0, 'ArrowDown'), 3);
});

test('dominio: secuencial sin negativos; divergente y simétrico con ellos', () => {
  assert.deepEqual(colorDomain([5, NaN, 20, 10]), { kind: 'sequential', min: 5, max: 20 });
  assert.deepEqual(colorDomain([-3, 1, 2]), { kind: 'diverging', max: 3, positive: true });
  assert.deepEqual(colorDomain([-3, -1]), { kind: 'diverging', max: 3, positive: false });
  assert.equal(colorDomain([NaN]), null);
  const seq = colorDomain([5, 20])!;
  assert.equal(position(seq, 5), 0);
  assert.equal(position(seq, 12.5), 0.5);
  assert.equal(position(seq, 999), 1, 'acotado');
  assert.equal(position({ kind: 'sequential', min: 4, max: 4 }, 4), 0.5, 'todos iguales: el centro de la escala');
  const div = colorDomain([-3, 1])!;
  assert.equal(position(div, -3), -1);
  assert.equal(position(div, 0), 0);
  assert.equal(position(div, 1.5), 0.5);
});

test('OKLab: ida y vuelta exacta y mezcla en los extremos', () => {
  const coral = parseColor('#e45934')!;
  assert.equal(toHex(mixOklab(coral, coral, 0.5)), '#e45934');
  assert.equal(toHex(mixOklab(parseColor('#fff')!, coral, 1)), '#e45934');
  assert.equal(toHex(mixOklab(parseColor('#fff')!, coral, 0)), '#ffffff');
  assert.deepEqual(parseColor('rgb(255, 0, 0)'), [1, 0, 0]);
  assert.equal(parseColor('tomato'), null);
});

test('escala secuencial: de un tinte de la superficie al color pleno, en claro y oscuro', () => {
  for (const th of [LIGHT, DARK]) {
    const ramp = makeRamp('sequential', th, th.palette[0]);
    const low = paint(ramp, 0);
    const high = paint(ramp, 1);
    assert.equal(high.fill, th.palette[0]);
    const surface = parseColor(th.surface)!;
    // El mínimo no se confunde con una celda vacía, pero queda cerca de la superficie.
    assert.ok(low.fill !== th.surface);
    assert.ok(contrast(low.rgb!, surface) < contrast(high.rgb!, surface));
    // Monótona en claridad: cada paso se aleja más de la superficie.
    const steps = [0, 0.25, 0.5, 0.75, 1].map((p) => contrast(paint(ramp, p).rgb!, surface));
    for (let k = 1; k < steps.length; k++) assert.ok(steps[k] > steps[k - 1], `${th.name}: paso ${k}`);
  }
});

test('escala divergente: cero neutro, negativos con otro tono; nunca el mismo tono a los dos lados', () => {
  const ramp = makeRamp('diverging', LIGHT, LIGHT.palette[0]);
  assert.equal(paint(ramp, 0).fill, LIGHT.grid);
  assert.equal(paint(ramp, 1).fill, LIGHT.palette[0]);
  assert.equal(paint(ramp, -1).fill, LIGHT.palette[1]);
  const clash = makeRamp('diverging', LIGHT, LIGHT.palette[1]);
  assert.equal(clash.neg, LIGHT.palette[0]);
  // Un color que no se puede leer: el color con opacidad.
  assert.deepEqual(paint(makeRamp('sequential', LIGHT, 'tomato'), 1), { fill: 'tomato', opacity: 1, rgb: null });
});

test('contraste del valor: texto oscuro en rellenos claros y claro en oscuros (≥ 4,5:1)', () => {
  const candidates = [LIGHT.text, LIGHT.surface];
  assert.equal(textOn(parseColor('#fcefe9'), candidates), LIGHT.text);
  assert.equal(textOn(parseColor('#5e2dad'), candidates), LIGHT.surface);
  assert.equal(textOn(null, candidates), LIGHT.text);
  // Si el texto del tema llega a 4,5:1 se queda, aunque el otro tenga más contraste.
  assert.equal(textOn(parseColor('#9a9a9a'), [LIGHT.text, '#ffffff']), LIGHT.text);
  for (const th of [LIGHT, DARK]) {
    const ramp = makeRamp('sequential', th, th.palette[0]);
    for (const p of [0, 0.3, 0.6, 1]) {
      const fill = paint(ramp, p).rgb!;
      // El texto del tema o la superficie; si ninguno llega, negro o blanco puros.
      const best = textOn(fill, [th.text, th.surface, '#000000', '#ffffff']);
      assert.ok(contrast(fill, parseColor(best)!) >= 4.5, `${th.name} p=${p}`);
    }
  }
});

test('leyenda: mínimo y máximo; con negativos, el cero al centro', () => {
  const fmt = (v: number) => String(v);
  assert.deepEqual(legendSpec({ kind: 'sequential', min: 5, max: 20 }, fmt).labels, [
    ['5', 0],
    ['20', 1],
  ]);
  const div = legendSpec({ kind: 'diverging', max: 3, positive: true }, fmt);
  assert.deepEqual([div.from, div.to], [-1, 1]);
  assert.deepEqual(
    div.labels.map(([t]) => t),
    ['-3', '0', '3'],
  );
  assert.deepEqual(legendSpec({ kind: 'diverging', max: 3, positive: false }, fmt).to, 0);
  assert.equal(legendWidth(div, measure), 120, 'cifras cortas: el ancho de siempre');
  const long = legendSpec({ kind: 'diverging', max: 3, positive: true }, () => '1.234.567 $');
  assert.ok(legendWidth(long, measure) >= 3 * measure('1.234.567 $') + 24, 'números largos: la barra se estira');
});

test('layout: rejilla con 2 px de aire, etiquetas de fila hasta el 30 % y bloque arriba', () => {
  const L = heatLayout({ width: 400, height: 300, cols: 4, rows: 2, rowLabel: 50, colLabel: 21, legend: 120 });
  assert.equal(L.gridX, 58);
  assert.equal(L.gap, 2);
  assert.equal(L.cellW, L.pitchX - 2);
  assert.equal(L.gridX + L.gridW, 400, 'la rejilla llega al borde derecho');
  assert.equal(L.pitchY, 48, 'pocas filas: alto con tope');
  assert.equal(L.legendX + L.legendW, 400);
  assert.ok(L.legendY + 23 + 12 <= L.gridY, 'la leyenda queda arriba, sin pisar la rejilla');
  assert.equal(L.legendY, 0, 'el bloque va arriba, junto al título');
  // Nombres larguísimos: el 30 % del ancho como máximo.
  const wide = heatLayout({ width: 390, height: 300, cols: 3, rows: 3, rowLabel: 400, colLabel: 0, legend: 0 });
  assert.equal(wide.rowLabelW, 117);
  assert.equal(wide.gridY, 0, 'sin leyenda, la rejilla empieza arriba');
});

test('layout: 52 × 7 en un teléfono sigue funcionando, con 1 px de aire y sin valores', () => {
  // 320 px: un teléfono angosto menos los márgenes de la página.
  const L = heatLayout({ width: 320, height: 200, cols: 52, rows: 7, rowLabel: 21, colLabel: 28, legend: 120 });
  assert.ok(L.pitchX < 6 && L.cellW > 3);
  assert.equal(L.gap, 1);
  assert.equal(valueMode(L, 14, 14), null);
  assert.ok(L.colEvery >= Math.ceil(40 / L.pitchX));
});

test('saltos de etiquetas: una de cada k para que no se encimen', () => {
  assert.equal(labelStep(32, 13.75, 12), 4);
  assert.equal(labelStep(20, 60, 12), 1);
  assert.equal(labelStep(14, 7, 0), 2);
  assert.equal(labelStep(14, 0, 0), Number.MAX_SAFE_INTEGER);
  const L = heatLayout({ width: 390, height: 240, cols: 24, rows: 7, rowLabel: 49, colLabel: 35, legend: 120 });
  const ticks = columnTicks(
    L,
    Array.from({ length: 24 }, () => 35),
    390,
  );
  for (let k = 1; k < ticks.length; k++) assert.ok(ticks[k].x - ticks[k - 1].x >= 35 + 6);
  assert.ok(ticks.every((t) => t.c % L.colEvery === 0));
  // El último no se sale: si no cabe centrado, se alinea al borde.
  const last = ticks[ticks.length - 1];
  assert.ok(last.anchor === 'end' ? last.x === 390 : last.x + 17.5 <= 390);
});

test('valores dentro: exacto si cabe, compacto si no, nada en celdas chicas', () => {
  const L = heatLayout({ width: 400, height: 300, cols: 4, rows: 2, rowLabel: 0, colLabel: 0, legend: 0 });
  assert.equal(valueMode(L, 40, 20), 'exact');
  assert.equal(valueMode(L, L.cellW, 20), 'compact');
  assert.equal(valueMode(L, L.cellW, L.cellW), null);
  assert.equal(valueMode(L, 40, 20, 364), null, 'un calendario de 52 × 7 no lleva 364 números');
  const d = heatmap.draw(context(CELLS, 400, 300));
  const inCell = (svg: string) => (svg.match(/text-anchor="middle"[^>]*>30</g) ?? []).length;
  assert.equal(inCell(d), 1, 'muestra el valor (30 no está en la leyenda)');
  assert.equal(inCell(heatmap.draw(context(CELLS, 400, 300, { labels: false }))), 0, 'labels: false lo apaga');
});

test('draw: una celda por dato, faltantes vacías, textos escapados y en colores del tema', () => {
  const cells: Cell[] = [
    { x: '<b>ene</b>', y: 'Norte & "Sur"', v: 1 },
    { x: 'feb', y: 'Norte & "Sur"', v: NaN },
    { x: 'feb', y: 'Este', v: 3 },
  ];
  const d = heatmap.draw(context(cells, 600, 300));
  assert.equal(cellRects(d).length, 2, 'la celda NaN y la que no existe no se dibujan');
  assert.ok(!d.includes('<b>'));
  assert.ok(d.includes('&lt;b&gt;ene&lt;/b&gt;') && d.includes('Norte &amp; &quot;Sur&quot;'));
  const axisTexts = (d.match(/<text[^>]*text-anchor="(end|start|middle)"[^>]*>[^<]*<\/text>/g) ?? []).filter(
    (t) => t.includes('Este') || t.includes('feb'),
  );
  assert.ok(axisTexts.length > 0 && axisTexts.every((t) => t.includes(`fill="${LIGHT.textMuted}"`)));
});

test('animación: el color sale del valor animado', () => {
  const start = heatmap.draw(context(CELLS, 400, 300, { y1: [10, 10, 10, 10] }));
  const end = heatmap.draw(context(CELLS, 400, 300));
  const fills = (s: string) => cellRects(s).map((r) => /fill="([^"]+)"/.exec(r)![1]);
  assert.equal(new Set(fills(start)).size, 1, 'todas parten del mismo color');
  assert.equal(new Set(fills(end)).size, 4);
  assert.equal(fills(end)[3], LIGHT.palette[0], 'el máximo, en el color pleno');
});

test('hit-test: la celda bajo el puntero, el aire cuenta para la de antes, -1 afuera', () => {
  const ctx = context(CELLS, 400, 300);
  heatmap.draw(ctx);
  const L = heatLayout({ width: 400, height: 300, cols: 2, rows: 2, rowLabel: 35, colLabel: 21, legend: 120 });
  const b = cellRect(L, 1, 1);
  assert.equal(heatmap.hit!(ctx, b.x + 1, b.y + 1), 3);
  assert.equal(heatmap.hit!(ctx, b.x - 1, b.y + 1), 2, 'en el aire, la celda de la izquierda');
  assert.equal(heatmap.hit!(ctx, 5, b.y + 1), -1, 'sobre las etiquetas de fila');
  assert.equal(heatmap.hit!(ctx, b.x + 1, 299), -1);
  assert.equal(cellAt(L, 2, 2, L.gridX, L.gridY)?.join(), '0,0');
  // Una celda que falta en la rejilla: -1.
  const sparse = context([CELLS[0], CELLS[3]], 400, 300);
  const S = heatLayout({ width: 400, height: 300, cols: 2, rows: 2, rowLabel: 35, colLabel: 21, legend: 120 });
  const empty = cellRect(S, 1, 0);
  assert.equal(heatmap.hit!(sparse, empty.x + 2, empty.y + 2), -1);
});

test('anchor y hover: apoyo en el borde de la celda y anillo de 2 px', () => {
  const ctx = context(CELLS, 400, 300);
  const L = heatLayout({ width: 400, height: 300, cols: 2, rows: 2, rowLabel: 35, colLabel: 21, legend: 120 });
  const top = cellRect(L, 0, 0);
  assert.deepEqual(heatmap.anchor!(ctx, 0), [top.x + top.w / 2, top.y]);
  // En la mitad de abajo del área, el apoyo pasa al borde inferior (el tooltip va debajo).
  const low = context(CELLS, 400, 120);
  const S = heatLayout({ width: 400, height: 120, cols: 2, rows: 2, rowLabel: 35, colLabel: 21, legend: 120 });
  const bottom = cellRect(S, 1, 1);
  assert.ok(bottom.y + bottom.h / 2 > 60);
  assert.deepEqual(heatmap.anchor!(low, 3), [bottom.x + bottom.w / 2, bottom.y + bottom.h]);
  const h = heatmap.hover!(ctx, 1);
  assert.equal(rects(h).length, 2);
  assert.ok(h.includes(`stroke="${LIGHT.text}"`) && h.includes('stroke-width="2"') && h.includes(`stroke="${LIGHT.surface}"`));
  assert.equal(heatmap.hover!(ctx, 99), '');
});

test('tooltip y encabezado: la celda completa y "Sin dato" en los huecos', () => {
  const format: TooltipFormat = {
    value: (v) => `${v} visitas`,
    number: String,
    percent: String,
    isHidden: () => false,
    locale: 'es',
    difference: String,
  };
  const ps = series([...CELLS, { x: 'mar', y: 'Sur', v: NaN }]);
  assert.deepEqual(heatmap.tooltip!(ps, 1, format), { value: '20 visitas' });
  assert.deepEqual(heatmap.tooltip!(ps, 4, format), { value: 'Sin dato' });
  assert.equal(heatmap.headline!(ps, 2, 'enero'), 'enero · Sur');
  assert.equal(heatmap.headline!({ ...ps, texts: { x: ps.texts.x } }, 2, 'enero'), 'enero');
});

test('divergente en el dibujo: leyenda con el cero y cero neutro', () => {
  const cells: Cell[] = [
    { x: 'a', y: 'P', v: -4 },
    { x: 'b', y: 'P', v: 0 },
    { x: 'c', y: 'P', v: 2 },
  ];
  const d = heatmap.draw(context(cells, 600, 240));
  assert.ok(d.includes(`fill="${LIGHT.grid}"`), 'el cero en el gris neutro');
  assert.ok(d.includes(`fill="${LIGHT.palette[1]}"`), 'el −4 en el color de los negativos');
  assert.ok(d.includes('>-4<') && d.includes('>0<') && d.includes('>4<'), 'leyenda simétrica −4 · 0 · 4');
});

test('muestra del tooltip: el color de la celda en la rampa, el mismo del dibujo', () => {
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(CELLS, 390, 240, { theme });
    const d = heatmap.draw(ctx);
    const domain = colorDomain(ctx.frame.ps.values)!;
    const ramp = makeRamp(domain.kind, theme, ctx.color);
    CELLS.forEach((c, i) => {
      const swatch = heatmap.swatch!(ctx, i);
      assert.equal(swatch, paint(ramp, position(domain, c.v)).fill);
      assert.ok(d.includes(`fill="${swatch}"`), `${c.y} ${c.x} en ${swatch}`);
    });
  }
  // Más valor, otro color; y sigue al cuadro de la animación, como el dibujo.
  const ctx = context(CELLS);
  assert.notEqual(heatmap.swatch!(ctx, 0), heatmap.swatch!(ctx, 3));
  assert.equal(heatmap.swatch!(context(CELLS, 390, 240, { y1: [40, 20, 30, 40] }), 0), heatmap.swatch!(ctx, 3));
  // Sin valor no hay color.
  assert.equal(heatmap.swatch!(context([...CELLS, { x: 'mar', y: 'Sur', v: NaN }]), 4), null);
});
