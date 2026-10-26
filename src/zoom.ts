/**
 * Gestos del zoom sobre el área de datos.
 *
 * - Ratón: arrastrar marca un tramo y, al soltar, se acerca a él. Con zoom en Y marca un
 *   rectángulo y acerca los dos ejes (o solo uno, si el arrastre fue casi plano en el otro).
 *   Doble clic vuelve a todo.
 * - Rueda: Ctrl (o ⌘) + rueda, y el pellizco del trackpad, acercan o alejan bajo el puntero.
 *   Sobre los números del eje Y (o su deslizante), acercan solo el eje Y.
 *   Shift + rueda, o deslizar de lado en el trackpad, mueve la ventana. La rueda sola se deja a
 *   la página: el gráfico no secuestra el scroll.
 * - Táctil: dos dedos pellizcan y se mueven juntos (en X). Un dedo sigue recorriendo los datos
 *   con el tooltip, como sin zoom.
 *
 * Todo se traduce a cambios de las ventanas (view.ts); el gráfico decide qué dibujar.
 */
import { FULL_VIEW, panView, zoomView, type View } from './core/view';

/** Rectángulo de un arrastre, en px del área de datos (y crece hacia abajo, como en pantalla). */
export interface SelectionBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ZoomHost {
  /** ¿El zoom en X está activo en este momento? */
  enabled(): boolean;
  /** ¿Y el zoom en Y? */
  yEnabled(): boolean;
  view(): View;
  yView(): View;
  /** Tramo mínimo de cada ventana. */
  minSpan(): number;
  yMinSpan(): number;
  /** El área de datos, en px de la pantalla. */
  plotBox(): { left: number; top: number; width: number; height: number };
  /** Cambia las ventanas; null deja ese eje como está. */
  setView(x: View | null, y: View | null): void;
  /** Muestra el tramo que se está marcando, o lo quita con null. */
  selection(box: SelectionBox | null): void;
  /** Quita el tooltip y la marca del dato activo. */
  clearHover(): void;
}

/** Distancia en px a partir de la cual un arrastre es una selección (no un clic). */
const DRAG_START = 4;
/** Selección más angosta que esto se descarta (en cada eje por separado). */
const MIN_SELECTION = 8;
/** Cuánto acerca la rueda por cada px de desplazamiento. */
const WHEEL_ZOOM = 0.01;
/** Paso máximo de la rueda en px por evento (una muesca acerca como mucho un 40 %). */
const MAX_WHEEL_STEP = 35;

export class ZoomGestures {
  /** Arrastre del ratón: desde dónde y hasta dónde (px del área) y si ya es una selección. */
  private drag: { pointer: number; x0: number; y0: number; x1: number; y1: number; active: boolean } | null = null;
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
      if ((e as MouseEvent).detail > 1 && this.any) e.preventDefault();
    });
  }

  /**
   * La zona del eje Y: Ctrl + rueda ahí acerca solo el eje Y. `el` puede contener el área de
   * datos (el SVG entero): solo cuenta lo que queda a su izquierda.
   */
  watchAxis(el: Element): void {
    el.addEventListener('wheel', this.onAxisWheel as EventListener, { passive: false });
  }

  /** Hay un gesto en curso: el tooltip no debe seguir al puntero. */
  get busy(): boolean {
    return !!this.drag?.active || this.pinch !== null;
  }

  private get any(): boolean {
    return this.host.enabled() || this.host.yEnabled();
  }

  private local(clientX: number): number {
    return clientX - this.host.plotBox().left;
  }

  private localY(clientY: number): number {
    return clientY - this.host.plotBox().top;
  }

  private readonly onDown = (e: PointerEvent) => {
    if (!this.any) return;
    if (e.pointerType === 'touch') {
      if (!this.host.enabled()) return;
      this.touches.set(e.pointerId, e.clientX);
      if (this.touches.size === 2) this.startPinch();
      return;
    }
    if (e.button !== 0) return;
    const x = this.local(e.clientX);
    const y = this.localY(e.clientY);
    this.drag = { pointer: e.pointerId, x0: x, y0: y, x1: x, y1: y, active: false };
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
    const { width, height } = this.host.plotBox();
    d.x1 = Math.max(0, Math.min(width, this.local(e.clientX)));
    d.y1 = Math.max(0, Math.min(height, this.localY(e.clientY)));
    const moved = Math.max(this.host.enabled() ? Math.abs(d.x1 - d.x0) : 0, this.host.yEnabled() ? Math.abs(d.y1 - d.y0) : 0);
    if (!d.active && moved >= DRAG_START) {
      d.active = true;
      (this.surface as Element & { setPointerCapture?(id: number): void }).setPointerCapture?.(e.pointerId);
      this.host.clearHover();
    }
    if (d.active) this.host.selection(this.box(d, width, height));
  };

  /**
   * Lo que se marca: en cada eje con zoom, el tramo arrastrado; en el otro, todo. Con los dos,
   * un arrastre casi plano en un eje (menos que una selección) no lo cambia: se ve de lado a lado.
   */
  private box(d: NonNullable<ZoomGestures['drag']>, width: number, height: number): SelectionBox {
    const xOn = this.host.enabled() && Math.abs(d.x1 - d.x0) >= MIN_SELECTION;
    const yOn = this.host.yEnabled() && Math.abs(d.y1 - d.y0) >= MIN_SELECTION;
    // Mientras ningún eje llega al mínimo, se muestra el tramo del eje X (como sin zoom en Y).
    const xs = xOn || (this.host.enabled() && !yOn);
    return {
      x0: xs ? Math.min(d.x0, d.x1) : 0,
      x1: xs ? Math.max(d.x0, d.x1) : width,
      y0: yOn ? Math.min(d.y0, d.y1) : 0,
      y1: yOn ? Math.max(d.y0, d.y1) : height,
    };
  }

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.endTouch(e.pointerId);
      return;
    }
    const d = this.drag;
    this.drag = null;
    if (!d?.active) return;
    this.host.selection(null);
    const { width, height } = this.host.plotBox();
    if (!width || !height) return;
    const xOn = this.host.enabled() && Math.abs(d.x1 - d.x0) >= MIN_SELECTION;
    const yOn = this.host.yEnabled() && Math.abs(d.y1 - d.y0) >= MIN_SELECTION;
    if (!xOn && !yOn) return;
    // Una selección más angosta que el mínimo se agranda alrededor de su centro.
    const narrow = (v: View, a: number, b: number, min: number) => {
      const span = v.end - v.start;
      return zoomView({ start: v.start + a * span, end: v.start + b * span }, 0.5, 1, min);
    };
    const x = xOn
      ? narrow(this.host.view(), Math.min(d.x0, d.x1) / width, Math.max(d.x0, d.x1) / width, this.host.minSpan())
      : null;
    // En Y la fracción se cuenta desde abajo: la fila de más abajo en pantalla es el inicio.
    const y = yOn
      ? narrow(this.host.yView(), 1 - Math.max(d.y0, d.y1) / height, 1 - Math.min(d.y0, d.y1) / height, this.host.yMinSpan())
      : null;
    this.host.setView(x, y);
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
    if (!this.any) return;
    this.host.setView(FULL_VIEW, FULL_VIEW);
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    if (this.host.enabled() && e.touches.length >= 2 && e.cancelable) e.preventDefault();
  };

  /** Px de desplazamiento de un evento de la rueda (deltaMode 1 = líneas, en Firefox con ratón). */
  private static pixels(e: WheelEvent, page: number, delta: number): number {
    return delta * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? page : 1);
  }

  /**
   * Factor de una muesca: una llega como ~100 px y un pellizco como pocos px por evento; se
   * limita cada paso para que la rueda no salte de golpe a todo.
   */
  private static factor(e: WheelEvent, page: number): number {
    const delta = Math.max(-MAX_WHEEL_STEP, Math.min(MAX_WHEEL_STEP, ZoomGestures.pixels(e, page, e.deltaY)));
    return Math.exp(-delta * WHEEL_ZOOM);
  }

  private readonly onWheel = (e: WheelEvent) => {
    if (!this.any) return;
    const { width, height } = this.host.plotBox();
    if (!width) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Solo con zoom en Y (sin X), la rueda acerca el eje Y.
      if (!this.host.enabled()) {
        this.zoomY(e, height);
        return;
      }
      const focus = Math.max(0, Math.min(1, this.local(e.clientX) / width));
      this.host.setView(zoomView(this.host.view(), focus, ZoomGestures.factor(e, width), this.host.minSpan()), null);
      return;
    }
    if (!this.host.enabled()) return;
    const v = this.host.view();
    const span = v.end - v.start;
    const sideways = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
    // Sin zoom no hay nada que mover: la rueda sigue con la página.
    if (!sideways || span >= 1) return;
    e.preventDefault();
    this.host.setView(panView(v, (ZoomGestures.pixels(e, width, sideways) / width) * span), null);
  };

  private readonly onAxisWheel = (e: WheelEvent) => {
    if (!this.host.yEnabled() || !(e.ctrlKey || e.metaKey)) return;
    const box = this.host.plotBox();
    // Sobre el área de datos manda su propio gesto (onWheel); aquí, solo a su izquierda.
    if (e.clientX >= box.left || e.clientY < box.top - 8 || e.clientY > box.top + box.height + 8) return;
    e.preventDefault();
    this.zoomY(e, box.height);
  };

  /** Acerca o aleja el eje Y dejando quieto el valor bajo el puntero. */
  private zoomY(e: WheelEvent, height: number): void {
    if (!height) return;
    const focus = Math.max(0, Math.min(1, 1 - this.localY(e.clientY) / height));
    this.host.setView(null, zoomView(this.host.yView(), focus, ZoomGestures.factor(e, height), this.host.yMinSpan()));
  }

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
    this.host.setView(v, null);
  }

  private endTouch(id: number): void {
    this.touches.delete(id);
    if (this.touches.size < 2) this.pinch = null;
  }
}
