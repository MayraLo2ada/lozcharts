/*
 * Ejemplos de la galería: cada uno con su nombre, familia y opciones. Datos de ejemplo, siempre
 * iguales. Los textos van en el idioma de la página (tx, de idioma.js) y, en inglés y portugués,
 * también los nombres de los campos de los datos (ver CAMPOS, al final).
 */
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

  // Las familias de la galería: la galería filtra por este texto, así que cada una se escribe una sola vez.
  var COMPARAR = tx({ es: 'Comparar', en: 'Compare', pt: 'Comparar' });
  var TIEMPO = tx({ es: 'En el tiempo', en: 'Over time', pt: 'Ao longo do tempo' });
  var PARTES = tx({ es: 'Partes de un todo', en: 'Parts of a whole', pt: 'Partes de um todo' });
  var RELACIONES = tx({ es: 'Relaciones', en: 'Relationships', pt: 'Relações' });
  var FLUJOS = tx({ es: 'Flujos y mapas', en: 'Flows and maps', pt: 'Fluxos e mapas' });

  // Lugares que cambian de nombre según el idioma (los demás se escriben igual en los tres).
  var L = {
    cdmx: tx({ es: 'Ciudad de México', en: 'Mexico City', pt: 'Cidade do México' }),
    mexico: tx({ es: 'México', en: 'Mexico', pt: 'México' }),
    peru: tx({ es: 'Perú', en: 'Peru', pt: 'Peru' }),
    espana: tx({ es: 'España', en: 'Spain', pt: 'Espanha' }),
    francia: tx({ es: 'Francia', en: 'France', pt: 'França' }),
    japon: tx({ es: 'Japón', en: 'Japan', pt: 'Japão' }),
    corea: tx({ es: 'Corea del Sur', en: 'South Korea', pt: 'Coreia do Sul' }),
    lisboa: tx({ es: 'Lisboa', en: 'Lisbon', pt: 'Lisboa' }),
    paris: tx({ es: 'París', en: 'Paris', pt: 'Paris' }),
    tokio: tx({ es: 'Tokio', en: 'Tokyo', pt: 'Tóquio' }),
    seul: tx({ es: 'Seúl', en: 'Seoul', pt: 'Seul' }),
    america: tx({ es: 'América', en: 'Americas', pt: 'Américas' }),
    europa: tx({ es: 'Europa', en: 'Europe', pt: 'Europa' }),
    asia: tx({ es: 'Asia', en: 'Asia', pt: 'Ásia' }),
  };

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

  // Las ciudades son a la vez campos de los datos y nombres de las series.
  var ciudades = ['Lima', 'Bogotá', 'Quito', 'Santiago', L.cdmx];
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

  // Una cámara de frío medida cada hora durante tres meses: entre 2 y 5 °C, salvo los picos de
  // cuando se deja la puerta abierta. Los picos aplastan la franja que importa: zoom en Y.
  var camara = [];
  var pico = 0;
  for (var h = 0; h < 2000; h++) {
    var fh = new Date(2026, 6, 1, h);
    if (pico < 0.2 && r() < 0.01) pico = 8 + r() * 9;
    pico *= 0.6;
    camara.push({
      hora: fh.getFullYear() + '-' + pad(fh.getMonth() + 1) + '-' + pad(fh.getDate()) + 'T' + pad(fh.getHours()) + ':00',
      temp: Math.round((3.4 + 0.5 * Math.sin(((h % 24) / 24) * 2 * Math.PI) + (r() - 0.5) * 0.6 + pico) * 10) / 10,
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
  tx({
    es: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    pt: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'],
  }).forEach(function (dia, k) {
    for (var h = 0; h < 24; h++) {
      var curva = Math.max(0.05, Math.sin(((h - 6) / 18) * Math.PI)) * (h >= 6 ? 1 : 0.3);
      visitasHora.push({
        hora: pad(h) + ':00',
        dia: dia,
        visitas: Math.round((900 * curva * (k < 5 ? 1 : 0.6) + 40) * (0.9 + r() * 0.2)),
      });
    }
  });

  // Como las ciudades: cada región es un campo y el nombre de su panel.
  var regiones = tx({
    es: ['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Costa'],
    en: ['North', 'South', 'East', 'West', 'Central', 'Coast'],
    pt: ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro', 'Litoral'],
  });
  var porRegion = MESES.map(function (mes, i) {
    var row = { mes: mes };
    regiones.forEach(function (rg, k) {
      row[rg] = Math.round(50 + k * 6 + i * (k - 2) * 1.6 + 8 * Math.sin(i * 0.8 + k));
    });
    return row;
  });

  // Zonas de las burbujas, en el orden de sus series: norte, centro y sur.
  var zonas = tx({ es: ['Norte', 'Centro', 'Sur'], en: ['North', 'Central', 'South'], pt: ['Norte', 'Centro', 'Sul'] });
  var nombresZona = tx({
    es: ['Zona norte', 'Zona centro', 'Zona sur'],
    en: ['North zone', 'Central zone', 'South zone'],
    pt: ['Zona norte', 'Zona centro', 'Zona sul'],
  });

  // Pasos del recorrido de las visitas (sankey): un nombre por nodo.
  var paso = tx({
    es: {
      busqueda: 'Búsqueda',
      redes: 'Redes',
      correo: 'Correo',
      directo: 'Directo',
      inicio: 'Inicio',
      ofertas: 'Ofertas',
      producto: 'Producto',
      abandono: 'Abandono',
      compra: 'Compra',
    },
    en: {
      busqueda: 'Search',
      redes: 'Social',
      correo: 'Email',
      directo: 'Direct',
      inicio: 'Home',
      ofertas: 'Deals',
      producto: 'Product',
      abandono: 'Left the site',
      compra: 'Purchase',
    },
    pt: {
      busqueda: 'Busca',
      redes: 'Redes sociais',
      correo: 'E-mail',
      directo: 'Direto',
      inicio: 'Início',
      ofertas: 'Ofertas',
      producto: 'Produto',
      abandono: 'Abandono',
      compra: 'Compra',
    },
  });

  // Regiones de las mudanzas (cuerdas).
  var zona = tx({
    es: { capital: 'Capital', centro: 'Centro', costa: 'Costa', norte: 'Norte', sur: 'Sur' },
    en: { capital: 'Capital', centro: 'Central', costa: 'Coast', norte: 'North', sur: 'South' },
    pt: { capital: 'Capital', centro: 'Centro', costa: 'Litoral', norte: 'Norte', sur: 'Sul' },
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

  /** Une una lista de nombres (por idioma) con sus números, fila por fila. */
  var junto = function (nombres, resto) {
    return nombres.map(function (n, i) {
      return [n].concat(resto[i]);
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
      clase: tx({ es: 'Barras apiladas con meta', en: 'Stacked bars with a goal', pt: 'Barras empilhadas com meta' }),
      familia: COMPARAR,
      tamano: 'grande',
      desc: tx({
        es: 'Apilar los dos canales deja ver el total del mes y, a la vez, cuánto pone cada uno. La meta va como línea para que nadie la confunda con una barra más.',
        en: 'Stacking the two channels shows the month’s total and, at the same time, how much each one adds. The goal is a line so nobody mistakes it for another bar.',
        pt: 'Empilhar os dois canais mostra o total do mês e, ao mesmo tempo, quanto cada um contribui. A meta vai como linha para ninguém confundir com mais uma barra.',
      }),
      opciones: {
        title: tx({
          es: 'La tienda en línea pasó a la física en junio',
          en: 'The online store overtook the physical one in June',
          pt: 'A loja online passou a loja física em junho',
        }),
        subtitle: tx({
          es: 'Ventas por mes en 2026, en dólares. La línea es la meta mensual.',
          en: 'Monthly sales in 2026, in dollars. The line is the monthly goal.',
          pt: 'Vendas por mês em 2026, em dólares. A linha é a meta mensal.',
        }),
        data: ventas,
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'currency' },
        series: [
          { type: 'bar', field: 'online', name: tx({ es: 'En línea', en: 'Online', pt: 'Online' }), stack: true },
          { type: 'bar', field: 'tienda', name: tx({ es: 'Tienda física', en: 'In store', pt: 'Loja física' }), stack: true },
          { type: 'line', field: 'meta', name: tx({ es: 'Meta', en: 'Goal', pt: 'Meta' }), smooth: true },
        ],
      },
    },
    {
      id: 'paginas',
      tipo: 'LozBar',
      clase: tx({ es: 'Barras horizontales', en: 'Horizontal bars', pt: 'Barras horizontais' }),
      familia: COMPARAR,
      desc: tx({
        es: 'Con nombres largos, las barras acostadas se leen sin torcer la cabeza. Ordenadas de mayor a menor, la comparación sale de un vistazo.',
        en: 'With long names, sideways bars read without tilting your head. Sorted from largest to smallest, the comparison jumps out at a glance.',
        pt: 'Com nomes longos, as barras deitadas se leem sem entortar a cabeça. Ordenadas da maior para a menor, a comparação salta aos olhos.',
      }),
      opciones: {
        title: tx({
          es: 'Las preguntas frecuentes ya reciben más visitas que el carrito',
          en: 'The FAQ page now gets more visits than the cart',
          pt: 'As perguntas frequentes já recebem mais visitas que o carrinho',
        }),
        subtitle: tx({
          es: 'Visitas únicas por página, octubre de 2026',
          en: 'Unique visits per page, October 2026',
          pt: 'Visitas únicas por página, outubro de 2026',
        }),
        orientation: 'horizontal',
        data: filas(
          junto(
            tx({
              es: ['Inicio', 'Catálogo de productos', 'Ofertas de temporada', 'Preguntas frecuentes', 'Carrito', 'Blog'],
              en: ['Home', 'Product catalog', 'Seasonal deals', 'FAQ', 'Cart', 'Blog'],
              pt: ['Início', 'Catálogo de produtos', 'Ofertas da temporada', 'Perguntas frequentes', 'Carrinho', 'Blog'],
            }),
            [48210, 31840, 27390, 15620, 12950, 9430],
          ),
          ['pagina', 'visitas'],
        ),
        xAxis: { field: 'pagina' },
        series: [{ type: 'bar', field: 'visitas', name: tx({ es: 'Visitas', en: 'Visits', pt: 'Visitas' }) }],
      },
    },
    {
      id: 'resultado',
      tipo: 'LozWaterfall',
      clase: tx({ es: 'Cascada', en: 'Waterfall', pt: 'Cascata' }),
      familia: COMPARAR,
      desc: tx({
        es: 'Una cascada explica cómo se pasa de un número a otro. Cada barra empieza donde terminó la anterior, y los subtotales vuelven a partir de cero.',
        en: 'A waterfall explains how you get from one number to another. Each bar starts where the last one ended, and the subtotals start again from zero.',
        pt: 'Uma cascata explica como se chega de um número a outro. Cada barra começa onde a anterior terminou, e os subtotais voltam a partir do zero.',
      }),
      opciones: {
        title: tx({
          es: 'De cada dólar vendido quedan 20 centavos',
          en: 'Out of every dollar in sales, 20 cents is profit',
          pt: 'De cada dólar vendido, sobram 20 centavos',
        }),
        subtitle: tx({
          es: 'Estado de resultados de 2026, en dólares',
          en: 'Income statement for 2026, in dollars',
          pt: 'Demonstração de resultados de 2026, em dólares',
        }),
        data: (function () {
          var n = tx({
            es: [
              'Ventas',
              'Costo de ventas',
              'Utilidad bruta',
              'Gastos de operación',
              'Marketing',
              'Otros ingresos',
              'Impuestos',
              'Utilidad neta',
            ],
            en: [
              'Revenue',
              'Cost of sales',
              'Gross profit',
              'Operating expenses',
              'Marketing',
              'Other income',
              'Taxes',
              'Net profit',
            ],
            pt: [
              'Vendas',
              'Custo das vendas',
              'Lucro bruto',
              'Despesas operacionais',
              'Marketing',
              'Outras receitas',
              'Impostos',
              'Lucro líquido',
            ],
          });
          return [
            { paso: n[0], monto: 1250000 },
            { paso: n[1], monto: -520000 },
            { paso: n[2], total: true },
            { paso: n[3], monto: -310000 },
            { paso: n[4], monto: -95000 },
            { paso: n[5], monto: 40000 },
            { paso: n[6], monto: -110000 },
            { paso: n[7], total: true },
          ];
        })(),
        xAxis: { field: 'paso' },
        yAxis: { format: 'currency' },
        series: [
          {
            type: 'waterfall',
            field: 'monto',
            name: tx({ es: 'Resultado', en: 'Result', pt: 'Resultado' }),
            total: 'total',
          },
        ],
      },
    },
    {
      id: 'metas',
      tipo: 'LozBullet',
      clase: tx({ es: 'Metas (bala)', en: 'Bullet chart', pt: 'Metas (bullet)' }),
      familia: COMPARAR,
      desc: tx({
        es: 'Una fila por región, todas en la misma escala. La barra delgada es lo vendido y la raya, la meta. Los grises del fondo marcan hasta dónde es bajo, aceptable o bueno.',
        en: 'One row per region, all on the same scale. The thin bar is what was sold and the tick mark is the target. The gray bands behind show where poor, fair and good end.',
        pt: 'Uma linha por região, todas na mesma escala. A barra fina é o que foi vendido e o traço, a meta. Os cinzas do fundo marcam até onde é baixo, aceitável ou bom.',
      }),
      opciones: {
        title: tx({
          es: 'El Sur quedó lejos de su meta',
          en: 'The South fell far short of its target',
          pt: 'O Sul ficou longe da meta',
        }),
        subtitle: tx({
          es: 'Ventas del tercer trimestre, en miles de dólares. La raya es la meta de cada región.',
          en: 'Third-quarter sales, in thousands of dollars. The tick mark is each region’s target.',
          pt: 'Vendas do terceiro trimestre, em milhares de dólares. O traço é a meta de cada região.',
        }),
        data: filas(
          junto(
            tx({
              es: ['Norte', 'Centro', 'Sur', 'Occidente', 'Oriente'],
              en: ['North', 'Central', 'South', 'West', 'East'],
              pt: ['Norte', 'Centro', 'Sul', 'Oeste', 'Leste'],
            }),
            [
              [512, 480],
              [433, 460],
              [297, 420],
              [571, 520],
              [365, 400],
            ],
          ),
          ['region', 'ventas', 'meta'],
        ),
        xAxis: { field: 'region' },
        series: [
          {
            type: 'bullet',
            field: 'ventas',
            name: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }),
            targetField: 'meta',
            ranges: [300, 450, 600],
          },
        ],
      },
    },
    {
      id: 'opiniones',
      tipo: 'LozWordcloud',
      clase: tx({ es: 'Nube de palabras', en: 'Word cloud', pt: 'Nuvem de palavras' }),
      familia: COMPARAR,
      desc: tx({
        es: 'Da una idea rápida de qué se habla, no una medida: el tamaño de una palabra se compara peor que el largo de una barra. Para la cifra exacta, pasa el puntero por la palabra.',
        en: 'It gives you a quick sense of what people talk about, not a measurement: the size of a word is harder to compare than the length of a bar. For the exact number, hover over the word.',
        pt: 'Dá uma ideia rápida do que se fala, não uma medida: o tamanho de uma palavra se compara pior que o comprimento de uma barra. Para o número exato, passe o ponteiro sobre a palavra.',
      }),
      opciones: {
        title: tx({
          es: 'Lo que más agradecen es la atención',
          en: 'What customers appreciate most is the service',
          pt: 'O que os clientes mais elogiam é o atendimento',
        }),
        subtitle: tx({
          es: 'Palabras más repetidas en 2.140 opiniones de clientes, por tema',
          en: 'Most frequent words in 2,140 customer reviews, by topic',
          pt: 'Palavras mais repetidas em 2.140 avaliações de clientes, por tema',
        }),
        // Las palabras que de verdad escribe un cliente en cada idioma; las menciones y los temas
        // son los mismos en los tres.
        data: (function () {
          var tema = tx({
            es: { s: 'Servicio', e: 'Entrega', p: 'Precio', d: 'Producto' },
            en: { s: 'Service', e: 'Delivery', p: 'Price', d: 'Product' },
            pt: { s: 'Atendimento', e: 'Entrega', p: 'Preço', d: 'Produto' },
          });
          var palabras = tx({
            es: [
              'atención',
              'rapidez',
              'precio',
              'calidad',
              'envío',
              'amabilidad',
              'variedad',
              'puntualidad',
              'ofertas',
              'devoluciones',
              'empaque',
              'descuentos',
              'garantía',
              'asesoría',
              'frescura',
              'pago en línea',
              'seguimiento',
              'tienda física',
              'diseño',
              'cupones',
              'paciencia',
              'horario',
              'stock',
              'tallas',
              'cambio',
              'envío gratis',
              'reembolso',
              'recomendación',
              'catálogo',
              'cuotas',
            ],
            en: [
              'customer service',
              'fast',
              'price',
              'quality',
              'shipping',
              'friendly',
              'selection',
              'on time',
              'deals',
              'returns',
              'packaging',
              'discounts',
              'warranty',
              'advice',
              'fresh',
              'easy checkout',
              'tracking',
              'in store',
              'design',
              'coupons',
              'patient',
              'store hours',
              'in stock',
              'sizes',
              'exchanges',
              'free shipping',
              'refund',
              'recommend',
              'catalog',
              'pay later',
            ],
            pt: [
              'atendimento',
              'rapidez',
              'preço',
              'qualidade',
              'frete',
              'simpatia',
              'variedade',
              'no prazo',
              'promoções',
              'devolução',
              'embalagem',
              'descontos',
              'garantia',
              'orientação',
              'frescor',
              'Pix',
              'rastreio',
              'loja física',
              'design',
              'cupons',
              'paciência',
              'horário',
              'estoque',
              'tamanhos',
              'troca',
              'frete grátis',
              'reembolso',
              'indicação',
              'catálogo',
              'parcelamento',
            ],
          });
          return filas(
            junto(palabras, [
              [412, tema.s],
              [356, tema.e],
              [331, tema.p],
              [298, tema.d],
              [276, tema.e],
              [214, tema.s],
              [198, tema.d],
              [176, tema.e],
              [164, tema.p],
              [151, tema.s],
              [139, tema.e],
              [127, tema.p],
              [118, tema.d],
              [109, tema.s],
              [96, tema.d],
              [92, tema.p],
              [88, tema.e],
              [81, tema.s],
              [74, tema.d],
              [69, tema.p],
              [63, tema.s],
              [58, tema.s],
              [54, tema.d],
              [49, tema.d],
              [45, tema.s],
              [43, tema.e],
              [38, tema.p],
              [35, tema.s],
              [31, tema.d],
              [28, tema.p],
            ]),
            ['palabra', 'menciones', 'tema'],
          );
        })(),
        xAxis: { field: 'palabra' },
        series: [
          {
            type: 'wordcloud',
            field: 'menciones',
            name: tx({ es: 'Menciones', en: 'Mentions', pt: 'Menções' }),
            group: 'tema',
          },
        ],
      },
    },
    {
      id: 'regiones',
      tipo: 'LozMultiples',
      clase: tx({ es: 'Paneles pequeños', en: 'Small multiples', pt: 'Pequenos múltiplos' }),
      familia: COMPARAR,
      tamano: 'ancho',
      multiples: true,
      desc: tx({
        es: 'Un panel por región, todos con la misma escala. Detrás de cada uno, en gris, van las demás: así se compara la forma sin andar buscando colores.',
        en: 'One panel per region, all on the same scale. Behind each one, in gray, are the others, so you compare shapes without hunting for colors.',
        pt: 'Um painel por região, todos na mesma escala. Atrás de cada um, em cinza, ficam as outras: assim você compara a forma sem ficar procurando cores.',
      }),
      opciones: {
        title: tx({
          es: 'El Norte perdió más de la mitad de sus ventas en el año',
          en: 'The North lost more than half its sales over the year',
          pt: 'O Norte perdeu mais da metade das vendas no ano',
        }),
        subtitle: tx({
          es: 'Ventas por mes en 2026, en miles de dólares. En gris, las otras regiones.',
          en: 'Monthly sales in 2026, in thousands of dollars. In gray, the other regions.',
          pt: 'Vendas por mês em 2026, em milhares de dólares. Em cinza, as outras regiões.',
        }),
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
      clase: tx({ es: 'Líneas con zoom', en: 'Lines with zoom', pt: 'Linhas com zoom' }),
      familia: TIEMPO,
      tamano: 'ancho',
      desc: tx({
        es: 'Un año día por día es demasiado para verlo de una vez. Acércate a unas semanas, mueve la ventana con el deslizante de abajo y, con doble clic, vuelve a verlo entero.',
        en: 'A year, day by day, is too much to take in at once. Zoom in on a few weeks, move the window with the slider below, and double-click to see the whole year again.',
        pt: 'Um ano dia a dia é demais para ver de uma vez. Dê zoom em algumas semanas, mova a janela com o controle de baixo e, com um clique duplo, volte a ver o ano inteiro.',
      }),
      opciones: {
        // En Brasil julio es invierno y vacaciones escolares: allá la campaña es de vacaciones.
        title: tx({
          es: 'Con la campaña de verano, la web pasó por primera vez la meta',
          en: 'With the summer campaign, the website beat its goal for the first time',
          pt: 'Com a campanha de férias, o site bateu a meta pela primeira vez',
        }),
        subtitle: tx({
          es: 'Visitas diarias, noviembre de 2025 a octubre de 2026. Arrastra sobre el gráfico para acercarte.',
          en: 'Daily visits, November 2025 to October 2026. Drag across the chart to zoom in.',
          pt: 'Visitas diárias, de novembro de 2025 a outubro de 2026. Arraste sobre o gráfico para dar zoom.',
        }),
        data: dias,
        xAxis: { field: 'fecha', type: 'time' },
        series: [
          { type: 'line', field: 'web', name: tx({ es: 'Web', en: 'Website', pt: 'Site' }) },
          { type: 'line', field: 'app', name: 'App' },
        ],
        zoom: { range: ['2026-05-15', '2026-08-31'] },
        endLabels: true,
        annotations: [
          {
            x: ['2026-06-29', '2026-07-21'],
            label: tx({ es: 'Campaña de verano', en: 'Summer campaign', pt: 'Campanha de férias' }),
          },
          { y: 8000, label: tx({ es: 'Meta diaria', en: 'Daily goal', pt: 'Meta diária' }) },
        ],
      },
    },
    {
      id: 'camara-fria',
      tipo: 'LozLine',
      clase: tx({ es: 'Líneas con zoom en Y', en: 'Lines with Y zoom', pt: 'Linhas com zoom no Y' }),
      familia: TIEMPO,
      tamano: 'ancho',
      desc: tx({
        es: 'Unos cuantos picos de más de 10 °C dejan la franja que importa, de 2 a 5 °C, hecha una raya. Con el deslizante de la izquierda te acercas a esos grados sin perder de vista las semanas.',
        en: 'A few spikes over 10 °C squash the range that matters, 2 to 5 °C, into a flat line. With the slider on the left you zoom in on those degrees without losing sight of the weeks.',
        pt: 'Alguns picos de mais de 10 °C deixam a faixa que importa, de 2 a 5 °C, achatada numa linha. Com o controle da esquerda você chega perto desses graus sem perder as semanas de vista.',
      }),
      opciones: {
        title: tx({
          es: 'La cámara de frío se mantuvo entre 2 y 5 °C casi todo el verano',
          en: 'The cold room stayed between 2 and 5 °C almost all summer',
          pt: 'A câmara fria ficou entre 2 e 5 °C quase o inverno todo',
        }),
        subtitle: tx({
          es: 'Temperatura cada hora, julio a septiembre de 2026. Los picos son la puerta abierta.',
          en: 'Hourly temperature, July to September 2026. The spikes are the door left open.',
          pt: 'Temperatura a cada hora, de julho a setembro de 2026. Os picos são a porta aberta.',
        }),
        data: camara,
        xAxis: { field: 'hora', type: 'time' },
        yAxis: { title: '°C' },
        series: [{ type: 'line', field: 'temp', name: tx({ es: 'Temperatura', en: 'Temperature', pt: 'Temperatura' }) }],
        annotations: [{ y: [2, 5], label: tx({ es: 'Rango seguro', en: 'Safe range', pt: 'Faixa segura' }) }],
        zoom: { y: true },
      },
    },
    {
      id: 'usuarios',

      tipo: 'LozLine',
      clase: tx({ es: 'Líneas con nombre al final', en: 'Lines labeled at the end', pt: 'Linhas com nome no fim' }),
      familia: TIEMPO,
      desc: tx({
        es: 'Con cinco líneas, ir y volver a la leyenda cansa. Aquí cada ciudad lleva su nombre y su último valor donde termina la línea.',
        en: 'With five lines, going back and forth to the legend gets tiring. Here each city has its name and latest value right where its line ends.',
        pt: 'Com cinco linhas, ir e voltar à legenda cansa. Aqui cada cidade leva o nome e o último valor onde a linha termina.',
      }),
      opciones: {
        title: tx({
          es: 'Ciudad de México duplicó sus usuarios en un año',
          en: 'Mexico City doubled its users in a year',
          pt: 'A Cidade do México dobrou de usuários em um ano',
        }),
        subtitle: tx({
          es: 'Usuarios activos al mes, en miles',
          en: 'Monthly active users, in thousands',
          pt: 'Usuários ativos por mês, em milhares',
        }),
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
      clase: tx({ es: 'Áreas apiladas', en: 'Stacked areas', pt: 'Áreas empilhadas' }),
      familia: TIEMPO,
      desc: tx({
        es: 'Las áreas apiladas muestran el total y la mezcla al mismo tiempo. Con tres capas se leen bien; pasadas las cuatro, las de arriba bailan sobre las de abajo y cuesta seguirlas.',
        en: 'Stacked areas show the total and the mix at the same time. Three layers read fine; past four, the top ones wobble on the ones below and get hard to follow.',
        pt: 'As áreas empilhadas mostram o total e a composição ao mesmo tempo. Com três camadas dá para ler bem; passando de quatro, as de cima dançam sobre as de baixo e fica difícil acompanhar.',
      }),
      opciones: {
        title: tx({
          es: 'Casi todo el crecimiento vino del móvil',
          en: 'Almost all the growth came from mobile',
          pt: 'Quase todo o crescimento veio do celular',
        }),
        subtitle: tx({
          es: 'Visitas al mes por dispositivo, 2026',
          en: 'Monthly visits by device, 2026',
          pt: 'Visitas por mês por dispositivo, 2026',
        }),
        data: MESES.map(function (mes, i) {
          return { mes: mes, movil: 5200 + i * 310, escritorio: 4100 - i * 60, tableta: 900 + i * 20 };
        }),
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'compact' },
        series: [
          { type: 'area', field: 'movil', name: tx({ es: 'Móvil', en: 'Mobile', pt: 'Celular' }), stack: true, smooth: true },
          {
            type: 'area',
            field: 'escritorio',
            name: tx({ es: 'Escritorio', en: 'Desktop', pt: 'Desktop' }),
            stack: true,
            smooth: true,
          },
          { type: 'area', field: 'tableta', name: tx({ es: 'Tableta', en: 'Tablet', pt: 'Tablet' }), stack: true, smooth: true },
        ],
      },
    },
    {
      id: 'tasa',
      tipo: 'LozStep',
      clase: tx({ es: 'Escalones', en: 'Step line', pt: 'Degraus' }),
      familia: TIEMPO,
      desc: tx({
        es: 'Entre una decisión y la siguiente la tasa no se mueve, así que una línea inclinada mentiría. Los escalones marcan el salto el día en que ocurre.',
        en: 'Between one decision and the next, the rate doesn’t move, so a sloped line would lie. The steps show the jump on the day it happens.',
        pt: 'Entre uma decisão e a seguinte a taxa não se mexe, então uma linha inclinada mentiria. Os degraus marcam o salto no dia em que ele acontece.',
      }),
      opciones: {
        title: tx({ es: 'Siete recortes seguidos', en: 'Seven cuts in a row', pt: 'Sete cortes seguidos' }),
        subtitle: tx({
          es: 'Tasa de interés de referencia, de enero de 2025 a octubre de 2026',
          en: 'Benchmark interest rate, January 2025 to October 2026',
          pt: 'Taxa básica de juros, de janeiro de 2025 a outubro de 2026',
        }),
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
        series: [{ type: 'step', field: 'tasa', name: tx({ es: 'Tasa', en: 'Rate', pt: 'Taxa' }) }],
      },
    },
    {
      id: 'lanzamiento',
      tipo: 'LozTimeline',
      clase: tx({ es: 'Línea de tiempo', en: 'Timeline', pt: 'Linha do tempo' }),
      familia: TIEMPO,
      tamano: 'grande',
      desc: tx({
        es: 'Un carril por equipo y una barra por tarea, de su inicio a su fin. Lo que no tiene fecha de fin es un hito y va en rombo; la línea punteada es hoy.',
        en: 'One lane per team and one bar per task, from start to finish. Anything without an end date is a milestone and shows as a diamond; the dotted line is today.',
        pt: 'Uma faixa por equipe e uma barra por tarefa, do início ao fim. O que não tem data de fim é um marco e aparece como losango; a linha pontilhada é hoje.',
      }),
      opciones: {
        title: tx({
          es: 'Ocho meses de la primera entrevista al lanzamiento',
          en: 'Eight months from the first interview to launch',
          pt: 'Oito meses da primeira entrevista ao lançamento',
        }),
        subtitle: tx({
          es: 'Plan de la app de pagos por equipo, 2026. Los rombos son hitos.',
          en: 'Payments app plan by team, 2026. The diamonds are milestones.',
          pt: 'Plano do app de pagamentos por equipe, 2026. Os losangos são marcos.',
        }),
        data: (function () {
          var t = tx({
            es: [
              'Investigación',
              'Definición del alcance',
              'Pruebas con usuarios',
              'Beta cerrada',
              'Prototipos',
              'Sistema visual',
              'API de pagos',
              'App móvil',
              'Integración con bancos',
              'Soporte',
              'Campaña',
              'Lanzamiento',
            ],
            en: [
              'Research',
              'Scope definition',
              'User testing',
              'Closed beta',
              'Prototypes',
              'Design system',
              'Payments API',
              'Mobile app',
              'Bank integration',
              'Support',
              'Campaign',
              'Launch',
            ],
            pt: [
              'Pesquisa',
              'Definição do escopo',
              'Testes com usuários',
              'Beta fechado',
              'Protótipos',
              'Design system',
              'API de pagamentos',
              'App mobile',
              'Integração com bancos',
              'Suporte',
              'Campanha',
              'Lançamento',
            ],
          });
          var e = tx({
            es: ['Producto', 'Diseño', 'Ingeniería', 'Marketing'],
            en: ['Product', 'Design', 'Engineering', 'Marketing'],
            pt: ['Produto', 'Design', 'Engenharia', 'Marketing'],
          });
          return [
            { tarea: t[0], inicio: '2026-01-12', fin: '2026-02-27', equipo: e[0] },
            { tarea: t[1], inicio: '2026-02-16', fin: '2026-03-13', equipo: e[0] },
            { tarea: t[2], inicio: '2026-07-06', fin: '2026-08-07', equipo: e[0] },
            { tarea: t[3], inicio: '2026-08-24', equipo: e[0] },
            { tarea: t[4], inicio: '2026-03-02', fin: '2026-04-10', equipo: e[1] },
            { tarea: t[5], inicio: '2026-04-06', fin: '2026-05-22', equipo: e[1] },
            { tarea: t[6], inicio: '2026-04-13', fin: '2026-06-26', equipo: e[2] },
            { tarea: t[7], inicio: '2026-05-04', fin: '2026-08-28', equipo: e[2] },
            { tarea: t[8], inicio: '2026-07-01', fin: '2026-08-21', equipo: e[2] },
            { tarea: t[9], inicio: '2026-09-14', fin: '2026-12-18', equipo: e[2] },
            { tarea: t[10], inicio: '2026-09-01', fin: '2026-10-09', equipo: e[3] },
            { tarea: t[11], inicio: '2026-09-15', equipo: e[3] },
          ];
        })(),
        xAxis: { field: 'inicio', type: 'time' },
        series: [
          {
            type: 'timeline',
            field: 'tarea',
            end: 'fin',
            group: 'equipo',
            name: tx({ es: 'Plan', en: 'Plan', pt: 'Plano' }),
            today: '2026-10-25',
          },
        ],
      },
    },
    {
      id: 'precios',
      tipo: 'LozCandle',
      clase: tx({ es: 'Velas', en: 'Candlesticks', pt: 'Candles' }),
      familia: TIEMPO,
      desc: tx({
        es: 'Cada vela es un día. El cuerpo va de la apertura al cierre, hueco si el precio subió y relleno si bajó, y la mecha llega al máximo y al mínimo.',
        en: 'Each candle is one day. The body runs from open to close, hollow if the price went up and filled if it went down, and the wick reaches the high and the low.',
        pt: 'Cada candle é um dia. O corpo vai da abertura ao fechamento, vazado se o preço subiu e preenchido se caiu, e o pavio chega à máxima e à mínima.',
      }),
      opciones: {
        title: tx({
          es: 'AURF perdió casi un 9 % en tres semanas',
          en: 'AURF lost almost 9% in three weeks',
          pt: 'AURF caiu quase 9% em três semanas',
        }),
        subtitle: tx({
          es: 'Precio diario de la acción en dólares, septiembre y octubre de 2026',
          en: 'Daily share price in dollars, September and October 2026',
          pt: 'Preço diário da ação em dólares, setembro e outubro de 2026',
        }),
        data: precios,
        xAxis: { field: 'fecha', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'candlestick', field: 'cierre', open: 'apertura', high: 'maximo', low: 'minimo', name: 'AURF' }],
      },
    },
    {
      id: 'categorias',
      tipo: 'LozDonut',
      clase: tx({ es: 'Dona', en: 'Donut', pt: 'Rosca' }),
      familia: PARTES,
      desc: tx({
        es: 'Una dona va bien con pocas partes que suman un todo. Si hay más de cinco, o dos parecidas que importa distinguir, unas barras se leen mejor.',
        en: 'A donut works well with a few parts that add up to a whole. With more than five, or two similar ones you need to tell apart, bars read better.',
        pt: 'Uma rosca funciona bem com poucas partes que somam um todo. Se forem mais de cinco, ou duas parecidas que importa distinguir, barras se leem melhor.',
      }),
      opciones: {
        title: tx({
          es: 'Los buscadores traen más pedidos que las redes y el correo juntos',
          en: 'Search engines bring in more orders than social and email combined',
          pt: 'Os buscadores trazem mais pedidos que as redes sociais e o e-mail juntos',
        }),
        subtitle: tx({
          es: 'Pedidos en línea según por dónde llegó el cliente, octubre de 2026',
          en: 'Online orders by how the customer arrived, October 2026',
          pt: 'Pedidos online por onde o cliente chegou, outubro de 2026',
        }),
        data: filas(
          junto(
            tx({
              es: ['Búsqueda', 'Directo', 'Redes', 'Correo', 'Referidos'],
              en: ['Search', 'Direct', 'Social', 'Email', 'Referrals'],
              pt: ['Busca', 'Direto', 'Redes sociais', 'E-mail', 'Indicações'],
            }),
            [4120, 2010, 1790, 1220, 880],
          ),
          ['canal', 'pedidos'],
        ),
        xAxis: { field: 'canal' },
        series: [{ type: 'donut', field: 'pedidos', name: tx({ es: 'Pedidos', en: 'Orders', pt: 'Pedidos' }) }],
      },
    },
    {
      id: 'productos',
      tipo: 'LozTreemap',
      clase: tx({ es: 'Rectángulos (treemap)', en: 'Treemap', pt: 'Retângulos (treemap)' }),
      familia: PARTES,
      tamano: 'grande',
      desc: tx({
        es: 'Cada rectángulo ocupa tanto como vende su producto, y los de una misma categoría quedan juntos. Rinde cuando hay muchas partes y además una jerarquía.',
        en: 'Each rectangle takes up as much room as its product sells, and products in the same category sit together. It shines when there are many parts and a hierarchy too.',
        pt: 'Cada retângulo ocupa tanto quanto o produto vende, e os da mesma categoria ficam juntos. Rende quando há muitas partes e, além disso, uma hierarquia.',
      }),
      opciones: {
        title: tx({
          es: 'Electrónica vende más que todo lo demás junto',
          en: 'Electronics outsells everything else combined',
          pt: 'Eletrônicos vendem mais que todo o resto junto',
        }),
        subtitle: tx({
          es: 'Ventas de 2026 por producto y categoría, en dólares',
          en: '2026 sales by product and category, in dollars',
          pt: 'Vendas de 2026 por produto e categoria, em dólares',
        }),
        data: (function () {
          var c = tx({
            es: ['Electrónica', 'Hogar', 'Moda', 'Deportes'],
            en: ['Electronics', 'Home', 'Fashion', 'Sports'],
            pt: ['Eletrônicos', 'Casa', 'Moda', 'Esportes'],
          });
          return filas(
            junto(
              tx({
                es: [
                  'Laptops',
                  'Teléfonos',
                  'Tabletas',
                  'Audífonos',
                  'Sofás',
                  'Colchones',
                  'Cocina',
                  'Zapatillas',
                  'Chaquetas',
                  'Bicicletas',
                  'Camping',
                ],
                en: [
                  'Laptops',
                  'Phones',
                  'Tablets',
                  'Headphones',
                  'Sofas',
                  'Mattresses',
                  'Kitchen',
                  'Sneakers',
                  'Jackets',
                  'Bikes',
                  'Camping',
                ],
                pt: [
                  'Notebooks',
                  'Celulares',
                  'Tablets',
                  'Fones de ouvido',
                  'Sofás',
                  'Colchões',
                  'Cozinha',
                  'Tênis',
                  'Jaquetas',
                  'Bicicletas',
                  'Camping',
                ],
              }),
              [
                [c[0], 420000],
                [c[0], 380000],
                [c[0], 142000],
                [c[0], 96000],
                [c[1], 210000],
                [c[1], 168000],
                [c[1], 88000],
                [c[2], 176000],
                [c[2], 122000],
                [c[3], 134000],
                [c[3], 61000],
              ],
            ),
            ['producto', 'categoria', 'ventas'],
          );
        })(),
        xAxis: { field: 'producto' },
        yAxis: { format: 'currency' },
        series: [
          {
            type: 'treemap',
            field: 'ventas',
            name: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }),
            group: 'categoria',
          },
        ],
      },
    },
    {
      id: 'mercados',
      tipo: 'LozSunburst',
      clase: tx({ es: 'Anillos (sunburst)', en: 'Sunburst', pt: 'Anéis (sunburst)' }),
      familia: PARTES,
      desc: tx({
        es: 'Del centro hacia afuera: región, país y ciudad. Pasa el puntero por una ciudad y se ilumina su camino hasta el centro.',
        en: 'From the center out: region, country and city. Hover over a city and its path to the center lights up.',
        pt: 'Do centro para fora: região, país e cidade. Passe o ponteiro sobre uma cidade e o caminho dela até o centro se ilumina.',
      }),
      opciones: {
        title: tx({
          es: 'Casi un tercio de las ventas sale de México',
          en: 'Almost a third of sales come from Mexico',
          pt: 'Quase um terço das vendas vem do México',
        }),
        subtitle: tx({
          es: 'Ventas de 2026 por región, país y ciudad, en dólares',
          en: '2026 sales by region, country and city, in dollars',
          pt: 'Vendas de 2026 por região, país e cidade, em dólares',
        }),
        data: filas(
          [
            [L.america, L.mexico, L.cdmx, 412000],
            [L.america, L.mexico, 'Monterrey', 182000],
            [L.america, L.mexico, 'Guadalajara', 154000],
            [L.america, 'Colombia', 'Bogotá', 236000],
            [L.america, 'Colombia', 'Medellín', 118000],
            [L.america, 'Argentina', 'Buenos Aires', 205000],
            [L.america, 'Chile', 'Santiago', 141000],
            [L.america, L.peru, 'Lima', 126000],
            [L.europa, L.espana, 'Madrid', 248000],
            [L.europa, L.espana, 'Barcelona', 197000],
            [L.europa, 'Portugal', L.lisboa, 92000],
            [L.europa, L.francia, L.paris, 134000],
            [L.asia, L.japon, L.tokio, 158000],
            [L.asia, L.corea, L.seul, 87000],
          ],
          ['region', 'pais', 'ciudad', 'ventas'],
        ),
        xAxis: { field: 'ciudad' },
        yAxis: { format: 'currency' },
        series: [
          {
            type: 'sunburst',
            field: 'ventas',
            name: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }),
            levels: ['region', 'pais', 'ciudad'],
          },
        ],
      },
    },
    {
      id: 'meta',
      tipo: 'LozGauge',
      clase: tx({ es: 'Medidor', en: 'Gauge', pt: 'Medidor' }),
      familia: PARTES,
      desc: tx({
        es: 'Un número contra su meta, para lo primero que se ve en un tablero. Si son varios números, un gráfico de metas (bala) ocupa menos y los compara mejor.',
        en: 'One number against its goal, for the first thing people see on a dashboard. For several numbers, a bullet chart takes less room and compares them better.',
        pt: 'Um número contra a meta, para a primeira coisa que se vê em um painel. Se forem vários números, um gráfico de metas (bullet) ocupa menos espaço e compara melhor.',
      }),
      opciones: {
        title: tx({
          es: 'Siete puntos por debajo de lo previsto',
          en: 'Seven points behind plan',
          pt: 'Sete pontos abaixo do previsto',
        }),
        subtitle: tx({
          es: 'Avance de la meta de ventas del año a octubre. La marca es donde deberíamos ir.',
          en: 'Progress toward this year’s sales goal through October. The marker is where we should be.',
          pt: 'Progresso da meta de vendas do ano até outubro. A marca é onde deveríamos estar.',
        }),
        data: [{ mes: tx({ es: 'Octubre', en: 'October', pt: 'Outubro' }), avance: 0.78 }],
        xAxis: { field: 'mes' },
        yAxis: { format: 'percent', min: 0, max: 1 },
        series: [{ type: 'gauge', field: 'avance', name: tx({ es: 'Avance', en: 'Progress', pt: 'Progresso' }), target: 0.85 }],
      },
    },
    {
      id: 'embudo',
      tipo: 'LozFunnel',
      clase: tx({ es: 'Embudo', en: 'Funnel', pt: 'Funil' }),
      familia: PARTES,
      desc: tx({
        es: 'Los pasos van uno debajo del otro, con lo que se pierde entre cada uno. Las barras son rectas y no trapecios porque los largos se comparan mejor que las formas.',
        en: 'The steps go one below the other, with what gets lost between each one. The bars are straight, not trapezoids, because lengths are easier to compare than shapes.',
        pt: 'As etapas vêm uma embaixo da outra, com o que se perde entre cada uma. As barras são retas e não trapézios porque comprimentos se comparam melhor que formas.',
      }),
      opciones: {
        title: tx({
          es: 'Solo el 5 % de las visitas termina en una compra',
          en: 'Only 5% of visits end in a purchase',
          pt: 'Só 5% das visitas terminam em compra',
        }),
        subtitle: tx({
          es: 'Visitas de octubre de 2026 en cada paso de la compra',
          en: 'October 2026 visits at each step of checkout',
          pt: 'Visitas de outubro de 2026 em cada etapa da compra',
        }),
        data: filas(
          junto(
            tx({
              es: ['Visitas', 'Vieron un producto', 'Agregaron al carrito', 'Iniciaron el pago', 'Compraron'],
              en: ['Visits', 'Viewed a product', 'Added to cart', 'Started checkout', 'Purchased'],
              pt: ['Visitas', 'Viram um produto', 'Adicionaram ao carrinho', 'Iniciaram o pagamento', 'Compraram'],
            }),
            [48210, 21400, 6830, 3120, 2540],
          ),
          ['paso', 'sesiones'],
        ),
        xAxis: { field: 'paso' },
        series: [{ type: 'funnel', field: 'sesiones', name: tx({ es: 'Visitas', en: 'Visits', pt: 'Visitas' }) }],
      },
    },
    {
      id: 'tiendas',
      tipo: 'LozBubble',
      clase: tx({ es: 'Burbujas', en: 'Bubbles', pt: 'Bolhas' }),
      familia: RELACIONES,
      tamano: 'grande',
      desc: tx({
        es: 'Tres medidas en un punto: ventas a lo ancho, margen a lo alto y clientes en el tamaño. Lo que crece con el valor es el área de la burbuja, no su radio.',
        en: 'Three measures in one point: sales across, margin up and down, and customers in the size. What grows with the value is the bubble’s area, not its radius.',
        pt: 'Três medidas em um ponto: vendas na horizontal, margem na vertical e clientes no tamanho. O que cresce com o valor é a área da bolha, não o raio.',
      }),
      opciones: {
        title: tx({
          es: 'Las tiendas grandes venden más, pero con menos margen',
          en: 'Big stores sell more, but at a lower margin',
          pt: 'As lojas grandes vendem mais, mas com margem menor',
        }),
        subtitle: tx({
          es: 'Nueve tiendas en 2026. El tamaño de cada burbuja es su cantidad de clientes.',
          en: 'Nine stores in 2026. The size of each bubble is its number of customers.',
          pt: 'Nove lojas em 2026. O tamanho de cada bolha é a quantidade de clientes.',
        }),
        // Una serie por zona: el campo de la zona es su margen y 'c' + zona, sus clientes.
        data: filas(
          [
            [0.6, 0.39, 1200, zonas[2]],
            [0.9, 0.35, 2400, zonas[1]],
            [1.2, 0.31, 3800, zonas[1]],
            [1.4, 0.26, 2100, zonas[2]],
            [1.7, 0.29, 4100, zonas[0]],
            [2.2, 0.34, 5200, zonas[0]],
            [2.8, 0.28, 7600, zonas[1]],
            [3.1, 0.31, 8100, zonas[2]],
            [3.6, 0.24, 9800, zonas[0]],
          ],
          ['ventas', 'margen', 'clientes', 'zona'],
        ).map(function (t) {
          var o = { ventas: t.ventas };
          o[t.zona] = t.margen;
          o['c' + t.zona] = t.clientes;
          return o;
        }),
        xAxis: {
          field: 'ventas',
          type: 'linear',
          title: tx({ es: 'Ventas (millones de dólares)', en: 'Sales (millions of dollars)', pt: 'Vendas (milhões de dólares)' }),
        },
        yAxis: { format: 'percent', title: tx({ es: 'Margen bruto', en: 'Gross margin', pt: 'Margem bruta' }) },
        series: zonas.map(function (z, i) {
          return {
            type: 'bubble',
            field: z,
            size: 'c' + z,
            sizeName: tx({ es: 'Clientes', en: 'Customers', pt: 'Clientes' }),
            name: nombresZona[i],
          };
        }),
      },
    },
    {
      id: 'modelos',
      tipo: 'LozRadar',
      clase: 'Radar',
      familia: RELACIONES,
      desc: tx({
        es: 'Compara dos o tres perfiles con los mismos criterios. Con más perfiles se vuelve una maraña, y ahí conviene un panel pequeño por cada una.',
        en: 'It compares two or three profiles on the same criteria. With more profiles it turns into a tangle, and then small multiples, one panel each, work better.',
        pt: 'Compara dois ou três perfis com os mesmos critérios. Com mais perfis vira um emaranhado, e aí vale mais um gráfico pequeno para cada um.',
      }),
      opciones: {
        title: tx({
          es: 'El modelo B gana en cámara y velocidad, pero cuesta más',
          en: 'Model B wins on camera and speed, but costs more',
          pt: 'O modelo B ganha em câmera e velocidade, mas custa mais',
        }),
        subtitle: tx({
          es: 'Puntaje de 0 a 10 en seis pruebas; en precio, 10 es el más barato',
          en: 'Score from 0 to 10 on six tests; for price, 10 is the cheapest',
          pt: 'Nota de 0 a 10 em seis testes; em preço, 10 é o mais barato',
        }),
        data: filas(
          junto(
            tx({
              es: ['Batería', 'Cámara', 'Pantalla', 'Precio', 'Velocidad', 'Diseño'],
              en: ['Battery', 'Camera', 'Screen', 'Price', 'Speed', 'Design'],
              pt: ['Bateria', 'Câmera', 'Tela', 'Preço', 'Velocidade', 'Design'],
            }),
            [
              [8, 6],
              [7, 9],
              [8, 8],
              [9, 5],
              [6, 9],
              [7, 8],
            ],
          ),
          ['criterio', 'a', 'b'],
        ),
        xAxis: { field: 'criterio' },
        yAxis: { min: 0, max: 10 },
        series: [
          { type: 'radar', field: 'a', name: tx({ es: 'Modelo A', en: 'Model A', pt: 'Modelo A' }) },
          { type: 'radar', field: 'b', name: tx({ es: 'Modelo B', en: 'Model B', pt: 'Modelo B' }) },
        ],
      },
    },
    {
      id: 'visitas-hora',
      tipo: 'LozHeatmap',
      clase: tx({ es: 'Mapa de calor', en: 'Heatmap', pt: 'Mapa de calor' }),
      familia: RELACIONES,
      tamano: 'grande',
      desc: tx({
        es: 'Siete días por veinticuatro horas son 168 números. Pintados en una rejilla, el patrón aparece antes de leer cualquier cifra.',
        en: 'Seven days times twenty-four hours is 168 numbers. Painted on a grid, the pattern shows up before you read a single figure.',
        pt: 'Sete dias vezes vinte e quatro horas são 168 números. Pintados em uma grade, o padrão aparece antes de você ler qualquer número.',
      }),
      opciones: {
        title: tx({
          es: 'Las visitas tocan techo a media tarde',
          en: 'Visits peak in the middle of the afternoon',
          pt: 'As visitas chegam ao pico no meio da tarde',
        }),
        subtitle: tx({
          es: 'Visitas por hora en una semana típica de octubre',
          en: 'Visits per hour in a typical October week',
          pt: 'Visitas por hora em uma semana típica de outubro',
        }),
        data: visitasHora,
        xAxis: { field: 'hora' },
        series: [{ type: 'heatmap', field: 'visitas', name: tx({ es: 'Visitas', en: 'Visits', pt: 'Visitas' }), y: 'dia' }],
      },
    },
    {
      id: 'equipo',
      tipo: 'LozNetwork',
      clase: tx({ es: 'Red', en: 'Network', pt: 'Rede' }),
      familia: RELACIONES,
      desc: tx({
        es: 'Cada línea une a dos personas que se escriben, más gruesa cuantos más mensajes. Quien conecta dos áreas queda entre ellas.',
        en: 'Each line joins two people who message each other, thicker the more messages they send. Whoever connects two teams ends up between them.',
        pt: 'Cada linha une duas pessoas que trocam mensagens, mais grossa quanto mais mensagens. Quem conecta duas áreas fica entre elas.',
      }),
      opciones: {
        title: tx({
          es: 'Cada área habla sobre todo consigo misma',
          en: 'Each team mostly talks to itself',
          pt: 'Cada área conversa principalmente consigo mesma',
        }),
        subtitle: tx({
          es: 'Mensajes por semana entre doce personas de cuatro áreas',
          en: 'Messages per week among twelve people on four teams',
          pt: 'Mensagens por semana entre doze pessoas de quatro áreas',
        }),
        data: (function () {
          var a = tx({
            es: ['Diseño', 'Datos', 'Ventas', 'Soporte'],
            en: ['Design', 'Data', 'Sales', 'Support'],
            pt: ['Design', 'Dados', 'Vendas', 'Suporte'],
          });
          return filas(
            [
              ['Luis', 'Ana', 18, a[0]],
              ['Ana', 'Marta', 11, a[0]],
              ['Marta', 'Luis', 7, a[0]],
              ['Ana', 'Pedro', 6, a[0]],
              ['Pedro', 'Sofía', 21, a[1]],
              ['Pedro', 'Jorge', 13, a[1]],
              ['Jorge', 'Sofía', 9, a[1]],
              ['Sofía', 'Elena', 4, a[1]],
              ['Carla', 'Elena', 16, a[2]],
              ['Elena', 'Raúl', 12, a[2]],
              ['Raúl', 'Carla', 8, a[2]],
              ['Carla', 'Marta', 3, a[2]],
              ['Tomás', 'Inés', 14, a[3]],
              ['Inés', 'Raúl', 5, a[3]],
              ['Tomás', 'Jorge', 4, a[3]],
              ['Inés', 'Bruno', 10, a[3]],
              ['Bruno', 'Tomás', 6, a[3]],
            ],
            ['persona', 'con', 'mensajes', 'area'],
          );
        })(),
        xAxis: { field: 'persona' },
        series: [
          {
            type: 'network',
            field: 'mensajes',
            name: tx({ es: 'Mensajes', en: 'Messages', pt: 'Mensagens' }),
            to: 'con',
            group: 'area',
          },
        ],
      },
    },
    {
      id: 'recorrido',
      tipo: 'LozSankey',
      clase: tx({ es: 'Flujos (sankey)', en: 'Sankey', pt: 'Fluxos (sankey)' }),
      familia: FLUJOS,
      tamano: 'grande',
      desc: tx({
        es: 'Se lee de izquierda a derecha: de dónde llegan las visitas, por qué páginas pasan y cómo terminan. El grosor de cada flujo es la cantidad de visitas.',
        en: 'Read it from left to right: where visits come from, which pages they go through and how they end. The thickness of each flow is the number of visits.',
        pt: 'Lê-se da esquerda para a direita: de onde vêm as visitas, por quais páginas passam e como terminam. A espessura de cada fluxo é a quantidade de visitas.',
      }),
      opciones: {
        title: tx({
          es: 'La mayoría ve un producto y se va sin comprar',
          en: 'Most people view a product and leave without buying',
          pt: 'A maioria vê um produto e vai embora sem comprar',
        }),
        subtitle: tx({
          es: 'Visitas de octubre de 2026, desde que llegan hasta que se van',
          en: 'October 2026 visits, from the moment they arrive until they leave',
          pt: 'Visitas de outubro de 2026, da chegada até a saída',
        }),
        data: filas(
          [
            [paso.busqueda, paso.inicio, 5200],
            [paso.busqueda, paso.producto, 7400],
            [paso.redes, paso.inicio, 2600],
            [paso.redes, paso.ofertas, 3100],
            [paso.correo, paso.ofertas, 2200],
            [paso.directo, paso.inicio, 4300],
            [paso.inicio, paso.producto, 6900],
            [paso.inicio, paso.abandono, 5200],
            [paso.ofertas, paso.producto, 3800],
            [paso.ofertas, paso.abandono, 1500],
            [paso.producto, paso.compra, 6100],
            [paso.producto, paso.abandono, 12000],
          ],
          ['origen', 'destino', 'sesiones'],
        ),
        xAxis: { field: 'origen' },
        series: [{ type: 'sankey', field: 'sesiones', name: tx({ es: 'Visitas', en: 'Visits', pt: 'Visitas' }), to: 'destino' }],
      },
    },
    {
      id: 'mudanzas',
      tipo: 'LozChord',
      clase: tx({ es: 'Cuerdas', en: 'Chord diagram', pt: 'Cordas' }),
      familia: FLUJOS,
      desc: tx({
        es: 'Las cuerdas muestran idas y vueltas entre los mismos lugares. Cada cinta tiene el color de la región de donde se fue la gente.',
        en: 'Chords show the back and forth between the same places. Each ribbon takes the color of the region people moved away from.',
        pt: 'As cordas mostram idas e vindas entre os mesmos lugares. Cada faixa tem a cor da região de onde as pessoas saíram.',
      }),
      opciones: {
        title: tx({
          es: 'De la capital se va más gente de la que llega',
          en: 'More people leave the capital than move in',
          pt: 'Sai mais gente da capital do que chega',
        }),
        subtitle: tx({
          es: 'Mudanzas entre regiones en 2025, en miles de personas',
          en: 'Moves between regions in 2025, in thousands of people',
          pt: 'Mudanças entre regiões em 2025, em milhares de pessoas',
        }),
        data: filas(
          [
            [zona.capital, zona.centro, 182],
            [zona.centro, zona.capital, 96],
            [zona.capital, zona.costa, 74],
            [zona.costa, zona.capital, 58],
            [zona.norte, zona.capital, 71],
            [zona.capital, zona.norte, 39],
            [zona.sur, zona.centro, 64],
            [zona.centro, zona.sur, 41],
            [zona.costa, zona.sur, 33],
            [zona.norte, zona.costa, 27],
            [zona.sur, zona.capital, 52],
            [zona.centro, zona.norte, 22],
          ],
          ['origen', 'destino', 'personas'],
        ),
        xAxis: { field: 'origen' },
        series: [{ type: 'chord', field: 'personas', name: tx({ es: 'Personas', en: 'People', pt: 'Pessoas' }), to: 'destino' }],
      },
    },
    {
      id: 'tiendas-mapa',
      tipo: 'LozMap',
      clase: tx({ es: 'Mapa de burbujas', en: 'Bubble map', pt: 'Mapa de bolhas' }),
      familia: FLUJOS,
      tamano: 'grande',
      desc: tx({
        es: 'Una burbuja por ciudad, en su lugar del mapa. El tamaño da el orden de magnitud; el valor exacto aparece al pasar el puntero.',
        en: 'One bubble per city, in its spot on the map. The size gives you the order of magnitude; the exact value shows up when you hover.',
        pt: 'Uma bolha por cidade, no seu lugar do mapa. O tamanho dá a ordem de grandeza; o valor exato aparece ao passar o ponteiro.',
      }),
      opciones: {
        title: tx({
          es: 'São Paulo ya vende más que Ciudad de México',
          en: 'São Paulo now outsells Mexico City',
          pt: 'São Paulo já vende mais que a Cidade do México',
        }),
        subtitle: tx({
          es: 'Ventas de octubre de 2026 por ciudad, en miles de dólares',
          en: 'October 2026 sales by city, in thousands of dollars',
          pt: 'Vendas de outubro de 2026 por cidade, em milhares de dólares',
        }),
        data: [
          { ciudad: L.cdmx, lat: 19.43, lon: -99.13, ventas: 4200 },
          { ciudad: 'Bogotá', lat: 4.71, lon: -74.07, ventas: 2600 },
          { ciudad: 'Lima', lat: -12.05, lon: -77.04, ventas: 1900 },
          { ciudad: 'Santiago', lat: -33.45, lon: -70.67, ventas: 1500 },
          { ciudad: 'Buenos Aires', lat: -34.6, lon: -58.38, ventas: 3100 },
          { ciudad: 'São Paulo', lat: -23.55, lon: -46.63, ventas: 5200 },
          { ciudad: 'Madrid', lat: 40.42, lon: -3.7, ventas: 2800 },
          { ciudad: 'Miami', lat: 25.76, lon: -80.19, ventas: 3600 },
        ],
        xAxis: { field: 'ciudad' },
        series: [
          { type: 'mapbubble', field: 'ventas', name: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }), lat: 'lat', lon: 'lon' },
        ],
      },
    },
    {
      id: 'paises',
      tipo: 'LozMap',
      clase: tx({ es: 'Mapa coloreado', en: 'Filled map', pt: 'Mapa colorido' }),
      familia: FLUJOS,
      desc: tx({
        es: 'Cada país con datos se pinta según su valor y los demás quedan en gris. La forma de mapa que trae de entrada respeta las áreas, así ningún país parece más grande de lo que es.',
        en: 'Each country with data is shaded by its value and the rest stay gray. The default map shape keeps areas true, so no country looks bigger than it really is.',
        pt: 'Cada país com dados é pintado conforme o valor e os outros ficam em cinza. O formato de mapa padrão respeita as áreas, então nenhum país parece maior do que é.',
      }),
      opciones: {
        title: tx({
          es: 'Brasil y México suman más de la mitad de los usuarios',
          en: 'Brazil and Mexico account for more than half the users',
          pt: 'Brasil e México somam mais da metade dos usuários',
        }),
        subtitle: tx({
          es: 'Usuarios activos en América Latina, octubre de 2026',
          en: 'Active users in Latin America, October 2026',
          pt: 'Usuários ativos na América Latina, outubro de 2026',
        }),
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
        series: [
          { type: 'choropleth', field: 'usuarios', name: tx({ es: 'Usuarios', en: 'Users', pt: 'Usuários' }), fit: 'data' },
        ],
      },
    },
    {
      id: 'globo',
      tipo: 'LozMap',
      clase: tx({ es: 'Mapa en globo', en: 'Globe map', pt: 'Mapa em globo' }),
      familia: FLUJOS,
      tamano: 'ancho',
      desc: tx({
        es: 'En un globo las distancias se ven como son: Madrid queda al otro lado del océano y no estirado en una esquina, como en un mapa plano. Para comparar países conviene el mapa de áreas iguales; el globo sirve cuando importa dónde queda cada cosa y qué tan lejos.',
        en: 'On a globe, distances look the way they are: Madrid sits across the ocean instead of stretched out in a corner, as on a flat map. To compare countries, use the equal-area map; the globe helps when what matters is where things are and how far apart.',
        pt: 'Em um globo as distâncias aparecem como são: Madri fica do outro lado do oceano, e não esticada num canto, como em um mapa plano. Para comparar países, use o mapa de áreas iguais; o globo serve quando importa onde cada coisa fica e a que distância.',
      }),
      // La galería y la página del ejemplo lo hacen girar con girarGlobo(): entra girando, frena
      // sobre `destino` ([longitud, latitud]) y dibuja encima los arcos de `rutas`. `titulo` encabeza
      // la lista de envíos (rutasGlobo).
      globo: {
        destino: [-66, -6],
        origen: { nombre: L.cdmx, lon: -99.13, lat: 19.43 },
        titulo: tx({
          es: 'Envíos desde Ciudad de México',
          en: 'Shipments from Mexico City',
          pt: 'Envios saindo da Cidade do México',
        }),
        rutas: [
          { nombre: 'Bogotá', lon: -74.07, lat: 4.71, envios: 1390 },
          { nombre: 'São Paulo', lon: -46.63, lat: -23.55, envios: 980 },
          { nombre: 'Lima', lon: -77.04, lat: -12.05, envios: 610, izq: true },
          { nombre: 'Buenos Aires', lon: -58.38, lat: -34.6, envios: 540 },
          { nombre: tx({ es: 'Madrid', en: 'Madrid', pt: 'Madri' }), lon: -3.7, lat: 40.42, envios: 460 },
          { nombre: 'Santiago', lon: -70.67, lat: -33.45, envios: 420, izq: true },
        ],
      },
      opciones: {
        title: tx({
          es: 'Madrid es el único envío que cruza el océano, y ya pide más que Santiago',
          en: 'Madrid is the only shipment that crosses the ocean, and it already orders more than Santiago',
          pt: 'Madri é o único envio que cruza o oceano, e já pede mais que Santiago',
        }),
        subtitle: tx({
          es: 'Envíos de octubre de 2026 desde Ciudad de México (arcos) y clientes por país (color)',
          en: 'October 2026 shipments from Mexico City (arcs) and customers by country (color)',
          pt: 'Envios de outubro de 2026 saindo da Cidade do México (arcos) e clientes por país (cor)',
        }),
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
        series: [
          {
            type: 'choropleth',
            field: 'clientes',
            name: tx({ es: 'Clientes', en: 'Customers', pt: 'Clientes' }),
            projection: 'orthographic',
            rotate: [-66, -6],
          },
        ],
      },
    },
  ];

  // Los nombres de los campos, en el idioma de la página: salen en el código que se copia.
  // En español quedan como están; en portugués, sin acentos. Los campos que son a la vez nombres
  // visibles (ciudades, regiones, zonas) ya vienen traducidos y no pasan por aquí.
  var CAMPOS = {
    mes: { en: 'month', pt: 'mes' },
    tienda: { en: 'store', pt: 'loja' },
    meta: { en: 'goal', pt: 'meta' },
    fecha: { en: 'date', pt: 'dia' },
    apertura: { en: 'open', pt: 'abertura' },
    maximo: { en: 'high', pt: 'maxima' },
    minimo: { en: 'low', pt: 'minima' },
    cierre: { en: 'close', pt: 'fechamento' },
    hora: { en: 'hour', pt: 'hora' },
    dia: { en: 'day', pt: 'dia' },
    visitas: { en: 'visits', pt: 'visitas' },
    pagina: { en: 'page', pt: 'pagina' },
    paso: { en: 'step', pt: 'etapa' },
    monto: { en: 'amount', pt: 'valor' },
    region: { en: 'region', pt: 'regiao' },
    ventas: { en: 'sales', pt: 'vendas' },
    palabra: { en: 'word', pt: 'palavra' },
    menciones: { en: 'mentions', pt: 'mencoes' },
    tema: { en: 'topic', pt: 'tema' },
    movil: { en: 'mobile', pt: 'celular' },
    escritorio: { en: 'desktop', pt: 'desktop' },
    tableta: { en: 'tablet', pt: 'tablet' },
    tasa: { en: 'rate', pt: 'taxa' },
    tarea: { en: 'task', pt: 'tarefa' },
    inicio: { en: 'start', pt: 'inicio' },
    fin: { en: 'end', pt: 'fim' },
    equipo: { en: 'team', pt: 'equipe' },
    canal: { en: 'channel', pt: 'canal' },
    pedidos: { en: 'orders', pt: 'pedidos' },
    producto: { en: 'product', pt: 'produto' },
    categoria: { en: 'category', pt: 'categoria' },
    pais: { en: 'country', pt: 'pais' },
    ciudad: { en: 'city', pt: 'cidade' },
    avance: { en: 'progress', pt: 'progresso' },
    sesiones: { en: 'sessions', pt: 'sessoes' },
    criterio: { en: 'criterion', pt: 'criterio' },
    persona: { en: 'person', pt: 'pessoa' },
    con: { en: 'with', pt: 'com' },
    mensajes: { en: 'messages', pt: 'mensagens' },
    area: { en: 'team', pt: 'area' },
    origen: { en: 'source', pt: 'origem' },
    destino: { en: 'target', pt: 'destino' },
    personas: { en: 'people', pt: 'pessoas' },
    usuarios: { en: 'users', pt: 'usuarios' },
    clientes: { en: 'customers', pt: 'clientes' },
  };
  // Opciones de serie cuyo valor es el nombre de un campo (ver SeriesOptions en src/types.ts).
  var NOMBRAN_CAMPO = [
    'field',
    'size',
    'y',
    'group',
    'to',
    'end',
    'label',
    'total',
    'targetField',
    'lat',
    'lon',
    'open',
    'high',
    'low',
  ];

  /** Cambia los campos de un ejemplo al idioma de la página: las claves de las filas y las opciones que los nombran. */
  function traducirCampos(o) {
    var campo = function (k) {
      return CAMPOS[k] ? CAMPOS[k][IDIOMA] : k;
    };
    o.data = o.data.map(function (fila) {
      var n = {};
      for (var k in fila) n[campo(k)] = fila[k];
      return n;
    });
    if (o.xAxis && o.xAxis.field) o.xAxis = Object.assign({}, o.xAxis, { field: campo(o.xAxis.field) });
    o.series = o.series.map(function (s) {
      var c = Object.assign({}, s);
      NOMBRAN_CAMPO.forEach(function (p) {
        if (typeof c[p] === 'string') c[p] = campo(c[p]);
      });
      if (c.levels) c.levels = c.levels.map(campo);
      return c;
    });
  }
  if (IDIOMA !== 'es')
    window.EJEMPLOS.forEach(function (ej) {
      traducirCampos(ej.opciones);
    });

  /** Los mapas necesitan el mapa del mundo (siteMapa) antes de dibujarse. */
  window.esMapa = function (ej) {
    return ej.opciones.series.some(function (s) {
      return s.type === 'choropleth' || s.type === 'mapbubble';
    });
  };

  /** La lista de envíos del globo: lo que dicen los arcos, en texto (también para el lector de pantalla). */
  window.rutasGlobo = function (ej) {
    var g = ej.globo;
    var nf = new Intl.NumberFormat(LOCALE);
    var caja = document.createElement('div');
    caja.className = 'globo-rutas';
    var t = document.createElement('p');
    t.className = 'globo-rutas-titulo';
    t.textContent = g.titulo;
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
    var oeste = boton(
      '←',
      tx({ es: 'Girar el globo hacia el oeste', en: 'Turn the globe west', pt: 'Girar o globo para o oeste' }),
    );
    var este = boton(
      '→',
      tx({ es: 'Girar el globo hacia el este', en: 'Turn the globe east', pt: 'Girar o globo para o leste' }),
    );
    var volver = boton(tx({ es: 'Volver a Latinoamérica', en: 'Back to Latin America', pt: 'Voltar para a América Latina' }));
    volver.hidden = true;
    var pista = document.createElement('span');
    pista.className = 'globo-pista';
    pista.textContent = tx({ es: 'Arrástralo para girarlo', en: 'Drag to spin it', pt: 'Arraste para girar' });
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

  /** Crea el ejemplo en un elemento, con el tema y el idioma del sitio. */
  window.crearEjemplo = function (ej, el, extra) {
    // Sin fondo propio: el gráfico toma el de la página (o el de la tarjeta).
    var o = Object.assign({ background: false, locale: LOCALE }, ej.opciones, extra || {});
    var c = ej.multiples ? LozChart.multiples(el, o) : new LozChart(el, o);
    return window.siteChart ? window.siteChart(c) : c;
  };

  /** El id del elemento del gráfico en el código que se copia (también lo usa demo.js). */
  window.ID_GRAFICO = tx({ es: 'grafico', en: 'chart', pt: 'grafico' });

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
        var mas = tx({ es: n - 3 + ' filas más', en: n - 3 + ' more rows', pt: 'mais ' + (n - 3) + ' linhas' });
        return s.replace(/\n {2}\]$/, ',\n    // … ' + mas + '\n  ]');
      });
    var fn = ej.multiples ? 'LozChart.multiples' : 'new LozChart';
    return fn + "('#" + window.ID_GRAFICO + "', " + json + ');';
  };
})();
