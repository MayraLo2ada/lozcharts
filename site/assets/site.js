/* Sitio de LozCharts: tema, resaltado de código y pestañas. Sin dependencias. */
(function () {
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
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('[data-theme-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-btn') === t));
    });
    charts.forEach(function (c) {
      c.setTheme(t);
    });
  }
  window.siteTheme = stored;
  applyTheme(stored());
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-btn]');
    if (!b) return;
    var t = b.getAttribute('data-theme-btn');
    try {
      localStorage.setItem(KEY, t);
    } catch (err) {
      /* sin almacenamiento: el tema dura solo esta visita */
    }
    applyTheme(t);
  });

  // Los gráficos que crea cada página siguen el tema elegido.
  window.siteChart = function (chart) {
    charts.push(chart);
    if (stored() !== 'auto') chart.setTheme(stored());
    return chart;
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
