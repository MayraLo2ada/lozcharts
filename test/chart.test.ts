import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { event, host, resize, WIDTH, type FakeElement } from './dom';
import {
  LozChart,
  LogScale,
  MAX_COLORS,
  inkFor,
  legendSpec,
  legendWidth,
  toOklab,
  fromOklab,
  type DrawContext,
  type LozChartOptions,
  type SeriesImpl,
} from '../src/index';
import { LIGHT } from '../src/core/theme';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const data = MESES.map((mes, i) => ({ mes, ventas: 100 + i * 10, costos: 60 + i * 5 }));

/** Un gráfico de líneas sin animación, con lo que se pida encima. */
function chart(extra: Partial<LozChartOptions> = {}): LozChart {
  return new LozChart(host(), {
    data,
    xAxis: { field: 'mes' },
    series: [
      { type: 'line', field: 'ventas', name: 'Ventas' },
      { type: 'line', field: 'costos', name: 'Costos' },
    ],
    animate: false,
    ...extra,
  });
}

const root = (c: LozChart) => c.element as unknown as FakeElement;
const overlay = (c: LozChart) =>
  root(c)
    .querySelectorAll('rect')
    .find((r) => r.getAttribute('fill') === 'transparent')!;
const tooltip = (c: LozChart) => root(c).querySelector('.lc-tooltip')!;
const svg = (c: LozChart) => root(c).querySelector('svg')!;
/** Mueve el puntero sobre el área de datos, a `x` px del borde izquierdo del SVG. */
const move = (c: LozChart, x: number, y = 100) => overlay(c).dispatchEvent(event('pointermove', { clientX: x, clientY: y }));
const key = (c: LozChart, k: string) => svg(c).dispatchEvent(event('keydown', { key: k }));

/** Registra un tipo de serie de prueba: una línea que anota con qué contexto se dibujó. */
function spy(name: string, extra: Partial<SeriesImpl> = {}): DrawContext[] {
  const seen: DrawContext[] = [];
  LozChart.registerSeries(name, {
    legendSymbol: 'line',
    draw(ctx) {
      seen.push(ctx);
      return '';
    },
    ...extra,
  });
  return seen;
}

// ------------------------------------------------------------ Tooltip

test('tooltip: por defecto el recuadro aparece con el puntero', () => {
  const xs: unknown[] = [];
  const c = chart({ onHover: (x) => xs.push(x) });
  move(c, 300);
  assert.ok(tooltip(c).classList.contains('lc-show'));
  assert.equal(xs.length, 1);
});

test('tooltip { float: false }: sin recuadro, con puntero, marcas, teclado, avisos y onHover', () => {
  const xs: unknown[] = [];
  const c = chart({ tooltip: { float: false }, onHover: (x) => xs.push(x) });
  move(c, 300);
  assert.ok(!tooltip(c).classList.contains('lc-show'), 'el recuadro no se muestra');
  assert.equal(tooltip(c).children.length, 0, 'ni se arma');
  assert.equal(xs.length, 1, 'onHover sigue');
  const marks = root(c)
    .querySelectorAll('g')
    .some((g) => g.innerHTML.includes('<line'));
  assert.ok(marks, 'el crosshair se dibuja');
  key(c, 'ArrowRight');
  const live = root(c)
    .querySelectorAll('div')
    .find((d) => d.getAttribute('aria-live') === 'polite')!;
  assert.match(live.textContent, /Ventas/, 'el teclado se anuncia');
});

test('tooltip: false apaga también el puntero y onHover, como siempre', () => {
  const xs: unknown[] = [];
  const c = chart({ tooltip: false, onHover: (x) => xs.push(x) });
  move(c, 300);
  assert.equal(xs.length, 0);
});

test('un tooltip oculto vuelve al origen al achicarse el gráfico: no abre scroll horizontal', () => {
  const c = chart();
  move(c, 500);
  assert.notEqual(tooltip(c).style.transform, undefined);
  overlay(c).dispatchEvent(event('pointerleave'));
  resize(320);
  assert.equal(tooltip(c).style.transform, '');
  // Visible, en cambio, se reubica dentro del nuevo ancho.
  move(c, 300);
  const x = Number(/translate\((-?\d+)px/.exec(String(tooltip(c).style.transform))![1]);
  assert.ok(x + 160 <= WIDTH, `${x} + 160 cabe en ${WIDTH}`);
  resize(600);
});

// ------------------------------------------------------------ Zoom

test('zoom { reset: false }: sin el botón "Ver todo"; con el valor por defecto, sí', () => {
  const con = chart({ zoom: true, title: 'Ventas' });
  assert.ok(root(con).querySelector('.lc-zoom-reset'));
  const sin = chart({ zoom: { reset: false }, title: 'Ventas' });
  assert.equal(root(sin).querySelector('.lc-zoom-reset'), null);
  // Sin título ni botón, el encabezado no ocupa lugar.
  const vacio = chart({ zoom: { reset: false } });
  assert.equal(root(vacio).querySelector('.lc-header')!.hidden, true);
  // Se sigue volviendo a todo con la tecla 0.
  sin.zoomTo('mar', 'jun');
  key(sin, '0');
  assert.equal(sin.zoomRange, null);
});

test('onZoom recibe también la ventana exacta, y setZoomWindow la fija sin redondear', () => {
  const calls: [unknown, { start: number; end: number }][] = [];
  const a = chart({ zoom: true, onZoom: (range, window) => calls.push([range, window]) });
  a.setZoomWindow({ start: 0.1234, end: 0.6789 });
  assert.deepEqual(a.zoomWindow, { start: 0.1234, end: 0.6789 });
  const [range, window] = calls[calls.length - 1];
  assert.deepEqual(window, { start: 0.1234, end: 0.6789 });
  assert.deepEqual(range, ['mar', 'ago'], 'el tramo sigue en datos visibles');
  // Otro gráfico con el mismo eje queda con exactamente la misma ventana.
  const b = chart({ zoom: true });
  b.setZoomWindow(window);
  assert.deepEqual(b.zoomWindow, a.zoomWindow);
  // null vuelve a todo; una ventana más angosta que el mínimo se agranda alrededor de su centro.
  a.setZoomWindow(null);
  assert.deepEqual(calls[calls.length - 1], [null, { start: 0, end: 1 }]);
  a.setZoomWindow({ start: 0.5, end: 0.5001 });
  const w = a.zoomWindow;
  assert.ok(w.end - w.start > 0.3 && Math.abs((w.start + w.end) / 2 - 0.50005) < 1e-9);
  // Sin la opción zoom no hace nada.
  const quieto = chart();
  quieto.setZoomWindow({ start: 0.2, end: 0.4 });
  assert.deepEqual(quieto.zoomWindow, { start: 0, end: 1 });
});

// ------------------------------------------------------------ Ejes

/** Líneas horizontales de la rejilla en el SVG exportado, por color. */
const gridLines = (markup: string, color: string) =>
  [...markup.matchAll(/<line x1="0" y1="[\d.]+" x2="[\d.]+" y2="[\d.]+" stroke="([^"]+)"/g)].filter((m) => m[1] === color).length;

test('yAxis.grid: false quita la rejilla del valor; la línea del cero queda', () => {
  const bars = (grid?: boolean) =>
    new LozChart(host(), {
      data,
      xAxis: { field: 'mes' },
      yAxis: { grid },
      series: [{ type: 'bar', field: 'ventas' }],
      animate: false,
    }).toSVG();
  assert.ok(gridLines(bars(), LIGHT.grid) >= 3);
  assert.equal(gridLines(bars(false), LIGHT.grid), 0);
  assert.equal(gridLines(bars(false), LIGHT.zero), 1);
});

test("yAxis.type: 'log': marcas en 1, 2 y 5 × 10ⁿ o potencias de 10, y escala logarítmica para las series", () => {
  const seen = spy('prueba-log');
  const filas = [1, 30, 800, 2500, 90000].map((v, i) => ({ i: String(i), v }));
  const c = new LozChart(host(), {
    data: filas,
    xAxis: { field: 'i' },
    yAxis: { type: 'log' },
    series: [{ type: 'prueba-log', field: 'v' }],
    animate: false,
    theme: 'light',
  });
  const ctx = seen[seen.length - 1];
  assert.ok(ctx.y instanceof LogScale);
  assert.equal(ctx.y.d0, 1);
  assert.equal(ctx.y.d1, 100000);
  // Cada década mide lo mismo.
  const decade = ctx.y.map(1) - ctx.y.map(10);
  assert.ok(Math.abs(ctx.y.map(1000) - ctx.y.map(10000) - decade) < 1e-9);
  const labels = [...c.toSVG().matchAll(/text-anchor="end" dominant-baseline="central">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['1', '10', '100', '1 mil', '10 mil', '100 mil']);
});

test('eje logarítmico: las barras parten del borde inferior y un cero no rompe nada', () => {
  const c = new LozChart(host(), {
    data: [
      { x: 'a', v: 0 },
      { x: 'b', v: 20 },
      { x: 'c', v: 45 },
    ],
    xAxis: { field: 'x' },
    yAxis: { type: 'log' },
    series: [{ type: 'bar', field: 'v' }],
    animate: false,
  });
  const markup = c.toSVG();
  assert.ok(!/NaN|Infinity/.test(markup));
  const labels = [...markup.matchAll(/text-anchor="end" dominant-baseline="central">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['20', '50']);
});

// ------------------------------------------------------------ Para los tipos de serie

test('DrawContext: purpose, locale y currency en vivo, al exportar y en el mini gráfico del zoom', () => {
  const seen = spy('prueba-contexto');
  const c = new LozChart(host(), {
    data,
    xAxis: { field: 'mes' },
    series: [{ type: 'prueba-contexto', field: 'ventas' }],
    zoom: true,
    locale: 'en',
    currency: 'EUR',
    animate: false,
  });
  const purposes = new Set(seen.map((x) => x.purpose));
  assert.ok(purposes.has('screen') && purposes.has('overview'));
  const overview = seen.find((x) => x.purpose === 'overview')!;
  assert.equal(overview.theme.surface, 'transparent');
  assert.equal(overview.color, LIGHT.context);
  seen.length = 0;
  c.toSVG();
  assert.deepEqual([...new Set(seen.map((x) => x.purpose))], ['export']);
  assert.equal(seen[0].locale, 'en');
  assert.equal(seen[0].currency, 'EUR');
});

test('TooltipFormat lleva locale y currency', () => {
  let got: unknown[] = [];
  LozChart.registerSeries('prueba-formato', {
    draw: () => '',
    tooltip(_ps, _i, f) {
      got = [f.locale, f.currency];
      return null;
    },
  });
  chart({ series: [{ type: 'prueba-formato', field: 'ventas' }], locale: 'pt-BR', currency: 'BRL' });
  assert.deepEqual(got, ['pt-BR', 'BRL']);
});

test('siblings: los contextos de las series visibles del mismo tipo, en orden', () => {
  const seen = spy('prueba-hermanas');
  chart({
    series: [
      { type: 'prueba-hermanas', field: 'ventas', name: 'A' },
      { type: 'line', field: 'ventas', name: 'B' },
      { type: 'prueba-hermanas', field: 'costos', name: 'C' },
    ],
  });
  const ctx = seen[seen.length - 1];
  const sibs = ctx.siblings!();
  assert.deepEqual(
    sibs.map((s) => s.frame.ps.name),
    ['A', 'C'],
  );
  assert.ok(sibs.includes(ctx), 'incluye el propio contexto');
});

test('redraw() vuelve a dibujar con el estado actual, sin animar', () => {
  const seen = spy('prueba-redibujo');
  const c = chart({ series: [{ type: 'prueba-redibujo', field: 'ventas' }] });
  const before = seen.length;
  c.redraw();
  assert.equal(seen.length, before + 1);
  assert.equal(seen[seen.length - 1].purpose, 'screen');
});

test('clic: onClick con la X, el índice y la serie; también con Enter o Espacio', () => {
  const clicks: unknown[][] = [];
  const own: number[] = [];
  LozChart.registerSeries('prueba-clic', { draw: () => '', click: (_ctx, i) => own.push(i) });
  const c = chart({
    series: [
      { type: 'prueba-clic', field: 'ventas', name: 'Ventas' },
      { type: 'line', field: 'costos', name: 'Costos' },
    ],
    onClick: (...args) => clicks.push(args),
  });
  const o = overlay(c);
  o.dispatchEvent(event('pointerdown', { clientX: 10, clientY: 50 }));
  o.dispatchEvent(event('click', { clientX: 10, clientY: 50 }));
  // Con el crosshair, el dato es de todas las series: no hay una bajo el puntero.
  assert.deepEqual(clicks, [['ene', 0, null]]);
  assert.deepEqual(own, [0], 'el gancho del tipo también');
  // Un arrastre no es un clic.
  o.dispatchEvent(event('pointerdown', { clientX: 100, clientY: 50 }));
  o.dispatchEvent(event('click', { clientX: 160, clientY: 50 }));
  assert.equal(clicks.length, 1);
  // Teclado: Enter sobre el dato activo.
  key(c, 'End');
  key(c, 'Enter');
  assert.deepEqual(clicks[1], ['dic', 11, null]);
  assert.equal(own[1], 11);
});

test('clic en dispersión: la serie del punto más cercano', () => {
  const clicks: unknown[][] = [];
  const c = new LozChart(host(), {
    data: [
      { x: 1, a: 10, b: 90 },
      { x: 2, a: 20, b: 80 },
      { x: 3, a: 30, b: 70 },
    ],
    xAxis: { field: 'x', type: 'linear' },
    series: [
      { type: 'scatter', field: 'a', name: 'A' },
      { type: 'scatter', field: 'b', name: 'B' },
    ],
    onClick: (...args) => clicks.push(args),
    animate: false,
  });
  // Arriba del área: el punto más cercano es de B.
  overlay(c).dispatchEvent(event('click', { clientX: 300, clientY: 20 }));
  assert.equal(clicks[0][2], 'B');
});

test('sin onClick ni gancho, Espacio sigue moviendo la página', () => {
  const c = chart();
  key(c, 'ArrowRight');
  const e = event('keydown', { key: ' ' });
  svg(c).dispatchEvent(e);
  assert.ok(!e.defaultPrevented);
});

test('hit en cartesiano: el tipo decide qué dato hay bajo el puntero', () => {
  const xs: unknown[] = [];
  const calls: number[][] = [];
  LozChart.registerSeries('prueba-hit', {
    draw: () => '',
    hit(_ctx, px, py) {
      calls.push([px, py]);
      return px < 100 ? 7 : -1;
    },
  });
  const c = chart({ series: [{ type: 'prueba-hit', field: 'ventas' }], onHover: (x) => xs.push(x) });
  move(c, 60);
  assert.deepEqual(xs, ['ago'], 'el índice que dio hit, no el más cercano');
  // Si todas las series visibles tienen hit y ninguna encuentra nada, no hay dato activo.
  move(c, 400);
  assert.deepEqual(xs, ['ago', null]);
  // Con otras series sin hit, el puntero sigue como siempre.
  const mixed: unknown[] = [];
  const d = chart({
    series: [
      { type: 'prueba-hit', field: 'ventas' },
      { type: 'line', field: 'costos' },
    ],
    onHover: (x) => mixed.push(x),
  });
  move(d, WIDTH - 5);
  assert.deepEqual(mixed, ['dic']);
  assert.ok(calls.length >= 3);
});

test('preferredHeight: la serie pide su alto; un height explícito manda', () => {
  LozChart.registerSeries('prueba-alto', {
    coords: 'free',
    draw: () => '',
    preferredHeight: (ps, width) => ps.values.length * 40 + (width > 500 ? 10 : 0),
  });
  const opts = { data, xAxis: { field: 'mes' }, series: [{ type: 'prueba-alto', field: 'ventas' }], animate: false };
  const c = new LozChart(host(), opts);
  assert.equal(svg(c).getAttribute('height'), String(12 * 40 + 10));
  const fixed = new LozChart(host(), { ...opts, height: 200 });
  assert.equal(svg(fixed).getAttribute('height'), '200');
  // Quitar el alto (como hace React con una prop que desaparece) vuelve al que pide la serie.
  fixed.setOptions({ height: undefined }, false);
  assert.equal(svg(fixed).getAttribute('height'), String(12 * 40 + 10));
  // Sin preferredHeight, el de siempre.
  assert.equal(svg(chart()).getAttribute('height'), '320');
});

// ------------------------------------------------------------ Cascada

test('cascada: toCSV no repite el encabezado cuando el nombre es el campo', () => {
  const c = new LozChart(host(), {
    data: [
      { paso: 'Ventas', monto: 100 },
      { paso: 'Costos', monto: -40 },
      { paso: 'Neto', total: true },
    ],
    xAxis: { field: 'paso' },
    series: [{ type: 'waterfall', field: 'monto', total: 'total' }],
    animate: false,
  });
  const [head, ...rows] = c.toCSV().trim().split(/\r?\n/);
  assert.equal(head, 'paso,monto (acumulado),monto,total');
  assert.equal(rows[2], 'Neto,60,,true');
  // Con un nombre propio no cambia nada.
  c.setOptions({ series: [{ type: 'waterfall', field: 'monto', total: 'total', name: 'Resultado' }] }, false);
  assert.equal(c.toCSV().trim().split(/\r?\n/)[0], 'paso,Resultado,monto,total');
});

// ------------------------------------------------------------ Exportaciones

test('el paquete exporta las piezas para extensiones', () => {
  assert.equal(MAX_COLORS, 8);
  assert.equal(inkFor('#5e2dad', LIGHT), LIGHT.surface);
  const spec = legendSpec({ kind: 'sequential', min: 0, max: 100 }, String);
  assert.deepEqual(spec.labels, [
    ['0', 0],
    ['100', 1],
  ]);
  assert.ok(legendWidth(spec, (s) => s.length * 7) >= 120);
  const [L, a, b] = toOklab([1, 1, 1]);
  assert.ok(Math.abs(L - 1) < 1e-6 && Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6, 'el blanco: L = 1, sin tono');
  const back = fromOklab(toOklab([0.2, 0.4, 0.6]));
  assert.ok(back.every((v, k) => Math.abs(v - [0.2, 0.4, 0.6][k]) < 1e-6));
});

// ------------------------------------------------------------ Índice, varias marcas y selección

test('onHover recibe también el índice de la fila y la serie', () => {
  const calls: unknown[][] = [];
  const c = chart({ onHover: (...args) => calls.push(args) });
  move(c, 0);
  overlay(c).dispatchEvent(event('pointerleave'));
  assert.deepEqual(calls, [
    ['ene', 0, null],
    [null, -1, null],
  ]);
  // En un mapa de calor la X no identifica la celda; el índice sí, y la serie es la del mapa.
  const cells: unknown[][] = [];
  const h = new LozChart(host(), {
    data: [
      { dia: 'lun', hora: '9', n: 1 },
      { dia: 'lun', hora: '10', n: 2 },
    ],
    xAxis: { field: 'dia' },
    series: [{ type: 'heatmap', field: 'n', y: 'hora', name: 'Visitas' }],
    onHover: (...args) => cells.push(args),
    animate: false,
  });
  key(h, 'ArrowRight');
  key(h, 'ArrowDown');
  assert.deepEqual(
    cells.map((c) => c.slice(1)),
    [
      [0, 'Visitas'],
      [1, 'Visitas'],
    ],
  );
  assert.equal(cells[0][0], cells[1][0], 'las dos celdas tienen la misma X');
});

/** Marcas de hover en pantalla: las líneas del crosshair. */
const crosshairs = (c: LozChart) =>
  root(c)
    .querySelectorAll('g')
    .reduce((n, g) => n + (g.innerHTML.match(/stroke-opacity="0.6"/g)?.length ?? 0), 0);

test('highlight acepta varias X, y highlightIndex, índices', () => {
  const c = chart();
  c.highlight(['ene', 'mar', 'no existe']);
  assert.equal(crosshairs(c), 2);
  c.highlightIndex([4, 5, 6]);
  assert.equal(crosshairs(c), 3);
  c.highlight('feb');
  assert.equal(crosshairs(c), 1);
  c.highlight(null);
  assert.equal(crosshairs(c), 0);
  c.highlightIndex([2, 3]);
  // El puntero vuelve a un solo dato.
  move(c, 300);
  assert.equal(crosshairs(c), 1);
});

test('selection: lo seleccionado se ve normal, el resto atenuado; anunciado y en la tabla', () => {
  const opts: LozChartOptions = {
    data,
    xAxis: { field: 'mes' },
    series: [{ type: 'bar', field: 'ventas', name: 'Ventas' }],
    selection: [2],
    animate: false,
  };
  const c = new LozChart(host(), opts);
  assert.deepEqual(c.selection, [2]);
  const markup = c.toSVG();
  assert.equal(markup.match(/<g opacity="0.25">/g)?.length, 1, 'un grupo atenuado con las demás barras');
  assert.match(svg(c).getAttribute('aria-label')!, /Selección: 1 de 12 categorías\./);
  const rows = root(c)
    .querySelectorAll('th')
    .map((th) => th.textContent);
  assert.ok(rows.includes('mar (en la selección)'));
  key(c, 'ArrowRight');
  key(c, 'ArrowRight');
  key(c, 'ArrowRight');
  const live = root(c)
    .querySelectorAll('div')
    .find((d) => d.getAttribute('aria-live') === 'polite')!;
  assert.match(live.textContent, /^mar \(en la selección\):/);
  // select() la cambia y lo anuncia; null la quita.
  c.select([0, 1]);
  assert.deepEqual(c.selection, [0, 1]);
  assert.equal(live.textContent, 'Selección: 2 de 12 categorías');
  c.select(null);
  assert.deepEqual(c.selection, []);
  assert.equal(live.textContent, 'Ya no hay nada seleccionado');
  assert.ok(!c.toSVG().includes('opacity="0.25"'));
  // Índices que no existen se ignoran.
  c.setOptions({ selection: [99] }, false);
  assert.deepEqual(c.selection, []);
});

test('selection en un tipo que no atenúa: sus seleccionados se marcan con hover', () => {
  const c = chart({ selection: [3] });
  // Las líneas no atenúan: llevan el punto de hover en el dato seleccionado, en cada serie.
  assert.equal(c.toSVG().match(/<circle/g)?.length, 2);
});

test('selection atenúa celdas, porciones, rectángulos y lugares', () => {
  const rows = ['a', 'b', 'c', 'd'].map((x, i) => ({ x, y: i % 2 ? 'p' : 'q', v: i + 1, g: i < 2 ? 'G1' : 'G2' }));
  const make = (series: LozChartOptions['series'][number]) =>
    new LozChart(host(), { data: rows, xAxis: { field: 'x' }, series: [series], selection: [1], animate: false }).toSVG();
  const faded = (markup: string) => (markup.match(/opacity="0.25"/g) ?? []).length;
  assert.ok(faded(make({ type: 'heatmap', field: 'v', y: 'y' })) >= 3, 'mapa de calor');
  assert.equal(faded(make({ type: 'pie', field: 'v', labels: false })), 3, 'pie');
  assert.ok(faded(make({ type: 'treemap', field: 'v', group: 'g' })) >= 3, 'treemap');
  assert.equal(faded(make({ type: 'funnel', field: 'v', labels: false })), 1, 'embudo: un trazo atenuado');
  assert.ok(faded(make({ type: 'scatter', field: 'v' })) === 3, 'dispersión');
});

test('descripción accesible: qué es, cuántos datos, de dónde a dónde y el más alto', () => {
  const one = new LozChart(host(), {
    title: 'Ventas por semana',
    data: [1, 2, 3, 4].map((semana, i) => ({ semana, ventas: [120, 180, 150, 90][i] })),
    xAxis: { field: 'semana', type: 'linear' },
    series: [{ type: 'bar', field: 'ventas', name: 'Ventas' }],
    animate: false,
  });
  assert.equal(
    svg(one).getAttribute('aria-label'),
    'Ventas por semana. Gráfico de barras con 4 puntos, de 1 a 4. El más alto es 2, con 180. ' +
      'Recorre los datos con las flechas izquierda y derecha.',
  );
  const asked = chart({ title: '¿Qué vendimos?' });
  assert.match(svg(asked).getAttribute('aria-label')!, /^¿Qué vendimos\? Gráfico de líneas/);
  const two = chart();
  assert.equal(
    svg(two).getAttribute('aria-label'),
    'Gráfico de líneas con 2 series y 12 categorías. Recorre los datos con las flechas izquierda y derecha.',
  );
  const live = root(two)
    .querySelectorAll('div')
    .find((d) => d.getAttribute('aria-live') === 'polite')!;
  two.toggleSeries('Costos');
  assert.equal(live.textContent, 'Ya no se ve Costos');
  two.toggleSeries('Costos');
  assert.equal(live.textContent, 'Ahora se ve Costos');
});
