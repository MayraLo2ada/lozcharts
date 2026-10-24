/**
 * LozChart: el núcleo.
 *
 * Ciclo de render:
 *   opciones → prepare()    datos ordenados y series con su posición en la paleta
 *            → buildFrame() cuadro destino: pilas y dominio Y "bonito"
 *            → transition() interpola del cuadro visible al destino (600 ms, ease-out)
 *            → draw()       escalas, rejilla, ejes y cada serie con su plugin
 *
 * La lógica de datos vive en core/ y es pura; esta clase maneja estado, DOM y eventos.
 */
import type { Datum, FormatSpec, LozChartOptions, ThemeName } from './types';
import type { DrawContext, PreparedSeries, SeriesFrame, SeriesImpl } from './core/series';
import { injectStyles, LIGHT, resolveTheme, themeVars, type Theme } from './core/theme';
import { BandScale, ContinuousScale, LinearScale, type XScale } from './core/scales';
import { niceStep, numberTicks } from './core/ticks';
import { axisFormatter, valueFormatter, type NumberContext } from './core/format';
import { prepare, type Prepared } from './core/prepare';
import { buildFrame, collapse, interpolate, withExits, type Frame } from './core/frame';
import { xLabel, xTicks, type XLabelContext } from './core/axis';
import { attrs, esc, html, prefersReducedMotion, resolveElement, svg, textWidth } from './core/dom';

const registry = new Map<string, SeriesImpl>();
const instances = new WeakMap<HTMLElement, LozChart>();
const live = new Set<LozChart>();
let uid = 0;

const DURATION = 600;
const FONT_SIZE = 12;
/** Margen del recorte del área de datos: deja respirar trazos y puntos en el borde. */
const CLIP_PAD = 6;
/** Alto aproximado por tick del eje Y. */
const TICK_SPACING = 56;
const EXPORT_PAD = 16;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Layout {
  width: number;
  height: number;
  left: number;
  top: number;
  plotW: number;
  plotH: number;
  x: XScale;
  yTicks: number[];
  yFormat: (v: number) => string;
  font: string;
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

  /** El gráfico montado en un elemento, si hay. */
  static getChart(target: string | HTMLElement): LozChart | undefined {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    return el ? instances.get(el) : undefined;
  }

  /**
   * Monta todos los elementos `[data-lozchart]` dentro de `root`. El atributo lleva las
   * opciones en JSON o el selector de un <script type="application/json">.
   * Pensado para HTMX: `htmx.onLoad((el) => LozChart.initAll(el))`.
   * Si un elemento ya tenía gráfico, lo reemplaza; y libera los que salieron de la página.
   */
  static initAll(root: ParentNode = document): LozChart[] {
    LozChart.cleanup();
    const nodes = [...root.querySelectorAll<HTMLElement>('[data-lozchart]')];
    if (root instanceof HTMLElement && root.hasAttribute('data-lozchart')) nodes.unshift(root);
    const charts: LozChart[] = [];
    for (const el of nodes) {
      const raw = el.getAttribute('data-lozchart')!.trim();
      try {
        const json = raw.startsWith('{') ? raw : (document.querySelector(raw)?.textContent ?? '');
        charts.push(new LozChart(el, JSON.parse(json) as LozChartOptions));
      } catch (err) {
        console.error('LozChart: no pude leer las opciones de', el, err);
      }
    }
    return charts;
  }

  /** Destruye los gráficos dentro de `root` (por ejemplo, en htmx:beforeSwap). */
  static destroyAll(root: ParentNode = document): void {
    for (const c of [...live]) if (root === c.element || root.contains(c.element)) c.destroy();
  }

  /** Destruye los gráficos cuyo elemento ya no está en el documento. */
  static cleanup(): void {
    for (const c of [...live]) if (!c.element.isConnected) c.destroy();
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
  private pointerY = -1;
  private theme: Theme = LIGHT;
  private destroyed = false;

  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly legendEl: HTMLDivElement;
  private readonly legendButtons = new Map<string, HTMLButtonElement>();
  private readonly plotEl: HTMLDivElement;
  private readonly svgEl: SVGSVGElement;
  private readonly gPlot: SVGGElement;
  private readonly gGrid: SVGGElement;
  private readonly gBand: SVGGElement;
  private readonly gSeries: SVGGElement;
  private readonly gAxes: SVGGElement;
  private readonly gHover: SVGGElement;
  private readonly overlay: SVGRectElement;
  private readonly clipRect: SVGRectElement;
  private readonly tooltipEl: HTMLDivElement;
  private readonly tableEl: HTMLTableElement;
  private readonly liveEl: HTMLDivElement;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly colorScheme: MediaQueryList | null;

  constructor(target: string | HTMLElement, options: LozChartOptions) {
    this.element = resolveElement(target);
    instances.get(this.element)?.destroy();
    instances.set(this.element, this);
    live.add(this);
    injectStyles(document);
    this.opts = normalize(options);

    const clipId = `lc-clip-${++uid}`;
    this.root = html('div', { class: 'lc-root' });
    this.header = html('div', { class: 'lc-header' });
    this.legendEl = html('div', { class: 'lc-legend', role: 'group', 'aria-label': 'Series: pulsa para mostrar u ocultar' });
    this.plotEl = html('div', { class: 'lc-plot' });
    this.svgEl = svg('svg', { class: 'lc-svg', role: 'img', tabindex: 0 });
    this.clipRect = svg('rect', { x: -CLIP_PAD, y: -CLIP_PAD });
    const clip = svg('clipPath', { id: clipId });
    clip.appendChild(this.clipRect);
    const defs = svg('defs');
    defs.appendChild(clip);
    this.gPlot = svg('g', { 'aria-hidden': 'true' });
    this.gGrid = svg('g');
    this.gBand = svg('g');
    this.gSeries = svg('g', { 'clip-path': `url(#${clipId})` });
    this.gAxes = svg('g');
    this.gHover = svg('g', { 'pointer-events': 'none' });
    this.overlay = svg('rect', { fill: 'transparent' });
    this.overlay.style.touchAction = 'pan-y';
    this.gPlot.append(this.gGrid, this.gBand, this.gSeries, this.gAxes, this.gHover, this.overlay);
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

  /** Cambia opciones (se combinan con las actuales) y redibuja. */
  setOptions(options: Partial<LozChartOptions>): this {
    const prev = this.opts;
    this.opts = normalize({
      ...prev,
      ...options,
      xAxis: { ...prev.xAxis, ...options.xAxis },
      yAxis: { ...prev.yAxis, ...options.yAxis },
    });
    if (options.series) this.resetVisibility();
    this.applyTheme();
    this.rebuild(true);
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

  /** SVG completo (título, subtítulo, gráfico y leyenda) como texto. */
  toSVG(): string {
    return this.exportSVG().markup;
  }

  /** Descarga el gráfico como PNG (al doble de resolución) o SVG. */
  async download(type: 'png' | 'svg' = 'png', filename?: string): Promise<void> {
    const name = filename || slug(this.opts.title ?? '') || 'lozchart';
    const { markup, width, height } = this.exportSVG();
    if (type === 'svg') {
      saveBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg');
      return;
    }
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    await img.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('LozChart: el navegador no permite canvas.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('LozChart: no pude generar el PNG.');
    saveBlob(blob, name + '.png');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.colorScheme?.removeEventListener('change', this.onColorScheme);
    this.root.remove();
    if (instances.get(this.element) === this) instances.delete(this.element);
    live.delete(this);
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
      ticks: this.yTickCount(),
    });
    this.renderTable();
    this.svgEl.setAttribute('aria-label', this.ariaLabel());
    if (this.active >= this.prepared.n) this.clearActive();
    else if (this.active >= 0) this.fillTooltip(this.active);
    this.transition(animate && this.opts.animate);
  }

  private yTickCount(): number {
    return Math.max(2, Math.round(this.opts.height / TICK_SPACING) - 1);
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
    const { opts: o, prepared: p, target: t } = this;
    const font = `${FONT_SIZE}px ${getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif'}`;
    // Los ticks del eje Y salen del dominio destino: quedan quietos durante la animación.
    const step = niceStep(t.d1 - t.d0, this.yTickCount());
    const yTicks = numberTicks(t.d0, t.d1, step);
    const yFormat = axisFormatter(o.yAxis?.format, this.numberContext(), step, Math.max(Math.abs(t.d0), Math.abs(t.d1)));
    const labelW = Math.max(0, ...yTicks.map((v) => textWidth(yFormat(v), font)));
    const left = Math.ceil(labelW) + 10;
    const top = (o.yAxis?.title ? 22 : 0) + 8;
    const bottom = FONT_SIZE + 12 + (o.xAxis.title ? 20 : 0);
    const right = p.band ? 0 : 8;
    const plotW = Math.max(10, width - left - right);
    const plotH = Math.max(10, o.height - top - bottom);
    const x: XScale = p.band
      ? new BandScale(p.n, plotW)
      : new ContinuousScale(p.xType === 'category' ? p.xRaw.map((_, i) => i) : p.xNum, plotW);
    return { width, height: o.height, left, top, plotW, plotH, x, yTicks, yFormat, font };
  }

  private draw(): void {
    const frame = this.current;
    const L = (this.layout = frame ? this.computeLayout(this.width) : null);
    if (!frame || !L) return;
    this.svgEl.setAttribute('width', String(L.width));
    this.svgEl.setAttribute('height', String(L.height));
    this.svgEl.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    this.gPlot.setAttribute('transform', `translate(${L.left},${L.top})`);
    this.clipRect.setAttribute('width', String(L.plotW + 2 * CLIP_PAD));
    this.clipRect.setAttribute('height', String(L.plotH + 2 * CLIP_PAD));
    this.overlay.setAttribute('width', String(L.plotW));
    this.overlay.setAttribute('height', String(L.plotH));

    const parts = this.renderParts(frame, L);
    this.gGrid.innerHTML = parts.grid;
    this.gSeries.innerHTML = parts.series;
    this.gAxes.innerHTML = parts.axes;
    if (this.active >= 0) {
      this.drawHover(frame, L);
      this.positionTooltip();
    }
  }

  /** Markup de rejilla, series y ejes. Sirve para la vista en vivo y para exportar. */
  private renderParts(frame: Frame, L: Layout): { grid: string; series: string; axes: string } {
    const th = this.theme;
    const y = this.yScale(frame, L);
    const hline = (py: number, color: string) =>
      `<line${attrs({ x1: 0, x2: L.plotW, y1: py, y2: py, stroke: color, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
    const label = (x: number | string, yy: number, text: string, extra: Record<string, string | number> = {}) =>
      `<text${attrs({ x, y: yy, fill: th.textMuted, 'font-size': FONT_SIZE, ...extra })}>${esc(text)}</text>`;

    // Rejilla de 1 px, sólida y discreta; la línea del cero un poco más marcada.
    let grid = '';
    let axes = '';
    for (const v of L.yTicks) {
      const py = Math.round(y.map(v)) + 0.5;
      if (py < -1 || py > L.plotH + 1) continue;
      grid += hline(py, v === 0 ? th.zero : th.grid);
      axes += label(-10, py, L.yFormat(v), { 'text-anchor': 'end', 'dominant-baseline': 'central' });
    }
    // Sin el cero a la vista, una base discreta abajo.
    if (frame.d0 > 0 || frame.d1 < 0) grid += hline(Math.round(L.plotH) + 0.5, th.zero);

    const measure = (s: string) => textWidth(s, L.font);
    for (const tk of xTicks(this.prepared, L.x, L.plotW, 2 - L.left, L.width - L.left - 2, measure, this.xContext())) {
      axes += label(tk.px.toFixed(1), L.plotH + 10, tk.label, { 'text-anchor': tk.anchor, 'dominant-baseline': 'hanging' });
    }
    const { yAxis, xAxis } = this.opts;
    if (yAxis?.title) axes += label(-L.left, -16, yAxis.title, { 'dominant-baseline': 'central' });
    if (xAxis.title)
      axes += label(L.plotW / 2, L.plotH + 30, xAxis.title, { 'text-anchor': 'middle', 'dominant-baseline': 'hanging' });

    // Series por capa: barras abajo, líneas arriba.
    let series = '';
    const layered = frame.series.slice().sort((a, b) => (a.ps.impl.layer ?? 1) - (b.ps.impl.layer ?? 1));
    for (const f of layered) {
      if (f.alpha <= 0.001) continue;
      const body = f.ps.impl.draw(this.drawContext(f, L, y, frame.n));
      if (!body) continue;
      const opacity = f.alpha < 0.999 ? f.alpha.toFixed(3) : undefined;
      series += `<g${attrs({ opacity, 'data-series': f.ps.key })}>${body}</g>`;
    }
    return { grid, series, axes };
  }

  private yScale(frame: Frame, L: Layout): LinearScale {
    return new LinearScale(frame.d0, frame.d1, L.plotH, 0);
  }

  private drawContext(frame: SeriesFrame, L: Layout, y: LinearScale, n: number): DrawContext {
    return { frame, color: this.colorOf(frame.ps), x: L.x, y, theme: this.theme, width: L.plotW, height: L.plotH, n };
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

  /** Crea los botones de la leyenda. Solo cuando cambian las series: así no se pierde el foco. */
  private buildLegend(): void {
    const lg = this.opts.legend;
    const series = this.prepared.series;
    this.legendButtons.clear();
    if (lg === false || series.length < 2) {
      this.legendEl.remove();
      return;
    }
    const top = typeof lg === 'object' && lg.position === 'top';
    this.legendEl.classList.toggle('lc-top', top);
    if (top) this.plotEl.before(this.legendEl);
    else this.plotEl.after(this.legendEl);
    this.legendEl.replaceChildren(
      ...series.map((s) => {
        const button = html('button', { type: 'button', class: 'lc-legend-btn' });
        const swatch = html('span', {
          class: 'lc-swatch' + (s.impl.legendSymbol === 'line' ? ' lc-line' : ''),
          'aria-hidden': 'true',
        });
        button.append(swatch, html('span', { class: 'lc-name' }, s.name));
        button.addEventListener('click', () => this.toggleSeries(s.key));
        this.legendButtons.set(s.key, button);
        return button;
      }),
    );
    this.syncLegend();
  }

  /** Actualiza estado y colores de la leyenda sin recrear los botones. */
  private syncLegend(): void {
    for (const s of this.prepared.series) {
      const button = this.legendButtons.get(s.key);
      if (!button) continue;
      button.setAttribute('aria-pressed', String(!this.hidden.has(s.key)));
      (button.firstElementChild as HTMLElement).style.background = this.colorOf(s);
    }
  }

  /** Tabla oculta con todos los datos, para lectores de pantalla. */
  private renderTable(): void {
    const p = this.prepared;
    const ctx = this.xContext();
    const formats = p.series.map((s) => this.valueFormat(s));
    const head = html('tr');
    head.appendChild(html('th', { scope: 'col' }, this.opts.xAxis.title ?? this.opts.xAxis.field));
    for (const s of p.series) head.appendChild(html('th', { scope: 'col' }, s.name));
    const body = html('tbody');
    for (let i = 0; i < p.n; i++) {
      const row = html('tr');
      row.appendChild(html('th', { scope: 'row' }, xLabel(p, i, false, ctx)));
      p.series.forEach((s, k) => row.appendChild(html('td', {}, isFinite(s.values[i]) ? formats[k](s.values[i]) : '—')));
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
    return `${title}${what} con ${count} y ${n} puntos. Usa las flechas izquierda y derecha para recorrer los datos.`;
  }

  // ------------------------------------------------------------ Hover, tooltip y teclado

  private bindEvents(): void {
    const point = (e: PointerEvent) => {
      const L = this.layout;
      if (!L || !this.opts.tooltip || !this.prepared.n) return;
      const box = this.svgEl.getBoundingClientRect();
      this.pointerY = e.clientY - box.top;
      this.setActive(L.x.indexAt(e.clientX - box.left - L.left), false);
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
      const i = this.active;
      let next: number;
      switch (e.key) {
        case 'ArrowRight':
          next = i < 0 ? 0 : Math.min(last, i + 1);
          break;
        case 'ArrowLeft':
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
      this.pointerY = -1;
      this.setActive(next, true);
    });
  }

  private setActive(i: number, announce: boolean): void {
    const changed = i !== this.active;
    this.active = i;
    const frame = this.current;
    const L = this.layout;
    if (!frame || !L) return;
    if (changed) {
      this.drawHover(frame, L);
      this.fillTooltip(i);
    }
    this.positionTooltip();
    if (announce) this.liveEl.textContent = this.describe(i);
  }

  private clearActive(): void {
    this.active = -1;
    this.gBand.replaceChildren();
    this.gHover.replaceChildren();
    this.tooltipEl.classList.remove('lc-show');
  }

  /** Banda resaltada (barras) o crosshair (líneas y áreas), más los puntos de cada serie. */
  private drawHover(frame: Frame, L: Layout): void {
    const i = this.active;
    const th = this.theme;
    const cx = L.x.at(i);
    const band = L.x.kind === 'band';
    const w = L.x.bandwidth;
    this.gBand.innerHTML = band
      ? `<rect${attrs({ x: (cx - w / 2).toFixed(2), y: 0, width: w.toFixed(2), height: L.plotH, fill: th.highlight, rx: 4 })}/>`
      : '';
    let marks = '';
    if (!band) {
      const px = Math.round(cx) + 0.5;
      marks += `<line${attrs({ x1: px, x2: px, y1: 0, y2: L.plotH, stroke: th.textMuted, 'stroke-width': 1, 'stroke-opacity': 0.6, 'shape-rendering': 'crispEdges' })}/>`;
    }
    const y = this.yScale(frame, L);
    for (const f of frame.series) {
      if (f.alpha >= 0.5 && f.ps.impl.hover) marks += f.ps.impl.hover(this.drawContext(f, L, y, frame.n), i);
    }
    this.gHover.innerHTML = marks;
  }

  private visibleAt(i: number) {
    return this.prepared.series
      .filter((s) => !this.hidden.has(s.key))
      .map((s) => ({ s, v: s.values[i], text: isFinite(s.values[i]) ? this.valueFormat(s)(s.values[i]) : 'Sin dato' }));
  }

  /** El tooltip se arma con textContent: los datos del usuario nunca pasan por innerHTML. */
  private fillTooltip(i: number): void {
    const rows = this.visibleAt(i);
    // Total si hay 2 o más series visibles en una misma pila; va justo debajo de ellas.
    const stacked = rows.filter((r) => r.s.stackKey);
    const oneStack = stacked.length >= 2 && stacked.every((r) => r.s.stackKey === stacked[0].s.stackKey);
    const lastStacked = oneStack ? stacked[stacked.length - 1] : null;
    const nodes: HTMLElement[] = [html('div', { class: 'lc-tt-head' }, xLabel(this.prepared, i, false, this.xContext()))];
    for (const r of rows) {
      const row = html('div', { class: 'lc-tt-row' });
      const key = html('span', { class: 'lc-tt-key' });
      key.style.background = this.colorOf(r.s);
      row.append(key, html('span', { class: 'lc-tt-val' }, r.text), html('span', { class: 'lc-tt-name' }, r.s.name));
      nodes.push(row);
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

  /** Al lado del punto activo; se voltea si no cabe y nunca se sale del gráfico. */
  private positionTooltip(): void {
    const L = this.layout;
    if (!L || this.active < 0) return;
    const tt = this.tooltipEl;
    const cx = L.left + L.x.at(this.active);
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    const gap = L.x.kind === 'band' ? L.x.bandwidth / 2 + 8 : 14;
    let x = cx + gap;
    if (x + w > L.width) x = cx - gap - w;
    x = Math.max(0, Math.min(L.width - w, x));
    const y = Math.max(0, Math.min(L.height - h, this.pointerY >= 0 ? this.pointerY - h / 2 : L.top));
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private describe(i: number): string {
    const values = this.visibleAt(i).map((r) => `${r.s.name} ${r.text}`);
    return `${xLabel(this.prepared, i, false, this.xContext())}: ${values.join(', ')}`;
  }

  // ------------------------------------------------------------ Exportar

  private exportSVG(): { markup: string; width: number; height: number } {
    const th = this.theme;
    const pad = EXPORT_PAD;
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

    // Leyenda con salto de línea cuando no cabe.
    let legend = '';
    if (this.legendButtons.size) {
      y += 14;
      let x = pad;
      for (const s of this.prepared.series) {
        const itemW = 12 + 8 + textWidth(s.name, `13px ${family}`) + 20;
        if (x + itemW > width - pad && x > pad) {
          x = pad;
          y += 22;
        }
        const on = !this.hidden.has(s.key);
        const color = this.colorOf(s);
        legend +=
          s.impl.legendSymbol === 'line'
            ? `<rect${attrs({ x, y: y + 5, width: 14, height: 3, rx: 1.5, fill: on ? color : th.textMuted })}/>`
            : `<rect${attrs({ x, y, width: 12, height: 12, rx: 3, fill: on ? color : 'none', stroke: on ? undefined : th.textMuted, 'stroke-width': on ? undefined : 1.5 })}/>`;
        legend += text(x + 20, y + 6, s.name, {
          'font-size': 13,
          fill: on ? th.text : th.textMuted,
          'dominant-baseline': 'central',
        });
        x += itemW;
      }
      y += 12;
    }

    const height = Math.ceil(y + pad);
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': family, role: 'img', 'aria-label': this.ariaLabel() })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      `<g transform="translate(${pad + L.left},${plotY + L.top})">${parts.grid}${parts.series}${parts.axes}</g>` +
      legend +
      `</svg>`;
    return { markup, width, height };
  }
}

/** "Ventas por mes" → "ventas-por-mes". */
function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = html('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
