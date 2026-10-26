/* Un caso real (caso-real.html): un gráfico fijo que cambia con cada capítulo de la historia. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var H = window.HISTORIA;
  var tx = window.tx;
  // Los pesos colombianos se escriben como en cada idioma: en español con el formato de Colombia
  // ('es-CO', "$ 5.154.800"), en inglés "COP 5,154,800" y en portugués "COP 5.154.800".
  var LOC = window.IDIOMA === 'es' ? 'es-CO' : window.LOCALE;
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var celular = window.matchMedia('(max-width: 860px)');

  // ---------- Barra de progreso (respaldo sin scroll-timeline) ----------
  var barra = document.querySelector('.progreso span');
  if (!CSS.supports('animation-timeline: scroll()') || quieto) {
    var pendiente = false;
    var pintar = function () {
      pendiente = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      barra.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max) : 0);
    };
    addEventListener(
      'scroll',
      function () {
        if (!pendiente) {
          pendiente = true;
          requestAnimationFrame(pintar);
        }
      },
      { passive: true },
    );
    pintar();
  }

  if (!window.LozChart || !H) return;

  // ---------- Gráficos ----------
  var base = {
    theme: 'light',
    background: false,
    locale: LOC,
    currency: 'COP',
    animate: !quieto,
    legend: false,
  };
  var lienzo = document.getElementById('lienzo');
  var graficos = {};

  var definiciones = {
    diario: {
      data: H.diario,
      xAxis: { field: 'fecha', type: 'time' },
      yAxis: { format: 'currency' },
      series: [{ type: 'line', field: 'ventas', name: tx({ es: 'Ventas del día', en: 'Sales that day', pt: 'Vendas do dia' }) }],
      zoom: true,
      ariaLabel: tx({
        es: 'Ventas de cada día de 2025 en la tienda de doña Carmen. El día más alto fue el 24 de diciembre, con 5.154.800 pesos.',
        en: 'Daily sales in 2025 at Doña Carmen’s store. The best day was December 24, with 5,154,800 pesos.',
        pt: 'Vendas de cada dia de 2025 no mercadinho de dona Carmen. O dia mais forte foi 24 de dezembro, com 5.154.800 pesos.',
      }),
    },
    mensual: {
      data: H.mensual,
      xAxis: { field: 'mes' },
      yAxis: { format: 'currency' },
      series: [{ type: 'bar', field: 'ventas', name: tx({ es: 'Ventas del mes', en: 'Sales that month', pt: 'Vendas do mês' }) }],
      ariaLabel: tx({
        es: 'Ventas por mes en 2025. Diciembre fue el mejor mes, con 62,4 millones de pesos; febrero el más bajo, con 34,3 millones.',
        en: 'Monthly sales in 2025. December was the best month, with 62.4 million pesos; February was the lowest, with 34.3 million.',
        pt: 'Vendas por mês em 2025. Dezembro foi o melhor mês, com 62,4 milhões de pesos; fevereiro, o mais fraco, com 34,3 milhões.',
      }),
    },
    canasta: {
      data: H.canasta,
      xAxis: { field: 'producto' },
      yAxis: { format: 'currency' },
      series: [{ type: 'treemap', field: 'ventas', name: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }), group: 'grupo' }],
    },
    horas: {
      data: H.horas,
      xAxis: { field: 'hora' },
      series: [{ type: 'heatmap', field: 'clientes', name: tx({ es: 'Clientes', en: 'Customers', pt: 'Clientes' }), y: 'dia' }],
    },
    lejos: {
      data: H.lejos,
      xAxis: { field: 'ciudad' },
      series: [
        {
          type: 'mapbubble',
          field: 'pedidos',
          name: tx({ es: 'Pedidos', en: 'Orders', pt: 'Pedidos' }),
          lat: 'lat',
          lon: 'lon',
          projection: 'orthographic',
          rotate: [-38, 20],
        },
      ],
    },
    cierre: {
      data: H.cierre,
      xAxis: { field: 'paso' },
      yAxis: { format: 'currency' },
      series: [
        { type: 'waterfall', field: 'monto', name: tx({ es: 'Resultado', en: 'Result', pt: 'Resultado' }), total: 'total' },
      ],
    },
  };

  // Alto disponible para cada capa; el gráfico se ajusta para no pasarse.
  function altoDe(el) {
    return Math.max(160, Math.floor(el.clientHeight || lienzo.clientHeight));
  }
  function ajustar(g, el, alto) {
    var h = alto;
    g.setOptions({ height: h }, false);
    var sobra = el.scrollHeight - alto;
    if (sobra > 0) g.setOptions({ height: Math.max(120, h - sobra) }, false);
  }

  function crear(k) {
    var el = document.getElementById('g-' + k);
    var opciones = Object.assign({}, base, definiciones[k], { height: altoDe(lienzo) });
    try {
      graficos[k] = { g: new LozChart(el, opciones), el: el };
      ajustar(graficos[k].g, el, lienzo.clientHeight);
    } catch (e) {
      console.warn('No se pudo crear el gráfico', k, e);
    }
  }
  Object.keys(definiciones).forEach(function (k) {
    if (k !== 'lejos') crear(k);
  });

  // El globo de julio necesita el mapa del mundo (unos 110 KB): se baja cuando la historia se
  // acerca a la pantalla, no al abrir la página. La etiqueta <script type="text/x-diferido">
  // guarda su dirección (con la versión que le pone el armado del sitio).
  var marca = document.querySelector('script[data-mapa]');
  function cargarMapa() {
    if (window.LozChartWorld) return crear('lejos');
    var s = document.createElement('script');
    s.src = (marca && marca.getAttribute('src')) || 'lib/maps/world.umd.js';
    s.onload = function () {
      crear('lejos');
    };
    document.body.appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    var vigia = new IntersectionObserver(
      function (es) {
        if (!es[0].isIntersecting) return;
        vigia.disconnect();
        cargarMapa();
      },
      { rootMargin: '0px 0px 100% 0px' },
    );
    vigia.observe(document.getElementById('historia'));
  } else cargarMapa();

  // El gráfico del informe Pro.
  var elInforme = document.getElementById('g-informe');
  var informe = new LozChart(
    elInforme,
    Object.assign({}, base, {
      data: H.mensual,
      xAxis: { field: 'mes' },
      yAxis: { format: 'compact' },
      series: [{ type: 'bar', field: 'ventas', name: tx({ es: 'Ventas del mes', en: 'Sales that month', pt: 'Vendas do mês' }) }],
      height: 200,
      tooltip: true,
    }),
  );

  function ajustarTodo() {
    var alto = lienzo.clientHeight;
    Object.keys(graficos).forEach(function (k) {
      ajustar(graficos[k].g, graficos[k].el, alto);
    });
    var hi = elInforme.clientHeight;
    if (hi > 60) ajustar(informe, elInforme, hi);
  }
  ajustarTodo();
  var espera;
  new ResizeObserver(function () {
    clearTimeout(espera);
    espera = setTimeout(ajustarTodo, 150);
  }).observe(lienzo);

  // ---------- Capas ----------
  var capas = Array.prototype.slice.call(lienzo.querySelectorAll('.capa'));
  function mostrarCapa(nombre) {
    capas.forEach(function (c) {
      var si = c.dataset.capa === nombre;
      c.classList.toggle('activa', si);
      c.inert = !si;
      c.setAttribute('aria-hidden', si ? 'false' : 'true');
    });
  }
  mostrarCapa('diario');

  // ---------- Encabezado del escenario ----------
  var mesGrande = document.getElementById('mes-grande');
  var titulo = document.getElementById('escenario-titulo');
  var sub = document.getElementById('escenario-sub');
  function encabezado(paso) {
    if (mesGrande.textContent !== paso.dataset.mes) {
      mesGrande.textContent = paso.dataset.mes;
      mesGrande.classList.remove('cambia');
      void mesGrande.offsetWidth;
      mesGrande.classList.add('cambia');
    }
    titulo.textContent = paso.dataset.titulo;
    sub.textContent = paso.dataset.sub;
  }

  // ---------- Cifras que cuentan ----------
  function contar(el) {
    if (el.dataset.listo) return;
    el.dataset.listo = '1';
    var fin = +el.dataset.contar,
      pre = el.dataset.prefijo || '';
    if (quieto) {
      el.textContent = pre + fin;
      return;
    }
    var t0 = performance.now(),
      dur = 1100;
    (function cuadro(t) {
      var x = Math.min(1, Math.max(0, (t - t0) / dur));
      var e = 1 - Math.pow(1 - x, 3);
      el.textContent = pre + Math.round(fin * e);
      if (x < 1) requestAnimationFrame(cuadro);
    })(t0);
  }

  // ---------- Abril: lo que oye don Julio ----------
  var pesos = new Intl.NumberFormat(LOC, { maximumFractionDigits: 0 });
  var oidoTexto = document.getElementById('oido-texto');
  var oidoBoton = document.getElementById('oido-boton');
  var oidoPausa = document.getElementById('oido-pausa');
  var recorrido = null,
    mesActual = 0,
    hablando = false,
    pausado = false;

  // Lo que dice el lector de pantalla en cada mes; la voz lo lee sin la posición ("1 de 12").
  function frase(i, conPosicion) {
    var m = H.mensual[i];
    var texto = m.nombre.charAt(0).toUpperCase() + m.nombre.slice(1) + ', ' + pesos.format(m.ventas) + ' pesos.';
    if (!conPosicion) return texto;
    return texto + ' ' + tx({ es: i + 1 + ' de 12.', en: i + 1 + ' of 12.', pt: i + 1 + ' de 12.' });
  }
  function marcarMes(i) {
    mesActual = i;
    oidoTexto.textContent = frase(i, true);
    graficos.mensual && graficos.mensual.g.highlightIndex(i);
  }
  // El recorrido automático muestra cómo se oye el gráfico; se puede pausar y no corre con
  // movimiento reducido (ahí el botón de voz y las flechas hacen lo mismo).
  function empezarRecorrido() {
    if (quieto || recorrido || hablando || pausado) return;
    marcarMes(mesActual);
    recorrido = setInterval(function () {
      marcarMes((mesActual + 1) % 12);
    }, 1500);
  }
  if (!quieto) {
    oidoPausa.hidden = false;
    oidoPausa.addEventListener('click', function () {
      pausado = !pausado;
      oidoPausa.setAttribute('aria-pressed', String(pausado));
      oidoPausa.textContent = pausado
        ? tx({ es: 'Seguir el recorrido', en: 'Resume the walkthrough', pt: 'Continuar o percurso' })
        : tx({ es: 'Pausar el recorrido', en: 'Pause the walkthrough', pt: 'Pausar o percurso' });
      if (pausado) pararRecorrido();
      else empezarRecorrido();
    });
  }
  function pararRecorrido() {
    clearInterval(recorrido);
    recorrido = null;
  }

  if ('speechSynthesis' in window) {
    oidoBoton.hidden = false;
    var etiqueta = oidoBoton.querySelector('.oido__etiqueta');
    var callar = function () {
      hablando = false;
      speechSynthesis.cancel();
      oidoBoton.setAttribute('aria-pressed', 'false');
      etiqueta.textContent = tx({ es: 'Escúchalo en voz alta', en: 'Hear it out loud', pt: 'Ouça em voz alta' });
    };
    var decir = function (i) {
      if (!hablando || i >= 12) {
        callar();
        return;
      }
      marcarMes(i);
      var u = new SpeechSynthesisUtterance(frase(i));
      u.lang = tx({ es: 'es-CO', en: 'en-US', pt: 'pt-BR' });
      u.rate = 1.05;
      u.onend = function () {
        decir(i + 1);
      };
      u.onerror = callar;
      speechSynthesis.speak(u);
    };
    oidoBoton.setAttribute('aria-pressed', 'false');
    oidoBoton.addEventListener('click', function () {
      if (hablando) {
        callar();
        empezarRecorrido();
        return;
      }
      pararRecorrido();
      hablando = true;
      oidoBoton.setAttribute('aria-pressed', 'true');
      etiqueta.textContent = tx({ es: 'Detener', en: 'Stop', pt: 'Parar' });
      speechSynthesis.cancel();
      decir(0);
    });
    oidoBoton._callar = callar;
  }

  // ---------- Capítulos ----------
  var acciones = {
    diario: function () {
      var d = graficos.diario && graficos.diario.g;
      if (!d) return;
      d.setOptions({ annotations: [] }, !quieto);
      if (d.zoomRange) d.resetZoom();
    },
    diciembre: function () {
      var d = graficos.diario && graficos.diario.g;
      if (!d) return;
      d.setOptions(
        {
          annotations: [
            { x: '2025-12-24', label: tx({ es: '24 dic: $5,15 M', en: 'Dec 24: COP 5.15M', pt: '24 dez: COP 5,15 mi' }) },
          ],
        },
        !quieto,
      );
      d.zoomTo('2025-11-24', '2025-12-31');
    },
    mensual: function () {
      graficos.mensual && graficos.mensual.g.highlight(null);
    },
    escuchar: function () {
      empezarRecorrido();
    },
  };
  var salir = {
    escuchar: function () {
      pararRecorrido();
      if (oidoBoton._callar && hablando) oidoBoton._callar();
      graficos.mensual && graficos.mensual.g.highlight(null);
    },
  };

  var pasos = Array.prototype.slice.call(document.querySelectorAll('.paso'));
  var activo = null;
  function activar(paso) {
    if (paso === activo) return;
    if (activo) {
      activo.classList.remove('activo');
      salir[activo.dataset.paso] && salir[activo.dataset.paso]();
    }
    activo = paso;
    paso.classList.add('activo');
    mostrarCapa(paso.dataset.capa);
    encabezado(paso);
    (acciones[paso.dataset.paso] || function () {})();
    paso.querySelectorAll('[data-contar]').forEach(contar);
  }

  // El capítulo activo es el que cruza una línea horizontal de la pantalla:
  // al medio en escritorio, debajo del gráfico fijo en el celular.
  var porRevisar = false;
  function revisar() {
    porRevisar = false;
    var linea = innerHeight * (celular.matches ? 0.74 : 0.64);
    var elegido = pasos[0];
    for (var i = 0; i < pasos.length; i++) {
      if (pasos[i].firstElementChild.getBoundingClientRect().top <= linea) elegido = pasos[i];
    }
    activar(elegido);
  }
  function pedirRevision() {
    if (!porRevisar) {
      porRevisar = true;
      requestAnimationFrame(revisar);
    }
  }
  addEventListener('scroll', pedirRevision, { passive: true });
  addEventListener('resize', pedirRevision);
  revisar();
})();
