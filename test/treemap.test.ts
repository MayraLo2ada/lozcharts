import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitHeader,
  fitTileLabel,
  groupColor,
  groupSlots,
  hitCell,
  inkFor,
  layoutOrder,
  readingOrder,
  squarify,
  treemap,
  treemapLayout,
  type Rect,
} from '../src/series/treemap';
import { contrast as wcag, parseColor } from '../src/core/color';
import type { DrawContext, PreparedSeries, TooltipFormat } from '../src/core/series';
import { BandScale, LinearScale } from '../src/core/scales';
import { DARK, LIGHT } from '../src/core/theme';

/** Medida simple y determinista: 7 px por carácter. */
const measure = (s: string) => s.length * 7;
const area = (r: Rect | null) => (r ? r.w * r.h : 0);
const aspect = (r: Rect) => Math.max(r.w / r.h, r.h / r.w);
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

const NAMES = ['Laptops', 'Tabletas', 'Monitores', 'Sofás', 'Mesas', 'Sillas'];
const GROUPS = ['Electrónica', 'Electrónica', 'Electrónica', 'Hogar', 'Hogar', 'Hogar'];
const VALUES = [420, 180, 120, 300, 90, 60];

function series(values: number[], groups?: string[], labels?: boolean): PreparedSeries {
  return {
    key: 'v',
    name: 'Ventas',
    impl: treemap,
    slot: 0,
    options: { type: 'treemap', field: 'v', group: groups ? 'categoria' : undefined, labels },
    values,
    columns: {},
    texts: groups ? { group: groups } : { group: values.map(() => '') },
    stackKey: null,
    axis: 'left',
  };
}

function context(values: number[], groups?: string[], width = 600, height = 360, names = NAMES, theme = LIGHT): DrawContext {
  const n = values.length;
  return {
    frame: {
      ps: series(values, groups),
      y0: values.map(() => 0),
      y1: values.slice(),
      cols: {},
      alpha: 1,
      slot: 0,
      slots: 1,
      outer: [],
    },
    color: theme.palette[0],
    pointColor: () => theme.palette[0],
    x: new BandScale(n, width),
    y: new LinearScale(0, 1, height, 0),
    theme,
    width,
    height,
    n,
    isHidden: () => false,
    label: (i) => names[i] ?? '',
    measure,
    format: (v) => String(v),
    compact: (v: number) => String(Math.round(v)),
    percent: (v: number) => `${Math.round(v * 100)} %`,
  };
}

/** Distribución ingenua en tiras paralelas al lado corto (slice), para comparar proporciones. */
function slice(values: number[], r: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  let x = r.x;
  return values.map((v) => {
    const w = (v / total) * r.w;
    const out = { x, y: r.y, w, h: r.h };
    x += w;
    return out;
  });
}

test('squarify: áreas proporcionales y suma igual al área', () => {
  const rect = { x: 10, y: 20, w: 600, h: 400 };
  const values = [6, 6, 4, 3, 2, 2, 1];
  const out = squarify(values, rect);
  const total = values.reduce((a, b) => a + b, 0);
  near(
    out.reduce((s, r) => s + area(r), 0),
    600 * 400,
    1e-6,
  );
  out.forEach((r, i) => near(area(r), (values[i] / total) * 600 * 400, 1e-6));
  // Todo dentro del rectángulo y sin solaparse (las áreas suman el total y caben).
  for (const r of out) {
    assert.ok(r!.x >= 10 - 1e-9 && r!.y >= 20 - 1e-9);
    assert.ok(r!.x + r!.w <= 610 + 1e-9 && r!.y + r!.h <= 420 + 1e-9);
  }
  for (let a = 0; a < out.length; a++)
    for (let b = a + 1; b < out.length; b++) {
      const A = out[a]!;
      const B = out[b]!;
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      assert.ok(ox <= 1e-6 || oy <= 1e-6, `solapan ${a} y ${b}`);
    }
});

test('squarify: el ejemplo del artículo (6, 6, 4, 3, 2, 2, 1 en 6 × 4)', () => {
  const out = squarify([6, 6, 4, 3, 2, 2, 1], { x: 0, y: 0, w: 6, h: 4 }) as Rect[];
  // Primera fila: los dos 6 en una columna de 3 × 2 a la izquierda.
  assert.deepEqual(
    out.slice(0, 2).map((r) => [r.x, r.y, r.w, r.h]),
    [
      [0, 0, 3, 2],
      [0, 2, 3, 2],
    ],
  );
  // Después el 4 y el 3, el 2 y el 2, y el 1, como en la figura del artículo.
  near(out[2].w * out[2].h, 4);
  assert.ok(out.every((r) => aspect(r) < 3));
});

test('squarify: proporciones mucho mejores que tiras ingenuas', () => {
  const values = Array.from({ length: 30 }, (_, i) => 100 / (i + 1));
  const rect = { x: 0, y: 0, w: 800, h: 450 };
  const sq = squarify(values, rect) as Rect[];
  const naive = slice(values, rect);
  const mean = (rs: Rect[]) => rs.reduce((s, r) => s + aspect(r), 0) / rs.length;
  assert.ok(mean(sq) < 2.5, `media squarify ${mean(sq)}`);
  assert.ok(mean(sq) * 10 < mean(naive), `squarify ${mean(sq)} vs slice ${mean(naive)}`);
});

test('squarify: ceros, negativos y faltantes no ocupan área; un solo dato llena todo', () => {
  const out = squarify([5, 0, -3, NaN, 5], { x: 0, y: 0, w: 100, h: 50 });
  assert.equal(out[1], null);
  assert.equal(out[2], null);
  assert.equal(out[3], null);
  near(area(out[0]) + area(out[4]), 5000);
  assert.deepEqual(squarify([7], { x: 0, y: 0, w: 100, h: 50 }), [{ x: 0, y: 0, w: 100, h: 50 }]);
  assert.deepEqual(squarify([0, NaN], { x: 0, y: 0, w: 100, h: 50 }), [null, null]);
  // Área vacía: rectángulos de tamaño cero, sin NaN.
  const zero = squarify([1, 2], { x: 0, y: 0, w: 0, h: 50 });
  assert.ok(zero.every((r) => r && r.w === 0 && r.h === 0));
});

test('orden de distribución: por el valor final, estable al animar', () => {
  assert.deepEqual(layoutOrder([1, 3, 2, 3]), [1, 3, 2, 0]);
  // A mitad de la animación los valores animados se cruzan, pero el orden sigue el final.
  assert.deepEqual(layoutOrder([10, 1], [2, 8]), [0, 1]);
  // El que se va a cero se queda mientras se encoge.
  assert.deepEqual(layoutOrder([5, 0], [5, 3]), [0, 1]);
  assert.deepEqual(layoutOrder([5, 0], [5, 0]), [0]);
});

test('grupos: bloques por total; adentro, áreas proporcionales; franja con nombre', () => {
  const L = treemapLayout(VALUES, VALUES, GROUPS, 600, 360);
  assert.equal(L.groups.length, 2);
  const [elec, hogar] = ['Electrónica', 'Hogar'].map((n) => L.groups.find((g) => g.name === n)!);
  // Áreas de los bloques (con su aire) en proporción a sus totales: 720 contra 450.
  const share = ((elec.box.w + 4) * (elec.box.h + 4)) / (600 * 360 + 0);
  near(share, 720 / 1170, 0.03);
  assert.ok(elec.header && hogar.header);
  // Los rectángulos de un grupo quedan dentro de su bloque, debajo de la franja.
  for (let i = 0; i < 3; i++) {
    const t = L.tiles[i]!;
    assert.ok(t.y >= elec.box.y + 20 - 1e-9 && t.x >= elec.box.x - 1e-9);
    assert.ok(t.x + t.w <= elec.box.x + elec.box.w + 1e-9);
  }
  // Proporciones internas: Laptops es 420/720 del cuerpo de Electrónica.
  const cells = L.cells.slice(0, 3).reduce((s, c) => s + area(c), 0);
  near(area(L.cells[0]) / cells, 420 / 720, 1e-6);
  // Bordes exteriores justo en el borde del área.
  const xs = L.tiles.filter(Boolean).map((t) => t!.x + t!.w);
  near(Math.max(...xs), 600);
});

test('aire de 2 px entre vecinos y bordes exteriores al ras', () => {
  const L = treemapLayout([1, 1], [1, 1], null, 202, 100);
  const [a, b] = L.tiles as Rect[];
  assert.deepEqual([a.x, a.w, b.x, b.w], [0, 100, 102, 100]);
  assert.deepEqual([a.y, a.h], [0, 100]);
});

test('colores de grupo: paleta por primera aparición; desde el noveno, "Otros" (nunca se cicla)', () => {
  const names = ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const slots = groupSlots(names);
  assert.deepEqual([...slots.values()], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const colors = [...slots.values()].map((k) => groupColor(k, LIGHT.palette, LIGHT.other));
  assert.deepEqual(colors.slice(0, 8), LIGHT.palette);
  assert.deepEqual(colors.slice(8), [LIGHT.other, LIGHT.other]);
  // Paleta propia más corta: lo que no tiene color va a "Otros".
  assert.equal(groupColor(2, ['#111111', '#222222'], LIGHT.other), LIGHT.other);
  // En el dibujo, el noveno grupo usa el neutro.
  const vals = Array.from({ length: 10 }, (_, i) => 100 - i);
  const d = treemap.draw(context(vals, 'abcdefghij'.split('')));
  assert.ok(d.includes(`fill="${LIGHT.other}"`) && d.includes(`fill="${LIGHT.palette[7]}"`));
});

test('sin grupos: todos del color de la serie', () => {
  const d = treemap.draw(context(VALUES));
  const fills = [...d.matchAll(/<rect[^>]*fill="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(fills.length, 6);
  assert.ok(fills.every((f) => f === LIGHT.palette[0]));
});

const contrast = (a: string, b: string) => wcag(parseColor(a)!, parseColor(b)!);

test('contraste: tinta del tema de mayor contraste, ≥ 4,5:1 en la paleta', () => {
  assert.equal(inkFor('#5e2dad', LIGHT), LIGHT.surface, 'violeta oscuro: tinta clara');
  assert.equal(inkFor('#e2aa00', LIGHT), LIGHT.text, 'ocre claro: tinta oscura');
  assert.equal(inkFor('#8b61e3', DARK), '#000000', 'violeta del oscuro: negro puro (la superficie no llega a 4,5:1)');
  for (const th of [LIGHT, DARK])
    for (const c of [...th.palette, th.other]) {
      const best = contrast(inkFor(c, th), c);
      // Con el negro o el blanco puros de respaldo, toda la paleta llega a 4,5:1.
      assert.ok(best >= 4.5, `${c} en ${th.name}: ${best.toFixed(2)}`);
    }
  // Un color que no se reconoce cae en el texto del tema.
  assert.equal(inkFor('coral', LIGHT), LIGHT.text);
});

test('etiquetas: nombre recortado, valor solo con alto, nada si no cabe', () => {
  assert.deepEqual(fitTileLabel(200, 60, 'Laptops', ['420'], measure), { name: 'Laptops', value: '420' });
  // Poco alto: el nombre sin valor.
  assert.deepEqual(fitTileLabel(200, 30, 'Laptops', ['420'], measure), { name: 'Laptops', value: '' });
  // Muy bajo o angosto: nada.
  assert.equal(fitTileLabel(200, 15, 'Laptops', ['420'], measure), null);
  assert.equal(fitTileLabel(30, 60, 'Laptops', ['420'], measure), null);
  // Recorte con "…" y valor compacto si el exacto no entra.
  const fit = fitTileLabel(60, 60, 'Refrigeradores', ['1234567', '1,2 M'], measure)!;
  assert.ok(fit.name.endsWith('…') && fit.name.length - 1 >= 4);
  assert.equal(fit.value, '1,2 M');
  // Franja: nombre y total; si no cabe el total, el nombre solo.
  assert.deepEqual(fitHeader(300, 'Hogar', ['450'], measure), { name: 'Hogar', total: '450' });
  assert.deepEqual(fitHeader(45, 'Hogar', ['450'], measure), { name: 'Hogar', total: '' });
  assert.equal(fitHeader(20, 'Electrónica', ['450'], measure), null);
});

test('draw: escapa los textos y no usa el color de la serie para escribir', () => {
  const names = ['<b>Laptops & "más"</b>', 'Tabletas'];
  const d = treemap.draw(context([3, 1], ['A&B', 'A&B'], 600, 360, names));
  assert.ok(!d.includes('<b>') && d.includes('&lt;b&gt;') && d.includes('&amp;'));
  assert.ok(d.includes('>A&amp;B<'), 'el nombre del grupo, escapado');
  const texts = d.match(/<text[^>]*>/g) ?? [];
  assert.ok(texts.length > 0 && texts.every((t) => !t.includes(`fill="${LIGHT.palette[0]}"`)));
  // labels: false apaga todos los textos.
  const ctx = context(VALUES);
  ctx.frame.ps.options.labels = false;
  assert.ok(!treemap.draw(ctx).includes('<text'));
});

test('hit-test: celda bajo el puntero; -1 afuera y en la franja del grupo', () => {
  const ctx = context(VALUES, GROUPS);
  const L = treemapLayout(VALUES, VALUES, GROUPS, 600, 360);
  for (let i = 0; i < VALUES.length; i++) {
    const t = L.tiles[i]!;
    assert.equal(treemap.hit!(ctx, t.x + t.w / 2, t.y + t.h / 2), i);
  }
  const g = L.groups[0];
  assert.equal(treemap.hit!(ctx, g.box.x + 10, g.box.y + 5), -1, 'la franja no es un dato');
  assert.equal(treemap.hit!(ctx, 700, 10), -1);
  assert.equal(hitCell([null, { x: 0, y: 0, w: 0, h: 10 }], 0, 0), -1);
  // anchor: arriba al centro del rectángulo.
  const t = L.tiles[0]!;
  assert.deepEqual(treemap.anchor!(ctx, 0), [t.x + t.w / 2, t.y]);
  // hover: anillo por dentro del rectángulo.
  const h = treemap.hover!(ctx, 0);
  assert.ok(h.includes(`stroke="${LIGHT.text}"`) && h.includes(`stroke="${LIGHT.surface}"`));
});

test('teclado: grupo por grupo, de mayor a menor; sin los que no tienen área', () => {
  assert.deepEqual(readingOrder(VALUES, GROUPS), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(readingOrder([1, 5, 0, 3, NaN], ['x', 'y', 'x', 'x', 'y']), [1, 3, 0]);
  assert.deepEqual(readingOrder([1, 5, -2, 3], null), [1, 3, 0]);
  assert.deepEqual(treemap.navigable!(series([2, 0, 9], ['a', 'a', 'b'])), [2, 0]);
});

test('tooltip y encabezado: parte del total y del grupo', () => {
  const format: TooltipFormat = {
    difference: String,
    value: String,
    number: String,
    percent: (p) => (p * 100).toFixed(1) + ' %',
    isHidden: () => false,
  };
  const ps = series(VALUES, GROUPS);
  assert.deepEqual(treemap.tooltip!(ps, 0, format), {
    value: '420',
    details: [
      ['Del total', '35.9 %'],
      ['De Electrónica', '58.3 %'],
    ],
  });
  assert.deepEqual(treemap.tooltip!(series([3, 1]), 1, format), { value: '1', details: [['Del total', '25.0 %']] });
  assert.equal(treemap.tooltip!(series([NaN, 1]), 0, format), null);
  assert.deepEqual(treemap.tooltip!(series([-4, 1]), 0, format), { value: '-4' });
  assert.equal(treemap.headline!(ps, 4, 'Mesas'), 'Hogar › Mesas');
  assert.equal(treemap.headline!(series(VALUES), 4, 'Mesas'), 'Mesas');
  assert.equal(treemap.headline!(series([1], ['']), 0, 'X'), 'Sin grupo › X');
});

test('muchos datos y pantalla angosta: sin errores ni rectángulos fuera del área', () => {
  const vals = Array.from({ length: 60 }, (_, i) => Math.round(1000 / (i + 1)));
  const groups = vals.map((_, i) => 'G' + (i % 6));
  for (const g of [null, groups]) {
    const L = treemapLayout(vals, vals, g, 390, 300);
    for (const t of L.tiles) {
      assert.ok(t && t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= 390 + 1e-9 && t.y + t.h <= 300 + 1e-9);
      assert.ok(Number.isFinite(t.w) && Number.isFinite(t.h));
    }
  }
  const d = treemap.draw(
    context(
      vals,
      groups,
      390,
      300,
      vals.map((_, i) => 'Producto ' + i),
    ),
  );
  assert.ok(!d.includes('NaN'));
});

test('muestra del tooltip: el color del grupo, el mismo del rectángulo', () => {
  const slots = groupSlots(GROUPS);
  for (const theme of [LIGHT, DARK]) {
    const ctx = context(VALUES, GROUPS, 600, 360, NAMES, theme);
    const d = treemap.draw(ctx);
    NAMES.forEach((name, i) => {
      const swatch = treemap.swatch!(ctx, i);
      assert.equal(swatch, groupColor(slots.get(GROUPS[i])!, theme.palette, theme.other), name);
      assert.ok(d.includes(`fill="${swatch}"`), `${name} en ${swatch}`);
    });
  }
  const ctx = context(VALUES, GROUPS);
  assert.notEqual(treemap.swatch!(ctx, 0), treemap.swatch!(ctx, 3));
  // Sin grupos, el color de la serie.
  const plain = context(VALUES);
  for (let i = 0; i < VALUES.length; i++) assert.equal(treemap.swatch!(plain, i), plain.color);
});
