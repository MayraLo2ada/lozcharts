/**
 * Conecta los gráficos por capas con un LozChart: registra el tipo de serie 'layers' y pone
 * LozChart.layers(el, spec). Lo llaman la entrada ESM y CommonJS ('@lozcharts/core/layers') y la
 * de <script> (layers.umd.js), cada una con su LozChart.
 */
import type { LozChart as LozChartClass } from '@lozcharts/core';
import { buildModel } from './compile';
import { layers, optionsOf } from './render';
import type { LayerSpec } from './spec';

type Host = typeof LozChartClass;

/** Crea el gráfico de una especificación: avisa en la consola lo que esté mal y dibuja lo demás. */
export function createLayers(LozChart: Host, target: string | HTMLElement, spec: LayerSpec): LozChartClass {
  const model = buildModel(spec);
  for (const p of model.problems) console.warn(`LozCharts: ${p.path ? p.path + ': ' : ''}${p.message}`);
  return new LozChart(target, optionsOf(model));
}

export function register(LozChart: Host): void {
  LozChart.registerSeries('layers', layers);
  LozChart.layers = (target, spec) => createLayers(LozChart, target, spec as LayerSpec);
}
