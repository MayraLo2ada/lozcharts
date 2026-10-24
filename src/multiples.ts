/**
 * Small multiples: una cuadrícula de gráficos pequeños, uno por serie o por valor de un campo.
 *
 * Para que comparar sea honesto, todos los paneles comparten el eje del valor y las mismas X.
 * El puntero se sincroniza (todos marcan el mismo dato), la leyenda es una sola y los números
 * del eje solo aparecen en la primera columna.
 */
import type { LozChartOptions, MultiplesOptions, ThemeName } from './types';
import { LozChart, seriesSymbol, tickCountFor, valueDomain } from './chart';
import { facetPanels } from './core/facet';
import { attrs, esc, html, resolveElement } from './core/dom';
import { downloadImage, slug } from './core/export';
import { Legend, legendSVG, type LegendItem } from './core/legend';
import { mount, unmount, type Mounted } from './core/mount';
import { injectStyles, MAX_COLORS, resolveTheme, themeVars, type Theme } from './core/theme';
import { niceDomain } from './core/ticks';

const PANEL_HEIGHT = 180;
const MIN_WIDTH = 240;
const EXPORT_PAD = 16;

interface Panel {
  name: string;
  el: HTMLDivElement;
  chart: LozChart;
  /** Muestra los números del eje del valor (primera columna). */
  labels: boolean;
}

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

  /** Cambia opciones (se combinan con las actuales). Cambiar `facet` o las series rearma la cuadrícula. */
  setOptions(options: Partial<MultiplesOptions>): this {
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
    const yAxis = this.sharedYAxis(this.specs());
    for (const p of this.panels) {
      p.chart.setOptions({ yAxis: { ...yAxis, labels: p.labels } });
      p.chart.toggleSeries(name, visible);
    }
    return this;
  }

  /** La cuadrícula completa como SVG: título, leyenda y cada panel en su lugar. */
  toSVG(): string {
    return this.exportSVG().markup;
  }

  download(type: 'png' | 'svg' = 'png', filename?: string): Promise<void> {
    const { markup, width, height } = this.exportSVG();
    return downloadImage(markup, width, height, type, filename || slug(this.opts.title ?? '') || 'lozchart');
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
    const { facet: _facet, columns: _columns, minWidth: _minWidth, sharedY: _sharedY, subtitle: _subtitle, ...rest } = this.opts;
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
    this.grid.setAttribute('aria-label', this.opts.title ?? 'Small multiples');

    const specs = this.specs();
    const yAxis = this.sharedYAxis(specs);
    // Primero las celdas: así se sabe qué paneles quedan en la primera columna antes de dibujarlos.
    const cells = specs.map(() => html('div', { class: 'lc-panel' }));
    this.grid.replaceChildren(...cells);
    const first = this.firstColumn(cells);
    this.panels = specs.map((spec, i) => {
      const panel: Panel = { name: spec.name, el: cells[i], labels: first[i], chart: null! };
      panel.chart = new LozChart(cells[i], {
        ...spec.options,
        yAxis: { ...yAxis, labels: first[i] },
        onHover: (x) => this.syncHover(panel, x),
      });
      return panel;
    });
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
    const yAxis = this.sharedYAxis(specs);
    specs.forEach((spec, i) => {
      const p = this.panels[i];
      p.chart.setOptions({ ...spec.options, yAxis: { ...yAxis, labels: p.labels } });
    });
  }

  /**
   * El eje del valor común: la unión de los dominios de todos los paneles (con las series
   * visibles), redondeada a números "bonitos". Respeta min y max fijos si los hay.
   */
  private sharedYAxis(specs: { options: LozChartOptions }[]): LozChartOptions['yAxis'] {
    const yAxis = { ...this.opts.yAxis };
    if (this.opts.sharedY === false) return yAxis;
    const ticks = tickCountFor(this.opts.height ?? PANEL_HEIGHT);
    let lo = Infinity;
    let hi = -Infinity;
    for (const spec of specs) {
      const d = valueDomain(spec.options, this.hidden, ticks);
      if (!d) continue;
      lo = Math.min(lo, d[0]);
      hi = Math.max(hi, d[1]);
    }
    if (lo > hi) return yAxis;
    const [d0, d1] = niceDomain(lo, hi, ticks);
    return { ...yAxis, min: yAxis.min ?? d0, max: yAxis.max ?? d1 };
  }

  /** ¿Qué celdas empiezan una fila? Las que están tan a la izquierda como la primera. */
  private firstColumn(cells: HTMLElement[]): boolean[] {
    const left = Math.min(...cells.map((c) => c.offsetLeft));
    return cells.map((c) => c.offsetLeft - left < 1);
  }

  /** Al cambiar el ancho puede cambiar el número de columnas: solo la primera lleva números. */
  private readonly onResize = () => {
    const first = this.firstColumn(this.panels.map((p) => p.el));
    this.panels.forEach((p, i) => {
      if (p.labels === first[i]) return;
      p.labels = first[i];
      p.chart.setOptions({ yAxis: { labels: p.labels } }, false);
    });
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
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': family, role: 'img', 'aria-label': this.opts.title ?? 'Small multiples' })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      panels +
      `</svg>`;
    return { markup, width, height };
  }
}
