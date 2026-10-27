/**
 * Gráficos por capas: `import { layers } from '@lozcharts/core/layers'`. Un gráfico descrito como
 * una pila de capas en JSON ({ data, layers }). Al cargarse registra el tipo de serie 'layers' en
 * LozChart y deja también LozChart.layers(el, spec), para initAll y data-lozchart.
 */
import { LozChart } from '@lozcharts/core';
import { createLayers, register } from './register';
import type { LayerSpec } from './spec';

register(LozChart);

/** Dibuja una especificación por capas en un elemento (o un selector). */
export function layers(target: string | HTMLElement, spec: LayerSpec): LozChart {
  return createLayers(LozChart, target, spec);
}

export { layerOptions } from './render';
export { checkLayers } from './compile';
export { ICON_NAMES } from './icons';
export type * from './spec';
