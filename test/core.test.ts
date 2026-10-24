import { niceDomain, niceStep, numberTicks, chooseTimeInterval, timeTicks, detectTimeUnit } from '../src/core/ticks';
import { axisFormatter, valueFormatter, parseTime, timeTickLabel, timeFullLabel } from '../src/core/format';
import { linePath } from '../src/core/shapes';

let fails = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const norm = (v: unknown) => JSON.stringify(v).replace(/\u00a0|\u202f|u00a0|u202f/g, ' ');
  const ok = norm(got) === norm(want);
  if (!ok) fails++;
  console.log(ok ? 'ok  ' : 'FALLA', name, ok ? '' : `→ ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`);
};
eq('niceStep 0..2350 en 5', niceStep(2350, 5), 500);
eq('niceDomain 0..2350', niceDomain(0, 2350, 5), [0, 2500, 500]);
eq('niceDomain -37..112', niceDomain(-37, 112, 5).slice(0, 2), [-50, 150]);
eq('numberTicks 0..1 paso 0.2', numberTicks(0, 1, 0.2), [0, 0.2, 0.4, 0.6, 0.8, 1]);
const ctx = { locale: 'es', currency: 'USD' };
const f = axisFormatter('auto', ctx, 1000, 4000);
eq('eje compacto', [0, 1000, 2000].map(f), ['0', '1 mil', '2 mil']);
eq('eje 1,5 mil', axisFormatter('auto', ctx, 500, 3000)(1500), '1,5 mil');
eq('eje moneda', axisFormatter('currency', ctx, 20000, 80000)(40000), '40 mil $');
eq('valor exacto', valueFormatter('number', ctx)(12345.678), '12.345,68');
eq('porcentaje', valueFormatter('percent', ctx)(0.256), '25,6 %');
const t = parseTime('2026-01');
eq('parseTime local', [new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()], [2026, 0, 1]);
eq('etiqueta mes', timeTickLabel(parseTime('2026-09'), 'month', 'es'), 'sept');
eq('etiqueta enero = año', timeTickLabel(parseTime('2026-01'), 'month', 'es'), '2026');
eq('tooltip mes', timeFullLabel(parseTime('2026-03'), 'month', 'es'), 'Marzo de 2026');
const months = Array.from({ length: 12 }, (_, i) => parseTime(`2026-${i + 1}`));
eq('detecta mes', detectTimeUnit(months), 'month');
const iv = chooseTimeInterval(months[0], months[11], 6);
eq('intervalo 12 meses en 6', [iv.unit, iv.every], ['month', 2]);
eq('ticks bimestrales', timeTicks(months[0], months[11], iv).length, 6);
// Curva monótona: ningún punto de control fuera del rango [min,max] del tramo.
const pts: [number, number][] = [[0, 10], [10, 50], [20, 52], [30, 10]];
const d = linePath(pts, true);
const ys = [...d.matchAll(/[ ,]?(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => +m[2]);
eq('monótona no se pasa', Math.max(...ys) <= 52 && Math.min(...ys) >= 10, true);
process.exit(fails ? 1 : 0);
