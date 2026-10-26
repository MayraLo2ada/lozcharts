import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_FONT,
  appearance,
  buildCloud,
  clipText,
  ensureContrast,
  fontSize,
  groupInk,
  hitWord,
  layoutCloud,
  legendLayout,
  levelColors,
  levelOf,
  maxFontSize,
  normalizeWord,
  placeBoxes,
  spiral,
  wordcloud,
  type Box,
  type CloudGeometry,
} from '../src/series/wordcloud';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { contrast, parseColor } from '../src/core/color';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT, type Theme } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter a 12 px. */
const measure = (s: string) => s.length * 7;

type Row = [word: string, weight: number, group: string];

/** Menciones de temas en las respuestas abiertas de una encuesta de servicio. */
const SURVEY: Row[] = [
  ['atención', 120, 'Servicio'],
  ['precio', 90, 'Costo'],
  ['rapidez', 64, 'Servicio'],
  ['envío', 40, 'Logística'],
  ['calidad', 36, 'Producto'],
  ['Atención ', 30, 'Servicio'],
  ['empaque', 12, 'Logística'],
  ['', 50, 'Servicio'],
  ['garantía', 0, 'Producto'],
  ['devolución', -4, 'Logística'],
  ['app', NaN, 'Producto'],
  ['  atención', 10, ''],
];

const cols = (rows: Row[]) => ({
  words: rows.map((r) => r[0]),
  values: rows.map((r) => r[1]),
  groups: rows.map((r) => r[2]),
});

function series(rows: Row[], extra: Partial<PreparedSeries['options']> = {}): PreparedSeries {
  const c = cols(rows);
  return {
    key: 'Menciones',
    name: 'Menciones',
    impl: wordcloud,
    slot: 0,
    options: { type: 'wordcloud', field: 'n', ...extra },
    values: c.values,
    columns: {},
    texts: { word: c.words, group: c.groups },
    stackKey: null,
    axis: 'left',
    locale: 'es',
  };
}

function context(ps: PreparedSeries, width = 640, height = 360, y1 = ps.values, theme: Theme = LIGHT): DrawContext {
  const n = ps.values.length;
  return {
    frame: { ps, y0: ps.values.map(() => 0), y1, cols: {}, alpha: 1, slot: 0, slots: 1, outer: [] },
    color: theme.palette[0],
    pointColor: () => theme.palette[0],
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    locale: 'es',
    label: (i) => ps.texts.word[i],
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
  locale: 'es',
  difference: String,
};

/** Vocabulario sintético de n palabras con pesos de Zipf (como el de un texto real). */
function zipf(n: number): Row[] {
  const stems = ['dato', 'red', 'mapa', 'nube', 'tabla', 'serie', 'eje', 'color', 'forma', 'valor', 'escala', 'punto'];
  return Array.from({ length: n }, (_, k) => [`${stems[k % stems.length]}${k}`, Math.round(10_000 / (k + 1)), ''] as Row);
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function assertClean(g: CloudGeometry, width: number, height: number) {
  const boxes = g.placed.filter((p) => p !== null).map((p) => p!.box);
  for (const [k, b] of boxes.entries()) {
    assert.ok(b.x0 >= 0 && b.x1 <= width && b.y0 >= 0 && b.y1 <= height, `caja ${k} dentro del área`);
    for (let j = k + 1; j < boxes.length; j++) assert.ok(!overlaps(b, boxes[j]), `cajas ${k} y ${j} sin encimarse`);
  }
}

test('palabra: forma canónica, sin espacios a los lados y espacios internos simples', () => {
  assert.equal(normalizeWord('  hola   mundo '), 'hola mundo');
  // "é" compuesta y descompuesta son la misma palabra.
  assert.equal(normalizeWord('café'), 'café');
});

test('modelo: las repetidas se suman; vacías y pesos cero, negativos o faltantes se ignoran', () => {
  const c = cols(SURVEY);
  const m = buildCloud(c.words, c.values);
  assert.deepEqual(
    m.words.map((w) => [w.text, w.weight]),
    [
      ['atención', 130],
      ['precio', 90],
      ['rapidez', 64],
      ['envío', 40],
      ['calidad', 36],
      ['Atención', 30],
      ['empaque', 12],
    ],
  );
  assert.deepEqual(m.words[0].rows, [0, 11]);
  assert.equal(m.words[0].row, 0);
  assert.deepEqual(m.ignored, [7, 8, 9, 10]);
  assert.deepEqual(m.rowWord, [0, 1, 2, 3, 4, 5, 6, -1, -1, -1, -1, 0]);
  assert.equal(m.total, 402);
  assert.deepEqual(m.groups, []);
  assert.ok(m.slots.every((s) => s === 0));
  // Empates: el orden de los datos.
  assert.deepEqual(
    buildCloud(['b', 'a', 'c'], [5, 5, 9]).words.map((w) => w.text),
    ['c', 'b', 'a'],
  );
  assert.equal(buildCloud(['x'], [Infinity]).words.length, 0);
});

test('grupos: por primera aparición, el de la primera fila con grupo; pasado el octavo, "otros"', () => {
  const c = cols(SURVEY);
  const m = buildCloud(c.words, c.values, c.groups);
  assert.deepEqual(m.groups, ['Servicio', 'Costo', 'Logística', 'Producto']);
  assert.deepEqual(m.slots, [0, 1, 0, 2, 3, 0, 2]);
  const many = Array.from({ length: 10 }, (_, k) => `G${k}`);
  const mm = buildCloud(
    many.map((g) => `p${g}`),
    many.map((_, k) => 10 - k),
    many,
  );
  assert.deepEqual(mm.slots, [0, 1, 2, 3, 4, 5, 6, 7, -1, -1]);
  // Con grupos, una palabra sin grupo va en gris.
  assert.deepEqual(buildCloud(['a', 'b'], [2, 1], ['X', '']).slots, [0, -1]);
});

test('cuerpos: escala de raíz (el área con el peso) y nunca bajo el mínimo', () => {
  assert.equal(fontSize(100, 100, 40), 40);
  assert.equal(fontSize(25, 100, 40), 20);
  assert.equal(fontSize(1, 100, 40), MIN_FONT);
  assert.equal(fontSize(0, 100, 40), MIN_FONT);
  assert.equal(fontSize(5, 0, 40), MIN_FONT);
  // Cuatro veces el peso, el doble de cuerpo: el área va con el peso.
  assert.equal(fontSize(64, 100, 50) / fontSize(16, 100, 50), 2);
});

test('cuerpo mayor: crece con el área, con topes por el alto, el ancho y el absoluto', () => {
  const words = zipf(40).map(([text, weight]) => ({ text, weight }));
  const small = maxFontSize(words, 400, 240, measure);
  const big = maxFontSize(words, 1400, 480, measure);
  assert.ok(big > small, `${big} > ${small}`);
  assert.ok(maxFontSize(words, 2000, 160, measure) <= 160 * 0.3 + 1e-9, 'tope por el alto');
  assert.ok(maxFontSize([{ text: 'x', weight: 1 }], 4000, 4000, measure) <= 128, 'tope absoluto');
  // Una palabra larguísima cabe a lo ancho.
  const long = 'a'.repeat(60);
  const s = maxFontSize([{ text: long, weight: 1 }], 600, 400, measure);
  assert.ok((measure(long) / 12) * s * 1.09 <= 600, 'la más pesada cabe a lo ancho');
  assert.equal(maxFontSize([], 600, 400, measure), MIN_FONT);
  assert.equal(maxFontSize(words, 0, 400, measure), MIN_FONT);
});

test('espiral: nace en el centro, se estira con la proporción y llega a las esquinas', () => {
  const p = spiral(900, 300);
  assert.deepEqual([p.x[0], p.y[0]], [0, 0]);
  const mx = Math.max(...p.x.map(Math.abs));
  const my = Math.max(...p.y.map(Math.abs));
  // La proporción del área (3) y un 25 % más a lo ancho: las palabras son anchas y bajas.
  assert.ok(Math.abs(mx / my - 3.75) < 0.15, `proporción ${mx / my}`);
  assert.ok(mx >= 450 && my >= 150, 'cubre las esquinas');
  const tall = spiral(200, 600);
  assert.ok(Math.max(...tall.y.map(Math.abs)) > Math.max(...tall.x.map(Math.abs)));
  assert.deepEqual(spiral(900, 300), p, 'determinista');
});

test('colocación: la primera al centro, ninguna se encima ni se sale; la que no cabe, null', () => {
  const items = [
    { w: 100, h: 40 },
    { w: 60, h: 20 },
    { w: 60, h: 20 },
    { w: 30, h: 14 },
    { w: 500, h: 20 },
  ];
  const boxes = placeBoxes(items, 300, 200);
  assert.deepEqual(boxes[0], { x0: 100, x1: 200, y0: 80, y1: 120 });
  assert.equal(boxes[4], null, 'más ancha que el área');
  const placed = boxes.filter((b): b is Box => b !== null);
  assert.equal(placed.length, 4);
  for (const [k, b] of placed.entries()) {
    assert.ok(b.x0 >= 2 && b.x1 <= 298 && b.y0 >= 2 && b.y1 <= 198);
    for (const o of placed.slice(k + 1)) assert.ok(!overlaps(b, o));
  }
});

test('nube: 300 palabras sin encimarse, dentro del área, deterministas y rápidas', () => {
  const c = cols(zipf(300));
  const m = buildCloud(c.words, c.values);
  const t0 = performance.now();
  const g = layoutCloud(m, 1200, 420, measure);
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `${ms.toFixed(0)} ms`);
  assertClean(g, 1200, 420);
  assert.deepEqual(layoutCloud(m, 1200, 420, measure), g, 'mismo resultado en cada carga');
  // La más pesada al centro.
  const top = g.placed[0]!;
  assert.ok(Math.abs(top.x - 600) < 2 && Math.abs(top.y - 210) < 2);
  assert.ok(top.size > 3 * MIN_FONT, 'hay jerarquía aunque sean muchas');
  // Cuerpos de mayor a menor en el orden de los pesos.
  const sizes = g.placed.filter((p) => p).map((p) => p!.size);
  assert.ok(sizes.every((s, k) => k === 0 || s <= sizes[k - 1] + 1e-9));
});

test('nube: en un área ancha llena el ancho, no un círculo al centro', () => {
  const c = cols(zipf(120));
  const g = layoutCloud(buildCloud(c.words, c.values), 1400, 360, measure);
  const xs = g.placed.filter((p) => p).flatMap((p) => [p!.box.x0, p!.box.x1]);
  const ys = g.placed.filter((p) => p).flatMap((p) => [p!.box.y0, p!.box.y1]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  assert.ok(spanX > 0.85 * 1400, `ancho cubierto ${spanX}`);
  assert.ok(spanY > 0.75 * 360, `alto cubierto ${spanY}`);
});

test('omitidas: las que no caben son siempre las más livianas; siguen en el modelo', () => {
  const c = cols(zipf(500));
  const m = buildCloud(c.words, c.values);
  const g = layoutCloud(m, 360, 300, measure);
  assert.ok(g.omitted.length > 0);
  const first = g.omitted[0];
  assert.deepEqual(
    g.omitted,
    Array.from({ length: m.words.length - first }, (_, k) => first + k),
  );
  assert.ok(g.placed.slice(0, first).every((p) => p !== null));
  assert.ok(g.placed.slice(first).every((p) => p === null));
  assertClean(g, 360, 300);
  assert.equal(m.words.length, 500);
});

test('omitidas: un solo aviso en consola por conjunto de datos', () => {
  const warn = console.warn;
  const messages: string[] = [];
  console.warn = (s: string) => messages.push(s);
  try {
    const ps = series(zipf(400));
    wordcloud.draw(context(ps, 300, 200));
    wordcloud.draw(context(ps, 300, 200));
    wordcloud.draw(context(ps, 280, 200));
  } finally {
    console.warn = warn;
  }
  assert.equal(messages.length, 1);
  assert.match(messages[0], /no caben \d+ palabras, las de menor peso\. Siguen en la tabla de datos/);
});

test('palabras largas: se achican para caber y, si ni en el mínimo caben, se recortan', () => {
  const long = 'Electroencefalografistas';
  const huge = 'x'.repeat(200);
  const m = buildCloud([long, 'corto', huge], [100, 50, 10]);
  const g = layoutCloud(m, 300, 200, measure);
  const a = g.placed[0]!;
  assert.equal(a.text, long);
  assert.ok(a.box.x1 - a.box.x0 <= 300);
  const c = g.placed[2]!;
  assert.equal(c.size, MIN_FONT);
  assert.ok(c.text.endsWith('…') && c.text.length < huge.length);
  assertClean(g, 300, 200);
});

test('recorte: no parte emojis compuestos ni letras con acento', () => {
  const family = '👩‍👩‍👧‍👦';
  const text = family.repeat(5);
  const clipped = clipText(text, 30, (s) => Array.from(s).length * 2);
  assert.ok(clipped.endsWith('…'));
  assert.equal(clipped.slice(0, -1).split(family).join(''), '', 'solo familias enteras');
  assert.equal(clipText('corto', 100, measure), 'corto');
  assert.equal(clipText('abc', 1, measure), '…');
});

test('casos límite: una sola palabra al centro; nada que dibujar; área cero', () => {
  const one = layoutCloud(buildCloud(['única'], [7]), 600, 300, measure);
  assert.equal(one.placed.length, 1);
  assert.ok(Math.abs(one.placed[0]!.x - 300) < 1 && Math.abs(one.placed[0]!.y - 150) < 1);
  assert.equal(wordcloud.draw(context(series([['', 1, '']]))), '');
  assert.equal(wordcloud.draw(context(series(SURVEY), 0, 360)), '');
  const emoji: Row[] = [
    ['🚀 lanzamiento', 30, ''],
    ['café', 20, ''],
    ['niño', 10, ''],
  ];
  const d = wordcloud.draw(context(series(emoji)));
  assert.ok(d.includes('>🚀 lanzamiento<') && d.includes('>café<') && d.includes('>niño<'));
});

test('color sin grupo: tres intensidades del color de la serie, todas a 4,5:1 o más', () => {
  for (const theme of [LIGHT, DARK]) {
    for (const color of [...theme.palette, '#ffffff', '#000000']) {
      const levels = levelColors(color, theme);
      assert.equal(levels.length, 3);
      for (const c of levels)
        assert.ok(contrast(parseColor(c)!, parseColor(theme.surface)!) >= 4.5, `${theme.name} ${color} → ${c}`);
    }
  }
  // El violeta del claro ya pasa: su nivel principal es el mismo.
  assert.equal(levelColors(LIGHT.palette[0], LIGHT)[0], LIGHT.palette[0]);
  assert.equal(levelOf(100, 100), 0);
  assert.equal(levelOf(16, 100), 1);
  assert.equal(levelOf(4, 100), 2);
});

test('color con grupos: la paleta en orden, legible como texto; el noveno, gris', () => {
  for (const theme of [LIGHT, DARK]) {
    for (let s = -1; s < 8; s++) {
      const c = groupInk(s, theme);
      assert.ok(contrast(parseColor(c)!, parseColor(theme.surface)!) >= 4.5, `${theme.name} ${s}: ${c}`);
    }
    assert.equal(groupInk(8, theme), groupInk(-1, theme));
  }
  // El ocre del claro (2:1) se oscurece; un color que no se puede leer queda igual.
  assert.notEqual(groupInk(2, LIGHT), LIGHT.palette[2]);
  assert.equal(ensureContrast('rebeccapurple', LIGHT.surface, LIGHT.text), 'rebeccapurple');
  assert.equal(ensureContrast('#0b0b0b', LIGHT.surface, LIGHT.text), '#0b0b0b');
});

test('leyenda de grupos: solo con dos o más; "Sin grupo" u "Otros" al final', () => {
  const c = cols(SURVEY);
  const m = buildCloud(c.words, c.values, c.groups);
  const L = legendLayout(m, 640, measure);
  assert.deepEqual(
    L.items.map((i) => i.name),
    ['Servicio', 'Costo', 'Logística', 'Producto'],
  );
  assert.ok(L.height > 0);
  assert.deepEqual(legendLayout(buildCloud(['a'], [1], ['X']), 640, measure), { items: [], height: 0 });
  const g = layoutCloud(m, 640, 360, measure);
  assert.equal(g.top, L.height);
  assert.ok(
    g.placed.every((p) => !p || p.box.y0 >= g.top),
    'la nube va debajo de la leyenda',
  );
});

test('dibujo: una palabra por texto, de la más pesada a la más liviana, con su color', () => {
  const ps = series(SURVEY);
  const d = wordcloud.draw(context(ps));
  const words = [...d.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);
  assert.deepEqual(words, ['atención', 'precio', 'rapidez', 'envío', 'calidad', 'Atención', 'empaque']);
  assert.ok(d.includes(`fill="${LIGHT.palette[0]}"`));
  assert.ok(d.includes('text-anchor="middle"') && d.includes('font-weight="600"'));
  assert.ok(!d.includes('opacity='), 'sin animación, todas enteras');
  assert.ok(!d.includes('rotate'), 'todas horizontales');
  // Con grupos: leyenda (círculos) y un color por grupo.
  const grouped = wordcloud.draw(context(series(SURVEY, { group: 'g' })));
  assert.equal(grouped.match(/<circle/g)?.length, 4);
  assert.ok(grouped.includes(`fill="${groupInk(1, LIGHT)}"`));
});

test('tema oscuro: los colores del oscuro, también legibles', () => {
  const d = wordcloud.draw(context(series(SURVEY), 640, 360, undefined, DARK));
  const fills = [...d.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((x) => x[1]);
  assert.ok(fills.length > 0);
  for (const f of fills) assert.ok(contrast(parseColor(f)!, parseColor(DARK.surface)!) >= 4.5, f);
  assert.ok(!d.includes(`fill="${LIGHT.palette[0]}"`));
});

test('animación: aparecen por peso y ninguna se mueve', () => {
  assert.equal(appearance(0, 0, 10), 0);
  assert.equal(appearance(1, 9, 10), 1);
  assert.ok(appearance(0.5, 0, 10) > appearance(0.5, 9, 10));
  assert.equal(appearance(0.4, 0, 1), 1);
  const ps = series(SURVEY);
  const zero = wordcloud.draw(
    context(
      ps,
      640,
      360,
      ps.values.map(() => 0),
    ),
  );
  assert.equal(zero, '', 'en el primer cuadro no hay palabras');
  const half = wordcloud.draw(
    context(
      ps,
      640,
      360,
      ps.values.map((v) => v * 0.5),
    ),
  );
  const full = wordcloud.draw(context(ps));
  const pos = (s: string) =>
    [...s.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]*)</g)].map((x) => `${x[3]}@${x[1]},${x[2]}`);
  const now = pos(half);
  assert.ok(now.length > 0 && now.length < pos(full).length, 'las livianas todavía no aparecen');
  for (const p of now) assert.ok(pos(full).includes(p), `${p} no se movió`);
});

test('hit, anchor y hover: por la caja de la palabra', () => {
  const ps = series(SURVEY);
  const ctx = context(ps);
  wordcloud.draw(ctx);
  const [x, y] = wordcloud.anchor!(ctx, 1)!;
  assert.equal(wordcloud.hit!(ctx, x, y + 4), 1);
  assert.equal(wordcloud.hit!(ctx, 1, 1), -1);
  // La fila repetida apunta a la palabra que la suma; la ignorada no tiene lugar.
  assert.deepEqual(wordcloud.anchor!(ctx, 11), wordcloud.anchor!(ctx, 0));
  assert.equal(wordcloud.anchor!(ctx, 8), null);
  const h = wordcloud.hover!(ctx, 1);
  assert.ok(h.includes('fill-opacity="0.72"') && h.includes(`fill="${LIGHT.highlight}"`) && h.includes('>precio<'));
  assert.equal(wordcloud.hover!(ctx, 8), '');
  const pts = layoutCloud(buildCloud(['a'], [1]), 100, 100, measure).placed;
  assert.equal(hitWord(pts, 50, 50), 0);
});

test('encabezado, tooltip y teclado, sin esperar al primer dibujo', () => {
  assert.deepEqual(wordcloud.texts!({ type: 'wordcloud', field: 'n', group: 'tema' }, 'palabra'), {
    word: 'palabra',
    group: 'tema',
  });
  const ps = series(SURVEY, { group: 'g' });
  assert.equal(wordcloud.headline!(ps, 11, '  atención'), 'atención');
  assert.equal(wordcloud.headline!(ps, 7, ''), '');
  assert.deepEqual(wordcloud.tooltip!(ps, 0, format), {
    value: '130',
    details: [
      ['Del total', '32.3 %'],
      ['Junta', '2 filas'],
      ['Grupo', 'Servicio'],
    ],
  });
  assert.deepEqual(wordcloud.tooltip!(ps, 11, format), { value: '10', details: [['Se suma a', 'atención (130)']] });
  assert.deepEqual(wordcloud.tooltip!(ps, 8, format), { value: '0', details: [['No aparece', 'su peso es cero o menos']] });
  assert.deepEqual(wordcloud.tooltip!(ps, 7, format), { value: '50', details: [['No aparece', 'la fila no tiene palabra']] });
  assert.equal(wordcloud.tooltip!(ps, 10, format), null);
  assert.deepEqual(wordcloud.tooltip!(series(SURVEY), 1, format), { value: '90', details: [['Del total', '22.4 %']] });
  // Teclado: de mayor a menor peso, una parada por palabra.
  assert.deepEqual(wordcloud.navigable!(ps), [0, 1, 2, 3, 4, 5, 6]);
});

test('teclado y tooltip: las omitidas no se recorren y el tooltip lo dice', () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const rows = zipf(300);
    const ps = series(rows);
    wordcloud.draw(context(ps, 260, 160));
    const stops = wordcloud.navigable!(ps);
    assert.ok(stops.length > 0 && stops.length < 300);
    const last = rows.length - 1;
    assert.ok(!stops.includes(last));
    assert.deepEqual(wordcloud.tooltip!(ps, last, format)?.details?.at(-1), ['No aparece', 'no cabe en el espacio']);
  } finally {
    console.warn = warn;
  }
});

test('textos escapados', () => {
  const rows: Row[] = [
    ['<b>"Ana" & Luis</b>', 5, '<i>'],
    ["l'été", 3, '<i>'],
  ];
  const d = wordcloud.draw(context(series(rows)));
  assert.ok(d.includes('&lt;b&gt;&quot;Ana&quot; &amp; Luis&lt;/b&gt;'));
  assert.ok(d.includes('l&#39;été'));
  assert.ok(!d.includes('<b>'));
});

test('muestra del tooltip: la tinta de la palabra, la misma con la que se escribe', () => {
  for (const theme of [LIGHT, DARK]) {
    for (const ps of [series(SURVEY, { group: 'g' }), series(SURVEY)]) {
      const ctx = context(ps, 640, 360, ps.values, theme);
      for (const i of wordcloud.navigable!(ps)) {
        const swatch = wordcloud.swatch!(ctx, i);
        assert.ok(swatch && wordcloud.hover!(ctx, i).includes(`fill="${swatch}"`), `${SURVEY[i][0]} en ${swatch}`);
      }
    }
  }
  // Con grupos: por grupo, y una fila sumada en otra palabra lleva la tinta de esa palabra.
  const grouped = context(series(SURVEY, { group: 'g' }));
  const g = (i: number) => wordcloud.swatch!(grouped, i);
  assert.equal(g(5), g(0));
  assert.equal(g(2), g(0));
  assert.notEqual(g(1), g(0));
  // Sin grupos: la intensidad según el peso, no siempre el color de la serie.
  const plain = context(series(SURVEY));
  assert.notEqual(wordcloud.swatch!(plain, 0), wordcloud.swatch!(plain, 6));
  // Sin palabra no hay qué pintar.
  assert.equal(wordcloud.swatch!(grouped, 7), null);
});
