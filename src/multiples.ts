/**
 * Small multiples: una cuadrícula de gráficos pequeños, uno por serie o por valor de un campo.
 *
 * Para que comparar sea honesto, todos los paneles comparten el eje del valor y las mismas X.
 * El puntero se sincroniza (todos marcan el mismo dato), la leyenda es una sola y los números
 * del eje solo aparecen en la primera columna.
 */
import type { LozChartOptions, MultiplesOptions, MultiplesUpdate, ThemeName, YAxisOptions } from './types';
import { AXIS_GAP, LozChart, seriesSymbol, tickCountFor, usesBand, valueDomain, X_LABEL_SPACE } from './chart';
import { facetPanels, type PanelSpec } from './core/facet';
import { attrs, esc, html, resolveElement } from './core/dom';
import { csvDate, downloadCSV, downloadImage, fileName, toCSV } from './core/export';
import { Legend, legendSVG, type LegendItem } from './core/legend';
import { mount, unmount, type Mounted } from './core/mount';
import { injectStyles, MAX_COLORS, resolveTheme, themeVars, type Theme } from './core/theme';
import { niceDomain } from './core/ticks';

const PANEL_HEIGHT = 180;
const MIN_WIDTH = 240;
const EXPORT_PAD = 16;

/** Dónde está un panel en la cuadrícula: decide qué etiquetas lleva. */
interface Edges {
  /** Primera columna: lleva los números del eje del valor. */
  left: boolean;
  /** Último de su columna: lleva las etiquetas del eje X. */
  bottom: boolean;
}

interface Panel {
  name: string;
  el: HTMLDivElement;
  chart: LozChart;
  edges: Edges;
  /** Ancho reservado hoy para los números del eje Y (yAxis.width). */
  axisWidth?: number;
}

/** Extremos comunes del eje del valor (vacío si cada panel lleva el suyo). */
type Range = Pick<YAxisOptions, 'min' | 'max'>;

export class LozMultiples implements Mounted {
  readonly element: HTMLElement;
  private opts: MultiplesOptions;
  private panels: Panel[] = [];
  private readonly hidden = new Set<string>();
  private theme: Theme;
  private destroyed = false;

  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly legend = new Legend((key) => this.toggleSeries(key));
  private readonly resizeObserver: ResizeObserver | null;
  private readonly colorScheme: MediaQueryList | null;

  constructor(target: string | HTMLElement, options: MultiplesOptions) {
    this.element = resolveElement(target);
    mount(this);
    injectStyles(document);
    this.opts = options;
    this.root = html('div', { class: 'lc-root lc-multiples-root' });
    this.header = html('div', { class: 'lc-header' });
    this.grid = html('div', { class: 'lc-multiples', role: 'group' });
    this.root.append(this.header, this.grid);
    this.element.replaceChildren(this.root);

    this.colorScheme = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.colorScheme?.addEventListener('change', this.onColorScheme);
    this.theme = this.resolveTheme();
    this.applyTheme();
    this.resetVisibility();
    this.render();

    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(this.grid);
  }

  // ------------------------------------------------------------ API pública

  /** Los gráficos de cada panel, en orden. */
  get charts(): LozChart[] {
    return this.panels.map((p) => p.chart);
  }

  /** Cambia los datos de todos los paneles y anima desde lo que se ve. */
  setData(data: MultiplesOptions['data']): this {
    this.opts = { ...this.opts, data };
    this.refresh();
    return this;
  }

  /** Opciones vigentes de la cuadrícula. Para cambiarlas, setOptions. */
  get options(): Readonly<MultiplesOptions> {
    return this.opts;
  }

  /** Cambia opciones (se combinan con las actuales). Cambiar `facet` o las series rearma la cuadrícula. */
  setOptions(options: MultiplesUpdate): this {
    const prev = this.opts;
    this.opts = { ...prev, ...options, xAxis: { ...prev.xAxis, ...options.xAxis }, yAxis: { ...prev.yAxis, ...options.yAxis } };
    if (options.series) this.resetVisibility();
    this.theme = this.resolveTheme();
    this.applyTheme();
    this.refresh();
    return this;
  }

  setTheme(theme: ThemeName): this {
    this.opts = { ...this.opts, theme };
    this.refreshTheme();
    for (const p of this.panels) p.chart.setTheme(theme);
    return this;
  }

  /** Oculta o muestra una serie en todos los paneles; el eje compartido se recalcula. */
  toggleSeries(name: string, visible = this.hidden.has(name)): this {
    if (this.opts.facet === 'series') return this;
    if (visible) this.hidden.delete(name);
    else this.hidden.add(name);
    this.legend.sync(this.legendItems());
    const range = this.sharedRange(this.specs());
    for (const p of this.panels) {
      p.chart.setOptions({ yAxis: range });
      p.chart.toggleSeries(name, visible);
    }
    return this;
  }

  /** La cuadrícula completa como SVG: título, leyenda y cada panel en su lugar. */
  toSVG(): string {
    return this.exportSVG().markup;
  }

  /** Descarga la cuadrícula como PNG o SVG, o los datos como CSV. */
  download(type: 'png' | 'svg' | 'csv' = 'png', filename?: string): Promise<void> {
    const name = fileName(filename, this.opts.title, type);
    if (type === 'csv') {
      downloadCSV(this.toCSV(), name);
      return Promise.resolve();
    }
    const { markup, width, height } = this.exportSVG();
    return downloadImage(markup, width, height, type, name);
  }

  /**
   * Los datos como CSV, tal como llegaron: una columna por cada campo que aparece en las filas
   * (en el orden en que aparece), sin formato.
   */
  toCSV(): string {
    const fields: string[] = [];
    for (const row of this.opts.data) for (const k of Object.keys(row)) if (!fields.includes(k)) fields.push(k);
    const cell = (v: unknown): string | number =>
      typeof v === 'number' ? v : v instanceof Date ? csvDate(v.getTime()) : v == null ? '' : String(v);
    return toCSV([fields, ...this.opts.data.map((row) => fields.map((k) => cell(row[k])))]);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.colorScheme?.removeEventListener('change', this.onColorScheme);
    for (const p of this.panels) p.chart.destroy();
    this.root.remove();
    unmount(this);
  }

  // ------------------------------------------------------------ Paneles

  /** Opciones comunes a todos los paneles. */
  private baseOptions(): LozChartOptions {
    const {
      facet: _facet,
      columns: _columns,
      minWidth: _minWidth,
      sharedY: _sharedY,
      subtitle: _subtitle,
      context: _context,
      ...rest
    } = this.opts;
    // Las series ocultas desde la leyenda común llegan ocultas a cada panel.
    const series = rest.series.map((s) => ({ ...s, visible: !this.hidden.has(s.name ?? s.field) }));
    return { ...rest, series, height: this.opts.height ?? PANEL_HEIGHT, legend: false, background: false };
  }

  private specs() {
    return facetPanels(this.opts, this.baseOptions());
  }

  /** Arma la cuadrícula desde cero. */
  private render(): void {
    for (const p of this.panels) p.chart.destroy();
    this.renderHeader();
    this.renderLegend();
    const { columns, minWidth = MIN_WIDTH } = this.opts;
    this.grid.style.gridTemplateColumns = columns
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(auto-fill, minmax(min(${minWidth}px, 100%), 1fr))`;
    this.grid.setAttribute('aria-label', this.opts.title ?? 'Gráficos en cuadrícula');

    const specs = this.specs();
    const range = this.sharedRange(specs);
    // Primero las celdas: así se sabe dónde queda cada panel antes de dibujarlo.
    const cells = specs.map(() => html('div', { class: 'lc-panel' }));
    this.grid.replaceChildren(...cells);
    const edges = this.edges(cells);
    this.panels = specs.map((spec, i) => {
      const panel: Panel = { name: spec.name, el: cells[i], edges: edges[i], chart: null! };
      panel.chart = new LozChart(cells[i], {
        ...this.panelOptions(spec, range, edges[i]),
        onHover: (x) => this.syncHover(panel, x),
      });
      return panel;
    });
    this.alignAxes(true);
  }

  /** Datos u opciones nuevas: si los paneles son los mismos, cada uno anima; si no, se rearma. */
  private refresh(): void {
    const specs = this.specs();
    const same = specs.length === this.panels.length && specs.every((s, i) => s.name === this.panels[i].name);
    if (!same) {
      this.render();
      return;
    }
    this.renderHeader();
    this.renderLegend();
    const range = this.sharedRange(specs);
    specs.forEach((spec, i) => this.panels[i].chart.setOptions(this.panelOptions(spec, range, this.panels[i].edges)));
    this.alignAxes(true);
  }

  /**
   * Opciones de un panel: las de su faceta, el eje común y las etiquetas según su lugar.
   * Sin etiquetas X el panel se acorta lo que ellas ocupaban: el área de datos mide lo mismo en todos.
   */
  private panelOptions(spec: PanelSpec, range: Range, edges: Edges): LozChartOptions {
    // Si algún panel tiene barras, todos usan banda: así cada mes cae en la misma vertical.
    const band = this.opts.xAxis.band ?? this.opts.series.some((s) => usesBand(s.type));
    const edge = this.edgeOptions(edges);
    return {
      ...spec.options,
      height: edge.height,
      xAxis: { ...spec.options.xAxis, band, ...edge.xAxis },
      yAxis: { ...spec.options.yAxis, ...range, ...edge.yAxis },
    };
  }

  /** Lo que depende del lugar del panel: etiquetas y alto (sin etiquetas X, se acorta lo que ocupaban). */
  private edgeOptions(edges: Edges) {
    const height = this.opts.height ?? PANEL_HEIGHT;
    return {
      height: edges.bottom ? height : height - (X_LABEL_SPACE - AXIS_GAP),
      xAxis: { labels: edges.bottom },
      yAxis: { labels: edges.left },
    };
  }

  /**
   * Los paneles con números en el eje Y reservan el mismo ancho (el del más ancho), así sus áreas
   * de datos empiezan en la misma vertical aunque cada uno tenga sus unidades.
   * @param animate false al redimensionar; true al crear o cambiar datos (no corta la animación).
   */
  private alignAxes(animate: boolean): void {
    const labeled = this.panels.filter((p) => p.edges.left);
    const width = Math.max(0, ...labeled.map((p) => p.chart.axisWidth));
    for (const p of labeled) {
      if (p.axisWidth === width) continue;
      p.axisWidth = width;
      p.chart.setOptions({ yAxis: { width } }, animate);
    }
  }

  /**
   * El eje del valor común: la unión de los dominios de todos los paneles (con las series
   * visibles), redondeada a números "bonitos". Respeta min y max fijos si los hay.
   */
  private sharedRange(specs: PanelSpec[]): Range {
    if (this.opts.sharedY === false) return {};
    const ticks = tickCountFor(this.opts.height ?? PANEL_HEIGHT);
    let lo = Infinity;
    let hi = -Infinity;
    for (const spec of specs) {
      const d = valueDomain(spec.options, this.hidden, ticks);
      if (!d) continue;
      lo = Math.min(lo, d[0]);
      hi = Math.max(hi, d[1]);
    }
    if (lo > hi) return {};
    const [d0, d1] = niceDomain(lo, hi, ticks);
    return { min: this.opts.yAxis?.min ?? d0, max: this.opts.yAxis?.max ?? d1 };
  }

  /** Bordes de cada celda: primera columna (misma izquierda que la primera) y sin nadie debajo. */
  private edges(cells: HTMLElement[]): Edges[] {
    const left = Math.min(...cells.map((c) => c.offsetLeft));
    return cells.map((c) => ({
      left: c.offsetLeft - left < 1,
      bottom: !cells.some((o) => Math.abs(o.offsetLeft - c.offsetLeft) < 1 && o.offsetTop > c.offsetTop),
    }));
  }

  /** Al cambiar el ancho puede cambiar el número de columnas, y con él qué panel lleva qué etiquetas. */
  private readonly onResize = () => {
    const edges = this.edges(this.panels.map((p) => p.el));
    this.panels.forEach((p, i) => {
      if (p.edges.left === edges[i].left && p.edges.bottom === edges[i].bottom) return;
      p.edges = edges[i];
      p.chart.setOptions(this.edgeOptions(p.edges), false);
    });
    this.alignAxes(false);
  };

  /** El puntero en un panel marca el mismo dato en los demás. */
  private syncHover(from: Panel, x: string | number | null): void {
    for (const p of this.panels) if (p !== from) p.chart.highlight(x);
  }

  // ------------------------------------------------------------ Tema, encabezado y leyenda

  private resolveTheme(): Theme {
    const t = this.opts.theme ?? 'auto';
    const mode = t === 'auto' ? (this.colorScheme?.matches ? 'dark' : 'light') : t;
    return resolveTheme(mode, this.opts.palette);
  }

  private applyTheme(): void {
    const vars = themeVars(this.theme);
    for (const k in vars) this.root.style.setProperty(k, vars[k]);
    this.root.dataset.theme = this.theme.name;
    this.root.classList.toggle('lc-bg', this.opts.background ?? true);
  }

  private refreshTheme(): void {
    this.theme = this.resolveTheme();
    this.applyTheme();
    this.legend.sync(this.legendItems());
  }

  private readonly onColorScheme = () => {
    if ((this.opts.theme ?? 'auto') === 'auto') this.refreshTheme();
  };

  private renderHeader(): void {
    const { title, subtitle } = this.opts;
    this.header.replaceChildren();
    if (title) this.header.appendChild(html('div', { class: 'lc-title' }, title));
    if (subtitle) this.header.appendChild(html('div', { class: 'lc-subtitle' }, subtitle));
    this.header.hidden = !title && !subtitle;
  }

  private resetVisibility(): void {
    this.hidden.clear();
    for (const s of this.opts.series) if (s.visible === false) this.hidden.add(s.name ?? s.field);
  }

  /** Por campo, una leyenda común si hay 2 o más series. Por serie, los títulos ya las nombran. */
  private legendItems(): LegendItem[] {
    return this.opts.series.slice(0, MAX_COLORS).map((s, i) => {
      const key = s.name ?? s.field;
      const slot = Number.isInteger(s.color) ? s.color! - 1 : i;
      return {
        key,
        name: key,
        color: this.theme.palette[slot] ?? this.theme.other,
        symbol: seriesSymbol(s.type),
        visible: !this.hidden.has(key),
      };
    });
  }

  private renderLegend(): void {
    const lg = this.opts.legend;
    if (this.opts.facet === 'series' || lg === false || this.opts.series.length < 2) {
      this.legend.clear();
      return;
    }
    const top = !(typeof lg === 'object' && lg.position === 'bottom');
    if (top) this.grid.before(this.legend.el);
    else this.grid.after(this.legend.el);
    this.legend.render(this.legendItems(), top);
  }

  // ------------------------------------------------------------ Exportar

  private exportSVG(): { markup: string; width: number; height: number } {
    const th = this.theme;
    const pad = EXPORT_PAD;
    const gridBox = this.grid.getBoundingClientRect();
    const width = Math.ceil(gridBox.width) + 2 * pad;
    const family = getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif';
    let y = pad;
    let head = '';
    if (this.opts.title) {
      head += `<text${attrs({ x: pad, y: y + 15, 'font-size': 15, 'font-weight': 600, fill: th.text })}>${esc(this.opts.title)}</text>`;
      y += 21;
    }
    if (this.opts.subtitle) {
      head += `<text${attrs({ x: pad, y: y + 13, 'font-size': 13, fill: th.textMuted })}>${esc(this.opts.subtitle)}</text>`;
      y += 19;
    }
    if (head) y += 12;
    if (this.legend.size) {
      const block = legendSVG(this.legendItems(), pad, y, width - 2 * pad, family, th);
      head += block.markup;
      y += block.height + 16;
    }
    // Cada panel, en la misma posición que tiene en pantalla.
    let panels = '';
    let bottom = y;
    for (const p of this.panels) {
      const box = p.el.getBoundingClientRect();
      const px = pad + box.left - gridBox.left;
      const py = y + box.top - gridBox.top;
      const markup = p.chart.toSVG({ padding: 0 });
      // overflow visible: al rasterizar no hay fuentes web y el texto de respaldo puede ser más ancho.
      panels += markup.replace('<svg ', `<svg x="${px.toFixed(1)}" y="${py.toFixed(1)}" overflow="visible" `);
      bottom = Math.max(bottom, py + Number(/height="([\d.]+)"/.exec(markup)?.[1] ?? 0));
    }
    const height = Math.ceil(bottom + pad);
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': family, role: 'img', 'aria-label': this.opts.title ?? 'Gráficos en cuadrícula' })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      panels +
      `</svg>`;
    return { markup, width, height };
  }
}
