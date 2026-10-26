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
  var tx = window.tx;
  // Nombres de los meses en el idioma de la página (las tres primeras letras van en el eje).
  var NOMBRES = tx({
    es: [
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
    ],
    en: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    pt: [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ],
  });

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
  var BASICA = tx({ es: 'Canasta básica', en: 'Basics', pt: 'Cesta básica' });
  var BEBIDAS = tx({ es: 'Bebidas', en: 'Drinks', pt: 'Bebidas' });
  var MECATO = tx({ es: 'Mecato', en: 'Snacks', pt: 'Salgadinhos e doces' });
  var HOGAR = tx({ es: 'Hogar', en: 'Household', pt: 'Casa' });
  var SERVICIOS = tx({ es: 'Servicios', en: 'Services', pt: 'Serviços' });
  var canasta = [
    [tx({ es: 'Granos y abarrotes', en: 'Grains and pantry', pt: 'Grãos e mercearia' }), BASICA, 0.21],
    [tx({ es: 'Lácteos y huevos', en: 'Dairy and eggs', pt: 'Laticínios e ovos' }), BASICA, 0.16],
    [tx({ es: 'Pan y arepas', en: 'Bread and arepas', pt: 'Pão e arepas' }), BASICA, 0.13],
    [tx({ es: 'Carnes frías', en: 'Cold cuts', pt: 'Frios' }), BASICA, 0.06],
    [tx({ es: 'Gaseosas y jugos', en: 'Sodas and juices', pt: 'Refrigerantes e sucos' }), BEBIDAS, 0.09],
    [tx({ es: 'Cerveza', en: 'Beer', pt: 'Cerveja' }), BEBIDAS, 0.08],
    [MECATO, MECATO, 0.1],
    [tx({ es: 'Aseo', en: 'Cleaning supplies', pt: 'Limpeza' }), HOGAR, 0.07],
    [tx({ es: 'Velas y pilas', en: 'Candles and batteries', pt: 'Velas e pilhas' }), HOGAR, 0.02],
    [tx({ es: 'Recargas de celular', en: 'Phone top-ups', pt: 'Recargas de celular' }), SERVICIOS, 0.06],
    [tx({ es: 'Pago de facturas', en: 'Bill payments', pt: 'Pagamento de contas' }), SERVICIOS, 0.02],
  ].map(function (c) {
    return { producto: c[0], grupo: c[1], ventas: Math.round((anual * c[2]) / 1000) * 1000 };
  });

  // Clientes por hora, promedio del año.
  var DIAS = tx({
    es: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    pt: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
  });
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
    { ciudad: tx({ es: 'Madrid', en: 'Madrid', pt: 'Madri' }), lat: 40.42, lon: -3.7, pedidos: 74 },
    { ciudad: tx({ es: 'Nueva York', en: 'New York', pt: 'Nova York' }), lat: 40.71, lon: -74.0, pedidos: 52 },
    { ciudad: 'Miami', lat: 25.76, lon: -80.19, pedidos: 31 },
    {
      ciudad: tx({ es: 'Santiago de Chile', en: 'Santiago, Chile', pt: 'Santiago do Chile' }),
      lat: -33.45,
      lon: -70.67,
      pedidos: 23,
    },
    { ciudad: 'Valencia', lat: 39.47, lon: -0.38, pedidos: 18 },
    { ciudad: tx({ es: 'Londres', en: 'London', pt: 'Londres' }), lat: 51.51, lon: -0.13, pedidos: 11 },
    { ciudad: 'Toronto', lat: 43.65, lon: -79.38, pedidos: 8 },
    { ciudad: 'Bogotá', lat: 4.71, lon: -74.07, pedidos: 27 },
  ];

  // De lo vendido a lo que queda.
  var costo = -Math.round((anual * 0.79) / 100000) * 100000;
  var cierre = [
    { paso: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }), monto: anual },
    { paso: tx({ es: 'Mercancía', en: 'Merchandise', pt: 'Mercadoria' }), monto: costo },
    { paso: tx({ es: 'Margen', en: 'Margin', pt: 'Margem' }), total: true },
    { paso: tx({ es: 'Arriendo', en: 'Rent', pt: 'Aluguel' }), monto: -14400000 },
    { paso: tx({ es: 'Servicios', en: 'Utilities', pt: 'Contas de consumo' }), monto: -7800000 },
    { paso: tx({ es: 'Sueldo', en: 'Wages', pt: 'Salário' }), monto: -20400000 },
    { paso: tx({ es: 'Fiado perdido', en: 'Unpaid tabs', pt: 'Fiado perdido' }), monto: -4200000 },
    { paso: tx({ es: 'Lo que queda', en: 'What’s left', pt: 'O que sobra' }), total: true },
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
