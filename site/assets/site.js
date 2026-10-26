/* Sitio de LozCharts: tema, resaltado de código y pestañas. Sin más dependencia que assets/idioma.js. */
(function () {
  // tx() viene de assets/idioma.js; si una página no lo carga, queda el español.
  var tx =
    window.tx ||
    function (o) {
      return o && o.es !== undefined ? o.es : o;
    };
  var KEY = 'lozcharts-tema';
  var charts = (window.siteCharts = window.siteCharts || []);

  // ------------------------------------------------------------ Tema

  function stored() {
    try {
      return localStorage.getItem(KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }
  var media = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  /** Modo efectivo: el elegido, o el del sistema si no se eligió. */
  function effective(t) {
    return t === 'auto' ? (media && media.matches ? 'dark' : 'light') : t;
  }
  function applyTheme(t) {
    var mode = effective(t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-mode', mode);
    document.querySelectorAll('.theme-btn').forEach(function (b) {
      b.setAttribute(
        'aria-label',
        mode === 'dark'
          ? tx({ es: 'Cambiar a modo claro', en: 'Switch to light mode', pt: 'Mudar para o modo claro' })
          : tx({ es: 'Cambiar a modo oscuro', en: 'Switch to dark mode', pt: 'Mudar para o modo escuro' }),
      );
    });
    charts.forEach(function (c) {
      c.setTheme(mode);
    });
  }
  window.siteTheme = function () {
    return effective(stored());
  };
  applyTheme(stored());
  if (media)
    media.addEventListener('change', function () {
      if (stored() === 'auto') applyTheme('auto');
    });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.theme-btn');
    if (!b) return;
    var t = effective(stored()) === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, t);
    } catch (err) {
      /* sin almacenamiento: el tema dura solo esta visita */
    }
    applyTheme(t);
  });

  // Los gráficos que crea cada página siguen el tema elegido.
  window.siteChart = function (chart, fixed) {
    // `fixed`: un gráfico que va siempre en oscuro (la portada) no sigue el tema.
    if (!fixed) {
      charts.push(chart);
      chart.setTheme(effective(stored()));
    }
    return chart;
  };

  // ------------------------------------------------------------ Mapa del mundo, cuando haga falta

  // Los contornos de los países pesan unos 110 KB y solo los usan los mapas. Las páginas los
  // dejan en una etiqueta que el navegador no baja,
  //   <script type="text/x-diferido" data-mapa src="lib/maps/world.umd.js?v=…"></script>
  // (así el armado del sitio igual le pone la versión), y siteMapa() los pide la primera vez que
  // un mapa los necesita. Devuelve una promesa; las siguientes llamadas reciben la misma.
  var mapa = null;
  window.siteMapa = function () {
    if (!mapa)
      mapa = new Promise(function (listo, fallo) {
        if (window.LozChartWorld) return listo();
        var marca = document.querySelector('script[data-mapa]');
        var s = document.createElement('script');
        s.src = (marca && marca.getAttribute('src')) || 'lib/maps/world.umd.js';
        s.onload = function () {
          listo();
        };
        s.onerror = function () {
          mapa = null;
          fallo(
            new Error(
              tx({
                es: 'No se pudo cargar el mapa del mundo',
                en: "Couldn't load the world map",
                pt: 'Não deu para carregar o mapa do mundo',
              }),
            ),
          );
        };
        document.head.appendChild(s);
      });
    return mapa;
  };

  // ------------------------------------------------------------ Código

  /** Resalta JS, JSON, HTML y Python de forma simple: textos, números, palabras clave y comentarios. */
  var KEYWORDS =
    /\b(new|const|let|var|function|return|import|from|export|default|class|def|if|else|for|in|true|false|null|undefined)\b/;
  function highlight(src) {
    var esc = function (s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var re =
      /(\/\/[^\n]*|#[^\n{]*$|<!--[\s\S]*?-->|\{#[\s\S]*?#\})|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]+\b)/gm;
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += '<span class="tok-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tok-s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tok-n">' + esc(m[3]) + '</span>';
      else if (KEYWORDS.test(m[4])) out += '<span class="tok-k">' + esc(m[4]) + '</span>';
      else out += esc(m[4]);
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }
  window.siteHighlight = highlight;
  document.querySelectorAll('pre.code > code').forEach(function (c) {
    c.innerHTML = highlight(c.textContent);
  });

  // ------------------------------------------------------------ Pestañas

  // <div class="tabs" role="tablist" data-tabs="grupo"> con botones data-tab="x" y paneles
  // [data-panel="grupo:x"]. Flechas izquierda y derecha mueven entre pestañas.
  document.querySelectorAll('[data-tabs]').forEach(function (list) {
    var group = list.getAttribute('data-tabs');
    var buttons = Array.prototype.slice.call(list.querySelectorAll('[data-tab]'));
    function select(btn, focus) {
      buttons.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        var panel = document.querySelector('[data-panel="' + group + ':' + b.getAttribute('data-tab') + '"]');
        if (panel) panel.hidden = !on;
      });
      if (focus) btn.focus();
      list.dispatchEvent(new CustomEvent('tabchange', { detail: btn.getAttribute('data-tab') }));
    }
    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () {
        select(b, false);
      });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select(buttons[(i + d + buttons.length) % buttons.length], true);
      });
    });
    select(buttons.find((b) => b.getAttribute('aria-selected') === 'true') || buttons[0], false);
  });
})();
