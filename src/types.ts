/** Opciones públicas de LozChart. */

export type ThemeName = 'light' | 'dark' | 'auto';

/** Cómo se muestran los números. Una función recibe el valor y devuelve el texto. */
export type FormatSpec =
  | 'auto'
  | 'compact'
  | 'number'
  | 'percent'
  | 'currency'
  | ((value: number) => string);

export type XAxisType = 'category' | 'time' | 'linear';

/** Una fila de datos: cualquier objeto plano. */
export type Datum = Record<string, unknown>;

export interface XAxisOptions {
  /** Campo de cada fila que da la posición en X. */
  field: string;
  /** 'category' (texto), 'time' (fechas) o 'linear' (números). Por defecto 'category'. */
  type?: XAxisType;
  /** Formato de las etiquetas. En 'time' acepta opciones de Intl.DateTimeFormat. */
  format?: FormatSpec | Intl.DateTimeFormatOptions;
  /** Título bajo el eje. */
  title?: string;
}

export interface YAxisOptions {
  format?: FormatSpec;
  title?: string;
  /** Mínimo y máximo fijos. Si no se dan, se calculan "bonitos" a partir de los datos. */
  min?: number;
  max?: number;
  /** Fuerza que el eje incluya el cero (las barras y áreas ya lo incluyen). */
  zero?: boolean;
}

export interface SeriesOptions {
  /** Tipo registrado: 'line', 'bar', 'area' o uno propio. */
  type: string;
  /** Campo numérico de cada fila. */
  field: string;
  /** Nombre visible (leyenda, tooltip). Por defecto, el campo. Debe ser único. */
  name?: string;
  /** Apilar con otras series del mismo grupo. true = grupo por defecto. */
  stack?: boolean | string;
  /** Línea suave (curva monótona, no se pasa de los datos). */
  smooth?: boolean;
  /** Slot de la paleta (1 a 8). Por defecto, su posición en `series`. */
  color?: number;
  /** Visible al inicio. Por defecto true. */
  visible?: boolean;
  /** Formato propio para el tooltip de esta serie. */
  format?: FormatSpec;
  /** Cualquier opción extra que use un tipo de serie propio. */
  [extra: string]: unknown;
}

export interface LegendOptions {
  position?: 'top' | 'bottom';
}

export interface LozChartOptions {
  title?: string;
  subtitle?: string;
  data: Datum[];
  xAxis: XAxisOptions;
  yAxis?: YAxisOptions;
  series: SeriesOptions[];
  theme?: ThemeName;
  /** Alto del área del gráfico (ejes incluidos), en px. Por defecto 320. */
  height?: number;
  /** false oculta la leyenda. Solo aparece con 2 o más series. */
  legend?: boolean | LegendOptions;
  tooltip?: boolean;
  animate?: boolean;
  /** Locale para números y fechas. Por defecto 'es'. */
  locale?: string;
  /** Moneda ISO para el formato 'currency'. Por defecto 'USD'. */
  currency?: string;
  /** Texto para lectores de pantalla. Por defecto se arma con el título. */
  ariaLabel?: string;
  /** Pinta el fondo con el color de superficie del tema. Por defecto true. */
  background?: boolean;
}
