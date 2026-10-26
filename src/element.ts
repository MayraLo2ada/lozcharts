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
 * Emite `lozhover`, `lozzoom` y `lozclick` (CustomEvent con la X, el tramo o `{ x, index, series }`
 * en `detail`); en small multiples
 * (`facet`) no hay eventos: el puntero ya se sincroniza entre los paneles.
 */
import { LozChart, type LozMultiples } from 'lozcharts';
import type { LozChartOptions, MultiplesOptions } from 'lozcharts';
import { optionsKey, optionsPatch } from './core/sync';

type Options = LozChartOptions | MultiplesOptions;

const isMultiples = (o: Options): o is MultiplesOptions => 'facet' in o && !!o.facet;

// En el servidor (SSR) no hay HTMLElement: el módulo se puede importar igual y no define nada.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class LozChartElement extends Base {
  static observedAttributes = ['options'];
  private _options: Options | null = null;
  private _chart: LozChart | LozMultiples | null = null;
  /** Las opciones que tiene el gráfico: las que llegan mientras el elemento está fuera de la página se aplican al volver. */
  private _applied: Options | null = null;
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
    this._options = value;
    this.render();
  }

  attributeChangedCallback(_name: string, _old: string | null, value: string | null): void {
    if (value === null) return;
    try {
      this.options = JSON.parse(value) as Options;
    } catch (err) {
      console.error(
        'LozCharts: el atributo options no es un JSON válido, así que el gráfico sigue con las opciones anteriores.',
        err,
      );
    }
  }

  connectedCallback(): void {
    // Si un framework asignó `options` antes de que el elemento se definiera, quedó como propiedad
    // propia que tapa el setter: se quita y se vuelve a asignar para que pase por él.
    if (Object.prototype.hasOwnProperty.call(this, 'options')) {
      const value = (this as unknown as { options: Options | null }).options;
      delete (this as unknown as { options?: unknown }).options;
      this.options = value;
    }
    if (!this.style.display) this.style.display = 'block';
    // Moverlo de lugar lo desconecta y lo vuelve a conectar: el gráfico que ya tiene se conserva
    // (con su zoom y sus series ocultas), y las opciones que llegaron mientras estaba fuera se aplican.
    if (!this._chart || this._applied !== this._options) this.render();
  }

  disconnectedCallback(): void {
    // Un elemento que solo se mueve de lugar vuelve a conectarse en el mismo turno: se espera
    // un instante antes de destruir, para no rehacer el gráfico por nada.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this._chart?.destroy();
      this._chart = null;
      this._applied = null;
    });
  }

  private render(): void {
    const o = this._options;
    if (!o || !this.isConnected) return;
    const prev = this._applied;
    this._applied = o;
    const multiples = isMultiples(o);
    if (this._chart && multiples === this._multiples && prev) {
      if (optionsKey(prev) === optionsKey(o)) {
        if (prev.data !== o.data) this._chart.setData(o.data);
      } else {
        // Lo que se quitó de las opciones también se quita del gráfico.
        (this._chart as LozChart).setOptions(this.withEvents(optionsPatch(prev, o)) as LozChartOptions);
      }
      return;
    }
    this._chart?.destroy();
    this._multiples = multiples;
    this._chart = multiples
      ? LozChart.multiples(this, o as MultiplesOptions)
      : new LozChart(this, this.withEvents(o) as LozChartOptions);
  }

  /** Las funciones onHover, onZoom y onClick se suman a eventos del DOM, que es como escuchan los frameworks. */
  private withEvents(o: Options): Options {
    if (isMultiples(o)) return o;
    const user = o as LozChartOptions;
    return {
      ...user,
      onHover: (x, index, series) => {
        user.onHover?.(x, index, series);
        this.dispatchEvent(new CustomEvent('lozhover', { detail: x, bubbles: true }));
      },
      onZoom: (range, window) => {
        user.onZoom?.(range, window);
        this.dispatchEvent(new CustomEvent('lozzoom', { detail: range, bubbles: true }));
      },
      onClick: (x, index, series) => {
        user.onClick?.(x, index, series);
        this.dispatchEvent(new CustomEvent('lozclick', { detail: { x, index, series }, bubbles: true }));
      },
    };
  }
}

/** Registra `<loz-chart>` (una sola vez, aunque el módulo se cargue dos veces). */
export function defineLozChartElement(name = 'loz-chart'): void {
  if (typeof customElements !== 'undefined' && !customElements.get(name)) customElements.define(name, LozChartElement);
}

defineLozChartElement();
