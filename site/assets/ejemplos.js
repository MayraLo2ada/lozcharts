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

  // Ventas por canal: la tienda en línea alcanza a la física a mitad de año y la temporada de
  // fin de año empuja a las dos.
  var ventas = [
    [28400, 39800, 70000],
    [27100, 36900, 70000],
    [33500, 40200, 72000],
    [36200, 39400, 74000],
    [39800, 40100, 76000],
    [43900, 38600, 78000],
    [45200, 37200, 80000],
    [48700, 38100, 82000],
    [47900, 36400, 84000],
    [53600, 37900, 88000],
    [68400, 44700, 104000],
    [79200, 51800, 118000],
  ].map(function (v, i) {
    return { mes: MESES[i], online: v[0], tienda: v[1], meta: v[2] };
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

  // Cada ejemplo: `tipo` es el nombre en la librería (va en el código), `clase` el nombre que
  // lee una persona, `tamano` cuánto ocupa en la galería ('grande': dos columnas; 'ancho': la
  // fila entera) y `desc` por qué esta forma sirve para estos datos (la página del ejemplo).
  // El orden importa: arma filas completas en la galería de tres columnas.
  window.EJEMPLOS = [
    {
      id: 'ventas',
      tipo: 'LozBar',
      clase: 'Barras apiladas con meta',
      familia: 'Comparar',
      tamano: 'grande',
      desc: 'Apilar los dos canales deja ver el total del mes y, a la vez, cuánto pone cada uno. La meta va como línea para que nadie la confunda con una barra más.',
      opciones: {
        title: 'La tienda en línea pasó a la física en junio',
        subtitle: 'Ventas por mes en 2026, en dólares. La línea es la meta mensual.',
        data: ventas,
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'currency' },
        series: [
          { type: 'bar', field: 'online', name: 'En línea', stack: true },
          { type: 'bar', field: 'tienda', name: 'Tienda física', stack: true },
          { type: 'line', field: 'meta', name: 'Meta', smooth: true },
        ],
      },
    },
    {
      id: 'paginas',
      tipo: 'LozBar',
      clase: 'Barras horizontales',
      familia: 'Comparar',
      desc: 'Con nombres largos, las barras acostadas se leen sin torcer la cabeza. Ordenadas de mayor a menor, la comparación sale de un vistazo.',
      opciones: {
        title: 'Las preguntas frecuentes ya reciben más visitas que el carrito',
        subtitle: 'Visitas únicas por página, octubre de 2026',
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
      id: 'resultado',
      tipo: 'LozWaterfall',
      clase: 'Cascada',
      familia: 'Comparar',
      desc: 'Una cascada explica cómo se pasa de un número a otro. Cada barra empieza donde terminó la anterior, y los subtotales vuelven a partir de cero.',
      opciones: {
        title: 'De cada dólar vendido quedan 20 centavos',
        subtitle: 'Estado de resultados de 2026, en dólares',
        data: [
          { paso: 'Ventas', monto: 1250000 },
          { paso: 'Costo de ventas', monto: -520000 },
          { paso: 'Utilidad bruta', total: true },
          { paso: 'Gastos de operación', monto: -310000 },
          { paso: 'Marketing', monto: -95000 },
          { paso: 'Otros ingresos', monto: 40000 },
          { paso: 'Impuestos', monto: -110000 },
          { paso: 'Utilidad neta', total: true },
        ],
        xAxis: { field: 'paso' },
        yAxis: { format: 'currency' },
        series: [{ type: 'waterfall', field: 'monto', name: 'Resultado', total: 'total' }],
      },
    },
    {
      id: 'metas',
      tipo: 'LozBullet',
      clase: 'Bala',
      familia: 'Comparar',
      desc: 'Una fila por región, todas en la misma escala. La barra delgada es lo vendido y la raya, la meta. Los grises del fondo marcan hasta dónde es bajo, aceptable o bueno.',
      opciones: {
        title: 'El Sur quedó lejos de su meta',
        subtitle: 'Ventas del tercer trimestre, en miles de dólares. La raya es la meta de cada región.',
        data: filas(
          [
            ['Norte', 512, 480],
            ['Centro', 433, 460],
            ['Sur', 297, 420],
            ['Occidente', 571, 520],
            ['Oriente', 365, 400],
          ],
          ['region', 'ventas', 'meta'],
        ),
        xAxis: { field: 'region' },
        series: [{ type: 'bullet', field: 'ventas', name: 'Ventas', targetField: 'meta', ranges: [300, 450, 600] }],
      },
    },
    {
      id: 'opiniones',
      tipo: 'LozWordcloud',
      clase: 'Nube de palabras',
      familia: 'Comparar',
      desc: 'Da una idea rápida de qué se habla, no una medida: el tamaño de una palabra se compara peor que el largo de una barra. Para la cifra exacta, pasa el puntero por la palabra.',
      opciones: {
        title: 'Lo que más agradecen es la atención',
        subtitle: 'Palabras más repetidas en 2.140 opiniones de clientes, por tema',
        data: filas(
          [
            ['atención', 412, 'Servicio'],
            ['rapidez', 356, 'Entrega'],
            ['precio', 331, 'Precio'],
            ['calidad', 298, 'Producto'],
            ['envío', 276, 'Entrega'],
            ['amabilidad', 214, 'Servicio'],
            ['variedad', 198, 'Producto'],
            ['puntualidad', 176, 'Entrega'],
            ['ofertas', 164, 'Precio'],
            ['devoluciones', 151, 'Servicio'],
            ['empaque', 139, 'Entrega'],
            ['descuentos', 127, 'Precio'],
            ['garantía', 118, 'Producto'],
            ['asesoría', 109, 'Servicio'],
            ['frescura', 96, 'Producto'],
            ['pago en línea', 92, 'Precio'],
            ['seguimiento', 88, 'Entrega'],
            ['tienda física', 81, 'Servicio'],
            ['diseño', 74, 'Producto'],
            ['cupones', 69, 'Precio'],
            ['paciencia', 63, 'Servicio'],
            ['horario', 58, 'Servicio'],
            ['stock', 54, 'Producto'],
            ['tallas', 49, 'Producto'],
            ['cambio', 45, 'Servicio'],
            ['envío gratis', 43, 'Entrega'],
            ['reembolso', 38, 'Precio'],
            ['recomendación', 35, 'Servicio'],
            ['catálogo', 31, 'Producto'],
            ['cuotas', 28, 'Precio'],
          ],
          ['palabra', 'menciones', 'tema'],
        ),
        xAxis: { field: 'palabra' },
        series: [{ type: 'wordcloud', field: 'menciones', name: 'Menciones', group: 'tema' }],
      },
    },
    {
      id: 'regiones',
      tipo: 'LozMultiples',
      clase: 'Paneles pequeños',
      familia: 'Comparar',
      tamano: 'ancho',
      multiples: true,
      desc: 'Un panel por región, todos con la misma escala. Detrás de cada uno, en gris, van las demás: así se compara la forma sin andar buscando colores.',
      opciones: {
        title: 'El Norte perdió más de la mitad de sus ventas en el año',
        subtitle: 'Ventas por mes en 2026, en miles de dólares. En gris, las otras regiones.',
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
    {
      id: 'visitas-dia',
      tipo: 'LozLine',
      clase: 'Líneas con zoom',
      familia: 'En el tiempo',
      tamano: 'ancho',
      desc: 'Un año día por día es demasiado para verlo de una vez. Acércate a unas semanas, mueve la ventana con la barra de abajo y, con doble clic, vuelve a verlo entero.',
      opciones: {
        title: 'Con la campaña de verano, la web pasó por primera vez la meta',
        subtitle: 'Visitas diarias, noviembre de 2025 a octubre de 2026. Arrastra sobre el gráfico para acercarte.',
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
      id: 'usuarios',
      tipo: 'LozLine',
      clase: 'Líneas con nombre al final',
      familia: 'En el tiempo',
      desc: 'Con cinco líneas, ir y volver a la leyenda cansa. Aquí cada ciudad lleva su nombre y su último valor donde termina la línea.',
      opciones: {
        title: 'Ciudad de México duplicó sus usuarios en un año',
        subtitle: 'Usuarios activos al mes, en miles',
        data: usuarios,
        xAxis: { field: 'mes', type: 'time' },
        series: ciudades.map(function (c) {
          return { type: 'line', field: c, name: c };
        }),
        endLabels: { value: true },
      },
    },
    {
      id: 'dispositivos',
      tipo: 'LozArea',
      clase: 'Áreas apiladas',
      familia: 'En el tiempo',
      desc: 'Las áreas apiladas muestran el total y la mezcla al mismo tiempo. Con tres series se leen bien; pasadas las cuatro, las de arriba bailan sobre las de abajo y cuesta seguirlas.',
      opciones: {
        title: 'Casi todo el crecimiento vino del móvil',
        subtitle: 'Visitas al mes por dispositivo, 2026',
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
      clase: 'Escalones',
      familia: 'En el tiempo',
      desc: 'Entre una decisión y la siguiente la tasa no se mueve, así que una línea inclinada mentiría. Los escalones marcan el salto el día en que ocurre.',
      opciones: {
        title: 'Siete recortes seguidos',
        subtitle: 'Tasa de interés de referencia, de enero de 2025 a octubre de 2026',
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
      id: 'lanzamiento',
      tipo: 'LozTimeline',
      clase: 'Línea de tiempo',
      familia: 'En el tiempo',
      tamano: 'grande',
      desc: 'Un carril por equipo y una barra por tarea, de su inicio a su fin. Lo que no tiene fecha de fin es un hito y va en rombo; la línea punteada es hoy.',
      opciones: {
        title: 'Ocho meses de la primera entrevista al lanzamiento',
        subtitle: 'Plan de la app de pagos por equipo, 2026. Los rombos son hitos.',
        data: [
          { tarea: 'Investigación', inicio: '2026-01-12', fin: '2026-02-27', equipo: 'Producto' },
          { tarea: 'Definición del alcance', inicio: '2026-02-16', fin: '2026-03-13', equipo: 'Producto' },
          { tarea: 'Pruebas con usuarios', inicio: '2026-07-06', fin: '2026-08-07', equipo: 'Producto' },
          { tarea: 'Beta cerrada', inicio: '2026-08-24', equipo: 'Producto' },
          { tarea: 'Prototipos', inicio: '2026-03-02', fin: '2026-04-10', equipo: 'Diseño' },
          { tarea: 'Sistema visual', inicio: '2026-04-06', fin: '2026-05-22', equipo: 'Diseño' },
          { tarea: 'API de pagos', inicio: '2026-04-13', fin: '2026-06-26', equipo: 'Ingeniería' },
          { tarea: 'App móvil', inicio: '2026-05-04', fin: '2026-08-28', equipo: 'Ingeniería' },
          { tarea: 'Integración con bancos', inicio: '2026-07-01', fin: '2026-08-21', equipo: 'Ingeniería' },
          { tarea: 'Soporte', inicio: '2026-09-14', fin: '2026-12-18', equipo: 'Ingeniería' },
          { tarea: 'Campaña', inicio: '2026-09-01', fin: '2026-10-09', equipo: 'Marketing' },
          { tarea: 'Lanzamiento', inicio: '2026-09-15', equipo: 'Marketing' },
        ],
        xAxis: { field: 'inicio', type: 'time' },
        series: [{ type: 'timeline', field: 'tarea', end: 'fin', group: 'equipo', name: 'Plan', today: '2026-10-25' }],
      },
    },
    {
      id: 'precios',
      tipo: 'LozCandle',
      clase: 'Velas',
      familia: 'En el tiempo',
      desc: 'Cada vela es un día. El cuerpo va de la apertura al cierre, hueco si el precio subió y relleno si bajó, y la mecha llega al máximo y al mínimo.',
      opciones: {
        title: 'AURF perdió casi un 9 % en tres semanas',
        subtitle: 'Precio diario de la acción en dólares, septiembre y octubre de 2026',
        data: precios,
        xAxis: { field: 'fecha', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'candlestick', field: 'cierre', open: 'apertura', high: 'maximo', low: 'minimo', name: 'AURF' }],
      },
    },
    {
      id: 'categorias',
      tipo: 'LozDonut',
      clase: 'Dona',
      familia: 'Partes de un todo',
      desc: 'Una dona va bien con pocas partes que suman un todo. Si hay más de cinco, o dos parecidas que importa distinguir, unas barras se leen mejor.',
      opciones: {
        title: 'Los buscadores traen más pedidos que las redes y el correo juntos',
        subtitle: 'Pedidos en línea según el canal de llegada, octubre de 2026',
        data: filas(
          [
            ['Búsqueda', 4120],
            ['Directo', 2010],
            ['Redes', 1790],
            ['Correo', 1220],
            ['Referidos', 880],
          ],
          ['canal', 'pedidos'],
        ),
        xAxis: { field: 'canal' },
        series: [{ type: 'donut', field: 'pedidos', name: 'Pedidos' }],
      },
    },
    {
      id: 'productos',
      tipo: 'LozTreemap',
      clase: 'Treemap',
      familia: 'Partes de un todo',
      tamano: 'grande',
      desc: 'Cada rectángulo ocupa tanto como vende su producto, y los de una misma categoría quedan juntos. Rinde cuando hay muchas partes y además una jerarquía.',
      opciones: {
        title: 'Electrónica vende más que todo lo demás junto',
        subtitle: 'Ventas de 2026 por producto y categoría, en dólares',
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
      id: 'mercados',
      tipo: 'LozSunburst',
      clase: 'Anillos (sunburst)',
      familia: 'Partes de un todo',
      desc: 'Del centro hacia afuera: región, país y ciudad. Pasa el puntero por una ciudad y se ilumina su camino hasta el centro.',
      opciones: {
        title: 'Casi un tercio de las ventas sale de México',
        subtitle: 'Ventas de 2026 por región, país y ciudad, en dólares',
        data: filas(
          [
            ['América', 'México', 'Ciudad de México', 412000],
            ['América', 'México', 'Monterrey', 182000],
            ['América', 'México', 'Guadalajara', 154000],
            ['América', 'Colombia', 'Bogotá', 236000],
            ['América', 'Colombia', 'Medellín', 118000],
            ['América', 'Argentina', 'Buenos Aires', 205000],
            ['América', 'Chile', 'Santiago', 141000],
            ['América', 'Perú', 'Lima', 126000],
            ['Europa', 'España', 'Madrid', 248000],
            ['Europa', 'España', 'Barcelona', 197000],
            ['Europa', 'Portugal', 'Lisboa', 92000],
            ['Europa', 'Francia', 'París', 134000],
            ['Asia', 'Japón', 'Tokio', 158000],
            ['Asia', 'Corea del Sur', 'Seúl', 87000],
          ],
          ['region', 'pais', 'ciudad', 'ventas'],
        ),
        xAxis: { field: 'ciudad' },
        yAxis: { format: 'currency' },
        series: [{ type: 'sunburst', field: 'ventas', name: 'Ventas', levels: ['region', 'pais', 'ciudad'] }],
      },
    },
    {
      id: 'meta',
      tipo: 'LozGauge',
      clase: 'Indicador',
      familia: 'Partes de un todo',
      desc: 'Un número contra su meta, para la pantalla de inicio de un panel. Si son varios indicadores, un gráfico de bala ocupa menos y los compara mejor.',
      opciones: {
        title: 'Siete puntos por debajo de lo previsto',
        subtitle: 'Avance de la meta de ventas del año a octubre. La marca es donde deberíamos ir.',
        data: [{ mes: 'Octubre', avance: 0.78 }],
        xAxis: { field: 'mes' },
        yAxis: { format: 'percent', min: 0, max: 1 },
        series: [{ type: 'gauge', field: 'avance', name: 'Avance', target: 0.85 }],
      },
    },
    {
      id: 'embudo',
      tipo: 'LozFunnel',
      clase: 'Embudo',
      familia: 'Partes de un todo',
      desc: 'Los pasos van uno debajo del otro, con lo que se pierde entre cada uno. Las barras son rectas y no trapecios porque los largos se comparan mejor que las formas.',
      opciones: {
        title: 'Solo el 5 % de las visitas termina en una compra',
        subtitle: 'Sesiones de octubre de 2026 en cada paso de la compra',
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
      clase: 'Burbujas',
      familia: 'Relaciones',
      tamano: 'grande',
      desc: 'Tres medidas en un punto: ventas a lo ancho, margen a lo alto y clientes en el tamaño. Lo que crece con el valor es el área de la burbuja, no su radio.',
      opciones: {
        title: 'Las tiendas grandes venden más, pero con menos margen',
        subtitle: 'Nueve tiendas en 2026. El tamaño de cada burbuja es su cantidad de clientes.',
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
      clase: 'Radar',
      familia: 'Relaciones',
      desc: 'Compara dos o tres perfiles con los mismos criterios. Con más series se vuelve una maraña, y ahí conviene un panel pequeño por cada una.',
      opciones: {
        title: 'El modelo B gana en cámara y velocidad, pero cuesta más',
        subtitle: 'Puntaje de 0 a 10 en seis pruebas; en precio, 10 es el más barato',
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
      clase: 'Mapa de calor',
      familia: 'Relaciones',
      tamano: 'grande',
      desc: 'Siete días por veinticuatro horas son 168 números. Pintados en una rejilla, el patrón aparece antes de leer cualquier cifra.',
      opciones: {
        title: 'Las visitas tocan techo a media tarde',
        subtitle: 'Visitas por hora en una semana típica de octubre',
        data: visitasHora,
        xAxis: { field: 'hora' },
        series: [{ type: 'heatmap', field: 'visitas', name: 'Visitas', y: 'dia' }],
      },
    },
    {
      id: 'equipo',
      tipo: 'LozNetwork',
      clase: 'Red',
      familia: 'Relaciones',
      desc: 'Cada línea une a dos personas que se escriben, más gruesa cuantos más mensajes. Quien conecta dos áreas queda entre ellas.',
      opciones: {
        title: 'Cada área habla sobre todo consigo misma',
        subtitle: 'Mensajes por semana entre doce personas de cuatro áreas',
        data: filas(
          [
            ['Luis', 'Ana', 18, 'Diseño'],
            ['Ana', 'Marta', 11, 'Diseño'],
            ['Marta', 'Luis', 7, 'Diseño'],
            ['Ana', 'Pedro', 6, 'Diseño'],
            ['Pedro', 'Sofía', 21, 'Datos'],
            ['Pedro', 'Jorge', 13, 'Datos'],
            ['Jorge', 'Sofía', 9, 'Datos'],
            ['Sofía', 'Elena', 4, 'Datos'],
            ['Carla', 'Elena', 16, 'Ventas'],
            ['Elena', 'Raúl', 12, 'Ventas'],
            ['Raúl', 'Carla', 8, 'Ventas'],
            ['Carla', 'Marta', 3, 'Ventas'],
            ['Tomás', 'Inés', 14, 'Soporte'],
            ['Inés', 'Raúl', 5, 'Soporte'],
            ['Tomás', 'Jorge', 4, 'Soporte'],
            ['Inés', 'Bruno', 10, 'Soporte'],
            ['Bruno', 'Tomás', 6, 'Soporte'],
          ],
          ['persona', 'con', 'mensajes', 'area'],
        ),
        xAxis: { field: 'persona' },
        series: [{ type: 'network', field: 'mensajes', name: 'Mensajes', to: 'con', group: 'area' }],
      },
    },
    {
      id: 'recorrido',
      tipo: 'LozSankey',
      clase: 'Sankey',
      familia: 'Flujos y mapas',
      tamano: 'grande',
      desc: 'Se lee de izquierda a derecha: de dónde llegan las visitas, por qué páginas pasan y cómo terminan. El grosor de cada flujo es la cantidad de sesiones.',
      opciones: {
        title: 'La mayoría ve un producto y se va sin comprar',
        subtitle: 'Sesiones de octubre de 2026, del canal de llegada al final de la visita',
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
      id: 'mudanzas',
      tipo: 'LozChord',
      clase: 'Cuerdas',
      familia: 'Flujos y mapas',
      desc: 'Las cuerdas muestran idas y vueltas entre los mismos lugares. Cada cinta tiene el color de la región de donde se fue la gente.',
      opciones: {
        title: 'De la capital se va más gente de la que llega',
        subtitle: 'Mudanzas entre regiones en 2025, en miles de personas',
        data: filas(
          [
            ['Capital', 'Centro', 182],
            ['Centro', 'Capital', 96],
            ['Capital', 'Costa', 74],
            ['Costa', 'Capital', 58],
            ['Norte', 'Capital', 71],
            ['Capital', 'Norte', 39],
            ['Sur', 'Centro', 64],
            ['Centro', 'Sur', 41],
            ['Costa', 'Sur', 33],
            ['Norte', 'Costa', 27],
            ['Sur', 'Capital', 52],
            ['Centro', 'Norte', 22],
          ],
          ['origen', 'destino', 'personas'],
        ),
        xAxis: { field: 'origen' },
        series: [{ type: 'chord', field: 'personas', name: 'Personas', to: 'destino' }],
      },
    },
    {
      id: 'tiendas-mapa',
      tipo: 'LozMap',
      clase: 'Mapa de burbujas',
      familia: 'Flujos y mapas',
      tamano: 'grande',
      desc: 'Una burbuja por ciudad, en su lugar del mapa. El tamaño da el orden de magnitud; el valor exacto aparece al pasar el puntero.',
      opciones: {
        title: 'São Paulo ya vende más que Ciudad de México',
        subtitle: 'Ventas de octubre de 2026 por ciudad, en miles de dólares',
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
      id: 'paises',
      tipo: 'LozMap',
      clase: 'Mapa coloreado',
      familia: 'Flujos y mapas',
      desc: 'Cada país con datos se pinta según su valor y los demás quedan en gris. La proyección por defecto respeta las áreas, así ningún país parece más grande de lo que es.',
      opciones: {
        title: 'Brasil y México suman más de la mitad de los usuarios',
        subtitle: 'Usuarios activos en América Latina, octubre de 2026',
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
      id: 'globo',
      tipo: 'LozMap',
      clase: 'Mapa en globo',
      familia: 'Flujos y mapas',
      tamano: 'ancho',
      desc: 'En un globo las distancias se ven como son: Madrid queda al otro lado del océano y no estirado en una esquina, como en un mapa plano. Para comparar países conviene el mapa de áreas iguales; el globo sirve cuando importa dónde queda cada cosa y qué tan lejos.',
      // La galería y la página del ejemplo lo hacen girar con girarGlobo(): entra girando, frena
      // sobre `destino` ([longitud, latitud]) y dibuja encima los arcos de `rutas`.
      globo: {
        destino: [-66, -6],
        origen: { nombre: 'Ciudad de México', lon: -99.13, lat: 19.43 },
        rutas: [
          { nombre: 'Bogotá', lon: -74.07, lat: 4.71, envios: 1390 },
          { nombre: 'São Paulo', lon: -46.63, lat: -23.55, envios: 980 },
          { nombre: 'Lima', lon: -77.04, lat: -12.05, envios: 610, izq: true },
          { nombre: 'Buenos Aires', lon: -58.38, lat: -34.6, envios: 540 },
          { nombre: 'Madrid', lon: -3.7, lat: 40.42, envios: 460 },
          { nombre: 'Santiago', lon: -70.67, lat: -33.45, envios: 420, izq: true },
        ],
      },
      opciones: {
        title: 'Madrid es el único envío que cruza el océano, y ya pide más que Santiago',
        subtitle: 'Envíos de octubre de 2026 desde Ciudad de México (arcos) y clientes por país (color)',
        data: filas(
          [
            ['BRA', 2650],
            ['MEX', 1830],
            ['USA', 1150],
            ['COL', 980],
            ['ARG', 760],
            ['ESP', 690],
            ['PER', 520],
            ['CHL', 410],
            ['CAN', 260],
            ['ECU', 230],
            ['VEN', 180],
            ['DOM', 140],
            ['PRT', 140],
            ['GTM', 120],
            ['BOL', 110],
            ['URY', 95],
            ['PRY', 80],
            ['CRI', 70],
            ['PAN', 65],
            ['HND', 55],
            ['SLV', 50],
            ['CUB', 40],
            ['NIC', 35],
          ],
          ['pais', 'clientes'],
        ),
        xAxis: { field: 'pais' },
        yAxis: { format: 'compact' },
        series: [{ type: 'choropleth', field: 'clientes', name: 'Clientes', projection: 'orthographic', rotate: [-66, -6] }],
      },
    },
  ];

  /** Los mapas necesitan el mapa del mundo (siteMapa) antes de dibujarse. */
  window.esMapa = function (ej) {
    return ej.opciones.series.some(function (s) {
      return s.type === 'choropleth' || s.type === 'mapbubble';
    });
  };

  /** La lista de envíos del globo: lo que dicen los arcos, en texto (también para el lector de pantalla). */
  window.rutasGlobo = function (ej) {
    var g = ej.globo;
    var nf = new Intl.NumberFormat('es-CO');
    var caja = document.createElement('div');
    caja.className = 'globo-rutas';
    var t = document.createElement('p');
    t.className = 'globo-rutas-titulo';
    t.textContent = 'Envíos desde ' + g.origen.nombre;
    var ol = document.createElement('ol');
    g.rutas
      .slice()
      .sort(function (a, b) {
        return b.envios - a.envios;
      })
      .forEach(function (r) {
        var li = document.createElement('li');
        var n = document.createElement('span');
        n.textContent = r.nombre;
        var v = document.createElement('strong');
        v.textContent = nf.format(r.envios);
        li.append(n, v);
        ol.appendChild(li);
      });
    caja.append(t, ol);
    return caja;
  };

  /**
   * El globo que gira (viene de la propuesta "Globo"). Entra girando y frena sobre su destino,
   * se arrastra con inercia (con el dedo, solo de lado: hacia arriba y abajo la página sigue),
   * se gira con botones desde el teclado y dibuja encima los arcos de los envíos. Solo anima
   * mientras se ve; con movimiento reducido queda quieto en su destino y se mueve sin inercia.
   * `chart` es el LozChart del ejemplo y `lienzo` su contenedor. Devuelve { redibujar, destruir }.
   */
  window.girarGlobo = function (chart, lienzo, ej) {
    var cfg = ej.globo;
    var RAD = Math.PI / 180;
    var quieto = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var clamp = function (v, a, b) {
      return Math.max(a, Math.min(b, v));
    };
    var suave = function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };
    var destino = cfg.destino;
    var rot = quieto ? destino.slice() : [destino[0] - 200, 24];

    // ---- Capa de arcos y botones, encima del gráfico
    var NS = 'http://www.w3.org/2000/svg';
    var el = function (tag, attrs, padre) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (padre) padre.appendChild(n);
      return n;
    };
    lienzo.classList.add('globo-lienzo');
    var capa = el('svg', { class: 'globo-arcos', 'aria-hidden': 'true', focusable: 'false' });
    lienzo.appendChild(capa);
    var mandos = document.createElement('div');
    mandos.className = 'globo-mandos';
    var boton = function (texto, etiqueta) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = texto;
      if (etiqueta) b.setAttribute('aria-label', etiqueta);
      mandos.appendChild(b);
      return b;
    };
    var oeste = boton('←', 'Girar el globo hacia el oeste');
    var este = boton('→', 'Girar el globo hacia el este');
    var volver = boton('Volver a Latinoamérica');
    volver.hidden = true;
    var pista = document.createElement('span');
    pista.className = 'globo-pista';
    pista.textContent = 'Arrástralo para girarlo';
    mandos.appendChild(pista);
    lienzo.appendChild(mandos);

    // ---- Proyección: la misma del globo de la librería; k > 1 levanta el punto sobre la superficie
    var geo = { cx: 0, cy: 0, r: 0 };
    function medir() {
      var c = lienzo.querySelector('.lc-root svg circle');
      if (!c) return;
      var m = lienzo.getBoundingClientRect();
      var b = c.getBoundingClientRect();
      geo = { cx: b.left + b.width / 2 - m.left, cy: b.top + b.height / 2 - m.top, r: b.width / 2 };
      capa.setAttribute('viewBox', '0 0 ' + Math.round(m.width) + ' ' + Math.round(m.height));
    }
    var vec = function (lon, lat) {
      var l = lon * RAD;
      var p = lat * RAD;
      return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
    };
    function proyectar(v, k) {
      var lon = Math.atan2(v[1], v[0]);
      var lat = Math.asin(clamp(v[2], -1, 1));
      var l = lon - rot[0] * RAD;
      var p0 = rot[1] * RAD;
      var cp = Math.cos(lat);
      var x = cp * Math.sin(l);
      var y = Math.cos(p0) * Math.sin(lat) - Math.sin(p0) * cp * Math.cos(l);
      var z = Math.sin(p0) * Math.sin(lat) + Math.cos(p0) * cp * Math.cos(l);
      return [geo.cx + geo.r * k * x, geo.cy - geo.r * k * y, z >= 0 || Math.hypot(x, y) * k > 1];
    }
    var slerp = function (a, b, ang, t) {
      var s = Math.sin(ang) || 1;
      var ka = Math.sin((1 - t) * ang) / s;
      var kb = Math.sin(t * ang) / s;
      return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
    };

    var vOrigen = vec(cfg.origen.lon, cfg.origen.lat);
    var lugar = function (g, nombre, r, izq) {
      var o = { punto: el('circle', { class: 'ciudad', r: r }, g), nombre: el('text', { class: 'nombre' }, g), izq: izq };
      o.nombre.textContent = nombre;
      if (izq) o.nombre.setAttribute('text-anchor', 'end');
      return o;
    };
    var grupoOrigen = el('g', { class: 'ruta origen' }, capa);
    var origen = lugar(grupoOrigen, cfg.origen.nombre, 4.5);
    var rutas = cfg.rutas.map(function (r) {
      var g = el('g', { class: 'ruta' }, capa);
      var o = { g: g, v: vec(r.lon, r.lat), arco: el('path', { class: 'arco', pathLength: 1 }, g) };
      o.lugar = lugar(g, r.nombre, 3, r.izq);
      o.ang = Math.acos(clamp(vOrigen[0] * o.v[0] + vOrigen[1] * o.v[1] + vOrigen[2] * o.v[2], -1, 1));
      o.alto = 0.04 + 0.22 * (o.ang / Math.PI);
      return o;
    });
    function colocar(o, v) {
      var q = proyectar(v, 1);
      o.punto.setAttribute('cx', q[0].toFixed(1));
      o.punto.setAttribute('cy', q[1].toFixed(1));
      o.nombre.setAttribute('x', (q[0] + (o.izq ? -8 : 8)).toFixed(1));
      o.nombre.setAttribute('y', (q[1] + 4).toFixed(1));
      o.punto.style.display = o.nombre.style.display = q[2] ? '' : 'none';
    }
    function dibujarArcos() {
      colocar(origen, vOrigen);
      rutas.forEach(function (o) {
        var d = '';
        var abierto = false;
        for (var i = 0; i <= 48; i++) {
          var t = i / 48;
          var q = proyectar(slerp(vOrigen, o.v, o.ang, t), 1 + o.alto * Math.sin(Math.PI * t));
          if (!q[2]) {
            abierto = false;
            continue;
          }
          d += (abierto ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
          abierto = true;
        }
        o.arco.setAttribute('d', d || 'M0,0');
        colocar(o.lugar, o.v);
      });
    }
    var arcosVistos = false;
    function mostrarArcos(ya) {
      if (arcosVistos) return;
      arcosVistos = true;
      if (ya || quieto) {
        capa.classList.add('ya');
        capa.querySelectorAll('.ruta').forEach(function (g) {
          g.classList.add('visible');
        });
        return;
      }
      grupoOrigen.classList.add('visible');
      rutas.forEach(function (o, i) {
        tiempos.push(
          setTimeout(
            function () {
              o.g.classList.add('visible');
            },
            200 + i * 160,
          ),
        );
      });
    }
    var tiempos = [];

    // ---- Dibujar: la serie con la rotación de ahora (el resto de opciones queda como esté)
    function dibujar() {
      var series = chart.options.series.map(function (s, i) {
        return i ? s : Object.assign({}, s, { rotate: [+rot[0].toFixed(2), +rot[1].toFixed(2)] });
      });
      chart.setOptions({ series: series }, false);
      medir();
      dibujarArcos();
      var lejos = Math.abs(((((rot[0] - destino[0]) % 360) + 540) % 360) - 180) > 2 || Math.abs(rot[1] - destino[1]) > 2;
      volver.hidden = !lejos || entrando;
    }
    var pendiente = false;
    function pedirDibujo() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        if (!vivo) return;
        dibujar();
      });
    }

    // ---- Animación: solo corre mientras el globo se ve
    var vivo = true;
    var seVe = false;
    var tarea = null; // función (t) => true si quiere otro cuadro
    var corriendo = false;
    function cuadro(t) {
      if (!vivo || !tarea || !seVe) {
        corriendo = false;
        return;
      }
      var seguir = tarea(t);
      if (!seguir) tarea = null;
      dibujar();
      requestAnimationFrame(cuadro);
    }
    function animar(fn) {
      tarea = fn;
      if (!corriendo && seVe) {
        corriendo = true;
        requestAnimationFrame(cuadro);
      }
    }
    function irA(meta, ms, alTerminar) {
      var desde = rot.slice();
      var largo = ms > 2000;
      var dLon = largo ? meta[0] - desde[0] : ((((meta[0] - desde[0]) % 360) + 540) % 360) - 180;
      if (quieto) {
        rot = [desde[0] + dLon, meta[1]];
        tarea = null;
        pedirDibujo();
        if (alTerminar) alTerminar();
        return;
      }
      var inicio = null;
      animar(function (t) {
        if (inicio === null) inicio = t;
        var k = clamp((t - inicio) / ms, 0, 1);
        var e = largo ? 1 - Math.pow(1 - k, 4) : suave(k);
        rot = [desde[0] + dLon * e, desde[1] + (meta[1] - desde[1]) * e];
        if (k < 1) return true;
        if (alTerminar) alTerminar();
        return false;
      });
    }

    var primeraVez = true;
    var entrando = !quieto;
    var vigia = new IntersectionObserver(
      function (es) {
        seVe = es[es.length - 1].isIntersecting;
        if (!seVe) return;
        if (primeraVez) {
          primeraVez = false;
          medir();
          // Entra girando y frena sobre su destino; los arcos salen cuando ya se detuvo.
          if (quieto) mostrarArcos(true);
          else
            irA(destino, 4400, function () {
              entrando = false;
              mostrarArcos(false);
            });
        } else if (tarea && !corriendo) {
          corriendo = true;
          requestAnimationFrame(cuadro);
        }
      },
      { threshold: 0.3 },
    );
    vigia.observe(lienzo);

    // Cambia el ancho o el alto: el gráfico se redibuja solo; los arcos lo siguen en el cuadro siguiente.
    var medidas = new ResizeObserver(function () {
      requestAnimationFrame(function () {
        if (!vivo) return;
        medir();
        dibujarArcos();
      });
    });
    medidas.observe(lienzo);

    // ---- Arrastrar, con inercia
    var arrastre = null;
    function alBajar(e) {
      if (e.button !== 0 || e.target.closest('.globo-mandos')) return;
      tarea = null;
      entrando = false;
      mostrarArcos(true);
      arrastre = { x: e.clientX, y: e.clientY, rot: rot.slice(), t: e.timeStamp, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
      arrastre.tactil = e.pointerType === 'touch';
      // Grados por píxel: la superficie sigue al puntero.
      arrastre.k = 57.3 / Math.max(40, geo.r || 200);
      lienzo.classList.add('arrastrando');
      if (!arrastre.tactil) lienzo.setPointerCapture(e.pointerId);
    }
    function alMover(e) {
      if (!arrastre) return;
      var k = arrastre.k;
      var dy = arrastre.tactil ? 0 : e.clientY - arrastre.y;
      rot = [arrastre.rot[0] - (e.clientX - arrastre.x) * k, clamp(arrastre.rot[1] + dy * k, -60, 60)];
      var dt = Math.max(1, e.timeStamp - arrastre.t);
      arrastre.vx = (-(e.clientX - arrastre.lx) * k) / dt;
      arrastre.vy = arrastre.tactil ? 0 : ((e.clientY - arrastre.ly) * k) / dt;
      arrastre.lx = e.clientX;
      arrastre.ly = e.clientY;
      arrastre.t = e.timeStamp;
      pedirDibujo();
    }
    function alSoltar() {
      if (!arrastre) return;
      var vx = arrastre.vx;
      var vy = arrastre.vy;
      arrastre = null;
      lienzo.classList.remove('arrastrando');
      if (quieto || Math.hypot(vx, vy) < 0.01) return pedirDibujo();
      var ultimo = null;
      animar(function (t) {
        var dt = ultimo === null ? 16 : Math.min(48, t - ultimo);
        ultimo = t;
        rot = [rot[0] + vx * dt, clamp(rot[1] + vy * dt, -60, 60)];
        var f = Math.pow(0.94, dt / 16);
        vx *= f;
        vy *= f;
        return Math.hypot(vx, vy) > 0.004;
      });
    }
    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSoltar);
    lienzo.addEventListener('pointercancel', alSoltar);

    // ---- Botones (y teclado)
    var girar = function (paso) {
      entrando = false;
      mostrarArcos(true);
      irA([rot[0] + paso, rot[1]], 650);
    };
    oeste.addEventListener('click', function () {
      girar(-45);
    });
    este.addEventListener('click', function () {
      girar(45);
    });
    volver.addEventListener('click', function () {
      irA(destino, 1300, function () {
        pedirDibujo();
        este.focus();
      });
    });

    dibujar();
    return {
      /** Vuelve a poner la rotación actual (después de cambiar otras opciones del gráfico). */
      redibujar: pedirDibujo,
      destruir: function () {
        vivo = false;
        tarea = null;
        vigia.disconnect();
        medidas.disconnect();
        tiempos.forEach(clearTimeout);
        lienzo.removeEventListener('pointerdown', alBajar);
        lienzo.removeEventListener('pointermove', alMover);
        lienzo.removeEventListener('pointerup', alSoltar);
        lienzo.removeEventListener('pointercancel', alSoltar);
        lienzo.classList.remove('globo-lienzo', 'arrastrando');
        capa.remove();
        mandos.remove();
      },
    };
  };

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
