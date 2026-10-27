/* Página de un ejemplo: el gráfico, sus ajustes en vivo y su código listo para copiar o descargar. */
(function () {
  var byId = function (id) {
    return document.getElementById(id);
  };
  var id = new URLSearchParams(location.search).get('id') || 'ventas';
  // Los ejemplos por capas se abren en el editor de «Crea el tuyo».
  if (/^capas-/.test(id)) {
    location.replace(tx({ es: 'crea-el-tuyo.html', en: 'make-your-own.html', pt: 'crie-o-seu.html' }) + '?ej=' + id.slice(6));
    return;
  }
  var ej =
    EJEMPLOS.find(function (e) {
      return e.id === id;
    }) || EJEMPLOS[0];

  var o = JSON.parse(JSON.stringify(ej.opciones));
  // Las funciones (formatos propios) no pasan por JSON: se recuperan.
  if (ej.opciones.yAxis && typeof ej.opciones.yAxis.format === 'function') o.yAxis.format = ej.opciones.yAxis.format;

  // El id del elemento y el nombre de los datos en el código que se muestra, en el idioma de la
  // página (la plantilla dice "cambia las filas de datos" con el mismo nombre).
  var ID = window.ID_GRAFICO || 'grafico';
  var DATOS = tx({ es: 'datos', en: 'data', pt: 'dados' });

  document.title = tx({
    es: o.title + ' · Galería de LozCharts',
    en: o.title + ' · LozCharts gallery',
    pt: o.title + ' · Galeria do LozCharts',
  });
  byId('clase').textContent = ej.clase;
  byId('titulo').textContent = o.title;
  byId('sub').textContent = o.subtitle || '';
  byId('desc').textContent = ej.desc || '';
  // El nombre técnico, donde aporta: junto al código.
  var tecnico = byId('nombre-tecnico');
  var tiposSerie = o.series
    .map(function (s) {
      return s.type;
    })
    .filter(function (t, i, a) {
      return a.indexOf(t) === i;
    });
  var c1 = document.createElement('code');
  c1.textContent = ej.tipo;
  // La frase con sus piezas en cada idioma; la lista de tipos se une con la «y» de cada uno.
  var frase = tx({
    es: { antes: 'En la librería este gráfico es ', con: ', con ', y: ' y ', panel: ' en cada panel.' },
    en: { antes: 'In the library this chart is ', con: ', with ', y: ' and ', panel: ' in each panel.' },
    pt: { antes: 'Na biblioteca este gráfico é ', con: ', com ', y: ' e ', panel: ' em cada painel.' },
  });
  tecnico.append(frase.antes, c1, frase.con);
  tiposSerie.forEach(function (t, i) {
    var c = document.createElement('code');
    c.textContent = "type: '" + t + "'";
    // En inglés, con tres o más, va la coma antes de "and" (a, b, and c).
    var y = IDIOMA === 'en' && tiposSerie.length > 2 ? ',' + frase.y : frase.y;
    if (i) tecnico.append(i === tiposSerie.length - 1 ? y : ', ');
    tecnico.append(c);
  });
  tecnico.append(ej.multiples ? frase.panel : '.');

  // ------------------------------------------------------------ Ajustes

  var tipos = o.series.map(function (s) {
    return s.type;
  });
  var todos = function (lista) {
    return tipos.every(function (t) {
      return lista.indexOf(t) >= 0;
    });
  };
  var esCartesiano = todos(['bar', 'line', 'area', 'step', 'range', 'scatter', 'bubble', 'candlestick', 'ohlc']);
  // Alto inicial: lo que deja la pantalla bajo el título, entre 340 y 820 px (menos en el teléfono).
  var altoInicial = Math.round(Math.min(innerWidth < 700 ? 380 : 820, Math.max(340, innerHeight - 380)) / 20) * 20;
  if (ej.tipo === 'LozBullet') altoInicial = Math.min(altoInicial, 400);
  var estado = {
    altura: altoInicial,
    leyenda: o.legend !== false,
    animar: true,
  };
  var controles = [];

  if (todos(['bar', 'line', 'area', 'step'])) {
    estado.tipo = tipos[0];
    controles.push({
      label: tx({ es: 'Tipo de gráfico', en: 'Chart type', pt: 'Tipo de gráfico' }),
      kind: 'select',
      key: 'tipo',
      options: [
        ['bar', tx({ es: 'Barras', en: 'Bars', pt: 'Barras' })],
        ['line', tx({ es: 'Líneas', en: 'Lines', pt: 'Linhas' })],
        ['area', tx({ es: 'Áreas', en: 'Areas', pt: 'Áreas' })],
        ['step', tx({ es: 'Escalones', en: 'Steps', pt: 'Degraus' })],
      ],
    });
    estado.apilar = o.series.some(function (s) {
      return s.stack;
    });
    var principales = o.series.filter(function (s) {
      return s.type === tipos[0];
    }).length;
    if (principales > 1)
      controles.push({
        label: tx({ es: 'Apilar una sobre otra', en: 'Stack them on top of each other', pt: 'Empilhar uma sobre a outra' }),
        kind: 'toggle',
        key: 'apilar',
      });
    estado.suave = o.series.some(function (s) {
      return s.smooth;
    });
    controles.push({
      label: tx({ es: 'Curvas suaves', en: 'Smooth curves', pt: 'Curvas suaves' }),
      kind: 'toggle',
      key: 'suave',
    });
  }
  if (todos(['bar']) && !ej.multiples) {
    estado.horizontal = o.orientation === 'horizontal';
    controles.push({ label: tx({ es: 'Horizontal', en: 'Horizontal', pt: 'Horizontal' }), kind: 'toggle', key: 'horizontal' });
  }
  if (todos(['donut', 'pie'])) {
    estado.dona = tipos[0] === 'donut';
    controles.push({
      label: tx({ es: 'Con hueco al centro', en: 'Hole in the middle', pt: 'Com furo no meio' }),
      kind: 'toggle',
      key: 'dona',
    });
  }
  // El globo gira con el puntero y los botones: cambiarle la proyección lo dejaría sin sus arcos.
  if (todos(['choropleth', 'mapbubble']) && !ej.globo) {
    estado.proyeccion = o.series[0].projection || 'equalEarth';
    controles.push({
      label: tx({ es: 'Forma del mapa', en: 'Map shape', pt: 'Formato do mapa' }),
      kind: 'select',
      key: 'proyeccion',
      options: [
        ['equalEarth', tx({ es: 'Áreas reales (Equal Earth)', en: 'True areas (Equal Earth)', pt: 'Áreas reais (Equal Earth)' })],
        ['mercator', tx({ es: 'Plano clásico (Mercator)', en: 'Classic flat map (Mercator)', pt: 'Plano clássico (Mercator)' })],
        ['orthographic', tx({ es: 'Globo', en: 'Globe', pt: 'Globo' })],
      ],
    });
  }
  if (esCartesiano && !ej.multiples) {
    estado.zoom = !!o.zoom;
    controles.push({ label: tx({ es: 'Zoom', en: 'Zoom', pt: 'Zoom' }), kind: 'toggle', key: 'zoom' });
  }
  if (o.series.length > 1 && !ej.multiples)
    controles.push({ label: tx({ es: 'Leyenda', en: 'Legend', pt: 'Legenda' }), kind: 'toggle', key: 'leyenda' });
  if (!ej.multiples)
    controles.push({
      label: tx({ es: 'Alto', en: 'Height', pt: 'Altura' }),
      kind: 'range',
      key: 'altura',
      min: 220,
      max: 900,
      step: 20,
    });

  /** Las opciones que salen de los ajustes: siempre todas las claves, así quitar algo también se ve. */
  function opciones() {
    var r = JSON.parse(JSON.stringify(o));
    if (o.yAxis && o.yAxis.format) r.yAxis.format = o.yAxis.format;
    r.series = o.series.map(function (s) {
      var c = Object.assign({}, s);
      if (estado.tipo) {
        // Solo cambian las series del tipo principal: la meta de las ventas sigue siendo línea.
        if (s.type === tipos[0]) {
          c.type = estado.tipo;
          c.stack = estado.apilar && estado.tipo !== 'line' && estado.tipo !== 'step' ? true : undefined;
        }
        c.smooth = estado.suave || undefined;
      }
      if (estado.dona !== undefined) c.type = estado.dona ? 'donut' : 'pie';
      if (estado.proyeccion) c.projection = estado.proyeccion;
      return c;
    });
    if (estado.horizontal !== undefined) r.orientation = estado.horizontal ? 'horizontal' : 'vertical';
    if (estado.zoom !== undefined) r.zoom = estado.zoom ? o.zoom || true : false;
    if (!ej.multiples) {
      r.legend = estado.leyenda;
      r.height = estado.altura;
    }
    return r;
  }

  var caja = byId('controles');
  controles.forEach(function (c) {
    var label = document.createElement('label');
    label.className = 'ctl' + (c.kind === 'toggle' ? ' toggle' : '');
    var name = document.createElement('span');
    name.textContent = c.label;
    var input;
    if (c.kind === 'select') {
      input = document.createElement('select');
      c.options.forEach(function (op) {
        var el = document.createElement('option');
        el.value = op[0];
        el.textContent = op[1];
        input.appendChild(el);
      });
      input.value = estado[c.key];
    } else if (c.kind === 'toggle') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('role', 'switch');
      input.checked = !!estado[c.key];
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = c.min;
      input.max = c.max;
      input.step = c.step;
      input.value = estado[c.key];
      name.textContent = c.label + ': ' + estado[c.key] + ' px';
    }
    input.addEventListener(c.kind === 'range' ? 'input' : 'change', function () {
      estado[c.key] = c.kind === 'toggle' ? input.checked : c.kind === 'range' ? Number(input.value) : input.value;
      if (c.kind === 'range') name.textContent = c.label + ': ' + estado[c.key] + ' px';
      aplicar(c.kind !== 'range');
    });
    label.append(name, input);
    caja.appendChild(label);
  });

  // ------------------------------------------------------------ Gráfico

  var chart;
  var globo = null;
  function crear() {
    if (!listo) return;
    if (globo) globo.destruir();
    if (chart) chart.destroy();
    // El título ya está arriba de la página: el del gráfico se oculta con CSS (.lienzo), pero
    // sigue en su nombre accesible y en el código.
    var op = Object.assign({ background: false, locale: LOCALE }, opciones());
    chart = siteChart(ej.multiples ? LozChart.multiples('#grafico', op) : new LozChart('#grafico', op));
    globo = ej.globo ? girarGlobo(chart, byId('grafico'), ej) : null;
  }
  function aplicar(animar) {
    if (!chart) return mostrarCodigo();
    // Pasar de cartesiano a mapa u otra forma: se recrea; si no, cambia animando.
    if (ej.multiples) crear();
    else chart.setOptions(Object.assign({ background: false, locale: LOCALE }, opciones()), animar);
    // El globo conserva hacia dónde lo dejaste.
    if (globo) globo.redibujar();
    mostrarCodigo();
  }
  // Los mapas esperan el mapa del mundo, que se baja solo en sus páginas.
  var listo = !esMapa(ej);
  if (listo) crear();
  else {
    byId('grafico').style.minHeight = estado.altura + 'px';
    siteMapa().then(
      function () {
        listo = true;
        byId('grafico').style.minHeight = '';
        crear();
      },
      function () {
        byId('grafico').textContent = tx({
          es: 'No se pudo cargar el mapa. Revisa la conexión y vuelve a cargar la página.',
          en: "Couldn't load the map. Check your connection and reload the page.",
          pt: 'Não deu para carregar o mapa. Confira a conexão e recarregue a página.',
        });
      },
    );
  }
  if (ej.globo) {
    byId('grafico').after(rutasGlobo(ej));
    var nota = document.createElement('p');
    var c2 = document.createElement('code');
    c2.textContent = 'rotate';
    var c3 = document.createElement('code');
    c3.textContent = 'setOptions';
    var t = tx({
      es: [
        'El código dibuja el globo. Los arcos y el giro con el puntero los pone esta página: para girarlo desde tu código, cambia ',
        ' con ',
        '.',
      ],
      en: [
        'The code draws the globe. The arcs and turning it with the pointer come from this page: to turn it from your own code, change ',
        ' with ',
        '.',
      ],
      pt: [
        'O código desenha o globo. Os arcos e o giro com o ponteiro vêm desta página: para girar pelo seu código, mude ',
        ' com ',
        '.',
      ],
    });
    nota.append(t[0], c2, t[1], c3, t[2]);
    byId('nombre-tecnico').after(nota);
  }
  byId('repetir').addEventListener('click', crear);

  // ------------------------------------------------------------ Código

  var lenguaje = 'js';
  /** Un objeto como código JavaScript legible: claves sin comillas, textos con comillas simples. */
  function js(v, sangria) {
    var pad = new Array(sangria + 1).join('  ');
    if (typeof v === 'function') return v.toString();
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      var simple = v.every(function (x) {
        return typeof x !== 'object' || x === null;
      });
      if (simple)
        return (
          '[' +
          v
            .map(function (x) {
              return js(x, 0);
            })
            .join(', ') +
          ']'
        );
      return (
        '[\n' +
        v
          .map(function (x) {
            return pad + '  ' + js(x, sangria + 1);
          })
          .join(',\n') +
        ',\n' +
        pad +
        ']'
      );
    }
    if (v && typeof v === 'object') {
      var claves = Object.keys(v).filter(function (k) {
        return v[k] !== undefined;
      });
      var corto = claves.every(function (k) {
        return typeof v[k] !== 'object' || v[k] === null;
      });
      var partes = claves.map(function (k) {
        return (/^[A-Za-z_]\w*$/.test(k) ? k : "'" + k + "'") + ': ' + js(v[k], sangria + 1);
      });
      var linea = '{ ' + partes.join(', ') + ' }';
      if (corto && linea.length < 120) return linea;
      return (
        '{\n' +
        partes
          .map(function (p) {
            return pad + '  ' + p;
          })
          .join(',\n') +
        ',\n' +
        pad +
        '}'
      );
    }
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    return String(v);
  }
  /** Los datos: completos para descargar; en pantalla, las primeras filas y cuántas faltan. */
  function datos(completo) {
    var d = o.data;
    if (completo || d.length <= 4) return 'const ' + DATOS + ' = ' + js(d, 0) + ';';
    var faltan = d.length - 3;
    var comentario = tx({ es: faltan + ' filas más', en: faltan + ' more rows', pt: 'mais ' + faltan + ' linhas' });
    return 'const ' + DATOS + ' = ' + js(d.slice(0, 3), 0).replace(/\n\]$/, '\n  // … ' + comentario + '\n]') + ';';
  }
  function sinDatos() {
    var r = opciones();
    delete r.data;
    return r;
  }
  function codigoJS(completo) {
    var fn = ej.multiples ? 'LozChart.multiples' : 'new LozChart';
    var r = sinDatos();
    // En inglés la variable se llama igual que la opción: queda { data, … }.
    var cuerpo = js(r, 0).replace(/^\{/, '{\n  ' + (DATOS === 'data' ? 'data' : 'data: ' + DATOS) + ',');
    return datos(completo) + '\n\n' + fn + "('#" + ID + "', " + cuerpo + ');';
  }
  function codigoReact() {
    var comp = ej.multiples ? 'Multiples' : 'Chart';
    var r = sinDatos();
    var props = Object.keys(r)
      .filter(function (k) {
        return r[k] !== undefined;
      })
      .map(function (k) {
        var v = r[k];
        if (v === true) return '      ' + k;
        if (typeof v === 'string') return '      ' + k + '="' + v + '"';
        return '      ' + k + '={' + js(v, 3).replace(/^\s+/, '') + '}';
      });
    return (
      'import { ' +
      comp +
      " } from '@lozcharts/core/react';\n\n" +
      datos(false) +
      '\n\nexport function ' +
      tx({ es: 'Grafico', en: 'MyChart', pt: 'Grafico' }) +
      '() {\n  return (\n    <' +
      comp +
      '\n      data={' +
      DATOS +
      '}\n' +
      props.join('\n') +
      '\n    />\n  );\n}'
    );
  }
  function codigoHTML(completo, libreria) {
    var mapa = /choropleth|mapbubble/.test(JSON.stringify(o.series));
    var scripts = libreria
      ? '<script>\n' + libreria + '\n</script>'
      : '<script src="lozcharts.umd.js"></script>' + (mapa ? '\n<script src="maps/world.umd.js"></script>' : '');
    return (
      '<!doctype html>\n<html lang="' +
      (document.documentElement.lang || 'es') +
      '">\n<head>\n  <meta charset="utf-8">\n  <title>' +
      o.title +
      '</title>\n</head>\n<body>\n' +
      '  <div id="' +
      ID +
      '" style="max-width: 900px; margin: 40px auto;"></div>\n\n' +
      scripts +
      '\n<script>\n' +
      codigoJS(completo) +
      '\n</script>\n</body>\n</html>\n'
    );
  }
  function texto() {
    return lenguaje === 'react' ? codigoReact() : lenguaje === 'html' ? codigoHTML(false) : codigoJS(false);
  }
  function mostrarCodigo() {
    byId('codigo').innerHTML = siteHighlight(texto());
  }
  document.querySelector('[data-tabs="lenguaje"]').addEventListener('tabchange', function (e) {
    lenguaje = e.detail;
    mostrarCodigo();
  });
  mostrarCodigo();

  function avisar(msg) {
    var t = byId('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(function () {
      t.classList.remove('show');
    }, 1800);
  }
  byId('copiar').addEventListener('click', function () {
    // Se copia con todos los datos: lo que se pega funciona.
    var full = lenguaje === 'react' ? codigoReact() : lenguaje === 'html' ? codigoHTML(true) : codigoJS(true);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(full).then(
        function () {
          avisar(tx({ es: 'Código copiado', en: 'Code copied', pt: 'Código copiado' }));
        },
        function () {
          avisar(
            tx({
              es: 'No se pudo copiar: selecciónalo a mano',
              en: "Couldn't copy it: select it by hand",
              pt: 'Não deu para copiar: selecione à mão',
            }),
          );
        },
      );
    }
  });
  byId('descargar').addEventListener('click', function () {
    // Un archivo que funciona solo, con doble clic: la librería y los datos van adentro.
    var mapa = /choropleth|mapbubble/.test(JSON.stringify(o.series));
    // Las rutas salen de las etiquetas de la página: en es/ y pt/ la librería está una carpeta arriba.
    var src = function (sel, otra) {
      var s = document.querySelector(sel);
      return (s && s.getAttribute('src')) || otra;
    };
    var libs = [
      fetch(src('script[src*="lozcharts.umd.js"]', 'lib/lozcharts.umd.js')).then(function (r) {
        return r.text();
      }),
    ];
    if (mapa)
      libs.push(
        fetch(src('script[data-mapa]', 'lib/maps/world.umd.js')).then(function (r) {
          return r.text();
        }),
      );
    Promise.all(libs).then(function (codigos) {
      // Un "</script" dentro del código cerraría la etiqueta antes de tiempo.
      var seguros = codigos.map(function (c) {
        return c.replace(/<\/script/gi, '<\\/script');
      });
      var html = codigoHTML(true, seguros.join('\n</script>\n<script>\n'));
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = ej.id + '.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      avisar(
        tx({ es: 'Listo: ábrelo con doble clic', en: 'Done: double-click it to open it', pt: 'Pronto: abra com dois cliques' }),
      );
    });
  });

  // ------------------------------------------------------------ Otros ejemplos

  // Primero los de la misma familia, después el resto en el orden de la galería.
  var otros = EJEMPLOS.filter(function (e) {
    return e.id !== ej.id;
  });
  otros
    .filter(function (e) {
      return e.familia === ej.familia;
    })
    .concat(
      otros.filter(function (e) {
        return e.familia !== ej.familia;
      }),
    )
    .slice(0, 8)
    .forEach(function (e) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = 'demo.html?id=' + e.id;
      var t = document.createElement('strong');
      t.textContent = e.opciones.title;
      var s = document.createElement('span');
      s.textContent = e.clase;
      a.append(t, s);
      li.appendChild(a);
      byId('mas').appendChild(li);
    });
})();
