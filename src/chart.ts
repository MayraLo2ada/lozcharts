/**
 * LozChart: el núcleo.
 *
 * Ciclo de render:
 *   opciones → prepare() (lee datos, ordena, asigna colores)
 *            → buildFrame() (apila, calcula el dominio Y "bonito") = cuadro destino
 *            → transition() (interpola del cuadro actual al destino, 600 ms ease-out)
 *            → draw(cuadro) (escalas, ejes, rejilla y cada serie por su plugin)
 */
import type { Datum, FormatSpec, LozChartOptions, SeriesOptions, ThemeName, XAxisType } from './types';
import type { DrawContext, PreparedSeries, SeriesFrame, SeriesImpl } from './core/series';
import { DARK, injectStyles, LIGHT, resolveTheme, themeVars, type Theme } from './core/theme';
import { BandScale, ContinuousScale, LinearScale, type XScale } from './core/scales';
import { chooseTimeInterval, detectTimeUnit, niceDomain, niceStep, numberTicks, timeTicks, type TimeUnit } from './core/ticks';
import { axisFormatter, parseTime, timeFullLabel, timeTickLabel, valueFormatter, type NumberContext } from './core/format';
import { attrs, esc, html, prefersReducedMotion, resolveElement, svg, textWidth } from './core/dom';

const registry = new Map<string, SeriesImpl>();
const instances = new WeakMap<HTMLElement, LozChart>();
const live = new Set<LozChart>();
let uid = 0;

const DURATION = 600;
const MAX_SERIES = 8;
const FONT_SIZE = 12;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Frame {
  d0: number;
  d1: number;
  n: number;
  series: SeriesFrame[];
}

interface Prepared {
  n: number;
  xType: XAxisType;
  /** Valor original de X en cada índice (texto, fecha…). */
  xRaw: unknown[];
  /** Valor numérico de X (timestamp o número) para 'time' y 'linear'. */
  xNum: number[];
  timeUnit: TimeUnit;
  series: PreparedSeries[];
  band: boolean;
}

interface Layout {
  width: number;
  height: number;
  left: number;
  top: number;
  plotW: number;
  plotH: number;
  x: XScale;
  yTicks: number[];
  yFmt: (v: number) => string;
}

interface Normalized extends LozChartOptions {
  theme: ThemeName;
  height: number;
  tooltip: boolean;
  animate: boolean;
  locale: string;
  currency: string;
  background: boolean;
}

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

const lerp = (a: number, b: number, t: number) => (isFinite(a) && isFinite(b) ? a + (b - a) * t : b);
const lerpArr = (a: number[], b: number[], t: number) => b.map((v, i) => lerp(a[i], v, t));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));

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
    try {
      return instances.get(resolveElement(target));
    } catch {
      return undefined;
    }
  }

  /**
   * Monta todos los elementos `[data-lozchart]` dentro de `root`. El atributo lleva las
   * opciones en JSON o el selector de un <script type="application/json">.
   * Pensado para HTMX: `htmx.onLoad(el => LozChart.initAll(el))`.
   * Si un elemento ya tenía gráfico, lo reemplaza. También limpia los gráficos cuyo
   * elemento ya no está en la página.
   */
  static initAll(root: ParentNode = document): LozChart[] {
    LozChart.cleanup();
    const nodes: HTMLElement[] = [];
    if (root instanceof HTMLElement && root.hasAttribute('data-lozchart')) nodes.push(root);
    root.querySelectorAll<HTMLElement>('[data-lozchart]').forEach((n) => nodes.push(n));
    const out: LozChart[] = [];
    for (const el of nodes) {
      const raw = (el.getAttribute('data-lozchart') ?? '').trim();
      try {
        const json = raw.startsWith('{') ? raw : document.querySelector(raw)?.textContent ?? '';
        out.push(new LozChart(el, JSON.parse(json) as LozChartOptions));
      } catch (err) {
        console.error('LozChart: no pude leer las opciones de', el, err);
      }
    }
    return out;
  }

  /** Destruye los gráficos dentro de `root` (ej. en htmx:beforeSwap). */
  static destroyAll(root: ParentNode = document): void {
    for (const c of [...live]) if (root === c.element || root.contains(c.element)) c.destroy();
  }

  /** Destruye los gráficos cuyo elemento salió del documento. */
  static cleanup(): void {
    for (const c of [...live]) if (!c.element.isConnected) c.destroy();
  }

  // ------------------------------------------------------------ Estado

  readonly element: HTMLElement;
  private opts: Normalized;
  private readonly id = ++uid;
  private readonly hidden = new Set<string>();
  private prepared!: Prepared;
  private target!: Frame;
  private current: Frame | null = null;
  private raf = 0;
  private anim: { from: Frame; to: Frame; start: number } | null = null;
  private layout: Layout | null = null;
  private width = 0;
  private active = -1;
  private pointerY = -1;
  private theme: Theme = LIGHT;
  private destroyed = false;

  // DOM
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly legendEl: HTMLDivElement;
  private readonly plotEl: HTMLDivElement;
  private readonly svgEl: SVGSVGElement;
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
  private readonly ro: ResizeObserver | null;
  private readonly mql: MediaQueryList | null;
  private readonly onScheme = () => {
    if (this.opts.theme === 'auto') this.applyTheme();
  };

  constructor(target: string | HTMLElement, options: LozChartOptions) {
    this.element = resolveElement(target);
    instances.get(this.element)?.destroy();
    instances.set(this.element, this);
    live.add(this);
    injectStyles(document);
    this.opts = normalize(options);

    this.root = html('div', { class: 'lc-root' });
    this.header = html('div', { class: 'lc-header' });
    this.legendEl = html('div', { class: 'lc-legend', role: 'group', 'aria-label': 'Series: pulsa para mostrar u ocultar' });
    this.plotEl = html('div', { class: 'lc-plot' });
    this.svgEl = svg('svg', { class: 'lc-svg', role: 'img', tabindex: 0, focusable: 'true' });
    const clipId = `lc-clip-${this.id}`;
    const defs = svg('defs');
    const clip = svg('clipPath', { id: clipId });
    this.clipRect = svg('rect');
    clip.appendChild(this.clipRect);
    defs.appendChild(clip);
    this.gGrid = svg('g', { class: 'lc-grid', 'aria-hidden': 'true' });
    this.gBand = svg('g', { 'aria-hidden': 'true' });
    this.gSeries = svg('g', { class: 'lc-series', 'clip-path': `url(#${clipId})`, 'aria-hidden': 'true' });
    this.gAxes = svg('g', { class: 'lc-axes', 'aria-hidden': 'true' });
    this.gHover = svg('g', { 'aria-hidden': 'true', 'pointer-events': 'none' });
    this.overlay = svg('rect', { fill: 'transparent' });
    this.overlay.style.touchAction = 'pan-y';
    this.svgEl.append(defs, this.gGrid, this.gBand, this.gSeries, this.gAxes, this.gHover, this.overlay);
    this.tooltipEl = html('div', { class: 'lc-tooltip', 'aria-hidden': 'true' });
    this.plotEl.append(this.svgEl, this.tooltipEl);
    this.tableEl = html('table');
    const tableBox = html('div', { class: 'lc-sr-only' });
    tableBox.appendChild(this.tableEl);
    this.liveEl = html('div', { class: 'lc-sr-only', 'aria-live': 'polite' });
    this.root.append(this.header, this.plotEl, tableBox, this.liveEl);
    this.element.replaceChildren(this.root);

    this.bindEvents();

    this.mql = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.mql?.addEventListener('change', this.onScheme);

    this.ro =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            const w = Math.floor(this.plotEl.clientWidth);
            if (w !== this.width) {
              this.width = w;
              // Redibujar sin animación al cambiar el ancho.
              if (!this.anim && this.current) this.draw(this.current);
            }
          })
        : null;
    this.ro?.observe(this.plotEl);
    this.width = Math.floor(this.plotEl.clientWidth);

    this.applyTheme(false);
    this.rebuild(this.opts.animate);
  }

  // ------------------------------------------------------------ API pública

  /** Cambia los datos y anima desde el estado anterior. */
  setData(data: Datum[]): this {
    this.opts.data = Array.isArray(data) ? data : [];
    this.update(true);
    return this;
  }

  /** Cambia opciones (se combinan con las actuales). */
  setOptions(options: Partial<LozChartOptions>): this {
    const prev = this.opts;
    this.opts = normalize({
      ...prev,
      ...options,
      xAxis: { ...prev.xAxis, ...(options.xAxis ?? {}) },
      yAxis: { ...(prev.yAxis ?? {}), ...(options.yAxis ?? {}) },
    } as LozChartOptions);
    if (options.series) this.hidden.clear();
    if (options.theme) this.applyTheme(false);
    this.rebuild(true);
    return this;
  }

  setTheme(theme: ThemeName): this {
    this.opts.theme = theme;
    this.applyTheme();
    return this;
  }

  /** Oculta o muestra una serie por su nombre. El color de las demás no cambia. */
  toggleSeries(name: string, visible?: boolean): this {
    const show = visible ?? this.hidden.has(name);
    if (show) this.hidden.delete(name);
    else this.hidden.add(name);
    this.renderLegend();
    this.update(true, false);
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

  /** Descarga el gráfico como PNG (2x) o SVG. */
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
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('LozChart: no pude generar el PNG.');
    saveBlob(blob, name + '.png');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.mql?.removeEventListener('change', this.onScheme);
    this.root.remove();
    if (instances.get(this.element) === this) instances.delete(this.element);
    live.delete(this);
  }

  // ------------------------------------------------------------ Preparación

  /** Reconstruye título, leyenda y tabla, y anima hacia los nuevos datos. */
  private rebuild(animate: boolean): void {
    this.prepared = this.prepare();
    for (const s of this.opts.series) {
      const name = s.name ?? s.field;
      if (s.visible === false && !this.hidden.has(name)) this.hidden.add(name);
    }
    this.renderHeader();
    this.renderLegend();
    this.update(animate, false);
  }

  private update(animate: boolean, reprepare = true): void {
    if (this.destroyed) return;
    if (reprepare) this.prepared = this.prepare();
    this.renderTable();
    this.target = this.buildFrame();
    this.svgEl.setAttribute('aria-label', this.ariaLabel());
    this.transition(animate && this.opts.animate);
  }

  private prepare(): Prepared {
    const o = this.opts;
    const xType: XAxisType = o.xAxis?.type ?? 'category';
    const field = o.xAxis?.field;
    let rows = o.data.slice();
    let xNum: number[] = [];
    if (xType === 'time' || xType === 'linear') {
      const read = xType === 'time' ? parseTime : num;
      rows = rows.filter((r) => isFinite(read(r[field])));
      rows.sort((a, b) => read(a[field]) - read(b[field]));
      xNum = rows.map((r) => read(r[field]));
    }

    // Series: tipo registrado, nombre único, color por su posición (no por visibilidad).
    let defs = o.series.filter((s) => {
      if (registry.has(s.type)) return true;
      console.warn(`LozChart: el tipo de serie "${s.type}" no está registrado.`);
      return false;
    });
    let others: SeriesOptions[] = [];
    if (defs.length > MAX_SERIES) {
      const tail = defs.slice(MAX_SERIES - 1);
      const foldable = tail.every((s) => registry.get(s.type)!.stackable && s.stack && s.stack === tail[0].stack && s.type === tail[0].type);
      if (foldable) {
        others = tail;
        defs = defs.slice(0, MAX_SERIES - 1);
      } else {
        console.warn(`LozChart: hay ${defs.length} series y la paleta tiene ${MAX_SERIES} colores. Se muestran solo las primeras ${MAX_SERIES}. Agrupa el resto o usa varios gráficos.`);
        defs = defs.slice(0, MAX_SERIES);
      }
    }

    const series: PreparedSeries[] = defs.map((s, idx) => {
      const impl = registry.get(s.type)!;
      const slot = typeof s.color === 'number' && s.color >= 1 && s.color <= MAX_SERIES ? s.color - 1 : idx;
      return {
        key: s.name ?? s.field,
        name: s.name ?? s.field,
        type: s.type,
        impl,
        color: this.theme.palette[slot],
        options: s,
        values: rows.map((r) => num(r[s.field])),
        stackKey: impl.stackable && s.stack ? `${s.type}:${s.stack === true ? '' : s.stack}` : null,
      };
    });
    if (others.length) {
      const first = others[0];
      series.push({
        key: 'Otros',
        name: 'Otros',
        type: first.type,
        impl: registry.get(first.type)!,
        color: this.theme.other,
        options: { ...first, name: 'Otros', field: '' },
        values: rows.map((r) => others.reduce((acc, s) => acc + (num(r[s.field]) || 0), 0)),
        stackKey: `${first.type}:${first.stack === true ? '' : first.stack}`,
      });
    }

    return {
      n: rows.length,
      xType,
      xRaw: rows.map((r) => r[field]),
      xNum,
      timeUnit: xType === 'time' ? detectTimeUnit(xNum) : 'day',
      series,
      band: series.some((s) => s.impl.band),
    };
  }

  /** Cuadro destino: apila, decide qué segmento lleva punta redondeada y calcula el dominio Y. */
  private buildFrame(): Frame {
    const p = this.prepared;
    const n = p.n;
    const stacks = new Map<string, { pos: number[]; neg: number[]; posOwner: number[]; negOwner: number[] }>();
    const frames: SeriesFrame[] = [];
    const visibleCluster: string[] = [];
    const clusterOf = (s: PreparedSeries) => s.stackKey ?? 'solo:' + s.key;

    p.series.forEach((s, si) => {
      const visible = !this.hidden.has(s.key);
      const y0 = new Array<number>(n);
      const y1 = new Array<number>(n);
      if (s.stackKey) {
        let st = stacks.get(s.stackKey);
        if (!st) {
          st = { pos: new Array(n).fill(0), neg: new Array(n).fill(0), posOwner: new Array(n).fill(-1), negOwner: new Array(n).fill(-1) };
          stacks.set(s.stackKey, st);
        }
        for (let i = 0; i < n; i++) {
          const v = s.values[i];
          if (!visible || !isFinite(v) || v === 0) {
            // Oculta: se encoge hacia su lugar en la pila.
            y0[i] = y1[i] = !isFinite(v) || v >= 0 ? st.pos[i] : st.neg[i];
          } else if (v > 0) {
            y0[i] = st.pos[i];
            y1[i] = st.pos[i] += v;
            st.posOwner[i] = si;
          } else {
            y0[i] = st.neg[i];
            y1[i] = st.neg[i] += v;
            st.negOwner[i] = si;
          }
        }
      } else {
        for (let i = 0; i < n; i++) {
          y0[i] = 0;
          y1[i] = visible ? s.values[i] : NaN; // se ajusta a la base abajo
        }
      }
      if (visible && s.impl.cluster && !visibleCluster.includes(clusterOf(s))) visibleCluster.push(clusterOf(s));
      frames.push({ ps: s, y0, y1, alpha: visible ? 1 : 0, slot: 0, slots: 1, outer: new Array(n).fill(true) });
    });

    // Punta redondeada solo en el segmento exterior de cada pila.
    frames.forEach((f, si) => {
      const st = f.ps.stackKey ? stacks.get(f.ps.stackKey) : null;
      if (!st) return;
      for (let i = 0; i < n; i++) f.outer[i] = st.posOwner[i] === si || st.negOwner[i] === si;
    });

    // Posición en el grupo de barras: las visibles se reparten; una oculta se queda en su lugar.
    const order = p.series.filter((s) => s.impl.cluster).map(clusterOf).filter((v, i, a) => a.indexOf(v) === i);
    frames.forEach((f) => {
      if (!f.ps.impl.cluster) return;
      const c = clusterOf(f.ps);
      const visIdx = visibleCluster.indexOf(c);
      f.slots = Math.max(1, visibleCluster.length);
      f.slot = visIdx >= 0 ? visIdx : Math.min(visibleCluster.length, order.slice(0, order.indexOf(c)).filter((k) => visibleCluster.includes(k)).length) - 0.5;
      if (f.slot < 0) f.slot = 0;
    });

    // Dominio Y con las series visibles.
    let lo = Infinity;
    let hi = -Infinity;
    let zero = !!this.opts.yAxis?.zero;
    frames.forEach((f) => {
      if (f.alpha === 0) return;
      if (f.ps.impl.includeZero) zero = true;
      for (let i = 0; i < n; i++) {
        for (const v of f.ps.stackKey ? [f.y0[i], f.y1[i]] : [f.y1[i]]) {
          if (isFinite(v)) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
      }
    });
    if (!isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    if (zero) {
      lo = Math.min(lo, 0);
      hi = Math.max(hi, 0);
    }
    const ya = this.opts.yAxis ?? {};
    if (typeof ya.min === 'number') lo = ya.min;
    if (typeof ya.max === 'number') hi = ya.max;
    let [d0, d1] = niceDomain(lo, hi, this.yTickCount());
    if (typeof ya.min === 'number') d0 = ya.min;
    if (typeof ya.max === 'number') d1 = ya.max;

    // Las líneas ocultas se encogen hacia el cero (o el borde más cercano).
    const base = Math.max(d0, Math.min(d1, 0));
    frames.forEach((f) => {
      if (f.ps.stackKey) return;
      for (let i = 0; i < n; i++) {
        f.y0[i] = base;
        if (f.alpha === 0) f.y1[i] = isFinite(f.ps.values[i]) ? base : NaN;
      }
    });

    return { d0, d1, n, series: frames };
  }

  private yTickCount(): number {
    return Math.max(2, Math.round((this.opts.height - 40) / 56));
  }

  // ------------------------------------------------------------ Animación

  /**
   * Interpola del cuadro actual al destino. Si llega otra actualización a mitad de camino,
   * se parte del cuadro que se está mostrando, así no hay saltos.
   */
  private transition(animate: boolean): void {
    cancelAnimationFrame(this.raf);
    const to = this.target;
    if (!animate || prefersReducedMotion() || !this.width) {
      this.anim = null;
      this.current = to;
      this.draw(to);
      return;
    }
    const from = this.current ?? this.collapsed(to);
    // Las series que ya no están salen encogiéndose hacia su base.
    const keys = new Set(to.series.map((s) => s.ps.key));
    const exiting = from.series
      .filter((s) => !keys.has(s.ps.key) && s.alpha > 0.001)
      .map((s): SeriesFrame => {
        const y0 = fit(s.y0, to.n, NaN);
        return { ...s, y0, y1: y0.slice(), alpha: 0, outer: fit(s.outer, to.n, false), exiting: true };
      });
    const dest: Frame = { ...to, series: [...to.series, ...exiting] };
    this.anim = { from, to: dest, start: performance.now() };
    const tick = (now: number) => {
      if (!this.anim || this.destroyed) return;
      const t = Math.min(1, (now - this.anim.start) / DURATION);
      const frame = this.interpolate(this.anim.from, this.anim.to, easeOut(t));
      this.current = frame;
      this.draw(frame);
      if (t < 1) this.raf = requestAnimationFrame(tick);
      else {
        this.anim = null;
        this.current = this.target;
        this.draw(this.target);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Versión "en cero" de un cuadro: el punto de partida de la primera animación. */
  private collapsed(to: Frame): Frame {
    return {
      ...to,
      series: to.series.map((s) => {
        const base = s.ps.stackKey ? s.y0.map(() => 0) : s.y0.slice();
        return { ...s, y0: base, y1: base.slice(), alpha: 0 };
      }),
    };
  }

  private interpolate(a: Frame, b: Frame, t: number): Frame {
    const prev = new Map(a.series.map((s) => [s.ps.key, s]));
    return {
      d0: lerp(a.d0, b.d0, t),
      d1: lerp(a.d1, b.d1, t),
      n: b.n,
      series: b.series.map((s) => {
        let f = prev.get(s.ps.key);
        if (!f) {
          // Serie que entra: crece desde su base.
          const base = s.ps.stackKey ? s.y0.map(() => 0) : s.y0;
          f = { ...s, y0: base, y1: base, alpha: 0 };
        }
        // Índices nuevos (más datos que antes) crecen desde la base.
        const fy0 = fit(f.y0, b.n, NaN).map((v, i) => (isFinite(v) ? v : s.ps.stackKey ? 0 : s.y0[i]));
        const fy1 = fit(f.y1, b.n, NaN).map((v, i) => (isFinite(v) ? v : fy0[i]));
        return {
          ...s,
          y0: lerpArr(fy0, s.y0, t),
          y1: lerpArr(fy1, s.y1, t),
          alpha: lerp(f.alpha, s.alpha, t),
          slot: lerp(f.slot, s.slot, t),
          slots: lerp(f.slots, s.slots, t),
        };
      }),
    };
  }

  // ------------------------------------------------------------ Dibujo

  private computeLayout(): Layout | null {
    const width = this.width;
    if (!width) return null;
    const o = this.opts;
    const p = this.prepared;
    const font = this.font();
    const height = o.height;
    const t = this.target;

    // Eje Y: ticks del dominio destino (estables durante la animación).
    const step = niceStep(t.d1 - t.d0, this.yTickCount());
    const yTicks = numberTicks(t.d0, t.d1, step);
    const yFmt = axisFormatter(o.yAxis?.format, this.numCtx(), step, Math.max(Math.abs(t.d0), Math.abs(t.d1)));
    const labelW = Math.max(0, ...yTicks.map((v) => textWidth(yFmt(v), font)));
    const left = Math.ceil(labelW) + 10;
    const top = (o.yAxis?.title ? 22 : 0) + 8;
    const bottom = FONT_SIZE + 12 + (o.xAxis?.title ? 20 : 0);
    const right = p.band ? 0 : 8;
    const plotW = Math.max(10, width - left - right);
    const plotH = Math.max(10, height - top - bottom);
    const x: XScale = p.band ? new BandScale(p.n, plotW) : new ContinuousScale(p.xType === 'category' ? p.xRaw.map((_, i) => i) : p.xNum, plotW);
    return { width, height, left, top, plotW, plotH, x, yTicks, yFmt };
  }

  private draw(frame: Frame): void {
    const L = this.computeLayout();
    this.layout = L;
    if (!L) return;
    this.svgEl.setAttribute('width', String(L.width));
    this.svgEl.setAttribute('height', String(L.height));
    this.svgEl.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
    const tr = `translate(${L.left},${L.top})`;
    for (const g of [this.gGrid, this.gBand, this.gSeries, this.gHover]) g.setAttribute('transform', tr);
    this.gAxes.setAttribute('transform', tr);
    this.clipRect.setAttribute('x', '-6');
    this.clipRect.setAttribute('y', '-6');
    this.clipRect.setAttribute('width', String(L.plotW + 12));
    this.clipRect.setAttribute('height', String(L.plotH + 12));
    this.overlay.setAttribute('x', String(L.left));
    this.overlay.setAttribute('y', String(L.top));
    this.overlay.setAttribute('width', String(L.plotW));
    this.overlay.setAttribute('height', String(L.plotH));

    const parts = this.renderParts(frame, L);
    this.gGrid.innerHTML = parts.grid;
    this.gSeries.innerHTML = parts.series;
    this.gAxes.innerHTML = parts.axes;
    if (this.active >= 0) this.showActive(false);
  }

  /** Markup de rejilla, series y ejes. Se usa para la vista en vivo y para exportar. */
  private renderParts(frame: Frame, L: Layout): { grid: string; series: string; axes: string } {
    const th = this.theme;
    const y = new LinearScale(frame.d0, frame.d1, L.plotH, 0);
    const font = this.font();

    // Rejilla: líneas de 1 px sólidas y discretas; el cero un poco más marcado.
    let grid = '';
    let axes = '';
    for (const v of L.yTicks) {
      const py = Math.round(y.map(v)) + 0.5;
      if (py < -1 || py > L.plotH + 1) continue;
      const isZero = v === 0;
      grid += `<line${attrs({ x1: 0, x2: L.plotW, y1: py, y2: py, stroke: isZero ? th.zero : th.grid, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
      axes += `<text${attrs({ x: -10, y: py, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: th.textMuted, 'font-size': FONT_SIZE })}>${esc(L.yFmt(v))}</text>`;
    }
    if (frame.d0 > 0 || frame.d1 < 0) {
      // Sin cero a la vista: una base discreta abajo.
      const py = Math.round(L.plotH) + 0.5;
      grid += `<line${attrs({ x1: 0, x2: L.plotW, y1: py, y2: py, stroke: th.zero, 'stroke-width': 1, 'shape-rendering': 'crispEdges' })}/>`;
    }

    // Etiquetas del eje X, medidas para que no se encimen.
    for (const tk of this.xTicks(L, font)) {
      axes += `<text${attrs({ x: tk.px.toFixed(1), y: L.plotH + 10, 'text-anchor': tk.anchor, 'dominant-baseline': 'hanging', fill: th.textMuted, 'font-size': FONT_SIZE })}>${esc(tk.label)}</text>`;
    }
    const ya = this.opts.yAxis?.title;
    if (ya) axes += `<text${attrs({ x: -L.left, y: -16, fill: th.textMuted, 'font-size': FONT_SIZE, 'dominant-baseline': 'central' })}>${esc(ya)}</text>`;
    const xa = this.opts.xAxis?.title;
    if (xa) axes += `<text${attrs({ x: L.plotW / 2, y: L.plotH + 30, 'text-anchor': 'middle', 'dominant-baseline': 'hanging', fill: th.textMuted, 'font-size': FONT_SIZE })}>${esc(xa)}</text>`;

    // Series, ordenadas por capa (barras abajo, líneas arriba).
    const sorted = frame.series.slice().sort((a, b) => (a.ps.impl.layer ?? 1) - (b.ps.impl.layer ?? 1));
    let series = '';
    for (const f of sorted) {
      if (f.alpha <= 0.001) continue;
      const ctx = this.drawCtx(f, L, y, frame.n);
      const body = f.ps.impl.draw(ctx);
      if (body) series += `<g${attrs({ opacity: f.alpha < 0.999 ? f.alpha.toFixed(3) : undefined, 'data-series': f.ps.key })}>${body}</g>`;
    }
    return { grid, series, axes };
  }

  private drawCtx(frame: SeriesFrame, L: Layout, y: LinearScale, n: number): DrawContext {
    return { frame, x: L.x, y, theme: this.theme, width: L.plotW, height: L.plotH, n };
  }

  private xTicks(L: Layout, font: string): { px: number; label: string; anchor: string }[] {
    const p = this.prepared;
    const gap = 12;
    const fmtX = this.opts.xAxis?.format;
    const out: { px: number; label: string; anchor: string }[] = [];
    if (!p.n) return out;

    if (L.x.kind === 'band') {
      // Una etiqueta por categoría; si no caben, mostrar una de cada k.
      const labels = p.xRaw.map((_, i) => this.xLabel(i, true));
      const maxW = Math.max(...labels.map((s) => textWidth(s, font)));
      const k = Math.max(1, Math.ceil((maxW + gap) / L.x.step));
      for (let i = 0; i < p.n; i += k) out.push({ px: L.x.at(i), label: labels[i], anchor: 'middle' });
    } else if (p.xType === 'category') {
      const labels = p.xRaw.map((_, i) => this.xLabel(i, true));
      const maxW = Math.max(...labels.map((s) => textWidth(s, font)));
      const k = Math.max(1, Math.ceil((maxW + gap) / Math.max(1, L.x.step)));
      for (let i = 0; i < p.n; i += k) out.push({ px: L.x.at(i), label: labels[i], anchor: 'middle' });
    } else {
      const cs = L.x as ContinuousScale;
      const [t0, t1] = cs.domain;
      if (p.xType === 'time') {
        const sample = textWidth('30 sept', font);
        const iv = chooseTimeInterval(t0, t1, Math.max(1, Math.floor(L.plotW / (sample + gap))));
        const opts = typeof fmtX === 'object' ? fmtX : undefined;
        for (const t of timeTicks(t0, t1, iv)) out.push({ px: cs.lin.map(t), label: timeTickLabel(t, iv.unit, this.opts.locale, opts), anchor: 'middle' });
      } else {
        const fmt = typeof fmtX === 'function' ? fmtX : valueFormatter(typeof fmtX === 'string' ? fmtX : 'number', this.numCtx());
        const st = niceStep(t1 - t0, Math.max(1, Math.floor(L.plotW / 70)));
        for (const v of numberTicks(t0, t1, st)) out.push({ px: cs.lin.map(v), label: fmt(v), anchor: 'middle' });
      }
    }

    // Quitar las que se enciman y mantener las de los bordes dentro del gráfico.
    const kept: typeof out = [];
    let lastRight = -Infinity;
    for (const tk of out) {
      const w = textWidth(tk.label, font);
      let x0 = tk.px - w / 2;
      if (x0 < -L.left + 2) {
        tk.anchor = 'start';
        tk.px = Math.max(tk.px - w / 2, -L.left + 2);
        x0 = tk.px;
      }
      const limit = L.plotW + (L.width - L.left - L.plotW);
      if (x0 + w > limit - 2) {
        tk.anchor = 'end';
        tk.px = Math.min(tk.px + w / 2, limit - 2);
        x0 = tk.px - w;
      }
      if (x0 >= lastRight + 8) {
        kept.push(tk);
        lastRight = x0 + w;
      }
    }
    return kept;
  }

  /** Texto de la X en el índice i: corto para el eje, completo para el tooltip. */
  private xLabel(i: number, short: boolean): string {
    const p = this.prepared;
    const raw = p.xRaw[i];
    const fmtX = this.opts.xAxis?.format;
    if (p.xType === 'time') {
      const t = p.xNum[i];
      if (!short) return timeFullLabel(t, p.timeUnit, this.opts.locale);
      if (typeof fmtX === 'object') return timeTickLabel(t, p.timeUnit, this.opts.locale, fmtX);
      // En banda (barras por mes) el año solo aparece en enero si los datos cruzan años.
      if (p.timeUnit === 'month') {
        const d = new Date(t);
        const multiYear = new Date(p.xNum[0]).getFullYear() !== new Date(p.xNum[p.n - 1]).getFullYear();
        if (!(multiYear && d.getMonth() === 0)) return timeTickLabel(t, 'month', this.opts.locale, { month: 'short' }).replace(/\.$/, '');
      }
      return timeTickLabel(t, p.timeUnit, this.opts.locale);
    }
    if (p.xType === 'linear') {
      const fmt = typeof fmtX === 'function' ? fmtX : valueFormatter(typeof fmtX === 'string' ? fmtX : 'number', this.numCtx());
      return fmt(p.xNum[i]);
    }
    return raw === null || raw === undefined ? '' : String(raw);
  }

  private font(): string {
    const fam = getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif';
    return `${FONT_SIZE}px ${fam}`;
  }

  private numCtx(): NumberContext {
    return { locale: this.opts.locale, currency: this.opts.currency };
  }

  private seriesFormatter(s: PreparedSeries): (v: number) => string {
    let spec: FormatSpec | undefined = (s.options.format as FormatSpec | undefined) ?? this.opts.yAxis?.format;
    if (spec === 'auto' || spec === 'compact') spec = 'number'; // el tooltip muestra el valor exacto
    return valueFormatter(spec, this.numCtx());
  }

  // ------------------------------------------------------------ Tema, título, leyenda, tabla

  private applyTheme(redraw = true): void {
    const mode = this.opts.theme === 'auto' ? (this.mql?.matches ? 'dark' : 'light') : this.opts.theme;
    this.theme = resolveTheme(mode);
    const vars = themeVars(this.theme);
    for (const k in vars) this.root.style.setProperty(k, vars[k]);
    this.root.dataset.theme = mode;
    this.root.classList.toggle('lc-bg', this.opts.background);
    if (!redraw) return;
    // Los colores de cada serie cambian a los del nuevo tema (mismo slot).
    this.prepared = this.prepare();
    this.target = this.buildFrame();
    if (this.current) {
      const map = new Map(this.prepared.series.map((s) => [s.key, s]));
      for (const f of this.current.series) {
        const ps = map.get(f.ps.key);
        if (ps) f.ps = ps;
      }
      this.draw(this.anim ? this.current : this.target);
    }
    this.renderLegend();
  }

  private renderHeader(): void {
    const { title, subtitle } = this.opts;
    this.header.replaceChildren();
    if (title) this.header.appendChild(html('div', { class: 'lc-title' }, title));
    if (subtitle) this.header.appendChild(html('div', { class: 'lc-subtitle' }, subtitle));
    this.header.hidden = !title && !subtitle;
  }

  private renderLegend(): void {
    const lg = this.opts.legend;
    const series = this.prepared.series;
    const show = lg !== false && series.length >= 2;
    const pos = typeof lg === 'object' && lg.position === 'top' ? 'top' : 'bottom';
    this.legendEl.classList.toggle('lc-top', pos === 'top');
    if (!show) {
      this.legendEl.remove();
      return;
    }
    if (pos === 'top') this.plotEl.before(this.legendEl);
    else this.plotEl.after(this.legendEl);
    this.legendEl.replaceChildren(
      ...series.map((s) => {
        const visible = !this.hidden.has(s.key);
        const btn = html('button', { type: 'button', class: 'lc-legend-btn', 'aria-pressed': String(visible) });
        const sw = html('span', { class: 'lc-swatch' + (s.impl.legendSymbol === 'line' ? ' lc-line' : ''), 'aria-hidden': 'true' });
        sw.style.background = s.color;
        btn.append(sw, html('span', { class: 'lc-name' }, s.name));
        btn.addEventListener('click', () => this.toggleSeries(s.key));
        return btn;
      }),
    );
  }

  /** Tabla oculta con todos los datos, para lectores de pantalla. */
  private renderTable(): void {
    const p = this.prepared;
    const t = this.tableEl;
    t.replaceChildren();
    t.appendChild(html('caption', {}, this.opts.title ?? 'Datos del gráfico'));
    const head = html('tr');
    head.appendChild(html('th', { scope: 'col' }, this.opts.xAxis?.title ?? this.opts.xAxis?.field ?? ''));
    for (const s of p.series) head.appendChild(html('th', { scope: 'col' }, s.name));
    t.appendChild(html('thead')).appendChild(head);
    const body = t.appendChild(html('tbody'));
    const fmts = p.series.map((s) => this.seriesFormatter(s));
    for (let i = 0; i < p.n; i++) {
      const tr = html('tr');
      tr.appendChild(html('th', { scope: 'row' }, this.xLabel(i, false)));
      p.series.forEach((s, k) => tr.appendChild(html('td', {}, isFinite(s.values[i]) ? fmts[k](s.values[i]) : '—')));
      body.appendChild(tr);
    }
  }

  private ariaLabel(): string {
    if (this.opts.ariaLabel) return this.opts.ariaLabel;
    const kinds = [...new Set(this.prepared.series.map((s) => s.impl.label ?? s.type))];
    const what = kinds.length ? 'Gráfico de ' + kinds.join(' y ') : 'Gráfico';
    const title = this.opts.title ? `${this.opts.title}. ` : '';
    return `${title}${what} con ${this.prepared.series.length} ${this.prepared.series.length === 1 ? 'serie' : 'series'} y ${this.prepared.n} puntos. Usa las flechas izquierda y derecha para recorrer los datos.`;
  }

  // ------------------------------------------------------------ Hover, tooltip y teclado

  private bindEvents(): void {
    const move = (e: PointerEvent) => {
      const L = this.layout;
      if (!L || !this.opts.tooltip || !this.prepared.n) return;
      const r = this.svgEl.getBoundingClientRect();
      const px = e.clientX - r.left - L.left;
      this.pointerY = e.clientY - r.top;
      this.setActive(L.x.indexAt(px), false);
    };
    this.overlay.addEventListener('pointermove', move);
    this.overlay.addEventListener('pointerdown', move);
    this.overlay.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.clearActive();
    });
    this.svgEl.addEventListener('keydown', (e) => {
      const n = this.prepared.n;
      if (!n) return;
      let i = this.active;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          i = i < 0 ? 0 : Math.min(n - 1, i + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          i = i < 0 ? n - 1 : Math.max(0, i - 1);
          break;
        case 'Home':
          i = 0;
          break;
        case 'End':
          i = n - 1;
          break;
        case 'Escape':
          this.clearActive();
          return;
        default:
          return;
      }
      e.preventDefault();
      this.pointerY = -1;
      this.setActive(i, true);
    });
    this.svgEl.addEventListener('blur', () => this.clearActive());
  }

  private setActive(i: number, announce: boolean): void {
    if (i === this.active && !announce) {
      this.positionTooltip();
      return;
    }
    this.active = i;
    this.showActive(announce);
  }

  private clearActive(): void {
    this.active = -1;
    this.gBand.innerHTML = '';
    this.gHover.innerHTML = '';
    this.tooltipEl.classList.remove('lc-show');
  }

  /** Dibuja la marca de hover (banda o crosshair + puntos) y llena el tooltip. */
  private showActive(announce: boolean): void {
    const L = this.layout;
    const frame = this.current;
    const i = this.active;
    if (!L || !frame || i < 0 || i >= this.prepared.n) return;
    const th = this.theme;
    const y = new LinearScale(frame.d0, frame.d1, L.plotH, 0);
    const cx = L.x.at(i);
    if (L.x.kind === 'band') {
      const w = L.x.bandwidth;
      this.gBand.innerHTML = `<rect${attrs({ x: (cx - w / 2).toFixed(2), y: 0, width: w.toFixed(2), height: L.plotH, fill: th.highlight, rx: 4 })}/>`;
    } else {
      this.gBand.innerHTML = '';
    }
    let marks = '';
    if (L.x.kind !== 'band') {
      marks += `<line${attrs({ x1: Math.round(cx) + 0.5, x2: Math.round(cx) + 0.5, y1: 0, y2: L.plotH, stroke: th.textMuted, 'stroke-width': 1, 'stroke-opacity': 0.6, 'shape-rendering': 'crispEdges' })}/>`;
    }
    for (const f of frame.series) {
      if (f.alpha < 0.5 || !f.ps.impl.hover) continue;
      marks += f.ps.impl.hover(this.drawCtx(f, L, y, frame.n), i);
    }
    this.gHover.innerHTML = marks;
    this.fillTooltip(i);
    this.positionTooltip();
    if (announce) this.liveEl.textContent = this.describe(i);
  }

  private visibleAt(i: number) {
    return this.prepared.series
      .filter((s) => !this.hidden.has(s.key))
      .map((s) => ({ s, v: s.values[i], text: isFinite(s.values[i]) ? this.seriesFormatter(s)(s.values[i]) : 'Sin dato' }));
  }

  /** El tooltip se arma con textContent (nunca innerHTML con datos del usuario). */
  private fillTooltip(i: number): void {
    const tt = this.tooltipEl;
    tt.replaceChildren(html('div', { class: 'lc-tt-head' }, this.xLabel(i, false)));
    const rows = this.visibleAt(i);
    // Total si hay 2 o más series visibles en una misma pila: va justo debajo de ellas.
    const stacked = rows.filter((r) => r.s.stackKey);
    const oneStack = stacked.length >= 2 && stacked.every((r) => r.s.stackKey === stacked[0].s.stackKey);
    const last = oneStack ? stacked[stacked.length - 1] : null;
    for (const r of rows) {
      const row = html('div', { class: 'lc-tt-row' });
      const key = html('span', { class: 'lc-tt-key' });
      key.style.background = r.s.color;
      row.append(key, html('span', { class: 'lc-tt-val' }, r.text), html('span', { class: 'lc-tt-name' }, r.s.name));
      tt.appendChild(row);
      if (r === last) {
        const total = stacked.reduce((a, x) => a + (isFinite(x.v) ? x.v : 0), 0);
        const tr = html('div', { class: 'lc-tt-row lc-tt-total' + (r !== rows[rows.length - 1] ? ' lc-tt-mid' : '') });
        tr.append(html('span', { class: 'lc-tt-val' }, this.seriesFormatter(r.s)(total)), html('span', { class: 'lc-tt-name' }, 'Total'));
        tt.appendChild(tr);
      }
    }
    if (this.opts.tooltip) tt.classList.add('lc-show');
  }

  private positionTooltip(): void {
    const L = this.layout;
    if (!L || this.active < 0) return;
    const tt = this.tooltipEl;
    const cx = L.left + L.x.at(this.active);
    const w = tt.offsetWidth;
    const h = tt.offsetHeight;
    const off = L.x.kind === 'band' ? L.x.bandwidth / 2 + 8 : 14;
    let x = cx + off;
    if (x + w > L.width) x = cx - off - w;
    x = Math.max(0, Math.min(L.width - w, x));
    const py = this.pointerY >= 0 ? this.pointerY - h / 2 : L.top;
    const yy = Math.max(0, Math.min(L.height - h, py));
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(yy)}px)`;
  }

  private describe(i: number): string {
    return this.xLabel(i, false) + ': ' + this.visibleAt(i).map((r) => `${r.s.name} ${r.text}`).join(', ');
  }

  // ------------------------------------------------------------ Exportar

  private exportSVG(): { markup: string; width: number; height: number } {
    const th = this.theme;
    const pad = 16;
    const width = this.width || 640;
    const fam = getComputedStyle(this.root).fontFamily || 'system-ui, sans-serif';
    const saved = this.width;
    this.width = width - pad * 2;
    const L = this.computeLayout()!;
    this.width = saved;
    const parts = this.renderParts(this.target, L);

    let yCur = pad;
    let head = '';
    if (this.opts.title) {
      head += `<text${attrs({ x: pad, y: yCur + 15, 'font-size': 15, 'font-weight': 600, fill: th.text })}>${esc(this.opts.title)}</text>`;
      yCur += 21;
    }
    if (this.opts.subtitle) {
      head += `<text${attrs({ x: pad, y: yCur + 13, 'font-size': 13, fill: th.textMuted })}>${esc(this.opts.subtitle)}</text>`;
      yCur += 19;
    }
    if (head) yCur += 12;
    const plotY = yCur;
    yCur += L.height;

    // Leyenda con salto de línea.
    let legend = '';
    const series = this.prepared.series;
    if (this.opts.legend !== false && series.length >= 2) {
      yCur += 14;
      let lx = pad;
      const font = `13px ${fam}`;
      for (const s of series) {
        const tw = textWidth(s.name, font);
        const itemW = 12 + 8 + tw + 20;
        if (lx + itemW > width - pad && lx > pad) {
          lx = pad;
          yCur += 22;
        }
        const on = !this.hidden.has(s.key);
        const sw =
          s.impl.legendSymbol === 'line'
            ? `<rect${attrs({ x: lx, y: yCur + 5, width: 14, height: 3, rx: 1.5, fill: on ? s.color : th.textMuted })}/>`
            : `<rect${attrs({ x: lx, y: yCur, width: 12, height: 12, rx: 3, fill: on ? s.color : 'none', stroke: on ? undefined : th.textMuted, 'stroke-width': on ? undefined : 1.5 })}/>`;
        legend += sw + `<text${attrs({ x: lx + 20, y: yCur + 6, 'font-size': 13, fill: on ? th.text : th.textMuted, 'dominant-baseline': 'central' })}>${esc(s.name)}</text>`;
        lx += itemW;
      }
      yCur += 12;
    }
    const height = Math.ceil(yCur + pad);
    const markup =
      `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width, height, viewBox: `0 0 ${width} ${height}`, 'font-family': fam, role: 'img', 'aria-label': this.ariaLabel() })}>` +
      (this.opts.title ? `<title>${esc(this.opts.title)}</title>` : '') +
      `<rect width="100%" height="100%" fill="${th.surface}"/>` +
      head +
      `<g transform="translate(${pad + L.left},${plotY + L.top})">${parts.grid}${parts.series}${parts.axes}</g>` +
      legend +
      `</svg>`;
    return { markup, width, height };
  }
}

/** Ajusta un arreglo a longitud n, rellenando con `fill`. */
function fit<T>(a: T[], n: number, fill: T): T[] {
  if (a.length === n) return a;
  const out = a.slice(0, n);
  while (out.length < n) out.push(fill);
  return out;
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { LIGHT, DARK };
