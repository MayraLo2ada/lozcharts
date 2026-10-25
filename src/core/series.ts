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
  /** Eje del valor: el izquierdo, o el derecho (yAxis2). */
  axis: 'left' | 'right';
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

/**
 * Plano polar (radar): el índice es un ángulo y el valor, una distancia al centro.
 * El núcleo dibuja la rejilla (anillos y radios) y las etiquetas; la serie, sus polígonos.
 */
export interface PolarPlane {
  cx: number;
  cy: number;
  /** Radio del anillo exterior, en px. */
  radius: number;
  /** Ángulo del índice i, en radianes (el primero arriba, en sentido horario). */
  angle(i: number): number;
  /** Punto en px del índice i con el valor v. */
  point(i: number, v: number): [number, number];
}

export interface DrawContext {
  frame: SeriesFrame;
  /** Color de la serie en el tema actual. */
  color: string;
  /**
   * Color del punto i, para los tipos que colorean por categoría (legendBy: 'points', como un
   * pie): cada porción tiene su color de la paleta en orden fijo, y "Otros" el neutro.
   */
  pointColor(i: number): string;
  /** Plano polar (solo con coords: 'polar'). */
  polar?: PolarPlane;
  /** Escala del índice (eje de categorías o tiempo). */
  x: XScale;
  /** Escala del valor. */
  y: LinearScale;
  theme: Theme;
  /** Tamaño del plano lógico en px: largo del eje del índice y del eje del valor (en 'free', el área completa). */
  width: number;
  height: number;
  n: number;
  /** ¿El punto i está oculto desde la leyenda (legendBy: 'points')? Su valor ya llega en cero. */
  isHidden(i: number): boolean;
  /** Texto corto de la categoría i (la X), para etiquetas como las de un pie o un embudo. */
  label(i: number): string;
  /** Medir el ancho de un texto con la fuente del gráfico (12 px), para ubicar etiquetas. */
  measure(text: string): number;
  /** Formatear un valor como en el tooltip (respeta el format de la serie o del eje). */
  format(v: number): string;
  /** Formatear una proporción como porcentaje, en el idioma del gráfico (0,42 → "42 %"). */
  percent(v: number): string;
  /** Formatear un valor en forma compacta ("506 mil M"), para cuando el exacto no cabe. */
  compact(v: number): string;
}

/** Formateadores que recibe una serie para su tooltip, en el idioma del gráfico. */
export interface TooltipFormat {
  /** Un valor en unidades del eje (respeta yAxis.format o el format de la serie). */
  value: (v: number) => string;
  /** Un número simple, para lo que no está en unidades del eje (por ejemplo, un tamaño). */
  number: (v: number) => string;
  /** Una proporción como porcentaje (0,256 → "25,6 %"). */
  percent: (v: number) => string;
  /** ¿El punto i está oculto desde la leyenda? Para calcular partes del total visible. */
  isHidden: (i: number) => boolean;
  /**
   * Una diferencia entre dos valores del eje, con signo. Con formato de porcentaje se escribe en
   * puntos porcentuales ("−7 p. p."), que no se confunde con una variación relativa.
   */
  difference: (d: number) => string;
}

/** Una línea del tooltip. */
export interface TooltipValue {
  /** Texto principal, junto al nombre de la serie. */
  value: string;
  /** Detalle opcional debajo, por ejemplo apertura, máximo, mínimo y cierre. */
  details?: [label: string, value: string][];
}

export interface SeriesImpl {
  /**
   * Sistema de coordenadas: 'cartesian' (ejes X e Y, por defecto), 'polar' (radar) o 'free'
   * (sin ejes: la serie usa todo el área, como un pie, un gauge o un embudo). Todas las series
   * de un gráfico comparten el mismo.
   */
  coords?: 'cartesian' | 'polar' | 'free';
  /**
   * Qué lista la leyenda: 'series' (por defecto) o 'points' (cada categoría con su color, como
   * las porciones de un pie; ocultar una la deja en cero). Con 'points' solo se usa la primera serie.
   */
  legendBy?: 'series' | 'points';
  /** Índices que recorre el teclado (por defecto, todos). Un gauge solo tiene el que dibuja. */
  navigable?(ps: PreparedSeries): number[];
  /** Cómo se llaman sus datos en la descripción accesible: ['etapa', 'etapas']. Por defecto, puntos. */
  items?: readonly [singular: string, plural: string];
  /** En 'free': índice del dato bajo el punto (px, py) del área, o -1. */
  hit?(ctx: DrawContext, px: number, py: number): number;
  /** En 'free': dónde apoyar el tooltip del dato i (px del área). */
  anchor?(ctx: DrawContext, i: number): [number, number];
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
  /**
   * Admite etiqueta al final (opción endLabels): series que terminan en un punto a la derecha,
   * como líneas, áreas y escalones. Se ubica en la punta (y1) del último dato visible.
   */
  endLabel?: boolean;
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
  /** Valores fijos que también deben caber en el eje (por ejemplo, la meta de un gauge). */
  domainValues?(options: SeriesOptions): number[];
  /** Columnas que están en unidades del eje Y: cuentan para el dominio y se encogen al ocultarse. */
  valueColumns?: readonly string[];
  /** Markup SVG de la serie. */
  draw(ctx: DrawContext): string;
  /** Marcas de hover en el índice i (puntos, por ejemplo). */
  hover?(ctx: DrawContext, i: number): string;
  /** Texto del tooltip en el índice i, si no basta con el valor principal formateado. */
  tooltip?(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null;
}
