// Genera src/maps/world.ts desde world-atlas (countries-110m.json, Natural Earth 1:110m).
// Uso: node scripts/mapa-mundo.mjs ruta/countries-110m.json
// Agrega a cada país su código ISO alfa-3 y su nombre en español (scripts/paises.mjs) y quita
// el objeto 'land', que LozCharts no usa. La geometría queda igual: TopoJSON cuantizado.
import { readFileSync, writeFileSync } from 'node:fs';
import { PAISES } from './paises.mjs';

const source = process.argv[2];
if (!source) throw new Error('Falta la ruta de countries-110m.json');
const topo = JSON.parse(readFileSync(source, 'utf8'));
const geometries = topo.objects.countries.geometries.map((g) => {
  const key = g.id ?? g.properties.name;
  const meta = PAISES[key];
  if (!meta) throw new Error(`Sin datos para ${key} (${g.properties.name})`);
  const [iso3, nombre] = meta;
  return { ...g, properties: { name: g.properties.name, nombre, iso3, id: g.id ?? '' } };
});
const out = {
  type: 'Topology',
  transform: topo.transform,
  objects: { countries: { type: 'GeometryCollection', geometries } },
  arcs: topo.arcs,
};
const header = `/**
 * Contornos de los países del mundo (Natural Earth 1:110m, dominio público), empaquetados en
 * TopoJSON por world-atlas (© 2013-2019 Michael Bostock, licencia ISC: ver maps/LICENSE).
 * Cada país trae su nombre en inglés (name) y en español (nombre), su código ISO alfa-3 (iso3) y
 * el numérico (id). Generado por scripts/mapa-mundo.mjs: no editar a mano.
 */
import type { Topology } from '../core/geo';

export const world: Topology = `;
writeFileSync('src/maps/world.ts', header + JSON.stringify(out) + ';\n');
console.log(`${geometries.length} países`);
