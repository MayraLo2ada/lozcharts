import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  donut,
  hitSlice,
  LABEL_GAP,
  layoutLabels,
  pie,
  sliceAngles,
  slicePath,
  sliceTooltip,
  visibleShare,
  type LabelCandidate,
} from '../src/series/pie';
import type { DrawContext, PreparedSeries, SeriesImpl, TooltipFormat } from '../src/core/series';
import type { SeriesOptions } from '../src/types';
import { BandScale, LinearScale } from '../src/core/scales';
import { LIGHT } from '../src/core/theme';

const TOP = -Math.PI / 2;
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Serie preparada mínima: solo importan sus valores y opciones. */
function series(values: number[], options: Partial<SeriesOptions> = {}, impl: SeriesImpl = pie): PreparedSeries {
  return {
    key: 'v',
    name: 'v',
    impl,
    slot: 0,
    options: { field: 'v', ...options } as SeriesOptions,
    values,
    columns: {},
    texts: {},
    stackKey: null,
    axis: 'left',
  };
}

/** Contexto de dibujo falso: 0,58 em por carácter, como el respaldo de textWidth. */
function context(
  values: number[],
  o: { width?: number; height?: number; hidden?: number[]; options?: Partial<SeriesOptions> } = {},
) {
  const width = o.width ?? 600;
  const height = o.height ?? 320;
  const hidden = new Set(o.hidden ?? []);
  const ps = series(values, o.options);
  const ctx: DrawContext = {
    frame: {
      ps,
      y0: values.map(() => 0),
      y1: values.map((v, i) => (hidden.has(i) ? 0 : v)),
      cols: {},
      alpha: 1,
      slot: 0,
      slots: 1,
      outer: [],
    },
    color: LIGHT.palette[0],
    pointColor: (i) => LIGHT.palette[i] ?? LIGHT.other,
    x: new BandScale(values.length, width),
    y: new LinearScale(0, 1, height, 0),
    theme: LIGHT,
    width,
    height,
    n: values.length,
    isHidden: (i) => hidden.has(i),
    label: (i) => `Categoría ${i + 1}`,
    measure: (s) => s.length * 12 * 0.58,
    format: (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
    compact: (v: number) => String(Math.round(v)),
    percent: (v: number) => `${Math.round(v * 1000) / 10} %`,
  };
  return ctx;
}

test('los ángulos empiezan arriba, avanzan en sentido horario y suman 360°', () => {
  const s = sliceAngles([30, 10, 60]);
  assert.ok(close(s[0].start, TOP));
  assert.ok(close(s[2].end, TOP + 2 * Math.PI));
  const total = s.reduce((a, x) => a + (x.end - x.start), 0);
  assert.ok(close(total, 2 * Math.PI));
  // Orden de los datos y contiguas: cada una empieza donde termina la anterior.
  assert.ok(close(s[1].start, s[0].end) && close(s[2].start, s[1].end));
  assert.ok(close(s[0].end - s[0].start, 0.3 * 2 * Math.PI));
});

test('huecos, negativos y todo en cero no rompen los ángulos', () => {
  const s = sliceAngles([NaN, 50, -3, 50]);
  assert.equal(s[0].end - s[0].start, 0);
  assert.equal(s[2].end - s[2].start, 0);
  assert.ok(close(s[1].end - s[1].start, Math.PI));
  for (const x of sliceAngles([0, 0, 0])) assert.equal(x.end - x.start, 0);
});

test('hit-test: porción correcta, fuera del anillo y en el agujero del donut', () => {
  // 25 % cada una: arriba-derecha 0, abajo-derecha 1, abajo-izquierda 2, arriba-izquierda 3.
  const s = sliceAngles([1, 1, 1, 1]);
  const at = (deg: number, r: number): [number, number] => [
    100 + r * Math.cos((deg * Math.PI) / 180),
    100 + r * Math.sin((deg * Math.PI) / 180),
  ];
  const hit = (deg: number, r: number, inner = 0) => hitSlice(s, 100, 100, inner, 80, ...at(deg, r));
  assert.equal(hit(-45, 50), 0);
  assert.equal(hit(45, 50), 1);
  assert.equal(hit(135, 50), 2);
  assert.equal(hit(-135, 50), 3);
  // Justo arriba del centro es el comienzo de la primera porción, no el final de la última.
  assert.equal(hit(-90, 50), 0);
  assert.equal(hit(-45, 90), -1);
  assert.equal(hit(-45, 30, 48), -1);
  assert.equal(hit(-45, 60, 48), 0);
  // Una porción de cero nunca se señala.
  assert.equal(hitSlice(sliceAngles([0, 1]), 100, 100, 0, 80, 120, 60), 1);
});

test('porcentaje del total visible: las ocultas no cuentan', () => {
  const values = [50, 30, 20];
  assert.ok(
    close(
      visibleShare(values, 0, () => false),
      0.5,
    ),
  );
  const hidden = (i: number) => i === 1;
  assert.ok(close(visibleShare(values, 0, hidden), 50 / 70));
  assert.equal(visibleShare(values, 1, hidden), 0);
  assert.equal(
    visibleShare([0, 0], 0, () => false),
    0,
  );
});

test('tooltip: valor exacto y su parte del total visible', () => {
  const format: TooltipFormat = {
    difference: (d: number) => String(d),
    value: (v) => v.toLocaleString('es-ES'),
    number: String,
    percent: (v) => `${(Math.round(v * 1000) / 10).toString().replace('.', ',')} %`,
    isHidden: (i) => i === 2,
  };
  const ps = series([48210, 106300, 1000]);
  assert.equal(sliceTooltip(ps, 0, format).value, '48.210 (31,2 %)');
  assert.equal(sliceTooltip(ps, 2, format).value, '1000');
  assert.equal(sliceTooltip(series([NaN]), 0, format).value, 'Sin dato');
});

test('etiquetas: nunca quedan a menos de la separación mínima ni fuera del área', () => {
  // Muchas porciones diminutas juntas, del mismo lado: el peor caso.
  const candidates: LabelCandidate[] = Array.from({ length: 30 }, (_, i) => ({
    index: i,
    side: i % 3 === 0 ? 'left' : 'right',
    y: 140 + (i % 5),
    weight: i + 1,
  }));
  const top = 6;
  const bottom = 194;
  const placed = layoutLabels(candidates, LABEL_GAP, top, bottom);
  for (const side of ['left', 'right'] as const) {
    const ys = placed
      .filter((p) => p.side === side)
      .map((p) => p.ly)
      .sort((a, b) => a - b);
    assert.ok(ys.length > 0);
    for (let k = 1; k < ys.length; k++) assert.ok(ys[k] - ys[k - 1] >= LABEL_GAP - 1e-9, `${side}: ${ys[k - 1]} y ${ys[k]}`);
    assert.ok(ys[0] >= top && ys[ys.length - 1] <= bottom);
  }
  // No caben todas: se omiten las más chicas, nunca las grandes.
  assert.ok(placed.length < candidates.length);
  assert.ok(placed.some((p) => p.index === 29));
  const kept = new Set(placed.map((p) => p.index));
  const right = candidates.filter((c) => c.side === 'right');
  const minKept = Math.min(...right.filter((c) => kept.has(c.index)).map((c) => c.weight));
  assert.ok(right.filter((c) => !kept.has(c.index)).every((c) => c.weight <= minKept));
});

test('etiquetas que ya no chocan se quedan donde querían ir', () => {
  const placed = layoutLabels(
    [
      { index: 0, side: 'right', y: 40, weight: 1 },
      { index: 1, side: 'right', y: 120, weight: 1 },
      { index: 2, side: 'left', y: 40, weight: 1 },
    ],
    LABEL_GAP,
    0,
    200,
  );
  assert.deepEqual(
    placed.map((p) => p.ly),
    [40, 40, 120],
  );
});

test('porción completa: dos círculos, sin costura', () => {
  const d = slicePath(50, 50, 20, 40, TOP, TOP + 2 * Math.PI);
  assert.equal((d.match(/M/g) ?? []).length, 2);
  assert.equal(slicePath(50, 50, 0, 40, 0, 0), '');
});

test('dibujo: todo en cero deja un anillo de rejilla y nada de porciones', () => {
  const svg = donut.draw(context([0, 0, 0]));
  assert.ok(svg.includes(LIGHT.grid));
  assert.ok(!svg.includes(LIGHT.palette[0]));
});

test('dibujo: el total del donut va en texto principal y "Total" en secundario', () => {
  const svg = donut.draw(context([30, 20, 50]));
  assert.match(svg, new RegExp(`fill="${LIGHT.text}"[^>]*>100<`));
  assert.match(svg, new RegExp(`fill="${LIGHT.textMuted}"[^>]*>Total<`));
  // Los textos nunca van del color de una porción.
  for (const c of LIGHT.palette) assert.ok(!new RegExp(`<text[^>]*fill="${c}"`).test(svg));
});

test('dibujo: etiquetas con nombre y porcentaje; se apagan con labels: false o en pantallas angostas', () => {
  const svg = pie.draw(context([30, 20, 50]));
  assert.ok(svg.includes('Categoría 1 30 %'));
  assert.ok(!pie.draw(context([30, 20, 50], { options: { labels: false } })).includes('<text'));
  const narrow = pie.draw(context([30, 20, 50], { width: 120, height: 200 }));
  assert.ok(!narrow.includes('<text'));
  // Ningún texto se sale del área (estimación con el mismo medidor).
  const ctx = context([30, 20, 50], { width: 360 });
  for (const m of pie.draw(ctx).matchAll(/<text x="([\d.]+)"[^>]*text-anchor="(start|end)"[^>]*>([^<]*)</g)) {
    const x = Number(m[1]);
    const w = ctx.measure(m[3]);
    assert.ok(m[2] === 'start' ? x + w <= ctx.width : x - w >= 0, m[3]);
  }
});

test('hit y anchor sobre el contexto: agujero, porción y apoyo en el borde exterior', () => {
  const ctx = context([1, 1, 1, 1], { options: { labels: false } });
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  assert.equal(donut.hit!(ctx, cx, cy), -1);
  assert.equal(pie.hit!(ctx, cx + 1, cy - 1), 0);
  const [ax, ay] = pie.anchor!(ctx, 1)!;
  assert.ok(ax > cx && ay > cy);
  assert.ok(pie.hover!(ctx, 0).includes(`stroke="${LIGHT.surface}"`));
});
