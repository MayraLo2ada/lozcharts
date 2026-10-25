/**
 * LozCharts para React: `import { Chart, Multiples } from 'lozcharts/react'`.
 *
 * Las opciones del gráfico van como props. El componente crea el gráfico al montarse, lo
 * destruye al desmontarse y, en cada render, decide qué cambió:
 * - los datos (`data`, comparados por referencia): `setData`, que anima desde lo que se ve;
 * - cualquier otra opción (comparada por contenido, no por referencia): `setOptions`.
 * Así un objeto de opciones escrito en línea, que es nuevo en cada render, no vuelve a animar
 * el gráfico si su contenido es el mismo. Las funciones (onHover, onZoom) siempre llaman a la
 * versión más reciente, sin recrear nada.
 *
 * El `ref` da la instancia (LozChart o LozMultiples) para usar sus métodos: download, zoomTo…
 */
import { createElement, forwardRef, useEffect, useRef, type CSSProperties, type MutableRefObject, type Ref } from 'react';
import { LozChart, type LozMultiples } from 'lozcharts';
import type { Datum, LozChartOptions, MultiplesOptions } from 'lozcharts';

/** Lo que el componente agrega a las opciones: clase y estilo del contenedor. */
interface ContainerProps {
  className?: string;
  style?: CSSProperties;
  /** Identificador del contenedor (por ejemplo, para una etiqueta externa). */
  id?: string;
}

export type ChartProps = LozChartOptions & ContainerProps;
export type MultiplesProps = MultiplesOptions & ContainerProps;

interface Instance {
  setData(data: Datum[]): unknown;
  setOptions(options: object): unknown;
  destroy(): void;
}

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

/** Separa las props del contenedor de las opciones del gráfico. */
function split<T extends ContainerProps>(props: T): [Omit<T, keyof ContainerProps>, ContainerProps] {
  const { className, style, id, ...options } = props;
  return [options, { className, style, id }];
}

/**
 * Las funciones de las opciones de primer nivel (onHover, onZoom) se pasan como envoltorios que
 * llaman a la última versión: cambiar la función no recrea ni redibuja el gráfico.
 */
function withLatestCallbacks<T extends object>(options: T, latest: { current: T }): T {
  const out = { ...options } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'function' && /^on[A-Z]/.test(k)) {
      out[k] = (...args: unknown[]) => (latest.current as Record<string, (...a: unknown[]) => unknown>)[k]?.(...args);
    }
  }
  return out as T;
}

function useInstance<O extends { data: Datum[] }, I extends Instance>(
  options: O,
  create: (el: HTMLElement, options: O) => I,
  ref: Ref<I | null>,
): (el: HTMLDivElement | null) => void {
  const el = useRef<HTMLDivElement | null>(null);
  const instance = useRef<I | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const applied = useRef<{ data: Datum[]; key: string } | null>(null);
  const key = optionsKey(options);

  // Montar y desmontar. En modo estricto React monta dos veces: destruir en la limpieza lo cubre.
  useEffect(() => {
    if (!el.current) return;
    const opts = latest.current;
    instance.current = create(el.current, withLatestCallbacks(opts, latest));
    applied.current = { data: opts.data, key: optionsKey(opts) };
    setRef(ref, instance.current);
    return () => {
      setRef(ref, null);
      instance.current?.destroy();
      instance.current = null;
      applied.current = null;
    };
    // Solo al montar: `create` es una función fija de cada componente y el ref no cambia.
  }, []);

  // Cambios: primero opciones (pueden traer otros ejes o series), después datos.
  useEffect(() => {
    const chart = instance.current;
    const prev = applied.current;
    if (!chart || !prev) return;
    if (prev.key !== key) chart.setOptions(withLatestCallbacks(options, latest));
    else if (prev.data !== options.data) chart.setData(options.data);
    applied.current = { data: options.data, key };
  });

  return (node) => {
    el.current = node;
  };
}

/** Entrega la instancia al `ref` del usuario, sea una función o un objeto de useRef. */
function setRef<T>(ref: Ref<T | null>, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as MutableRefObject<T | null>).current = value;
}

const createChart = (el: HTMLElement, o: LozChartOptions) => new LozChart(el, o);
const createMultiples = (el: HTMLElement, o: MultiplesOptions) => LozChart.multiples(el, o);

/** Un gráfico: `<Chart data={filas} xAxis={{ field: 'mes' }} series={[…]} />`. */
export const Chart = forwardRef<LozChart | null, ChartProps>(function Chart(props, ref) {
  const [options, container] = split(props);
  const setEl = useInstance<LozChartOptions, LozChart>(options, createChart, ref);
  return createElement('div', { ...container, ref: setEl });
});

/** Small multiples: `<Multiples facet="series" … />`. */
export const Multiples = forwardRef<LozMultiples | null, MultiplesProps>(function Multiples(props, ref) {
  const [options, container] = split(props);
  const setEl = useInstance<MultiplesOptions, LozMultiples>(options, createMultiples, ref);
  return createElement('div', { ...container, ref: setEl });
});
