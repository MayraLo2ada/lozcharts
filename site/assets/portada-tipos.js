/* Los 26 tipos en un bento, agrupados por la pregunta que responden. Cada gráfico se crea al
   acercarse a la pantalla y se vuelve a dibujar al pasarle el puntero. */
(function () {
  'use strict';
  var P = window.portada;
  var quieto = P.quieto;
  var ej = {};
  (window.EJEMPLOS || []).forEach(function (e) {
    ej[e.id] = e.opciones;
  });

  // ------------------------------------------------------------ Datos propios

  // Tres tipos que la galería no trae como ejemplo propio, con datos de ejemplo estables.
  var semilla = 19;
  var azar = function () {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  var MESES = [];
  for (var m = 1; m <= 12; m++) MESES.push('2026-' + String(m).padStart(2, '0'));
  // El campo del mes lo nombra la tabla para lectores de pantalla: va en el idioma de la página.
  var MES = tx({ es: 'mes', en: 'month', pt: 'mes' });
  var temperaturas = MESES.map(function (mes, i) {
    var base = 14 + 4 * Math.sin(((i - 2) / 12) * 2 * Math.PI);
    var fila = {};
    fila[MES] = mes;
    return Object.assign(fila, {
      max: Math.round((base + 6 + azar() * 2) * 10) / 10,
      min: Math.round((base - 5 - azar() * 2) * 10) / 10,
      media: Math.round(base * 10) / 10,
    });
  });
  var grados = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
  var estudio = [];
  for (var k = 0; k < 40; k++) {
    var h = Math.round((1 + azar() * 11) * 10) / 10;
    estudio.push({ horas: h, nota: Math.round(Math.min(10, 3.2 + h * 0.48 + (azar() - 0.5) * 2.6) * 10) / 10 });
  }
  var conTipo = function (id, cambio) {
    var o = Object.assign({}, ej[id]);
    o.series = o.series.map(function (s) {
      return Object.assign({}, s, cambio);
    });
    return o;
  };
  var PROPIOS = {
    rango: {
      data: temperaturas,
      xAxis: { field: MES, type: 'time' },
      yAxis: {
        format: function (v) {
          return grados.format(v) + ' °C';
        },
      },
      series: [
        {
          type: 'range',
          field: 'max',
          low: 'min',
          name: tx({ es: 'Mínima y máxima', en: 'Low and high', pt: 'Mínima e máxima' }),
        },
        { type: 'line', field: 'media', name: tx({ es: 'Media', en: 'Average', pt: 'Média' }), smooth: true },
      ],
    },
    dispersion: {
      data: estudio,
      xAxis: {
        field: 'horas',
        type: 'linear',
        title: tx({ es: 'Horas por semana', en: 'Hours per week', pt: 'Horas por semana' }),
      },
      yAxis: { title: tx({ es: 'Nota', en: 'Grade', pt: 'Nota' }) },
      series: [{ type: 'scatter', field: 'nota', name: tx({ es: 'Estudiantes', en: 'Students', pt: 'Estudantes' }) }],
    },
  };
  function fuente(clave) {
    if (clave === '*rango') return PROPIOS.rango;
    if (clave === '*dispersion') return PROPIOS.dispersion;
    if (clave === '*ohlc') return conTipo('precios', { type: 'ohlc' });
    if (clave === '*pie') return conTipo('categorias', { type: 'pie' });
    return ej[clave];
  }

  // ------------------------------------------------------------ Los grupos

  // [nombre, tipo, para qué sirve, datos, tamaño]. Los tamaños están puestos para que cada grupo
  // cierre sus filas de 12 columnas sin huecos (ver el plan en portada.css); t-ancha es la celda
  // que en 6 columnas (tableta) ocupa la fila entera para no dejar un hueco.
  var GRUPOS = [
    {
      pregunta: tx({ es: '¿Cómo cambió?', en: 'How did it change?', pt: 'Como mudou?' }),
      bajada: tx({
        es: 'Lo que pasa con el tiempo: meses, precios, un plan.',
        en: 'What happens over time: months, prices, a plan.',
        pt: 'O que acontece com o tempo: meses, preços, um plano.',
      }),
      tipos: [
        [
          tx({ es: 'Líneas', en: 'Lines', pt: 'Linhas' }),
          'line',
          tx({ es: 'Cómo cambia algo con el tiempo', en: 'How something changes over time', pt: 'Como algo muda com o tempo' }),
          'usuarios',
          'c-grande',
        ],
        [
          tx({ es: 'Área', en: 'Area', pt: 'Área' }),
          'area',
          tx({
            es: 'El volumen y de qué está hecho',
            en: 'The volume and what it’s made of',
            pt: 'O volume e do que ele é feito',
          }),
          'dispositivos',
          '',
        ],
        [
          tx({ es: 'Escalones', en: 'Steps', pt: 'Degraus' }),
          'step',
          tx({
            es: 'Lo que cambia de golpe: tarifas, tasas',
            en: 'What changes all at once: fees, rates',
            pt: 'O que muda de uma vez: tarifas, taxas',
          }),
          'tasa',
          '',
        ],
        [
          tx({ es: 'Rangos', en: 'Ranges', pt: 'Faixas' }),
          'range',
          tx({ es: 'Entre un mínimo y un máximo', en: 'Between a low and a high', pt: 'Entre um mínimo e um máximo' }),
          '*rango',
          '',
        ],
        [
          tx({ es: 'Velas', en: 'Candlesticks', pt: 'Candles' }),
          'candlestick',
          tx({
            es: 'Apertura, máximo, mínimo y cierre',
            en: 'Open, high, low, and close',
            pt: 'Abertura, máxima, mínima e fechamento',
          }),
          'precios',
          '',
        ],
        [
          tx({ es: 'Barras de precio', en: 'OHLC bars', pt: 'Barras OHLC' }),
          'ohlc',
          tx({
            es: 'Lo mismo que las velas, en trazos',
            en: 'Same as candlesticks, drawn as ticks',
            pt: 'O mesmo que os candles, em traços',
          }),
          '*ohlc',
          't-ancha',
        ],
        [
          tx({ es: 'Línea de tiempo', en: 'Timeline', pt: 'Linha do tempo' }),
          'timeline',
          tx({ es: 'Tramos e hitos de un plan', en: 'The phases and milestones of a plan', pt: 'Etapas e marcos de um plano' }),
          'lanzamiento',
          'c-ancha',
        ],
      ],
    },
    {
      pregunta: tx({ es: '¿Cuál es más?', en: 'Which is bigger?', pt: 'Qual é maior?' }),
      bajada: tx({
        es: 'Comparar cantidades y medirlas contra una meta.',
        en: 'Compare amounts and measure them against a goal.',
        pt: 'Comparar quantidades e medir contra uma meta.',
      }),
      tipos: [
        [
          tx({ es: 'Barras', en: 'Bars', pt: 'Barras' }),
          'bar',
          tx({
            es: 'Comparar cantidades, solas o apiladas',
            en: 'Compare amounts, side by side or stacked',
            pt: 'Comparar quantidades, lado a lado ou empilhadas',
          }),
          'paginas',
          'c-grande',
        ],
        [
          'Radar',
          'radar',
          tx({
            es: 'Perfiles comparados en varios aspectos',
            en: 'Profiles compared on several traits',
            pt: 'Perfis comparados em vários aspectos',
          }),
          'modelos',
          'c-alta',
        ],
        [
          tx({ es: 'Medidor', en: 'Gauge', pt: 'Medidor' }),
          'gauge',
          tx({ es: 'Un número contra su meta', en: 'One number against its goal', pt: 'Um número contra a meta' }),
          'meta',
          '',
        ],
        [
          tx({ es: 'Metas', en: 'Bullet chart', pt: 'Metas' }),
          'bullet',
          tx({
            es: 'Varios números contra su meta',
            en: 'Several numbers against their goals',
            pt: 'Vários números contra as metas',
          }),
          'metas',
          'c-ancha',
        ],
        [
          tx({ es: 'Nube de palabras', en: 'Word cloud', pt: 'Nuvem de palavras' }),
          'wordcloud',
          tx({ es: 'Lo que más se repite', en: 'What comes up the most', pt: 'O que mais se repete' }),
          'opiniones',
          'c-ancha',
        ],
      ],
    },
    {
      pregunta: tx({ es: '¿De qué está hecho?', en: 'What is it made of?', pt: 'Do que é feito?' }),
      bajada: tx({
        es: 'Las partes de un todo y cómo suman.',
        en: 'The parts of a whole and how they add up.',
        pt: 'As partes de um todo e como elas somam.',
      }),
      tipos: [
        [
          tx({ es: 'Anillos', en: 'Sunburst', pt: 'Anéis' }),
          'sunburst',
          tx({ es: 'Niveles dentro de niveles', en: 'Levels inside levels', pt: 'Níveis dentro de níveis' }),
          'mercados',
          'c-alta',
        ],
        [
          tx({ es: 'Rectángulos', en: 'Treemap', pt: 'Retângulos' }),
          'treemap',
          tx({ es: 'Muchas partes de un todo', en: 'Many parts of a whole', pt: 'Muitas partes de um todo' }),
          'productos',
          'c-grande',
        ],
        [
          tx({ es: 'Dona', en: 'Donut', pt: 'Rosca' }),
          'donut',
          tx({
            es: 'Pocas partes, con el total al centro',
            en: 'A few parts, with the total in the middle',
            pt: 'Poucas partes, com o total no centro',
          }),
          'categorias',
          '',
        ],
        [
          tx({ es: 'Cascada', en: 'Waterfall', pt: 'Cascata' }),
          'waterfall',
          tx({ es: 'De las ventas a la utilidad', en: 'From sales to profit', pt: 'Das vendas ao lucro' }),
          'resultado',
          'c-larga',
        ],
        [
          tx({ es: 'Pastel', en: 'Pie', pt: 'Pizza' }),
          'pie',
          tx({
            es: 'Partes de un todo, si son pocas',
            en: 'Parts of a whole, when there are few',
            pt: 'Partes de um todo, se forem poucas',
          }),
          '*pie',
          'c-media t-ancha',
        ],
      ],
    },
    {
      pregunta: tx({ es: '¿Qué tiene que ver con qué?', en: 'What goes with what?', pt: 'O que tem a ver com o quê?' }),
      bajada: tx({
        es: 'Si dos cosas se mueven juntas, o quién trabaja con quién.',
        en: 'Whether two things move together, or who works with whom.',
        pt: 'Se duas coisas andam juntas, ou quem trabalha com quem.',
      }),
      tipos: [
        [
          tx({ es: 'Mapa de calor', en: 'Heatmap', pt: 'Mapa de calor' }),
          'heatmap',
          tx({ es: 'Patrones de día y hora', en: 'Patterns by day and hour', pt: 'Padrões por dia e hora' }),
          'visitas-hora',
          'c-total',
        ],
        [
          tx({ es: 'Dispersión', en: 'Scatter', pt: 'Dispersão' }),
          'scatter',
          tx({
            es: 'Si dos números se mueven juntos',
            en: 'Whether two numbers move together',
            pt: 'Se dois números andam juntos',
          }),
          '*dispersion',
          'c-media',
        ],
        [
          tx({ es: 'Burbujas', en: 'Bubbles', pt: 'Bolhas' }),
          'bubble',
          tx({ es: 'Dispersión con un tercer valor', en: 'Scatter with a third value', pt: 'Dispersão com um terceiro valor' }),
          'tiendas',
          'c-media',
        ],
        [
          tx({ es: 'Red', en: 'Network', pt: 'Rede' }),
          'network',
          tx({ es: 'Quién se relaciona con quién', en: 'Who’s connected to whom', pt: 'Quem se relaciona com quem' }),
          'equipo',
          'c-media t-ancha',
        ],
      ],
    },
    {
      pregunta: tx({ es: '¿Por dónde pasa?', en: 'Which way does it go?', pt: 'Por onde passa?' }),
      bajada: tx({
        es: 'De dónde viene, a dónde va y cuántos llegan.',
        en: 'Where it comes from, where it goes, and how many make it.',
        pt: 'De onde vem, para onde vai e quantos chegam.',
      }),
      tipos: [
        [
          tx({ es: 'Flujos', en: 'Sankey', pt: 'Fluxos' }),
          'sankey',
          tx({
            es: 'De dónde vienen y a dónde van',
            en: 'Where they come from and where they go',
            pt: 'De onde vêm e para onde vão',
          }),
          'recorrido',
          'c-grande',
        ],
        [
          tx({ es: 'Cuerdas', en: 'Chord diagram', pt: 'Cordas' }),
          'chord',
          tx({ es: 'Flujos de ida y vuelta', en: 'Flows that go both ways', pt: 'Fluxos de ida e volta' }),
          'mudanzas',
          'c-alta',
        ],
        [
          tx({ es: 'Embudo', en: 'Funnel', pt: 'Funil' }),
          'funnel',
          tx({ es: 'Cuántos llegan a cada paso', en: 'How many reach each step', pt: 'Quantos chegam a cada etapa' }),
          'embudo',
          '',
        ],
      ],
    },
    {
      pregunta: tx({ es: '¿Dónde pasa?', en: 'Where does it happen?', pt: 'Onde acontece?' }),
      bajada: tx({
        es: 'Un valor por país o cantidades sobre el mapa.',
        en: 'One value per country, or amounts on the map.',
        pt: 'Um valor por país ou quantidades no mapa.',
      }),
      cabeza: 'c-alta',
      tipos: [
        [
          tx({ es: 'Mapa por colores', en: 'Filled map', pt: 'Mapa por cores' }),
          'choropleth',
          tx({ es: 'Un valor por país', en: 'One value per country', pt: 'Um valor por país' }),
          'paises',
          'c-grande',
        ],
        [
          tx({ es: 'Mapa de burbujas', en: 'Bubble map', pt: 'Mapa de bolhas' }),
          'mapbubble',
          tx({ es: 'Cantidades sobre el mapa', en: 'Amounts on the map', pt: 'Quantidades no mapa' }),
          'tiendas-mapa',
          'c-alta t-ancha',
        ],
      ],
    },
  ];

  // Para el lector de pantalla: "tres tipos.", "three types.", "três tipos." (los grupos tienen de 2 a 7).
  var CUANTOS = tx({
    es: ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'],
    en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'],
    pt: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete'],
  });
  var TIPOS_PALABRA = tx({ es: ' tipos. ', en: ' types. ', pt: ' tipos. ' });
  var bento = document.getElementById('bento');
  var fichas = [];

  GRUPOS.forEach(function (g, gi) {
    var ul = document.createElement('ul');
    ul.className = 'grupo';
    ul.setAttribute('aria-labelledby', 'pregunta-' + gi);
    var cabeza = document.createElement('li');
    cabeza.className = 'celda pregunta ' + (g.cabeza || '');
    cabeza.innerHTML =
      '<h3 id="pregunta-' +
      gi +
      '">' +
      g.pregunta +
      '</h3><div><span class="cuantos" aria-hidden="true">' +
      g.tipos.length +
      '</span><p><span class="sr-only">' +
      CUANTOS[g.tipos.length] +
      TIPOS_PALABRA +
      '</span>' +
      g.bajada +
      '</p></div>';
    ul.appendChild(cabeza);
    g.tipos.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'celda ' + t[4];
      li.innerHTML =
        '<div class="celda-cabeza"><h4>' +
        t[0] +
        "</h4><code>'" +
        t[1] +
        "'</code></div><p>" +
        t[2] +
        '</p><div class="celda-graf"></div>';
      ul.appendChild(li);
      fichas.push({ li: li, graf: li.querySelector('.celda-graf'), tipo: t[1], clave: t[3], chart: null, ultimo: 0 });
    });
    bento.appendChild(ul);
  });

  // ------------------------------------------------------------ Gráficos

  var esMapa = function (f) {
    return f.tipo === 'choropleth' || f.tipo === 'mapbubble';
  };

  function opcionesDe(f, animar) {
    var o = Object.assign({}, fuente(f.clave));
    delete o.title;
    delete o.subtitle;
    delete o.zoom;
    delete o.annotations;
    o.theme = 'dark';
    o.locale = LOCALE;
    o.background = false;
    o.legend = false;
    o.animate = animar;
    o.height = Math.max(100, Math.round(f.graf.clientHeight));
    // En una celda ancha se ve mejor el mundo entero que el recorte a los países con datos.
    if (f.tipo === 'choropleth')
      o.series = o.series.map(function (s) {
        var c = Object.assign({}, s);
        delete c.fit;
        return c;
      });
    // La nube con las palabras que caben en la celda (el resto sigue en la galería).
    if (f.tipo === 'wordcloud') o.data = o.data.slice(0, 18);
    return o;
  }

  function crear(f, animar) {
    if (f.chart) f.chart.destroy();
    f.graf.textContent = '';
    f.chart = new LozChart(f.graf, opcionesDe(f, animar));
    f.ultimo = performance.now();
  }

  // Al pasar el puntero, el gráfico se vuelve a dibujar con su animación de entrada.
  fichas.forEach(function (f) {
    f.li.addEventListener('pointerenter', function (e) {
      if (quieto || e.pointerType === 'touch' || !f.chart) return;
      if (performance.now() - f.ultimo < 1200) return; // ya se está dibujando
      crear(f, true);
    });
  });

  // El mapa del mundo (41 KB) se baja solo cuando un mapa se acerca a la pantalla.
  var mapa = null;
  function conMapa(fn) {
    if (window.LozChartWorld) return fn();
    if (!mapa) {
      mapa = [];
      var molde = document.getElementById('mapa-mundo');
      var s = document.createElement('script');
      s.src = molde.getAttribute('src');
      s.onload = function () {
        mapa.forEach(function (g) {
          g();
        });
      };
      document.body.appendChild(s);
    }
    mapa.push(fn);
  }

  // Se crean al acercarse (con su animación si se ven al llegar) y nunca antes: así la página no
  // dibuja 26 gráficos al cargar.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          var f = fichas[+en.target.dataset.i];
          var hacer = function () {
            crear(f, !quieto);
          };
          if (esMapa(f)) conMapa(hacer);
          else hacer();
        });
      },
      { rootMargin: '0px 0px 160px 0px' },
    );
    fichas.forEach(function (f, i) {
      f.li.dataset.i = i;
      io.observe(f.li);
    });
  } else {
    fichas.forEach(function (f) {
      if (esMapa(f)) conMapa(crear.bind(null, f, false));
      else crear(f, false);
    });
  }

  // Si cambia el ancho, cada gráfico toma el alto nuevo de su celda.
  var espera = 0;
  var anchoAntes = innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      if (innerWidth === anchoAntes) return;
      anchoAntes = innerWidth;
      fichas.forEach(function (f) {
        if (f.chart) f.chart.setOptions({ height: Math.max(100, Math.round(f.graf.clientHeight)) }, false);
      });
    }, 200);
  });
})();
