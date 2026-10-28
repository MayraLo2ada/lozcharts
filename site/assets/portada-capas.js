/*
 * Portada, «Crea el tuyo»: tres gráficos por capas (notas con caritas, hábitos y clima) que se
 * turnan solos cada 7 segundos hasta que la persona toca una pestaña. Al lado, el JSON que los
 * dibuja. Con prefers-reduced-motion no se turnan.
 */
(function () {
  'use strict';
  var P = window.portada;
  var tabs = document.getElementById('capas-tabs');
  var caja = document.getElementById('capas-grafico');
  if (!tabs || !caja || !window.capasEjemplos || !LozChart.layerOptions) return;

  var ORDEN = ['notas', 'habitos', 'clima'];
  var todos = window.capasEjemplos(window.IDIOMA);
  var EJEMPLOS = ORDEN.map(function (id) {
    return todos.filter(function (e) {
      return e.id === id;
    })[0];
  });
  var resumen = document.getElementById('capas-resumen');
  var json = document.getElementById('capas-json');
  var ms = document.getElementById('capas-ms');
  var actual = 0;
  var chart = null;
  var turno = 0;

  EJEMPLOS.forEach(function (e, k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tipo-lab';
    b.setAttribute('role', 'tab');
    b.id = 'capas-tab-' + e.id;
    b.textContent = e.nombre;
    b.addEventListener('click', function () {
      parar();
      mostrar(k, true);
    });
    b.addEventListener('keydown', function (ev) {
      var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      parar();
      var n = (actual + d + EJEMPLOS.length) % EJEMPLOS.length;
      mostrar(n, true);
      tabs.children[n].focus();
    });
    tabs.appendChild(b);
  });

  /** El JSON del ejemplo, con los datos recortados: lo interesante son las capas. */
  function textoJson(spec) {
    var corto = Object.assign({}, spec);
    delete corto.locale;
    if (Array.isArray(corto.data)) corto.data = '__FILAS__';
    else if (corto.data) {
      var d = {};
      Object.keys(corto.data).forEach(function (k) {
        d[k] = Array.isArray(corto.data[k]) ? '__FILAS__' : corto.data[k];
      });
      corto.data = d;
    }
    // Las listas cortas de textos o números van en una sola línea, como las escribiría una persona.
    return JSON.stringify(corto, null, 2)
      .replace(/\[\s*\n([^\[\]{}]*?)\n\s*\]/g, function (m, cuerpo) {
        var una =
          '[' +
          cuerpo
            .split('\n')
            .map(function (l) {
              return l.trim();
            })
            .join(' ') +
          ']';
        return una.length <= 72 ? una : m;
      })
      .replace(/"__FILAS__"/g, '[ … ]');
  }

  function escapar(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /** Una línea por <span class="ln">, con las mismas clases de color que el código del laboratorio. */
  function pintar(texto) {
    return texto
      .split('\n')
      .map(function (linea) {
        var html = escapar(linea).replace(/("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)/g, function (m, str, dos, num) {
          if (num) return '<span class="tk-n">' + num + '</span>';
          return '<span class="' + (dos ? 'tk-k' : 'tk-s') + '">' + str + '</span>' + (dos || '');
        });
        return '<span class="ln">' + html + '</span>';
      })
      .join('');
  }

  function mostrar(k, foco) {
    actual = k;
    var e = EJEMPLOS[k];
    Array.prototype.forEach.call(tabs.children, function (b, i) {
      b.setAttribute('aria-selected', String(i === k));
      b.tabIndex = i === k ? 0 : -1;
    });
    caja.setAttribute('aria-labelledby', 'capas-tab-' + e.id);
    resumen.textContent = e.resumen;
    json.innerHTML = pintar(textoJson(e.spec));
    json.parentNode.scrollTop = 0;
    var t0 = performance.now();
    var opciones = LozChart.layerOptions(
      Object.assign({ locale: window.LOCALE }, e.spec, { background: false, theme: 'dark', animate: !P.quieto && !foco }),
    );
    if (chart) chart.destroy();
    chart = new LozChart(caja, opciones);
    var n = Math.max(1, Math.round(performance.now() - t0));
    ms.textContent = { es: 'Dibujado en ' + n + ' ms', en: 'Drawn in ' + n + ' ms', pt: 'Desenhado em ' + n + ' ms' }[
      window.IDIOMA
    ];
  }

  function parar() {
    clearInterval(turno);
    turno = 0;
  }

  P.alVer(
    caja,
    function () {
      mostrar(0, false);
      if (P.quieto) return;
      turno = setInterval(function () {
        // Si la persona está leyendo el JSON o usando el teclado aquí, no le cambiamos el gráfico.
        if (document.activeElement && caja.closest('.capas').contains(document.activeElement)) return;
        mostrar((actual + 1) % EJEMPLOS.length, false);
      }, 7000);
      caja.closest('.capas').addEventListener('pointerenter', parar, { once: true });
    },
    '0px 0px 300px 0px',
  );
})();
