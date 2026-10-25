/** Entrada del build UMD: window.LozChart es la clase, y `<loz-chart>` queda registrado. */
import * as api from './index';
import { LozChart } from './index';
import './element';

// Con require (Node, Jest) el módulo es la clase misma; además lleva todo lo que exporta el
// paquete, para que `const { LozChart } = require('lozcharts')` funcione y las extensiones
// cargadas con <script> encuentren las piezas del núcleo en window.LozChart.
Object.assign(LozChart, api);

export default LozChart;
