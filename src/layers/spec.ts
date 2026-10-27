/**
 * Gráficos por capas: un gráfico descrito como una pila de capas, cada una con una marca (celda,
 * texto, ícono, punto, barra, línea, regla o enlace) cuyos canales (x, y, color, ícono…) salen de
 * las filas de los datos. Es JSON puro: se puede escribir a mano, guardar o generar.
 *
 * Tres clases de valores, según el canal:
 * - Posiciones y números (x, y, x2, y2, lon, lat, size, node, from, to, group): una expresión. Lo
 *   más simple es el nombre de un campo ("ventas"); también "ventas - costos" o un número fijo.
 * - Textos (text, title, alt, label): una plantilla. "{valor} %" escribe el campo; lo que no
 *   está entre llaves es texto tal cual.
 * - Color e ícono: un valor fijo ("good", "#c0283f", "smile", "😀") o un objeto: una escala, una
 *   tabla (`map`) o una condición.
 *
 * Cualquier canal acepta una condición: { "if": "valor >= meta", "then": …, "else": … }.
 */
import type { FormatSpec, ThemeName } from '@lozcharts/core';

/** Una expresión: "valor", "valor - meta", "abs(delta) > 2 and zona == 'Costa'", o un número fijo. */
export type Expr = string | number;

/** Una plantilla de texto: "{valor} de {meta}". */
export type Template = string | number;

/** Una condición: si `if` es verdadera vale `then`; si no, `else` (o nada). Se pueden anidar. */
export interface Cond<T> {
  if: string;
  then: T | Cond<T>;
  else?: T | Cond<T>;
}

/** Una tabla de valores: el resultado de `field` se busca en `map`; si no está, `other`. */
export interface Mapping<T> {
  field: string;
  map: Record<string, T>;
  other?: T;
}

/**
 * Un color: un nombre del tema (good, warn, bad, violet, pink, ochre, wine, green, sky, coral, teal,
 * text, muted, grid), un lugar de la paleta del 1 al 8 o un #hex o rgb().
 */
export type ColorName = string | number;

/** Escala de color calculada con los datos. */
export interface ColorScale {
  /** El valor que se colorea (una expresión). */
  field: string;
  /**
   * 'traffic-light' (semáforo: rojo, ámbar y verde del tema; por defecto), 'sequential' (un tono, del claro al color de la
   * serie) o 'diverging' (dos tonos alrededor del cero).
   */
  scale?: 'traffic-light' | 'sequential' | 'diverging';
  /**
   * Con qué se compara cada valor: 'all' (todos los datos, por defecto), 'row' (los de su fila: la
   * misma y) o 'column' (los de su columna: la misma x). Así una fila con números más altos no
   * deja a las demás en un solo color.
   */
  by?: 'all' | 'row' | 'column';
  /** Para el semáforo: si lo bueno es lo alto ('high', por defecto) o lo bajo ('low', como las fallas). */
  better?: 'high' | 'low';
  /** Cortes fijos en lugar de una escala continua: [90, 95] da tres tramos (malo, regular, bueno). */
  thresholds?: number[];
  /** Mínimo y máximo fijos de la escala (por defecto, los de los datos). */
  domain?: [number, number];
  /** Leyenda arriba a la derecha. Por defecto true. */
  legend?: boolean;
}

export type ColorValue = ColorName | ColorScale | Mapping<ColorName> | Cond<ColorName | ColorScale | Mapping<ColorName>>;

/** Un ícono dibujado con un camino SVG propio (en una caja de 24 × 24, o la que diga viewBox). */
export interface PathIcon {
  path: string;
  /** Lado de la caja del dibujo. Por defecto 24. */
  viewBox?: number;
  /** Rellenar el camino en vez de trazarlo. Por defecto false. */
  filled?: boolean;
  /** Texto alternativo. */
  alt?: string;
}

/** Una imagen (una URL) como ícono. */
export interface ImageIcon {
  image: string;
  alt?: string;
}

/** Un ícono: el nombre de uno propio ('smile', 'alert', 'pin'…), un emoji, un camino o una imagen. */
export type IconName = string;
export type IconValue =
  | IconName
  | PathIcon
  | ImageIcon
  | { field: string }
  | Mapping<IconName | PathIcon | ImageIcon>
  | Cond<IconName | PathIcon | ImageIcon | Mapping<IconName>>;

/** Una posición o un número: una expresión, un valor fijo ({ "value": "Meta" }), una tabla o una condición. */
export type ExprValue =
  Expr | { value: string | number } | { field: string } | Mapping<Expr> | Cond<Expr | { value: string | number }>;
export type TemplateValue = Template | Cond<Template>;

/** Una entrada del tooltip: un campo, o una etiqueta con su valor (plantilla) y su formato. */
export type TooltipEntry = string | { label: string; value: string; format?: LayerFormat };

/** Formato de los números: los de la librería o las opciones de Intl.NumberFormat. */
export type LayerFormat = Exclude<FormatSpec, (value: number) => string> | Intl.NumberFormatOptions;

/** Dónde va una marca dentro de su celda o junto a su punto. */
export type Position = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type MarkName = 'cell' | 'text' | 'icon' | 'point' | 'bar' | 'line' | 'rule' | 'link' | 'spark';

export interface Layer {
  mark: MarkName;
  /** Datos de la capa: el nombre de una lista de `data`, o sus propias filas. Por defecto, los del gráfico. */
  data?: string | Record<string, unknown>[];
  /** Solo las filas para las que esta expresión es verdadera: "estado == 'falla'". */
  filter?: string;
  /** Nombre de la capa (para los avisos). */
  name?: string;

  x?: ExprValue;
  y?: ExprValue;
  x2?: ExprValue;
  y2?: ExprValue;
  /** En un mapa (`geo`): longitud y latitud. */
  lon?: ExprValue;
  lat?: ExprValue;
  /** En una red (`network`): el nodo donde va la marca. En la lista de nodos, por defecto el suyo. */
  node?: ExprValue;
  /** Enlaces de una red: los dos extremos. Por defecto, los campos de `network.from` y `network.to`. */
  from?: ExprValue;
  to?: ExprValue;
  /** Líneas: una por cada valor de este campo. */
  group?: ExprValue;

  color?: ColorValue;
  icon?: IconValue;
  /** Tamaño en px (ícono, punto, letra, grosor de barra, de línea o de enlace) o un campo, que se escala. */
  size?: ExprValue;
  text?: TemplateValue;
  /** Texto alternativo del ícono para lectores de pantalla. Por defecto, el nombre del ícono. */
  alt?: TemplateValue;
  /** Encabezado del tooltip y de la tabla de datos. */
  title?: TemplateValue;
  /** Texto de una regla. */
  label?: TemplateValue;
  /** true: el tooltip con los campos que usa la capa; una lista: esas entradas; false: sin tooltip. */
  tooltip?: boolean | TooltipEntry[];
  format?: LayerFormat;

  position?: Position;
  dx?: number;
  dy?: number;
  opacity?: number;
  /** Texto: 'normal', 'bold' o un peso (400 a 800). */
  weight?: 'normal' | 'bold' | number;
  /** Línea: 'linear' o 'smooth'. */
  curve?: 'linear' | 'smooth';
  /** Línea: un punto en cada dato. */
  points?: boolean;
  /**
   * Minigráfico (`spark`): una línea pequeña por celda (misma x y misma y) con las filas de una serie
   * larga. `period` ordena los puntos (un mes, una semana) y `value` da su altura.
   */
  period?: ExprValue;
  value?: ExprValue;
  /** Minigráfico: relleno suave bajo la línea. */
  area?: boolean;
  /** Minigráfico: marcar el mínimo y el máximo (el último punto siempre va marcado). */
  extremes?: boolean;
  /** Regla y enlace: línea discontinua. */
  dash?: boolean | Cond<boolean>;
}

export interface AxisSpec {
  /** 'band' (categorías), 'linear' (números) o 'time' (fechas). Por defecto se deduce de los datos. */
  type?: 'band' | 'linear' | 'time';
  /** Orden fijo de las categorías, o mínimo y máximo de un eje numérico. */
  domain?: (string | number)[];
  title?: string;
  format?: LayerFormat;
  /** Dónde van las etiquetas: 'bottom' o 'top' (x), 'left' o 'right' (y), o false para ninguna. */
  axis?: 'bottom' | 'top' | 'left' | 'right' | false;
  /** Incluir el cero en un eje numérico (las barras ya lo incluyen). */
  zero?: boolean;
  /** Categorías más anchas que las demás: { "Racha": 3 } (una columna de resumen junto a los días). */
  widths?: Record<string, number>;
}

export interface GeoSpec {
  /** Nombre del mapa registrado. Por defecto 'mundo' (con @lozcharts/core/maps/world). */
  map?: string;
  /** 'data' (por defecto) encuadra los puntos; 'all', el mapa entero. */
  fit?: 'data' | 'all';
  projection?: 'equalEarth' | 'mercator';
}

export interface NetworkSpec {
  /** Lista de nodos (nombre en `data`) y su campo identificador. */
  nodes: string;
  id?: string;
  /** Lista de enlaces y sus campos de origen y destino. */
  links: string;
  from?: string;
  to?: string;
}

export interface DataTransform {
  rows?: Record<string, unknown>[];
  from?: string;
  fold?: string[];
  as?: [string, string];
}

export interface LayerSpec {
  title?: string;
  subtitle?: string;
  /** Descripción para lectores de pantalla. Por defecto se arma con el título. */
  description?: string;
  /** Nombre de los valores en el tooltip y en la tabla de datos. */
  name?: string;
  locale?: string;
  currency?: string;
  theme?: ThemeName;
  height?: number;
  animate?: boolean;
  /** Pinta el fondo con la superficie del tema. Por defecto true; false toma el de la página. */
  background?: boolean;
  /**
   * Filas (una lista) o varias listas con nombre ({ "sitios": [...], "enlaces": [...] }). Una lista
   * con nombre también puede armarse de otra o pasar de ancho a largo: { "from": "red", "fold":
   * ["W31", "W32"], "as": ["semana", "valor"] } (o { "rows": [...], "fold": … }).
   */
  data?: Record<string, unknown>[] | Record<string, Record<string, unknown>[] | DataTransform>;
  layers: Layer[];
  scales?: { x?: AxisSpec; y?: AxisSpec };
  /** Un mapa de fondo: las marcas se ubican con lon y lat. */
  geo?: GeoSpec;
  /** Una red: los nodos se ubican solos y los enlaces los unen. */
  network?: NetworkSpec;
}

/** Un problema encontrado en la especificación: dónde (layers[1].icon.if), qué, y si impide dibujar esa parte. */
export interface LayerProblem {
  path: string;
  message: string;
  level: 'error' | 'warning';
}
