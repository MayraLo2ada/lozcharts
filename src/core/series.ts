/**
 * Contrato de los tipos de serie (plugins).
 *
 * El núcleo prepara los datos, apila, anima y calcula escalas. Cada tipo de serie solo
 * recibe un "cuadro" (frame) ya interpolado con sus valores y devuelve markup SVG.
 * Así, agregar un tipo nuevo es escribir un objeto SeriesImpl y llamar a
 * LozChart.registerSeries('nombre', impl), sin tocar el núcleo.
 *
 * El dibujo ocurre en un plano lógico: el índice avanza en X y el valor en Y. Con
 * `orientation: 'horizontal'` el núcleo refleja ese plano sobre su diagonal, así que
 * las series no necesitan saber hacia dónde apunta el gráfico.
 */
import type { SeriesOptions } from '../types';
import type { LinearScale, XScale } from './scales';
import type { Theme } from './theme';

/** Una serie ya preparada por el núcleo. */
export interface PreparedSeries {
  /** Identificador estable: el nombre. */
  key: string;
  name: string;
  impl: SeriesImpl;
  /** Posición en la paleta (0 a 7), o -1 para el grupo "Otros". */
  slot: number;
  options: SeriesOptions;
  /** Valor principal de cada índice (NaN si falta). Con yAxis.index, ya convertido a índice. */
  values: number[];
  /** Con yAxis.index: los valores originales, antes de convertirlos. */
  raw?: number[];
  /** Columnas extra que pidió el tipo de serie (ver SeriesImpl.columns). */
  columns: Record<string, number[]>;
  /** Grupo de apilado, o null. */
  stackKey: string | null;
}

/** Estado de una serie en un cuadro de animación (en unidades de datos). */
export interface SeriesFrame {
  ps: PreparedSeries;
  /** Base de cada índice (el cero, o la punta de la serie de abajo si está apilada). */
  y0: number[];
  /** Punta de cada índice. */
  y1: number[];
  /** Columnas extra, animadas igual que y0 e y1. */
  cols: Record<string, number[]>;
  /** Opacidad (0 = oculta). */
  alpha: number;
  /** Posición dentro del grupo de barras y cantidad de posiciones (fraccionarias al animar). */
  slot: number;
  slots: number;
  /** ¿Es el segmento exterior de su pila en el índice i? Solo ese lleva la punta redondeada. */
  outer: boolean[];
}

export interface DrawContext {
  frame: SeriesFrame;
  /** Color de la serie en el tema actual. */
  color: string;
  /** Escala del índice (eje de categorías o tiempo). */
  x: XScale;
  /** Escala del valor. */
  y: LinearScale;
  theme: Theme;
  /** Tamaño del plano lógico en px: largo del eje del índice y del eje del valor. */
  width: number;
  height: number;
  n: number;
}

/** Formateadores que recibe una serie para su tooltip, en el idioma del gráfico. */
export interface TooltipFormat {
  /** Un valor en unidades del eje (respeta yAxis.format o el format de la serie). */
  value: (v: number) => string;
  /** Un número simple, para lo que no está en unidades del eje (por ejemplo, un tamaño). */
  number: (v: number) => string;
}

/** Una línea del tooltip. */
export interface TooltipValue {
  /** Texto principal, junto al nombre de la serie. */
  value: string;
  /** Detalle opcional debajo, por ejemplo apertura, máximo, mínimo y cierre. */
  details?: [label: string, value: string][];
}

export interface SeriesImpl {
  /** Necesita escala de banda en X (barras, velas). */
  band?: boolean;
  /** Ocupa una posición dentro del grupo de la banda (barras agrupadas). */
  cluster?: boolean;
  /** Admite `stack`. */
  stackable?: boolean;
  /** El eje Y debe incluir el cero. */
  includeZero?: boolean;
  /** Orden de dibujo: menor va abajo. Barras 0, áreas 1, líneas 2, puntos 3. */
  layer?: number;
  /** Muestra en leyenda: cuadrado (barras, áreas), trazo (líneas) o punto (dispersión). */
  legendSymbol?: 'line' | 'square' | 'dot';
  /** Nombre para la descripción accesible ("barras", "líneas"…). */
  label?: string;
  /**
   * Cómo encuentra el puntero el dato: 'index' (crosshair sobre el índice más cercano en X)
   * o 'nearest' (el punto más cercano en el plano, para dispersión). Por defecto 'index'.
   */
  pointer?: 'index' | 'nearest';
  /**
   * Columnas extra que lee de cada fila, como { nombre: campo }. Por ejemplo, una vela
   * pide { open: o.open, high: o.high, low: o.low }. Quedan en `ps.columns` y `frame.cols`.
   */
  columns?(options: SeriesOptions): Record<string, string | undefined>;
  /** Columnas que están en unidades del eje Y: cuentan para el dominio y se encogen al ocultarse. */
  valueColumns?: readonly string[];
  /** Markup SVG de la serie. */
  draw(ctx: DrawContext): string;
  /** Marcas de hover en el índice i (puntos, por ejemplo). */
  hover?(ctx: DrawContext, i: number): string;
  /** Texto del tooltip en el índice i, si no basta con el valor principal formateado. */
  tooltip?(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null;
}
