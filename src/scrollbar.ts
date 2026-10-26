/**
 * Deslizante del zoom: la ventana que se está viendo sobre el eje completo.
 *
 * Hay dos formas. La delgada (la de siempre) es una línea fina con el tramo visible marcado y
 * una perilla redonda en cada extremo; va bajo el eje X o, con zoom en Y, a la izquierda del
 * eje Y (el inicio abajo). La 'mini' es una barra con un mini gráfico de todos los datos debajo.
 *
 * - Arrastrar la ventana la mueve; arrastrar sus bordes la agranda o la achica.
 * - Un clic fuera de la ventana la centra ahí (y se puede seguir arrastrando).
 * - Con el teclado, la ventana y cada borde son controles deslizantes: las flechas mueven un
 *   paso (con Shift, un décimo), Re Pág y Av Pág una ventana entera, Inicio y Fin van a los extremos.
 *
 * El mini gráfico lo dibuja el gráfico (con los mismos plugins); aquí solo se ubica y se
 * mueve la ventana, en fracciones del eje como en view.ts.
 */
import { clampView, panView, type View } from './core/view';
import { html } from './core/dom';

export interface ScrollbarHost {
  view(): View;
  setView(view: View, announce: boolean): void;
  minSpan(): number;
  /** Fracción del eje de un paso del teclado (un dato en X). */
  unit(): number;
  /** Texto del eje en una fracción ("mar 2026"): el primer dato desde ahí, o el último hasta ahí. */
  label(fraction: number, edge: 'start' | 'end'): string;
  /**
   * Nombres de los controles y lo que dice la ventana, en el idioma del gráfico. Se piden en cada
   * cambio: el idioma puede cambiar con setOptions.
   */
  texts(): ScrollbarTexts;
}

export interface ScrollbarTexts {
  window: string;
  start: string;
  end: string;
  range: (from: string, to: string) => string;
}

export type ScrollbarKind = 'thin' | 'mini';

/** Alto de la barra con mini gráfico (el CSS de .lc-mini usa el mismo valor). */
export const SCROLLBAR_HEIGHT = 36;
/** Grosor del deslizante delgado: alto en X, ancho en Y (el CSS de .lc-thin usa el mismo). */
export const THIN_SIZE = 22;
/** Distancia mínima entre los centros de los dos bordes, en px (las perillas miden 14). */
const MIN_GRIP_GAP = { thin: 22, mini: 28 };

type Part = 'window' | 'start' | 'end';

export class Scrollbar {
  readonly el: HTMLDivElement;
  /** Solo en la 'mini': el mini gráfico y el velo de lo que queda fuera de la ventana. */
  private readonly mini: HTMLDivElement | null = null;
  private readonly before: HTMLDivElement | null = null;
  private readonly after: HTMLDivElement | null = null;
  private readonly win: HTMLDivElement;
  private readonly startGrip: HTMLDivElement;
  private readonly endGrip: HTMLDivElement;
  private drag: { part: Part; pointer: number; at: number; view: View } | null = null;

  constructor(
    private readonly host: ScrollbarHost,
    readonly kind: ScrollbarKind = 'thin',
    private readonly vertical = false,
  ) {
    const cls = kind === 'mini' ? 'lc-scroll lc-mini' : `lc-scroll lc-thin${vertical ? ' lc-vertical' : ''}`;
    this.el = html('div', { class: cls });
    this.win = this.slider('lc-scroll-win');
    this.startGrip = this.slider('lc-scroll-grip');
    this.endGrip = this.slider('lc-scroll-grip');
    if (kind === 'mini') {
      this.mini = html('div', { class: 'lc-scroll-mini', 'aria-hidden': 'true' });
      this.before = html('div', { class: 'lc-scroll-shade' });
      this.after = html('div', { class: 'lc-scroll-shade' });
      this.el.append(this.mini, this.before, this.after);
    } else {
      this.el.append(html('div', { class: 'lc-scroll-track', 'aria-hidden': 'true' }));
    }
    this.el.append(this.win, this.startGrip, this.endGrip);
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    for (const [node, part] of [
      [this.win, 'window'],
      [this.startGrip, 'start'],
      [this.endGrip, 'end'],
    ] as const) {
      node.addEventListener('keydown', (e) => this.onKey(e, part));
    }
  }

  private slider(cls: string): HTMLDivElement {
    const attrs: Record<string, string> = {
      class: cls,
      role: 'slider',
      tabindex: '0',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    };
    // Un slider es horizontal si no dice nada: solo el vertical lo aclara.
    if (this.vertical) attrs['aria-orientation'] = 'vertical';
    return html('div', attrs);
  }

  /**
   * Ubica el deslizante junto al área de datos: en X, bajo ella, desde `start` px y con `length`
   * de ancho; en Y, a su izquierda, desde `start` px del borde de arriba y con `length` de alto.
   */
  place(start: number, length: number): void {
    if (this.vertical) {
      this.el.style.top = `${start}px`;
      this.el.style.height = `${length}px`;
    } else {
      this.el.style.marginLeft = `${start}px`;
      this.el.style.width = `${length}px`;
    }
  }

  /** El mini gráfico (SVG ya armado), en la 'mini'. */
  overview(miniSVG: string): void {
    if (this.mini) this.mini.innerHTML = miniSVG;
  }

  /** Mueve la ventana a `view` y actualiza lo que dicen los controles. */
  sync(view: View): void {
    const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
    // En vertical todo se cuenta desde abajo: el inicio de la ventana es su borde inferior.
    const along = this.vertical ? 'bottom' : 'left';
    const size = this.vertical ? 'height' : 'width';
    if (this.before && this.after) {
      this.before.style.left = '0';
      this.before.style.width = pct(view.start);
      this.after.style.left = pct(view.end);
      this.after.style.width = pct(1 - view.end);
    }
    this.win.style[along] = pct(view.start);
    this.win.style[size] = pct(view.end - view.start);
    // Con una ventana muy angosta, los bordes se separan hacia afuera: nunca se montan uno sobre
    // otro ni tapan la ventana, que se sigue pudiendo arrastrar.
    const length = (this.vertical ? this.el.clientHeight : this.el.clientWidth) || 0;
    const px = (view.end - view.start) * length;
    const apart = Math.max(0, (MIN_GRIP_GAP[this.kind] - px) / 2);
    this.startGrip.style[along] = `calc(${pct(view.start)} - ${apart.toFixed(1)}px)`;
    this.endGrip.style[along] = `calc(${pct(view.end)} + ${apart.toFixed(1)}px)`;
    const from = this.host.label(view.start, 'start');
    const to = this.host.label(view.end, 'end');
    const t = this.host.texts();
    this.win.setAttribute('aria-label', t.window);
    this.startGrip.setAttribute('aria-label', t.start);
    this.endGrip.setAttribute('aria-label', t.end);
    // La ventana se mueve por su inicio, que llega como mucho a 100 menos su tramo.
    this.win.setAttribute('aria-valuemax', String(Math.round((1 - (view.end - view.start)) * 100)));
    this.win.setAttribute('aria-valuenow', String(Math.round(view.start * 100)));
    this.win.setAttribute('aria-valuetext', t.range(from, to));
    this.startGrip.setAttribute('aria-valuenow', String(Math.round(view.start * 100)));
    this.startGrip.setAttribute('aria-valuetext', from);
    this.endGrip.setAttribute('aria-valuenow', String(Math.round(view.end * 100)));
    this.endGrip.setAttribute('aria-valuetext', to);
  }

  /** Fracción del eje bajo el puntero (en vertical, desde abajo). */
  private fraction(e: PointerEvent): number {
    const box = this.el.getBoundingClientRect();
    if (this.vertical) return box.height ? (box.bottom - e.clientY) / box.height : 0;
    return box.width ? (e.clientX - box.left) / box.width : 0;
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;
    let part: Part = target === this.startGrip ? 'start' : target === this.endGrip ? 'end' : 'window';
    let view = this.host.view();
    const at = this.fraction(e);
    if (part === 'window' && target !== this.win) {
      // Clic fuera de la ventana: se centra ahí y el arrastre sigue desde ese punto.
      const span = view.end - view.start;
      view = clampView(at - span / 2, at + span / 2, this.host.minSpan());
      this.host.setView(view, false);
      part = 'window';
    }
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this.drag = { part, pointer: e.pointerId, at, view };
    this.el.classList.add('lc-dragging');
  };

  private readonly onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    this.host.setView(this.moved(d.view, d.part, this.fraction(e) - d.at), false);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (this.drag?.pointer !== e.pointerId) return;
    this.drag = null;
    this.el.classList.remove('lc-dragging');
  };

  /** La ventana después de mover una de sus partes `delta` (fracción del eje). */
  private moved(v: View, part: Part, delta: number): View {
    const min = this.host.minSpan();
    if (part === 'window') return panView(v, delta);
    if (part === 'start') return { start: Math.max(0, Math.min(v.end - min, v.start + delta)), end: v.end };
    return { start: v.start, end: Math.min(1, Math.max(v.start + min, v.end + delta)) };
  }

  private onKey(e: KeyboardEvent, part: Part): void {
    const v = this.host.view();
    const span = v.end - v.start;
    const step = e.shiftKey ? 0.1 : this.host.unit();
    // Re Pág va hacia atrás en X, como en una página, y hacia arriba en Y, como se ve.
    const page = this.vertical ? 1 : -1;
    let delta: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        delta = step;
        break;
      // Re Pág y Av Pág: la ventana salta una ventana entera; un borde, un décimo del eje.
      case 'PageUp':
        delta = page * (part === 'window' ? span : 0.1);
        break;
      case 'PageDown':
        delta = -page * (part === 'window' ? span : 0.1);
        break;
      case 'Home':
        delta = -1;
        break;
      case 'End':
        delta = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    // El control con el foco ya anuncia su nuevo valor: no se repite en la región viva.
    this.host.setView(this.moved(v, part, delta), false);
  }
}
