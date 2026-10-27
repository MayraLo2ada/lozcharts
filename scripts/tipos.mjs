// Ajusta los tipos publicados (dist/types) para que funcionen con cualquier moduleResolution.
//
// 1. Extensiones. tsc copia las rutas relativas tal como están en el código ('./chart'). Con
//    "type": "module", TypeScript en node16 o nodenext lee los .d.ts como módulos ES y exige la
//    extensión: sin ella no encuentra nada y LozChart queda como `any`, sin un solo aviso. Aquí
//    cada ruta relativa pasa a './chart.js' (o './core/index.js' si es una carpeta).
// 2. require. Para quien usa CommonJS con TypeScript (node16), `require('@lozcharts/core')` necesita
//    tipos CommonJS: index.d.cts, que es la clase LozChart con todo lo demás colgado de ella,
//    igual que el build UMD; y maps/register-world.d.cts para el mapa.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const raiz = resolve('dist/types');

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith('.d.ts') ? [ruta] : [];
  });
}

function conExtension(archivo, ruta) {
  if (!ruta.startsWith('.') || ruta.endsWith('.js')) return ruta;
  const destino = resolve(dirname(archivo), ruta);
  if (existsSync(`${destino}.d.ts`)) return `${ruta}.js`;
  if (existsSync(join(destino, 'index.d.ts'))) return `${ruta}/index.js`;
  throw new Error(`tipos: ${archivo} importa '${ruta}', que no está en dist/types`);
}

for (const archivo of archivos(raiz)) {
  const antes = readFileSync(archivo, 'utf8');
  const despues = antes.replace(
    /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g,
    (_, previo, comilla, ruta) => `${previo}${comilla}${conExtension(archivo, ruta)}${comilla}`,
  );
  if (despues !== antes) writeFileSync(archivo, despues);
}

// Los tipos (LozChartOptions, SeriesOptions…) también se pueden importar desde CommonJS: van como
// alias dentro de LozChart, que TypeScript fusiona con la clase.
const indice = readFileSync(join(raiz, 'index.d.ts'), 'utf8');
const tipos = new Set([
  ...[...readFileSync(join(raiz, 'types.d.ts'), 'utf8').matchAll(/export (?:interface|type) (\w+)/g)].map((m) => m[1]),
  ...[...indice.matchAll(/export type \{([^}]*)\}/g)].flatMap((m) =>
    m[1]
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
  'LozMultiples',
]);
// LozChart.LozChart es el tipo de una instancia: `const grafico: LozChart.LozChart = new LozChart(…)`.
tipos.add('LozChart');
// Un tipo genérico (Localized<T>) necesita sus parámetros también en el alias.
const genericos = new Map(
  archivos(raiz).flatMap((archivo) =>
    [...readFileSync(archivo, 'utf8').matchAll(/export (?:interface|type) (\w+)<([^>]*)>/g)].map((m) => [
      m[1],
      m[2].split(',').map((p) => p.trim().split(/[\s=]/)[0]),
    ]),
  ),
);
const alias = [...tipos]
  .map((t) => {
    const p = genericos.get(t);
    return p ? `  export type ${t}<${p.join(', ')}> = api.${t}<${p.join(', ')}>;` : `  export type ${t} = api.${t};`;
  })
  .join('\n');

writeFileSync(
  join(raiz, 'index.d.cts'),
  `// Tipos para require('@lozcharts/core'): la clase LozChart, con todo lo que exporta el paquete.
import type * as api from './index.js' with { 'resolution-mode': 'import' };

declare const LozChart: typeof api.LozChart & Omit<typeof api, 'LozChart' | 'default'> & {
  LozChart: typeof api.LozChart;
  default: typeof api.LozChart;
};
declare namespace LozChart {
${alias}
}
export = LozChart;
`,
);

// require('@lozcharts/core/maps/world') devuelve { world }.
writeFileSync(
  join(raiz, 'maps/register-world.d.cts'),
  `import type { Topology } from '../core/geo.js' with { 'resolution-mode': 'import' };

export declare const world: Topology;
`,
);
