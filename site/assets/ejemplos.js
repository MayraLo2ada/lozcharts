/* Ejemplos de la galería: cada uno con su nombre, familia y opciones. Datos de ejemplo, siempre iguales. */
(function () {
  // Pseudoaleatorio con semilla: los mismos datos en cada visita.
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var pad = function (n) {
    return String(n).padStart(2, '0');
  };
  var MESES = [];
  for (var m = 0; m < 12; m++) MESES.push('2026-' + pad(m + 1));
  var r = rng(11);

  var ventas = MESES.map(function (mes, i) {
    var k = [0.82, 0.78, 0.9, 0.94, 1, 0.97, 0.95, 1.02, 0.98, 1.06, 1.24, 1.42][i];
    return {
      mes: mes,
      online: Math.round((41000 + i * 1900 + r() * 6000) * k),
      tienda: Math.round((33000 + r() * 5000) * k),
      meta: Math.round((74000 + i * 2600) * (i > 9 ? 1.18 : 1)),
    };
  });

  var ciudades = ['Lima', 'Bogotá', 'Quito', 'Santiago', 'Ciudad de México'];
  var usuarios = MESES.map(function (mes, i) {
    var row = { mes: mes };
    ciudades.forEach(function (c, k) {
      row[c] = Math.round(([31, 24, 18, 27, 22][k] + i * (0.6 + k * 0.25) + 2 * Math.sin(i + k)) * 10) / 10;
    });
    return row;
  });

  var dias = [];
  for (var d = 0; d < 365; d++) {
    var f = new Date(2025, 10, 1 + d);
    var semana = [0.8, 1, 1.05, 1.06, 1.03, 0.96, 0.77][f.getDay()];
    var campana = d >= 240 && d < 262 ? 2600 * Math.sin(((d - 240) / 22) * Math.PI) : 0;
    dias.push({
      fecha: f.getFullYear() + '-' + pad(f.getMonth() + 1) + '-' + pad(f.getDate()),
      web: Math.round((4200 + d * 9) * semana + campana + (r() - 0.5) * 700),
      app: Math.round((2100 + d * 6) * semana + (r() - 0.5) * 400),
    });
  }

  var precios = [];
  var cierre = 182;
  for (var p = 0; p < 40; p++) {
    var fp = new Date(2026, 8, 1 + p);
    if (fp.getDay() === 0 || fp.getDay() === 6) continue;
    var apertura = cierre + (r() - 0.5) * 3;
    cierre = apertura + (r() - 0.48) * 6;
    precios.push({
      fecha: fp.getFullYear() + '-' + pad(fp.getMonth() + 1) + '-' + pad(fp.getDate()),
      apertura: +apertura.toFixed(2),
      maximo: +(Math.max(apertura, cierre) + r() * 2.5).toFixed(2),
      minimo: +(Math.min(apertura, cierre) - r() * 2.5).toFixed(2),
      cierre: +cierre.toFixed(2),
    });
  }

  var visitasHora = [];
  ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(function (dia, k) {
    for (var h = 0; h < 24; h++) {
      var curva = Math.max(0.05, Math.sin(((h - 6) / 18) * Math.PI)) * (h >= 6 ? 1 : 0.3);
      visitasHora.push({
        hora: pad(h) + ':00',
        dia: dia,
        visitas: Math.round((900 * curva * (k < 5 ? 1 : 0.6) + 40) * (0.9 + r() * 0.2)),
      });
    }
  });

  var regiones = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Costa'];
  var porRegion = MESES.map(function (mes, i) {
    var row = { mes: mes };
    regiones.forEach(function (rg, k) {
      row[rg] = Math.round(50 + k * 6 + i * (k - 2) * 1.6 + 8 * Math.sin(i * 0.8 + k));
    });
    return row;
  });

  var filas = function (list, keys) {
    return list.map(function (r) {
      var o = {};
      keys.forEach(function (k, i) {
        o[k] = r[i];
      });
      return o;
    });
  };

  window.EJEMPLOS = [
    {
      id: 'ventas',
      tipo: 'LozBar',
      familia: 'Comparar',
      opciones: {
        title: 'Ventas por mes',
        subtitle: 'Tienda física y canal online frente a la meta',
        data: ventas,
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'currency' },
        series: [
          { type: 'bar', field: 'online', name: 'Online', stack: true },
          { type: 'bar', field: 'tienda', name: 'Tienda', stack: true },
          { type: 'line', field: 'meta', name: 'Meta', smooth: true },
        ],
      },
    },
    {
      id: 'paginas',
      tipo: 'LozBar',
      familia: 'Comparar',
      opciones: {
        title: 'Páginas más visitadas',
        subtitle: 'Visitas únicas en octubre',
        orientation: 'horizontal',
        data: filas(
          [
            ['Inicio', 48210],
            ['Catálogo de productos', 31840],
            ['Ofertas de temporada', 27390],
            ['Preguntas frecuentes', 15620],
            ['Carrito', 12950],
            ['Blog', 9430],
          ],
          ['pagina', 'visitas'],
        ),
        xAxis: { field: 'pagina' },
        series: [{ type: 'bar', field: 'visitas', name: 'Visitas' }],
      },
    },
    {
      id: 'usuarios',
      tipo: 'LozLine',
      familia: 'En el tiempo',
      opciones: {
        title: 'Usuarios activos por ciudad',
        subtitle: 'Miles, con nombre al final de cada línea',
        data: usuarios,
        xAxis: { field: 'mes', type: 'time' },
        series: ciudades.map(function (c) {
          return { type: 'line', field: c, name: c };
        }),
        endLabels: { value: true },
      },
    },
    {
      id: 'visitas-dia',
      tipo: 'LozLine',
      familia: 'En el tiempo',
      opciones: {
        title: 'Visitas diarias',
        subtitle: 'Arrastra para acercar o usa la barra de abajo',
        data: dias,
        xAxis: { field: 'fecha', type: 'time' },
        series: [
          { type: 'line', field: 'web', name: 'Web' },
          { type: 'line', field: 'app', name: 'App' },
        ],
        zoom: { range: ['2026-05-15', '2026-08-31'] },
        endLabels: true,
        annotations: [
          { x: ['2026-06-29', '2026-07-21'], label: 'Campaña de verano' },
          { y: 8000, label: 'Meta diaria' },
        ],
      },
    },
    {
      id: 'dispositivos',
      tipo: 'LozArea',
      familia: 'En el tiempo',
      opciones: {
        title: 'Visitas por dispositivo',
        subtitle: 'Áreas apiladas',
        data: MESES.map(function (mes, i) {
          return { mes: mes, movil: 5200 + i * 310, escritorio: 4100 - i * 60, tableta: 900 + i * 20 };
        }),
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'compact' },
        series: [
          { type: 'area', field: 'movil', name: 'Móvil', stack: true, smooth: true },
          { type: 'area', field: 'escritorio', name: 'Escritorio', stack: true, smooth: true },
          { type: 'area', field: 'tableta', name: 'Tableta', stack: true, smooth: true },
        ],
      },
    },
    {
      id: 'tasa',
      tipo: 'LozStep',
      familia: 'En el tiempo',
      opciones: {
        title: 'Tasa de interés de referencia',
        subtitle: 'Cambia de golpe: línea escalonada',
        data: filas(
          [
            ['2025-01', 0.1125],
            ['2025-03', 0.105],
            ['2025-06', 0.0975],
            ['2025-09', 0.0925],
            ['2025-12', 0.09],
            ['2026-03', 0.0875],
            ['2026-07', 0.0825],
            ['2026-10', 0.08],
          ],
          ['mes', 'tasa'],
        ),
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'percent' },
        series: [{ type: 'step', field: 'tasa', name: 'Tasa' }],
      },
    },
    {
      id: 'precios',
      tipo: 'LozCandle',
      familia: 'En el tiempo',
      opciones: {
        title: 'Precio de la acción',
        subtitle: 'Apertura, máximo, mínimo y cierre por día',
        data: precios,
        xAxis: { field: 'fecha', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'candlestick', field: 'cierre', open: 'apertura', high: 'maximo', low: 'minimo', name: 'AURF' }],
      },
    },
    {
      id: 'categorias',
      tipo: 'LozDonut',
      familia: 'Partes de un todo',
      opciones: {
        title: 'Ventas por canal',
        data: filas(
          [
            ['Búsqueda', 41],
            ['Directo', 20],
            ['Redes', 18],
            ['Correo', 12],
            ['Referidos', 9],
          ],
          ['canal', 'ventas'],
        ),
        xAxis: { field: 'canal' },
        yAxis: { format: 'percent' },
        series: [{ type: 'donut', field: 'ventas', name: 'Ventas' }],
      },
    },
    {
      id: 'productos',
      tipo: 'LozTreemap',
      familia: 'Partes de un todo',
      opciones: {
        title: 'Ventas por producto',
        subtitle: 'Agrupadas por categoría',
        data: filas(
          [
            ['Laptops', 'Electrónica', 420000],
            ['Teléfonos', 'Electrónica', 380000],
            ['Tabletas', 'Electrónica', 142000],
            ['Audífonos', 'Electrónica', 96000],
            ['Sofás', 'Hogar', 210000],
            ['Colchones', 'Hogar', 168000],
            ['Cocina', 'Hogar', 88000],
            ['Zapatillas', 'Moda', 176000],
            ['Chaquetas', 'Moda', 122000],
            ['Bicicletas', 'Deportes', 134000],
            ['Camping', 'Deportes', 61000],
          ],
          ['producto', 'categoria', 'ventas'],
        ),
        xAxis: { field: 'producto' },
        yAxis: { format: 'currency' },
        series: [{ type: 'treemap', field: 'ventas', name: 'Ventas', group: 'categoria' }],
      },
    },
    {
      id: 'meta',
      tipo: 'LozGauge',
      familia: 'Partes de un todo',
      opciones: {
        title: 'Avance de la meta anual',
        data: [{ mes: 'Octubre', avance: 0.78 }],
        xAxis: { field: 'mes' },
        yAxis: { format: 'percent', min: 0, max: 1 },
        series: [{ type: 'gauge', field: 'avance', name: 'Avance', target: 0.85 }],
      },
    },
    {
      id: 'embudo',
      tipo: 'LozFunnel',
      familia: 'Partes de un todo',
      opciones: {
        title: 'Embudo de compra',
        data: filas(
          [
            ['Visitas', 48210],
            ['Vieron un producto', 21400],
            ['Agregaron al carrito', 6830],
            ['Iniciaron el pago', 3120],
            ['Compraron', 2540],
          ],
          ['paso', 'sesiones'],
        ),
        xAxis: { field: 'paso' },
        series: [{ type: 'funnel', field: 'sesiones', name: 'Sesiones' }],
      },
    },
    {
      id: 'tiendas',
      tipo: 'LozBubble',
      familia: 'Relaciones',
      opciones: {
        title: 'Tiendas: ventas y margen',
        subtitle: 'El tamaño es la cantidad de clientes',
        data: filas(
          [
            [0.6, 0.39, 1200, 'Sur'],
            [0.9, 0.35, 2400, 'Centro'],
            [1.2, 0.31, 3800, 'Centro'],
            [1.4, 0.26, 2100, 'Sur'],
            [1.7, 0.29, 4100, 'Norte'],
            [2.2, 0.34, 5200, 'Norte'],
            [2.8, 0.28, 7600, 'Centro'],
            [3.1, 0.31, 8100, 'Sur'],
            [3.6, 0.24, 9800, 'Norte'],
          ],
          ['ventas', 'margen', 'clientes', 'zona'],
        ).map(function (t) {
          var o = { ventas: t.ventas };
          o[t.zona] = t.margen;
          o['c' + t.zona] = t.clientes;
          return o;
        }),
        xAxis: { field: 'ventas', type: 'linear', title: 'Ventas (millones de dólares)' },
        yAxis: { format: 'percent', title: 'Margen bruto' },
        series: ['Norte', 'Centro', 'Sur'].map(function (z) {
          return { type: 'bubble', field: z, size: 'c' + z, sizeName: 'Clientes', name: 'Zona ' + z.toLowerCase() };
        }),
      },
    },
    {
      id: 'modelos',
      tipo: 'LozRadar',
      familia: 'Relaciones',
      opciones: {
        title: 'Dos modelos de teléfono',
        subtitle: 'Puntaje de 0 a 10 en seis criterios',
        data: filas(
          [
            ['Batería', 8, 6],
            ['Cámara', 7, 9],
            ['Pantalla', 8, 8],
            ['Precio', 9, 5],
            ['Velocidad', 6, 9],
            ['Diseño', 7, 8],
          ],
          ['criterio', 'a', 'b'],
        ),
        xAxis: { field: 'criterio' },
        yAxis: { min: 0, max: 10 },
        series: [
          { type: 'radar', field: 'a', name: 'Modelo A' },
          { type: 'radar', field: 'b', name: 'Modelo B' },
        ],
      },
    },
    {
      id: 'visitas-hora',
      tipo: 'LozHeatmap',
      familia: 'Relaciones',
      opciones: {
        title: 'Visitas por día y hora',
        data: visitasHora,
        xAxis: { field: 'hora' },
        series: [{ type: 'heatmap', field: 'visitas', name: 'Visitas', y: 'dia' }],
      },
    },
    {
      id: 'recorrido',
      tipo: 'LozSankey',
      familia: 'Flujos y mapas',
      opciones: {
        title: 'Recorrido de las visitas',
        subtitle: 'De dónde llegan y cómo terminan',
        data: filas(
          [
            ['Búsqueda', 'Inicio', 5200],
            ['Búsqueda', 'Producto', 7400],
            ['Redes', 'Inicio', 2600],
            ['Redes', 'Ofertas', 3100],
            ['Correo', 'Ofertas', 2200],
            ['Directo', 'Inicio', 4300],
            ['Inicio', 'Producto', 6900],
            ['Inicio', 'Abandono', 5200],
            ['Ofertas', 'Producto', 3800],
            ['Ofertas', 'Abandono', 1500],
            ['Producto', 'Compra', 6100],
            ['Producto', 'Abandono', 12000],
          ],
          ['origen', 'destino', 'sesiones'],
        ),
        xAxis: { field: 'origen' },
        series: [{ type: 'sankey', field: 'sesiones', name: 'Sesiones', to: 'destino' }],
      },
    },
    {
      id: 'paises',
      tipo: 'LozMap',
      familia: 'Flujos y mapas',
      opciones: {
        title: 'Usuarios activos por país',
        subtitle: 'Latinoamérica, datos de ejemplo',
        data: filas(
          [
            ['MEX', 1830],
            ['BRA', 2650],
            ['COL', 980],
            ['ARG', 760],
            ['CHL', 410],
            ['PER', 520],
            ['ECU', 230],
            ['VEN', 180],
            ['URY', 95],
            ['PRY', 80],
            ['BOL', 110],
            ['CRI', 70],
            ['PAN', 65],
            ['GTM', 120],
            ['DOM', 140],
            ['CUB', 40],
            ['HND', 55],
          ],
          ['pais', 'usuarios'],
        ).map(function (o) {
          return { pais: o.pais, usuarios: o.usuarios * 1000 };
        }),
        xAxis: { field: 'pais' },
        yAxis: { format: 'compact' },
        series: [{ type: 'choropleth', field: 'usuarios', name: 'Usuarios', fit: 'data' }],
      },
    },
    {
      id: 'tiendas-mapa',
      tipo: 'LozMap',
      familia: 'Flujos y mapas',
      opciones: {
        title: 'Ventas por ciudad',
        subtitle: 'Burbujas sobre el mapa',
        data: [
          { ciudad: 'Ciudad de México', lat: 19.43, lon: -99.13, ventas: 4200 },
          { ciudad: 'Bogotá', lat: 4.71, lon: -74.07, ventas: 2600 },
          { ciudad: 'Lima', lat: -12.05, lon: -77.04, ventas: 1900 },
          { ciudad: 'Santiago', lat: -33.45, lon: -70.67, ventas: 1500 },
          { ciudad: 'Buenos Aires', lat: -34.6, lon: -58.38, ventas: 3100 },
          { ciudad: 'São Paulo', lat: -23.55, lon: -46.63, ventas: 5200 },
          { ciudad: 'Madrid', lat: 40.42, lon: -3.7, ventas: 2800 },
          { ciudad: 'Miami', lat: 25.76, lon: -80.19, ventas: 3600 },
        ],
        xAxis: { field: 'ciudad' },
        series: [{ type: 'mapbubble', field: 'ventas', name: 'Ventas', lat: 'lat', lon: 'lon' }],
      },
    },
    {
      id: 'regiones',
      tipo: 'LozMultiples',
      familia: 'Comparar',
      multiples: true,
      opciones: {
        title: 'Ventas por región',
        subtitle: 'Cada región en su color y las demás como contexto',
        facet: 'series',
        context: true,
        data: porRegion,
        xAxis: { field: 'mes', type: 'time' },
        series: regiones.map(function (rg) {
          return { type: 'line', field: rg, name: rg };
        }),
        minWidth: 170,
        height: 140,
      },
    },
  ];

  /** Crea el ejemplo en un elemento, con el tema del sitio. */
  window.crearEjemplo = function (ej, el, extra) {
    // Sin fondo propio: el gráfico toma el de la página (o el de la tarjeta).
    var o = Object.assign({ background: false }, ej.opciones, extra || {});
    var c = ej.multiples ? LozChart.multiples(el, o) : new LozChart(el, o);
    return window.siteChart ? window.siteChart(c) : c;
  };

  /** Código que crea el ejemplo: las opciones reales, con los datos acortados a 3 filas. */
  window.codigoEjemplo = function (ej) {
    var o = Object.assign({}, ej.opciones);
    var n = o.data.length;
    o.data = o.data.slice(0, 3);
    var json = JSON.stringify(o, null, 2)
      .replace(/"([A-Za-z_][\w]*)":/g, '$1:')
      .replace(/"/g, "'");
    if (n > 3)
      json = json.replace(/(\n {2}data: \[[\s\S]*?\n {2}\])/, function (s) {
        return s.replace(/\n {2}\]$/, ',\n    // … ' + (n - 3) + ' filas más\n  ]');
      });
    var fn = ej.multiples ? 'LozChart.multiples' : 'new LozChart';
    return fn + "('#grafico', " + json + ');';
  };
})();
