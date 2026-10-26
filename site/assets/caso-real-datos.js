/* Datos del caso de doña Carmen (caso-real.html): la tienda en 2025. Inventados pero verosímiles,
   con semilla fija: siempre los mismos números, y los mismos que cita el texto. */
(function () {
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var r = rng(2025);
  var pad = function (n) {
    return String(n).padStart(2, '0');
  };
  var NOMBRES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  // Ventas diarias en pesos colombianos.
  var semana = [0.62, 0.9, 0.84, 0.95, 1.0, 1.16, 1.4]; // domingo a sábado
  var temporada = [0.86, 0.9, 0.95, 0.97, 1.02, 1.06, 1.08, 1.0, 0.97, 1.0, 1.05, 1.26];
  var diario = [];
  for (var d = 0; d < 365; d++) {
    var f = new Date(2025, 0, 1 + d);
    var mes = f.getMonth(),
      dia = f.getDate();
    var v = 1380000 * semana[f.getDay()] * temporada[mes] * (0.86 + r() * 0.28);
    if (mes === 0 && dia === 1) v *= 0.35;
    if (mes === 4 && dia === 10) v *= 1.9; // víspera del día de la madre
    if (mes === 11 && dia >= 16 && dia <= 22) v *= 1.25; // novenas
    if (mes === 11 && dia === 23) v *= 2.5;
    if (mes === 11 && dia === 24) v *= 2.9;
    if (mes === 11 && dia === 25) v *= 0.2;
    if (mes === 11 && dia === 31) v *= 2.1;
    diario.push({ fecha: f.getFullYear() + '-' + pad(mes + 1) + '-' + pad(dia), ventas: Math.round(v / 100) * 100 });
  }

  var mensual = NOMBRES.map(function (n, i) {
    var total = 0;
    diario.forEach(function (x) {
      if (+x.fecha.slice(5, 7) === i + 1) total += x.ventas;
    });
    return { mes: n.charAt(0).toUpperCase() + n.slice(1, 3), nombre: n, ventas: total };
  });
  var anual = mensual.reduce(function (s, m) {
    return s + m.ventas;
  }, 0);

  // Qué se vende (parte del año).
  var canasta = [
    ['Granos y abarrotes', 'Canasta básica', 0.21],
    ['Lácteos y huevos', 'Canasta básica', 0.16],
    ['Pan y arepas', 'Canasta básica', 0.13],
    ['Carnes frías', 'Canasta básica', 0.06],
    ['Gaseosas y jugos', 'Bebidas', 0.09],
    ['Cerveza', 'Bebidas', 0.08],
    ['Mecato', 'Mecato', 0.1],
    ['Aseo', 'Hogar', 0.07],
    ['Velas y pilas', 'Hogar', 0.02],
    ['Recargas de celular', 'Servicios', 0.06],
    ['Pago de facturas', 'Servicios', 0.02],
  ].map(function (c) {
    return { producto: c[0], grupo: c[1], ventas: Math.round((anual * c[2]) / 1000) * 1000 };
  });

  // Clientes por hora, promedio del año.
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var horas = [];
  var r2 = rng(7);
  DIAS.forEach(function (dia, k) {
    for (var h = 6; h <= 21; h++) {
      var manana = Math.exp(-Math.pow((h - 7.2) / 1.4, 2));
      var medio = 0.55 * Math.exp(-Math.pow((h - 12.5) / 1.3, 2));
      var tarde = 0.85 * Math.exp(-Math.pow((h - 18.3) / 1.6, 2));
      var base = 4 + 30 * (manana + medio + tarde);
      var factor = [0.92, 0.85, 0.92, 0.95, 1.1, 1.3, 0.7][k];
      if (k === 5 && h === 7) base *= 1.45; // la fila de los sábados
      if (k === 6 && h < 8) base *= 0.5;
      if (k === 1 && h >= 14 && h <= 16) base *= 0.55; // la novela de los martes
      horas.push({ hora: pad(h) + ':00', dia: dia, clientes: Math.round(base * factor * (0.92 + r2() * 0.16)) });
    }
  });

  // Mercados a domicilio pagados desde lejos (pedidos en el año).
  var lejos = [
    { ciudad: 'Madrid', lat: 40.42, lon: -3.7, pedidos: 74 },
    { ciudad: 'Nueva York', lat: 40.71, lon: -74.0, pedidos: 52 },
    { ciudad: 'Miami', lat: 25.76, lon: -80.19, pedidos: 31 },
    { ciudad: 'Santiago de Chile', lat: -33.45, lon: -70.67, pedidos: 23 },
    { ciudad: 'Valencia', lat: 39.47, lon: -0.38, pedidos: 18 },
    { ciudad: 'Londres', lat: 51.51, lon: -0.13, pedidos: 11 },
    { ciudad: 'Toronto', lat: 43.65, lon: -79.38, pedidos: 8 },
    { ciudad: 'Bogotá', lat: 4.71, lon: -74.07, pedidos: 27 },
  ];

  // De lo vendido a lo que queda.
  var costo = -Math.round((anual * 0.79) / 100000) * 100000;
  var cierre = [
    { paso: 'Ventas', monto: anual },
    { paso: 'Mercancía', monto: costo },
    { paso: 'Margen', total: true },
    { paso: 'Arriendo', monto: -14400000 },
    { paso: 'Servicios', monto: -7800000 },
    { paso: 'Sueldo', monto: -20400000 },
    { paso: 'Fiado perdido', monto: -4200000 },
    { paso: 'Lo que queda', total: true },
  ];
  var queda = cierre.reduce(function (s, c) {
    return s + (c.monto || 0);
  }, 0);

  var mejor = diario.reduce(function (a, b) {
    return b.ventas > a.ventas ? b : a;
  });

  window.HISTORIA = {
    diario: diario,
    mensual: mensual,
    anual: anual,
    canasta: canasta,
    horas: horas,
    lejos: lejos,
    cierre: cierre,
    queda: queda,
    mejor: mejor,
  };
})();
