import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_WIDTH,
  buildGraph,
  buildModel,
  crossings,
  fitLabel,
  hitRibbon,
  layoutSankey,
  linkOrder,
  nodeColumns,
  nodeSlots,
  nodeValues,
  orderNodes,
  placeLabels,
  ribbonCenterAt,
  ribbonPath,
  sankey,
  type Ribbon,
} from '../src/series/sankey';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;

type Row = [from: string, to: string, value: number];

/** Tráfico web: fuentes → páginas → resultado. */
const WEB: Row[] = [
  ['Búsqueda', 'Producto', 4200],
  ['Búsqueda', 'Blog', 1300],
  ['Redes', 'Producto', 1800],
  ['Redes', 'Blog', 900],
  ['Correo', 'Producto', 700],
  ['Producto', 'Compra', 2100],
  ['Producto', 'Abandono', 4600],
  ['Blog', 'Producto', 400],
  ['Blog', 'Abandono', 1800],
];

const cols = (rows: Row[]) => ({
  from: rows.map((r) => r[0]),
  to: rows.map((r) => r[1]),
  values: rows.map((r) => r[2]),
});

function model(rows: Row[]) {
  const c = cols(rows);
  return buildModel(c.from, c.to, c.values);
}

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  const c = cols(rows);
  return {
    key: 'Sesiones',
    name: 'Sesiones',
    impl: sankey,
    slot: 0,
    options: { type: 'sankey', field: 'v', to: 'to', ...extra },
    values: c.values,
    columns: {},
    texts: { to: c.to, from: c.from },
    stackKey: null,
    axis: 'left',
  };
}

function context(ps: PreparedSeries, rows: Row[], width = 640, height = 320, y1 = ps.values, theme = LIGHT): DrawContext {
  const n = rows.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: '#2a78d6',
    pointColor: () => '#2a78d6',
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => rows[i][0],
    measure,
    format: (v) => String(v),
    compact: (v) => `${Math.round(v / 1000)} mil`,
    percent: (v) => `${Math.round(v * 100)} %`,
  };
}

const format: TooltipFormat = {
  value: String,
  number: String,
  percent: (p) => `${Math.round(p * 1000) / 10} %`,
  isHidden: () => false,
  difference: String,
};

test('grafo: nodos por primera aparición; ceros, NaN, vacíos y bucles se ignoran', () => {
  const g = buildGraph(['A', 'A', 'B', '', 'C', 'C', 'B'], ['B', 'C', 'D', 'D', 'C', 'D', 'D'], [5, 0, NaN, 3, 4, -2, 7]);
  assert.deepEqual(g.names, ['A', 'B', 'D']);
  assert.deepEqual(
    g.links.map((l) => l.index),
    [0, 6],
  );
  assert.deepEqual(g.ignored, [1, 2, 3, 4, 5]);
  assert.deepEqual(g.dropped, []);
  // Sin ningún flujo válido no hay nada que dibujar.
  const empty = buildModel(['A'], ['B'], [0]);
  assert.equal(empty.links.length, 0);
  assert.equal(sankey.draw(context(series([['A', 'B', 0]]), [['A', 'B', 0]])), '');
});

test('ciclos: se suelta el flujo que lo cierra, en el orden de los datos', () => {
  const g = buildGraph(['A', 'B', 'C', 'C'], ['B', 'C', 'A', 'D'], [5, 4, 3, 2]);
  assert.deepEqual(g.dropped, [2]);
  assert.deepEqual(
    g.links.map((l) => l.index),
    [0, 1, 3],
  );
  // Ida y vuelta entre dos nodos: queda la ida.
  assert.deepEqual(buildGraph(['A', 'B'], ['B', 'A'], [1, 1]).dropped, [1]);
});

test('columnas: camino más largo desde un origen; los finales a la derecha', () => {
  const m = model(WEB);
  const col = (name: string) => m.columns[m.names.indexOf(name)];
  assert.equal(col('Búsqueda'), 0);
  assert.equal(col('Correo'), 0);
  assert.equal(col('Blog'), 1);
  // Producto recibe del Blog: va después de él.
  assert.equal(col('Producto'), 2);
  assert.equal(col('Compra'), 3);
  assert.equal(col('Abandono'), 3);
  // Un destino final corto también se alinea a la derecha.
  const c = nodeColumns(4, [
    { index: 0, source: 0, target: 1, value: 1 },
    { index: 1, source: 1, target: 2, value: 1 },
    { index: 2, source: 0, target: 3, value: 1 },
  ]);
  assert.deepEqual(c, [0, 1, 2, 2]);
});

test('valor del nodo: el mayor entre lo que entra y lo que sale', () => {
  const m = model(WEB);
  const at = (name: string) => m.names.indexOf(name);
  assert.equal(m.value[at('Búsqueda')], 5500);
  assert.equal(m.inflow[at('Producto')], 7100);
  assert.equal(m.outflow[at('Producto')], 6700);
  assert.equal(m.value[at('Producto')], 7100);
  const { value } = nodeValues(2, [{ index: 0, source: 0, target: 1, value: 3 }], () => 1);
  assert.deepEqual(value, [1, 1]);
});

test('orden: las pasadas de baricentro quitan el cruce de un caso conocido', () => {
  // Por aparición: A, B a la izquierda; Y arriba y X abajo a la derecha. A→X y B→Y se cruzan.
  const g = buildGraph(['A', 'A', 'B'], ['Y', 'X', 'Y'], [1, 10, 10]);
  const columns = nodeColumns(g.names.length, g.links);
  const { value } = nodeValues(g.names.length, g.links);
  const first = g.names.map((_, v) => v);
  const naive = new Array<number>(g.names.length);
  for (const c of [0, 1]) {
    const col = first.filter((v) => columns[v] === c);
    const total = col.reduce((s, v) => s + value[v], 0);
    let acc = 0;
    for (const v of col) {
      naive[v] = (acc + value[v] / 2) / total;
      acc += value[v];
    }
  }
  assert.ok(crossings(g.links, columns, naive) > 0);
  const { order, center } = orderNodes(g.names.length, g.links, columns, value);
  assert.equal(crossings(g.links, columns, center), 0);
  assert.deepEqual(
    order[1].map((v) => g.names[v]),
    ['X', 'Y'],
  );
});

test('layout: cada nodo mide lo que suman sus cintas y nada se sale del área', () => {
  const m = model(WEB);
  const g = layoutSankey(m, cols(WEB).values, 640, 320);
  for (let v = 0; v < m.names.length; v++) {
    const h = g.nodes[v].y1 - g.nodes[v].y0;
    const sum = (rows: { index: number }[]) => rows.reduce((s, l) => s + g.byRow.get(l.index)!.width, 0);
    assert.ok(Math.abs(Math.max(sum(m.outs[v]), sum(m.ins[v])) - h) < 1e-6, m.names[v]);
    assert.ok(g.nodes[v].y0 >= -1e-6 && g.nodes[v].y1 <= 320 + 1e-6);
  }
  // Primera y última columna en los bordes.
  assert.equal(g.nodes[m.names.indexOf('Búsqueda')].x, 0);
  assert.equal(g.nodes[m.names.indexOf('Compra')].x, 640 - NODE_WIDTH);
  // Las cintas salen pegadas al nodo y apiladas sin huecos ni cruces dentro de él.
  const p = m.names.indexOf('Producto');
  const outs = m.outs[p].map((l) => g.byRow.get(l.index)!);
  assert.equal(outs[0].sy - outs[0].width / 2, g.nodes[p].y0);
  for (let j = 1; j < outs.length; j++) assert.ok(outs[j].ty > outs[j - 1].ty);
});

test('animación: misma escala y mismo orden; los nodos crecen en su lugar', () => {
  const m = model(WEB);
  const full = layoutSankey(m, cols(WEB).values, 640, 320);
  const half = layoutSankey(
    m,
    cols(WEB).values.map((v) => v / 2),
    640,
    320,
  );
  assert.equal(half.k, full.k);
  const b = m.names.indexOf('Búsqueda');
  assert.ok(Math.abs(half.nodes[b].y1 - half.nodes[b].y0 - (full.nodes[b].y1 - full.nodes[b].y0) / 2) < 1e-6);
  // En cero (primer cuadro) no hay alto ni NaN.
  const zero = layoutSankey(
    m,
    cols(WEB).values.map(() => 0),
    640,
    320,
  );
  assert.ok(zero.nodes.every((n) => n.y0 === n.y1 && isFinite(n.y0)));
  assert.ok(zero.ribbons.every((r) => ribbonPath(r) === ''));
  // Datos que se achican: la escala de los actuales manda y nada se sale.
  const big = layoutSankey(
    m,
    cols(WEB).values.map((v) => v * 3),
    640,
    320,
  );
  assert.ok(big.nodes.every((n) => n.y0 >= -1e-6 && n.y1 <= 320 + 1e-6));
});

test('cinta: dos cúbicas con tangentes horizontales y hit-test por su alto', () => {
  const r: Ribbon = { index: 4, source: 0, target: 1, x0: 12, x1: 388, sy: 50, ty: 150, width: 20 };
  assert.equal(ribbonPath(r), 'M12,40C200,40 200,140 388,140L388,160C200,160 200,60 12,60Z');
  assert.ok(Math.abs(ribbonCenterAt(r, 200) - 100) < 1e-6, 'en la mitad, a media altura');
  assert.ok(Math.abs(ribbonCenterAt(r, 12) - 50) < 1e-6);
  assert.ok(Number.isNaN(ribbonCenterAt(r, 5)));
  const g = {
    nodes: [
      { x: 0, y0: 40, y1: 60 },
      { x: 388, y0: 140, y1: 160 },
    ],
    ribbons: [r],
    byRow: new Map([[4, r]]),
    k: 1,
    gap: 0,
  };
  assert.equal(hitRibbon(g, 200, 100), 4);
  assert.equal(hitRibbon(g, 200, 109), 4);
  assert.equal(hitRibbon(g, 200, 112), -1);
  assert.equal(hitRibbon(g, 5, 50), -1, 'sobre un nodo no hay flujo activo');
  // Dos cintas encimadas: gana la fina, que va encima.
  const thin: Ribbon = { ...r, index: 7, width: 2 };
  assert.equal(hitRibbon({ ...g, ribbons: [r, thin] }, 200, 100), 7);
  assert.equal(hitRibbon({ ...g, ribbons: [r, thin] }, 200, 107), 4);
});

test('hit, anchor y hover en el gráfico', () => {
  const ps = series(WEB);
  const ctx = context(ps, WEB);
  sankey.draw(ctx);
  const [x, y] = sankey.anchor!(ctx, 0)!;
  assert.equal(sankey.hit!(ctx, x, y), 0);
  const h = sankey.hover!(ctx, 0);
  assert.ok(h.includes('fill-opacity="0.65"') && h.includes('stroke-width="1"'));
  assert.equal(sankey.hover!(ctx, 99), '');
});

test('colores: la paleta para los orígenes, nunca cíclica; el resto hereda del que más aporta', () => {
  const m = model(WEB);
  const at = (name: string) => m.slots[m.names.indexOf(name)];
  assert.equal(at('Búsqueda'), 0);
  assert.equal(at('Redes'), 1);
  assert.equal(at('Correo'), 2);
  assert.equal(at('Producto'), 0, 'la mayor parte llega desde Búsqueda');
  assert.equal(at('Blog'), 0);
  // Más de 8 orígenes: del noveno en adelante, el gris.
  const many: Row[] = Array.from({ length: 10 }, (_, k) => [`O${k}`, 'Fin', 10 - k]);
  const mm = model(many);
  assert.deepEqual(
    many.map(([name]) => mm.slots[mm.names.indexOf(name)]),
    [0, 1, 2, 3, 4, 5, 6, 7, -1, -1],
  );
  assert.deepEqual(nodeSlots(2, [{ index: 0, source: 0, target: 1, value: 1 }], [0, 1], 0), [-1, -1]);
  // Las cintas llevan el color de su origen y los textos, el del tema.
  const d = sankey.draw(context(series(WEB), WEB));
  assert.ok(d.includes(`fill="${LIGHT.palette[1]}" fill-opacity="0.35"`));
  const texts = d.match(/<text[^>]*>/g) ?? [];
  assert.ok(texts.length > 0 && texts.every((t) => !LIGHT.palette.some((c) => t.includes(c))));
  assert.ok(sankey.draw(context(series(WEB), WEB, 640, 320, undefined, DARK)).includes('fill-opacity="0.38"'));
});

test('etiquetas: nombre y valor; se recortan o se omiten, nunca se enciman', () => {
  assert.deepEqual(fitLabel('Producto', '7100', '7 mil', 200, measure), { name: 'Producto', value: '7100' });
  assert.deepEqual(fitLabel('Producto', '7100', '7 mil', 80, measure), { name: 'Producto', value: '' });
  assert.deepEqual(fitLabel('Producto', '71000000', '71 M', 90, measure), { name: 'Producto', value: '71 M' });
  assert.deepEqual(fitLabel('Producto', '7100', '7 mil', 40, measure), { name: 'Prod…', value: '' });
  assert.equal(fitLabel('Producto', '7100', '7 mil', 20, measure), null);
  // Muchos nodos delgados en una columna: las etiquetas que quedan están separadas.
  const thin: Row[] = Array.from({ length: 30 }, (_, k) => ['Origen', `Destino ${k}`, k === 0 ? 500 : 5]);
  const m = model(thin);
  const g = layoutSankey(m, cols(thin).values, 390, 240);
  const labels = placeLabels(m, g, 390, 240, measure, (v) => ({ full: String(m.value[v]), compact: '' }));
  const right = labels.filter((l) => l.anchor === 'end').map((l) => l.y);
  assert.ok(right.length > 1 && right.length < 30);
  right.sort((a, b) => a - b);
  for (let j = 1; j < right.length; j++) assert.ok(right[j] - right[j - 1] >= 15);
  assert.ok(
    labels.some((l) => l.name === 'Destino 0'),
    'el nodo mayor siempre lleva etiqueta',
  );
  // La primera columna a la derecha del nodo y la última a la izquierda, dentro del área.
  assert.ok(labels.every((l) => l.x >= 0 && l.x <= 390));
  const first = labels.find((l) => l.name === 'Origen')!;
  assert.equal(first.anchor, 'start');
  assert.equal(first.x, NODE_WIDTH + 6);
});

test('etiquetas: el hueco antes de la última columna se parte solo donde dos chocan', () => {
  // Dos columnas: "Arriba" y "Abajo" no quedan a la altura de "Fin", así que usan todo el hueco.
  const rows: Row[] = [
    ['Origen con nombre largo', 'Fin con nombre largo', 10],
    ['Arriba con nombre bastante largo', 'Fin con nombre largo', 1],
  ];
  const m = model(rows);
  const g = layoutSankey(m, cols(rows).values, 390, 240);
  const labels = placeLabels(m, g, 390, 240, measure, () => ({ full: '', compact: '' }));
  const byName = (s: string) => labels.find((l) => l.name.startsWith(s.slice(0, 4)))!;
  const half = (390 - NODE_WIDTH - NODE_WIDTH - 18) / 2;
  // "Origen…" está a la altura de "Fin": se recorta a medio hueco; "Arriba…" no choca y va entero.
  assert.ok(measure(byName('Origen').name) <= half);
  assert.equal(byName('Arriba').name, 'Arriba con nombre bastante largo');
});

test('textos escapados y opción labels: false', () => {
  const rows: Row[] = [['<b>Tienda & "más"</b>', 'Venta', 10]];
  const d = sankey.draw(context(series(rows), rows));
  assert.ok(d.includes('&lt;b&gt;Tienda &amp; &quot;más&quot;&lt;/b&gt;'));
  assert.ok(!d.includes('<b>'));
  const off = sankey.draw(context(series(WEB, { labels: false }), WEB));
  assert.ok(off.includes('<path') && !off.includes('<text'));
});

test('encabezado, tooltip y teclado, sin esperar al primer dibujo (la tabla se arma antes)', () => {
  // El núcleo pide el origen con el campo de la X y el destino con `to`.
  assert.deepEqual(sankey.texts!({ type: 'sankey', field: 'v', to: 'destino' }, 'origen'), {
    to: 'destino',
    from: 'origen',
  });
  const ps = series(WEB);
  assert.equal(sankey.headline!(ps, 0, 'Búsqueda'), 'Búsqueda → Producto');
  assert.deepEqual(sankey.tooltip!(ps, 0, format), {
    value: '4200',
    details: [
      ['De lo que sale de Búsqueda', '76.4 %'],
      ['De lo que llega a Producto', '59.2 %'],
    ],
  });
  // El teclado recorre los flujos por columna del origen y altura.
  const m = model(WEB);
  const order = sankey.navigable!(ps);
  assert.deepEqual(order, linkOrder(m));
  assert.equal(order.length, WEB.length);
  const colOf = (i: number) => m.columns[m.names.indexOf(WEB[i][0])];
  for (let j = 1; j < order.length; j++) assert.ok(colOf(order[j]) >= colOf(order[j - 1]));
});

test('tooltip de flujos que no se dibujan', () => {
  const rows: Row[] = [
    ['A', 'B', 5],
    ['B', 'A', 2],
    ['A', 'C', 0],
  ];
  const ps = series(rows);
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (s: string) => warnings.push(s);
  try {
    // Primero el tooltip (como la tabla oculta), después dos cuadros.
    assert.deepEqual(sankey.tooltip!(ps, 1, format), { value: '2', details: [['No aparece', 'cerraría un ciclo']] });
    const ctx = context(ps, rows);
    sankey.draw(ctx);
    sankey.draw(ctx);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1, 'un solo aviso por conjunto de datos');
  assert.ok(warnings[0].includes('"B → A"'));
  assert.deepEqual(sankey.tooltip!(ps, 2, format), { value: '0' });
  assert.ok(!sankey.navigable!(ps).includes(2));
});

test('muestra del tooltip: el color del nodo de origen, el mismo de la cinta', () => {
  const m = model(WEB);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(series(WEB), WEB, 640, 320, undefined, theme);
    WEB.forEach(([from], i) => {
      const s = m.slots[m.names.indexOf(from)];
      const swatch = sankey.swatch!(ctx, i);
      assert.equal(swatch, s >= 0 ? theme.palette[s] : theme.other);
      assert.ok(sankey.hover!(ctx, i).includes(`fill="${swatch}"`), `cinta ${i} en ${swatch}`);
    });
  }
  // Dos orígenes distintos, dos muestras distintas: no es el color de la serie.
  const ctx = context(series(WEB), WEB);
  assert.notEqual(sankey.swatch!(ctx, 0), sankey.swatch!(ctx, 2));
  // Un flujo que no se dibuja (cierra un ciclo) no tiene color propio: el de la serie.
  const loop: Row[] = [
    ['A', 'B', 5],
    ['B', 'A', 2],
  ];
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(sankey.swatch!(context(series(loop), loop), 1), null);
  } finally {
    console.warn = warn;
  }
});
