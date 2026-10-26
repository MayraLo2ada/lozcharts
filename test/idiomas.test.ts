/**
 * Idiomas: el gráfico elige el idioma (la opción locale o el de la página) y todo lo que muestra,
 * anuncia o avisa sale de ese catálogo, con los números y las fechas de ese idioma.
 */
import './dom';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { event, host, type FakeElement } from './dom';
import { LozChart, messages, registerLocale, defaultLocale, timeFullLabel, type LozChartOptions } from '../src/index';
import { prepare } from '../src/core/prepare';
import { registry } from './helpers';
import { world } from '../src/maps/world';
import { withPortuguese } from '../src/maps/nomes';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun'];
const data = MESES.map((mes, i) => ({ mes, ventas: 1000 + i * 100.5, costos: 600 + i * 50 }));

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
const svg = (c: LozChart) => root(c).querySelector('svg')!;
const aria = (c: LozChart) => svg(c).getAttribute('aria-label')!;
const live = (c: LozChart) =>
  root(c)
    .querySelectorAll('div')
    .find((d) => d.getAttribute('aria-live') === 'polite')!.textContent;
const key = (c: LozChart, k: string) => svg(c).dispatchEvent(event('keydown', { key: k }));
const overlay = (c: LozChart) =>
  root(c)
    .querySelectorAll('rect')
    .find((r) => r.getAttribute('fill') === 'transparent')!;
const tooltip = (c: LozChart) => root(c).querySelector('.lc-tooltip')!.textContent;
const table = (c: LozChart) => root(c).querySelector('table')!.textContent;

/** Corre `fn` con `<html lang>` en `lang` y lo deja como estaba. */
function withLang<T>(lang: string, fn: () => T): T {
  const html = document.documentElement;
  const before = html.lang;
  html.lang = lang;
  try {
    return fn();
  } finally {
    html.lang = before;
  }
}

/** Lo que se avisa por consola mientras corre `fn`. */
function warnings(fn: () => void): string[] {
  const warn = console.warn;
  const seen: string[] = [];
  console.warn = (m: string) => seen.push(m);
  try {
    fn();
  } finally {
    console.warn = warn;
  }
  return seen;
}

// ------------------------------------------------------------ Elección del idioma

test('sin locale: el idioma de la página si es español, inglés o portugués (con región); si no, inglés', () => {
  assert.equal(withLang('', defaultLocale), 'en', 'sin lang: inglés');
  assert.equal(withLang('fr', defaultLocale), 'en', 'un idioma sin catálogo: inglés');
  assert.equal(withLang('es-MX', defaultLocale), 'es-MX', 'la región se conserva para Intl');
  assert.equal(withLang('pt-BR', defaultLocale), 'pt-BR');

  const en = withLang('', () => chart());
  assert.equal(en.options.locale, 'en');
  assert.match(aria(en), /^Line chart with 2 series and 6 categories\./);
  const es = withLang('es-MX', () => chart());
  assert.equal(es.options.locale, 'es-MX');
  assert.match(aria(es), /^Gráfico de líneas con 2 series y 6 categorías\./);
  const pt = withLang('pt-BR', () => chart());
  assert.match(aria(pt), /^Gráfico de linhas com 2 séries e 6 categorias\./);
  const fr = withLang('fr-CA', () => chart());
  assert.equal(fr.options.locale, 'en');
  // La opción manda sobre la página, y una variante cae en su idioma.
  const own = withLang('es', () => chart({ locale: 'pt-PT' }));
  assert.match(aria(own), /^Gráfico de linhas/);
  assert.equal(messages('EN_gb').chart.showAll, 'Show all', 'mayúsculas y guion bajo también valen');
});

test('cambiar locale con setOptions cambia textos, botones y formatos', () => {
  const c = chart({ locale: 'es', zoom: true, title: 'Ventas' });
  const reset = () => root(c).querySelector('.lc-zoom-reset')!.textContent;
  assert.equal(reset(), 'Ver todo');
  assert.match(table(c), /1\.000/);
  c.setOptions({ locale: 'en' }, false);
  assert.equal(reset(), 'Show all');
  assert.match(table(c), /1,000/);
  assert.match(aria(c), /Press \+ or − to zoom in or out/);
  c.setOptions({ locale: 'pt-BR' }, false);
  assert.equal(reset(), 'Ver tudo');
  assert.match(aria(c), /Com \+ e − você aproxima ou afasta/);
});

// ------------------------------------------------------------ Tooltip y tabla

test('tooltip: números del idioma, total de la pila y "sin dato"', () => {
  const rows = [
    { mes: 'ene', a: 1234.5, b: 10 },
    { mes: 'feb', a: null, b: 20 },
  ];
  const stacked = (locale: string) =>
    chart({
      locale,
      data: rows,
      series: [
        { type: 'bar', field: 'a', name: 'A', stack: true },
        { type: 'bar', field: 'b', name: 'B', stack: true },
      ],
    });
  const en = stacked('en');
  overlay(en).dispatchEvent(event('pointermove', { clientX: 150, clientY: 100 }));
  assert.match(tooltip(en), /1,234\.5/);
  assert.match(tooltip(en), /1,244\.5Total/);
  assert.match(table(en), /No data/);
  const pt = stacked('pt-BR');
  overlay(pt).dispatchEvent(event('pointermove', { clientX: 150, clientY: 100 }));
  assert.match(tooltip(pt), /1\.234,5/);
  assert.match(table(pt), /Sem dado/);
  assert.match(table(stacked('es')), /Sin dato/);
});

test('la tabla de datos: título por defecto y aviso de filas de más', () => {
  const many = Array.from({ length: 600 }, (_, i) => ({ mes: String(i), ventas: i }));
  const big = (locale: string) => chart({ locale, data: many, series: [{ type: 'line', field: 'ventas', name: 'Ventas' }] });
  assert.match(table(big('en')), /^Chart data \(showing the first 500 of 600 rows; download the CSV to see them all\)/);
  assert.match(
    table(big('pt-BR')),
    /^Dados do gráfico \(aqui estão as primeiras 500 de 600 linhas; baixe o CSV para ver todas\)/,
  );
  assert.match(table(big('es')), /^Datos del gráfico \(aquí van las primeras 500 de 600 filas/);
});

// ------------------------------------------------------------ Descripción accesible

test('descripción: de dónde a dónde y el más alto, con las fechas como se escriben en cada idioma', () => {
  const rows = ['2026-01', '2026-02', '2026-03'].map((mes, i) => ({ mes, ventas: [1200, 1500.5, 900][i] }));
  const timed = (locale: string) =>
    chart({
      locale,
      title: 'Ventas',
      data: rows,
      xAxis: { field: 'mes', type: 'time' },
      series: [{ type: 'line', field: 'ventas', name: 'Ventas' }],
    });
  assert.equal(
    aria(timed('en')),
    'Ventas. Line chart with 3 points, from January 2026 to March 2026. The highest is February 2026, at 1,500.5. ' +
      'Use the left and right arrow keys to move through the data.',
  );
  assert.equal(
    aria(timed('pt-BR')),
    'Ventas. Gráfico de linhas com 3 pontos, de janeiro de 2026 a março de 2026. O mais alto é fevereiro de 2026, com 1.500,5. ' +
      'Navegue pelos dados com as setas para a esquerda e para a direita.',
  );
  assert.equal(
    aria(timed('es')),
    'Ventas. Gráfico de líneas con 3 puntos, de enero de 2026 a marzo de 2026. El más alto es febrero de 2026, con 1.500,5. ' +
      'Recorre los datos con las flechas izquierda y derecha.',
  );
  const empty = chart({ locale: 'en', data: [] });
  assert.equal(aria(empty), 'Line chart, no data yet.');
  assert.equal(aria(chart({ locale: 'pt-BR', data: [] })), 'Gráfico de linhas, ainda sem dados.');
});

test('descripción: los nombres de cada tipo y cómo se llaman sus datos', () => {
  const cells = [
    { col: 'a', fila: 'x', v: 1 },
    { col: 'b', fila: 'x', v: 2 },
  ];
  const heat = (locale: string) =>
    chart({ locale, data: cells, xAxis: { field: 'col' }, series: [{ type: 'heatmap', field: 'v', y: 'fila' }] });
  assert.match(aria(heat('en')), /^Heatmap with 2 cells\./);
  assert.match(aria(heat('pt-BR')), /^Gráfico de mapa de calor com 2 células\./);
  assert.match(aria(heat('es')), /^Gráfico de mapa de calor con 2 celdas\./);
  const pie = chart({ locale: 'pt-BR', series: [{ type: 'pie', field: 'ventas' }] });
  assert.match(aria(pie), /^Gráfico de pizza com 6 categorias\. Navegue pelos dados com as setas\./);
});

// ------------------------------------------------------------ Anuncios en vivo

test('anuncios: mostrar y ocultar, selección y zoom', () => {
  const en = chart({ locale: 'en', zoom: true });
  en.toggleSeries('Costos');
  assert.equal(live(en), 'Costos is hidden now');
  en.toggleSeries('Costos');
  assert.equal(live(en), 'Costos is visible now');
  en.select([1]);
  assert.equal(live(en), 'Selected: 1 of 6 categories');
  en.select(null);
  assert.equal(live(en), 'Nothing is selected now');
  key(en, '+');
  assert.match(live(en), /^Now showing \w+ to \w+$/);
  key(en, '0');
  assert.equal(live(en), 'Now showing all the data');

  const pt = chart({ locale: 'pt-BR', zoom: true });
  pt.toggleSeries('Costos');
  assert.equal(live(pt), 'Não aparece mais: Costos');
  pt.select([1, 2]);
  assert.equal(live(pt), 'Seleção: 2 de 6 categorias');
  key(pt, '+');
  assert.match(live(pt), /^Agora você vê de \w+ a \w+$/);

  const es = chart({ locale: 'es' });
  es.toggleSeries('Costos');
  assert.equal(live(es), 'Ya no se ve Costos');
});

test('barra del zoom: nombres de los controles y lo que anuncian', () => {
  const c = chart({ locale: 'en', zoom: { range: ['feb', 'abr'] } });
  const sliders = root(c)
    .querySelectorAll('div')
    .filter((d) => d.getAttribute('role') === 'slider');
  assert.deepEqual(
    sliders.map((s) => s.getAttribute('aria-label')),
    ['Visible range', 'Start of the visible range', 'End of the visible range'],
  );
  assert.match(sliders[0].getAttribute('aria-valuetext')!, /^\w+ to \w+$/);
  c.setOptions({ locale: 'pt-BR' }, false);
  assert.equal(sliders[0].getAttribute('aria-label'), 'Trecho visível');
  assert.match(sliders[0].getAttribute('aria-valuetext')!, /^De \w+ a \w+$/);
});

// ------------------------------------------------------------ Leyenda

test('leyenda: su nombre, el eje derecho y "Otros" en el idioma del gráfico', () => {
  const legend = (c: LozChart) => root(c).querySelector('.lc-legend')!;
  const two = chart({
    locale: 'en',
    series: [
      { type: 'line', field: 'ventas', name: 'Ventas' },
      { type: 'line', field: 'costos', name: 'Costos', axis: 'right' },
    ],
  });
  assert.equal(legend(two).getAttribute('aria-label'), 'Legend: select a name to show or hide it');
  assert.match(legend(two).textContent, /Costos \(right axis\)/);
  const many = 'abcdefghi'.split('').map((mes, i) => ({ mes, ventas: 10 + i }));
  const pie = (locale: string) => chart({ locale, data: many, series: [{ type: 'pie', field: 'ventas' }] });
  assert.match(legend(pie('en')).textContent, /Other/);
  assert.match(legend(pie('pt-BR')).textContent, /Outros/);
  assert.match(aria(pie('en')), /9 categories \(2 grouped into Other\)/);
  assert.match(legend(chart({ locale: 'pt-BR' })).getAttribute('aria-label')!, /^Legenda:/);
});

// ------------------------------------------------------------ Un tipo de cada familia

/** Lo que se anuncia del primer dato al recorrer con el teclado (el mismo texto del tooltip). */
function firstSpoken(options: Partial<LozChartOptions>): string {
  const c = chart(options);
  key(c, 'ArrowRight');
  return live(c);
}

test('tipos: el tooltip de cada familia en inglés y portugués', () => {
  // Precios: apertura, máximo, mínimo, cierre y la variación como porcentaje del idioma.
  const ohlc = [{ dia: '1', o: 100, h: 110, l: 95, c: 107.5 }];
  const candle = (locale: string) =>
    firstSpoken({
      locale,
      data: ohlc,
      xAxis: { field: 'dia' },
      series: [{ type: 'candlestick', field: 'c', name: 'ACME', open: 'o', high: 'h', low: 'l' }],
    });
  assert.equal(candle('en'), '1: ACME 107.5 (+7.5%) (Open: 100; High: 110; Low: 95; Close: 107.5)');
  assert.equal(candle('pt-BR'), '1: ACME 107,5 (+7,5%) (Abertura: 100; Máxima: 110; Mínima: 95; Fechamento: 107,5)');

  // Flujos: la parte de lo que sale y de lo que llega.
  const flows = [
    { de: 'A', a: 'B', v: 30 },
    { de: 'A', a: 'C', v: 10 },
  ];
  const sankey = (locale: string) =>
    firstSpoken({
      locale,
      data: flows,
      xAxis: { field: 'de' },
      series: [{ type: 'sankey', field: 'v', to: 'a', name: 'Flujo' }],
    });
  assert.equal(sankey('en'), 'A → B: Flujo 30 (Of what leaves A: 75%; Of what reaches B: 100%)');
  assert.equal(sankey('pt-BR'), 'A → B: Flujo 30 (Do que sai de A: 75%; Do que chega a B: 100%)');

  // Cascada: variación, acumulado y tipo de paso.
  const steps = [
    { paso: 'Ventas', monto: 1200 },
    { paso: 'Costos', monto: -400 },
  ];
  const cascade = (locale: string) =>
    firstSpoken({ locale, data: steps, xAxis: { field: 'paso' }, series: [{ type: 'waterfall', field: 'monto', name: 'Neto' }] });
  assert.equal(cascade('en'), 'Ventas: Neto +1,200 (Running total: 1,200; Step: Increase)');
  assert.equal(cascade('pt-BR'), 'Ventas: Neto +1.200 (Acumulado: 1.200; Passo: Alta)');

  // Línea de tiempo: fechas, duración y grupo en el idioma.
  const spans = [{ inicio: '2026-03-01', fin: '2026-04-16', tarea: 'Diseño', equipo: '' }];
  const gantt = (locale: string) =>
    firstSpoken({
      locale,
      data: spans,
      xAxis: { field: 'inicio' },
      series: [{ type: 'timeline', field: 'tarea', end: 'fin', label: 'tarea', group: 'equipo', name: 'Plan' }],
    });
  assert.equal(gantt('en'), 'Diseño: Plan Mar 1 – Apr 16, 2026 (Duration: 1 month and 15 days; Group: No group)');
  assert.equal(gantt('pt-BR'), 'Diseño: Plan 1 de mar – 16 de abr de 2026 (Duração: 1 mês e 15 dias; Grupo: Sem grupo)');

  // Proporciones: la parte del total.
  const pie = (locale: string) => firstSpoken({ locale, series: [{ type: 'pie', field: 'costos', name: 'Costos' }] });
  assert.equal(pie('en'), 'ene: Costos 600 (13.8%)');
  assert.equal(pie('pt-BR'), 'ene: Costos 600 (13,8%)');
});

test('fechas de semana: el encabezado del tooltip dice "semana" en cada idioma', () => {
  const t = new Date(2026, 2, 2).getTime();
  assert.equal(timeFullLabel(t, 'week', 'es'), 'Semana del 2 de marzo de 2026');
  assert.equal(timeFullLabel(t, 'week', 'en'), 'Week of March 2, 2026');
  assert.equal(timeFullLabel(t, 'week', 'pt-BR'), 'Semana de 2 de março de 2026');
});

// ------------------------------------------------------------ Avisos de consola

test('avisos de consola en el idioma del gráfico', () => {
  const unknown = (locale: string) =>
    warnings(() =>
      prepare(
        { data: [{ x: 'a', v: 1 }], xField: 'x', xType: 'category', series: [{ type: 'nada', field: 'v' }], locale },
        registry,
        8,
      ),
    );
  assert.match(unknown('en')[0], /^LozCharts: I don't know the type "nada", so I'm not drawing that series\./);
  assert.match(unknown('pt-BR')[0], /^LozCharts: não conheço o tipo "nada" e não desenho essa série\./);
  assert.match(unknown('es')[0], /^LozCharts: no conozco el tipo "nada"/);

  const negative = (locale: string) =>
    warnings(() =>
      chart({
        locale,
        data: [
          { mes: 'a', v: 3 },
          { mes: 'b', v: -1 },
        ],
        series: [{ type: 'pie', field: 'v', name: 'Ventas' }],
      }).toSVG(),
    );
  assert.equal(
    negative('en')[0],
    `LozCharts: in "Ventas", row 2 has a negative value. A pie can't show negative parts, so it counts as zero. To compare ups and downs, use bars or a waterfall.`,
  );
  assert.match(
    negative('pt-BR')[0],
    /^LozCharts: em "Ventas", a linha 2 tem um valor negativo: uma pizza não mostra partes negativas/,
  );
  assert.throws(
    () => new LozChart('#no-existe', { data: [], xAxis: { field: 'x' }, series: [], locale: 'en' }),
    /nothing on the page matches "#no-existe"/,
  );
});

// ------------------------------------------------------------ registerLocale y catálogo

test('registerLocale: un idioma nuevo toma del inglés lo que falta; uno que existe cambia solo lo dado', () => {
  registerLocale('fr', {
    chart: { showAll: 'Tout voir', chartOf: (kinds) => 'Graphique en ' + kinds.join(' et ') },
    types: { line: { label: 'courbes' } },
  });
  const fr = chart({ locale: 'fr-CA', zoom: true, title: 'Ventes' });
  assert.equal(root(fr).querySelector('.lc-zoom-reset')!.textContent, 'Tout voir');
  assert.match(aria(fr), /^Ventes\. Graphique en courbes with 2 series/, 'lo que falta, del inglés');
  assert.equal(withLang('fr', defaultLocale), 'fr', 'con catálogo, el idioma de la página vale');

  // Una variante regional parte de su idioma y cambia solo lo que se da; el idioma queda igual.
  LozChart.registerLocale('es-AR', { chart: { showAll: 'Mostrá todo' }, types: { line: { items: ['mes', 'meses'] } } });
  const ar = chart({ locale: 'es-AR', zoom: true, series: [{ type: 'line', field: 'ventas' }] });
  assert.equal(root(ar).querySelector('.lc-zoom-reset')!.textContent, 'Mostrá todo');
  assert.match(aria(ar), /^Gráfico de líneas con 6 meses/, 'el nombre del tipo se conserva y se cambian sus datos');
  assert.equal(messages('es-AR').chart.zoomedAll, 'Ahora ves todos los datos');
  assert.equal(messages('es').chart.showAll, 'Ver todo');
  assert.equal(messages('es-MX').chart.showAll, 'Ver todo');
  // Un texto en undefined no borra el que había.
  registerLocale('es-AR', { chart: { showAll: undefined } });
  assert.equal(messages('es-AR').chart.showAll, 'Mostrá todo');
});

test('catálogo: español, inglés y portugués completos, con nombre para cada tipo registrado', () => {
  const shape = (o: object): string[] =>
    Object.entries(o)
      .flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? shape(v).map((s) => `${k}.${s}`) : [`${k}:${typeof v}`],
      )
      .sort();
  const es = messages('es');
  const en = messages('en');
  const pt = messages('pt');
  assert.deepEqual(shape(en), shape(es));
  assert.deepEqual(shape(pt), shape(es));
  for (const type of LozChart.seriesTypes) {
    for (const m of [es, en, pt]) assert.ok(m.types[type]?.label, `nombre de ${type}`);
  }
  // Ningún texto se quedó en otro idioma: los de inglés no traen tildes del español.
  const texts = (o: object): string[] =>
    Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? texts(v) : []));
  assert.deepEqual(
    texts(en).filter((s) => /[áéíóúñ¿¡]/i.test(s)),
    [],
  );
});

test('mapa del mundo: el nombre de cada país en el idioma del gráfico, y se encuentra escrito en cualquiera', () => {
  LozChart.registerMap('mundo-idiomas', withPortuguese(world));
  const map = (locale: string, pais: string) =>
    firstSpoken({
      locale,
      data: [{ pais, v: 5 }],
      xAxis: { field: 'pais' },
      series: [{ type: 'choropleth', field: 'v', name: 'Ventas', map: 'mundo-idiomas' }],
    });
  assert.equal(map('pt-BR', 'DEU'), 'Alemanha: Ventas 5');
  assert.equal(map('es', 'DEU'), 'Alemania: Ventas 5');
  assert.equal(map('en', 'DEU'), 'Germany: Ventas 5');
  assert.equal(map('en', 'Alemanha'), 'Germany: Ventas 5', 'el nombre en portugués también se encuentra');
});
