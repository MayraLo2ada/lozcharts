/**
 * LozCharts para React: `import { Chart, Multiples } from '@lozcharts/core/react'`.
 *
 * Las opciones del gráfico van como props. El componente crea el gráfico al montarse, lo
 * destruye al desmontarse y, en cada render, decide qué cambió:
 * - los datos (`data`, comparados por referencia): `setData`, que anima desde lo que se ve;
 * - cualquier otra opción (comparada por contenido, no por referencia): `setOptions`.
 * Así un objeto de opciones escrito en línea, que es nuevo en cada render, no vuelve a animar
 * el gráfico si su contenido es el mismo. Una opción que se quita, se quita del gráfico. Las
 * funciones (onHover, onZoom, un formato) siempre llaman a su versión más reciente.
 *
 * El `ref` da la instancia (LozChart o LozMultiples) para usar sus métodos: download, zoomTo…
 */
import { createElement, forwardRef, useEffect, useRef, type CSSProperties, type MutableRefObject, type Ref } from 'react';
import { LozChart, type LozMultiples } from '@lozcharts/core';
import type { LozChartOptions, MultiplesOptions } from '@lozcharts/core';
import { optionsKey, optionsPatch, withLatest } from './core/sync';

export { optionsKey };

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
  setData(data: readonly object[]): unknown;
  setOptions(options: object): unknown;
  destroy(): void;
}

/** Separa las props del contenedor de las opciones del gráfico. */
function split<T extends ContainerProps>(props: T): [Omit<T, keyof ContainerProps>, ContainerProps] {
  const { className, style, id, ...options } = props;
  return [options, { className, style, id }];
}

function useInstance<O extends { data: readonly object[] }, I extends Instance>(
  options: O,
  create: (el: HTMLElement, options: O) => I,
  ref: Ref<I | null>,
): (el: HTMLDivElement | null) => void {
  const el = useRef<HTMLDivElement | null>(null);
  const instance = useRef<I | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const applied = useRef<{ options: O; key: string } | null>(null);
  const key = optionsKey(options);

  // Montar y desmontar. En modo estricto React monta dos veces: destruir en la limpieza lo cubre.
  useEffect(() => {
    if (!el.current) return;
    const opts = latest.current;
    instance.current = create(el.current, withLatest(opts, latest));
    applied.current = { options: opts, key: optionsKey(opts) };
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
    if (prev.key !== key) chart.setOptions(withLatest(optionsPatch(prev.options, options), latest));
    else if (prev.options.data !== options.data) chart.setData(options.data);
    applied.current = { options, key };
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
