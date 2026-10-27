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
  // final (para el sankey). De ahí salen las seis vistas: son los mismos números. Los nombres de
  // los campos también van en el idioma de la página: son los que se ven en el código.
  var JUEGOS = [
    {
      id: 'panaderia',
      boton: tx({ es: 'Una panadería', en: 'A bakery', pt: 'Uma padaria' }),
      rotulo: tx({ es: 'Ventas del semestre', en: 'Six-month sales', pt: 'Vendas do semestre' }),
      formato: 'currency',
      meses: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
      temporada: [0.92, 0.86, 0.97, 1.08, 1.12, 1.02],
      campos: tx({
        es: { grupo: 'categoria', item: 'producto', valor: 'ventas' },
        en: { grupo: 'category', item: 'product', valor: 'sales' },
        pt: { grupo: 'categoria', item: 'produto', valor: 'vendas' },
      }),
      nombreValor: tx({ es: 'Ventas', en: 'Sales', pt: 'Vendas' }),
      grupos: [
        [
          tx({ es: 'Panes', en: 'Bread', pt: 'Pães' }),
          [
            [tx({ es: 'Pan francés', en: 'Baguette', pt: 'Pão francês' }), 2400],
            [tx({ es: 'Integral', en: 'Whole wheat', pt: 'Integral' }), 980],
            ['Croissant', 1350],
          ],
        ],
        [
          tx({ es: 'Pasteles', en: 'Cakes', pt: 'Bolos' }),
          [
            [tx({ es: 'Tres leches', en: 'Tres leches', pt: 'Três leites' }), 1620],
            [tx({ es: 'Torta de chocolate', en: 'Chocolate cake', pt: 'Bolo de chocolate' }), 1180],
          ],
        ],
        [
          tx({ es: 'Bebidas', en: 'Drinks', pt: 'Bebidas' }),
          [
            [tx({ es: 'Café', en: 'Coffee', pt: 'Café' }), 1900],
            [tx({ es: 'Chocolate caliente', en: 'Hot chocolate', pt: 'Chocolate quente' }), 640],
          ],
        ],
      ],
      destinos: [
        [tx({ es: 'En el mostrador', en: 'At the counter', pt: 'No balcão' }), 0.68],
        [tx({ es: 'A domicilio', en: 'Delivery', pt: 'Delivery' }), 0.32],
      ],
    },
    {
      id: 'web',
      boton: tx({ es: 'Un sitio web', en: 'A website', pt: 'Um site' }),
      rotulo: tx({ es: 'Visitas del semestre', en: 'Six-month visits', pt: 'Visitas do semestre' }),
      formato: 'compact',
      meses: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'],
      temporada: [0.8, 0.88, 1, 1.06, 1.18, 1.3],
      campos: tx({
        es: { grupo: 'fuente', item: 'pagina', valor: 'visitas' },
        en: { grupo: 'channel', item: 'page', valor: 'visits' },
        pt: { grupo: 'canal', item: 'pagina', valor: 'visitas' },
      }),
      nombreValor: tx({ es: 'Visitas', en: 'Visits', pt: 'Visitas' }),
      grupos: [
        [
          tx({ es: 'Buscadores', en: 'Search', pt: 'Buscadores' }),
          [
            ['Blog', 5200],
            [tx({ es: 'Guías', en: 'Guides', pt: 'Guias' }), 3100],
          ],
        ],
        [
          tx({ es: 'Redes sociales', en: 'Social media', pt: 'Redes sociais' }),
          [
            [tx({ es: 'Videos', en: 'Videos', pt: 'Vídeos' }), 4300],
            [tx({ es: 'Fotos', en: 'Photos', pt: 'Fotos' }), 1900],
            [tx({ es: 'Historias', en: 'Stories', pt: 'Stories' }), 1200],
          ],
        ],
        [
          tx({ es: 'Directo', en: 'Direct', pt: 'Direto' }),
          [
            [tx({ es: 'Inicio', en: 'Home', pt: 'Início' }), 2600],
            [tx({ es: 'Tienda', en: 'Shop', pt: 'Loja' }), 1750],
          ],
        ],
      ],
      destinos: [
        [tx({ es: 'Siguieron leyendo', en: 'Kept reading', pt: 'Continuaram lendo' }), 0.52],
        [tx({ es: 'Se fueron', en: 'Left', pt: 'Saíram' }), 0.4],
        [tx({ es: 'Compraron', en: 'Bought', pt: 'Compraram' }), 0.08],
      ],
    },
    {
      id: 'goles',
      boton: tx({ es: 'Un equipo de fútbol', en: 'A soccer team', pt: 'Um time de futebol' }),
      rotulo: tx({ es: 'Goles de la temporada', en: 'Goals this season', pt: 'Gols da temporada' }),
      formato: 'number',
      meses: ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'],
      temporada: [0.9, 1.1, 1, 1.2, 0.7, 1.1],
      campos: tx({
        es: { grupo: 'linea', item: 'jugador', valor: 'goles' },
        en: { grupo: 'position', item: 'player', valor: 'goals' },
        pt: { grupo: 'setor', item: 'jogador', valor: 'gols' },
      }),
      nombreValor: tx({ es: 'Goles', en: 'Goals', pt: 'Gols' }),
      grupos: [
        [
          tx({ es: 'Delanteros', en: 'Forwards', pt: 'Atacantes' }),
          [
            ['Ramírez', 4.2],
            ['Toledo', 2.6],
          ],
        ],
        [
          tx({ es: 'Mediocampo', en: 'Midfield', pt: 'Meio-campo' }),
          [
            ['Quispe', 1.6],
            ['Ávalos', 1.2],
            ['Mena', 0.9],
          ],
        ],
        [
          tx({ es: 'Defensa', en: 'Defense', pt: 'Defesa' }),
          [
            ['Rivas', 0.7],
            ['Cárdenas', 0.5],
          ],
        ],
      ],
      destinos: [
        [tx({ es: 'Con el pie', en: 'Kicks', pt: 'Chutes' }), 0.62],
        [tx({ es: 'De cabeza', en: 'Headers', pt: 'De cabeça' }), 0.24],
        [tx({ es: 'De penal', en: 'Penalties', pt: 'De pênalti' }), 0.14],
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
    { id: 'bar', nombre: tx({ es: 'Barras', en: 'Bars', pt: 'Barras' }) },
    { id: 'line', nombre: tx({ es: 'Líneas', en: 'Lines', pt: 'Linhas' }) },
    { id: 'area', nombre: tx({ es: 'Área', en: 'Area', pt: 'Área' }) },
    { id: 'donut', nombre: tx({ es: 'Dona', en: 'Donut', pt: 'Rosca' }) },
    { id: 'sankey', nombre: tx({ es: 'Flujos', en: 'Sankey', pt: 'Fluxos' }) },
    { id: 'treemap', nombre: tx({ es: 'Rectángulos', en: 'Treemap', pt: 'Retângulos' }) },
  ];

  // Nombres de campos y del código que se muestra, en el idioma de la página.
  var MES = tx({ es: 'mes', en: 'month', pt: 'mes' });
  var DE = tx({ es: 'origen', en: 'source', pt: 'origem' });
  var A = tx({ es: 'destino', en: 'target', pt: 'destino' });
  var NOMBRES = tx({
    es: { opciones: 'opciones', componente: 'Grafico', id: 'grafico', plantilla: 'plantilla.html' },
    en: { opciones: 'options', componente: 'MyChart', id: 'chart', plantilla: 'template.html' },
    pt: { opciones: 'opcoes', componente: 'Grafico', id: 'grafico', plantilla: 'template.html' },
  });

  /** Opciones completas de LozCharts para un juego, sus números y un tipo. */
  function opciones(juego, items, tipo) {
    var c = juego.campos;
    var o = {};
    var porGrupo = juego.grupos.map(function (g) {
      return g[0];
    });
    if (tipo === 'bar' || tipo === 'line' || tipo === 'area') {
      o.data = juego.meses.map(function (mes, i) {
        var fila = {};
        fila[MES] = mes;
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
      o.xAxis = { field: MES, type: 'time' };
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
        flujos.push({ de: it.grupo, a: it.nombre, valor: suma(it.serie) });
      });
      items.forEach(function (it) {
        var total = suma(it.serie);
        juego.destinos.forEach(function (d, k) {
          var v = Math.round(total * it.reparto[k]);
          if (v > 0) flujos.push({ de: it.nombre, a: d[0], valor: v });
        });
      });
      o.data = flujos.map(function (f) {
        var fila = {};
        fila[DE] = f.de;
        fila[A] = f.a;
        fila[c.valor] = f.valor;
        return fila;
      });
      o.xAxis = { field: DE };
      o.yAxis = { format: juego.formato };
      o.series = [{ type: 'sankey', field: c.valor, name: juego.nombreValor, to: A }];
    }
    o.theme = estado.claro ? 'light' : 'dark';
    // El español es el idioma por defecto de la librería: en los otros, el código copiado lo pide.
    if (LOCALE !== 'es') o.locale = LOCALE;
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
        var mas = tx({ es: '% filas más', en: '% more rows', pt: 'mais % linhas' }).replace('%', n - 4);
        return a + pad + '// … ' + mas + '\n' + b + ']';
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
    var N = NOMBRES;
    if (estado.modo === 'react') {
      return [
        "import { Chart } from '@lozcharts/core/react';",
        '',
        'const ' + N.opciones + ' = ' + cuerpo(o, 0) + ';',
        '',
        'export function ' + N.componente + '() {',
        '  return <Chart {...' + N.opciones + '} />;',
        '}',
      ].join('\n');
    }
    if (estado.modo === 'django') {
      return [
        '<!-- ' + N.plantilla + ' -->',
        '<div data-lozchart="#' + N.opciones + '"></div>',
        '{{ ' + N.opciones + '|json_script:"' + N.opciones + '" }}',
        '<script>',
        '  htmx.onLoad((el) => LozChart.initAll(el));',
        '</script>',
        '',
        tx({
          es: '# views.py: el mismo diccionario, en Python',
          en: '# views.py: the same dictionary, in Python',
          pt: '# views.py: o mesmo dicionário, em Python',
        }),
        N.opciones + ' = ' + python(cuerpo(o, 0)),
      ].join('\n');
    }
    return [
      '<div id="' + N.id + '"></div>',
      '<script src="lozcharts.umd.js"></script>',
      '<script>',
      "new LozChart('#" + N.id + "', " + cuerpo(o, 0) + ');',
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
      return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    return new Intl.NumberFormat(LOCALE).format(Math.round(v));
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
      copiar.textContent = tx({ es: 'Copiado', en: 'Copied', pt: 'Copiado' });
      aviso.textContent = tx({
        es: 'Código copiado, con todas las filas.',
        en: 'Code copied, with every row.',
        pt: 'Código copiado, com todas as linhas.',
      });
      clearTimeout(esperaCopia);
      esperaCopia = setTimeout(function () {
        copiar.textContent = tx({ es: 'Copiar', en: 'Copy', pt: 'Copiar' });
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
      aviso.textContent = tx({
        es: 'Código seleccionado. Cópialo con Ctrl o Comando + C.',
        en: 'Code selected. Copy it with Ctrl or Command + C.',
        pt: 'Código selecionado. Copie com Ctrl ou Command + C.',
      });
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
        locale: LOCALE,
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
