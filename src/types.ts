/** Opciones públicas de LozChart. */

export type ThemeName = 'light' | 'dark' | 'auto';

/** Cómo se muestran los números. Una función recibe el valor y devuelve el texto. */
export type FormatSpec = 'auto' | 'compact' | 'number' | 'percent' | 'currency' | ((value: number) => string);

export type XAxisType = 'category' | 'time' | 'linear';

/** Una fila de datos: cualquier objeto plano. */
export type Datum = Record<string, unknown>;

/**
 * Una fila tal como la das en `data`. El `any` es a propósito: así encajan filas tipadas con
 * `interface` (que no tienen firma de índice) y, al leerlas de vuelta en `chart.options.data`,
 * sus campos se usan sin conversiones.
 */
export type DataRow = { [campo: string]: any };

/** Un valor del eje X: el texto de una categoría, una fecha o un número. */
export type XValue = string | number | Date;

/**
 * Línea de referencia o franja. Da `x` o `y`: con un valor es una línea (una meta, un
 * lanzamiento); con dos, una franja (un trimestre, un rango aceptable).
 */
export interface Annotation {
  /** Sobre el eje X: una categoría, fecha o número, o dos para una franja. */
  x?: XValue | [XValue, XValue];
  /** Sobre el eje del valor: un número, o dos para una franja. El eje se amplía para mostrarla. */
  y?: number | [number, number];
  /** Texto corto junto a la línea o dentro de la franja. */
  label?: string;
  /** Con `y`: en qué eje del valor se mide ('left' por defecto, o 'right' con yAxis2). */
  axis?: 'left' | 'right';
}

/** Zoom en el eje X (solo gráficos cartesianos verticales). */
export interface ZoomOptions {
  /** Ventana inicial: desde y hasta, en valores de X. Por defecto, todos los datos. */
  range?: [XValue, XValue];
  /** Barra con un mini gráfico de todos los datos para mover la ventana. Por defecto true. */
  scrollbar?: boolean;
  /**
   * Botón "Ver todo" junto al título al acercar. Por defecto true. Sin él se vuelve a todo con
   * doble clic, con la tecla 0 o con resetZoom().
   */
  reset?: boolean;
}

/**
 * Ventana del zoom como fracciones del eje X completo: { start: 0.25, end: 0.5 } es el segundo
 * cuarto. Es exacta (no se redondea a un dato) y no depende del ancho: sirve para que varios
 * gráficos con el mismo eje muestren exactamente el mismo tramo (ver setZoomWindow).
 */
export interface ZoomWindow {
  start: number;
  end: number;
}

/** Tooltip: además de true o false, qué partes se muestran. */
export interface TooltipOptions {
  /**
   * false quita el recuadro flotante pero conserva todo lo demás: el puntero, el crosshair o la
   * banda, las marcas del dato activo, el teclado, los avisos a lectores de pantalla y onHover.
   * Para quien muestra los valores en otro lado (un panel fijo, una tabla). Por defecto true.
   */
  float?: boolean;
}

/** Etiquetas al final de cada línea o área, en lugar de buscar el color en la leyenda. */
export interface EndLabelOptions {
  /** Mostrar también el último valor visible. Por defecto false. */
  value?: boolean;
}

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
  /**
   * Líneas verticales de la rejilla en cada marca del eje. Por defecto, sí con fechas o números y
   * no con categorías (las barras ya marcan cada una).
   */
  grid?: boolean;
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
  /**
   * Escala del eje: 'linear' (por defecto) o 'log', para datos que crecen por multiplicación
   * (poblaciones, precios a largo plazo). En 'log' cuentan solo los valores positivos, el eje no
   * incluye el cero y sus marcas van en valores redondos: 1, 2 y 5 × 10ⁿ, o solo potencias de 10
   * si no caben. Las barras y áreas parten del borde inferior.
   */
  type?: 'linear' | 'log';
  /** false oculta la rejilla del eje del valor (la línea del cero o la base quedan). Por defecto true. */
  grid?: boolean;
}

/**
 * Los tipos que trae la librería. Un tipo propio registrado con LozChart.registerSeries también
 * vale: `(string & {})` deja escribir cualquier nombre sin perder el autocompletado de estos.
 */
export type SeriesType =
  | 'line'
  | 'bar'
  | 'area'
  | 'step'
  | 'range'
  | 'scatter'
  | 'bubble'
  | 'candlestick'
  | 'ohlc'
  | 'pie'
  | 'donut'
  | 'gauge'
  | 'radar'
  | 'funnel'
  | 'heatmap'
  | 'treemap'
  | 'sankey'
  | 'choropleth'
  | 'mapbubble'
  | 'waterfall'
  | 'bullet'
  | 'sunburst'
  | 'chord'
  | 'network'
  | 'timeline'
  | 'wordcloud'
  | (string & {});

export interface SeriesOptions {
  /** Tipo de la serie: uno de los 26 de la librería (ver SeriesType) o uno propio registrado. */
  type: SeriesType;
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
  /** Pie y donut: radio del agujero como fracción del radio (0 = pie; el donut usa 0,6). */
  innerRadius?: number;
  /** Gauge: valor de la meta, marcado sobre el arco. */
  target?: number;
  /** Pie, donut y embudo: mostrar las etiquetas junto a cada parte; mapas: la escala de color. Por defecto true. */
  labels?: boolean;
  /** Mapa de calor: campo de cada fila que da la fila del mapa (el eje vertical); la X da la columna. */
  y?: string;
  /** Treemap: campo que agrupa los rectángulos (cada grupo con su color y su título). */
  group?: string;
  /** Sankey, cuerdas y red: campo con el destino de cada vínculo; el origen es el campo de la X. */
  to?: string;
  /** Sunburst: campos de la jerarquía, del nivel más alto al más bajo (['region', 'pais', 'ciudad']). */
  levels?: string[];
  /** Línea de tiempo: campo con la fecha de fin de cada tramo (el inicio es la X). */
  end?: string;
  /** Línea de tiempo: campo con el nombre de cada tramo. Por defecto, `field`. */
  label?: string;
  /**
   * Línea de tiempo: línea vertical en el día de hoy (true) o en una fecha dada, con su texto
   * arriba ("Hoy" o la fecha). Solo se dibuja si cae dentro del eje.
   */
  today?: boolean | XValue;
  /** Cascada: campo que marca las filas que son subtotal o total (verdadero: la barra parte de cero). */
  total?: string;
  /** Bala: campo con la meta de cada fila. */
  targetField?: string;
  /** Bala: límites de los rangos de calidad de fondo (por ejemplo [50, 75, 100]). */
  ranges?: number[];
  /** Mapas: nombre del mapa registrado (por defecto 'mundo'). */
  map?: string;
  /** Mapas: 'all' (por defecto) encuadra todo el mapa; 'data', solo los lugares con datos (una región). */
  fit?: 'all' | 'data';
  /**
   * Mapas: 'equalEarth' (por defecto, áreas iguales), 'mercator' o 'orthographic' (el globo
   * terráqueo, visto desde lejos; se gira con `rotate`).
   */
  projection?: 'equalEarth' | 'mercator' | 'orthographic';
  /** Globo: [longitud, latitud] del punto que mira al frente. Por defecto, el centro de los datos. */
  rotate?: [number, number];
  /** Mapa de burbujas: campos de latitud y longitud (si faltan, la burbuja va al centro del país). */
  lat?: string;
  lon?: string;
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
  /** Las filas: objetos planos, uno por dato (ver DataRow). */
  data: DataRow[];
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
  /**
   * Alto del área del gráfico (ejes incluidos), en px. Por defecto 320, o el que pida el tipo de
   * serie (ver SeriesImpl.preferredHeight); un alto dado aquí siempre manda.
   */
  height?: number;
  /** false oculta la leyenda. Solo aparece con 2 o más series. */
  legend?: boolean | LegendOptions;
  /**
   * false apaga el tooltip y el puntero (el teclado sigue recorriendo los datos). `{ float: false }`
   * quita solo el recuadro flotante. Por defecto true.
   */
  tooltip?: boolean | TooltipOptions;
  animate?: boolean;
  /**
   * Idioma de los textos (tooltip, leyenda, botones, descripción accesible, avisos) y formato de
   * números y fechas: 'es', 'en', 'pt-BR' o cualquier variante ('es-MX' usa los textos en español
   * y los números de México). Por defecto, el de la página (`<html lang>`) si es español, inglés o
   * portugués (o uno registrado con LozChart.registerLocale); si no, inglés.
   */
  locale?: string;
  /** Moneda ISO para el formato 'currency'. Por defecto 'USD'. */
  currency?: string;
  /** Texto para lectores de pantalla. Por defecto se arma con el título. */
  ariaLabel?: string;
  /** Pinta el fondo con el color de superficie del tema. Por defecto true. */
  background?: boolean;
  /** Líneas de referencia y franjas (gráficos cartesianos). */
  annotations?: Annotation[];
  /**
   * Nombre al final de cada línea, área o escalón (gráficos verticales). Con varias series se
   * leen sin ir y volver a la leyenda.
   */
  endLabels?: boolean | EndLabelOptions;
  /**
   * Series que cuentan la historia: van en su color y encima; las demás quedan en gris como
   * contexto. Útil para destacar una entre muchas.
   */
  emphasis?: string | string[];
  /**
   * Zoom en el eje X: arrastrar para acercar, Ctrl + rueda o pellizcar para acercar o alejar,
   * deslizar con dos dedos (o Shift + rueda) para moverse y doble clic para ver todo. El eje del
   * valor se ajusta a lo visible. Con el teclado: + y − acercan y alejan, 0 vuelve a todo.
   */
  zoom?: boolean | ZoomOptions;
  /**
   * Se llama al cambiar el zoom con el primer y el último dato visibles (en valores de X), o null
   * si se ve todo, y con la ventana exacta en fracciones del eje (`{ start: 0, end: 1 }` al ver todo).
   */
  onZoom?: (range: [string | number, string | number] | null, window: ZoomWindow) => void;
  /**
   * Se llama cuando el puntero o el teclado activan un dato, con su X (texto de la categoría,
   * o número: fecha en ms o valor), y con null al salir. Junto con highlight() sincroniza gráficos.
   * También recibe el índice de la fila (−1 al salir), que identifica el dato aunque la X no lo
   * haga (una celda de un mapa de calor), y la serie, como en onClick.
   */
  onHover?: (x: string | number | null, index: number, series: string | null) => void;
  /**
   * Se llama al hacer clic en un dato, o al pulsar Enter o Espacio con un dato activo desde el
   * teclado. Recibe la X (como onHover; null en un dato que no es una fila, como un nodo interior),
   * el índice de la fila y el nombre de la serie del dato: la que está bajo el puntero, o la que
   * se recorre con el teclado en un gráfico sin ejes; null si el dato es de todas las series (el
   * índice de un crosshair).
   */
  onClick?: (x: string | number | null, index: number, series: string | null) => void;
  /**
   * Datos seleccionados, por su índice de fila (el que dan onClick y onHover): se ven como siempre y
   * los demás quedan atenuados. Vacío o null: sin selección. Ver también select().
   */
  selection?: readonly number[] | null;
}

/** Cambios para setOptions: cualquier opción, y del eje X solo lo que cambia. */
export type LozChartUpdate = Omit<Partial<LozChartOptions>, 'xAxis'> & { xAxis?: Partial<XAxisOptions> };

/** Small multiples: una cuadrícula de gráficos pequeños con escalas compartidas. */
export interface MultiplesOptions extends Omit<
  LozChartOptions,
  'onHover' | 'onClick' | 'orientation' | 'zoom' | 'onZoom' | 'emphasis'
> {
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
  /**
   * Con `facet: 'series'`: cada panel muestra también las demás series en gris, detrás de la
   * suya, para comparar su forma con el resto sin perder la limpieza de un panel por serie.
   */
  context?: boolean;
}

/** Cambios para setOptions de small multiples. */
export type MultiplesUpdate = Omit<Partial<MultiplesOptions>, 'xAxis'> & { xAxis?: Partial<XAxisOptions> };
