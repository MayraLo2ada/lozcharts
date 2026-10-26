/* Laboratorio: el gráfico que cambia de tipo y de datos, y el código que lo dibuja, en vivo. */
(function () {
  'use strict';
  var $ = function (id) {
    return document.getElementById(id);
  };
  var P = window.portada;
  var quieto = P.quieto;

  // ------------------------------------------------------------ Datos de ejemplo

  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Cada juego de datos es una jerarquía (grupo › elemento) con un valor por mes y un reparto
  // final (para el sankey). De ahí salen las seis vistas: son los mismos números.
  var JUEGOS = [
    {
      id: 'panaderia',
      boton: 'Una panadería',
      rotulo: 'Ventas del semestre',
      formato: 'currency',
      meses: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
      temporada: [0.92, 0.86, 0.97, 1.08, 1.12, 1.02],
      campos: { grupo: 'categoria', item: 'producto', valor: 'ventas' },
      nombreValor: 'Ventas',
      grupos: [
        [
          'Panes',
          [
            ['Pan francés', 2400],
            ['Integral', 980],
            ['Croissant', 1350],
          ],
        ],
        [
          'Pasteles',
          [
            ['Tres leches', 1620],
            ['Torta de chocolate', 1180],
          ],
        ],
        [
          'Bebidas',
          [
            ['Café', 1900],
            ['Chocolate caliente', 640],
          ],
        ],
      ],
      destinos: [
        ['En el mostrador', 0.68],
        ['A domicilio', 0.32],
      ],
    },
    {
      id: 'web',
      boton: 'Un sitio web',
      rotulo: 'Visitas del semestre',
      formato: 'compact',
      meses: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
      temporada: [0.8, 0.88, 1, 1.06, 1.18, 1.3],
      campos: { grupo: 'fuente', item: 'pagina', valor: 'visitas' },
      nombreValor: 'Visitas',
      grupos: [
        [
          'Buscadores',
          [
            ['Blog', 5200],
            ['Guías', 3100],
          ],
        ],
        [
          'Redes sociales',
          [
            ['Videos', 4300],
            ['Fotos', 1900],
            ['Historias', 1200],
          ],
        ],
        [
          'Directo',
          [
            ['Inicio', 2600],
            ['Tienda', 1750],
          ],
        ],
      ],
      destinos: [
        ['Siguieron leyendo', 0.52],
        ['Se fueron', 0.4],
        ['Compraron', 0.08],
      ],
    },
    {
      id: 'goles',
      boton: 'Un equipo de fútbol',
      rotulo: 'Goles de la temporada',
      formato: 'number',
      meses: ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'],
      temporada: [0.9, 1.1, 1, 1.2, 0.7, 1.1],
      campos: { grupo: 'linea', item: 'jugador', valor: 'goles' },
      nombreValor: 'Goles',
      grupos: [
        [
          'Delanteros',
          [
            ['Ramírez', 4.2],
            ['Toledo', 2.6],
          ],
        ],
        [
          'Mediocampo',
          [
            ['Quispe', 1.6],
            ['Ávalos', 1.2],
            ['Mena', 0.9],
          ],
        ],
        [
          'Defensa',
          [
            ['Rivas', 0.7],
            ['Cárdenas', 0.5],
          ],
        ],
      ],
      destinos: [
        ['Con el pie', 0.62],
        ['De cabeza', 0.24],
        ['De penal', 0.14],
      ],
    },
  ];

  /** Genera los números de un juego con una semilla: misma semilla, mismos números. */
  function generar(juego, semilla) {
    var r = rng(semilla * 977 + juego.id.length * 31);
    var items = [];
    juego.grupos.forEach(function (g) {
      g[1].forEach(function (it) {
        var serie = juego.temporada.map(function (k) {
          return Math.max(0, Math.round(it[1] * k * (0.72 + r() * 0.56)));
        });
        var reparto = juego.destinos.map(function (d) {
          return d[1] * (0.7 + r() * 0.6);
        });
        var s = suma(reparto);
        items.push({
          grupo: g[0],
          nombre: it[0],
          serie: serie,
          reparto: reparto.map(function (x) {
            return x / s;
          }),
        });
      });
    });
    return items;
  }
  function suma(a) {
    return a.reduce(function (x, y) {
      return x + y;
    }, 0);
  }

  // ------------------------------------------------------------ Las seis vistas

  var TIPOS = [
    { id: 'bar', nombre: 'Barras' },
    { id: 'line', nombre: 'Líneas' },
    { id: 'area', nombre: 'Área' },
    { id: 'donut', nombre: 'Dona' },
    { id: 'sankey', nombre: 'Flujos' },
    { id: 'treemap', nombre: 'Rectángulos' },
  ];

  /** Opciones completas de LozCharts para un juego, sus números y un tipo. */
  function opciones(juego, items, tipo) {
    var c = juego.campos;
    var o = {};
    var porGrupo = juego.grupos.map(function (g) {
      return g[0];
    });
    if (tipo === 'bar' || tipo === 'line' || tipo === 'area') {
      o.data = juego.meses.map(function (mes, i) {
        var fila = { mes: mes };
        porGrupo.forEach(function (g) {
          fila[g] = suma(
            items
              .filter(function (it) {
                return it.grupo === g;
              })
              .map(function (it) {
                return it.serie[i];
              }),
          );
        });
        return fila;
      });
      o.xAxis = { field: 'mes', type: 'time' };
      o.yAxis = { format: juego.formato };
      o.series = porGrupo.map(function (g) {
        var s = { type: tipo, field: g, name: g };
        if (tipo !== 'line') s.stack = true;
        if (tipo !== 'bar') s.smooth = true;
        return s;
      });
      if (tipo === 'line') o.endLabels = true;
    } else if (tipo === 'donut') {
      o.data = items
        .map(function (it) {
          var f = {};
          f[c.item] = it.nombre;
          f[c.valor] = suma(it.serie);
          return f;
        })
        .sort(function (a, b) {
          return b[c.valor] - a[c.valor];
        });
      o.xAxis = { field: c.item };
      o.yAxis = { format: juego.formato };
      o.series = [{ type: 'donut', field: c.valor, name: juego.nombreValor }];
    } else if (tipo === 'treemap') {
      o.data = items.map(function (it) {
        var f = {};
        f[c.item] = it.nombre;
        f[c.grupo] = it.grupo;
        f[c.valor] = suma(it.serie);
        return f;
      });
      o.xAxis = { field: c.item };
      o.yAxis = { format: juego.formato };
      o.series = [{ type: 'treemap', field: c.valor, name: juego.nombreValor, group: c.grupo }];
    } else {
      var flujos = [];
      items.forEach(function (it) {
        flujos.push({ origen: it.grupo, destino: it.nombre, valor: suma(it.serie) });
      });
      items.forEach(function (it) {
        var total = suma(it.serie);
        juego.destinos.forEach(function (d, k) {
          var v = Math.round(total * it.reparto[k]);
          if (v > 0) flujos.push({ origen: it.nombre, destino: d[0], valor: v });
        });
      });
      o.data = flujos.map(function (f) {
        var fila = { origen: f.origen, destino: f.destino };
        fila[c.valor] = f.valor;
        return fila;
      });
      o.xAxis = { field: 'origen' };
      o.yAxis = { format: juego.formato };
      o.series = [{ type: 'sankey', field: c.valor, name: juego.nombreValor, to: 'destino' }];
    }
    o.theme = estado.claro ? 'light' : 'dark';
    return o;
  }

  // ------------------------------------------------------------ Código en vivo

  var clave = function (k) {
    return /^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'";
  };
  function valor(v) {
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (typeof v === 'number') return String(Math.round(v * 100) / 100);
    return String(v);
  }
  /** Escribe un valor como JavaScript legible: objetos cortos en una línea. */
  function js(v, sangria) {
    var pad = '  '.repeat(sangria);
    var pad2 = '  '.repeat(sangria + 1);
    if (Array.isArray(v)) {
      var simples = v.every(function (x) {
        return typeof x !== 'object';
      });
      if (simples) return '[' + v.map(valor).join(', ') + ']';
      return (
        '[\n' +
        v
          .map(function (x) {
            return pad2 + js(x, sangria + 1) + ',';
          })
          .join('\n') +
        '\n' +
        pad +
        ']'
      );
    }
    if (v && typeof v === 'object') {
      var partes = Object.keys(v).map(function (k) {
        return clave(k) + ': ' + js(v[k], sangria + 1);
      });
      var linea = '{ ' + partes.join(', ') + ' }';
      var plano = Object.keys(v).every(function (k) {
        return typeof v[k] !== 'object';
      });
      if ((plano || linea.length + pad.length < 62) && linea.indexOf('\n') < 0) return linea;
      return (
        '{\n' +
        partes
          .map(function (p) {
            return pad2 + p + ',';
          })
          .join('\n') +
        '\n' +
        pad +
        '}'
      );
    }
    return valor(v);
  }

  var completo = false; // al copiar van todas las filas
  function cuerpo(o, sangria) {
    var v = Object.assign({}, o);
    var n = v.data.length;
    if (!completo) v.data = v.data.slice(0, 4);
    var texto = js(v, sangria);
    if (!completo && n > 4) {
      var pad = '  '.repeat(sangria + 2);
      texto = texto.replace(/(data: \[[\s\S]*?\n)(\s*)\]/, function (_, a, b) {
        return a + pad + '// … ' + (n - 4) + ' filas más\n' + b + ']';
      });
    }
    return texto;
  }
  /** Las mismas opciones como diccionario de Python. */
  function python(texto) {
    return texto
      .replace(/\btrue\b/g, 'True')
      .replace(/\bfalse\b/g, 'False')
      .replace(/^(\s*)([A-Za-z_]\w*):/gm, "$1'$2':")
      .replace(/\{ ([A-Za-z_]\w*):/g, "{ '$1':")
      .replace(/, ([A-Za-z_]\w*):/g, ", '$1':")
      .replace(/\/\/ /g, '# ');
  }
  function codigo(o) {
    if (estado.modo === 'react') {
      return [
        "import { Chart } from 'lozcharts/react';",
        '',
        'const opciones = ' + cuerpo(o, 0) + ';',
        '',
        'export function Grafico() {',
        '  return <Chart {...opciones} />;',
        '}',
      ].join('\n');
    }
    if (estado.modo === 'django') {
      return [
        '<!-- plantilla.html -->',
        '<div data-lozchart="#opciones"></div>',
        '{{ opciones|json_script:"opciones" }}',
        '<script>',
        '  htmx.onLoad((el) => LozChart.initAll(el));',
        '</script>',
        '',
        '# views.py: el mismo diccionario, en Python',
        'opciones = ' + python(cuerpo(o, 0)),
      ].join('\n');
    }
    return [
      '<div id="grafico"></div>',
      '<script src="lozcharts.umd.js"></script>',
      '<script>',
      "new LozChart('#grafico', " + cuerpo(o, 0) + ');',
      '</script>',
    ].join('\n');
  }

  var KW = /^(new|const|import|from|export|function|return|true|false|True|False)$/;
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function resaltar(linea) {
    var out = '';
    var re = /(\/\/.*$|#.*$|<!--.*-->)|('(?:[^'\\]|\\.)*'|"[^"]*")|(\b\d[\d.]*\b)|(\b[A-Za-z_]+\b)|(<\/?[a-z]+|\/?>)|([\s\S])/g;
    var m;
    while ((m = re.exec(linea))) {
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-n">' + m[3] + '</span>';
      else if (m[4])
        out += KW.test(m[4])
          ? '<span class="tk-k">' + m[4] + '</span>'
          : m[4] === 'LozChart' || m[4] === 'Chart'
            ? '<span class="tk-p">' + m[4] + '</span>'
            : m[4];
      else if (m[5]) out += '<span class="tk-t">' + esc(m[5]) + '</span>';
      else out += esc(m[6]);
    }
    return out;
  }

  var codigoTxt = $('codigo-txt');
  var anteriores = null;
  var opcionesActuales = null;
  /** Pinta el código; las líneas que no estaban antes se encienden un momento. */
  function pintarCodigo(o, sinMarcar) {
    opcionesActuales = o;
    var lineas = codigo(o).split('\n');
    var previas = {};
    (anteriores || []).forEach(function (l) {
      previas[l] = (previas[l] || 0) + 1;
    });
    codigoTxt.innerHTML = lineas
      .map(function (l) {
        var nueva = anteriores && !sinMarcar && !previas[l];
        if (previas[l]) previas[l]--;
        return '<span class="ln' + (nueva ? ' nueva' : '') + '">' + (resaltar(l) || ' ') + '</span>';
      })
      .join('');
    anteriores = lineas;
  }

  // ------------------------------------------------------------ Total que cuenta

  var totalEl = $('total');
  var totalAhora = 0;
  var totalRaf = 0;
  function formatoTotal(v) {
    var j = JUEGOS[estado.juego];
    if (j.formato === 'currency')
      return new Intl.NumberFormat('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    return new Intl.NumberFormat('es').format(Math.round(v));
  }
  function contarTotal(meta) {
    cancelAnimationFrame(totalRaf);
    var desde = totalAhora;
    var t0 = performance.now();
    var dur = quieto ? 0 : 700;
    (function paso(t) {
      var k = dur ? Math.min(1, Math.max(0, (t - t0) / dur)) : 1;
      k = 1 - Math.pow(1 - k, 3);
      totalAhora = desde + (meta - desde) * k;
      totalEl.textContent = formatoTotal(totalAhora);
      if (k < 1) totalRaf = requestAnimationFrame(paso);
    })(t0);
  }
  function actualizarTotal() {
    $('total-rotulo').textContent = JUEGOS[estado.juego].rotulo;
    contarTotal(
      suma(
        items.map(function (it) {
          return suma(it.serie);
        }),
      ),
    );
  }

  // ------------------------------------------------------------ Estado, controles y gráfico

  var estado = { juego: 0, tipo: 0, semilla: 1, modo: 'js', claro: false };
  var items = generar(JUEGOS[0], 1);
  var grafEl = $('lab-grafico');
  var escenario = $('escenario');
  var chart = null;
  var extra = 30; // lo que agrega la leyenda; se mide al crear

  function alto() {
    return P.altoPara(grafEl, extra);
  }

  /** Flechas, Inicio y Fin dentro de un grupo: mueven la elección y el foco. */
  function flechas(grupo, botones, elegir, actual) {
    grupo.addEventListener('keydown', function (e) {
      var n = botones.length;
      var i = actual();
      var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      else if (d) i = (i + d + n) % n;
      else return;
      e.preventDefault();
      elegir(i);
      botones[i].focus();
    });
  }

  var tiposEl = $('tipos-lab');
  var botonesTipo = TIPOS.map(function (t, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tipo-lab';
    b.id = 'tipo-' + t.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.setAttribute('aria-controls', 'lab-grafico');
    b.tabIndex = i === 0 ? 0 : -1;
    b.textContent = t.nombre;
    b.addEventListener('click', function () {
      elegirTipo(i);
    });
    tiposEl.appendChild(b);
    return b;
  });
  flechas(tiposEl, botonesTipo, elegirTipo, function () {
    return estado.tipo;
  });

  var datosEl = $('datos');
  var botonesDatos = JUEGOS.map(function (j, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dato';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    b.tabIndex = i === 0 ? 0 : -1;
    b.textContent = j.boton;
    b.addEventListener('click', function () {
      elegirJuego(i);
    });
    datosEl.appendChild(b);
    return b;
  });
  flechas(datosEl, botonesDatos, elegirJuego, function () {
    return estado.juego;
  });

  function actuales() {
    return opciones(JUEGOS[estado.juego], items, TIPOS[estado.tipo].id);
  }

  function aplicar() {
    var o = actuales();
    if (chart) {
      // setOptions combina con lo anterior: lo que esta vista no usa vuelve a su valor por defecto.
      var limpio = Object.assign({}, o, {
        xAxis: Object.assign({ type: 'category' }, o.xAxis),
        endLabels: o.endLabels || false,
        height: alto(),
      });
      chart.setOptions(limpio, !quieto);
    }
    pintarCodigo(o);
  }

  function elegirTipo(i) {
    if (i === estado.tipo) return;
    estado.tipo = i;
    botonesTipo.forEach(function (b, k) {
      b.setAttribute('aria-selected', k === i ? 'true' : 'false');
      b.tabIndex = k === i ? 0 : -1;
    });
    grafEl.setAttribute('aria-labelledby', botonesTipo[i].id);
    var b = botonesTipo[i];
    if (tiposEl.scrollWidth > tiposEl.clientWidth)
      tiposEl.scrollTo({
        left: b.offsetLeft - tiposEl.clientWidth / 2 + b.offsetWidth / 2,
        behavior: quieto ? 'auto' : 'smooth',
      });
    aplicar();
  }

  function elegirJuego(i) {
    if (i === estado.juego) return;
    estado.juego = i;
    estado.semilla = 1;
    botonesDatos.forEach(function (b, k) {
      b.setAttribute('aria-checked', k === i ? 'true' : 'false');
      b.tabIndex = k === i ? 0 : -1;
    });
    items = generar(JUEGOS[i], estado.semilla);
    totalAhora = 0;
    actualizarTotal();
    aplicar();
  }

  $('barajar').addEventListener('click', function () {
    estado.semilla++;
    items = generar(JUEGOS[estado.juego], estado.semilla);
    var o = actuales();
    if (chart) chart.setData(o.data); // mismo tipo, otros números: anima desde lo que se ve
    pintarCodigo(o);
    actualizarTotal();
  });

  var luz = $('luz');
  luz.addEventListener('click', function () {
    estado.claro = !estado.claro;
    luz.setAttribute('aria-pressed', String(estado.claro));
    escenario.classList.toggle('claro', estado.claro);
    if (chart) chart.setTheme(estado.claro ? 'light' : 'dark');
    pintarCodigo(actuales());
  });

  // Pestañas del código
  var pestanas = Array.prototype.slice.call(document.querySelectorAll('.codigo-pestanas [role="tab"]'));
  function elegirModo(i) {
    var btn = pestanas[i];
    pestanas.forEach(function (p) {
      var si = p === btn;
      p.setAttribute('aria-selected', si ? 'true' : 'false');
      p.tabIndex = si ? 0 : -1;
    });
    estado.modo = btn.dataset.modo;
    $('codigo-pre').setAttribute('aria-labelledby', btn.id);
    anteriores = null;
    pintarCodigo(actuales(), true);
  }
  pestanas.forEach(function (p, i) {
    p.addEventListener('click', function () {
      elegirModo(i);
    });
  });
  flechas(document.querySelector('.codigo-pestanas'), pestanas, elegirModo, function () {
    return pestanas.findIndex(function (p) {
      return p.getAttribute('aria-selected') === 'true';
    });
  });

  var copiar = $('copiar');
  var aviso = $('copiado');
  var esperaCopia = 0;
  copiar.addEventListener('click', function () {
    completo = true;
    var todo = codigo(opcionesActuales);
    completo = false;
    var listo = function () {
      copiar.textContent = 'Copiado';
      aviso.textContent = 'Código copiado, con todas las filas.';
      clearTimeout(esperaCopia);
      esperaCopia = setTimeout(function () {
        copiar.textContent = 'Copiar';
        aviso.textContent = '';
      }, 1800);
    };
    var aMano = function () {
      // Sin portapapeles (página sin https): se selecciona el código para copiarlo con el teclado.
      var r = document.createRange();
      r.selectNodeContents(codigoTxt);
      var s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      aviso.textContent = 'Código seleccionado. Cópialo con Ctrl o Comando + C.';
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(todo).then(listo, aMano);
    else aMano();
  });

  // ------------------------------------------------------------ Crear al acercarse

  pintarCodigo(actuales(), true);
  totalEl.textContent = formatoTotal(0);

  function crear() {
    var o = actuales();
    var reales = o.data;
    // Las barras suben desde cero la primera vez que se ven (las vistas de meses; las demás, directo).
    var desdeCero = !quieto && /^(bar|line|area)$/.test(TIPOS[estado.tipo].id);
    var ceros = reales.map(function (f) {
      var z = {};
      Object.keys(f).forEach(function (k) {
        z[k] = typeof f[k] === 'number' ? 0 : f[k];
      });
      return z;
    });
    chart = new LozChart(
      grafEl,
      Object.assign({}, o, {
        data: desdeCero ? ceros : reales,
        background: false,
        legend: { position: 'bottom' },
        height: alto(),
        animate: false,
      }),
    );
    // La leyenda va fuera del alto pedido: se mide una vez y se corrige antes de animar.
    var sobra = P.sobrante(grafEl);
    if (Math.abs(sobra) > 1) {
      extra = Math.max(0, extra + sobra);
      chart.setOptions({ height: alto() }, false);
    }
    if (!quieto) chart.setOptions({ animate: true }, false);
    if (desdeCero) chart.setData(reales);
    actualizarTotal();
    if ('ResizeObserver' in window) {
      var antes = grafEl.clientWidth + 'x' + grafEl.clientHeight;
      var espera = 0;
      new ResizeObserver(function () {
        var ahora = grafEl.clientWidth + 'x' + grafEl.clientHeight;
        if (ahora === antes) return;
        antes = ahora;
        clearTimeout(espera);
        espera = setTimeout(function () {
          chart.setOptions({ height: alto() }, false);
        }, 120);
      }).observe(grafEl);
    }
  }
  P.alVer(grafEl, crear, '0px 0px 300px 0px');
})();
