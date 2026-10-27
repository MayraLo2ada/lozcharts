/*
 * Editor en vivo de gráficos por capas: JSON a la izquierda, gráfico a la derecha.
 *
 * - Al escribir se pinta el JSON al momento y el gráfico se redibuja 280 ms después de la última
 *   tecla. Si el JSON está mal escrito, el gráfico se queda como estaba bajo un velo y el error se
 *   señala en su línea; los avisos de la especificación (un campo que no existe, un ícono mal
 *   escrito) también llevan su línea y se pueden pulsar para ir a ella.
 * - Compartir guarda el JSON en el # de la dirección, comprimido si el navegador sabe hacerlo.
 */
(function () {
  'use strict';

  var corto = function (l) {
    return l.slice(0, 2);
  };
  var EJEMPLOS = window.capasEjemplos('es');
  var Lector = window.LectorJSON;
  var RETRASO = 280;

  var $ = function (id) {
    return document.getElementById(id);
  };
  var fuente = $('fuente');
  var pintado = $('pintado');
  var margen = $('margen');
  var estado = $('estado');
  var velo = $('velo');
  var medida = $('medida');
  var grafico = $('grafico');
  var aviso = $('aviso');

  var chart = null;
  var actual = null;
  var idioma = 'es';
  var temporizador = 0;
  var lineasConError = {};
  var escapePrevio = false;

  // ------------------------------------------------------------ Tema e idioma

  function tema() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }

  function marcar(grupo, atributo, valor) {
    grupo.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute(atributo) === valor));
    });
  }

  var botonesTema = Array.prototype.slice.call(document.querySelectorAll('[data-tema]'));
  var botonesIdioma = Array.prototype.slice.call(document.querySelectorAll('[data-idioma]'));
  marcar(botonesTema, 'data-tema', tema());
  botonesTema.forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-tema');
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem('capas-tema', t);
      } catch (e) {}
      marcar(botonesTema, 'data-tema', t);
      if (chart) chart.setTheme(t);
      dibujarIconos(true);
    });
  });
  botonesIdioma.forEach(function (b) {
    b.addEventListener('click', function () {
      idioma = b.getAttribute('data-idioma');
      marcar(botonesIdioma, 'data-idioma', idioma);
      // Los ejemplos tienen sus textos en cada idioma: el que está abierto se vuelve a cargar.
      EJEMPLOS = window.capasEjemplos(corto(idioma));
      if (actual) elegir(actual, true);
      else dibujar(false);
    });
  });

  // ------------------------------------------------------------ JSON bonito y pintado

  /** JSON con sangría de 2, pero las filas cortas en una sola línea: así los datos se leen como tabla. */
  function bonito(v, sangria) {
    sangria = sangria || '';
    var plano = JSON.stringify(v);
    if (v === null || typeof v !== 'object') return plano;
    var hondo = sangria + '  ';
    var corto = Array.isArray(v)
      ? v.every(function (x) {
          return x === null || typeof x !== 'object';
        })
      : Object.keys(v).every(function (k) {
          return v[k] === null || typeof v[k] !== 'object' || (Array.isArray(v[k]) && JSON.stringify(v[k]).length < 60);
        });
    // Una fila de datos (solo valores simples) va siempre en una línea, aunque sea larga.
    var simple = Object.keys(v).every(function (k) {
      return v[k] === null || typeof v[k] !== 'object';
    });
    if (corto && (simple || plano.length + sangria.length <= 260)) return enLinea(v);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return (
        '[\n' +
        v
          .map(function (x) {
            return hondo + bonito(x, hondo);
          })
          .join(',\n') +
        '\n' +
        sangria +
        ']'
      );
    }
    var claves = Object.keys(v);
    if (!claves.length) return '{}';
    return (
      '{\n' +
      claves
        .map(function (k) {
          return hondo + JSON.stringify(k) + ': ' + bonito(v[k], hondo);
        })
        .join(',\n') +
      '\n' +
      sangria +
      '}'
    );
  }

  function enLinea(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(enLinea).join(', ') + ']';
    var claves = Object.keys(v);
    if (!claves.length) return '{}';
    return (
      '{ ' +
      claves
        .map(function (k) {
          return JSON.stringify(k) + ': ' + enLinea(v[k]);
        })
        .join(', ') +
      ' }'
    );
  }

  var escapar = function (s) {
    return s.replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  };

  /** Pinta el JSON: claves, textos (con sus {plantillas}), números, palabras y signos. */
  function pintar(texto) {
    var re = /("(?:\\.|[^"\\\n])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g;
    var out = '';
    var desde = 0;
    var m;
    while ((m = re.exec(texto))) {
      out += escapar(texto.slice(desde, m.index));
      if (m[1] && m[2] !== undefined) out += '<span class="t-clave">' + escapar(m[1]) + '</span>' + escapar(m[2]);
      else if (m[1])
        out +=
          '<span class="t-texto">' +
          escapar(m[1]).replace(/\{[^{}]*\}/g, function (p) {
            return '<span class="t-plantilla">' + p + '</span>';
          }) +
          '</span>';
      else if (m[3]) out += '<span class="t-numero">' + m[3] + '</span>';
      else if (m[4]) out += '<span class="t-palabra">' + m[4] + '</span>';
      else out += '<span class="t-signo">' + m[5] + '</span>';
      desde = re.lastIndex;
    }
    out += escapar(texto.slice(desde));
    // Una línea vacía al final mantiene el alto igual al del textarea.
    pintado.innerHTML = out + '\n';
    numerar(texto);
  }

  function numerar(texto) {
    var n = texto.split('\n').length;
    var html = '';
    for (var k = 1; k <= n; k++) {
      var tipo = lineasConError[k];
      html += '<span' + (tipo ? ' class="con-' + tipo + '"' : '') + '>' + k + '</span>';
    }
    margen.innerHTML = html;
  }

  function sincronizar() {
    pintado.style.transform = 'translate(' + -fuente.scrollLeft + 'px,' + -fuente.scrollTop + 'px)';
    margen.style.transform = 'translateY(' + -fuente.scrollTop + 'px)';
  }

  // ------------------------------------------------------------ Dibujo

  function contar(n, uno, varios) {
    return n + ' ' + (n === 1 ? uno : varios);
  }

  function mostrarEstado(items, resumen) {
    estado.innerHTML = '';
    if (!items.length) {
      var ok = document.createElement('p');
      ok.className = 'estado-ok';
      ok.innerHTML = '<span class="sello" aria-hidden="true">✓</span>';
      ok.appendChild(document.createTextNode('Todo en orden. ' + resumen));
      estado.appendChild(ok);
      return;
    }
    var lista = document.createElement('ul');
    lista.className = 'problemas';
    items.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'problema problema-' + p.nivel;
      var b = document.createElement('button');
      b.type = 'button';
      var linea = document.createElement('span');
      linea.className = 'problema-linea';
      linea.textContent = 'Línea ' + p.linea;
      var texto = document.createElement('span');
      texto.className = 'problema-texto';
      if (p.ruta) {
        var ruta = document.createElement('code');
        ruta.textContent = p.ruta;
        texto.appendChild(ruta);
        texto.appendChild(document.createTextNode(' '));
      }
      texto.appendChild(document.createTextNode(p.mensaje));
      b.appendChild(linea);
      b.appendChild(texto);
      b.addEventListener('click', function () {
        irALinea(p.linea, p.columna);
      });
      li.appendChild(b);
      lista.appendChild(li);
    });
    estado.appendChild(lista);
  }

  function irALinea(linea, columna) {
    var lineas = fuente.value.split('\n');
    var pos = 0;
    for (var k = 0; k < linea - 1 && k < lineas.length; k++) pos += lineas[k].length + 1;
    pos += Math.max(0, (columna || 1) - 1);
    fuente.focus();
    fuente.setSelectionRange(pos, pos);
    var alto = parseFloat(getComputedStyle(fuente).lineHeight) || 20;
    fuente.scrollTop = Math.max(0, (linea - 4) * alto);
    sincronizar();
  }

  /** Lee el JSON, revisa la especificación y dibuja. `nuevo`: con la animación de entrada. */
  function dibujar(nuevo) {
    var texto = fuente.value;
    var leido;
    lineasConError = {};
    try {
      leido = Lector.leer(texto);
    } catch (e) {
      if (!(e instanceof Lector.JsonError)) throw e;
      lineasConError[e.line] = 'error';
      numerar(texto);
      mostrarEstado([{ nivel: 'error', linea: e.line, columna: e.column, ruta: '', mensaje: e.message }]);
      velo.hidden = !chart;
      return;
    }
    velo.hidden = true;
    var spec = leido.valor;
    var conIdioma =
      spec && typeof spec === 'object' && !Array.isArray(spec)
        ? Object.assign({}, spec, { locale: idioma, theme: tema() })
        : spec;
    var problemas = LozChart.checkLayers(conIdioma, idioma);
    var items = problemas.map(function (p) {
      var linea = Lector.lineaDe(leido.lineas, p.path);
      if (lineasConError[linea] !== 'error') lineasConError[linea] = p.level;
      return { nivel: p.level, linea: linea, ruta: p.path, mensaje: p.message };
    });
    numerar(texto);
    var t0 = performance.now();
    var opciones = LozChart.layerOptions(conIdioma);
    try {
      if (!chart || nuevo) {
        if (chart) chart.destroy();
        chart = new LozChart(grafico, opciones);
      } else {
        chart.__altoNatural = 0;
        chart.setOptions(opciones, false);
      }
    } catch (e) {
      items.push({ nivel: 'error', linea: 1, ruta: '', mensaje: String(e && e.message ? e.message : e) });
    }
    ajustarAlto(conIdioma);
    var ms = Math.max(1, Math.round(performance.now() - t0));
    var capas = Array.isArray(spec && spec.layers) ? spec.layers.length : 0;
    var datos = opciones.data.length;
    var resumen =
      contar(capas, 'capa', 'capas') + ' y ' + contar(datos, 'dato que puedes recorrer', 'datos que puedes recorrer') + '.';
    medida.textContent = 'Dibujado en ' + ms + ' ms';
    mostrarEstado(items, resumen);
    document.body.classList.remove('redibujo');
    void document.body.offsetWidth;
    document.body.classList.add('redibujo');
  }

  /**
   * Sin "height" en el JSON, el gráfico ocupa el alto que deja el editor (nunca menos del suyo): así
   * el panel no queda con un hueco abajo. Con "height", manda el JSON.
   */
  function ajustarAlto(spec) {
    if (!chart || !spec || typeof spec !== 'object' || spec.height !== undefined) return;
    var panel = document.querySelector('.panel-codigo');
    var lienzo = document.getElementById('lienzo');
    var cabeza = grafico.querySelector('.lc-header');
    var svg = grafico.querySelector('svg');
    if (!panel || !svg) return;
    var resto =
      document.querySelector('.panel-grafico .panel-cabeza').offsetHeight + document.querySelector('.pista').offsetHeight;
    var relleno = parseFloat(getComputedStyle(lienzo).paddingTop) * 2;
    var libre =
      panel.offsetHeight -
      resto -
      relleno -
      (cabeza ? cabeza.offsetHeight + parseFloat(getComputedStyle(cabeza).marginBottom) : 0) -
      4;
    var natural = chart.__altoNatural || svg.getBoundingClientRect().height;
    chart.__altoNatural = natural;
    // En el celular el editor va debajo: el gráfico se queda con su alto.
    if (getComputedStyle(document.querySelector('.taller')).gridTemplateColumns.split(' ').length < 2) return;
    var alto = Math.round(Math.max(natural, libre));
    if (Math.abs(alto - svg.getBoundingClientRect().height) > 2) chart.setOptions({ height: alto }, false);
  }

  function programar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      dibujar(false);
    }, RETRASO);
  }

  // ------------------------------------------------------------ Escritura

  fuente.addEventListener('input', function () {
    pintar(fuente.value);
    sincronizar();
    programar();
  });
  fuente.addEventListener('scroll', sincronizar);
  fuente.addEventListener('keydown', function (e) {
    // Tab sangra; Escape y después Tab sale del editor, como en cualquier editor accesible.
    if (e.key === 'Escape') {
      escapePrevio = true;
      return;
    }
    if (e.key === 'Tab' && !escapePrevio && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      insertar(e.shiftKey ? '' : '  ');
    } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      // La línea nueva conserva la sangría, y una más después de { o [.
      var antes = fuente.value.slice(0, fuente.selectionStart);
      var lineaActual = antes.slice(antes.lastIndexOf('\n') + 1);
      var sangria = /^\s*/.exec(lineaActual)[0];
      if (/[{[]\s*$/.test(lineaActual)) sangria += '  ';
      e.preventDefault();
      insertar('\n' + sangria);
    }
    escapePrevio = false;
  });

  function insertar(texto) {
    var a = fuente.selectionStart;
    var b = fuente.selectionEnd;
    // execCommand conserva el deshacer del navegador; si no existe, se escribe a mano.
    if (!document.execCommand || !document.execCommand('insertText', false, texto)) {
      fuente.value = fuente.value.slice(0, a) + texto + fuente.value.slice(b);
      fuente.selectionStart = fuente.selectionEnd = a + texto.length;
      fuente.dispatchEvent(new Event('input'));
    }
  }

  function cargarTexto(texto, nuevo) {
    fuente.value = texto;
    fuente.scrollTop = 0;
    fuente.scrollLeft = 0;
    pintar(texto);
    sincronizar();
    dibujar(nuevo);
  }

  // ------------------------------------------------------------ Ejemplos

  var rieles = $('ejemplos');
  EJEMPLOS.forEach(function (ej, k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'riel';
    b.setAttribute('role', 'listitem');
    b.dataset.id = ej.id;
    b.innerHTML =
      '<span class="riel-num">0' + (k + 1) + '</span><span class="riel-nombre"></span><span class="riel-resumen"></span>';
    b.querySelector('.riel-nombre').textContent = ej.nombre;
    b.querySelector('.riel-resumen').textContent = ej.resumen;
    b.addEventListener('click', function () {
      elegir(ej.id, true);
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });
    rieles.appendChild(b);
  });

  function elegir(id, nuevo) {
    var ej = EJEMPLOS.filter(function (x) {
      return x.id === id;
    })[0];
    if (!ej) return;
    actual = id;
    Array.prototype.forEach.call(rieles.children, function (b) {
      b.setAttribute('aria-current', String(b.dataset.id === id));
    });
    cargarTexto(bonito(ej.spec), nuevo);
  }

  // ------------------------------------------------------------ Copiar y compartir

  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('visible');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(function () {
      aviso.classList.remove('visible');
    }, 2200);
  }

  function copiar(texto, mensaje) {
    var hecho = function () {
      avisar(mensaje);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho, respaldo);
    else respaldo();
    function respaldo() {
      var t = document.createElement('textarea');
      t.value = texto;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try {
        document.execCommand('copy');
        hecho();
      } catch (e) {
        avisar('No pude copiar; selecciona el texto y cópialo a mano.');
      }
      t.remove();
    }
  }

  function aBase64(bytes) {
    var s = '';
    for (var k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deBase64(s) {
    var b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(b.length);
    for (var k = 0; k < b.length; k++) out[k] = b.charCodeAt(k);
    return out;
  }

  /** El JSON para el #: comprimido ("z…") si el navegador sabe, o tal cual ("j…"). */
  function empaquetar(texto) {
    var compacto = texto;
    try {
      compacto = JSON.stringify(JSON.parse(texto));
    } catch (e) {}
    if (typeof CompressionStream !== 'function') return Promise.resolve('j' + encodeURIComponent(compacto));
    var flujo = new Blob([compacto]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Response(flujo).arrayBuffer().then(function (buf) {
      return 'z' + aBase64(new Uint8Array(buf));
    });
  }

  function desempaquetar(hash) {
    if (hash[0] === 'j') return Promise.resolve(decodeURIComponent(hash.slice(1)));
    if (hash[0] !== 'z' || typeof DecompressionStream !== 'function') return Promise.reject(new Error('formato'));
    var flujo = new Blob([deBase64(hash.slice(1))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flujo).text();
  }

  $('copiar').addEventListener('click', function () {
    copiar(fuente.value, 'JSON copiado');
  });
  $('compartir').addEventListener('click', function () {
    empaquetar(fuente.value).then(function (h) {
      history.replaceState(null, '', '#' + h);
      copiar(location.href, 'Enlace copiado: quien lo abra ve este mismo gráfico');
    });
  });
  $('formatear').addEventListener('click', function () {
    try {
      cargarTexto(bonito(Lector.leer(fuente.value).valor), false);
      avisar('Listo, sangrías en orden');
    } catch (e) {
      avisar('Primero arregla el error marcado');
    }
  });

  // ------------------------------------------------------------ Íconos de la chuleta

  var columnasIconos = 0;
  var graficoIconos = null;
  /** La galería de íconos es otro gráfico por capas: cada ícono en su lugar, con su nombre debajo. */
  function dibujarIconos(forzar) {
    var caja = $('iconos');
    var nombres = LozChart.ICON_NAMES || [];
    $('cuenta-iconos').textContent = String(nombres.length);
    var columnas = Math.max(4, Math.min(7, Math.floor(caja.clientWidth / 74)));
    if (!forzar && columnas === columnasIconos && graficoIconos) return;
    columnasIconos = columnas;
    var filas = Math.ceil(nombres.length / columnas);
    var spec = {
      locale: idioma,
      theme: tema(),
      height: filas * 68,
      data: nombres.map(function (n, k) {
        return { nombre: n, col: k % columnas, fila: Math.floor(k / columnas) };
      }),
      scales: { x: { type: 'band', axis: false }, y: { type: 'band', axis: false } },
      layers: [
        {
          mark: 'icon',
          x: 'col',
          y: 'fila',
          icon: { field: 'nombre' },
          size: 30,
          position: 'top',
          dy: 14,
          color: 'violet',
          title: '"{nombre}"',
        },
        { mark: 'text', x: 'col', y: 'fila', text: '{nombre}', position: 'bottom', size: 11, color: 'muted' },
      ],
    };
    if (graficoIconos) graficoIconos.destroy();
    graficoIconos = LozChart.layers(caja, spec);
  }

  // ------------------------------------------------------------ Arranque

  var redimensionar = 0;
  addEventListener('resize', function () {
    clearTimeout(redimensionar);
    redimensionar = setTimeout(function () {
      dibujarIconos(false);
      if (chart) dibujar(false);
    }, 200);
  });

  function inicio() {
    var hash = location.hash.slice(1);
    dibujarIconos(true);
    if (hash) {
      desempaquetar(hash).then(
        function (texto) {
          var limpio = texto;
          try {
            limpio = bonito(JSON.parse(texto));
          } catch (e) {}
          actual = null;
          cargarTexto(limpio, true);
          avisar('Abriste un gráfico compartido');
        },
        function () {
          elegir(EJEMPLOS[0].id, true);
        },
      );
    } else elegir(EJEMPLOS[0].id, true);
  }

  window.capas = {
    elegir: function (id) {
      elegir(id, true);
    },
    get chart() {
      return chart;
    },
  };
  inicio();
})();
