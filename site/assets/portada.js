/* Portada: el globo que gira, el taller y las pruebas en vivo. */
(function () {
  var byId = function (id) {
    return document.getElementById(id);
  };
  var ej = {};
  EJEMPLOS.forEach(function (e) {
    ej[e.id] = e;
  });
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ El globo

  // Datos de ejemplo para todos los países del mapa (el globo nunca queda vacío al girar). Unos
  // pocos con valores a mano; el resto, un número estable que sale de su código ISO.
  var A_MANO = { USA: 4210, MEX: 1830, BRA: 2650, COL: 980, ESP: 1120, IND: 3540, CHN: 3260, DEU: 890, JPN: 1610, ARG: 760 };
  var paises = (window.LozChartWorld || { objects: { countries: { geometries: [] } } }).objects.countries.geometries;
  var USUARIOS = paises
    .map(function (g) {
      return g.properties.iso3;
    })
    .filter(function (iso) {
      return iso && iso !== 'ATA';
    })
    .map(function (iso) {
      var h = 0;
      for (var i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) % 9973;
      var miles = A_MANO[iso] || 150 + (h % 1000) * 3;
      return { pais: iso, usuarios: miles * 1000 };
    });
  var rot = [-70, 12];
  var serie = function () {
    return [
      { type: 'choropleth', field: 'usuarios', name: 'Usuarios', projection: 'orthographic', rotate: rot.slice(), labels: false },
    ];
  };
  var globoEl = byId('globo');
  var globo = siteChart(
    new LozChart(globoEl, {
      theme: 'dark',
      data: USUARIOS,
      xAxis: { field: 'pais' },
      yAxis: { format: 'compact' },
      series: serie(),
      height: Math.round(globoEl.clientWidth),
      background: false,
      animate: false,
      legend: false,
      // Los países, en el violeta de la marca: de tenue (pocos usuarios) a intenso.
      palette: { light: ['#a58bff'], dark: ['#a58bff'] },
    }),
    true,
  );
  var dibujar = function () {
    globo.setOptions({ series: serie() }, false);
  };
  // Gira solo, despacio; al arrastrarlo se detiene y retoma unos segundos después.
  var quieto = 0;
  var arrastre = null;
  var ultimo = performance.now();
  function girar(t) {
    var dt = Math.min(64, t - ultimo);
    ultimo = t;
    if (!arrastre && t > quieto && !document.hidden) {
      rot[0] += dt * 0.006;
      dibujar();
    }
    requestAnimationFrame(girar);
  }
  if (!reduce) requestAnimationFrame(girar);
  globoEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    arrastre = { x: e.clientX, y: e.clientY, rot: rot.slice() };
    globoEl.classList.add('dragging');
    globoEl.setPointerCapture(e.pointerId);
  });
  globoEl.addEventListener('pointermove', function (e) {
    if (!arrastre) return;
    rot = [
      arrastre.rot[0] - (e.clientX - arrastre.x) * 0.35,
      Math.max(-55, Math.min(55, arrastre.rot[1] + (e.clientY - arrastre.y) * 0.35)),
    ];
    dibujar();
  });
  var soltar = function () {
    arrastre = null;
    quieto = performance.now() + 4000;
    globoEl.classList.remove('dragging');
  };
  globoEl.addEventListener('pointerup', soltar);
  globoEl.addEventListener('pointercancel', soltar);
  window.addEventListener('resize', function () {
    globo.setOptions({ height: Math.round(globoEl.clientWidth) }, false);
  });

  // ------------------------------------------------------------ Taller

  crearEjemplo(ej.recorrido, byId('lab-sankey'), { title: undefined, subtitle: undefined, height: 560 });
  crearEjemplo(ej['visitas-hora'], byId('lab-calor'), { title: undefined, height: 230 });
  crearEjemplo(ej['visitas-dia'], byId('lab-zoom'), {
    title: undefined,
    subtitle: undefined,
    height: 230,
    endLabels: false,
    zoom: { range: ['2026-06-01', '2026-08-15'], scrollbar: false },
    annotations: [{ x: ['2026-06-29', '2026-07-21'], label: 'Campaña' }],
  });

  // ------------------------------------------------------------ Cien mil puntos

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
      deriva = (deriva + (rand() - 0.5) * 0.08) * 0.999;
      var dia = Math.sin(((i % 1440) / 1440) * 2 * Math.PI - Math.PI / 2) * 4;
      data[i] = { t: t0 + i * 60000, v: Math.round((18 + dia + deriva + (rand() - 0.5) * 0.6) * 10) / 10 };
    }
    return data;
  }
  var grados = function (v) {
    return v + ' °C';
  };
  var mucho = siteChart(
    new LozChart('#mucho', {
      data: lecturas(10080),
      xAxis: { field: 't', type: 'time' },
      yAxis: { format: grados },
      series: [{ type: 'line', field: 'v', name: 'Temperatura' }],
      height: 260,
      background: false,
    }),
  );
  byId('mucho-btn').addEventListener('click', function () {
    var data = lecturas(100000);
    mucho.destroy();
    var inicio = performance.now();
    mucho = siteChart(
      new LozChart('#mucho', {
        data: data,
        xAxis: { field: 't', type: 'time' },
        yAxis: { format: grados },
        series: [{ type: 'line', field: 'v', name: 'Temperatura' }],
        height: 260,
        background: false,
        animate: false,
        zoom: { scrollbar: false },
      }),
    );
    var ms = Math.max(1, Math.round(performance.now() - inicio));
    byId('mucho-res').innerHTML = '<strong>' + ms + ' ms</strong> en tu equipo. Arrastra para acercar.';
  });

  // ------------------------------------------------------------ Daltonismo, voz y forma

  crearEjemplo(ej.usuarios, byId('cvd-chart'), {
    title: undefined,
    subtitle: undefined,
    height: 230,
    legend: false,
    endLabels: true,
  });
  byId('cvd').addEventListener('change', function (e) {
    document.querySelector('.bento').classList.toggle('cvd-on', e.target.checked);
  });

  crearEjemplo(ej.embudo, byId('voz-chart'), { title: undefined, height: 220 });
  var svgEl = byId('voz-chart').querySelector('svg.lc-svg');
  var live = byId('voz-chart').querySelector('[aria-live]');
  byId('voz').textContent = '“' + svgEl.getAttribute('aria-label') + '”';
  new MutationObserver(function () {
    if (live.textContent) byId('voz').textContent = '“' + live.textContent + '”';
  }).observe(live, { childList: true, characterData: true, subtree: true });

  var ventas = ej.ventas.opciones.data;
  var total = function (k) {
    return ventas.reduce(function (s, r) {
      return s + r[k];
    }, 0);
  };
  var FORMAS = {
    barras: {
      data: ventas,
      xAxis: { field: 'mes', type: 'time' },
      series: [
        { type: 'bar', field: 'online', name: 'En línea', stack: true },
        { type: 'bar', field: 'tienda', name: 'Tienda', stack: true },
      ],
    },
    lineas: {
      data: ventas,
      xAxis: { field: 'mes', type: 'time' },
      series: [
        { type: 'line', field: 'online', name: 'En línea', smooth: true },
        { type: 'line', field: 'tienda', name: 'Tienda', smooth: true },
      ],
    },
    donut: {
      data: [
        { canal: 'En línea', ventas: total('online') },
        { canal: 'Tienda', ventas: total('tienda') },
      ],
      xAxis: { field: 'canal', type: 'category' },
      series: [{ type: 'donut', field: 'ventas', name: 'Ventas' }],
    },
  };
  var forma = siteChart(
    new LozChart(
      '#forma',
      Object.assign({ yAxis: { format: 'compact' }, height: 220, background: false, legend: false }, FORMAS.barras),
    ),
  );
  document.querySelector('[data-tabs="forma"]').addEventListener('tabchange', function (e) {
    forma.setOptions(FORMAS[e.detail]);
  });
})();
