/**
 * `<loz-chart>`: LozCharts como elemento HTML estándar (Custom Element). Funciona igual en HTML
 * puro, Angular, Vue, Svelte o cualquier otro framework, sin un adaptador para cada uno.
 *
 *   import 'lozcharts/element';
 *   <loz-chart options='{"data": [...], "xAxis": {...}, "series": [...]}'></loz-chart>
 *
 * Las opciones llegan por el atributo `options` (JSON) o por la propiedad `options` (un objeto,
 * que es lo que usan los frameworks: `[options]="opciones"` en Angular, `:options` en Vue).
 * Al cambiar las opciones el gráfico anima; si solo cambian los datos, usa setData. Con `facet`
 * en las opciones crea small multiples. El gráfico se destruye al quitar el elemento.
 * Emite `lozhover` y `lozzoom` (CustomEvent con la X o el tramo en `detail`).
 */
import { LozChart, type LozMultiples } from 'lozcharts';
import type { LozChartOptions, MultiplesOptions } from 'lozcharts';

type Options = LozChartOptions | MultiplesOptions;

const isMultiples = (o: Options): o is MultiplesOptions => 'facet' in o && !!o.facet;

// En el servidor (SSR) no hay HTMLElement: el módulo se puede importar igual y no define nada.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class LozChartElement extends Base {
  static observedAttributes = ['options'];
  private _options: Options | null = null;
  private _chart: LozChart | LozMultiples | null = null;
  /** ¿El gráfico actual es de small multiples? Si eso cambia, se recrea. */
  private _multiples = false;

  /** La instancia (LozChart o LozMultiples), para usar sus métodos: download, zoomTo… */
  get chart(): LozChart | LozMultiples | null {
    return this._chart;
  }

  get options(): Options | null {
    return this._options;
  }

  set options(value: Options | null) {
    const prev = this._options;
    this._options = value;
    this.render(prev);
  }

  attributeChangedCallback(_name: string, _old: string | null, value: string | null): void {
    if (value === null) return;
    try {
      this.options = JSON.parse(value) as Options;
    } catch (err) {
      console.error('LozChart: el atributo options no es JSON válido.', err);
    }
  }

  connectedCallback(): void {
    if (!this.style.display) this.style.display = 'block';
    this.render(null);
  }

  disconnectedCallback(): void {
    // Un elemento que solo se mueve de lugar vuelve a conectarse en el mismo turno: se espera
    // un instante antes de destruir, para no rehacer el gráfico por nada.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this._chart?.destroy();
      this._chart = null;
    });
  }

  private render(prev: Options | null): void {
    const o = this._options;
    if (!o || !this.isConnected) return;
    const multiples = isMultiples(o);
    const withEvents = this.withEvents(o);
    if (this._chart && multiples === this._multiples && prev) {
      const sameExceptData = JSON.stringify({ ...prev, data: undefined }) === JSON.stringify({ ...o, data: undefined });
      if (sameExceptData) this._chart.setData(o.data);
      else (this._chart as LozChart).setOptions(withEvents as LozChartOptions);
      return;
    }
    this._chart?.destroy();
    this._multiples = multiples;
    this._chart = multiples
      ? LozChart.multiples(this, withEvents as MultiplesOptions)
      : new LozChart(this, withEvents as LozChartOptions);
  }

  /** Las funciones onHover y onZoom se suman a eventos del DOM, que es como escuchan los frameworks. */
  private withEvents(o: Options): Options {
    if (isMultiples(o)) return o;
    const user = o as LozChartOptions;
    return {
      ...user,
      onHover: (x) => {
        user.onHover?.(x);
        this.dispatchEvent(new CustomEvent('lozhover', { detail: x, bubbles: true }));
      },
      onZoom: (range) => {
        user.onZoom?.(range);
        this.dispatchEvent(new CustomEvent('lozzoom', { detail: range, bubbles: true }));
      },
    };
  }
}

/** Registra `<loz-chart>` (una sola vez, aunque el módulo se cargue dos veces). */
export function defineLozChartElement(name = 'loz-chart'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) customElements.define(name, LozChartElement);
}

defineLozChartElement();
