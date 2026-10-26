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
import type { Localized } from './i18n';

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
  /** Columnas de texto que pidió el tipo de serie (ver SeriesImpl.texts); vacío es ''. */
  texts: Record<string, string[]>;
  /** Grupo de apilado, o null. */
  stackKey: string | null;
  /** Eje del valor: el izquierdo, o el derecho (yAxis2). */
  axis: 'left' | 'right';
  /**
   * Idioma del gráfico, para los textos que un tipo arma al leer los datos, antes de dibujar (los
   * avisos de consola, el nombre de un grupo vacío). Ausente equivale al de la página.
   */
  locale?: string;
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

/**
 * Para qué se dibuja: 'screen' (el gráfico en la página), 'export' (toSVG y las descargas en PNG o
 * SVG: un archivo suelto, sin interacción ni nada que dependa de la página) u 'overview' (el mini
 * gráfico de la barra del zoom: todos los datos en unos 28 px de alto, en el gris de contexto y
 * con `theme.surface` transparente; ahí las etiquetas y los detalles sobran).
 */
export type DrawPurpose = 'screen' | 'export' | 'overview';

/*
 * Los campos opcionales de DrawContext y TooltipFormat siempre llegan desde el núcleo: son
 * opcionales para que los contextos armados a mano (en las pruebas de un tipo) sigan valiendo.
 */

export interface DrawContext {
  frame: SeriesFrame;
  /** Para qué se dibuja (ver DrawPurpose). Ausente equivale a 'screen'. */
  purpose?: DrawPurpose;
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
  /** Escala del valor. Con yAxis.type: 'log' es una LogScale, con la misma interfaz. */
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
  /**
   * Idioma del gráfico (la opción locale), para fechas y números con Intl y para los textos, con
   * messages(locale) de core/i18n. Ausente equivale al de la página (o inglés).
   */
  locale?: string;
  /** Moneda ISO del gráfico (la opción currency). */
  currency?: string;
  /**
   * Los contextos de las series visibles del mismo tipo en este cuadro, en el orden de `series` (esta
   * incluida): para lo que varias series lado a lado deben decidir juntas, como si llevan etiquetas.
   */
  siblings?(): DrawContext[];
  /**
   * ¿El dato i queda atenuado? Con una selección (la opción selection o select()), todo lo que no
   * está en ella; sin selección, nada. Los tipos con `dimmable` lo aplican con dimOpacity.
   */
  isDimmed?(i: number): boolean;
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
  /**
   * Idioma del gráfico (la opción locale), para fechas y números con Intl y para los textos, con
   * messages(locale) de core/i18n. Ausente equivale al de la página (o inglés).
   */
  locale?: string;
  /** Moneda ISO del gráfico (la opción currency). */
  currency?: string;
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
  /**
   * Cómo se llaman sus datos en la descripción accesible: ['etapa', 'etapas'], uno por idioma
   * (`{ es: ['etapa', 'etapas'], en: ['stage', 'stages'] }`) o una función del locale. Por defecto,
   * puntos. Los del catálogo de idiomas (`types.<nombre>.items`) mandan sobre este.
   */
  items?: Localized<readonly [singular: string, plural: string]>;
  /**
   * Índice del dato bajo el punto (px, py), o -1. En 'free', px del área; en 'cartesian', del plano
   * lógico (px a lo largo del eje del índice y del eje del valor, como dibuja la serie), así vale en
   * las dos orientaciones. En cartesiano, si ninguna serie con `hit` encuentra un dato, el puntero
   * sigue como siempre (el índice más cercano), salvo que todas las series visibles tengan `hit`.
   */
  hit?(ctx: DrawContext, px: number, py: number): number;
  /**
   * Clic en el dato i (o Enter o Espacio con el dato activo desde el teclado). En 'free' y con `hit`
   * se llama a la serie bajo el puntero; si no, a cada serie visible que lo define. También se
   * llama a la opción onClick del gráfico.
   */
  click?(ctx: DrawContext, i: number, event: MouseEvent | KeyboardEvent): void;
  /**
   * Alto que pide la serie para el gráfico (ejes incluidos), en px, según el ancho disponible: una
   * línea de tiempo con muchos carriles o un Gantt con muchas tareas. Se usa solo si el usuario no
   * dio `height`; con varias series, el mayor. undefined: el alto por defecto.
   */
  preferredHeight?(ps: PreparedSeries, width: number): number | undefined;
  /**
   * Con `derive`: cómo se llama el valor calculado ('acumulado'). Si el nombre de la serie coincide
   * con el de un campo que también se exporta, toCSV titula así la columna del valor: "monto
   * (acumulado)" junto a "monto". Un texto, uno por idioma o una función del locale, como `label`.
   * Por defecto 'valor' en el idioma del gráfico. El del catálogo
   * (`types.<nombre>.derived`) manda sobre este.
   */
  derivedName?: Localized<string>;
  /** En 'free': dónde apoyar el tooltip del dato i (px del área). */
  anchor?(ctx: DrawContext, i: number): [number, number] | null;
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
  /**
   * Admite etiqueta al final (opción endLabels): series que terminan en un punto a la derecha,
   * como líneas, áreas y escalones. Se ubica en la punta (y1) del último dato visible.
   */
  endLabel?: boolean;
  /** Muestra en leyenda: cuadrado (barras, áreas), trazo (líneas) o punto (dispersión). */
  legendSymbol?: 'line' | 'square' | 'dot';
  /**
   * Nombre para la descripción accesible ("barras", "líneas"…): un texto, uno por idioma
   * (`{ es: 'barras', en: 'bar chart', pt: 'barras' }`) o una función del locale. El del catálogo
   * (`types.<nombre>.label`, ver LozChart.registerLocale) manda sobre este.
   */
  label?: Localized<string>;
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
  /**
   * Columnas de texto que lee de cada fila, como { nombre: campo }: categorías que no son la X,
   * como la fila de un mapa de calor o el destino de un sankey. Quedan en `ps.texts`. `xField`
   * es el campo de la X, por si también se lo quiere como texto (el origen de un sankey).
   */
  texts?(options: SeriesOptions, xField: string): Record<string, string | undefined>;
  /**
   * Valores del eje calculados con la serie completa, en lugar de los leídos: una cascada pone el
   * acumulado de cada fila. Se llama al preparar, antes de apilar y de calcular el dominio; lo
   * leído sigue disponible si el tipo lo pide también como columna.
   */
  derive?(ps: PreparedSeries): number[];
  /**
   * En 'free': el dato al que lleva una flecha desde el dato i ('ArrowDown'…), para recorridos en
   * dos dimensiones (en un mapa de calor, ↓ va a la fila siguiente). undefined: el recorrido lineal.
   */
  step?(ps: PreparedSeries, i: number, key: string): number | undefined;
  /**
   * Encabezado del tooltip y de la descripción del dato i, en lugar del texto de la X
   * ("Lima → Bogotá"). `x` es ese texto, por si se quiere usar; `locale`, el idioma del gráfico.
   */
  headline?(ps: PreparedSeries, i: number, x: string, locale?: string): string;
  /** Valores fijos que también deben caber en el eje (por ejemplo, la meta de un gauge). */
  domainValues?(options: SeriesOptions): number[];
  /** Columnas que están en unidades del eje Y: cuentan para el dominio y se encogen al ocultarse. */
  valueColumns?: readonly string[];
  /**
   * El tipo atenúa por su cuenta los datos fuera de la selección (con ctx.isDimmed y dimOpacity).
   * Sin esto, el núcleo deja la serie como está y marca los seleccionados con `hover`.
   */
  dimmable?: boolean;
  /** Markup SVG de la serie. */
  draw(ctx: DrawContext): string;
  /** Marcas de hover en el índice i (puntos, por ejemplo). */
  hover?(ctx: DrawContext, i: number): string;
  /** Texto del tooltip en el índice i, si no basta con el valor principal formateado. */
  tooltip?(ps: PreparedSeries, i: number, format: TooltipFormat): TooltipValue | null;
  /**
   * Color de la muestra del tooltip en el índice i (también en los virtuales, desde n), para los
   * tipos en los que cada dato tiene su propio color: la rama de un sunburst, el grupo de un
   * treemap, el nodo de origen de un sankey. Recibe el mismo contexto que draw y debe salir de la
   * misma función con la que se pinta el dato: así la muestra nunca se desincroniza del dibujo.
   * null o ausente: el color de la serie (o el de la categoría, con legendBy: 'points').
   */
  swatch?(ctx: DrawContext, i: number): string | null;
}

/** Color de la muestra del índice i: el del dato si el tipo lo da; si no, el de la serie o la categoría. */
export function swatchOf(ctx: DrawContext, i: number): string {
  const impl = ctx.frame.ps.impl;
  return impl.swatch?.(ctx, i) ?? (impl.legendBy === 'points' ? ctx.pointColor(i) : ctx.color);
}

/**
 * Opacidad de un dato fuera de la selección: el dato se sigue viendo como contexto y la diferencia
 * es de claridad, no de tono, así que no depende de distinguir colores.
 */
export const DIM_OPACITY = 0.25;

/** Opacidad del dato i: DIM_OPACITY si está atenuado; undefined si se ve normal (para attrs()). */
export function dimOpacity(ctx: DrawContext, i: number): number | undefined {
  return ctx.isDimmed?.(i) ? DIM_OPACITY : undefined;
}

/**
 * Dibuja una serie en dos pasadas cuando hay datos atenuados: primero los atenuados, en un grupo
 * con DIM_OPACITY, y encima los demás. `paint(include)` arma el markup solo de los índices para los
 * que `include(i)` es verdadero; sin selección se llama una vez con todos. Sirve a los tipos que
 * juntan sus marcas en un solo trazo (todas las barras en un path).
 */
export function paintDimmed(ctx: DrawContext, paint: (include: (i: number) => boolean) => string): string {
  const dimmed = ctx.isDimmed;
  let any = false;
  if (dimmed) for (let i = 0; i < ctx.n && !any; i++) any = dimmed(i);
  if (!dimmed || !any) return paint(() => true);
  const faded = paint((i) => dimmed(i));
  return (faded ? `<g opacity="${DIM_OPACITY}">${faded}</g>` : '') + paint((i) => !dimmed(i));
}

/** El markup del dato i, en un grupo con DIM_OPACITY si está atenuado. */
export function dimmed(ctx: DrawContext, i: number, markup: string): string {
  return markup && ctx.isDimmed?.(i) ? `<g opacity="${DIM_OPACITY}">${markup}</g>` : markup;
}
