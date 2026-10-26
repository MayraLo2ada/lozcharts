/**
 * Mapa del mundo: `import 'lozcharts/maps/world'` (o `<script src="lozcharts-world.umd.js">`
 * después de LozCharts) lo registra como 'mundo' y también como 'world'. Va aparte porque pesa
 * unos 110 KB: solo lo carga quien hace mapas.
 */
import { LozChart } from 'lozcharts';
import { world } from './world';
import { withPortuguese } from './nomes';

// Cada país trae su nombre en inglés (name) y en español (nombre); aquí recibe el portugués (nome).
withPortuguese(world);
LozChart.registerMap('mundo', world);
LozChart.registerMap('world', world);

export { world };
