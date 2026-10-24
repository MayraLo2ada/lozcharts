/**
 * Facetas de los small multiples: cómo se reparten datos y series entre los paneles.
 * Puro (sin DOM), así se prueba sin navegador.
 */
import type { Datum, LozChartOptions, MultiplesOptions, SeriesOptions } from '../types';
import { parseTime } from './format';
import { toNumber } from './prepare';

export interface PanelSpec {
  /** Nombre del panel: la serie o el valor del campo. */
  name: string;
  options: LozChartOptions;
}

/**
 * Un panel por serie, o uno por cada valor de un campo. En la segunda forma, todos los paneles
 * reciben las mismas X (las que faltan entran como filas vacías: huecos), así quedan alineados.
 */
export function facetPanels(o: MultiplesOptions, base: LozChartOptions): PanelSpec[] {
  if (o.facet === 'series') {
    return o.series.map((s, i) => {
      const name = s.name ?? s.field;
      // El color sigue a la serie: la de la posición i conserva el color i en su panel.
      const series: SeriesOptions[] = [{ ...s, color: s.color ?? i + 1, visible: true }];
      return { name, options: { ...base, title: name, series } };
    });
  }
  const { field, order } = o.facet;
  const xField = o.xAxis.field;
  const keyOfX = xKeyReader(o.xAxis.type ?? 'category');
  const panels = new Map<string, Datum[]>();
  const xs = new Map<string | number, unknown>();
  for (const row of o.data) {
    const key = String(row[field] ?? '');
    if (!panels.has(key)) panels.set(key, []);
    panels.get(key)!.push(row);
    const x = keyOfX(row[xField]);
    if (!xs.has(x)) xs.set(x, row[xField]);
  }
  const names = order ? order.filter((k) => panels.has(k)) : [...panels.keys()];
  return names.map((name) => {
    const byX = new Map<string | number, Datum[]>();
    for (const row of panels.get(name)!) {
      const x = keyOfX(row[xField]);
      if (!byX.has(x)) byX.set(x, []);
      byX.get(x)!.push(row);
    }
    // En el orden de todas las X: las del panel y, donde falte una, una fila vacía (un hueco).
    const data = [...xs].flatMap(([x, raw]) => byX.get(x) ?? [{ [xField]: raw }]);
    return { name, options: { ...base, title: name, data } };
  });
}

/** Cómo comparar X entre filas: fechas por su instante, números por su valor, categorías por su texto. */
function xKeyReader(type: string): (v: unknown) => string | number {
  if (type === 'time') return (v) => parseTime(v);
  if (type === 'linear') return (v) => toNumber(v);
  return (v) => String(v ?? '');
}
