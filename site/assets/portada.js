/* Portada: titulares que se arman letra por letra, el gráfico de la tienda que se dibuja y los carteles. */
(function () {
  'use strict';
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  // La pone el script del <head>: prefers-reduced-motion, o ?reducido para probarlo.
  var quieto = document.documentElement.classList.contains('quieto');
  var movil = function () {
    return document.documentElement.clientWidth <= 640;
  };

  /** Llama a `fn` una vez, cuando `el` se acerca a la pantalla. */
  function alVer(el, fn, margen) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return fn();
    var io = new IntersectionObserver(
      function (entradas) {
        if (
          entradas.some(function (e) {
            return e.isIntersecting;
          })
        ) {
          io.disconnect();
          fn();
        }
      },
      { rootMargin: margen || '0px 0px 200px 0px' },
    );
    io.observe(el);
  }

  /**
   * Ajusta el alto pedido a un gráfico para que el gráfico entero (con su leyenda) ocupe justo su
   * caja, que tiene el alto reservado en el CSS. Devuelve el alto que hay que pedirle.
   */
  function altoPara(caja, extra) {
    return Math.max(140, Math.round(caja.clientHeight - (extra || 0)));
  }
  function sobrante(caja) {
    var raiz = caja.firstElementChild;
    return raiz ? raiz.getBoundingClientRect().height - caja.clientHeight : 0;
  }

  window.portada = { quieto: quieto, alVer: alVer, altoPara: altoPara, sobrante: sobrante, movil: movil };

  // ------------------------------------------------------------ Letras

  // Parte cada titular en letras (conserva los <span> de color). El nombre accesible queda entero.
  $$('[data-arma]').forEach(function (h) {
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    var i = 0;
    var andar = function (nodo) {
      Array.prototype.slice.call(nodo.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (pedazo) {
            if (!pedazo) return;
            if (/^\s+$/.test(pedazo)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            // Cada palabra junta, para que no se corte entre letras.
            var palabra = document.createElement('span');
            palabra.style.whiteSpace = 'nowrap';
            palabra.style.display = 'inline-block';
            Array.from(pedazo).forEach(function (c) {
              var s = document.createElement('span');
              s.className = 'l';
              s.textContent = c;
              s.style.setProperty('--i', i++);
              palabra.appendChild(s);
            });
            frag.appendChild(palabra);
          });
          nodo.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          andar(n);
        }
      });
    };
    andar(h);
    h.classList.add('partido');
    // Las letras sueltas se ocultan al lector de pantalla: el aria-label del titular manda.
    $$(':scope > *', h).forEach(function (hijo) {
      hijo.setAttribute('aria-hidden', 'true');
    });
  });

  // ------------------------------------------------------------ Ajustar al ancho

  /**
   * Titular de la portada: el tamaño lo pone el CSS (así el alto nunca cambia al cargar) y aquí
   * solo se ensancha la letra con el eje de ancho de Archivo hasta tocar los dos bordes.
   */
  function ensanchar(linea) {
    var dentro = linea.firstElementChild;
    var ancho = linea.clientWidth;
    if (!dentro || !ancho) return;
    linea.style.fontSize = '';
    var lo = 62;
    var hi = 125;
    linea.style.fontStretch = hi + '%';
    if (dentro.getBoundingClientRect().width <= ancho) return;
    for (var k = 0; k < 8; k++) {
      var mid = (lo + hi) / 2;
      linea.style.fontStretch = mid + '%';
      if (dentro.getBoundingClientRect().width > ancho) hi = mid;
      else lo = mid;
    }
    linea.style.fontStretch = lo + '%';
    // Si ni la letra más angosta cabe (no debería), se achica: mejor eso que cortarla.
    var w = dentro.getBoundingClientRect().width;
    if (w > ancho) linea.style.fontSize = (parseFloat(getComputedStyle(linea).fontSize) * ancho) / w + 'px';
  }

  /** Titulares de sección: cada línea crece hasta el ancho de su columna (con un tope de alto). */
  function ajustar(linea) {
    var dentro = linea.firstElementChild;
    if (!dentro) return;
    linea.style.fontSize = '100px';
    var ancho = linea.parentElement.clientWidth;
    var w = dentro.getBoundingClientRect().width;
    if (!w || !ancho) return;
    var talla = Math.min((100 * ancho) / w, innerHeight * 0.3);
    linea.style.fontSize = Math.max(28, Math.floor(talla * 0.99)) + 'px';
  }

  var lineasPortada = $$('.portada-titular .fit');
  var lineasSeccion = $$('.fit').filter(function (l) {
    return lineasPortada.indexOf(l) < 0;
  });
  function ajustarPortada() {
    lineasPortada.forEach(ensanchar);
  }
  // Las de sección se ajustan cuando les falta una pantalla para verse: el cambio de alto pasa
  // fuera de la vista y no mueve nada de lo que estás mirando.
  var ajustadas = [];
  function ajustarSecciones() {
    ajustadas.forEach(ajustar);
  }
  function prepararSecciones() {
    lineasSeccion.forEach(function (l) {
      alVer(
        l,
        function () {
          ajustadas.push(l);
          ajustar(l);
        },
        '0px 0px 100% 0px',
      );
    });
  }

  // ------------------------------------------------------------ Armar al entrar

  function observarTitulares() {
    var titulares = $$('.armar');
    if (quieto || !('IntersectionObserver' in window)) {
      titulares.forEach(function (t) {
        t.classList.add('armado');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('armado');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25 },
    );
    titulares.forEach(function (t) {
      io.observe(t);
    });
  }

  // ------------------------------------------------------------ Portada: la tienda

  var VIOLETA = '#9b6bff';
  var ROSA = '#ff4fa3';
  var HUESO = '#f4f2ee';
  // Los meses en el idioma de la página, con mayúscula y sin punto ('Dic', 'Dec', 'Dez').
  var nombreMes = function (estilo) {
    var f = new Intl.DateTimeFormat(LOCALE, { month: estilo, timeZone: 'UTC' });
    return Array.from({ length: 12 }, function (_, i) {
      var t = f.format(new Date(Date.UTC(2026, i, 15))).replace('.', '');
      return t.charAt(0).toLocaleUpperCase(LOCALE) + t.slice(1);
    });
  };
  var MESES = nombreMes('long');
  var CORTO = nombreMes('short');
  // El campo del mes también lo nombra la tabla para lectores de pantalla.
  var MES = tx({ es: 'mes', en: 'month', pt: 'mes' });
  var ONLINE = [34, 36, 43, 47, 52, 52, 55, 58, 57, 63, 78, 92];
  var TIENDA = [27, 25, 30, 32, 34, 33, 31, 35, 33, 36, 44, 51];
  var META = [74, 76, 78, 81, 83, 86, 88, 91, 93, 96, 112, 120];
  var VENTAS = CORTO.map(function (m, i) {
    var fila = {};
    fila[MES] = m;
    return Object.assign(fila, { online: ONLINE[i] * 1000, tienda: TIENDA[i] * 1000, meta: META[i] * 1000 });
  });
  var CEROS = VENTAS.map(function (r) {
    return Object.assign({}, r, { online: 0, tienda: 0, meta: 0 });
  });
  // Dólares en corto según el idioma: $143K en inglés y US$ 143 mil en portugués, con Intl. En
  // español Intl daría "143 mil US$"; la portada dice "$143 mil", como se dice en voz alta.
  var miles =
    IDIOMA === 'es'
      ? function (v) {
          return '$' + Math.round(v / 1000) + ' mil';
        }
      : new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 })
          .format;
  var milesSolos = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 0 }).format;
  // "23 mil sobre la meta": en español sin moneda (ya está arriba); en inglés y portugués, con ella.
  var frenteMeta = tx({
    es: function (v, bajo) {
      return milesSolos(v) + (bajo ? ' bajo la meta' : ' sobre la meta');
    },
    en: function (v, bajo) {
      return miles(v) + (bajo ? ' under goal' : ' over goal');
    },
    pt: function (v, bajo) {
      return miles(v) + (bajo ? ' abaixo da meta' : ' acima da meta');
    },
  });

  var figura = $('#figura');
  var gPortada = $('#g-portada');
  var portada = null;
  var extraPortada = 0; // lo que ocupa la leyenda, fuera del alto pedido
  var altoPedido = 0;

  function crearPortada() {
    altoPedido = altoPara(figura, 34);
    portada = new LozChart(gPortada, {
      theme: 'dark',
      background: false,
      currency: 'USD',
      locale: LOCALE,
      title: tx({ es: 'Ventas de una tienda en 2026', en: 'A store’s sales in 2026', pt: 'Vendas de uma loja em 2026' }),
      // Empieza en cero (sin animar) y al dibujarse sube a los datos reales con setData.
      data: quieto ? VENTAS : CEROS,
      xAxis: { field: MES },
      yAxis: { format: miles, min: 0, max: 150000 },
      series: [
        { type: 'bar', field: 'online', name: tx({ es: 'En línea', en: 'Online', pt: 'On-line' }), stack: true },
        { type: 'bar', field: 'tienda', name: tx({ es: 'En el local', en: 'In store', pt: 'Na loja' }), stack: true },
        { type: 'line', field: 'meta', name: tx({ es: 'Meta', en: 'Goal', pt: 'Meta' }), smooth: true },
      ],
      palette: [VIOLETA, ROSA, HUESO],
      legend: { position: 'bottom' },
      height: altoPedido,
      animate: false,
    });
    // El título queda para el lector de pantalla; en pantalla ya lo dice el cartel.
    var t = gPortada.querySelector('.lc-header');
    if (t) t.classList.add('sr-only');
    medirPortada();
  }
  // El alto pedido no cuenta la leyenda: se corrige midiendo lo que de verdad ocupa.
  function medirPortada() {
    for (var k = 0; k < 2; k++) {
      var sobra = sobrante(gPortada);
      if (Math.abs(sobra) < 2) return;
      extraPortada = Math.max(0, extraPortada + sobra);
      altoPedido = altoPara(figura, extraPortada);
      portada.setOptions({ height: altoPedido }, false);
    }
  }

  var lMes = $('#lectura-mes');
  var lValor = $('#lectura-valor');
  var lMeta = $('#lectura-meta');
  var ultimoIdx = -2;
  function leer(i) {
    if (i === ultimoIdx) return;
    ultimoIdx = i;
    var k = i < 0 ? 11 : i;
    var total = (ONLINE[k] + TIENDA[k]) * 1000;
    var dif = total - META[k] * 1000;
    lMes.textContent = MESES[k] + ' · ' + tx({ es: 'ventas', en: 'sales', pt: 'vendas' });
    lValor.textContent = miles(total);
    lMeta.textContent = frenteMeta(Math.abs(dif), dif < 0);
    lMeta.classList.toggle('bajo', dif < 0);
  }

  function zonaDatos() {
    var svg = gPortada.querySelector('svg.lc-svg');
    if (!svg) return null;
    var grid = svg.querySelector('.lc-grid') || svg;
    return grid.getBoundingClientRect();
  }
  var pendiente = null;
  function marcar(x) {
    pendiente = x;
    requestAnimationFrame(function () {
      if (pendiente === null || !portada) return;
      var r = zonaDatos();
      var px = pendiente;
      pendiente = null;
      if (!r || !r.width) return;
      var i = Math.floor(((px - r.left) / r.width) * VENTAS.length);
      i = Math.max(0, Math.min(VENTAS.length - 1, i));
      if (i !== ultimoIdx) portada.highlightIndex(i);
      leer(i);
    });
  }
  var zona = $('.portada');
  zona.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') marcar(e.clientX);
  });
  // En el celular, tocar una barra también cambia la cifra grande.
  figura.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') marcar(e.clientX);
  });
  zona.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'touch' || !portada) return;
    portada.highlight(null);
    leer(-1);
  });

  function dibujar() {
    figura.querySelector('.lapiz').style.setProperty('--w', figura.clientWidth + 'px');
    if (quieto) return;
    portada.setOptions({ animate: true }, false);
    portada.setData(VENTAS);
    figura.classList.add('dibujando');
  }

  // Contador de 0 al peso de la librería (data-cuenta).
  function contar() {
    if (quieto) return;
    $$('[data-cuenta]').forEach(function (el) {
      var fin = +el.getAttribute('data-cuenta');
      var t0 = performance.now();
      var paso = function (t) {
        var p = Math.min(1, Math.max(0, (t - t0) / 1400));
        el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(paso);
      };
      el.textContent = '0';
      requestAnimationFrame(paso);
    });
  }

  // ------------------------------------------------------------ Accesible

  var gAcc = $('#g-acc');
  var acc = null;
  function crearAcc() {
    var CIUDADES = tx({
      es: ['Lima', 'Bogotá', 'Quito', 'Santiago', 'Ciudad de México'],
      en: ['Lima', 'Bogotá', 'Quito', 'Santiago', 'Mexico City'],
      pt: ['Lima', 'Bogotá', 'Quito', 'Santiago', 'Cidade do México'],
    });
    var datos = CORTO.map(function (m, i) {
      var fila = {};
      fila[MES] = m;
      CIUDADES.forEach(function (c, k) {
        fila[c] = Math.round(([31, 24, 18, 27, 22][k] + i * (0.6 + k * 0.25) + 2 * Math.sin(i + k)) * 10) / 10;
      });
      return fila;
    });
    var opciones = {
      theme: 'dark',
      background: false,
      locale: LOCALE,
      title: tx({ es: 'Usuarios activos por ciudad', en: 'Active users by city', pt: 'Usuários ativos por cidade' }),
      subtitle: tx({ es: 'En miles, 2026', en: 'In thousands, 2026', pt: 'Em milhares, 2026' }),
      data: datos,
      xAxis: { field: MES },
      series: CIUDADES.map(function (c) {
        return { type: 'line', field: c, name: c };
      }),
      legend: false,
      endLabels: true,
      height: altoPara(gAcc, 64),
      animate: false,
    };
    acc = new LozChart(gAcc, opciones);
    // Se mide antes de animar: así la corrección de alto no corta la animación.
    var sobra = sobrante(gAcc);
    if (Math.abs(sobra) > 1) acc.setOptions({ height: opciones.height - sobra }, false);
    if (!quieto) acc.setOptions({ animate: true }, false);

    var voz = $('#voz');
    var svg = gAcc.querySelector('svg.lc-svg');
    if (svg && svg.getAttribute('aria-label')) voz.textContent = svg.getAttribute('aria-label');
    var vivo = gAcc.querySelector('[aria-live]');
    if (vivo)
      new MutationObserver(function () {
        var t = vivo.textContent.trim();
        if (t) voz.textContent = t;
      }).observe(vivo, { childList: true, characterData: true, subtree: true });
  }
  alVer(gAcc, crearAcc);
  $('#dalt').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    $('#marco-acc').classList.toggle('daltonismo', on);
    this.textContent = on
      ? tx({ es: 'Volver a los colores normales', en: 'Back to normal colors', pt: 'Voltar às cores normais' })
      : tx({ es: 'Verlo con daltonismo', en: 'See it with color blindness', pt: 'Ver com daltonismo' });
  });

  // ------------------------------------------------------------ Arranque y tamaño

  // El gráfico se crea enseguida (su caja ya tiene alto); las letras esperan a la fuente.
  crearPortada();
  var listo = false;
  function arrancar() {
    if (listo) return;
    listo = true;
    document.documentElement.classList.add('fuentes');
    ajustarPortada();
    dibujar();
    observarTitulares();
    contar();
    prepararSecciones();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(arrancar);
    setTimeout(arrancar, 1500); // si las fuentes tardan, no esperamos más
  } else arrancar();

  var espera;
  var anchoAntes = innerWidth;
  window.addEventListener('resize', function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      ajustarPortada();
      ajustarSecciones();
      if (portada) {
        altoPedido = altoPara(figura, extraPortada);
        portada.setOptions({ height: altoPedido }, false);
        medirPortada();
      }
      if (innerWidth !== anchoAntes) {
        anchoAntes = innerWidth;
        figura.querySelector('.lapiz').style.setProperty('--w', figura.clientWidth + 'px');
        if (acc) acc.setOptions({ height: altoPara(gAcc, 64) }, false);
      }
    }, 150);
  });
})();
