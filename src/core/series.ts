/**
 * Contrato de los tipos de serie (plugins).
 *
 * El núcleo prepara los datos, apila, anima y calcula escalas. Cada tipo de serie solo
 * recibe un "cuadro" (frame) ya interpolado con sus valores y devuelve markup SVG.
 * Así, agregar un tipo nuevo es escribir un objeto SeriesImpl y llamar a
 * LozChart.registerSeries('nombre', impl), sin tocar el núcleo.
 */
import type { SeriesOptions } from '../types';
import type { LinearScale, XScale } from './scales';
import type { Theme } from './theme';

/** Una serie ya preparada por el núcleo. */
export interface PreparedSeries {
  /** Identificador estable (el nombre). */
  key: string;
  name: string;
  type: string;
  impl: SeriesImpl;
  color: string;
  options: SeriesOptions;
  /** Valor de cada índice (NaN si falta). */
  values: number[];
  /** Grupo de apilado, o null. */
  stackKey: string | null;
}

/** Estado de una serie en un cuadro de animación (en unidades de datos). */
export interface SeriesFrame {
  ps: PreparedSeries;
  /** Base de cada índice (0, o la serie de abajo si está apilada). */
  y0: number[];
  /** Punta de cada índice. */
  y1: number[];
  /** Opacidad (0 = oculta). */
  alpha: number;
  /** Posición dentro del grupo de barras y cantidad de posiciones (pueden ser fraccionarias al animar). */
  slot: number;
  slots: number;
  /** ¿Es el segmento exterior de su pila en el índice i? (solo ese lleva la punta redondeada). */
  outer: boolean[];
  /** La serie va de salida: se elimina al terminar la animación. */
  exiting?: boolean;
}

export interface DrawContext {
  frame: SeriesFrame;
  x: XScale;
  y: LinearScale;
  theme: Theme;
  /** Tamaño del área de datos en px. */
  width: number;
  height: number;
  n: number;
}

export interface SeriesImpl {
  /** Necesita escala de banda en X (barras). */
  band?: boolean;
  /** Ocupa una posición dentro del grupo de la banda (barras agrupadas). */
  cluster?: boolean;
  /** Admite `stack`. */
  stackable?: boolean;
  /** El eje Y debe incluir el cero. */
  includeZero?: boolean;
  /** Orden de dibujo: menor va abajo. Barras 0, áreas 1, líneas 2. */
  layer?: number;
  /** Muestra en leyenda y tooltip. */
  legendSymbol?: 'line' | 'square';
  /** Nombre en español para la descripción accesible ("barras", "líneas"…). */
  label?: string;
  /** Markup SVG de la serie. */
  draw(ctx: DrawContext): string;
  /** Marcas de hover en el índice i (puntos, por ejemplo). */
  hover?(ctx: DrawContext, i: number): string;
}
