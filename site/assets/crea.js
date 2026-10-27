/*
 * «Crea el tuyo»: el editor de gráficos por capas. JSON a la izquierda, gráfico a la derecha.
 *
 * - Al escribir se pinta el JSON al momento y el gráfico se redibuja 280 ms después de la última
 *   tecla. Si el JSON está mal escrito, el gráfico se queda como estaba bajo un velo y el error se
 *   marca en su línea; los avisos de la especificación (un campo que no existe, un ícono mal
 *   escrito) también llevan su línea y se pueden pulsar para ir a ella.
 * - Los ejemplos vienen de assets/capas-ejemplos.js, en el idioma de la página. ?ej=notas abre uno
 *   (así enlaza la galería) y Compartir guarda el JSON en el # de la dirección, comprimido si el
 *   navegador sabe hacerlo.
 * - El gráfico sigue el tema del sitio (siteChart) y, si es un mapa, pide el mapa del mundo antes.
 */
(function () {
  'use strict';

  var Lector = window.LectorJSON;
  var RETRASO = 280;
  var EJEMPLOS = window.capasEjemplos(window.IDIOMA);

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
  var temporizador = 0;
  var lineasConError = {};
  var escapePrevio = false;

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

  // ------------------------------------------------------------ Estado

  function resumen(capas, datos) {
    return tx({
      es:
        capas +
        (capas === 1 ? ' capa' : ' capas') +
        ' y ' +
        datos +
        (datos === 1 ? ' dato que puedes recorrer.' : ' datos que puedes recorrer.'),
      en:
        capas +
        (capas === 1 ? ' layer' : ' layers') +
        ' and ' +
        datos +
        (datos === 1 ? ' item you can explore.' : ' items you can explore.'),
      pt:
        capas +
        (capas === 1 ? ' camada' : ' camadas') +
        ' e ' +
        datos +
        (datos === 1 ? ' item para percorrer.' : ' itens para percorrer.'),
    });
  }

  function mostrarEstado(items, texto) {
    estado.innerHTML = '';
    if (!items.length) {
      var ok = document.createElement('p');
      ok.className = 'crea-ok';
      ok.innerHTML = '<span class="crea-sello" aria-hidden="true">✓</span>';
      ok.appendChild(document.createTextNode(tx({ es: 'Todo en orden. ', en: 'All good. ', pt: 'Tudo certo. ' }) + texto));
      estado.appendChild(ok);
      return;
    }
    var lista = document.createElement('ul');
    lista.className = 'crea-problemas';
    items.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'crea-problema crea-' + p.nivel;
      var b = document.createElement('button');
      b.type = 'button';
      var linea = document.createElement('span');
      linea.className = 'crea-linea';
      linea.textContent = tx({ es: 'Línea ', en: 'Line ', pt: 'Linha ' }) + p.linea;
      var cuerpo = document.createElement('span');
      if (p.ruta) {
        var ruta = document.createElement('code');
        ruta.textContent = p.ruta;
        cuerpo.appendChild(ruta);
        cuerpo.appendChild(document.createTextNode(' '));
      }
      cuerpo.appendChild(document.createTextNode(p.mensaje));
      b.append(linea, cuerpo);
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

  // ------------------------------------------------------------ Dibujo

  /**
   * Sin "height" en el JSON, el gráfico ocupa el alto que deja el editor (nunca menos del suyo): así
   * el panel no queda con un hueco abajo. Con "height", manda el JSON. En el celular, el suyo.
   */
  function ajustarAlto(spec) {
    if (!chart || !spec || typeof spec !== 'object' || spec.height !== undefined) return;
    var panel = document.querySelector('.crea-codigo-panel');
    var lienzo = $('lienzo');
    var cabeza = grafico.querySelector('.lc-header');
    var svg = grafico.querySelector('svg');
    if (!panel || !svg) return;
    if (getComputedStyle($('taller')).gridTemplateColumns.split(' ').length < 2) return;
    var resto =
      document.querySelector('.crea-grafico-panel .crea-cabeza-panel').offsetHeight +
      document.querySelector('.crea-pista').offsetHeight;
    var relleno = parseFloat(getComputedStyle(lienzo).paddingTop) * 2;
    var titulo = cabeza ? cabeza.offsetHeight + parseFloat(getComputedStyle(cabeza).marginBottom) : 0;
    var libre = panel.offsetHeight - resto - relleno - titulo - 4;
    var natural = chart.__natural || svg.getBoundingClientRect().height;
    chart.__natural = natural;
    var alto = Math.round(Math.max(natural, libre));
    if (Math.abs(alto - svg.getBoundingClientRect().height) > 2) chart.setOptions({ height: alto }, false);
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
    var esObjeto = spec && typeof spec === 'object' && !Array.isArray(spec);
    // Un mapa necesita el mundo: se pide la primera vez y se vuelve a dibujar cuando llega.
    if (esObjeto && spec.geo && !window.LozChartWorld) {
      window.siteMapa().then(function () {
        dibujar(nuevo);
      });
      return;
    }
    var problemas = LozChart.checkLayers(spec, window.LOCALE);
    var items = problemas.map(function (p) {
      var linea = Lector.lineaDe(leido.lineas, p.path);
      if (lineasConError[linea] !== 'error') lineasConError[linea] = p.level;
      return { nivel: p.level, linea: linea, ruta: p.path, mensaje: p.message };
    });
    numerar(texto);
    var t0 = performance.now();
    // Sin fondo propio (toma el del panel) y con el tema del sitio.
    var opciones = LozChart.layerOptions(
      esObjeto ? Object.assign({ locale: window.LOCALE }, spec, { background: false, theme: window.siteTheme() }) : spec,
    );
    try {
      if (!chart || nuevo) {
        if (chart) chart.destroy();
        chart = window.siteChart(new LozChart(grafico, opciones));
      } else {
        chart.__natural = 0;
        chart.setOptions(opciones, false);
      }
    } catch (e) {
      items.push({ nivel: 'error', linea: 1, ruta: '', mensaje: String(e && e.message ? e.message : e) });
    }
    ajustarAlto(spec);
    var ms = Math.max(1, Math.round(performance.now() - t0));
    var capas = esObjeto && Array.isArray(spec.layers) ? spec.layers.length : 0;
    medida.textContent = tx({ es: 'Dibujado en ', en: 'Drawn in ', pt: 'Desenhado em ' }) + ms + ' ms';
    mostrarEstado(items, resumen(capas, opciones.data.length));
    var panel = document.querySelector('.crea-grafico-panel');
    panel.classList.remove('crea-redibujo');
    void panel.offsetWidth;
    panel.classList.add('crea-redibujo');
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
    // Tab sangra; Escape y después Tab sale del editor.
    if (e.key === 'Escape') {
      escapePrevio = true;
      return;
    }
    if (e.key === 'Tab' && !escapePrevio && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (!e.shiftKey) insertar('  ');
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

  var lista = $('ejemplos');
  EJEMPLOS.forEach(function (ej) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = ej.id;
    b.setAttribute('aria-pressed', 'false');
    b.title = ej.resumen;
    b.textContent = ej.nombre;
    b.addEventListener('click', function () {
      elegir(ej.id, true);
      history.replaceState(null, '', location.pathname + '?ej=' + ej.id);
    });
    lista.appendChild(b);
  });

  function elegir(id, nuevo) {
    var ej =
      EJEMPLOS.filter(function (x) {
        return x.id === id;
      })[0] || EJEMPLOS[0];
    Array.prototype.forEach.call(lista.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.id === ej.id));
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
    }, 2400);
  }

  function copiar(texto, mensaje) {
    var hecho = function () {
      avisar(mensaje);
    };
    var respaldo = function () {
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
        avisar(
          tx({
            es: 'No pude copiar; selecciónalo y cópialo a mano.',
            en: 'Couldn’t copy; select it and copy it by hand.',
            pt: 'Não deu para copiar; selecione e copie à mão.',
          }),
        );
      }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(hecho, respaldo);
    else respaldo();
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
    } catch (e) {
      /* con un error, va tal cual: quien lo abra ve el mismo error */
    }
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
    copiar(fuente.value, tx({ es: 'JSON copiado', en: 'JSON copied', pt: 'JSON copiado' }));
  });
  $('compartir').addEventListener('click', function () {
    empaquetar(fuente.value).then(function (h) {
      history.replaceState(null, '', location.pathname + '#' + h);
      copiar(
        location.href,
        tx({
          es: 'Enlace copiado: quien lo abra ve este mismo gráfico',
          en: 'Link copied: whoever opens it sees this same chart',
          pt: 'Link copiado: quem abrir vê este mesmo gráfico',
        }),
      );
    });
  });
  $('formatear').addEventListener('click', function () {
    try {
      cargarTexto(bonito(Lector.leer(fuente.value).valor), false);
      avisar(tx({ es: 'Listo, sangrías en orden', en: 'Done, indentation tidied up', pt: 'Pronto, recuos organizados' }));
    } catch (e) {
      avisar(
        tx({ es: 'Primero arregla el error marcado', en: 'Fix the marked error first', pt: 'Primeiro arrume o erro marcado' }),
      );
    }
  });

  // ------------------------------------------------------------ Íconos de la guía

  var columnasIconos = 0;
  var graficoIconos = null;
  /** La galería de íconos es otro gráfico por capas: cada ícono en su lugar, con su nombre debajo. */
  function dibujarIconos() {
    var caja = $('iconos');
    var nombres = LozChart.ICON_NAMES || [];
    var columnas = Math.max(4, Math.min(8, Math.floor(caja.clientWidth / 82)));
    if (columnas === columnasIconos && graficoIconos) return;
    columnasIconos = columnas;
    var filas = Math.ceil(nombres.length / columnas);
    var spec = {
      locale: window.LOCALE,
      background: false,
      theme: window.siteTheme(),
      height: filas * 74,
      data: nombres.map(function (n, k) {
        return { nombre: n, col: k % columnas, fila: Math.floor(k / columnas) };
      }),
      scales: { x: { type: 'band', axis: false }, y: { type: 'band', axis: false } },
      layers: [
        { mark: 'icon', x: 'col', y: 'fila', icon: { field: 'nombre' }, size: 28, position: 'top', dy: 14, title: '"{nombre}"' },
        { mark: 'text', x: 'col', y: 'fila', text: '{nombre}', position: 'bottom', size: 12, color: 'muted' },
      ],
    };
    if (graficoIconos) graficoIconos.destroy();
    graficoIconos = window.siteChart(LozChart.layers(caja, spec));
  }

  // ------------------------------------------------------------ Arranque

  var espera = 0;
  addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      dibujarIconos();
      if (chart) dibujar(false);
    }, 200);
  });

  dibujarIconos();
  var hash = location.hash.slice(1);
  var pedido = new URLSearchParams(location.search).get('ej');
  if (hash) {
    desempaquetar(hash).then(
      function (texto) {
        var limpio = texto;
        try {
          limpio = bonito(JSON.parse(texto));
        } catch (e) {
          /* un JSON con errores se muestra tal cual, con su error marcado */
        }
        cargarTexto(limpio, true);
        avisar(
          tx({ es: 'Abriste un gráfico compartido', en: 'You opened a shared chart', pt: 'Você abriu um gráfico compartilhado' }),
        );
      },
      function () {
        elegir(pedido, true);
      },
    );
  } else elegir(pedido, true);
})();
