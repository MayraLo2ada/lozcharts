/**
 * LozChart: el núcleo.
 *
 * Ciclo de render:
 *   opciones → prepare()    datos ordenados y series con su posición en la paleta
 *            → buildFrame() cuadro destino: pilas y dominio del valor "bonito"
 *            → transition() interpola del cuadro visible al destino (600 ms, ease-out)
 *            → draw()       escalas, rejilla, ejes y cada serie con su plugin
 *
 * Las series dibujan en un plano lógico (índice → X, valor → Y). En horizontal, ese plano
 * se refleja sobre su diagonal; la rejilla, los ejes y el tooltip sí conocen la orientación.
 * La lógica de datos vive en core/ y es pura; esta clase maneja estado, DOM y eventos.
 */
import type {
  Datum,
  FormatSpec,
  LozChartOptions,
  LozChartUpdate,
  MultiplesOptions,
  ThemeName,
  XValue,
  ZoomWindow,
} from './types';
import type { LozMultiples } from './multiples';
import {
  swatchOf,
  type DrawContext,
  type DrawPurpose,
  type PolarPlane,
  type PreparedSeries,
  type SeriesFrame,
  type SeriesImpl,
  type TooltipFormat,
  type TooltipValue,
} from './core/series';
import { injectStyles, LIGHT, MAX_COLORS, resolveTheme, themeVars, type Theme } from './core/theme';
import { BandScale, ContinuousScale, LinearScale, LogScale, type XScale } from './core/scales';
import { clampView, FULL_VIEW, isFull, minSpan, panView, visibleIndices, zoomView, type View } from './core/view';
import { logTicks, niceDomain, niceStep, numberTicks } from './core/ticks';
import { axisFormatter, indexFormatter, parseTime, valueFormatter, type NumberContext } from './core/format';
import { prepare, toNumber, type Prepared } from './core/prepare';
import { buildFrame, collapse, interpolate, withExits, type Frame } from './core/frame';
import { fitText, indexLabels, xLabel, xTicks, type XLabelContext } from './core/axis';
import { attrs, esc, html, prefersReducedMotion, resolveElement, svg, textWidth } from './core/dom';
import { polarPoint } from './core/shapes';
import { Legend, legendSVG, type LegendItem } from './core/legend';
import { downloadCSV, downloadImage, slug, toCSV } from './core/export';
import { destroyDetached, destroyWithin, mount, mountedOn, unmount } from './core/mount';
import { annotationValues, renderAnnotations } from './core/annotations';
import { registerMap, type MapSource } from './core/geo';
import { spreadLabels } from './core/labels';
import { ZoomGestures } from './zoom';
import { Scrollbar, SCROLLBAR_HEIGHT } from './scrollbar';

const registry = new Map<string, SeriesImpl>();
let uid = 0;

const DURATION = 600;
const FONT_SIZE = 12;
/** Alto que ocupan las etiquetas del eje X bajo el área de datos. */
export const X_LABEL_SPACE = FONT_SIZE + 12;
/** Respiro mínimo del área de datos contra el borde, cuando no hay etiquetas. */
export const AXIS_GAP = 8;
/** El valor base de un índice: su línea se marca como referencia. */
const INDEX_BASE = 100;
/** Margen del recorte del área de datos: deja respirar trazos y puntos en el borde. */
const CLIP_PAD = 6;
/** Espacio aproximado por tick del eje del valor: vertical y horizontal. */
const TICK_SPACING_V = 56;
const TICK_SPACING_H = 96;
/** Lo que ocupan aprox. los ejes y márgenes de un gráfico vertical, para estimar el largo del eje. */
const AXIS_ALLOWANCE = 40;
/** Las etiquetas de categorías en horizontal ocupan como máximo esta fracción del ancho. */
const MAX_LABEL_SHARE = 0.4;
/** Reflejo sobre la diagonal: (x, y) → (y, x). Gira el plano lógico para el modo horizontal. */
const SWAP_AXES = 'matrix(0 1 1 0 0 0)';
const EXPORT_PAD = 16;
/** Filas de la tabla oculta para lectores de pantalla; el resto, en el CSV. */
const MAX_TABLE_ROWS = 500;
/** Duración de la animación del eje del valor al cambiar el zoom: corta, para seguir al gesto. */
const ZOOM_DURATION = 220;
/** Etiquetas al final de las líneas: espacio entre el área y la marca, largo de la marca y su texto. */
const END_GAP = 8;
const END_MARK = 10;
const END_TEXT = 6;
/** Las etiquetas al final ocupan como máximo esta fracción del ancho. */
const MAX_END_SHARE = 0.3;
/** El área de datos ocupa al menos esta fracción del ancho aunque haya etiquetas al final. */
const MIN_PLOT_SHARE = 0.5;
/** Si no cabe este ancho (o la etiqueta completa, si es más corta), las etiquetas al final no se muestran. */
const MIN_END_WIDTH = 56;

/** Alto del gráfico si no se da `height` ni lo pide el tipo de serie. */
const DEFAULT_HEIGHT = 320;
/** Un puntero que se movió más que esto entre presionar y soltar arrastró: no es un clic. */
const CLICK_SLOP = 4;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Layout {
  width: number;
  height: number;
  left: number;
  top: number;
  /** Tamaño del área de datos en pantalla. */
  plotW: number;
  plotH: number;
  horizontal: boolean;
  /** Mostrar los números del eje del valor. */
  valueLabels: boolean;
  /** Ancho natural de los números del eje Y (sin el mínimo de yAxis.width). */
  labelWidth: number;
  /** Largo del eje del índice y del eje del valor (el plano lógico). */
  indexLen: number;
  valueLen: number;
  x: XScale;
  valueTicks: number[];
  valueFormat: (v: number) => string;
  /** Eje derecho (vacío si no hay). */
  rightTicks: number[];
  rightFormat: (v: number) => string;
  /** Centro, radio y ángulos del radar; los puntos se ubican por cuadro (ver polarPlane). */
  polar?: PolarFrame;
  /** Etiquetas al final: dónde empiezan (px desde el área) y cuánto miden como máximo; null si no hay. */
  endLabels: { x: number; width: number } | null;
  font: string;
}

type PolarFrame = Omit<PolarPlane, 'point'>;

/** Recuadro de un texto en px, para evitar que dos etiquetas se encimen. */
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

interface Row {
  s: PreparedSeries;
  v: number;
  text: TooltipValue;
}

type Normalized = LozChartOptions &
  Required<Pick<LozChartOptions, 'theme' | 'height' | 'tooltip' | 'animate' | 'locale' | 'currency' | 'background'>>;

function normalize(o: LozChartOptions): Normalized {
  return {
    ...o,
    data: Array.isArray(o.data) ? o.data : [],
    series: Array.isArray(o.series) ? o.series : [],
    theme: o.theme ?? 'auto',
    height: o.height ?? DEFAULT_HEIGHT,
    tooltip: o.tooltip ?? true,
    animate: o.animate ?? true,
    locale: o.locale ?? 'es',
    currency: o.currency ?? 'USD',
    background: o.background ?? true,
  };
}

export class LozChart {
  // ------------------------------------------------------------ API estática

  /** Registra un tipo de serie. Agregar un tipo nuevo no toca el núcleo. */
  static registerSeries(name: string, impl: SeriesImpl): void {
    registry.set(name, impl);
  }

  /**
   * Registra un mapa (TopoJSON o GeoJSON) con un nombre, para las series 'choropleth' y
   * 'mapbubble'. El del mundo se registra solo al cargar 'lozcharts/maps/world' como 'mundo'.
   */
  static registerMap(name: string, source: MapSource): void {
    registerMap(name, source);
  }

  /** Tipos de serie registrados. */
  static get seriesTypes(): string[] {
    return [...registry.keys()];
  }

  /**
   * Crea small multiples: una cuadrícula de gráficos pequeños con escalas compartidas.
   * Lo conecta index.ts, así el núcleo no depende del módulo de multiples.
   */
  static multiples: (target: string | HTMLElement, options: MultiplesOptions) => LozMultiples;

  /** El gráfico (o los small multiples) montado en un elemento, si hay. */
  static getChart(target: string | HTMLElement): LozChart | LozMultiples | undefined {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    return el ? (mountedOn(el) as LozChart | LozMultiples | undefined) : undefined;
  }

  /**
   * Monta todos los elementos `[data-lozchart]` dentro de `root`. El atributo lleva las
   * opciones en JSON o el selector de un <script type="application/json">.
   * Pensado para HTMX: `htmx.onLoad((el) => LozChart.initAll(el))`.
   * Si un elemento ya tenía gráfico, lo reemplaza; y libera los que salieron de la página.
   * Con `facet` en las opciones crea small multiples.
   */
  static initAll(root: ParentNode = document): (LozChart | LozMultiples)[] {
    LozChart.cleanup();
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-lozchart]')];
    if (root instanceof HTMLElement && root.hasAttribute('data-lozchart')) nodes.unshift(root);
    const charts: (LozChart | LozMultiples)[] = [];
    for (const el of nodes) {
      const raw = el.getAttribute('data-lozchart')!.trim();
      try {
        const json = raw.startsWith('{') ? raw : (document.querySelector(raw)?.textContent ?? '');
        const options = JSON.parse(json) as LozChartOptions | MultiplesOptions;
        charts.push('facet' in options && options.facet ? LozChart.multiples(el, options) : new LozChart(el, options));
      } catch (err) {
        console.error(
          'LozCharts: no pude leer las opciones de data-lozchart; revisa que sean un JSON válido o el selector de un <script>.',
          el,
          err,
        );
      }
    }
    return charts;
  }

  /** Destruye los gráficos dentro de `root` (por ejemplo, en htmx:beforeSwap). */
  static destroyAll(root: ParentNode = document): void {
    destroyWithin(root);
  }

  /** Destruye los gráficos cuyo elemento ya no está en el documento. */
  static cleanup(): void {
    destroyDetached();
  }

  // ------------------------------------------------------------ Estado

  readonly element: HTMLElement;
  private opts: Normalized;
  private readonly hidden = new Set<string>();
  /** Categorías ocultas en los tipos con leyenda por categorías (por su texto, sobrevive a setData). */
  private readonly hiddenPoints = new Set<string>();
  /** Índices de las categorías ocultas, calculados una vez por actualización (no por cuadro). */
  private hiddenIdx = new Set<number>();
  /** Layout del último dibujo: depende del destino, del ancho y del zoom, no de cada cuadro. */
  private layoutCache: { width: number; target: Frame; view: View; L: Layout } | null = null;
  private prepared!: Prepared;
  private target!: Frame;
  /** Con zoom: el cuadro de todos los datos (sin ajustar el eje a la ventana), para el mini gráfico. */
  private fullTarget: Frame | null = null;
  /** Ventana visible del eje X (ver core/view.ts). */
  private view: View = FULL_VIEW;
  /** `zoom.range` aún sin aplicar: al crear el gráfico o al cambiar `zoom` (aunque falten datos). */
  private rangePending = true;
  /** Si el zoom estaba disponible en la última actualización (cambia con los datos). */
  private zoomWas = false;
  /** Lo último que se dibujó en el mini gráfico, para no rehacerlo en cada cuadro. */
  private miniKey: { target: Frame; width: number; theme: Theme } | null = null;
  /** Cuadro en pantalla (intermedio si hay animación). */
  private current: Frame | null = null;
  private anim: { from: Frame; to: Frame; start: number } | null = null;
  private raf = 0;
  private layout: Layout | null = null;
  private width = 0;
  /** Índice bajo el puntero o el teclado (-1: ninguno). */
  private active = -1;
  /** Posición del puntero dentro del SVG; -1 si se llegó con el teclado. */
  private pointer = { x: -1, y: -1 };
  /** La serie del dato bajo el puntero, cuando se sabe (la más cercana, o la que respondió a `hit`). */
  private pointerSeries: PreparedSeries | null = null;
  /** ¿El dato activo lo marcó highlight()? Entonces no hay tooltip ni marcas del puntero todavía. */
  private highlighted = false;
  /** Con highlight() de varios datos: los que se marcan además del activo. */
  private extraMarks: number[] = [];
  /** Lo último que se avisó a onHover (índice y serie), para avisar solo los cambios. */
  private hovered: { i: number; series: PreparedSeries | null } = { i: -1, series: null };
  /** Índices de la selección (opción selection), o null sin selección. */
  private selectedIdx: Set<number> | null = null;
  /** Dónde se presionó el puntero (px de la pantalla), para distinguir un clic de un arrastre. */
  private pressedAt: { x: number; y: number } | null = null;
  /** El alto que dio el usuario, si lo dio: manda sobre el que pida el tipo de serie. */
  private explicitHeight: number | undefined;
  private theme: Theme = LIGHT;
  private destroyed = false;

  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly legend = new Legend((key) => this.toggleSeries(key));
  private readonly plotEl: HTMLDivElement;
  private readonly svgEl: SVGSVGElement;
  private readonly gPlot: SVGGElement;
  private readonly gGrid: SVGGElement;
  /** Plano lógico de las series: se refleja en horizontal. */
  private readonly gData: SVGGElement;
  private readonly gBand: SVGGElement;
  private readonly gSeries: SVGGElement;
  private readonly gHover: SVGGElement;
  /** Líneas de referencia y sus textos, encima de las series. */
  private readonly gNotes: SVGGElement;
  private readonly gAxes: SVGGElement;
  /** Tramo que se marca al arrastrar para hacer zoom, y su texto ("mar – jun"). */
  private readonly selRect: SVGRectElement;
  private readonly selLabel: SVGTextElement;
  private readonly overlay: SVGRectElement;
  private readonly clipRect: SVGRectElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly tableEl: HTMLTableElement;
  private readonly liveEl: HTMLDivElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly scrollbar: Scrollbar;
  private readonly gestures: ZoomGestures;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly colorScheme: MediaQueryList | null;

  constructor(target: string | HTMLElement, options: LozChartOptions) {
    this.element = resolveElement(target);
    mount(this);
    injectStyles(document);
    this.opts = normalize(options);
    this.explicitHeight = options.height;

    const clipId = `lc-clip-${++uid}`;
    this.root = html('div', { class: 'lc-root' });
    this.header = html('div', { class: 'lc-header' });
    this.plotEl = html('div', { class: 'lc-plot' });
    this.svgEl = svg('svg', { class: 'lc-svg', role: 'img', tabindex: 0 });
    this.clipRect = svg('rect', { x: -CLIP_PAD, y: -CLIP_PAD });
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(this.clipRect);
    const defs = svg('defs');
    defs.appendChild(clip);
    this.gPlot = svg('g', { 'aria-hidden': 'true' });
    this.gGrid = svg('g');
    this.gData = svg('g');
    this.gBand = svg('g', { 'clip-path': `url(#${clipId})` });
    this.gSeries = svg('g', { 'clip-path': `url(#${clipId})` });
    this.gHover = svg('g', { 'pointer-events': 'none' });
    this.gNotes = svg('g', { 'pointer-events': 'none' });
    this.gAxes = svg('g');
    this.selRect = svg('rect', { y: 0, 'pointer-events': 'none', visibility: 'hidden' });
    this.selLabel = svg('text', {
      'font-size': FONT_SIZE,
      'font-weight': 600,
      'text-anchor': 'middle',
      'dominant-baseline': 'hanging',
      'stroke-width': 3,
      'paint-order': 'stroke',
      'pointer-events': 'none',
      visibility: 'hidden',
    });
    this.overlay = svg('rect', { fill: 'transparent' });
    this.gData.append(this.gBand, this.gSeries, this.gHover);
    this.gPlot.append(this.gGrid, this.gData, this.gNotes, this.gAxes, this.selRect, this.selLabel, this.overlay);
    this.svgEl.append(defs, this.gPlot);
    this.tooltipEl = html('div', { class: 'lc-tooltip', 'aria-hidden': 'true' });
    this.resetBtn = html('button', { type: 'button', class: 'lc-zoom-reset' }, 'Ver todo');
    // Al volver a todo el botón se esconde: el foco pasa al gráfico en vez de perderse.
    this.resetBtn.addEventListener('click', () => {
      this.svgEl.focus();
      this.applyView(FULL_VIEW, true);
    });
    this.scrollbar = new Scrollbar({
      view: () => this.view,
      setView: (v, announce) => this.applyView(v, announce),
      minSpan: () => this.minSpan(),
      unit: () => 1 / Math.max(1, this.prepared.n - (this.prepared.band ? 0 : 1)),
      label: (f, edge) => this.labelAtFraction(f, edge),
    });
    this.plotEl.append(this.svgEl, this.tooltipEl);
    this.tableEl = html('table');
    const tableBox = html('div', { class: 'lc-sr-only' });
    tableBox.appendChild(this.tableEl);
    this.liveEl = html('div', { class: 'lc-sr-only', 'aria-live': 'polite' });
    this.root.append(this.header, this.plotEl, tableBox, this.liveEl);
    this.element.replaceChildren(this.root);

    this.gestures = new ZoomGestures(this.overlay, {
      enabled: () => this.zoomable,
      view: () => this.view,
      minSpan: () => this.minSpan(),
      plotBox: () => {
        const L = this.layout;
        return { left: this.svgEl.getBoundingClientRect().left + (L?.left ?? 0), width: L?.plotW ?? 0 };
      },
      setView: (v) => this.applyView(v, false),
      selection: (from: number | null, to?: number) => this.drawSelection(from, to),
      clearHover: () => this.clearActive(),
    });
    this.bindEvents();

    this.colorScheme = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.colorScheme?.addEventListener('change', this.onColorScheme);

    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(this.plotEl);
    this.width = Math.floor(this.plotEl.clientWidth);

    this.applyTheme();
    this.resetVisibility();
    this.rebuild(this.opts.animate);
  }

  // ------------------------------------------------------------ API pública

  /** Cambia los datos y anima desde lo que se ve en pantalla. */
  setData(data: Datum[]): this {
    const hadPoints = this.prepared.pointLegend;
    this.opts.data = Array.isArray(data) ? data : [];
    this.prepared = this.prepare();
    // En un pie, las categorías son la leyenda: si cambian los datos, cambian los botones.
    if (hadPoints || this.prepared.pointLegend) this.buildLegend();
    this.update(true);
    // Un indicador de un solo valor (un gauge): el cambio se anuncia a los lectores de pantalla.
    if (this.prepared.n === 1) this.liveEl.textContent = this.describe(0);
    return this;
  }

  /** Opciones vigentes, con los valores por defecto ya puestos. Para cambiarlas, setOptions. */
  get options(): Readonly<LozChartOptions> {
    return this.opts;
  }

  /** Cambia opciones (se combinan con las actuales) y redibuja, animando salvo que se pida lo contrario. */
  setOptions(options: LozChartUpdate, animate = true): this {
    const prev = this.opts;
    this.opts = normalize({
      ...prev,
      ...options,
      xAxis: { ...prev.xAxis, ...options.xAxis },
      yAxis: { ...prev.yAxis, ...options.yAxis },
    });
    if (options.series) this.resetVisibility();
    if ('height' in options) this.explicitHeight = options.height;
    this.applyTheme();
    // El zoom vuelve a su ventana inicial solo si la opción cambió de verdad: React y otros
    // frameworks mandan todas las opciones en cada cambio, y eso no debe perder la ventana actual.
    if ('zoom' in options && JSON.stringify(options.zoom) !== JSON.stringify(prev.zoom)) {
      this.view = FULL_VIEW;
      this.rangePending = true;
    }
    this.rebuild(animate);
    return this;
  }

  setTheme(theme: ThemeName): this {
    this.opts.theme = theme;
    this.refreshTheme();
    return this;
  }

  /**
   * Oculta o muestra una serie por su nombre (en un pie o un embudo, una categoría).
   * Las demás conservan su color.
   */
  toggleSeries(name: string, visible?: boolean): this {
    const set = this.prepared.pointLegend ? this.hiddenPoints : this.hidden;
    const show = visible ?? set.has(name);
    if (show) set.delete(name);
    else set.add(name);
    this.liveEl.textContent = `${show ? 'Ahora se ve' : 'Ya no se ve'} ${name}`;
    this.syncLegend();
    this.update(true);
    return this;
  }

  /**
   * Ancho que necesitan los números del eje Y con los datos actuales (sin contar yAxis.width).
   * Con el máximo de varios gráficos en yAxis.width, sus áreas de datos quedan alineadas.
   */
  get axisWidth(): number {
    return this.computeLayout(this.width || 600)?.labelWidth ?? 0;
  }

  /** Nombres de las series visibles. */
  get visibleSeries(): string[] {
    return this.prepared.series.filter((s) => !this.hidden.has(s.key)).map((s) => s.key);
  }

  /** SVG completo (título, subtítulo, gráfico y leyenda) como texto. `padding`: margen alrededor (16 px). */
  toSVG({ padding = EXPORT_PAD }: { padding?: number } = {}): string {
    return this.exportSVG(padding).markup;
  }

  /** Descarga el gráfico como PNG (al doble de resolución) o SVG, o sus datos como CSV. */
  download(type: 'png' | 'svg' | 'csv' = 'png', filename?: string): Promise<void> {
    const name = filename || slug(this.opts.title ?? '') || 'lozchart';
    if (type === 'csv') {
      downloadCSV(this.toCSV(), name);
      return Promise.resolve();
    }
    const { markup, width, height } = this.exportSVG();
    return downloadImage(markup, width, height, type, name);
  }

  /**
   * Los datos del gráfico como CSV: la X y el valor de cada serie, sin formato (números con punto
   * decimal, fechas en ISO), listos para una hoja de cálculo. Incluye todas las filas.
   */
  toCSV(): string {
    const p = this.prepared;
    const xField = this.opts.xAxis.field;
    // Cada serie con su valor y las columnas que lee de cada fila (el destino de un sankey, la
    // fila de un mapa de calor, el máximo de una vela), con el nombre de su campo.
    const cols: { name: string; at: (i: number) => string | number }[] = [];
    for (const s of p.series) {
      const values = s.raw ?? s.values;
      const extra: typeof cols = [];
      for (const [key, field] of Object.entries(s.impl.columns?.(s.options) ?? {}))
        if (field && s.columns[key]) extra.push({ name: field, at: (i) => s.columns[key][i] });
      for (const [key, field] of Object.entries(s.impl.texts?.(s.options, xField) ?? {}))
        if (field && field !== xField && s.texts[key]) extra.push({ name: field, at: (i) => s.texts[key][i] });
      // Una serie sin nombre propio se llama como su campo: si ese campo también va como columna
      // (la variación de una cascada, junto al acumulado), el valor dice qué es.
      const clash = extra.some((c) => c.name === s.name);
      cols.push({ name: clash ? `${s.name} (${s.impl.derivedName ?? 'valor'})` : s.name, at: (i) => values[i] });
      cols.push(...extra);
    }
    const rows: (string | number)[][] = [[this.opts.xAxis.title ?? xField, ...cols.map((c) => c.name)]];
    for (let i = 0; i < p.n; i++) {
      const x = p.xType === 'time' && isFinite(p.xNum[i]) ? new Date(p.xNum[i]).toISOString() : String(p.xRaw[i] ?? '');
      rows.push([x, ...cols.map((c) => c.at(i))]);
    }
    return toCSV(rows);
  }

  /**
   * Marca el dato cuya X vale `x` (sin tooltip), o varios con una lista, o limpia la marca con null.
   * Sirve para sincronizar el puntero entre varios gráficos (ver la opción onHover).
   */
  highlight(x: unknown): this {
    const list = Array.isArray(x) ? x : x === null || x === undefined ? [] : [x];
    return this.highlightIndex(list.map((v) => this.indexOfX(v)));
  }

  /**
   * Como highlight(), por índice de fila (el que dan onHover y onClick): marca datos que la X no
   * identifica, como una celda de un mapa de calor. null o una lista vacía limpian la marca.
   */
  highlightIndex(index: number | readonly number[] | null): this {
    // Valen las filas y los índices virtuales que recorre el teclado (los nodos interiores de un sunburst).
    const stops = new Set(this.navigable());
    const ok = (i: number) => Number.isInteger(i) && ((i >= 0 && i < this.prepared.n) || stops.has(i));
    const list = [...new Set(index === null ? [] : typeof index === 'number' ? [index] : index)].filter(ok);
    if (!list.length) {
      this.clearActive(false);
      return this;
    }
    this.active = list[0];
    this.extraMarks = list.slice(1);
    this.highlighted = true;
    this.tooltipEl.classList.remove('lc-show');
    if (this.current && this.layout) this.drawHover(this.current, this.layout);
    return this;
  }

  /** Índices seleccionados (ver la opción selection), en orden; vacío sin selección. */
  get selection(): number[] {
    return this.selectedIdx ? [...this.selectedIdx].sort((a, b) => a - b) : [];
  }

  /**
   * Selecciona datos por su índice de fila: se ven como siempre y los demás quedan atenuados. null o
   * una lista vacía quitan la selección. Se anuncia a los lectores de pantalla.
   */
  select(index: readonly number[] | null): this {
    this.opts.selection = index && index.length ? [...index] : null;
    this.syncSelection();
    this.liveEl.textContent = this.selectionText() || 'Ya no hay nada seleccionado';
    this.renderTable();
    this.svgEl.setAttribute('aria-label', this.ariaLabel());
    this.redraw();
    return this;
  }

  /**
   * Acerca el eje X a un tramo, en valores de X (categorías, fechas o números). Necesita la
   * opción `zoom`. Con barras, cada extremo incluye su categoría completa.
   */
  zoomTo(from: XValue, to: XValue): this {
    const a = this.fractionOf(from, 'start');
    const b = this.fractionOf(to, 'end');
    if (this.zoomable && a !== null && b !== null) this.applyView(clampView(a, b, this.minSpan()), false);
    return this;
  }

  /** Vuelve a mostrar todos los datos. */
  resetZoom(): this {
    if (!isFull(this.view)) this.applyView(FULL_VIEW, false);
    return this;
  }

  /** Primer y último dato visibles con zoom (como en onZoom), o null si se ve todo. */
  get zoomRange(): [string | number, string | number] | null {
    if (isFull(this.view)) return null;
    // Una ventana sobre un hueco de los datos no tiene puntos: se informan los vecinos.
    const r = this.visibleRange() ?? this.visibleRange(true);
    return r ? [this.xKey(r[0]), this.xKey(r[1])] : null;
  }

  /** Ventana exacta del zoom, en fracciones del eje X: `{ start: 0, end: 1 }` si se ve todo. */
  get zoomWindow(): ZoomWindow {
    return { start: this.view.start, end: this.view.end };
  }

  /**
   * Fija la ventana del zoom en fracciones del eje X, sin redondear a un dato: con la ventana que
   * da onZoom, otro gráfico con el mismo eje muestra exactamente el mismo tramo. null vuelve a todo.
   * Necesita la opción `zoom`; la ventana no queda más angosta que el mínimo del zoom.
   */
  setZoomWindow(window: ZoomWindow | null): this {
    if (!this.zoomable) return this;
    this.applyView(window ? clampView(window.start, window.end, this.minSpan()) : FULL_VIEW, false);
    return this;
  }

  /**
   * Vuelve a dibujar todo con el estado actual, sin animar ni releer los datos: para un tipo de
   * serie cuyo dibujo cambió por fuera de las opciones (una imagen que terminó de prepararse).
   */
  redraw(): this {
    if (this.destroyed) return this;
    this.layoutCache = null;
    this.miniKey = null;
    // Si hay una animación en curso, su próximo cuadro ya dibuja con todo recalculado.
    if (!this.anim) this.draw();
    if (this.active >= 0 && !this.highlighted) this.fillTooltip(this.active);
    return this;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.colorScheme?.removeEventListener('change', this.onColorScheme);
    this.root.remove();
    unmount(this);
  }

  // ------------------------------------------------------------ Datos y cuadros

  /** Series nuevas: arrancan visibles salvo las marcadas con `visible: false`. */
  private resetVisibility(): void {
    this.hidden.clear();
    this.hiddenPoints.clear();
    for (const s of this.opts.series) if (s.visible === false) this.hidden.add(s.name ?? s.field);
  }

  /** Opciones nuevas: título, leyenda y datos desde cero. */
  private rebuild(animate: boolean): void {
    this.prepared = this.prepare();
    this.renderHeader();
    this.buildLegend();
    this.update(animate);
  }

  private prepare(): Prepared {
    const { data, xAxis, series } = this.opts;
    const xType = xAxis.type ?? 'category';
    const index = this.opts.yAxis?.index;
    const rightAxis = !index && !this.horizontal;
    const input = { data, xField: xAxis.field, xType, series, index, band: xAxis.band, rightAxis };
    return prepare(input, registry, this.theme.palette.length);
  }

  private update(animate: boolean): void {
    if (this.destroyed) return;
    this.hiddenIdx = this.hiddenPointIndices();
    this.syncSelection();
    this.syncZoom();
    this.retarget(true);
    this.renderTable();
    this.svgEl.setAttribute('aria-label', this.ariaLabel());
    if (this.active >= this.prepared.n) this.clearActive();
    else if (this.active >= 0) this.fillTooltip(this.active);
    this.transition(animate && this.opts.animate);
  }

  /**
   * Cuadro destino con la ventana actual: con zoom, el eje del valor se ajusta a los datos que
   * se ven. Sin zoom es el cuadro de todos los datos.
   */
  private retarget(full: boolean): void {
    const ya = this.opts.yAxis;
    const ya2 = this.opts.yAxis2;
    const notes = this.opts.annotations;
    const build = (range?: [number, number]) =>
      buildFrame(
        this.prepared,
        this.hidden,
        {
          min: ya?.min,
          max: ya?.max,
          zero: ya?.zero,
          ticks: this.valueTickCount(),
          include: annotationValues(notes, 'left'),
          range,
          log: this.logScale,
        },
        { min: ya2?.min, max: ya2?.max, include: annotationValues(notes, 'right') },
        this.hiddenIdx,
      );
    const zoomed = this.zoomable && !isFull(this.view);
    // El cuadro de todos los datos (para el mini gráfico) cambia con los datos, no con la ventana.
    if (full || !this.fullTarget) this.fullTarget = this.zoomable ? build() : null;
    // Para el eje del valor cuentan también los vecinos de la ventana: la línea que sale por el
    // borde va hacia ellos y no debe salirse por arriba o por abajo.
    this.target = zoomed ? build(this.visibleRange(true) ?? undefined) : (this.fullTarget ?? build());
  }

  /**
   * El zoom depende de los datos (hacen falta 3 o más): si se activó o se apagó, el encabezado
   * cambia; la ventana se ajusta a la cantidad de datos, y `zoom.range` se aplica en cuanto se pueda.
   */
  private syncZoom(): void {
    const on = this.zoomable;
    if (on !== this.zoomWas) {
      this.zoomWas = on;
      this.renderHeader();
      this.root.classList.toggle('lc-zoomable', on);
    }
    if (!on) {
      this.view = FULL_VIEW;
      return;
    }
    this.view = clampView(this.view.start, this.view.end, this.minSpan());
    if (this.rangePending) {
      this.rangePending = false;
      this.initialZoom();
      // La ventana inicial también se avisa: quien escucha onZoom muestra el tramo desde el principio.
      if (!isFull(this.view)) this.opts.onZoom?.(this.zoomRange, this.zoomWindow);
    }
  }

  // ------------------------------------------------------------ Zoom

  /** El zoom funciona en gráficos cartesianos verticales con al menos 3 datos. */
  private get zoomable(): boolean {
    return !!this.opts.zoom && this.coords === 'cartesian' && !this.horizontal && this.prepared.n > 2;
  }

  private minSpan(): number {
    return minSpan(this.prepared.n, this.prepared.band);
  }

  /**
   * Índices que se ven en la ventana (con barras, toda banda que asoma). No dependen del ancho, así
   * que se miden en un eje de 1000 px. `neighbors` suma el dato de cada lado fuera de la ventana.
   */
  private visibleRange(neighbors = false): [number, number] | null {
    return visibleIndices(this.indexScale(1000), 1000, neighbors);
  }

  /** Fracción del eje X donde cae un valor de X; con barras, el borde pedido de su banda. */
  private fractionOf(x: XValue, edge: 'start' | 'end'): number | null {
    const p = this.prepared;
    if (!p.n) return null;
    if (p.band || p.xType === 'category') {
      const i = this.indexOfX(x);
      if (i < 0) return null;
      if (p.band) return (i + (edge === 'end' ? 1 : 0)) / p.n;
      return p.n > 1 ? i / (p.n - 1) : 0;
    }
    const scale = this.indexScale(1000, FULL_VIEW) as ContinuousScale;
    const v = p.xType === 'time' ? parseTime(x) : toNumber(x);
    return isFinite(v) ? Math.max(0, Math.min(1, scale.lin.map(v) / 1000)) : null;
  }

  /**
   * Texto de la X en una fracción del eje (para la barra de desplazamiento). En el fin de una
   * ventana se mira justo antes del borde: con barras, el borde es el comienzo de la banda siguiente.
   */
  private labelAtFraction(f: number, edge: 'start' | 'end'): string {
    const scale = this.indexScale(1000, FULL_VIEW);
    const px = Math.max(0, Math.min(999.999, f * 1000 + (edge === 'end' ? -1e-6 : 1e-6)));
    return xLabel(this.prepared, scale.indexAt(px), false, this.xContext());
  }

  /** La ventana de `zoom.range`, si la hay; si no, se ve todo. */
  private initialZoom(): void {
    const z = this.opts.zoom;
    const range = typeof z === 'object' ? z.range : undefined;
    if (!range) return;
    const a = this.fractionOf(range[0], 'start');
    const b = this.fractionOf(range[1], 'end');
    if (a !== null && b !== null) this.view = clampView(a, b, this.minSpan());
  }

  /**
   * Cambia la ventana: el eje X cambia al instante (sigue al gesto) y el del valor se acomoda a
   * lo visible con una animación corta.
   */
  private applyView(v: View, announce: boolean): void {
    const next = isFull(v) ? FULL_VIEW : v;
    if (Math.abs(next.start - this.view.start) < 1e-9 && Math.abs(next.end - this.view.end) < 1e-9) return;
    this.view = next;
    this.retarget(false);
    this.transition(this.opts.animate, ZOOM_DURATION);
    // La barra se actualiza ya (no en el próximo cuadro): sus controles anuncian el valor nuevo.
    if (this.scrollbar.el.isConnected) this.scrollbar.sync(next);
    const range = this.zoomRange;
    // Con el ratón o un gesto no se anuncia cada paso; tampoco queda un aviso viejo que ya no vale.
    this.liveEl.textContent = !announce
      ? ''
      : range
        ? `Ahora ves de ${this.labelAtFraction(next.start, 'start')} a ${this.labelAtFraction(next.end, 'end')}`
        : 'Ahora ves todos los datos';
    this.opts.onZoom?.(range, this.zoomWindow);
  }

  /** Acerca o aleja con el teclado alrededor del dato activo (o del centro). */
  private zoomByKey(factor: number): void {
    const L = this.layout;
    const focus = this.active >= 0 && L ? Math.max(0, Math.min(1, L.x.at(this.active) / L.plotW)) : 0.5;
    this.applyView(zoomView(this.view, focus, factor, this.minSpan()), true);
  }

  /** Si el teclado lleva a un dato fuera de la ventana, la ventana lo sigue. */
  private followActive(i: number): void {
    const L = this.layout;
    if (!L || isFull(this.view)) return;
    const pos = L.x.at(i);
    const margin = L.x.kind === 'band' ? L.x.bandwidth / 2 : 0;
    const span = this.view.end - this.view.start;
    let shift = 0;
    if (pos - margin < 0) shift = (pos - margin) / L.plotW;
    else if (pos + margin > L.plotW) shift = (pos + margin - L.plotW) / L.plotW;
    if (shift) this.applyView(panView(this.view, shift * span), false);
  }

  /** Muestra (o quita) el tramo que se marca al arrastrar. */
  private drawSelection(from: number | null, to?: number): void {
    const L = this.layout;
    if (from === null || to === undefined || !L) {
      this.selRect.setAttribute('visibility', 'hidden');
      this.selLabel.setAttribute('visibility', 'hidden');
      return;
    }
    // Con el color de foco, para no confundirla con una franja de las anotaciones, y con el tramo
    // en texto: se sabe a dónde se va a acercar antes de soltar.
    const color = this.theme.palette[0];
    const x0 = Math.min(from, to);
    const x1 = Math.max(from, to);
    attrsOn(this.selRect, {
      x: x0,
      width: x1 - x0,
      height: L.plotH,
      fill: color,
      'fill-opacity': 0.1,
      stroke: color,
      'stroke-opacity': 0.6,
      visibility: 'visible',
    });
    const a = xLabel(this.prepared, L.x.indexAt(x0), true, this.xContext());
    const b = xLabel(this.prepared, L.x.indexAt(x1), true, this.xContext());
    const text = a === b ? a : `${a} – ${b}`;
    const w = textWidth(text, L.font);
    const mid = Math.max(w / 2 + 2, Math.min(L.plotW - w / 2 - 2, (x0 + x1) / 2));
    this.selLabel.textContent = text;
    attrsOn(this.selLabel, { x: mid.toFixed(1), y: 6, fill: this.theme.text, stroke: this.theme.surface, visibility: 'visible' });
  }

  /** Índices válidos de la opción selection (los que existen en los datos), o null si no hay. */
  private syncSelection(): void {
    const sel = this.opts.selection;
    const valid = (sel ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < this.prepared.n);
    this.selectedIdx = valid.length ? new Set(valid) : null;
  }

  /** "Selección: 3 de 12 celdas", o '' sin selección. */
  private selectionText(): string {
    const sel = this.selectedIdx;
    if (!sel) return '';
    const items = this.itemWords();
    const n = this.prepared.n;
    return `Selección: ${sel.size} de ${n} ${n === 1 ? items[0] : items[1]}`;
  }

  /** Cómo se llaman los datos al contarlos: los del tipo, o categorías o puntos según el eje. */
  private itemWords(): readonly [string, string] {
    const p = this.prepared;
    const own = p.series[0]?.impl.items;
    if (own) return own;
    return p.pointLegend || (p.coords === 'cartesian' && p.xType === 'category')
      ? ['categoría', 'categorías']
      : ['punto', 'puntos'];
  }

  private hiddenPointIndices(): Set<number> {
    const out = new Set<number>();
    if (!this.prepared.pointLegend) return out;
    this.prepared.xRaw.forEach((x, i) => {
      if (this.hiddenPoints.has(String(x))) out.add(i);
    });
    return out;
  }

  /** Las series cartesianas tienen ejes; las polares (radar) y libres (pie, gauge, embudo), no. */
  private get coords(): 'cartesian' | 'polar' | 'free' {
    return this.prepared.coords;
  }

  private get horizontal(): boolean {
    return this.opts.orientation === 'horizontal';
  }

  /** Eje del valor logarítmico: solo en gráficos cartesianos. */
  private get logScale(): boolean {
    return this.opts.yAxis?.type === 'log' && this.coords === 'cartesian';
  }

  /** ¿El puntero recorre los datos? Solo `tooltip: false` lo apaga. */
  private get pointerOn(): boolean {
    return this.opts.tooltip !== false;
  }

  /** ¿Se muestra el recuadro flotante del tooltip? */
  private get floatOn(): boolean {
    const t = this.opts.tooltip;
    return t !== false && !(typeof t === 'object' && t.float === false);
  }

  /** ¿Se muestra "Ver todo" al acercar? */
  private get resetOn(): boolean {
    const z = this.opts.zoom;
    return this.zoomable && !(typeof z === 'object' && z.reset === false);
  }

  /** ¿Alguien escucha los clics: la opción onClick o un tipo de serie visible? */
  private get clickable(): boolean {
    return !!this.opts.onClick || this.prepared.series.some((s) => !this.hidden.has(s.key) && s.impl.click);
  }

  /**
   * Alto del gráfico con `width` px de ancho: el que dio el usuario; si no, el mayor que pidan las
   * series visibles (preferredHeight); si no, el de siempre.
   */
  private heightFor(width: number): number {
    if (this.explicitHeight !== undefined) return this.opts.height;
    let wanted = 0;
    for (const s of this.prepared.series) {
      if (this.hidden.has(s.key)) continue;
      const h = s.impl.preferredHeight?.(s, width);
      if (h !== undefined && isFinite(h) && h > wanted) wanted = h;
    }
    return wanted > 0 ? Math.round(wanted) : this.opts.height;
  }

  /**
   * Cuántos ticks caben en un eje del valor de `length` px. Antes del primer layout se estima
   * el largo: el alto menos los márgenes, o tres cuartos del ancho en horizontal.
   */
  private valueTickCount(
    length = this.horizontal ? (this.width || 600) * 0.75 : this.heightFor(this.width || 600) - AXIS_ALLOWANCE,
  ): number {
    return Math.max(2, Math.round(length / (this.horizontal ? TICK_SPACING_H : TICK_SPACING_V)));
  }

  /**
   * Interpola del cuadro visible al destino. Si llega otra actualización a mitad de camino,
   * se parte de lo que se está mostrando, así nunca hay saltos.
   */
  private transition(animate: boolean, duration = DURATION): void {
    cancelAnimationFrame(this.raf);
    if (!animate || !this.width || prefersReducedMotion()) {
      this.anim = null;
      this.current = this.target;
      this.draw();
      return;
    }
    // Entre sistemas de coordenadas distintos (de barras a pie) no hay nada que interpolar: el
    // gráfico nuevo entra desde cero.
    const sameCoords = this.current?.series.every((s) => (s.ps.impl.coords ?? 'cartesian') === this.coords) ?? false;
    const from = this.current && sameCoords ? this.current : collapse(this.target);
    this.anim = { from, to: withExits(from, this.target), start: performance.now() };
    const tick = (now: number) => {
      if (!this.anim || this.destroyed) return;
      const t = Math.min(1, (now - this.anim.start) / duration);
      if (t < 1) {
        this.current = interpolate(this.anim.from, this.anim.to, easeOut(t));
        this.raf = requestAnimationFrame(tick);
      } else {
        this.anim = null;
        this.current = this.target;
      }
      this.draw();
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ Dibujo

  /** El layout se recalcula solo si cambia el destino o el ancho, no en cada cuadro de la animación. */
  private cachedLayout(): Layout | null {
    const c = this.layoutCache;
    if (c && c.width === this.width && c.target === this.target && c.view === this.view) return c.L;
    const L = this.computeLayout(this.width);
    this.layoutCache = L ? { width: this.width, target: this.target, view: this.view, L } : null;
    return L;
  }

  private computeLayout(width: number): Layout | null {
    if (!width) return null;
    if (this.coords !== 'cartesian') return this.radialLayout(width);
    const { opts: o, prepared: p, target: t, horizontal } = this;
    const font = `${FONT_SIZE}px ${getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif'}`;
    const measure = (s: string) => textWidth(s, font);
    const valueTitle = o.yAxis?.title;
    const indexTitle = o.xAxis.title;
    // Arriba a la izquierda va el título del eje vertical; abajo al centro, el del horizontal.
    const topTitle = horizontal ? indexTitle : valueTitle || (t.right && o.yAxis2?.title);
    const top = (topTitle ? 22 : 0) + AXIS_GAP;
    const valueLabels = o.yAxis?.labels !== false;
    // Etiquetas de abajo: en horizontal, los números del valor; en vertical, las X.
    const bottomLabels = horizontal ? valueLabels : o.xAxis.labels !== false;
    const bottom = (bottomLabels ? X_LABEL_SPACE : AXIS_GAP) + ((horizontal ? valueTitle : indexTitle) ? 20 : 0);
    const height = this.heightFor(width);
    const plotH = Math.max(10, height - top - bottom);

    let left: number;
    let right: number;
    /** Lo que ocupan los números del eje Y sin `yAxis.width` (0 si no se ven). */
    let labelWidth = 0;
    if (horizontal) {
      const labels = p.xRaw.map((_, i) => measure(xLabel(p, i, true, this.xContext())));
      left = Math.ceil(Math.min(Math.max(0, ...labels), width * MAX_LABEL_SHARE)) + 10;
      right = 0;
    } else {
      left = 0;
      right = p.band ? 0 : 8;
    }

    // Ticks del valor salen del dominio destino: quedan quietos durante la animación. En vertical,
    // el paso es el del cuadro (el eje derecho se alineó con él); en horizontal depende del ancho.
    // En un eje logarítmico, las marcas son 1, 2 y 5 × 10ⁿ (ver logTicks) y el paso es la menor.
    const count = horizontal ? this.valueTickCount(width - left) : this.valueTickCount();
    const step = t.log ? t.step : horizontal ? niceStep(t.d1 - t.d0, count) : t.step;
    const valueTicks = t.log ? logTicks(t.d0, t.d1, count) : numberTicks(t.d0, t.d1, step);
    const spec = o.yAxis?.index ? 'number' : o.yAxis?.format;
    const valueFormat = axisFormatter(spec, this.numberContext(), step, Math.max(Math.abs(t.d0), Math.abs(t.d1)));
    if (!valueLabels) {
      // Sin números en el eje (small multiples fuera de la primera columna): solo un respiro.
      if (!horizontal) left = 4;
    } else if (horizontal) {
      // La última etiqueta del valor va centrada en el borde: que no se salga.
      right = Math.ceil(measure(valueFormat(valueTicks[valueTicks.length - 1] ?? 0)) / 2) + 2;
    } else {
      const natural = Math.ceil(Math.max(0, ...valueTicks.map((v) => measure(valueFormat(v))))) + 10;
      labelWidth = natural;
      left = Math.max(natural, o.yAxis?.width ?? 0);
    }
    // Eje derecho: sus números a la derecha, en los mismos renglones que los del izquierdo.
    const r = t.right;
    const rightTicks = r ? numberTicks(r.d0, r.d1, r.step) : [];
    const rightFormat = axisFormatter(
      o.yAxis2?.format,
      this.numberContext(),
      r?.step ?? 1,
      r ? Math.max(Math.abs(r.d0), Math.abs(r.d1)) : 0,
    );
    if (r) right = Math.ceil(Math.max(0, ...rightTicks.map((v) => measure(rightFormat(v))))) + 14;
    // Etiquetas al final de las líneas: a la derecha del área (y del eje derecho, si lo hay).
    let endLabels: Layout['endLabels'] = null;
    const endWidth = horizontal ? 0 : this.endLabelWidth(measure);
    // Nunca a costa de los datos: el área conserva al menos la mitad del ancho. Si no queda lugar
    // ni para un nombre corto, no van (la leyenda sigue diciendo qué es cada línea).
    const room = Math.min(endWidth, width * MAX_END_SHARE, width - left - right - END_GAP - width * MIN_PLOT_SHARE);
    if (endWidth > 0 && room >= Math.min(endWidth, MIN_END_WIDTH)) {
      endLabels = { x: right + END_GAP, width: room };
      right += END_GAP + room + 2;
    }
    const plotW = Math.max(10, width - left - right);
    const indexLen = horizontal ? plotH : plotW;
    const valueLen = horizontal ? plotW : plotH;
    return {
      labelWidth,
      valueLabels,
      width,
      height,
      left,
      top,
      plotW,
      plotH,
      horizontal,
      indexLen,
      valueLen,
      x: this.indexScale(indexLen),
      valueTicks,
      valueFormat,
      rightTicks,
      rightFormat,
      font,
      endLabels: endLabels && { x: plotW + endLabels.x, width: endLabels.width },
    };
  }

  /**
   * Layout sin ejes cartesianos: el área completa para la serie. En polar, además, el plano del
   * radar: centrado y con margen para las etiquetas de cada radio.
   */
  private radialLayout(width: number): Layout {
    const { opts: o, prepared: p, target: t } = this;
    const font = `${FONT_SIZE}px ${getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif'}`;
    const measure = (s: string) => textWidth(s, font);
    const plotW = width;
    const height = this.heightFor(width);
    const plotH = Math.max(10, height - 2 * AXIS_GAP);
    const valueTicks = numberTicks(t.d0, t.d1, t.step);
    const valueFormat = axisFormatter(o.yAxis?.format, this.numberContext(), t.step, Math.max(Math.abs(t.d0), Math.abs(t.d1)));
    let polar: PolarFrame | undefined;
    /** En polar: el ancho máximo de las etiquetas de cada radio (las más largas se recortan). */
    let labelWidth = 0;
    if (this.coords === 'polar') {
      const labels = p.xRaw.map((_, i) => measure(xLabel(p, i, true, this.xContext())));
      labelWidth = Math.min(width * 0.28, Math.max(0, ...labels));
      const n = Math.max(1, p.n);
      polar = {
        cx: plotW / 2,
        cy: plotH / 2,
        radius: Math.max(20, Math.min(plotW / 2 - labelWidth - 14, plotH / 2 - FONT_SIZE - 10)),
        angle: (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n,
      };
    }
    return {
      labelWidth,
      valueLabels: o.yAxis?.labels !== false,
      width,
      height,
      left: 0,
      top: AXIS_GAP,
      plotW,
      plotH,
      horizontal: false,
      indexLen: plotW,
      valueLen: plotH,
      x: new BandScale(p.n, plotW),
      valueTicks,
      valueFormat,
      rightTicks: [],
      rightFormat: valueFormat,
      font,
      polar,
      endLabels: null,
    };
  }

  /** Escala del índice: banda si hay barras o velas; continua si no (números con extremos "bonitos"). */
  private indexScale(length: number, view: View = this.zoomable ? this.view : FULL_VIEW): XScale {
    const p = this.prepared;
    if (p.band) return new BandScale(p.n, length, view);
    if (p.xType === 'category')
      return new ContinuousScale(
        p.xRaw.map((_, i) => i),
        length,
        undefined,
        view,
      );
    if (p.xType === 'linear' && p.n) {
      // Los extremos "bonitos" salen del eje completo: con zoom no cambian al moverse.
      // Con zoom, el largo de referencia es el del gráfico, no el de la medición (ver visibleRange).
      const ref = this.zoomable && this.width ? this.width : length;
      const [lo, hi] = niceDomain(p.xNum[0], p.xNum[p.n - 1], Math.max(2, Math.floor(ref / 80)));
      return new ContinuousScale(p.xNum, length, [lo, hi], view);
    }
    return new ContinuousScale(p.xNum, length, undefined, view);
  }

  /** Escala del valor (del eje izquierdo o del derecho): en vertical crece hacia arriba; en horizontal, a la derecha. */
  private valueScale(frame: Frame, L: Layout, axis: 'left' | 'right' = 'left'): LinearScale {
    const { d0, d1, log } = axis === 'right' && frame.right ? frame.right : frame;
    if (L.polar) return new LinearScale(d0, d1, 0, L.polar.radius);
    const Scale = log ? LogScale : LinearScale;
    return L.horizontal ? new Scale(d0, d1, 0, L.valueLen) : new Scale(d0, d1, L.valueLen, 0);
  }

  private draw(): void {
    const frame = this.current;
    const L = (this.layout = frame ? this.cachedLayout() : null);
    if (!frame || !L) return;
    this.svgEl.setAttribute('width', String(L.width));
    this.svgEl.setAttribute('height', String(L.height));
    this.svgEl.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    this.gPlot.setAttribute('transform', `translate(${L.left},${L.top})`);
    if (L.horizontal) this.gData.setAttribute('transform', SWAP_AXES);
    else this.gData.removeAttribute('transform');
    // Con zoom, el recorte es exacto en el eje X: lo que sale de la ventana no invade los ejes.
    // Un mapa (sin ejes) también: lo que queda fuera del encuadre no se asoma por los costados.
    const zoomed = this.zoomable && !isFull(this.view);
    const exact = zoomed || this.coords === 'free';
    this.clipRect.setAttribute('x', String(exact ? 0 : -CLIP_PAD));
    this.clipRect.setAttribute('width', String(L.indexLen + (exact ? 0 : 2 * CLIP_PAD)));
    this.clipRect.setAttribute('height', String(L.valueLen + 2 * CLIP_PAD));
    this.overlay.setAttribute('width', String(L.plotW));
    this.overlay.setAttribute('height', String(L.plotH));
    this.overlay.style.touchAction = L.horizontal ? 'pan-x' : this.coords === 'cartesian' ? 'pan-y' : 'pan-x pan-y';

    const parts = this.renderParts(frame, L, 'screen');
    this.gGrid.innerHTML = parts.grid;
    this.gSeries.innerHTML = parts.series;
    this.gNotes.innerHTML = parts.notes;
    this.gAxes.innerHTML = parts.axes;
    if (this.active >= 0) {
      this.drawHover(frame, L);
      this.positionTooltip();
    }
    this.drawZoomControls(L, zoomed);
  }

  /** Botón "Ver todo" y barra de desplazamiento con su mini gráfico. */
  private drawZoomControls(L: Layout, zoomed: boolean): void {
    this.resetBtn.classList.toggle('lc-off', !zoomed);
    this.resetBtn.tabIndex = zoomed && this.resetOn ? 0 : -1;
    const z = this.opts.zoom;
    const show = this.zoomable && !(typeof z === 'object' && z.scrollbar === false);
    if (!show) {
      this.scrollbar.el.remove();
      this.miniKey = null;
      return;
    }
    if (!this.scrollbar.el.isConnected) this.svgEl.after(this.scrollbar.el);
    const full = this.fullTarget ?? this.target;
    const k = this.miniKey;
    if (!k || k.target !== full || k.width !== this.width || k.theme !== this.theme) {
      this.miniKey = { target: full, width: this.width, theme: this.theme };
      this.scrollbar.render(L.left, L.plotW, this.miniChart(full, L));
    }
    this.scrollbar.sync(this.view);
  }

  /** Todos los datos en miniatura, en gris: es para orientarse, no para leer valores. */
  private miniChart(full: Frame, L: Layout): string {
    const h = SCROLLBAR_HEIGHT - 8;
    const mini: Layout = { ...L, x: this.indexScale(L.plotW, FULL_VIEW), valueLen: h, plotH: h, indexLen: L.plotW };
    let body = '';
    for (const f of full.series.slice().sort((a, b) => (a.ps.impl.layer ?? 1) - (b.ps.impl.layer ?? 1))) {
      if (f.alpha <= 0.001) continue;
      body += f.ps.impl.draw(this.drawContext(f, mini, full, 'overview'));
    }
    return `<svg${attrs({ width: L.plotW, height: SCROLLBAR_HEIGHT, viewBox: `0 -4 ${L.plotW} ${SCROLLBAR_HEIGHT}` })}>${body}</svg>`;
  }

  /** Markup de rejilla, series (plano lógico) y ejes. Sirve para la vista en vivo y para exportar. */
  private renderParts(
    frame: Frame,
    L: Layout,
    purpose: DrawPurpose,
  ): { grid: string; series: string; notes: string; axes: string } {
    if (this.coords !== 'cartesian') {
      const guides = L.polar ? this.polarGuides(frame, L) : { grid: '', axes: '' };
      return { ...guides, series: this.renderSeries(frame, L, purpose), notes: '' };
    }
    const th = this.theme;
    const vs = this.valueScale(frame, L);
    const line = (x1: number, y1: number, x2: number, y2: number, color: string) =>
      `<line${attrs({ x1, y1, x2, y2, stroke: color, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
    const label = (x: number | string, y: number | string, text: string, extra: Record<string, string | number> = {}) =>
      `<text${attrs({ x, y, fill: th.textMuted, 'font-size': FONT_SIZE, ...extra })}>${esc(text)}</text>`;
    const measure = (s: string) => textWidth(s, L.font);

    // Rejilla de 1 px, sólida y discreta; la línea del cero un poco más marcada. Con
    // `yAxis.grid: false` solo queda la línea de referencia.
    const gridOn = this.opts.yAxis?.grid !== false;
    let grid = '';
    let axes = '';
    for (const v of L.valueTicks) {
      const pos = Math.round(vs.map(v)) + 0.5;
      if (pos < -1 || pos > L.valueLen + 1) continue;
      // La línea de referencia: el cero, o el 100 de un índice.
      const reference = v === (this.opts.yAxis?.index ? INDEX_BASE : 0);
      const color = reference ? th.zero : th.grid;
      const text = L.valueFormat(v);
      const drawn = gridOn || reference;
      if (L.horizontal) {
        if (drawn) grid += line(pos, 0, pos, L.plotH, color);
        if (L.valueLabels) axes += label(pos, L.plotH + 10, text, { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });
      } else {
        if (drawn) grid += line(0, pos, L.plotW, pos, color);
        if (L.valueLabels) axes += label(-10, pos, text, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
      }
    }
    // Eje derecho: sus números en los mismos renglones de la rejilla (el dominio se alineó así).
    if (frame.right) {
      const rs = this.valueScale(frame, L, 'right');
      for (const v of L.rightTicks) {
        const pos = Math.round(rs.map(v)) + 0.5;
        if (pos < -1 || pos > L.valueLen + 1) continue;
        axes += label(L.plotW + 10, pos, L.rightFormat(v), { 'dominant-baseline': 'central' });
      }
    }
    // Sin el cero a la vista, una base discreta del lado del mínimo.
    if ((frame.d0 > 0 || frame.d1 < 0) && !this.opts.yAxis?.index) {
      grid += L.horizontal
        ? line(0.5, 0, 0.5, L.plotH, th.zero)
        : line(0, Math.round(L.plotH) + 0.5, L.plotW, Math.round(L.plotH) + 0.5, th.zero);
    }

    // Etiquetas del índice, medidas para que no se encimen.
    const ctx = this.xContext();
    if (L.horizontal) {
      for (const { pos, label: text } of indexLabels(this.prepared, L.x, FONT_SIZE + 6, L.left - 10, measure, ctx)) {
        axes += label(-10, pos.toFixed(1), text, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
      }
    } else if (this.opts.xAxis.labels !== false) {
      for (const tk of xTicks(this.prepared, L.x, L.plotW, 2 - L.left, L.width - L.left - 2, measure, ctx)) {
        axes += label(tk.px.toFixed(1), L.plotH + 10, tk.label, { 'text-anchor': tk.anchor, 'dominant-baseline': 'hanging' });
      }
    }
    const topTitle = L.horizontal ? this.opts.xAxis.title : this.opts.yAxis?.title;
    const bottomTitle = L.horizontal ? this.opts.yAxis?.title : this.opts.xAxis.title;
    if (topTitle) axes += label(-L.left, -16, topTitle, { 'dominant-baseline': 'central' });
    const rightTitle = frame.right && this.opts.yAxis2?.title;
    if (rightTitle)
      axes += label(L.width - L.left - 4, -16, rightTitle, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
    if (bottomTitle)
      axes += label(L.plotW / 2, L.plotH + 30, bottomTitle, { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });

    // Anotaciones: las franjas con la rejilla (debajo de las series), las líneas encima.
    const notes = renderAnnotations(
      this.opts.annotations,
      {
        indexLen: L.indexLen,
        valueLen: L.valueLen,
        horizontal: L.horizontal,
        index: (x, edge) => this.indexPosition(L, x, edge),
        value: (v, axis) => this.valueScale(frame, L, axis).map(v),
      },
      th,
      measure,
    );
    grid += notes.under;
    axes += this.endLabelMarkup(frame, L);
    return { grid, series: this.renderSeries(frame, L, purpose), notes: notes.over, axes };
  }

  /** Posición en el eje del índice de un valor de X (para anotaciones); null si no está. */
  private indexPosition(L: Layout, x: XValue, edge: 'start' | 'center' | 'end'): number | null {
    const p = this.prepared;
    if (L.x.kind === 'band' || p.xType === 'category') {
      const i = this.indexOfX(x);
      if (i < 0) return null;
      const half = L.x.bandwidth / 2;
      return L.x.at(i) + (edge === 'start' ? -half : edge === 'end' ? half : 0);
    }
    const v = p.xType === 'time' ? parseTime(x) : toNumber(x);
    return isFinite(v) ? (L.x as ContinuousScale).lin.map(v) : null;
  }

  /** Opciones de las etiquetas al final, o null si no van. */
  private get endLabelOptions(): { value: boolean } | null {
    const o = this.opts.endLabels;
    if (!o || this.horizontal || this.coords !== 'cartesian') return null;
    return { value: typeof o === 'object' && !!o.value };
  }

  /** Series con etiqueta al final: visibles en el destino y de un tipo que termina en un punto. */
  private endLabelSeries(frame: Frame): SeriesFrame[] {
    return frame.series.filter((f) => f.ps.impl.endLabel && f.alpha >= 0.5 && !this.hidden.has(f.ps.key));
  }

  /** Ancho de la etiqueta más larga (nombre y, si se pide, el valor más largo posible). */
  private endLabelWidth(measure: (s: string) => number): number {
    const o = this.endLabelOptions;
    if (!o) return 0;
    let widest = 0;
    for (const f of this.endLabelSeries(this.target)) {
      let w = measure(f.ps.name);
      if (o.value) {
        const fmt = this.valueFormat(f.ps);
        const finite = f.ps.values.filter((v) => isFinite(v));
        const longest = Math.max(0, ...finite.map((v) => measure(fmt(v))));
        w += END_TEXT + longest;
      }
      widest = Math.max(widest, w);
    }
    return widest ? Math.ceil(END_MARK + END_TEXT + widest) : 0;
  }

  /**
   * Nombre al final de cada línea, a la altura de su último dato visible. Las que chocan se
   * reparten (ver core/labels.ts). El texto va en color de texto; la marca, en el de la serie.
   */
  private endLabelMarkup(frame: Frame, L: Layout): string {
    const o = this.endLabelOptions;
    if (!o || !L.endLabels) return '';
    const range = visibleIndices(L.x, L.indexLen);
    if (!range) return '';
    const rows: { f: SeriesFrame; y: number; v: number }[] = [];
    for (const f of this.endLabelSeries(frame)) {
      let i = range[1];
      while (i >= range[0] && !isFinite(f.y1[i])) i--;
      if (i < range[0]) continue;
      rows.push({ f, y: this.valueScale(frame, L, f.ps.axis).map(f.y1[i]), v: f.ps.values[i] });
    }
    const lineHeight = FONT_SIZE + 3;
    const ys = spreadLabels(
      rows.map((r) => r.y),
      lineHeight,
      FONT_SIZE / 2,
      L.plotH - FONT_SIZE / 2,
    );
    const measure = (t: string) => textWidth(t, L.font);
    const { x, width } = L.endLabels;
    let out = '';
    rows.forEach((r, k) => {
      const y = ys[k];
      out += `<line${attrs({ x1: x, y1: y.toFixed(1), x2: x + END_MARK, y2: y.toFixed(1), stroke: this.colorOf(r.f.ps), 'stroke-width': 2, 'stroke-linecap': 'round' })}/>`;
      const value = o.value && isFinite(r.v) ? this.valueFormat(r.f.ps)(r.v) : '';
      const room = width - END_MARK - END_TEXT - (value ? measure(value) + END_TEXT : 0);
      const name = fitText(r.f.ps.name, Math.max(24, room), measure);
      const a = {
        x: x + END_MARK + END_TEXT,
        y: y.toFixed(1),
        fill: this.theme.text,
        'font-size': FONT_SIZE,
        'dominant-baseline': 'central',
      };
      const tail = value ? `<tspan${attrs({ fill: this.theme.textMuted, dx: END_TEXT })}>${esc(value)}</tspan>` : '';
      out += `<text${attrs(a)}>${esc(name)}${tail}</text>`;
    });
    return out;
  }

  /** Cada serie con su plugin, por capa: barras abajo, líneas y puntos arriba. */
  private renderSeries(frame: Frame, L: Layout, purpose: DrawPurpose): string {
    let series = '';
    // Por capa (barras abajo, líneas arriba) y, con `emphasis`, las destacadas encima del contexto.
    const rank = (f: SeriesFrame) => (f.ps.impl.layer ?? 1) + (this.isContext(f.ps) ? 0 : 0.5);
    const layered = frame.series.slice().sort((a, b) => rank(a) - rank(b));
    for (const f of layered) {
      if (f.alpha <= 0.001) continue;
      const ctx = this.drawContext(f, L, frame, purpose);
      let body = f.ps.impl.draw(ctx);
      // Un tipo que no atenúa por su cuenta: queda como está y sus datos seleccionados se marcan.
      if (this.selectedIdx && purpose !== 'overview' && !f.ps.impl.dimmable && f.ps.impl.hover && !this.isContext(f.ps))
        for (const i of this.selectedIdx) body += f.ps.impl.hover(ctx, i);
      if (!body) continue;
      const opacity = f.alpha < 0.999 ? f.alpha.toFixed(3) : undefined;
      series += `<g${attrs({ opacity, 'data-series': f.ps.key })}>${body}</g>`;
    }
    return series;
  }

  /**
   * Rejilla del radar: un polígono por cada tick del valor, un radio por categoría con su
   * etiqueta afuera y los números del valor sobre el radio de arriba.
   */
  private polarGuides(frame: Frame, L: Layout): { grid: string; axes: string } {
    const th = this.theme;
    const P = L.polar!;
    const p = this.prepared;
    const r = this.valueScale(frame, L);
    const n = p.n;
    const at = (i: number, radius: number) => polarPoint(P.cx, P.cy, radius, P.angle(i));
    // Los números del valor van entre los dos primeros radios: no chocan con un vértice ni con
    // la etiqueta de la primera categoría.
    const between = n > 1 ? (P.angle(0) + P.angle(1)) / 2 : P.angle(0);
    const ring = (radius: number) =>
      Array.from({ length: n }, (_, i) =>
        at(i, radius)
          .map((v) => v.toFixed(2))
          .join(','),
      ).join(' ');
    let grid = '';
    let axes = '';
    // Etiquetas de cada categoría afuera de su radio, alineadas según el lado en que caen. Sus
    // recuadros se guardan para que ningún número del eje se les encime.
    const measure = (t: string) => textWidth(t, L.font);
    const taken: Box[] = [];
    const ctx = this.xContext();
    for (let i = 0; i < n; i++) {
      const [x, y] = at(i, P.radius);
      grid += `<line${attrs({ x1: P.cx, y1: P.cy, x2: x.toFixed(2), y2: y.toFixed(2), stroke: th.grid, 'stroke-width': 1 })}/>`;
      const cos = Math.cos(P.angle(i));
      const sin = Math.sin(P.angle(i));
      const [lx, ly] = at(i, P.radius + 10);
      const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
      const baseline = Math.abs(sin) < 0.2 ? 'central' : sin > 0 ? 'hanging' : 'auto';
      const text = fitText(xLabel(p, i, true, ctx), L.labelWidth, measure);
      const w = measure(text);
      const left = anchor === 'middle' ? lx - w / 2 : anchor === 'start' ? lx : lx - w;
      const top = baseline === 'central' ? ly - FONT_SIZE / 2 : baseline === 'hanging' ? ly : ly - FONT_SIZE;
      taken.push({ left, top, right: left + w, bottom: top + FONT_SIZE });
      const a = {
        x: lx.toFixed(1),
        y: ly.toFixed(1),
        fill: th.textMuted,
        'font-size': FONT_SIZE,
        'text-anchor': anchor,
        'dominant-baseline': baseline,
      };
      axes += `<text${attrs(a)}>${esc(text)}</text>`;
    }
    for (const v of L.valueTicks) {
      const radius = r.map(v);
      if (radius <= 0.5 || radius > P.radius + 0.5) continue;
      // El anillo del cero se marca como la línea del cero cartesiana. Con menos de 3 categorías
      // no hay polígono posible: anillos circulares.
      const stroke = v === 0 ? th.zero : th.grid;
      grid +=
        n < 3
          ? `<circle${attrs({ cx: P.cx, cy: P.cy, r: radius.toFixed(2), fill: 'none', stroke, 'stroke-width': 1 })}/>`
          : `<polygon${attrs({ points: ring(radius), fill: 'none', stroke, 'stroke-width': 1 })}/>`;
      const label = L.valueFormat(v);
      const [x, y] = polarPoint(P.cx, P.cy, radius, between);
      const box: Box = { left: x + 2, top: y - FONT_SIZE / 2, right: x + 6 + measure(label), bottom: y + FONT_SIZE / 2 };
      // Se omite el número que chocaría con una etiqueta o con otro número (pasa con cifras largas).
      if (L.valueLabels && !taken.some((b) => overlaps(b, box))) {
        taken.push(box);
        // Halo del color del fondo: el número no pisa el radio ni los polígonos.
        const a = {
          x: x + 4,
          y,
          fill: th.textMuted,
          'font-size': FONT_SIZE - 1,
          'dominant-baseline': 'central',
          stroke: th.surface,
          'stroke-width': 3,
          'paint-order': 'stroke',
        };
        axes += `<text${attrs(a)}>${esc(label)}</text>`;
      }
    }
    return { grid, axes };
  }

  /**
   * Contexto de dibujo de una serie. En el mini gráfico del zoom ('overview') todo va en el gris de
   * contexto y sin superficie: es para orientarse, no para leer valores.
   */
  private drawContext(f: SeriesFrame, L: Layout, frame: Frame, purpose: DrawPurpose = 'screen'): DrawContext {
    const hidden = this.hiddenIdx;
    const overview = purpose === 'overview';
    // El mini gráfico del zoom es para orientarse: ahí no hay selección que atenuar.
    const selected = overview ? null : this.selectedIdx;
    const ctx: DrawContext = {
      frame: f,
      purpose,
      color: overview ? this.theme.context : this.colorOf(f.ps),
      pointColor: (i) => this.pointColor(i),
      polar: L.polar && this.polarPlane(L, frame),
      x: L.x,
      y: this.valueScale(frame, L, f.ps.axis),
      theme: overview ? { ...this.theme, surface: 'transparent' } : this.theme,
      width: L.indexLen,
      height: L.valueLen,
      n: frame.n,
      isHidden: (i) => hidden.has(i),
      label: (i) => xLabel(this.prepared, i, true, this.xContext()),
      measure: (text) => textWidth(text, L.font),
      format: this.valueFormat(f.ps),
      percent: valueFormatter('percent', this.numberContext()),
      compact: (v) => this.compactFormat(f.ps)(v),
      locale: this.opts.locale,
      currency: this.opts.currency,
      isDimmed: (i) => !!selected && !selected.has(i),
      siblings: () =>
        frame.series
          .filter((s) => s.ps.impl === f.ps.impl && s.alpha > 0.001)
          .map((s) => (s === f ? ctx : this.drawContext(s, L, frame, purpose))),
    };
    return ctx;
  }

  /** Compacto respetando el formato de la serie: moneda en moneda, porcentaje en porcentaje. */
  private compactFormat(s: PreparedSeries): (v: number) => string {
    const spec = s.options.format ?? (s.axis === 'right' ? this.opts.yAxis2?.format : this.opts.yAxis?.format);
    if (typeof spec === 'function') return spec;
    const kind = spec === 'currency' || spec === 'percent' ? spec : 'compact';
    return (v) => axisFormatter(kind, this.numberContext(), Math.abs(v) / 100, Math.abs(v))(v);
  }

  /**
   * El plano polar con el dominio del cuadro que se dibuja: durante la animación, los puntos de
   * las series caen sobre los mismos anillos que la rejilla.
   */
  private polarPlane(L: Layout, frame: Frame): PolarPlane {
    const P = L.polar!;
    const r = this.valueScale(frame, L);
    return { ...P, point: (i, v) => polarPoint(P.cx, P.cy, Math.max(0, r.map(v)), P.angle(i)) };
  }

  /** Extremo exterior del radio de la categoría i, en px del área. */
  private spokeEnd(L: Layout, i: number): [number, number] {
    const P = L.polar!;
    return polarPoint(P.cx, P.cy, P.radius, P.angle(i));
  }

  /** Color de la categoría i (leyenda por categorías): la paleta en orden; "Otros", neutro. */
  private pointColor(i: number): string {
    const slot = this.prepared.pointSlots[i] ?? i;
    return slot < 0 ? this.theme.other : (this.theme.palette[slot] ?? this.theme.other);
  }

  /** El color sale del tema actual y la posición de la serie, nunca de su visibilidad. */
  private colorOf(s: PreparedSeries): string {
    if (this.isContext(s)) return this.theme.context;
    return s.slot < 0 ? this.theme.other : this.theme.palette[s.slot];
  }

  /** Con `emphasis`, las series que no se nombran son contexto: van en gris y debajo. */
  private isContext(s: PreparedSeries): boolean {
    const e = this.opts.emphasis;
    if (e === undefined || this.prepared.pointLegend) return false;
    return Array.isArray(e) ? !e.includes(s.key) : e !== s.key;
  }

  private xContext(): XLabelContext {
    return { ...this.numberContext(), format: this.opts.xAxis.format };
  }

  private numberContext(): NumberContext {
    return { locale: this.opts.locale, currency: this.opts.currency };
  }

  /** El tooltip y la tabla muestran el valor exacto, no la versión compacta del eje. */
  private valueFormat(s: PreparedSeries): (v: number) => string {
    const axisFormat = s.axis === 'right' ? this.opts.yAxis2?.format : this.opts.yAxis?.format;
    const spec: FormatSpec | undefined = s.options.format ?? axisFormat;
    return valueFormatter(spec === 'auto' || spec === 'compact' ? 'number' : spec, this.numberContext());
  }

  /** Lo que dice el tooltip (y la tabla) de una serie en un índice. */
  private valueText(s: PreparedSeries, i: number): TooltipValue {
    const hidden = this.hiddenIdx;
    const value = this.valueFormat(s);
    const number = valueFormatter('number', this.numberContext());
    const spec = s.options.format ?? (s.axis === 'right' ? this.opts.yAxis2?.format : this.opts.yAxis?.format);
    const sign = (d: number) => (d > 0 ? '+' : d < 0 ? '−' : '');
    const format: TooltipFormat = {
      value,
      number,
      percent: valueFormatter('percent', this.numberContext()),
      isHidden: (i) => hidden.has(i),
      difference: (d) =>
        spec === 'percent' ? `${sign(d)}${number(Math.abs(d) * 100)} p. p.` : `${sign(d)}${value(Math.abs(d))}`,
      locale: this.opts.locale,
      currency: this.opts.currency,
    };
    const text = this.baseValueText(s, i, format);
    // "Otros" detalla qué categorías suma: ninguna se pierde.
    const p = this.prepared;
    if (p.pointLegend && p.pointSlots[i] < 0 && p.others.length) {
      return {
        ...text,
        details: [
          ...(text.details ?? []),
          ...p.others.map((o): [string, string] => [o.label, isFinite(o.value) ? value(o.value) : 'Sin dato']),
        ],
      };
    }
    return text;
  }

  private baseValueText(s: PreparedSeries, i: number, format: TooltipFormat): TooltipValue {
    if (s.raw) {
      // Índice: el valor del eje y, debajo, el original en sus unidades.
      const v = s.values[i];
      if (!isFinite(v)) return { value: 'Sin dato' };
      return { value: indexFormatter(this.opts.locale)(v), details: [['Valor real', format.value(s.raw[i])]] };
    }
    const custom = s.impl.tooltip?.(s, i, format);
    if (custom) return custom;
    return { value: isFinite(s.values[i]) ? format.value(s.values[i]) : 'Sin dato' };
  }

  // ------------------------------------------------------------ Tema

  private readonly onColorScheme = () => {
    if (this.opts.theme === 'auto') this.refreshTheme();
  };

  private readonly onResize = () => {
    const width = Math.floor(this.plotEl.clientWidth);
    if (width === this.width) return;
    this.width = width;
    // Un tooltip oculto conserva su última posición: al achicarse el gráfico podría quedar más
    // allá del borde y abrir un scroll horizontal en la página. Vuelve al origen hasta que se use.
    if (!this.tooltipEl.classList.contains('lc-show')) this.tooltipEl.style.transform = '';
    // Al cambiar el ancho se redibuja sin animar; si hay una animación en curso, ella dibuja.
    if (!this.anim) this.draw();
  };

  private applyTheme(): void {
    const mode = this.opts.theme === 'auto' ? (this.colorScheme?.matches ? 'dark' : 'light') : this.opts.theme;
    this.theme = resolveTheme(mode, this.opts.palette);
    const vars = themeVars(this.theme);
    for (const k in vars) this.root.style.setProperty(k, vars[k]);
    this.root.dataset.theme = mode;
    this.root.classList.toggle('lc-bg', this.opts.background);
  }

  /** Cambio de tema en vivo: mismos datos, otros colores, sin animación de datos. */
  private refreshTheme(): void {
    const colors = this.theme.palette.length;
    this.applyTheme();
    // Una paleta propia puede tener otra cantidad de colores en este modo: cambia cuántas series caben.
    if (this.theme.palette.length !== colors) {
      this.rebuild(false);
      return;
    }
    this.syncLegend();
    if (!this.anim) this.draw();
  }

  // ------------------------------------------------------------ Encabezado, leyenda y tabla

  /**
   * Título y subtítulo. Con zoom, a la derecha va "Ver todo": su lugar queda reservado aunque
   * no se vea, así el gráfico no salta al acercar, y nunca tapa datos ni anotaciones.
   */
  private renderHeader(): void {
    const { title, subtitle } = this.opts;
    const heading = html('div', { class: 'lc-heading' });
    if (title) heading.appendChild(html('div', { class: 'lc-title' }, title));
    if (subtitle) heading.appendChild(html('div', { class: 'lc-subtitle' }, subtitle));
    this.header.replaceChildren(heading);
    const reset = this.resetOn;
    if (reset) this.header.appendChild(this.resetBtn);
    this.header.hidden = !title && !subtitle && !reset;
    this.header.classList.toggle('lc-tools', reset);
  }

  private legendItems(): LegendItem[] {
    const p = this.prepared;
    if (p.pointLegend) {
      // Una entrada por categoría, con su color: ocultarla la deja en cero.
      // Cada botón dice también su parte del total visible: sin etiquetas (en móvil), la porción no
      // se identifica solo por el color.
      const symbol = p.series[0]?.impl.legendSymbol ?? 'square';
      const values = p.series[0]?.values ?? [];
      const total = values.reduce((sum, v, i) => sum + (this.hiddenPoints.has(String(p.xRaw[i])) || !(v > 0) ? 0 : v), 0);
      const percent = valueFormatter('percent', this.numberContext());
      const ctx = this.xContext();
      return p.xRaw.map((x, i) => {
        const key = String(x);
        const visible = !this.hiddenPoints.has(key);
        const share = visible && total > 0 && values[i] > 0 ? ` ${percent(values[i] / total)}` : '';
        return { key, name: xLabel(p, i, true, ctx) + share, color: this.pointColor(i), symbol, visible };
      });
    }
    return this.prepared.series.map((s) => ({
      key: s.key,
      // Salvaguarda del doble eje: la leyenda dice qué serie se lee en el eje derecho.
      name: s.axis === 'right' ? `${s.name} (eje derecho)` : s.name,
      color: this.colorOf(s),
      symbol: s.impl.legendSymbol ?? 'square',
      visible: !this.hidden.has(s.key),
    }));
  }

  /** Leyenda solo con 2 o más series. Los botones se crean al cambiar las series, no en cada clic. */
  private buildLegend(): void {
    const lg = this.opts.legend;
    const entries = this.prepared.pointLegend ? this.prepared.n : this.prepared.series.length;
    if (lg === false || entries < 2) {
      this.legend.clear();
      return;
    }
    const top = typeof lg === 'object' && lg.position === 'top';
    if (top) this.plotEl.before(this.legend.el);
    else this.plotEl.after(this.legend.el);
    this.legend.render(this.legendItems(), top);
  }

  private syncLegend(): void {
    this.legend.sync(this.legendItems());
  }

  /** Tabla oculta con todos los datos, para lectores de pantalla. */
  private renderTable(): void {
    const p = this.prepared;
    const ctx = this.xContext();
    const head = html('tr');
    head.appendChild(html('th', { scope: 'col' }, this.opts.xAxis.title ?? this.opts.xAxis.field));
    for (const s of p.series) head.appendChild(html('th', { scope: 'col' }, s.name));
    const body = html('tbody');
    // Miles de filas no se leen con un lector de pantalla y frenan la página: se muestran las
    // primeras y el título avisa cuántas hay y cómo tenerlas todas (download('csv')).
    const shown = Math.min(p.n, MAX_TABLE_ROWS);
    for (let i = 0; i < shown; i++) {
      const row = html('tr');
      const hiddenMark =
        (p.pointLegend && this.hiddenIdx.has(i) ? ' (oculta en el gráfico)' : '') +
        (this.selectedIdx?.has(i) ? ' (en la selección)' : '');
      const own = p.series[0]?.impl.headline?.(p.series[0], i, xLabel(p, i, false, ctx));
      row.appendChild(html('th', { scope: 'row' }, (own || xLabel(p, i, false, ctx)) + hiddenMark));
      for (const s of p.series) {
        const t = this.valueText(s, i);
        const details = t.details ? ` (${t.details.map(([k, v]) => `${k}: ${v}`).join('; ')})` : '';
        row.appendChild(html('td', {}, t.value + details));
      }
      body.appendChild(row);
    }
    const thead = html('thead');
    thead.appendChild(head);
    const title = this.opts.title ?? 'Datos del gráfico';
    const count = valueFormatter('number', this.numberContext());
    const caption =
      shown < p.n
        ? `${title} (aquí van las primeras ${count(shown)} de ${count(p.n)} filas; descarga el CSV para verlas todas)`
        : title;
    this.tableEl.replaceChildren(html('caption', {}, caption), thead, body);
  }

  private ariaLabel(): string {
    if (this.opts.ariaLabel) return this.opts.ariaLabel;
    const p = this.prepared;
    const { series, n } = p;
    const kinds = [...new Set(series.map((s) => s.impl.label ?? s.options.type))];
    const what = kinds.length ? 'Gráfico de ' + kinds.join(' y ') : 'Gráfico';
    const title = this.opts.title ? `${this.opts.title}. ` : '';
    // Un solo dato (un gauge): se dice el valor, no se invita a recorrer nada.
    if (n === 1) return `${title}${what}. ${this.describe(0)}`;
    const plural = (k: number, [one, many]: readonly [string, string]) => `${k} ${k === 1 ? one : many}`;
    const items = this.itemWords();
    // Se cuentan las categorías de los datos, no las porciones: "Otros" reúne varias.
    const real = p.others.length ? n - 1 + p.others.length : n;
    const folded = p.others.length ? ` (${p.others.length} sumadas en Otros)` : '';
    const count =
      p.pointLegend || p.coords === 'free'
        ? plural(real, items) + folded
        : series.length === 1
          ? plural(n, items)
          : `${plural(series.length, ['serie', 'series'])} y ${plural(n, items)}`;
    // Sin ejes valen las cuatro flechas; con ejes, las del eje del índice.
    const keys =
      p.coords !== 'cartesian'
        ? 'las flechas'
        : this.horizontal
          ? 'las flechas arriba y abajo'
          : 'las flechas izquierda y derecha';
    const zoom = this.zoomable ? ' Con + y − acercas o alejas; con 0 vuelves a verlo todo.' : '';
    const selection = this.selectedIdx ? ` ${this.selectionText()}.` : '';
    return `${title}${what} con ${count}${this.spanText()}.${this.peakText()} Recorre los datos con ${keys}.${zoom}${this.annotationText()}${selection}`;
  }

  /** ", de enero a diciembre": de dónde a dónde va el eje X, si es de fechas o de números. */
  private spanText(): string {
    const p = this.prepared;
    if (p.coords !== 'cartesian' || p.xType === 'category' || p.n < 2) return '';
    const ctx = this.xContext();
    return `, de ${xLabel(p, 0, false, ctx)} a ${xLabel(p, p.n - 1, false, ctx)}`;
  }

  /** " El más alto es noviembre, con 1,4 M $.": con una sola serie de valores simples. */
  private peakText(): string {
    const p = this.prepared;
    const s = p.series[0];
    if (p.coords !== 'cartesian' || p.series.length !== 1 || !s || s.impl.tooltip || p.n < 2) return '';
    let top = -1;
    s.values.forEach((v, i) => {
      if (isFinite(v) && (top < 0 || v > s.values[top])) top = i;
    });
    if (top < 0) return '';
    return ` El más alto es ${xLabel(p, top, false, this.xContext())}, con ${this.valueText(s, top).value}.`;
  }

  /** Las anotaciones dichas en palabras: "Referencias: Meta, 120 mil $; Campaña de verano." */
  private annotationText(): string {
    const list = (this.opts.annotations ?? []).filter((a) => a.label);
    if (!list.length || this.coords !== 'cartesian') return '';
    const left = valueFormatter(
      this.opts.yAxis?.format === 'auto' ? 'number' : (this.opts.yAxis?.format ?? 'number'),
      this.numberContext(),
    );
    const items = list.map((a) => (typeof a.y === 'number' ? `${a.label}, ${left(a.y)}` : a.label!));
    return ` Referencias: ${items.join('; ')}.`;
  }

  // ------------------------------------------------------------ Hover, tooltip y teclado

  /** Todas las series visibles buscan el punto más cercano (dispersión): no hay crosshair. */
  private nearestMode(): boolean {
    const visible = this.prepared.series.filter((s) => !this.hidden.has(s.key));
    return visible.length > 0 && visible.every((s) => s.impl.pointer === 'nearest');
  }

  private bindEvents(): void {
    const point = (e: PointerEvent) => {
      const L = this.layout;
      if (!L || !this.pointerOn || !this.prepared.n || this.gestures.busy) return;
      const i = this.indexAtEvent(e, L);
      if (i < 0) this.clearActive();
      else this.setActive(i, false);
    };
    this.overlay.addEventListener('pointermove', point);
    this.overlay.addEventListener('pointerdown', (e) => {
      this.pressedAt = { x: e.clientX, y: e.clientY };
      point(e);
    });
    // Un clic es presionar y soltar casi en el mismo lugar: un arrastre (el zoom) no cuenta.
    this.overlay.addEventListener('click', (e) => {
      const L = this.layout;
      const from = this.pressedAt;
      this.pressedAt = null;
      if (!L || !this.clickable || !this.prepared.n) return;
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > CLICK_SLOP) return;
      const i = this.indexAtEvent(e, L);
      if (i >= 0) this.fireClick(i, this.pointerSeries, e);
    });
    this.overlay.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.clearActive();
    });
    this.svgEl.addEventListener('blur', () => this.clearActive());
    this.svgEl.addEventListener('keydown', (e) => {
      const stops = this.navigable();
      if (!stops.length) return;
      // Sin ejes (pie, radar, embudo) valen las cuatro flechas; con ejes, las del eje del índice.
      const free = this.coords !== 'cartesian';
      const forwardKeys = free ? ['ArrowRight', 'ArrowDown'] : [this.horizontal ? 'ArrowDown' : 'ArrowRight'];
      const backKeys = free ? ['ArrowLeft', 'ArrowUp'] : [this.horizontal ? 'ArrowUp' : 'ArrowLeft'];
      // Enter o Espacio sobre el dato activo es su clic. Sin nadie que escuche, Espacio sigue
      // moviendo la página.
      if ((e.key === 'Enter' || e.key === ' ') && this.active >= 0 && this.clickable) {
        e.preventDefault();
        const own = free ? (this.prepared.series.find((x) => !this.hidden.has(x.key)) ?? null) : null;
        this.fireClick(this.active, own, e);
        return;
      }
      if (this.zoomable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const factor = e.key === '+' || e.key === '=' ? 1.5 : e.key === '-' || e.key === '_' ? 1 / 1.5 : 0;
        if (factor || e.key === '0') {
          e.preventDefault();
          if (factor) this.zoomByKey(factor);
          else this.applyView(FULL_VIEW, true);
          return;
        }
      }
      // Un tipo con recorrido propio (en dos dimensiones) decide a dónde lleva cada flecha.
      const first = this.prepared.series.find((x) => !this.hidden.has(x.key));
      const own = this.active >= 0 ? first?.impl.step?.(first, this.active, e.key) : undefined;
      if (own !== undefined && own >= 0 && !this.hiddenIdx.has(own)) {
        e.preventDefault();
        this.pointer = { x: -1, y: -1 };
        this.setActive(own, true);
        return;
      }
      const at = stops.indexOf(this.active);
      // Sin dato activo y con zoom, se empieza dentro de la ventana, no en el principio de todo.
      const shown =
        this.zoomable && !isFull(this.view) && this.layout ? visibleIndices(this.layout.x, this.layout.indexLen) : null;
      const inView = shown ? stops.filter((i) => i >= shown[0] && i <= shown[1]) : stops;
      const pool = inView.length ? inView : stops;
      let next: number;
      if (forwardKeys.includes(e.key)) next = at < 0 ? pool[0] : stops[Math.min(stops.length - 1, at + 1)];
      else if (backKeys.includes(e.key)) next = at < 0 ? pool[pool.length - 1] : stops[Math.max(0, at - 1)];
      else
        switch (e.key) {
          case 'Home':
            next = stops[0];
            break;
          case 'End':
            next = stops[stops.length - 1];
            break;
          case 'Escape':
            this.clearActive();
            return;
          default:
            return;
        }
      e.preventDefault();
      this.pointer = { x: -1, y: -1 };
      this.pointerSeries = null;
      if (this.zoomable) this.followActive(next);
      this.setActive(next, true);
    });
  }

  /** Índices que recorre el teclado: los que el tipo declara, sin las categorías ocultas. */
  private navigable(): number[] {
    const s = this.prepared.series.find((x) => !this.hidden.has(x.key));
    const all = s?.impl.navigable?.(s) ?? Array.from({ length: this.prepared.n }, (_, i) => i);
    return all.filter((i) => !this.hiddenIdx.has(i));
  }

  /** Guarda la posición de un evento del puntero (px del SVG) y devuelve el índice que hay ahí. */
  private indexAtEvent(e: MouseEvent, L: Layout): number {
    const box = this.svgEl.getBoundingClientRect();
    this.pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
    return this.indexAtPointer(L);
  }

  /**
   * Índice bajo el puntero: el que responda una serie con `hit`, por su posición en el eje del
   * índice o el punto más cercano. Deja en `pointerSeries` la serie del dato, si se sabe.
   */
  private indexAtPointer(L: Layout): number {
    // Coordenadas del puntero en el plano lógico (índice, valor).
    const sx = this.pointer.x - L.left;
    const sy = this.pointer.y - L.top;
    const [li, lv] = L.horizontal ? [sy, sx] : [sx, sy];
    const frame = this.current;
    this.pointerSeries = null;
    if (frame && this.coords === 'free') {
      const f = frame.series.find((s) => s.alpha >= 0.5 && s.ps.impl.hit);
      const i = f ? f.ps.impl.hit!(this.drawContext(f, L, frame), sx, sy) : -1;
      if (i >= 0) this.pointerSeries = f!.ps;
      return i;
    }
    if (frame && this.coords === 'cartesian') {
      // Las series que deciden qué dato tienen bajo el puntero, de la capa de arriba a la de abajo.
      const visible = frame.series.filter((s) => s.alpha >= 0.5);
      const hitters = visible.filter((s) => s.ps.impl.hit).sort((a, b) => (b.ps.impl.layer ?? 1) - (a.ps.impl.layer ?? 1));
      for (const f of hitters) {
        const i = f.ps.impl.hit!(this.drawContext(f, L, frame), li, lv);
        if (i >= 0 && i < frame.n) {
          this.pointerSeries = f.ps;
          return i;
        }
      }
      if (hitters.length && hitters.length === visible.length) return -1;
    }
    if (L.polar) {
      // Lejos del radar no hay dato activo; cerca, el radio más próximo al ángulo del puntero.
      if (Math.hypot(sx - L.polar.cx, sy - L.polar.cy) > L.polar.radius + 24) return -1;
      const turn = Math.atan2(sy - L.polar.cy, sx - L.polar.cx) + Math.PI / 2;
      const n = this.prepared.n;
      return ((Math.round((turn / (2 * Math.PI)) * n) % n) + n) % n;
    }
    if (!frame || !this.nearestMode()) return L.x.indexAt(li);
    let best = 0;
    let bestDist = Infinity;
    let bestSeries: PreparedSeries | null = null;
    const [first, last] = visibleIndices(L.x, L.indexLen) ?? [0, frame.n - 1];
    for (const f of frame.series) {
      if (f.alpha < 0.5) continue;
      for (let i = first; i <= last; i++) {
        if (!isFinite(f.y1[i])) continue;
        const d = Math.hypot(L.x.at(i) - li, this.valueScale(frame, L, f.ps.axis).map(f.y1[i]) - lv);
        if (d < bestDist) [best, bestDist, bestSeries] = [i, d, f.ps];
      }
    }
    this.pointerSeries = bestSeries;
    return best;
  }

  /** Activa el índice i desde el puntero o el teclado: marcas, tooltip y aviso a onHover. */
  private setActive(i: number, announce: boolean): void {
    const changed = i !== this.active || this.extraMarks.length > 0;
    this.active = i;
    this.extraMarks = [];
    const frame = this.current;
    const L = this.layout;
    if (!frame || !L) return;
    // También si el índice venía marcado por highlight(): ahí no había tooltip.
    if (changed || this.highlighted) {
      this.highlighted = false;
      this.drawHover(frame, L);
      this.fillTooltip(i);
    }
    this.positionTooltip();
    if (announce) this.liveEl.textContent = this.describe(i);
    // La serie del dato: la del puntero o, con el teclado en un gráfico sin ejes, la que se recorre.
    const series =
      this.pointer.x >= 0
        ? this.pointerSeries
        : this.coords === 'free'
          ? (this.prepared.series.find((s) => !this.hidden.has(s.key)) ?? null)
          : null;
    if (i === this.hovered.i && series === this.hovered.series) return;
    this.hovered = { i, series };
    // Un índice virtual (un nodo interior de un sunburst) no tiene X que compartir.
    this.opts.onHover?.(i < this.prepared.n ? this.xKey(i) : null, i, series?.key ?? null);
  }

  /** @param notify avisar a onHover (no cuando la limpieza viene de highlight). */
  private clearActive(notify = true): void {
    const was = this.hovered.i;
    this.active = -1;
    this.highlighted = false;
    this.extraMarks = [];
    this.gBand.replaceChildren();
    this.gHover.replaceChildren();
    this.tooltipEl.classList.remove('lc-show');
    if (!notify) return;
    this.hovered = { i: -1, series: null };
    if (was >= 0) this.opts.onHover?.(null, -1, null);
  }

  /**
   * Clic (o Enter y Espacio) en el dato i: primero el gancho del tipo de serie (el de `series`, o
   * el de cada serie visible que lo tenga) y después la opción onClick.
   */
  private fireClick(i: number, series: PreparedSeries | null, event: MouseEvent | KeyboardEvent): void {
    const frame = this.current;
    const L = this.layout;
    if (frame && L) {
      const targets = frame.series.filter(
        (f) => f.alpha >= 0.5 && f.ps.impl.click && (series ? f.ps === series : !this.hidden.has(f.ps.key)),
      );
      for (const f of targets) f.ps.impl.click!(this.drawContext(f, L, frame), i, event);
    }
    this.opts.onClick?.(i < this.prepared.n ? this.xKey(i) : null, i, series?.key ?? null);
  }

  /** Clave de la X en el índice i: el texto de la categoría, o el número (fecha en ms) en tiempo y numérico. */
  private xKey(i: number): string | number {
    const p = this.prepared;
    return p.xType === 'category' ? String(p.xRaw[i]) : p.xNum[i];
  }

  private indexOfX(x: unknown): number {
    const p = this.prepared;
    // Una fecha llega como texto ('2026-03'), Date o milisegundos: se lee igual que los datos.
    const key = p.xType === 'category' ? String(x) : p.xType === 'time' ? parseTime(x) : toNumber(x);
    for (let i = 0; i < p.n; i++) if (this.xKey(i) === key) return i;
    return -1;
  }

  /**
   * Banda resaltada (barras) o crosshair (líneas y áreas), más las marcas de cada serie, en el dato
   * activo y en los demás que marcó highlight(). Plano lógico.
   */
  private drawHover(frame: Frame, L: Layout): void {
    let band = '';
    let marks = '';
    for (const i of [this.active, ...this.extraMarks]) {
      if (i < 0) continue;
      const m = this.hoverMarks(frame, L, i);
      band += m.band;
      marks += m.marks;
    }
    this.gBand.innerHTML = band;
    this.gHover.innerHTML = marks;
  }

  /** Marcas de un dato: la banda o el crosshair y las marcas de cada serie (vacío si queda fuera del zoom). */
  private hoverMarks(frame: Frame, L: Layout, i: number): { band: string; marks: string } {
    const th = this.theme;
    if (this.coords !== 'cartesian') {
      // Sin banda ni crosshair; en el radar, se resalta el radio de la categoría.
      let marks = '';
      if (L.polar) {
        const [x, y] = this.spokeEnd(L, i);
        const a = {
          x1: L.polar.cx,
          y1: L.polar.cy,
          x2: x.toFixed(2),
          y2: y.toFixed(2),
          stroke: th.textMuted,
          'stroke-width': 1,
          'stroke-opacity': 0.6,
        };
        marks += `<line${attrs(a)}/>`;
      }
      for (const f of frame.series) {
        if (f.alpha >= 0.5 && f.ps.impl.hover) marks += f.ps.impl.hover(this.drawContext(f, L, frame), i);
      }
      return { band: '', marks };
    }
    const cx = L.x.at(i);
    // Un dato fuera de la ventana del zoom (marcado desde otro gráfico) no se marca sobre los ejes.
    if (cx < -1 || cx > L.indexLen + 1) return { band: '', marks: '' };
    const band = L.x.kind === 'band';
    const w = L.x.bandwidth;
    const bandMark = band
      ? `<rect${attrs({ x: (cx - w / 2).toFixed(2), y: 0, width: w.toFixed(2), height: L.valueLen, fill: th.highlight, rx: 4 })}/>`
      : '';
    let marks = '';
    if (!band && !this.nearestMode()) {
      const px = Math.round(cx) + 0.5;
      marks += `<line${attrs({ x1: px, x2: px, y1: 0, y2: L.valueLen, stroke: th.textMuted, 'stroke-width': 1, 'stroke-opacity': 0.6, 'shape-rendering': 'crispEdges' })}/>`;
    }
    for (const f of frame.series) {
      // Las series de contexto (emphasis) no se marcan: la atención queda en las destacadas.
      if (f.alpha >= 0.5 && f.ps.impl.hover && !this.isContext(f.ps)) marks += f.ps.impl.hover(this.drawContext(f, L, frame), i);
    }
    return { band: bandMark, marks };
  }

  /** Series visibles en el índice i; con `emphasis`, las destacadas primero. */
  private visibleAt(i: number): Row[] {
    const series = this.prepared.series.filter((s) => !this.hidden.has(s.key));
    const ordered = [...series.filter((s) => !this.isContext(s)), ...series.filter((s) => this.isContext(s))];
    return ordered.map((s) => ({ s, v: s.values[i], text: this.valueText(s, i) }));
  }

  /** Encabezado del tooltip: la X completa; si es un número con título de eje, también el título. */
  private headline(i: number): string {
    const label = xLabel(this.prepared, i, false, this.xContext());
    // Un tipo puede nombrar su dato de otra forma ("Lima → Bogotá" en un sankey).
    const s = this.prepared.series[0];
    const own = s?.impl.headline?.(s, i, label);
    if (own) return own;
    const title = this.opts.xAxis.title;
    return this.prepared.xType === 'linear' && title ? `${title}: ${label}` : label;
  }

  /**
   * Muestra de color de la serie s en el índice i: la pide al tipo con el cuadro destino, el que
   * describen los valores del tooltip, así una celda o una rama muestran el color en el que quedan.
   */
  private swatchColor(s: PreparedSeries, i: number): string {
    const L = this.layout;
    const f = L && this.target.series.find((x) => x.ps === s);
    if (f) return swatchOf(this.drawContext(f, L, this.target), i);
    return this.prepared.pointLegend ? this.pointColor(i) : this.colorOf(s);
  }

  /** El tooltip se arma con textContent: los datos del usuario nunca pasan por innerHTML. */
  private fillTooltip(i: number): void {
    if (!this.floatOn) {
      this.tooltipEl.classList.remove('lc-show');
      return;
    }
    // En dispersión, solo las series con dato en ese punto.
    const rows = this.visibleAt(i).filter((r) => !this.nearestMode() || isFinite(r.v));
    // Total si hay 2 o más series visibles en una misma pila; va justo debajo de ellas.
    const stacked = rows.filter((r) => r.s.stackKey);
    const oneStack = stacked.length >= 2 && stacked.every((r) => r.s.stackKey === stacked[0].s.stackKey);
    const lastStacked = oneStack ? stacked[stacked.length - 1] : null;
    const nodes: HTMLElement[] = [html('div', { class: 'lc-tt-head' }, this.headline(i))];
    for (const r of rows) {
      const row = html('div', { class: 'lc-tt-row' });
      const key = html('span', { class: 'lc-tt-key' });
      key.style.background = this.swatchColor(r.s, i);
      row.append(key, html('span', { class: 'lc-tt-val' }, r.text.value), html('span', { class: 'lc-tt-name' }, r.s.name));
      nodes.push(row);
      for (const [label, value] of r.text.details ?? []) {
        const detail = html('div', { class: 'lc-tt-row lc-tt-detail' });
        detail.append(html('span', { class: 'lc-tt-name' }, label), html('span', { class: 'lc-tt-val' }, value));
        nodes.push(detail);
      }
      if (r === lastStacked) {
        const total = stacked.reduce((sum, x) => sum + (isFinite(x.v) ? x.v : 0), 0);
        const middle = r !== rows[rows.length - 1] ? ' lc-tt-mid' : '';
        const totalRow = html('div', { class: 'lc-tt-row lc-tt-total' + middle });
        totalRow.append(
          html('span', { class: 'lc-tt-val' }, this.valueFormat(r.s)(total)),
          html('span', { class: 'lc-tt-name' }, 'Total'),
        );
        nodes.push(totalRow);
      }
    }
    this.tooltipEl.replaceChildren(...nodes);
    this.tooltipEl.classList.toggle('lc-show', this.floatOn);
  }

  /**
   * Junto al dato activo; se voltea si no cabe y nunca se sale del gráfico.
   * En vertical va al costado; en horizontal, debajo o encima de la barra.
   */
  private positionTooltip(): void {
    const L = this.layout;
    const frame = this.current;
    if (!L || !frame || this.active < 0 || !this.floatOn) return;
    const tt = this.tooltipEl;
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    const along = L.x.at(this.active);
    const gap = L.x.kind === 'band' ? L.x.bandwidth / 2 + 8 : 14;
    let x: number;
    let y: number;
    const radial = this.radialAnchor(frame, L);
    if (radial) {
      // Junto al punto de apoyo (la porción, el extremo del radio), del lado que quepa.
      const [px, py] = radial;
      // Del lado contrario al centro: no tapa la porción, la meta ni el vértice que se mira.
      const right = px >= L.left + L.plotW / 2;
      x = right ? px + 14 : px - 14 - w;
      if (x < 0 || x + w > L.width) x = right ? px - 14 - w : px + 14;
      y = py < L.top + L.plotH / 2 ? py - h - 10 : py + 10;
      // Arriba no cabe: debajo del punto, en vez de pegarlo al borde encima del dato que se mira.
      if (y < 0) y = py + 10;
    } else if (this.nearestMode()) {
      // Junto al punto: su posición en pantalla sale del primer valor visible en ese índice.
      const f = frame.series.find((s) => s.alpha >= 0.5 && isFinite(s.y1[this.active]));
      const v = f ? this.valueScale(frame, L, f.ps.axis).map(f.y1[this.active]) : 0;
      const [px, py] = L.horizontal ? [L.left + v, L.top + along] : [L.left + along, L.top + v];
      x = px + gap + w > L.width ? px - gap - w : px + gap;
      y = py - h / 2;
    } else if (L.horizontal) {
      const py = L.top + along;
      y = py + gap + h > L.height ? py - gap - h : py + gap;
      x = this.pointer.x >= 0 ? this.pointer.x - w / 2 : L.left;
    } else {
      const px = L.left + along;
      x = px + gap + w > L.width ? px - gap - w : px + gap;
      y = this.pointer.y >= 0 ? this.pointer.y - h / 2 : L.top;
    }
    x = Math.max(0, Math.min(L.width - w, x));
    y = Math.max(0, Math.min(L.height - h, y));
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /** Punto de apoyo del tooltip en pantalla para radar y tipos libres; null en cartesiano. */
  private radialAnchor(frame: Frame, L: Layout): [number, number] | null {
    const i = this.active;
    if (L.polar) {
      const [x, y] = this.spokeEnd(L, i);
      return [L.left + x, L.top + y];
    }
    if (this.coords !== 'free') return null;
    const f = frame.series.find((s) => s.alpha >= 0.5);
    const at = f?.ps.impl.anchor?.(this.drawContext(f, L, frame), i);
    if (at) return [L.left + at[0], L.top + at[1]];
    return this.pointer.x >= 0 ? [this.pointer.x, this.pointer.y] : [L.left + L.plotW / 2, L.top + L.plotH / 2];
  }

  private describe(i: number): string {
    const values = this.visibleAt(i).map(({ s, text }) => {
      const detail = text.details ? ` (${text.details.map(([k, v]) => `${k}: ${v}`).join('; ')})` : '';
      return `${s.name} ${text.value}${detail}`;
    });
    const selected = this.selectedIdx?.has(i) ? ' (en la selección)' : '';
    return `${this.headline(i)}${selected}: ${values.join(', ')}`;
  }

  // ------------------------------------------------------------ Exportar

  private exportSVG(pad = EXPORT_PAD): { markup: string; width: number; height: number } {
    const th = this.theme;
    const width = this.width ? this.width + 2 * pad : 640;
    const L = this.computeLayout(width - 2 * pad)!;
    const parts = this.renderParts(this.target, L, 'export');
    const family = L.font.slice(L.font.indexOf(' ') + 1);
    const text = (x: number, y: number, s: string, a: Record<string, string | number>) =>
      `<text${attrs({ x, y, ...a })}>${esc(s)}</text>`;

    let y = pad;
    let head = '';
    if (this.opts.title) {
      head += text(pad, y + 15, this.opts.title, { 'font-size': 15, 'font-weight': 600, fill: th.text });
      y += 21;
    }
    if (this.opts.subtitle) {
      head += text(pad, y + 13, this.opts.subtitle, { 'font-size': 13, fill: th.textMuted });
      y += 19;
    }
    if (head) y += 12;
    const plotY = y;
    y += L.height;

    let legend = '';
    if (this.legend.size) {
      const block = legendSVG(this.legendItems(), pad, y + 14, width - 2 * pad, family, th);
      legend = block.markup;
      y += 14 + block.height;
    }

    const height = Math.ceil(y + pad);
    // El mismo recorte de la vista en vivo: con zoom, lo que queda fuera de la ventana no se exporta.
    const zoomed = this.zoomable && !isFull(this.view);
    const clipId = `lc-export-clip-${++uid}`;
    const clip = `<clipPath id="${clipId}"><rect${attrs({ x: zoomed ? 0 : -CLIP_PAD, y: -CLIP_PAD, width: L.indexLen + (zoomed ? 0 : 2 * CLIP_PAD), height: L.valueLen + 2 * CLIP_PAD })}/></clipPath>`;
    const series = `<g clip-path="url(#${clipId})">${parts.series}</g>`;
    const data = clip + (L.horizontal ? `<g transform="${SWAP_AXES}">${series}</g>` : series);
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': family, role: 'img', 'aria-label': this.ariaLabel() })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      `<g transform="translate(${pad + L.left},${plotY + L.top})">${parts.grid}${data}${parts.notes}${parts.axes}</g>` +
      legend +
      `</svg>`;
    return { markup, width, height };
  }
}

/**
 * Dominio del valor que tendría un gráfico con estas opciones, sin dibujarlo; null si no hay
 * series visibles. Lo usan los small multiples para que todos los paneles compartan el eje.
 */
export function valueDomain(options: LozChartOptions, hidden: ReadonlySet<string>, ticks: number): [number, number] | null {
  const { data, xAxis, series, yAxis } = options;
  const input = { data, xField: xAxis.field, xType: xAxis.type ?? 'category', series, index: yAxis?.index };
  const p = prepare(input, registry, MAX_COLORS);
  if (p.series.every((s) => hidden.has(s.key))) return null;
  const f = buildFrame(p, hidden, {
    zero: yAxis?.zero,
    ticks,
    include: annotationValues(options.annotations, 'left'),
    log: yAxis?.type === 'log' && p.coords === 'cartesian',
  });
  return [f.d0, f.d1];
}

/** ¿El tipo de serie usa escala de banda (barras, velas)? */
export function usesBand(type: string): boolean {
  return !!registry.get(type)?.band;
}

/** Símbolo de leyenda de un tipo de serie registrado. */
export function seriesSymbol(type: string): 'line' | 'square' | 'dot' {
  return registry.get(type)?.legendSymbol ?? 'square';
}

/** Cuántos ticks caben en un eje vertical del valor de `height` px (el mismo criterio del gráfico). */
export function tickCountFor(height: number): number {
  return Math.max(2, Math.round((height - AXIS_ALLOWANCE) / TICK_SPACING_V));
}

/** Pone varios atributos a un elemento ya creado. */
function attrsOn(node: Element, a: Record<string, string | number>): void {
  for (const k in a) node.setAttribute(k, String(a[k]));
}
