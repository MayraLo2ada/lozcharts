/* Portada: el gráfico que cambia de forma, las pruebas en vivo y la muestra de la galería. */
(function () {
  var byId = function (id) {
    return document.getElementById(id);
  };
  var ej = {};
  EJEMPLOS.forEach(function (e) {
    ej[e.id] = e;
  });
  var ventas = ej.ventas.opciones.data;

  // ------------------------------------------------------------ El escenario

  var total = function (k) {
    return ventas.reduce(function (s, r) {
      return s + r[k];
    }, 0);
  };
  var tiempo = { field: 'mes', type: 'time' };
  var FORMAS = {
    barras: {
      series: [
        { type: 'bar', field: 'online', name: 'Online', stack: true },
        { type: 'bar', field: 'tienda', name: 'Tienda', stack: true },
        { type: 'line', field: 'meta', name: 'Meta', smooth: true },
      ],
    },
    lineas: {
      series: [
        { type: 'line', field: 'online', name: 'Online', smooth: true },
        { type: 'line', field: 'tienda', name: 'Tienda', smooth: true },
        { type: 'line', field: 'meta', name: 'Meta', smooth: true },
      ],
      endLabels: true,
    },
    areas: {
      series: [
        { type: 'area', field: 'online', name: 'Online', stack: true, smooth: true },
        { type: 'area', field: 'tienda', name: 'Tienda', stack: true, smooth: true },
      ],
    },
    proporcion: {
      data: [
        { canal: 'Online', ventas: total('online') },
        { canal: 'Tienda', ventas: total('tienda') },
      ],
      // type explícito: setOptions combina el eje con el anterior, que era de tiempo.
      xAxis: { field: 'canal', type: 'category' },
      series: [{ type: 'donut', field: 'ventas', name: 'Ventas' }],
    },
  };
  var base = {
    title: 'Ventas por mes',
    subtitle: 'Online y tienda física, 2026',
    data: ventas,
    xAxis: tiempo,
    yAxis: { format: 'currency' },
    height: 320,
    background: false,
  };
  var opcionesDe = function (forma) {
    var f = FORMAS[forma];
    return Object.assign({}, base, { endLabels: false }, f, { xAxis: f.xAxis || tiempo, data: f.data || ventas });
  };
  var hero = siteChart(new LozChart('#hero-chart', opcionesDe('barras')));
  var mostrarCodigo = function (forma) {
    var series = FORMAS[forma].series
      .map(function (s) {
        var extra = (s.stack ? ', stack: true' : '') + (s.smooth ? ', smooth: true' : '');
        return "    { type: '" + s.type + "', field: '" + s.field + "'" + extra + ' },';
      })
      .join('\n');
    var x = forma === 'proporcion' ? "{ field: 'canal' }" : "{ field: 'mes', type: 'time' }";
    var src = "new LozChart('#ventas', {\n  data: ventas,\n  xAxis: " + x + ',\n  series: [\n' + series + '\n  ],\n});';
    byId('hero-code').innerHTML = siteHighlight(src);
  };
  mostrarCodigo('barras');
  document.querySelector('[data-tabs="forma"]').addEventListener('tabchange', function (e) {
    hero.setOptions(opcionesDe(e.detail));
    mostrarCodigo(e.detail);
  });

  // ------------------------------------------------------------ Cien mil puntos

  var mucho = null;
  byId('mucho-btn').addEventListener('click', function () {
    var data = lecturas(100000);
    if (mucho) mucho.destroy();
    var inicio = performance.now();
    mucho = siteChart(
      new LozChart('#mucho-chart', {
        title: 'Sensor de temperatura',
        subtitle: '100 000 lecturas: diez semanas, una por minuto',
        data: data,
        xAxis: { field: 't', type: 'time' },
        yAxis: {
          format: function (v) {
            return v + ' °C';
          },
        },
        series: [{ type: 'line', field: 'v', name: 'Temperatura' }],
        animate: false,
        zoom: true,
        height: 300,
        background: false,
      }),
    );
    var ms = Math.max(1, Math.round(performance.now() - inicio));
    byId('mucho-res').innerHTML = 'Listo en <strong>' + ms + ' ms</strong>. Arrastra para acercar.';
  });
  // Lecturas de un sensor: temperatura diaria con su ciclo de día y noche y algo de ruido.
  function lecturas(n) {
    var seed = 7;
    var rand = function () {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    var data = new Array(n);
    var t0 = Date.UTC(2026, 0, 1);
    var deriva = 0;
    for (var i = 0; i < n; i++) {
      deriva += (rand() - 0.5) * 0.08;
      deriva *= 0.999;
      var dia = Math.sin(((i % 1440) / 1440) * 2 * Math.PI - Math.PI / 2) * 4;
      data[i] = { t: t0 + i * 60000, v: Math.round((18 + dia + deriva + (rand() - 0.5) * 0.6) * 10) / 10 };
    }
    return data;
  }
  // Mientras tanto, un adelanto con una semana de lecturas.
  mucho = siteChart(
    new LozChart('#mucho-chart', {
      title: 'Sensor de temperatura',
      subtitle: 'Una semana, una lectura por minuto. Pulsa el botón para cargar 100 000.',
      data: lecturas(10080),
      xAxis: { field: 't', type: 'time' },
      yAxis: {
        format: function (v) {
          return v + ' °C';
        },
      },
      series: [{ type: 'line', field: 'v', name: 'Temperatura' }],
      height: 300,
      background: false,
    }),
  );

  // ------------------------------------------------------------ Daltonismo

  siteChart(new LozChart('#cvd-chart', Object.assign({}, ej.usuarios.opciones, { height: 320, background: false })));
  byId('cvd').addEventListener('change', function (e) {
    document.querySelector('.proof').classList.toggle('cvd-on', e.target.checked);
  });

  // ------------------------------------------------------------ Lector de pantalla

  siteChart(
    new LozChart('#voz-chart', {
      title: 'Embudo de compra',
      data: ej.embudo.opciones.data,
      xAxis: { field: 'paso' },
      series: [{ type: 'funnel', field: 'sesiones', name: 'Sesiones' }],
      height: 300,
      background: false,
    }),
  );
  var root = byId('voz-chart');
  var svgEl = root.querySelector('svg.lc-svg');
  var live = root.querySelector('[aria-live]');
  byId('voz').textContent = svgEl.getAttribute('aria-label');
  new MutationObserver(function () {
    if (live.textContent) byId('voz').textContent = live.textContent;
  }).observe(live, { childList: true, characterData: true, subtree: true });
  svgEl.addEventListener('focus', function () {
    byId('voz').textContent = svgEl.getAttribute('aria-label');
  });

  // ------------------------------------------------------------ Muestra de la galería

  ['visitas-hora', 'productos', 'recorrido', 'tiendas-mapa', 'precios', 'modelos'].forEach(function (id) {
    var a = document.createElement('a');
    a.href = 'galeria.html#' + id;
    var box = document.createElement('div');
    var tipo = document.createElement('span');
    tipo.className = 'tipo';
    tipo.textContent = ej[id].tipo;
    a.append(box, tipo);
    byId('preview').appendChild(a);
    crearEjemplo(ej[id], box, { height: 240, tooltip: true, legend: false, subtitle: undefined });
  });
})();
