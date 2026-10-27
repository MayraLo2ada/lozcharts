import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { event, host, type FakeElement } from './dom';
import { LozChart } from '../src/index';
const LozChartClass = () => LozChart;
import { checkLayers, layerOptions, layers, type LayerSpec } from '../src/layers/index';
import { ExprError, compile, evaluate, fillTemplate, parse, parseTemplate } from '../src/layers/expr';
import { buildModel, foldRows, scalePosition } from '../src/layers/compile';
import { hitItem, iconMarkup, spatialStep } from '../src/layers/render';
import { ICONS, ICON_NAMES, iconName, isGlyph } from '../src/layers/icons';
import { layerTexts } from '../src/layers/texts';
import { DARK, LIGHT } from '../src/core/theme';
import '../site/assets/capas-ejemplos.js';

const run = (src: string, row: object = {}) => compile(src, 'es').run(row);
const fails = (src: string, locale = 'es') => {
  try {
    parse(src, locale);
  } catch (err) {
    assert.ok(err instanceof ExprError, `${src}: debe ser un ExprError`);
    return err;
  }
  assert.fail(`"${src}" debía fallar`);
};

// ------------------------------------------------------------ Expresiones

test('expresiones: aritmética con la precedencia de siempre', () => {
  assert.equal(run('1 + 2 * 3'), 7);
  assert.equal(run('(1 + 2) * 3'), 9);
  assert.equal(run('10 / 4 - 1'), 1.5);
  assert.equal(run('7 % 3'), 1);
  assert.equal(run('-2 * -3'), 6);
  assert.equal(run('2e3 + .5'), 2000.5);
});

test('expresiones: campos, comparaciones y lógica', () => {
  const row = { valor: 98.7, meta: 98.5, region: 'Costa', caida: false };
  assert.equal(run('valor >= meta', row), true);
  assert.equal(run('valor < meta', row), false);
  assert.equal(run("valor >= meta and region == 'Costa'", row), true);
  assert.equal(run("valor < meta or region = 'Costa'", row), true);
  assert.equal(run('not caida && !(valor < 90)', row), true);
  assert.equal(run('region != "Centro"', row), true);
  assert.equal(run('region <> "Costa"', row), false);
  // Un número que llega como texto (de un CSV) se compara como número.
  assert.equal(run('valor > 95', { valor: '98.2' }), true);
  assert.equal(run('`tasa de caída` > 1', { 'tasa de caída': 2 }), true);
});

test('expresiones: textos, funciones y datos que faltan', () => {
  assert.equal(run("'W' + 43"), 'W43');
  assert.equal(run('round(98.456, 1)'), 98.5);
  assert.equal(run('abs(-2) + floor(2.7) + ceil(0.2)'), 5);
  assert.equal(run('max(3, 9, 4) - min(3, 9, 4)'), 6);
  assert.equal(run("len('hola') + len(upper('a'))"), 5);
  assert.equal(run("contains(lower(sitio), 'bog')", { sitio: 'BOG-031' }), true);
  // Un dato que falta: la cuenta da null y toda comparación da falso, así no se pinta como si cumpliera.
  assert.equal(run('valor - meta', { valor: 3 }), null);
  assert.equal(run('valor >= meta', { valor: 3 }), false);
  assert.equal(run('valor < meta', { valor: 3 }), false);
  assert.equal(run('1 / 0'), null);
  assert.equal(run('null == null'), false);
});

test('expresiones: errores claros, con la posición y en el idioma pedido', () => {
  assert.match(fails('valor >= ').message, /Falta un valor al final/);
  assert.match(fails('valor => 3').message, /"=>" no es un operador; ¿quisiste decir ">="\?/);
  const open = fails('(valor + 1');
  assert.match(open.message, /Falta "\)"/);
  assert.match(fails('suma(1, 2)').message, /No conozco la función "suma"/);
  assert.match(fails('abs(1, 2)').message, /abs\(\) lleva 1 valor/);
  assert.match(fails("region == 'Costa").message, /Falta cerrar el texto que empieza en la posición 11/);
  const extra = fails('valor meta');
  assert.equal(extra.pos, 7);
  assert.match(extra.message, /Sobra "meta" en la posición 7/);
  assert.match(fails('').message, /vacía/);
  assert.match(fails('valor >= ', 'en').message, /A value is missing/);
  assert.match(fails('valor => 3', 'pt-BR').message, /você quis dizer ">="/);
});

test('expresiones: no ejecutan código ni leen nada fuera de la fila', () => {
  // Sin acceso a propiedades: el punto, los corchetes y las llamadas a lo que no es una función permitida fallan al leer.
  assert.match(fails('constructor.constructor("return 1")()').message, /"\."/);
  assert.match(fails('process.exit()').message, /"\."/);
  assert.match(fails('a[0]').message, /"\["/);
  assert.match(fails('eval("1")').message, /No conozco la función "eval"/);
  assert.match(fails('Function("x")').message, /No conozco la función "Function"/);
  assert.match(fails('x = 1; y').message, /";"/);
  // Un nombre solo se busca entre los campos propios: nada heredado ni global.
  assert.equal(run('constructor', {}), null);
  assert.equal(run('__proto__', {}), null);
  assert.equal(run('toString', { a: 1 }), null);
  assert.equal(run('globalThis', {}), null);
  assert.equal(run('window', {}), null);
  // Un campo que no es un valor simple (un objeto, una función) vale null.
  assert.equal(run('f', { f: () => 1 }), null);
  assert.equal(run('o', { o: { a: 1 } }), null);
  // El código del evaluador no usa eval ni Function.
  const source = readFileSync('src/layers/expr.ts', 'utf8');
  assert.ok(!/\beval\s*\(|new Function|\bFunction\s*\(/.test(source));
  // Ni una expresión enorme ni miles de paréntesis tumban la página.
  assert.match(fails('1+'.repeat(300) + '1').message, /muy larga/);
  assert.match(fails('('.repeat(60) + '1' + ')'.repeat(60)).message, /paréntesis anidados/);
});

test('plantillas: campos entre llaves, llaves literales y errores con su lugar', () => {
  const t = parseTemplate('{cluster}: {round(valor, 1)} {{%}}');
  assert.equal(
    fillTemplate(t, { cluster: 'COSTA', valor: 97.46 }, (v) => String(v)),
    'COSTA: 97.5 {%}',
  );
  assert.equal(fillTemplate(parseTemplate('{nada}'), {}, String), '–');
  try {
    parseTemplate('Total: {valor >= }');
    assert.fail('debía fallar');
  } catch (err) {
    assert.ok(err instanceof ExprError);
    assert.ok(err.pos > 8, 'la posición cuenta desde el principio de la plantilla');
  }
  const tree = parse('valor * 2');
  assert.equal(evaluate(tree, { valor: 4 }), 8);
});

// ------------------------------------------------------------ Escalas

/** Una tabla de dos filas, con números muy distintos entre una y otra. */
const TABLE: LayerSpec = {
  locale: 'es',
  data: [
    { fila: 'A', col: 'c1', v: 10 },
    { fila: 'A', col: 'c2', v: 20 },
    { fila: 'A', col: 'c3', v: 30 },
    { fila: 'B', col: 'c1', v: 900 },
    { fila: 'B', col: 'c2', v: 950 },
    { fila: 'B', col: 'c3', v: 800 },
  ],
  layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', scale: 'traffic-light', by: 'row' } }],
};

function scaleOf(spec: LayerSpec) {
  const m = buildModel(spec);
  assert.deepEqual(m.problems, []);
  return m.scales[0];
}

test('semáforo por fila: cada fila contra sí misma', () => {
  const s = scaleOf(TABLE);
  assert.deepEqual(s.domains.get('A'), [10, 30]);
  assert.deepEqual(s.domains.get('B'), [800, 950]);
  assert.equal(scalePosition(s, 10, 'A'), 0);
  assert.equal(scalePosition(s, 30, 'A'), 1);
  assert.equal(scalePosition(s, 20, 'A'), 0.5);
  // El 800 de la fila B es su peor semana aunque sea mucho mayor que todo lo de la fila A.
  assert.equal(scalePosition(s, 800, 'B'), 0);
});

test('semáforo por columna, global, con lo bajo como bueno y con dominio fijo', () => {
  const col = scaleOf({ ...TABLE, layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', by: 'column' } }] });
  assert.deepEqual(col.domains.get('c1'), [10, 900]);
  assert.equal(scalePosition(col, 900, 'c1'), 1);
  const all = scaleOf({ ...TABLE, layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v' } }] });
  assert.deepEqual([...all.domains.keys()], ['']);
  assert.equal(scalePosition(all, 10, ''), 0);
  const low = scaleOf({ ...TABLE, layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', better: 'low' } }] });
  assert.equal(scalePosition(low, 10, ''), 1, 'con better: low, lo más bajo es lo mejor');
  const fixed = scaleOf({ ...TABLE, layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', domain: [0, 100] } }] });
  assert.equal(scalePosition(fixed, 50, ''), 0.5);
  assert.equal(scalePosition(fixed, 900, ''), 1, 'fuera del dominio se queda en el extremo');
});

test('semáforo por umbrales: tramos fijos, en orden', () => {
  const s = scaleOf({ ...TABLE, layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', thresholds: [20, 900] } }] });
  assert.equal(scalePosition(s, 10, ''), 0);
  assert.equal(scalePosition(s, 20, ''), 0.5, 'el umbral ya cuenta como el tramo de arriba');
  assert.equal(scalePosition(s, 950, ''), 1);
  const low = scaleOf({
    ...TABLE,
    layers: [{ mark: 'cell', x: 'col', y: 'fila', color: { field: 'v', thresholds: [20, 900], better: 'low' } }],
  });
  assert.equal(scalePosition(low, 10, ''), 1);
});

test('ejes: se deducen de los datos y se comparten entre capas', () => {
  const m = buildModel({
    data: [
      { mes: '2026-01', v: 3, meta: 5 },
      { mes: '2026-02', v: 4, meta: 5 },
    ],
    layers: [
      { mark: 'line', x: 'mes', y: 'v' },
      { mark: 'rule', y: 'meta' },
    ],
  });
  assert.equal(m.x!.type, 'time');
  assert.equal(m.y!.type, 'linear');
  assert.equal(m.y!.max, 5, 'la regla también cuenta para el eje');
  const bars = buildModel({ data: [{ c: 'a', v: 3 }], layers: [{ mark: 'bar', x: 'c', y: 'v' }] });
  assert.equal(bars.x!.type, 'band');
  assert.equal(bars.y!.min, 0, 'las barras incluyen el cero');
  const years = buildModel({ data: [{ c: 2024, v: 3 }], layers: [{ mark: 'bar', x: 'c', y: 'v' }] });
  assert.equal(years.x!.type, 'band', 'años en barras: categorías');
  const ordered = buildModel({
    data: [{ c: 'b' }, { c: 'a' }],
    scales: { x: { domain: ['a', 'b'] } },
    layers: [{ mark: 'cell', x: 'c', y: { value: 1 } }],
  });
  assert.deepEqual(ordered.x!.keys, ['a', 'b']);
});

test('datos: de ancho a largo con fold, y capas fijas que se dibujan una vez', () => {
  assert.deepEqual(foldRows([{ zona: 'N', W1: 1, W2: 2 }], ['W1', 'W2'], 'semana', 'valor'), [
    { zona: 'N', semana: 'W1', valor: 1 },
    { zona: 'N', semana: 'W2', valor: 2 },
  ]);
  const m = buildModel({
    data: { red: [{ zona: 'N', W1: 1, W2: 2 }], largo: { from: 'red', fold: ['W1', 'W2'], as: ['semana', 'valor'] } },
    layers: [
      { mark: 'cell', data: 'largo', x: 'semana', y: 'zona', color: { field: 'valor' } },
      { mark: 'rule', y: { value: 'N' } },
    ],
  });
  assert.deepEqual(m.problems, []);
  assert.equal(m.layers[0].rows.length, 2);
  assert.equal(m.layers[1].rows.length, 1, 'una regla fija no se repite por fila');
});

// ------------------------------------------------------------ Marcas

const markup = (c: LozChart) =>
  (c.element as unknown as FakeElement)
    .querySelectorAll('g')
    .map((g) => g.innerHTML)
    .join('');
const quiet = (spec: LayerSpec) => layers(host(), { animate: false, ...spec });

test('marcas: celda, texto e ícono sobre una tabla', () => {
  const c = quiet({
    ...TABLE,
    layers: [
      ...TABLE.layers,
      { mark: 'text', x: 'col', y: 'fila', text: '{v}', position: 'left' },
      { mark: 'icon', x: 'col', y: 'fila', icon: { if: 'v >= 30', then: 'smile', else: '😟' }, position: 'right' },
    ],
  });
  const svg = markup(c);
  assert.equal(svg.match(/<rect[^>]*rx=/g)?.length, 6, 'una celda por fila de datos');
  for (const v of ['10', '20', '30', '900', '950', '800']) assert.ok(svg.includes(`>${v}</text>`), `escribe ${v}`);
  assert.equal(svg.match(/😟/g)?.length, 2, 'dos emojis donde no se cumple');
  assert.ok(svg.includes(ICONS.smile.stroke[1]), 'y la carita propia donde sí');
  // La peor celda de cada fila en el rojo del semáforo, la mejor en el verde.
  assert.equal(svg.match(/fill="#c0283f"/g)?.length, 2);
  assert.equal(svg.match(/fill="#12a48c"/g)?.length, 2);
});

test('marcas: barras, puntos, línea y regla', () => {
  const c = quiet({
    data: [
      { m: 'ene', v: 4 },
      { m: 'feb', v: 6 },
      { m: 'mar', v: 5 },
    ],
    layers: [
      { mark: 'bar', x: 'm', y: 'v', color: 'violet' },
      { mark: 'point', x: 'm', y: 'v', color: 'pink' },
      { mark: 'line', x: 'm', y: 'v', color: 'teal' },
      { mark: 'rule', y: 5, label: 'Meta' },
    ],
  });
  const svg = markup(c);
  assert.equal(svg.match(new RegExp(`<path d="M[^"]+Z" fill="${LIGHT.palette[0]}"`, 'g'))?.length, 3, 'tres barras violeta');
  assert.equal(svg.match(new RegExp(`<circle[^>]*fill="${LIGHT.palette[1]}"`, 'g'))?.length, 3, 'tres puntos rosa');
  assert.ok(new RegExp(`fill="none" stroke="${LIGHT.palette[7]}"`).test(svg), 'la línea petróleo');
  assert.ok(/stroke-dasharray="4 3"/.test(svg), 'la regla discontinua');
  assert.ok(svg.includes('>Meta</text>'));
});

test('marcas: enlaces de una red y puntos en un mapa sin mapa registrado', () => {
  const c = quiet({
    data: {
      n: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
      e: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
    },
    network: { nodes: 'n', links: 'e' },
    layers: [
      { mark: 'link', data: 'e' },
      { mark: 'icon', data: 'n', icon: 'antenna' },
    ],
  });
  const svg = markup(c);
  assert.equal(svg.match(/<line[^>]*stroke-linecap="round"/g)?.length, 2, 'dos enlaces');
  assert.equal(svg.split(ICONS.antenna.stroke[0]).length - 1, 6, 'tres antenas, con su halo');
  const problems = checkLayers({
    locale: 'es',
    geo: { map: 'nada' },
    data: [{ lat: 1, lon: 2 }],
    layers: [{ mark: 'point', lon: 'lon', lat: 'lat' }],
  });
  assert.match(problems[0].message, /No hay ningún mapa llamado "nada"/);
});

test('íconos: los nombres, los alias, los emojis y su dibujo', () => {
  assert.ok(ICON_NAMES.length >= 18);
  assert.equal(iconName('frown'), 'sad');
  assert.equal(iconName('Smile'), 'smile');
  assert.equal(iconName('smiel'), '');
  assert.ok(isGlyph('😀') && isGlyph('▲') && !isGlyph('smiel'));
  // Cada ícono tiene nombre en los tres idiomas.
  for (const lang of ['es', 'en', 'pt'])
    for (const name of ICON_NAMES) assert.ok(layerTexts(lang).icons[name], `${name} en ${lang}`);
  const svg = iconMarkup({ kind: 'named', name: 'pin' }, 50, 50, 24, '#c0283f', DARK, true);
  assert.ok(svg.includes(`fill="${DARK.surface}"`), 'el hueco y el halo en la superficie');
  assert.ok(svg.includes('translate(38 38) scale(1)'));
  const glyph = iconMarkup({ kind: 'glyph', text: '<b>' }, 0, 0, 20, '#000', LIGHT, false);
  assert.ok(glyph.includes('&lt;b&gt;'), 'un texto se escapa');
});

// ------------------------------------------------------------ Avisos

test('avisos: marca, campo, color e ícono mal escritos, con la sugerencia', () => {
  const problems = checkLayers({
    locale: 'es',
    data: [{ valor: 1, meta: 2, sitio: 'A' }],
    colour: 'x',
    layers: [
      { mark: 'cel', x: 'sitio', y: 'valor' },
      { mark: 'point', x: 'sitio', y: 'valro', color: 'gren' },
      { mark: 'icon', x: 'sitio', y: 'valor', icon: 'smiel', size: 10 },
      { mark: 'icon', x: 'sitio', y: 'valor', icon: { if: 'valor =>', then: 'smile' } },
      { mark: 'cell', x: 'sitio' },
      { mark: 'text', x: 'sitio', y: 'valor', text: '{valor}', positon: 'top' },
    ] as LayerSpec['layers'],
  } as unknown as LayerSpec);
  const find = (path: string) => problems.filter((p) => p.path === path).map((p) => p.message);
  assert.match(find('colour')[0], /No conozco "colour" aquí, así que lo ignoro/);
  assert.match(find('layers[0].mark')[0], /No conozco la marca "cel"\. ¿Quisiste decir "cell"\?/);
  assert.match(find('layers[1]')[0], /Ninguna fila de "data" tiene el campo "valro"\. ¿Quisiste decir "valor"\?/);
  assert.match(find('layers[1].color')[0], /No conozco el color "gren"\. ¿Quisiste decir "green"\?/);
  assert.match(find('layers[2].icon')[0], /No conozco el ícono "smiel"\. ¿Quisiste decir "smile"\?/);
  assert.match(find('layers[3].icon.if')[0], /"=>" no es un operador/);
  assert.match(find('layers[4].y')[0], /Una capa "cell" necesita "y"/);
  assert.match(find('layers[5].positon')[0], /¿Quisiste decir "position"\?/);
  assert.equal(problems.find((p) => p.path === 'layers[5].positon')!.level, 'warning');
});

test('avisos: en el idioma del gráfico, y nada si todo está bien', () => {
  const en = checkLayers({ locale: 'en', data: [{ a: 1 }], layers: [{ mark: 'dots' as 'point' }] });
  assert.match(en[0].message, /There's no mark called "dots"/);
  const pt = checkLayers({ locale: 'pt-BR', data: [{ a: 1 }], layers: [] });
  assert.match(pt[0].message, /Falta "layers"/);
  assert.match(checkLayers('hola', 'es')[0].message, /objeto JSON/);
  const ejemplos = (globalThis as unknown as { capasEjemplos: (idioma: string) => { id: string; spec: LayerSpec }[] })
    .capasEjemplos;
  for (const idioma of ['es', 'en', 'pt'])
    for (const ejemplo of ejemplos(idioma)) {
      // El mapa avisa que falta el mundo (en las pruebas no se carga): todo lo demás debe estar limpio.
      const rest = checkLayers(ejemplo.spec).filter((p) => p.path !== 'geo.map');
      assert.deepEqual(rest, [], `el ejemplo "${ejemplo.id}" en ${idioma} no tiene problemas`);
    }
});

test('LozChart.layers dibuja lo que está bien y avisa en la consola lo que no', () => {
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (m: string) => warned.push(m);
  try {
    const c = quiet({
      locale: 'es',
      data: [{ a: 'x', v: 1 }],
      layers: [
        { mark: 'point', x: 'a', y: 'v' },
        { mark: 'estrella' as 'point', x: 'a', y: 'v' },
      ],
    });
    assert.ok(markup(c).includes('<circle'), 'el punto se dibuja');
    assert.equal(warned.length, 1);
    assert.match(warned[0], /^LozCharts: layers\[1\]\.mark: No conozco la marca "estrella"/);
  } finally {
    console.warn = original;
  }
});

// ------------------------------------------------------------ Accesibilidad e interacción

test('accesibilidad: el texto alternativo de cada ícono llega a la tabla oculta y al tooltip', () => {
  const spec: LayerSpec = {
    locale: 'es',
    title: 'Metas',
    data: [
      { s: 'Norte', v: 99, meta: 98 },
      { s: 'Sur', v: 97, meta: 98 },
    ],
    layers: [{ mark: 'icon', x: 's', y: { value: 'hoy' }, icon: { if: 'v >= meta', then: 'smile', else: 'sad' } }],
  };
  const c = quiet(spec);
  const root = c.element as unknown as FakeElement;
  const table = root.querySelector('table')!.textContent;
  assert.match(table, /hoy · Norte.*carita feliz \(v: 99; meta: 98\)/);
  assert.match(table, /hoy · Sur.*carita triste/);
  assert.match(root.querySelector('svg')!.getAttribute('aria-label')!, /^Metas\. Gráfico de capas con 2 datos/);
  // En inglés y con un texto propio.
  const en = quiet({
    ...spec,
    locale: 'en',
    layers: [{ ...spec.layers[0], alt: { if: 'v >= meta', then: 'On target', else: 'Below {meta}' } }],
  });
  const t2 = (en.element as unknown as FakeElement).querySelector('table')!.textContent;
  assert.match(t2, /On target/);
  assert.match(t2, /Below 98/);
  const plain = quiet({ ...spec, locale: 'pt-BR', layers: [{ ...spec.layers[0], icon: 'star' }] });
  assert.match((plain.element as unknown as FakeElement).querySelector('table')!.textContent, /estrela/);
});

test('interacción: el puntero encuentra el dato y las flechas se mueven en el plano', () => {
  const g = {
    hits: [
      { item: 1, shape: { kind: 'circle' as const, cx: 50, cy: 50, r: 10 } },
      { item: 0, shape: { kind: 'rect' as const, x: 0, y: 0, w: 100, h: 100 } },
    ],
  };
  assert.equal(hitItem(g, 52, 50), 1, 'el de arriba primero');
  assert.equal(hitItem(g, 5, 5), 0);
  assert.equal(hitItem({ hits: [g.hits[0]] }, 64, 50), 1, 'a 4 px del borde todavía cuenta');
  assert.equal(hitItem({ hits: [g.hits[0]] }, 90, 50), -1);
  const grid: [number, number][] = [
    [0, 0],
    [10, 0],
    [0, 10],
    [10, 10],
  ];
  assert.equal(spatialStep(grid, 0, 'ArrowRight'), 1);
  assert.equal(spatialStep(grid, 0, 'ArrowDown'), 2);
  assert.equal(spatialStep(grid, 3, 'ArrowLeft'), 2);
  assert.equal(spatialStep(grid, 1, 'ArrowRight'), 1, 'en el borde se queda');
  assert.equal(spatialStep(grid, 1, 'Home'), undefined);
  // Con el teclado sobre el gráfico de verdad: el tooltip dice qué es.
  const c = quiet(TABLE);
  const root = c.element as unknown as FakeElement;
  root.querySelector('svg')!.dispatchEvent(event('keydown', { key: 'ArrowRight' }));
  const tip = root.querySelector('.lc-tooltip')!.textContent;
  assert.match(tip, /^A · c1/);
  assert.match(tip, /v: 10/);
});

test('layerOptions: las opciones de siempre, un dato por cada fila que se apunta', () => {
  const o = layerOptions(TABLE);
  assert.equal(o.series[0].type, 'layers');
  assert.equal(o.data.length, 6);
  assert.equal(o.data[0].__t, 'A · c1');
  assert.equal(o.locale, 'es');
});

// ------------------------------------------------------------ 1.2.0

test('spark: una línea por fila, en el orden del periodo, con su tooltip y en la tabla oculta', () => {
  const spec: LayerSpec = {
    locale: 'es',
    data: [
      { quien: 'Ana', mes: 3, nota: 8 },
      { quien: 'Ana', mes: 1, nota: 6 },
      { quien: 'Ana', mes: 2, nota: 7 },
      { quien: 'Luis', mes: 1, nota: 9 },
      { quien: 'Luis', mes: 2, nota: 5 },
    ],
    layers: [{ mark: 'spark', x: { value: 'Tendencia' }, y: 'quien', period: 'mes', value: 'nota', area: true, extremes: true }],
  };
  const m = buildModel(spec);
  assert.deepEqual(m.problems, []);
  assert.equal(m.items.length, 2, 'un dato por fila de la tabla, no por cada punto');
  assert.deepEqual(m.layers[0].sparks, [
    [1, 2, 0],
    [3, 4],
  ]);
  const c = quiet(spec);
  const root = c.element as unknown as FakeElement;
  const svg = markup(c);
  assert.equal(svg.match(/fill-opacity="0.16"/g)?.length, 2, 'el área suave de cada una');
  assert.equal(svg.match(/r="2.75"/g)?.length, 2, 'el último punto marcado');
  assert.equal(svg.match(/r="2.25"/g)?.length, 4, 'el mínimo y el máximo, huecos');
  const table = root.querySelector('table')!.textContent;
  assert.match(table, /Ana · Tendencia.*6 → 8 \(Primero: 6; Último: 8; Cambio: \+2; Mínimo: 6; Máximo: 8\)/);
  assert.match(table, /Luis · Tendencia.*9 → 5.*Cambio: −?-?4/);
  const falta = checkLayers({ locale: 'es', data: [{ a: 1 }], layers: [{ mark: 'spark', x: 'a', y: 'a' }] });
  assert.match(falta[0].message, /Una capa "spark" necesita "value"/);
});

test('los colores salen del tema: estado, paleta propia y color de la serie', () => {
  const spec: LayerSpec = {
    locale: 'es',
    data: [
      { c: 'a', v: 1 },
      { c: 'b', v: 2 },
    ],
    layers: [
      { mark: 'bar', x: 'c', y: 'v' },
      {
        mark: 'icon',
        x: 'c',
        y: 'v',
        icon: { if: 'v > 1', then: 'check', else: 'cross' },
        color: { if: 'v > 1', then: 'good', else: 'bad' },
      },
    ],
  };
  const claro = markup(quiet(spec));
  assert.ok(claro.includes(`fill="${LIGHT.palette[0]}"`), 'una barra sin color va en el de la serie');
  assert.ok(claro.includes(`stroke="${LIGHT.good}"`) && claro.includes(`stroke="${LIGHT.bad}"`), 'good y bad son los del tema');
  const oscuro = markup(quiet({ ...spec, theme: 'dark' }));
  assert.ok(oscuro.includes(`stroke="${DARK.good}"`) && oscuro.includes(`fill="${DARK.palette[0]}"`));
  // Con `palette` en las opciones del gráfico, la serie toma el primero de esa paleta.
  const propia = new (LozChartClass())(host(), { ...layerOptions(spec), palette: ['#123456'], animate: false });
  assert.ok(markup(propia).includes('fill="#123456"'));
  // El semáforo va de bad a good del tema.
  const t = markup(quiet({ ...TABLE, theme: 'dark' }));
  assert.ok(t.includes(`fill="${DARK.bad}"`) && t.includes(`fill="${DARK.good}"`));
});

test('un ícono o un color mal escritos dejan sin dibujar solo ese caso', () => {
  const spec: LayerSpec = {
    locale: 'es',
    data: [
      { c: 'a', v: 1 },
      { c: 'b', v: 2 },
    ],
    layers: [
      {
        mark: 'icon',
        x: 'c',
        y: 'v',
        icon: { if: 'v > 1', then: 'smiel', else: 'sad' },
        color: { if: 'v > 1', then: 'gren', else: 'pink' },
      },
    ],
  };
  const problems = checkLayers(spec);
  assert.deepEqual(problems.map((p) => p.path).sort(), ['layers[0].color.then', 'layers[0].icon.then']);
  const original = console.warn;
  console.warn = () => {};
  let svg = '';
  try {
    svg = markup(quiet(spec));
  } finally {
    console.warn = original;
  }
  assert.ok(svg.includes(ICONS.sad.stroke[1]), 'la carita triste sí se dibuja');
  assert.ok(svg.includes(`stroke="${LIGHT.palette[1]}"`));
  assert.ok(!svg.includes(ICONS.smile.stroke[1]));
});

test('columnas más anchas con widths, clima con sus íconos y nombre del valor por idioma', () => {
  const spec: LayerSpec = {
    locale: 'en',
    data: [
      { d: '1', h: 'Read', ok: 1 },
      { d: '2', h: 'Read', ok: 0 },
    ],
    scales: { x: { widths: { Streak: 3 } } },
    layers: [
      { mark: 'cell', x: 'd', y: 'h', color: { if: 'ok == 1', then: 'violet', else: 'grid' } },
      { mark: 'text', x: { value: 'Streak' }, y: 'h', text: '1', tooltip: false },
    ],
  };
  const c = quiet(spec);
  const widths = [...markup(c).matchAll(/<rect[^>]*width="([\d.]+)"[^>]*rx=/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, 2);
  assert.ok(
    widths.every((w) => Math.abs(w - widths[0]) < 0.01),
    'los días miden lo mismo',
  );
  const root = c.element as unknown as FakeElement;
  assert.match(
    root
      .querySelector('table')!
      .querySelectorAll('th')
      .map((t) => t.textContent)
      .join('|'),
    /Item\|Value/,
  );
  for (const name of ['sun', 'cloud', 'partly', 'rain', 'storm', 'snow', 'wind', 'plane']) assert.ok(ICONS[name], name);
  assert.equal(iconName('rainy'), 'rain');
});

test('la entrada aparte: registra el tipo y deja LozChart.layers', () => {
  assert.equal(typeof (LozChartClass() as unknown as { layers?: unknown }).layers, 'function');
  assert.ok((LozChartClass() as unknown as { seriesTypes: string[] }).seriesTypes.includes('layers'));
});
