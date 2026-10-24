/** Opciones públicas de LozChart. */

export type ThemeName = 'light' | 'dark' | 'auto';

/** Cómo se muestran los números. Una función recibe el valor y devuelve el texto. */
export type FormatSpec = 'auto' | 'compact' | 'number' | 'percent' | 'currency' | ((value: number) => string);

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
  /** false oculta las etiquetas del eje (small multiples las dejan solo en la última fila). Por defecto true. */
  labels?: boolean;
  /** Fuerza la escala de banda (cada punto al centro de su franja), para alinear con gráficos de barras. */
  band?: boolean;
}

export interface YAxisOptions {
  format?: FormatSpec;
  title?: string;
  /** Mínimo y máximo fijos. Si no se dan, se calculan "bonitos" a partir de los datos. */
  min?: number;
  max?: number;
  /** Fuerza que el eje incluya el cero (las barras y áreas ya lo incluyen). */
  zero?: boolean;
  /** false oculta los números del eje (la rejilla queda). Por defecto true. */
  labels?: boolean;
  /** Ancho mínimo reservado para los números, en px: alinea el área de datos de varios gráficos. */
  width?: number;
  /**
   * Índice base 100: cada serie se divide por su primer valor y se multiplica por 100, así series
   * con unidades distintas comparan su crecimiento en un solo eje honesto. El tooltip muestra
   * también el valor original.
   */
  index?: boolean;
}

export interface SeriesOptions {
  /**
   * Tipo registrado: 'line', 'bar', 'area', 'step', 'range', 'scatter', 'bubble',
   * 'candlestick', 'ohlc' o uno propio.
   */
  type: string;
  /** Campo numérico de cada fila. En velas y OHLC es el cierre; en 'range', el límite superior. */
  field: string;
  /** Nombre visible (leyenda, tooltip). Por defecto, el campo. Debe ser único. */
  name?: string;
  /** Apilar con otras series del mismo grupo. true = grupo por defecto. */
  stack?: boolean | string;
  /** Línea suave (curva monótona, no se pasa de los datos). */
  smooth?: boolean;
  /** Línea escalonada: dónde cambia de nivel. 'after' (por defecto): el valor se mantiene hasta el siguiente punto. */
  step?: 'before' | 'after' | 'middle';
  /** Burbujas: campo que da el tamaño (el área del círculo es proporcional al valor). */
  size?: string;
  /** Burbujas: cómo se llama el tamaño en el tooltip ("Clientes"). Por defecto, "Tamaño". */
  sizeName?: string;
  /** Velas y OHLC: campos de apertura, máximo y mínimo. 'range': `low` es el límite inferior. */
  open?: string;
  high?: string;
  low?: string;
  /** Posición en la paleta (desde 1). Por defecto, su orden en `series`. */
  color?: number;
  /** Eje del valor: 'left' (por defecto) o 'right', configurado con `yAxis2`. */
  axis?: 'left' | 'right';
  /** Visible al inicio. Por defecto true. */
  visible?: boolean;
  /** Formato propio para el tooltip de esta serie. */
  format?: FormatSpec;
}

/**
 * Colores de las series, en orden (máximo 8). Un arreglo vale para los dos temas; para
 * el modo oscuro conviene dar sus propios tonos, validados contra la superficie oscura.
 */
export type PaletteOption = readonly string[] | { light: readonly string[]; dark?: readonly string[] };

export interface LegendOptions {
  position?: 'top' | 'bottom';
}

export interface LozChartOptions {
  /** 'horizontal' pone las categorías en el eje vertical (barras horizontales). Por defecto 'vertical'. */
  orientation?: 'vertical' | 'horizontal';
  title?: string;
  subtitle?: string;
  data: Datum[];
  xAxis: XAxisOptions;
  yAxis?: YAxisOptions;
  /**
   * Eje derecho, para las series con `axis: 'right'`. Con salvaguardas: los dos ejes incluyen el
   * cero a la misma altura y comparten las líneas de la rejilla, y la leyenda dice qué serie va en
   * cada eje. Antes de usarlo, considera paneles alineados o `yAxis.index` (ver README).
   */
  yAxis2?: Pick<YAxisOptions, 'format' | 'title' | 'min' | 'max'>;
  series: SeriesOptions[];
  theme?: ThemeName;
  /** Paleta propia. Por defecto, la de LozChart (validada para daltonismo). */
  palette?: PaletteOption;
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
  /**
   * Se llama cuando el puntero o el teclado activan un dato, con su X (texto de la categoría,
   * o número: fecha en ms o valor), y con null al salir. Junto con highlight() sincroniza gráficos.
   */
  onHover?: (x: string | number | null) => void;
}

/** Cambios para setOptions: cualquier opción, y del eje X solo lo que cambia. */
export type LozChartUpdate = Omit<Partial<LozChartOptions>, 'xAxis'> & { xAxis?: Partial<XAxisOptions> };

/** Small multiples: una cuadrícula de gráficos pequeños con escalas compartidas. */
export interface MultiplesOptions extends Omit<LozChartOptions, 'onHover' | 'orientation'> {
  /**
   * Cómo se reparten los paneles: 'series' (uno por serie) o { field } (uno por cada valor de
   * ese campo; `order` fija el orden de los paneles).
   */
  facet: 'series' | { field: string; order?: string[] };
  /** Columnas fijas. Por defecto, las que quepan con `minWidth`. */
  columns?: number;
  /** Ancho mínimo de cada panel, en px. Por defecto 240. */
  minWidth?: number;
  /** Alto del gráfico de cada panel, en px. Por defecto 180. */
  height?: number;
  /** Mismo eje del valor en todos los paneles (para compararlos de verdad). Por defecto true. */
  sharedY?: boolean;
}

/** Cambios para setOptions de small multiples. */
export type MultiplesUpdate = Omit<Partial<MultiplesOptions>, 'xAxis'> & { xAxis?: Partial<XAxisOptions> };
