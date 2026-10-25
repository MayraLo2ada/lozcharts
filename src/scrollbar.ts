/**
 * Barra de desplazamiento del zoom: un mini gráfico con todos los datos y, encima, la ventana
 * que se está viendo.
 *
 * - Arrastrar la ventana la mueve; arrastrar sus bordes la agranda o la achica.
 * - Un clic fuera de la ventana la centra ahí (y se puede seguir arrastrando).
 * - Con el teclado, la ventana y cada borde son controles deslizantes: las flechas mueven un
 *   dato (con Shift, un décimo), Re Pág y Av Pág una ventana entera, Inicio y Fin van a los extremos.
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
  /** Fracción del eje que ocupa un dato (para mover de a uno con el teclado). */
  unit(): number;
  /** Texto de la X en una fracción del eje ("mar 2026"): el primer dato desde ahí, o el último hasta ahí. */
  label(fraction: number, edge: 'start' | 'end'): string;
}

/** Alto del mini gráfico (el CSS de .lc-scroll usa el mismo valor). */
export const SCROLLBAR_HEIGHT = 36;
/** Distancia mínima entre los centros de los dos bordes, en px. */
const MIN_GRIP_GAP = 28;

type Part = 'window' | 'start' | 'end';

export class Scrollbar {
  readonly el: HTMLDivElement;
  private readonly mini: HTMLDivElement;
  private readonly before: HTMLDivElement;
  private readonly after: HTMLDivElement;
  private readonly win: HTMLDivElement;
  private readonly startGrip: HTMLDivElement;
  private readonly endGrip: HTMLDivElement;
  private drag: { part: Part; pointer: number; x: number; view: View } | null = null;

  constructor(private readonly host: ScrollbarHost) {
    this.el = html('div', { class: 'lc-scroll' });
    this.mini = html('div', { class: 'lc-scroll-mini', 'aria-hidden': 'true' });
    this.before = html('div', { class: 'lc-scroll-shade' });
    this.after = html('div', { class: 'lc-scroll-shade' });
    this.win = this.slider('lc-scroll-win', 'Ventana visible del eje X');
    this.startGrip = this.slider('lc-scroll-grip', 'Inicio de la ventana');
    this.endGrip = this.slider('lc-scroll-grip', 'Fin de la ventana');
    this.el.append(this.mini, this.before, this.after, this.win, this.startGrip, this.endGrip);
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

  private slider(cls: string, label: string): HTMLDivElement {
    return html('div', {
      class: cls,
      role: 'slider',
      tabindex: '0',
      'aria-label': label,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    });
  }

  /** Ubica la barra bajo el área de datos y le pone el mini gráfico (SVG ya armado). */
  render(left: number, width: number, miniSVG: string): void {
    this.el.style.marginLeft = `${left}px`;
    this.el.style.width = `${width}px`;
    this.mini.innerHTML = miniSVG;
  }

  /** Mueve la ventana a `view` y actualiza lo que dicen los controles. */
  sync(view: View): void {
    const pct = (f: number) => `${(f * 100).toFixed(3)}%`;
    this.before.style.left = '0';
    this.before.style.width = pct(view.start);
    this.after.style.left = pct(view.end);
    this.after.style.width = pct(1 - view.end);
    this.win.style.left = pct(view.start);
    this.win.style.width = pct(view.end - view.start);
    // Con una ventana muy angosta, los bordes se separan hacia afuera: nunca se montan uno sobre
    // otro ni tapan la ventana, que se sigue pudiendo arrastrar.
    const px = (view.end - view.start) * this.el.clientWidth;
    const apart = Math.max(0, (MIN_GRIP_GAP - px) / 2);
    this.startGrip.style.left = `calc(${pct(view.start)} - ${apart.toFixed(1)}px)`;
    this.endGrip.style.left = `calc(${pct(view.end)} + ${apart.toFixed(1)}px)`;
    const from = this.host.label(view.start, 'start');
    const to = this.host.label(view.end, 'end');
    // La ventana se mueve por su inicio, que llega como mucho a 100 menos su tramo.
    this.win.setAttribute('aria-valuemax', String(Math.round((1 - (view.end - view.start)) * 100)));
    this.win.setAttribute('aria-valuenow', String(Math.round(view.start * 100)));
    this.win.setAttribute('aria-valuetext', `De ${from} a ${to}`);
    this.startGrip.setAttribute('aria-valuenow', String(Math.round(view.start * 100)));
    this.startGrip.setAttribute('aria-valuetext', from);
    this.endGrip.setAttribute('aria-valuenow', String(Math.round(view.end * 100)));
    this.endGrip.setAttribute('aria-valuetext', to);
  }

  private fraction(clientX: number): number {
    const box = this.el.getBoundingClientRect();
    return box.width ? (clientX - box.left) / box.width : 0;
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;
    let part: Part = target === this.startGrip ? 'start' : target === this.endGrip ? 'end' : 'window';
    let view = this.host.view();
    if (part === 'window' && target !== this.win) {
      // Clic fuera de la ventana: se centra ahí y el arrastre sigue desde ese punto.
      const span = view.end - view.start;
      view = clampView(this.fraction(e.clientX) - span / 2, this.fraction(e.clientX) + span / 2, this.host.minSpan());
      this.host.setView(view, false);
      part = 'window';
    }
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this.drag = { part, pointer: e.pointerId, x: this.fraction(e.clientX), view };
    this.el.classList.add('lc-dragging');
  };

  private readonly onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    const delta = this.fraction(e.clientX) - d.x;
    this.host.setView(this.moved(d.view, d.part, delta), false);
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
        delta = part === 'window' ? -span : -0.1;
        break;
      case 'PageDown':
        delta = part === 'window' ? span : 0.1;
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
