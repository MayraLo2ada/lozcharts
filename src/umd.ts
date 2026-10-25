/** Entrada del build UMD: window.LozChart es la clase, y `<loz-chart>` queda registrado. */
import { LozChart, LozMultiples } from './index';
import './element';

// Con require (Node, Jest) el módulo es la clase misma; además lleva sus nombres, para que
// `const { LozChart } = require('lozcharts')` también funcione.
Object.assign(LozChart, { LozChart, LozMultiples, default: LozChart });

export default LozChart;
