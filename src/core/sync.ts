/**
 * Sincronizar opciones que llegan enteras en cada cambio (props de React, la propiedad de
 * `<loz-chart>`) con un gráfico que recibe cambios parciales (setOptions combina con lo anterior).
 * Lo comparten los adaptadores; el núcleo no lo usa.
 */

/**
 * Clave de contenido de las opciones (sin los datos): dos objetos con lo mismo dan la misma
 * clave. Una función cuenta por su código: una flecha escrita en línea es la misma en cada render.
 */
export function optionsKey(options: object): string {
  return JSON.stringify(options, (k, v: unknown) => {
    if (k === 'data') return undefined;
    if (typeof v === 'function') return `ƒ${v.toString()}`;
    return v;
  });
}

/** Opciones que setOptions combina por dentro (sus claves se mezclan con las anteriores). */
const NESTED = ['xAxis', 'yAxis', 'yAxis2'];

/**
 * Lo que hay que pasarle a setOptions para llegar de `prev` a `next`: todo `next`, más
 * `undefined` en cada clave que se quitó (también dentro de los ejes). Sin esto, una opción que
 * desaparece (un título, un mínimo del eje) quedaría pegada.
 */
export function optionsPatch<T extends object>(prev: object | null, next: T): T {
  if (!prev) return next;
  const out = { ...next } as Record<string, unknown>;
  const before = prev as Record<string, unknown>;
  for (const k of Object.keys(before)) if (!(k in out)) out[k] = undefined;
  for (const k of NESTED) {
    const a = before[k];
    const b = out[k];
    if (a && typeof a === 'object' && b && typeof b === 'object') {
      const merged: Record<string, unknown> = { ...(b as object) };
      for (const key of Object.keys(a)) if (!(key in merged)) merged[key] = undefined;
      out[k] = merged;
    } else if (a && !b) out[k] = {};
  }
  return out as T;
}

/**
 * Copia de las opciones donde cada función (onHover, un formato del eje, el formato de una
 * serie…) llama a la que hay en ese mismo lugar de `latest.current`: si el usuario la cambia
 * (otra moneda en su estado), el gráfico usa la nueva sin recrearse. Los datos no se copian.
 */
export function withLatest<T extends object>(options: T, latest: { readonly current: object }): T {
  const wrap = (value: unknown, path: (string | number)[]): unknown => {
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        let fn: unknown = latest.current;
        for (const step of path) fn = fn == null ? undefined : (fn as Record<string | number, unknown>)[step];
        return (typeof fn === 'function' ? fn : value)(...args);
      };
    }
    if (Array.isArray(value)) return value.map((v, i) => wrap(v, [...path, i]));
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = path.length === 0 && k === 'data' ? v : wrap(v, [...path, k]);
      return out;
    }
    return value;
  };
  return wrap(options, []) as T;
}
