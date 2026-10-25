/**
 * Gestos del zoom sobre el área de datos.
 *
 * - Ratón: arrastrar marca un tramo y, al soltar, se acerca a él. Doble clic vuelve a todo.
 * - Rueda: Ctrl (o ⌘) + rueda, y el pellizco del trackpad, acercan o alejan bajo el puntero.
 *   Shift + rueda, o deslizar de lado en el trackpad, mueve la ventana. La rueda sola se deja a
 *   la página: el gráfico no secuestra el scroll.
 * - Táctil: dos dedos pellizcan y se mueven juntos. Un dedo sigue recorriendo los datos con el
 *   tooltip, como sin zoom.
 *
 * Todo se traduce a cambios de la ventana (view.ts); el gráfico decide qué dibujar.
 */
import { panView, zoomView, type View } from './core/view';

export interface ZoomHost {
  /** ¿El zoom está activo en este momento? */
  enabled(): boolean;
  view(): View;
  /** Tramo mínimo de la ventana. */
  minSpan(): number;
  /** Borde izquierdo y ancho del área de datos, en px de la pantalla. */
  plotBox(): { left: number; width: number };
  setView(view: View): void;
  /** Muestra el tramo que se está marcando (px del área), o lo quita con null. */
  selection(from: number, to: number): void;
  selection(clear: null): void;
  /** Quita el tooltip y la marca del dato activo. */
  clearHover(): void;
}

/** Distancia en px a partir de la cual un arrastre es una selección (no un clic). */
const DRAG_START = 4;
/** Selección más angosta que esto se descarta. */
const MIN_SELECTION = 8;
/** Cuánto acerca la rueda por cada px de desplazamiento. */
const WHEEL_ZOOM = 0.01;
/** Paso máximo de la rueda en px por evento (una muesca acerca como mucho un 40 %). */
const MAX_WHEEL_STEP = 35;

export class ZoomGestures {
  /** Arrastre del ratón: desde dónde (px del área) y si ya es una selección. */
  private drag: { pointer: number; from: number; to: number; active: boolean } | null = null;
  private readonly touches = new Map<number, number>();
  private pinch: { distance: number; mid: number } | null = null;

  constructor(
    private readonly surface: Element,
    private readonly host: ZoomHost,
  ) {
    surface.addEventListener('pointerdown', this.onDown as EventListener);
    surface.addEventListener('pointermove', this.onMove as EventListener);
    surface.addEventListener('pointerup', this.onUp as EventListener);
    surface.addEventListener('pointercancel', this.onCancel as EventListener);
    surface.addEventListener('dblclick', this.onDoubleClick);
    surface.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    // Con dos dedos el gesto es nuestro: si el navegador empezara a mover la página por un desvío
    // vertical, cancelaría el pellizco a medias.
    surface.addEventListener('touchmove', this.onTouchMove as EventListener, { passive: false });
    // El doble clic vuelve a todo; que no seleccione texto de la página de paso.
    surface.addEventListener('mousedown', (e) => {
      if ((e as MouseEvent).detail > 1 && this.host.enabled()) e.preventDefault();
    });
  }

  /** Hay un gesto en curso: el tooltip no debe seguir al puntero. */
  get busy(): boolean {
    return !!this.drag?.active || this.pinch !== null;
  }

  private local(clientX: number): number {
    return clientX - this.host.plotBox().left;
  }

  private readonly onDown = (e: PointerEvent) => {
    if (!this.host.enabled()) return;
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, e.clientX);
      if (this.touches.size === 2) this.startPinch();
      return;
    }
    if (e.button !== 0) return;
    const x = this.local(e.clientX);
    this.drag = { pointer: e.pointerId, from: x, to: x, active: false };
  };

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      if (!this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, e.clientX);
      if (this.pinch) this.movePinch();
      return;
    }
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    const { width } = this.host.plotBox();
    d.to = Math.max(0, Math.min(width, this.local(e.clientX)));
    if (!d.active && Math.abs(d.to - d.from) >= DRAG_START) {
      d.active = true;
      (this.surface as Element & { setPointerCapture?(id: number): void }).setPointerCapture?.(e.pointerId);
      this.host.clearHover();
    }
    if (d.active) this.host.selection(d.from, d.to);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.endTouch(e.pointerId);
      return;
    }
    const d = this.drag;
    this.drag = null;
    if (!d?.active) return;
    this.host.selection(null);
    const { width } = this.host.plotBox();
    if (Math.abs(d.to - d.from) < MIN_SELECTION || !width) return;
    const v = this.host.view();
    const span = v.end - v.start;
    const a = v.start + (Math.min(d.from, d.to) / width) * span;
    const b = v.start + (Math.max(d.from, d.to) / width) * span;
    // Una selección más angosta que el mínimo se agranda alrededor de su centro.
    this.host.setView(zoomView({ start: a, end: b }, 0.5, 1, this.host.minSpan()));
  };

  private readonly onCancel = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.endTouch(e.pointerId);
      return;
    }
    if (this.drag?.active) this.host.selection(null);
    this.drag = null;
  };

  private readonly onDoubleClick = () => {
    if (!this.host.enabled()) return;
    this.host.setView({ start: 0, end: 1 });
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    if (this.host.enabled() && e.touches.length >= 2 && e.cancelable) e.preventDefault();
  };

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.host.enabled()) return;
    const { width } = this.host.plotBox();
    if (!width) return;
    // deltaMode 1 = líneas (Firefox con ratón): se pasa a px aproximados.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? width : 1;
    const v = this.host.view();
    const span = v.end - v.start;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const focus = Math.max(0, Math.min(1, this.local(e.clientX) / width));
      // Una muesca de la rueda llega como ~100 px y un pellizco como pocos px por evento: se
      // limita cada paso para que la rueda no salte de golpe a todo.
      const delta = Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, e.deltaY * unit));
      this.host.setView(zoomView(v, focus, Math.exp(-delta * WHEEL_ZOOM), this.host.minSpan()));
      return;
    }
    const sideways = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    // Sin zoom no hay nada que mover: la rueda sigue con la página.
    if (!sideways || span >= 1) return;
    e.preventDefault();
    this.host.setView(panView(v, ((sideways * unit) / width) * span));
  };

  private startPinch(): void {
    const [a, b] = [...this.touches.values()];
    this.pinch = { distance: Math.max(1, Math.abs(a - b)), mid: this.local((a + b) / 2) };
    this.drag = null;
    this.host.clearHover();
  }

  /** Dos dedos: la distancia entre ellos acerca o aleja; su punto medio arrastra la ventana. */
  private movePinch(): void {
    const p = this.pinch!;
    const [a, b] = [...this.touches.values()];
    const { width } = this.host.plotBox();
    if (!width) return;
    const distance = Math.max(1, Math.abs(a - b));
    const mid = this.local((a + b) / 2);
    let v = this.host.view();
    const span = v.end - v.start;
    v = panView(v, ((p.mid - mid) / width) * span);
    v = zoomView(v, Math.max(0, Math.min(1, mid / width)), distance / p.distance, this.host.minSpan());
    this.pinch = { distance, mid };
    this.host.setView(v);
  }

  private endTouch(id: number): void {
    this.touches.delete(id);
    if (this.touches.size < 2) this.pinch = null;
  }
}
