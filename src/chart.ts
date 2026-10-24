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
import type { Datum, FormatSpec, LozChartOptions, MultiplesOptions, ThemeName } from './types';
import type { LozMultiples } from './multiples';
import type { DrawContext, PreparedSeries, SeriesFrame, SeriesImpl, TooltipFormat, TooltipValue } from './core/series';
import { injectStyles, LIGHT, MAX_COLORS, resolveTheme, themeVars, type Theme } from './core/theme';
import { BandScale, ContinuousScale, LinearScale, type XScale } from './core/scales';
import { niceDomain, niceStep, numberTicks } from './core/ticks';
import { axisFormatter, valueFormatter, type NumberContext } from './core/format';
import { prepare, type Prepared } from './core/prepare';
import { buildFrame, collapse, interpolate, withExits, type Frame } from './core/frame';
import { indexLabels, xLabel, xTicks, type XLabelContext } from './core/axis';
import { attrs, esc, html, prefersReducedMotion, resolveElement, svg, textWidth } from './core/dom';
import { Legend, legendSVG, type LegendItem } from './core/legend';
import { downloadImage, slug } from './core/export';
import { destroyDetached, destroyWithin, mount, mountedOn, unmount } from './core/mount';

const registry = new Map<string, SeriesImpl>();
let uid = 0;

const DURATION = 600;
const FONT_SIZE = 12;
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
  /** Largo del eje del índice y del eje del valor (el plano lógico). */
  indexLen: number;
  valueLen: number;
  x: XScale;
  valueTicks: number[];
  valueFormat: (v: number) => string;
  font: string;
}

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
    height: o.height ?? 320,
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
        console.error('LozChart: no pude leer las opciones de', el, err);
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
  private prepared!: Prepared;
  private target!: Frame;
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
  private readonly gAxes: SVGGElement;
  private readonly overlay: SVGRectElement;
  private readonly clipRect: SVGRectElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly tableEl: HTMLTableElement;
  private readonly liveEl: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly colorScheme: MediaQueryList | null;

  constructor(target: string | HTMLElement, options: LozChartOptions) {
    this.element = resolveElement(target);
    mount(this);
    injectStyles(document);
    this.opts = normalize(options);

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
    this.gBand = svg('g');
    this.gSeries = svg('g', { 'clip-path': `url(#${clipId})` });
    this.gHover = svg('g', { 'pointer-events': 'none' });
    this.gAxes = svg('g');
    this.overlay = svg('rect', { fill: 'transparent' });
    this.gData.append(this.gBand, this.gSeries, this.gHover);
    this.gPlot.append(this.gGrid, this.gData, this.gAxes, this.overlay);
    this.svgEl.append(defs, this.gPlot);
    this.tooltipEl = html('div', { class: 'lc-tooltip', 'aria-hidden': 'true' });
    this.plotEl.append(this.svgEl, this.tooltipEl);
    this.tableEl = html('table');
    const tableBox = html('div', { class: 'lc-sr-only' });
    tableBox.appendChild(this.tableEl);
    this.liveEl = html('div', { class: 'lc-sr-only', 'aria-live': 'polite' });
    this.root.append(this.header, this.plotEl, tableBox, this.liveEl);
    this.element.replaceChildren(this.root);

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
    this.opts.data = Array.isArray(data) ? data : [];
    this.prepared = this.prepare();
    this.update(true);
    return this;
  }

  /** Cambia opciones (se combinan con las actuales) y redibuja, animando salvo que se pida lo contrario. */
  setOptions(options: Partial<LozChartOptions>, animate = true): this {
    const prev = this.opts;
    this.opts = normalize({
      ...prev,
      ...options,
      xAxis: { ...prev.xAxis, ...options.xAxis },
      yAxis: { ...prev.yAxis, ...options.yAxis },
    });
    if (options.series) this.resetVisibility();
    this.applyTheme();
    this.rebuild(animate);
    return this;
  }

  setTheme(theme: ThemeName): this {
    this.opts.theme = theme;
    this.refreshTheme();
    return this;
  }

  /** Oculta o muestra una serie por su nombre. Las demás conservan su color. */
  toggleSeries(name: string, visible = this.hidden.has(name)): this {
    if (visible) this.hidden.delete(name);
    else this.hidden.add(name);
    this.syncLegend();
    this.update(true);
    return this;
  }

  /** Nombres de las series visibles. */
  get visibleSeries(): string[] {
    return this.prepared.series.filter((s) => !this.hidden.has(s.key)).map((s) => s.key);
  }

  /** SVG completo (título, subtítulo, gráfico y leyenda) como texto. `padding`: margen alrededor (16 px). */
  toSVG({ padding = EXPORT_PAD }: { padding?: number } = {}): string {
    return this.exportSVG(padding).markup;
  }

  /** Descarga el gráfico como PNG (al doble de resolución) o SVG. */
  download(type: 'png' | 'svg' = 'png', filename?: string): Promise<void> {
    const { markup, width, height } = this.exportSVG();
    return downloadImage(markup, width, height, type, filename || slug(this.opts.title ?? '') || 'lozchart');
  }

  /**
   * Marca el dato cuya X vale `x` (sin tooltip), o limpia la marca con null.
   * Sirve para sincronizar el puntero entre varios gráficos (ver la opción onHover).
   */
  highlight(x: unknown): this {
    const i = x === null || x === undefined ? -1 : this.indexOfX(x);
    if (i < 0) {
      this.clearActive(false);
      return this;
    }
    this.active = i;
    this.tooltipEl.classList.remove('lc-show');
    if (this.current && this.layout) this.drawHover(this.current, this.layout);
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
    return prepare({ data, xField: xAxis.field, xType: xAxis.type ?? 'category', series }, registry, this.theme.palette.length);
  }

  private update(animate: boolean): void {
    if (this.destroyed) return;
    const ya = this.opts.yAxis;
    this.target = buildFrame(this.prepared, this.hidden, {
      min: ya?.min,
      max: ya?.max,
      zero: ya?.zero,
      ticks: this.valueTickCount(),
    });
    this.renderTable();
    this.svgEl.setAttribute('aria-label', this.ariaLabel());
    if (this.active >= this.prepared.n) this.clearActive();
    else if (this.active >= 0) this.fillTooltip(this.active);
    this.transition(animate && this.opts.animate);
  }

  private get horizontal(): boolean {
    return this.opts.orientation === 'horizontal';
  }

  /**
   * Cuántos ticks caben en un eje del valor de `length` px. Antes del primer layout se estima
   * el largo: el alto menos los márgenes, o tres cuartos del ancho en horizontal.
   */
  private valueTickCount(length = this.horizontal ? (this.width || 600) * 0.75 : this.opts.height - AXIS_ALLOWANCE): number {
    return Math.max(2, Math.round(length / (this.horizontal ? TICK_SPACING_H : TICK_SPACING_V)));
  }

  /**
   * Interpola del cuadro visible al destino. Si llega otra actualización a mitad de camino,
   * se parte de lo que se está mostrando, así nunca hay saltos.
   */
  private transition(animate: boolean): void {
    cancelAnimationFrame(this.raf);
    if (!animate || !this.width || prefersReducedMotion()) {
      this.anim = null;
      this.current = this.target;
      this.draw();
      return;
    }
    const from = this.current ?? collapse(this.target);
    this.anim = { from, to: withExits(from, this.target), start: performance.now() };
    const tick = (now: number) => {
      if (!this.anim || this.destroyed) return;
      const t = Math.min(1, (now - this.anim.start) / DURATION);
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

  private computeLayout(width: number): Layout | null {
    if (!width) return null;
    const { opts: o, prepared: p, target: t, horizontal } = this;
    const font = `${FONT_SIZE}px ${getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif'}`;
    const measure = (s: string) => textWidth(s, font);
    const valueTitle = o.yAxis?.title;
    const indexTitle = o.xAxis.title;
    // Arriba a la izquierda va el título del eje vertical; abajo al centro, el del horizontal.
    const top = ((horizontal ? indexTitle : valueTitle) ? 22 : 0) + 8;
    const valueLabels = o.yAxis?.labels !== false;
    const bottom = (horizontal && !valueLabels ? 8 : FONT_SIZE + 12) + ((horizontal ? valueTitle : indexTitle) ? 20 : 0);
    const plotH = Math.max(10, o.height - top - bottom);

    let left: number;
    let right: number;
    if (horizontal) {
      const labels = p.xRaw.map((_, i) => measure(xLabel(p, i, true, this.xContext())));
      left = Math.ceil(Math.min(Math.max(0, ...labels), width * MAX_LABEL_SHARE)) + 10;
      right = 0;
    } else {
      left = 0;
      right = p.band ? 0 : 8;
    }

    // Ticks del valor salen del dominio destino: quedan quietos durante la animación.
    const valueLen0 = horizontal ? width - left : plotH;
    const step = niceStep(t.d1 - t.d0, this.valueTickCount(valueLen0));
    const valueTicks = numberTicks(t.d0, t.d1, step);
    const valueFormat = axisFormatter(o.yAxis?.format, this.numberContext(), step, Math.max(Math.abs(t.d0), Math.abs(t.d1)));
    if (!valueLabels) {
      // Sin números en el eje (small multiples fuera de la primera columna): solo un respiro.
      if (!horizontal) left = 4;
    } else if (horizontal) {
      // La última etiqueta del valor va centrada en el borde: que no se salga.
      right = Math.ceil(measure(valueFormat(valueTicks[valueTicks.length - 1] ?? 0)) / 2) + 2;
    } else {
      left = Math.ceil(Math.max(0, ...valueTicks.map((v) => measure(valueFormat(v))))) + 10;
    }
    const plotW = Math.max(10, width - left - right);
    const indexLen = horizontal ? plotH : plotW;
    const valueLen = horizontal ? plotW : plotH;
    return {
      valueLabels,
      width,
      height: o.height,
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
      font,
    };
  }

  /** Escala del índice: banda si hay barras o velas; continua si no (números con extremos "bonitos"). */
  private indexScale(length: number): XScale {
    const p = this.prepared;
    if (p.band) return new BandScale(p.n, length);
    if (p.xType === 'category')
      return new ContinuousScale(
        p.xRaw.map((_, i) => i),
        length,
      );
    if (p.xType === 'linear' && p.n) {
      const [lo, hi] = niceDomain(p.xNum[0], p.xNum[p.n - 1], Math.max(2, Math.floor(length / 80)));
      return new ContinuousScale(p.xNum, length, [lo, hi]);
    }
    return new ContinuousScale(p.xNum, length);
  }

  /** Escala del valor: en vertical crece hacia arriba; en horizontal, hacia la derecha. */
  private valueScale(frame: Frame, L: Layout): LinearScale {
    return L.horizontal ? new LinearScale(frame.d0, frame.d1, 0, L.valueLen) : new LinearScale(frame.d0, frame.d1, L.valueLen, 0);
  }

  private draw(): void {
    const frame = this.current;
    const L = (this.layout = frame ? this.computeLayout(this.width) : null);
    if (!frame || !L) return;
    this.svgEl.setAttribute('width', String(L.width));
    this.svgEl.setAttribute('height', String(L.height));
    this.svgEl.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    this.gPlot.setAttribute('transform', `translate(${L.left},${L.top})`);
    if (L.horizontal) this.gData.setAttribute('transform', SWAP_AXES);
    else this.gData.removeAttribute('transform');
    this.clipRect.setAttribute('width', String(L.indexLen + 2 * CLIP_PAD));
    this.clipRect.setAttribute('height', String(L.valueLen + 2 * CLIP_PAD));
    this.overlay.setAttribute('width', String(L.plotW));
    this.overlay.setAttribute('height', String(L.plotH));
    this.overlay.style.touchAction = L.horizontal ? 'pan-x' : 'pan-y';

    const parts = this.renderParts(frame, L);
    this.gGrid.innerHTML = parts.grid;
    this.gSeries.innerHTML = parts.series;
    this.gAxes.innerHTML = parts.axes;
    if (this.active >= 0) {
      this.drawHover(frame, L);
      this.positionTooltip();
    }
  }

  /** Markup de rejilla, series (plano lógico) y ejes. Sirve para la vista en vivo y para exportar. */
  private renderParts(frame: Frame, L: Layout): { grid: string; series: string; axes: string } {
    const th = this.theme;
    const vs = this.valueScale(frame, L);
    const line = (x1: number, y1: number, x2: number, y2: number, color: string) =>
      `<line${attrs({ x1, y1, x2, y2, stroke: color, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
    const label = (x: number | string, y: number | string, text: string, extra: Record<string, string | number> = {}) =>
      `<text${attrs({ x, y, fill: th.textMuted, 'font-size': FONT_SIZE, ...extra })}>${esc(text)}</text>`;
    const measure = (s: string) => textWidth(s, L.font);

    // Rejilla de 1 px, sólida y discreta; la línea del cero un poco más marcada.
    let grid = '';
    let axes = '';
    for (const v of L.valueTicks) {
      const pos = Math.round(vs.map(v)) + 0.5;
      if (pos < -1 || pos > L.valueLen + 1) continue;
      const color = v === 0 ? th.zero : th.grid;
      const text = L.valueFormat(v);
      if (L.horizontal) {
        grid += line(pos, 0, pos, L.plotH, color);
        if (L.valueLabels) axes += label(pos, L.plotH + 10, text, { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });
      } else {
        grid += line(0, pos, L.plotW, pos, color);
        if (L.valueLabels) axes += label(-10, pos, text, { 'text-anchor': 'end', 'dominant-baseline': 'central' });
      }
    }
    // Sin el cero a la vista, una base discreta del lado del mínimo.
    if (frame.d0 > 0 || frame.d1 < 0) {
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
    } else {
      for (const tk of xTicks(this.prepared, L.x, L.plotW, 2 - L.left, L.width - L.left - 2, measure, ctx)) {
        axes += label(tk.px.toFixed(1), L.plotH + 10, tk.label, { 'text-anchor': tk.anchor, 'dominant-baseline': 'hanging' });
      }
    }
    const topTitle = L.horizontal ? this.opts.xAxis.title : this.opts.yAxis?.title;
    const bottomTitle = L.horizontal ? this.opts.yAxis?.title : this.opts.xAxis.title;
    if (topTitle) axes += label(-L.left, -16, topTitle, { 'dominant-baseline': 'central' });
    if (bottomTitle)
      axes += label(L.plotW / 2, L.plotH + 30, bottomTitle, { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });

    // Series por capa: barras abajo, líneas y puntos arriba.
    let series = '';
    const layered = frame.series.slice().sort((a, b) => (a.ps.impl.layer ?? 1) - (b.ps.impl.layer ?? 1));
    for (const f of layered) {
      if (f.alpha <= 0.001) continue;
      const body = f.ps.impl.draw(this.drawContext(f, L, vs, frame.n));
      if (!body) continue;
      const opacity = f.alpha < 0.999 ? f.alpha.toFixed(3) : undefined;
      series += `<g${attrs({ opacity, 'data-series': f.ps.key })}>${body}</g>`;
    }
    return { grid, series, axes };
  }

  private drawContext(frame: SeriesFrame, L: Layout, y: LinearScale, n: number): DrawContext {
    return { frame, color: this.colorOf(frame.ps), x: L.x, y, theme: this.theme, width: L.indexLen, height: L.valueLen, n };
  }

  /** El color sale del tema actual y la posición de la serie, nunca de su visibilidad. */
  private colorOf(s: PreparedSeries): string {
    return s.slot < 0 ? this.theme.other : this.theme.palette[s.slot];
  }

  private xContext(): XLabelContext {
    return { ...this.numberContext(), format: this.opts.xAxis.format };
  }

  private numberContext(): NumberContext {
    return { locale: this.opts.locale, currency: this.opts.currency };
  }

  /** El tooltip y la tabla muestran el valor exacto, no la versión compacta del eje. */
  private valueFormat(s: PreparedSeries): (v: number) => string {
    const spec: FormatSpec | undefined = s.options.format ?? this.opts.yAxis?.format;
    return valueFormatter(spec === 'auto' || spec === 'compact' ? 'number' : spec, this.numberContext());
  }

  /** Lo que dice el tooltip (y la tabla) de una serie en un índice. */
  private valueText(s: PreparedSeries, i: number): TooltipValue {
    const format: TooltipFormat = { value: this.valueFormat(s), number: valueFormatter('number', this.numberContext()) };
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

  private renderHeader(): void {
    const { title, subtitle } = this.opts;
    this.header.replaceChildren();
    if (title) this.header.appendChild(html('div', { class: 'lc-title' }, title));
    if (subtitle) this.header.appendChild(html('div', { class: 'lc-subtitle' }, subtitle));
    this.header.hidden = !title && !subtitle;
  }

  private legendItems(): LegendItem[] {
    return this.prepared.series.map((s) => ({
      key: s.key,
      name: s.name,
      color: this.colorOf(s),
      symbol: s.impl.legendSymbol ?? 'square',
      visible: !this.hidden.has(s.key),
    }));
  }

  /** Leyenda solo con 2 o más series. Los botones se crean al cambiar las series, no en cada clic. */
  private buildLegend(): void {
    const lg = this.opts.legend;
    if (lg === false || this.prepared.series.length < 2) {
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
    for (let i = 0; i < p.n; i++) {
      const row = html('tr');
      row.appendChild(html('th', { scope: 'row' }, xLabel(p, i, false, ctx)));
      for (const s of p.series) {
        const t = this.valueText(s, i);
        row.appendChild(html('td', {}, t.details ? t.details.map(([k, v]) => `${k}: ${v}`).join('; ') : t.value));
      }
      body.appendChild(row);
    }
    const thead = html('thead');
    thead.appendChild(head);
    this.tableEl.replaceChildren(html('caption', {}, this.opts.title ?? 'Datos del gráfico'), thead, body);
  }

  private ariaLabel(): string {
    if (this.opts.ariaLabel) return this.opts.ariaLabel;
    const { series, n } = this.prepared;
    const kinds = [...new Set(series.map((s) => s.impl.label ?? s.options.type))];
    const what = kinds.length ? 'Gráfico de ' + kinds.join(' y ') : 'Gráfico';
    const title = this.opts.title ? `${this.opts.title}. ` : '';
    const count = `${series.length} ${series.length === 1 ? 'serie' : 'series'}`;
    const keys = this.horizontal ? 'arriba y abajo' : 'izquierda y derecha';
    return `${title}${what} con ${count} y ${n} puntos. Usa las flechas ${keys} para recorrer los datos.`;
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
      if (!L || !this.opts.tooltip || !this.prepared.n) return;
      const box = this.svgEl.getBoundingClientRect();
      this.pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
      this.setActive(this.indexAtPointer(L), false);
    };
    this.overlay.addEventListener('pointermove', point);
    this.overlay.addEventListener('pointerdown', point);
    this.overlay.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.clearActive();
    });
    this.svgEl.addEventListener('blur', () => this.clearActive());
    this.svgEl.addEventListener('keydown', (e) => {
      const last = this.prepared.n - 1;
      if (last < 0) return;
      const [back, forward] = this.horizontal ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
      const i = this.active;
      let next: number;
      switch (e.key) {
        case forward:
          next = i < 0 ? 0 : Math.min(last, i + 1);
          break;
        case back:
          next = i < 0 ? last : Math.max(0, i - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = last;
          break;
        case 'Escape':
          this.clearActive();
          return;
        default:
          return;
      }
      e.preventDefault();
      this.pointer = { x: -1, y: -1 };
      this.setActive(next, true);
    });
  }

  /** Índice bajo el puntero: por su posición en el eje del índice, o el punto más cercano. */
  private indexAtPointer(L: Layout): number {
    // Coordenadas del puntero en el plano lógico (índice, valor).
    const sx = this.pointer.x - L.left;
    const sy = this.pointer.y - L.top;
    const [li, lv] = L.horizontal ? [sy, sx] : [sx, sy];
    const frame = this.current;
    if (!frame || !this.nearestMode()) return L.x.indexAt(li);
    const vs = this.valueScale(frame, L);
    let best = 0;
    let bestDist = Infinity;
    for (const f of frame.series) {
      if (f.alpha < 0.5) continue;
      for (let i = 0; i < frame.n; i++) {
        if (!isFinite(f.y1[i])) continue;
        const d = Math.hypot(L.x.at(i) - li, vs.map(f.y1[i]) - lv);
        if (d < bestDist) [best, bestDist] = [i, d];
      }
    }
    return best;
  }

  /** Activa el índice i desde el puntero o el teclado: marcas, tooltip y aviso a onHover. */
  private setActive(i: number, announce: boolean): void {
    const changed = i !== this.active;
    this.active = i;
    const frame = this.current;
    const L = this.layout;
    if (!frame || !L) return;
    // También si el índice venía marcado por highlight(): ahí no había tooltip.
    if (changed || !this.tooltipEl.classList.contains('lc-show')) {
      this.drawHover(frame, L);
      this.fillTooltip(i);
    }
    this.positionTooltip();
    if (announce) this.liveEl.textContent = this.describe(i);
    if (changed) this.opts.onHover?.(this.xKey(i));
  }

  /** @param notify avisar a onHover (no cuando la limpieza viene de highlight). */
  private clearActive(notify = true): void {
    const was = this.active;
    this.active = -1;
    this.gBand.replaceChildren();
    this.gHover.replaceChildren();
    this.tooltipEl.classList.remove('lc-show');
    if (notify && was >= 0) this.opts.onHover?.(null);
  }

  /** Clave de la X en el índice i: el texto de la categoría, o el número (fecha en ms) en tiempo y numérico. */
  private xKey(i: number): string | number {
    const p = this.prepared;
    return p.xType === 'category' ? String(p.xRaw[i]) : p.xNum[i];
  }

  private indexOfX(x: unknown): number {
    const p = this.prepared;
    const key = p.xType === 'category' ? String(x) : x instanceof Date ? x.getTime() : Number(x);
    for (let i = 0; i < p.n; i++) if (this.xKey(i) === key) return i;
    return -1;
  }

  /** Banda resaltada (barras) o crosshair (líneas y áreas), más las marcas de cada serie. Plano lógico. */
  private drawHover(frame: Frame, L: Layout): void {
    const i = this.active;
    const th = this.theme;
    const cx = L.x.at(i);
    const band = L.x.kind === 'band';
    const w = L.x.bandwidth;
    this.gBand.innerHTML = band
      ? `<rect${attrs({ x: (cx - w / 2).toFixed(2), y: 0, width: w.toFixed(2), height: L.valueLen, fill: th.highlight, rx: 4 })}/>`
      : '';
    let marks = '';
    if (!band && !this.nearestMode()) {
      const px = Math.round(cx) + 0.5;
      marks += `<line${attrs({ x1: px, x2: px, y1: 0, y2: L.valueLen, stroke: th.textMuted, 'stroke-width': 1, 'stroke-opacity': 0.6, 'shape-rendering': 'crispEdges' })}/>`;
    }
    const vs = this.valueScale(frame, L);
    for (const f of frame.series) {
      if (f.alpha >= 0.5 && f.ps.impl.hover) marks += f.ps.impl.hover(this.drawContext(f, L, vs, frame.n), i);
    }
    this.gHover.innerHTML = marks;
  }

  private visibleAt(i: number): Row[] {
    return this.prepared.series
      .filter((s) => !this.hidden.has(s.key))
      .map((s) => ({ s, v: s.values[i], text: this.valueText(s, i) }));
  }

  /** Encabezado del tooltip: la X completa; si es un número con título de eje, también el título. */
  private headline(i: number): string {
    const label = xLabel(this.prepared, i, false, this.xContext());
    const title = this.opts.xAxis.title;
    return this.prepared.xType === 'linear' && title ? `${title}: ${label}` : label;
  }

  /** El tooltip se arma con textContent: los datos del usuario nunca pasan por innerHTML. */
  private fillTooltip(i: number): void {
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
      key.style.background = this.colorOf(r.s);
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
    this.tooltipEl.classList.toggle('lc-show', this.opts.tooltip);
  }

  /**
   * Junto al dato activo; se voltea si no cabe y nunca se sale del gráfico.
   * En vertical va al costado; en horizontal, debajo o encima de la barra.
   */
  private positionTooltip(): void {
    const L = this.layout;
    const frame = this.current;
    if (!L || !frame || this.active < 0) return;
    const tt = this.tooltipEl;
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    const along = L.x.at(this.active);
    const gap = L.x.kind === 'band' ? L.x.bandwidth / 2 + 8 : 14;
    let x: number;
    let y: number;
    if (this.nearestMode()) {
      // Junto al punto: su posición en pantalla sale del primer valor visible en ese índice.
      const vs = this.valueScale(frame, L);
      const f = frame.series.find((s) => s.alpha >= 0.5 && isFinite(s.y1[this.active]));
      const v = f ? vs.map(f.y1[this.active]) : 0;
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

  private describe(i: number): string {
    const values = this.visibleAt(i).map(({ s, text }) => {
      const detail = text.details ? ` (${text.details.map(([k, v]) => `${k} ${v}`).join(', ')})` : '';
      return `${s.name} ${text.value}${detail}`;
    });
    return `${this.headline(i)}: ${values.join(', ')}`;
  }

  // ------------------------------------------------------------ Exportar

  private exportSVG(pad = EXPORT_PAD): { markup: string; width: number; height: number } {
    const th = this.theme;
    const width = this.width ? this.width + 2 * pad : 640;
    const L = this.computeLayout(width - 2 * pad)!;
    const parts = this.renderParts(this.target, L);
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
    const data = L.horizontal ? `<g transform="${SWAP_AXES}">${parts.series}</g>` : parts.series;
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': family, role: 'img', 'aria-label': this.ariaLabel() })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      `<g transform="translate(${pad + L.left},${plotY + L.top})">${parts.grid}${data}${parts.axes}</g>` +
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
  const p = prepare({ data, xField: xAxis.field, xType: xAxis.type ?? 'category', series }, registry, MAX_COLORS);
  if (p.series.every((s) => hidden.has(s.key))) return null;
  const f = buildFrame(p, hidden, { zero: yAxis?.zero, ticks });
  return [f.d0, f.d1];
}

/** Símbolo de leyenda de un tipo de serie registrado. */
export function seriesSymbol(type: string): 'line' | 'square' | 'dot' {
  return registry.get(type)?.legendSymbol ?? 'square';
}

/** Cuántos ticks caben en un eje vertical del valor de `height` px (el mismo criterio del gráfico). */
export function tickCountFor(height: number): number {
  return Math.max(2, Math.round((height - AXIS_ALLOWANCE) / TICK_SPACING_V));
}
