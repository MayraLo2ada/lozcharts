/**
 * Ejemplo de LozCharts en React: un tablero con filtro, zoom y descarga.
 * Se compila con `npm run example:react` y se abre examples/react/index.html.
 */
import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LozChart } from '@lozcharts/core';
import { Chart, Multiples } from '@lozcharts/core/react';

const REGIONES = ['Norte', 'Centro', 'Sur'] as const;
type Region = (typeof REGIONES)[number];

/** Ventas diarias de un año por región (datos de ejemplo, siempre iguales). */
function ventasDiarias(region: Region) {
  const base = { Norte: 5200, Centro: 4300, Sur: 3600 }[region];
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(2025, 10, 1 + i);
    const semana = [0.8, 1, 1.04, 1.06, 1.03, 0.97, 0.78][d.getDay()];
    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      fecha,
      online: Math.round((base + i * 7) * semana + 300 * Math.sin(i * 1.3)),
      tienda: Math.round((base * 0.7 + i * 3) * semana + 200 * Math.cos(i * 0.7)),
    };
  });
}

function App() {
  const [region, setRegion] = useState<Region>('Norte');
  const [zoom, setZoom] = useState<string>('Todo el año');
  const chart = useRef<LozChart>(null);
  // Los datos se memorizan: el gráfico anima solo cuando cambian de verdad.
  const data = useMemo(() => ventasDiarias(region), [region]);
  const meses = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) => {
        const row: Record<string, string | number> = { mes: `2026-${String(m + 1).padStart(2, '0')}` };
        REGIONES.forEach((r, k) => (row[r] = Math.round(120 + k * 20 + m * (k + 1) * 3 + 15 * Math.sin(m + k))));
        return row;
      }),
    [],
  );

  return (
    <main>
      <h1>Tablero de ventas</h1>
      <div className="filtros" role="group" aria-label="Región">
        {REGIONES.map((r) => (
          <button key={r} type="button" aria-pressed={r === region} onClick={() => setRegion(r)}>
            {r}
          </button>
        ))}
        <button type="button" onClick={() => chart.current?.download('png', `ventas-${region}`)}>
          Descargar PNG
        </button>
      </div>
      <Chart
        ref={chart}
        title={`Ventas diarias · ${region}`}
        subtitle={zoom}
        data={data}
        xAxis={{ field: 'fecha', type: 'time' }}
        yAxis={{ format: 'currency' }}
        series={[
          { type: 'area', field: 'online', name: 'Online', stack: true },
          { type: 'area', field: 'tienda', name: 'Tienda', stack: true },
        ]}
        zoom={{ range: ['2026-06-01', '2026-08-31'] }}
        annotations={[{ x: ['2026-07-01', '2026-07-15'], label: 'Rebajas' }]}
        onZoom={(r) =>
          setZoom(r ? `${new Date(r[0]).toLocaleDateString('es')} a ${new Date(r[1]).toLocaleDateString('es')}` : 'Todo el año')
        }
        height={340}
      />
      <Multiples
        title="Unidades por región"
        facet="series"
        context
        data={meses}
        xAxis={{ field: 'mes', type: 'time' }}
        series={REGIONES.map((r) => ({ type: 'line', field: r, name: r }))}
        height={160}
      />
    </main>
  );
}

createRoot(document.getElementById('app')!).render(<App />);
