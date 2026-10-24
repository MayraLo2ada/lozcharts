/**
 * Registro de lo que está montado en la página (gráficos y small multiples): un elemento
 * tiene a lo sumo uno, y se pueden destruir todos los de una zona, como necesita HTMX.
 */

export interface Mounted {
  readonly element: HTMLElement;
  destroy(): void;
}

const byElement = new WeakMap<HTMLElement, Mounted>();
const live = new Set<Mounted>();

/** Registra `m` en su elemento, destruyendo lo que hubiera antes ahí. */
export function mount(m: Mounted): void {
  byElement.get(m.element)?.destroy();
  byElement.set(m.element, m);
  live.add(m);
}

export function unmount(m: Mounted): void {
  if (byElement.get(m.element) === m) byElement.delete(m.element);
  live.delete(m);
}

export function mountedOn(el: HTMLElement): Mounted | undefined {
  return byElement.get(el);
}

/** Destruye lo montado dentro de `root` (incluido `root`). */
export function destroyWithin(root: ParentNode): void {
  for (const m of [...live]) if (root === m.element || root.contains(m.element)) m.destroy();
}

/** Destruye lo que quedó fuera del documento. */
export function destroyDetached(): void {
  for (const m of [...live]) if (!m.element.isConnected) m.destroy();
}
