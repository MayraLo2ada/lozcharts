/**
 * Un DOM mínimo para probar el núcleo (chart.ts) en Node: solo lo que el gráfico usa para montarse,
 * dibujar y recibir eventos. El markup que se asigna con innerHTML se guarda como texto, sin
 * interpretarlo: las pruebas lo leen tal cual. No hay layout: todo elemento mide `WIDTH` de ancho.
 */

/** Ancho de cada elemento, en px. */
export let WIDTH = 600;

/** Cambia el ancho y avisa a los ResizeObserver, como al achicar la ventana. */
export function resize(width: number): void {
  WIDTH = width;
  for (const ro of observers) ro.fire();
}

type Listener = (e: FakeEvent) => void;

export interface FakeEvent {
  type: string;
  target?: FakeElement;
  clientX?: number;
  clientY?: number;
  key?: string;
  button?: number;
  pointerId?: number;
  pointerType?: string;
  detail?: number;
  defaultPrevented?: boolean;
  preventDefault(): void;
}

class ClassList {
  constructor(private readonly el: FakeElement) {}
  private get list(): string[] {
    return this.el.className.split(/\s+/).filter(Boolean);
  }
  add(...names: string[]) {
    this.el.className = [...new Set([...this.list, ...names])].join(' ');
  }
  remove(...names: string[]) {
    this.el.className = this.list.filter((c) => !names.includes(c)).join(' ');
  }
  contains(name: string) {
    return this.list.includes(name);
  }
  toggle(name: string, force?: boolean) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}

class Style {
  [k: string]: unknown;
  setProperty(k: string, v: string) {
    this[k] = v;
  }
}

export class FakeElement {
  className = '';
  readonly classList = new ClassList(this);
  readonly style = new Style();
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  hidden = false;
  tabIndex = 0;
  private html = '';
  private text = '';
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly tagName: string) {}

  setAttribute(k: string, v: string) {
    if (k === 'class') this.className = v;
    else this.attributes.set(k, String(v));
  }
  getAttribute(k: string) {
    return k === 'class' ? this.className : (this.attributes.get(k) ?? null);
  }
  hasAttribute(k: string) {
    return this.attributes.has(k);
  }
  removeAttribute(k: string) {
    this.attributes.delete(k);
  }

  get textContent(): string {
    return this.text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    this.replaceChildren();
    this.text = v;
  }
  get innerHTML(): string {
    return this.html;
  }
  set innerHTML(v: string) {
    this.replaceChildren();
    this.html = v;
  }

  append(...nodes: FakeElement[]) {
    for (const n of nodes) {
      n.remove();
      n.parent = this;
      this.children.push(n);
    }
  }
  appendChild(n: FakeElement) {
    this.append(n);
    return n;
  }
  replaceChildren(...nodes: FakeElement[]) {
    for (const c of this.children) c.parent = null;
    this.children = [];
    this.html = '';
    this.text = '';
    this.append(...nodes);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  private insert(n: FakeElement, offset: number) {
    const p = this.parent;
    if (!p) return;
    n.remove();
    n.parent = p;
    p.children.splice(p.children.indexOf(this) + offset, 0, n);
  }
  after(n: FakeElement) {
    this.insert(n, 1);
  }
  before(n: FakeElement) {
    this.insert(n, 0);
  }
  get firstElementChild() {
    return this.children[0] ?? null;
  }
  get lastElementChild() {
    return this.children[this.children.length - 1] ?? null;
  }
  get isConnected(): boolean {
    let n: FakeElement | null = this;
    while (n.parent) n = n.parent;
    return n === doc.documentElement;
  }
  contains(n: FakeElement | null): boolean {
    for (let x = n; x; x = x.parent) if (x === this) return true;
    return false;
  }
  /** Busca por clase ('.lc-tooltip') o por etiqueta ('button'). */
  querySelector(sel: string): FakeElement | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  querySelectorAll(sel: string): FakeElement[] {
    const ok = (e: FakeElement) => (sel.startsWith('.') ? e.classList.contains(sel.slice(1)) : e.tagName === sel);
    const out: FakeElement[] = [];
    const walk = (e: FakeElement) => {
      for (const c of e.children) {
        if (ok(c)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  addEventListener(type: string, fn: Listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((f) => f !== fn),
    );
  }
  dispatchEvent(e: FakeEvent) {
    e.target ??= this;
    for (const fn of this.listeners.get(e.type) ?? []) fn(e);
    return !e.defaultPrevented;
  }

  get clientWidth() {
    return WIDTH;
  }
  get offsetWidth() {
    return 160;
  }
  get offsetHeight() {
    return 60;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: WIDTH, bottom: 400, width: WIDTH, height: 400, x: 0, y: 0 };
  }
  focus() {}
  setPointerCapture() {}
  getContext() {
    return null;
  }
}

const doc = {
  documentElement: new FakeElement('html'),
  head: new FakeElement('head'),
  body: new FakeElement('body'),
  createElement: (tag: string) => new FakeElement(tag),
  createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
  getElementById(id: string): FakeElement | null {
    const all = [this.head, ...this.head.querySelectorAll('style'), ...this.body.querySelectorAll('div')];
    return all.find((e) => e.attributes.get('id') === id || (e as { id?: string }).id === id) ?? null;
  },
  querySelector: (sel: string) => doc.documentElement.querySelector(sel),
};
doc.documentElement.append(doc.head, doc.body);

const observers = new Set<{ fire(): void }>();

class FakeResizeObserver {
  constructor(private readonly fn: () => void) {}
  observe() {
    observers.add(this);
  }
  disconnect() {
    observers.delete(this);
  }
  fire() {
    this.fn();
  }
}

const g = globalThis as Record<string, unknown>;
g.document = doc;
g.getComputedStyle = () => ({ fontFamily: 'system-ui' });
g.ResizeObserver = FakeResizeObserver;
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => {};

/** Un contenedor nuevo dentro del documento, para montar un gráfico. */
export function host(): HTMLElement {
  const el = new FakeElement('div');
  doc.body.append(el);
  return el as unknown as HTMLElement;
}

/** Un evento con lo que lee el gráfico. */
export function event(type: string, props: Partial<FakeEvent> = {}): FakeEvent {
  return {
    type,
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
    ...props,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}
