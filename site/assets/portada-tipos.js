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
  var temperaturas = MESES.map(function (mes, i) {
    var base = 14 + 4 * Math.sin(((i - 2) / 12) * 2 * Math.PI);
    return {
      mes: mes,
      max: Math.round((base + 6 + azar() * 2) * 10) / 10,
      min: Math.round((base - 5 - azar() * 2) * 10) / 10,
      media: Math.round(base * 10) / 10,
    };
  });
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
      xAxis: { field: 'mes', type: 'time' },
      yAxis: {
        format: function (v) {
          return v + ' °C';
        },
      },
      series: [
        { type: 'range', field: 'max', low: 'min', name: 'Mínima y máxima' },
        { type: 'line', field: 'media', name: 'Media', smooth: true },
      ],
    },
    dispersion: {
      data: estudio,
      xAxis: { field: 'horas', type: 'linear', title: 'Horas por semana' },
      yAxis: { title: 'Nota' },
      series: [{ type: 'scatter', field: 'nota', name: 'Estudiantes' }],
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
      pregunta: '¿Cómo cambió?',
      bajada: 'Lo que pasa con el tiempo: meses, precios, un plan.',
      tipos: [
        ['Líneas', 'line', 'Cómo cambia algo con el tiempo', 'usuarios', 'c-grande'],
        ['Área', 'area', 'El volumen y de qué está hecho', 'dispositivos', ''],
        ['Escalones', 'step', 'Lo que cambia de golpe: tarifas, tasas', 'tasa', ''],
        ['Rangos', 'range', 'Entre un mínimo y un máximo', '*rango', ''],
        ['Velas', 'candlestick', 'Apertura, máximo, mínimo y cierre', 'precios', ''],
        ['OHLC', 'ohlc', 'Lo mismo que las velas, en trazos', '*ohlc', 't-ancha'],
        ['Línea de tiempo', 'timeline', 'Tramos e hitos de un plan', 'lanzamiento', 'c-ancha'],
      ],
    },
    {
      pregunta: '¿Cuál es más?',
      bajada: 'Comparar cantidades y medirlas contra una meta.',
      tipos: [
        ['Barras', 'bar', 'Comparar cantidades, solas o apiladas', 'paginas', 'c-grande'],
        ['Radar', 'radar', 'Perfiles en varias dimensiones', 'modelos', 'c-alta'],
        ['Medidor', 'gauge', 'Un número contra su meta', 'meta', ''],
        ['Bala', 'bullet', 'Varios indicadores contra su meta', 'metas', 'c-ancha'],
        ['Nube de palabras', 'wordcloud', 'Lo que más se repite', 'opiniones', 'c-ancha'],
      ],
    },
    {
      pregunta: '¿De qué está hecho?',
      bajada: 'Las partes de un todo y cómo suman.',
      tipos: [
        ['Sunburst', 'sunburst', 'Una jerarquía en anillos', 'mercados', 'c-alta'],
        ['Treemap', 'treemap', 'Muchas partes de un todo', 'productos', 'c-grande'],
        ['Donut', 'donut', 'Pocas partes, con el total al centro', 'categorias', ''],
        ['Cascada', 'waterfall', 'De las ventas a la utilidad', 'resultado', 'c-larga'],
        ['Pie', 'pie', 'Partes de un todo, si son pocas', '*pie', 'c-media t-ancha'],
      ],
    },
    {
      pregunta: '¿Qué tiene que ver con qué?',
      bajada: 'Si dos cosas se mueven juntas, o quién trabaja con quién.',
      tipos: [
        ['Mapa de calor', 'heatmap', 'Patrones de día y hora', 'visitas-hora', 'c-total'],
        ['Dispersión', 'scatter', 'Si dos números se mueven juntos', '*dispersion', 'c-media'],
        ['Burbujas', 'bubble', 'Dispersión con un tercer valor', 'tiendas', 'c-media'],
        ['Red', 'network', 'Quién se relaciona con quién', 'equipo', 'c-media t-ancha'],
      ],
    },
    {
      pregunta: '¿Por dónde pasa?',
      bajada: 'De dónde viene, a dónde va y cuántos llegan.',
      tipos: [
        ['Sankey', 'sankey', 'De dónde vienen y a dónde van', 'recorrido', 'c-grande'],
        ['Cuerdas', 'chord', 'Flujos de ida y vuelta', 'mudanzas', 'c-alta'],
        ['Embudo', 'funnel', 'Cuántos llegan a cada paso', 'embudo', ''],
      ],
    },
    {
      pregunta: '¿Dónde pasa?',
      bajada: 'Un valor por país o cantidades sobre el mapa.',
      cabeza: 'c-alta',
      tipos: [
        ['Mapa por colores', 'choropleth', 'Un valor por país', 'paises', 'c-grande'],
        ['Mapa de burbujas', 'mapbubble', 'Cantidades sobre el mapa', 'tiendas-mapa', 'c-alta t-ancha'],
      ],
    },
  ];

  var NUMEROS = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete'];
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
      NUMEROS[g.tipos.length] +
      ' tipos. </span>' +
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
