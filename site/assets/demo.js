/* Página de un ejemplo: el gráfico, sus ajustes en vivo y su código listo para copiar o descargar. */
(function () {
  var byId = function (id) {
    return document.getElementById(id);
  };
  var id = new URLSearchParams(location.search).get('id') || 'ventas';
  var ej =
    EJEMPLOS.find(function (e) {
      return e.id === id;
    }) || EJEMPLOS[0];

  // Una frase por ejemplo: para qué sirve, dicho como lo diría una persona.
  var DESC = {
    ventas: 'Barras apiladas para ver el total y de qué está hecho, con una línea de meta encima.',
    paginas: 'Barras horizontales: la mejor forma de comparar cuando los nombres son largos.',
    usuarios: 'Varias líneas con su nombre al final: se leen sin ir y volver a la leyenda.',
    'visitas-dia': 'Un año completo con zoom: arrastra sobre el gráfico o mueve la barra de abajo.',
    dispositivos: 'Áreas apiladas: cómo cambia la mezcla mes a mes.',
    tasa: 'Para valores que cambian de golpe, como una tasa o una tarifa.',
    precios: 'Velas: apertura, máximo, mínimo y cierre de cada día.',
    categorias: 'Partes de un todo. Mejor con pocas categorías.',
    productos: 'Muchas categorías a la vez: el área de cada rectángulo es su valor.',
    meta: 'Un solo número contra su meta.',
    embudo: 'Los pasos de un proceso y cuánta gente pasa de uno al siguiente.',
    tiendas: 'Tres medidas a la vez: posición en X, en Y y tamaño.',
    modelos: 'Comparar perfiles en varias dimensiones.',
    'visitas-hora': 'Patrones en una rejilla: día por hora.',
    recorrido: 'De dónde viene la gente y a dónde va.',
    paises: 'Un valor por país, coloreado.',
    'tiendas-mapa': 'Cantidades sobre el mapa, en su latitud y longitud.',
    regiones: 'Un gráfico pequeño por región, con las demás en gris para comparar.',
    resultado: 'Cómo se llega de un número a otro: lo que suma, lo que resta y dónde terminas.',
    metas: 'Cada indicador contra su meta, con los rangos de bueno y malo de fondo.',
    opiniones: 'Lo que más se repite en un texto, a primera vista.',
    lanzamiento: 'Un plan en el tiempo: quién hace qué y cuándo.',
    mercados: 'Una jerarquía de un vistazo: región, país y ciudad en anillos.',
    equipo: 'Quién se relaciona con quién, y quién está en el centro.',
    mudanzas: 'Quién envía a quién, en las dos direcciones.',
  };

  var o = JSON.parse(JSON.stringify(ej.opciones));
  // Las funciones (formatos propios) no pasan por JSON: se recuperan.
  if (ej.opciones.yAxis && typeof ej.opciones.yAxis.format === 'function') o.yAxis.format = ej.opciones.yAxis.format;

  document.title = o.title + ' · LozCharts';
  byId('crumb').textContent = ej.tipo;
  byId('tipo').textContent = ej.tipo;
  byId('titulo').textContent = o.title;
  byId('desc').textContent = DESC[ej.id] || o.subtitle || '';

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
  var estado = {
    altura: 360,
    leyenda: o.legend !== false,
    animar: true,
  };
  var controles = [];

  if (todos(['bar', 'line', 'area', 'step'])) {
    estado.tipo = tipos[0];
    controles.push({
      label: 'Tipo de gráfico',
      kind: 'select',
      key: 'tipo',
      options: [
        ['bar', 'Barras'],
        ['line', 'Líneas'],
        ['area', 'Áreas'],
        ['step', 'Escalones'],
      ],
    });
    estado.apilar = o.series.some(function (s) {
      return s.stack;
    });
    if (o.series.length > 1) controles.push({ label: 'Apilar series', kind: 'toggle', key: 'apilar' });
    estado.suave = o.series.some(function (s) {
      return s.smooth;
    });
    controles.push({ label: 'Curvas suaves', kind: 'toggle', key: 'suave' });
  }
  if (todos(['bar']) && !ej.multiples) {
    estado.horizontal = o.orientation === 'horizontal';
    controles.push({ label: 'Horizontal', kind: 'toggle', key: 'horizontal' });
  }
  if (todos(['donut', 'pie'])) {
    estado.dona = tipos[0] === 'donut';
    controles.push({ label: 'Con agujero (donut)', kind: 'toggle', key: 'dona' });
  }
  if (todos(['choropleth', 'mapbubble'])) {
    estado.proyeccion = o.series[0].projection || 'equalEarth';
    controles.push({
      label: 'Proyección',
      kind: 'select',
      key: 'proyeccion',
      options: [
        ['equalEarth', 'Equal Earth (áreas reales)'],
        ['mercator', 'Mercator'],
        ['orthographic', 'Globo'],
      ],
    });
  }
  if (esCartesiano && !ej.multiples) {
    estado.zoom = !!o.zoom;
    controles.push({ label: 'Zoom', kind: 'toggle', key: 'zoom' });
  }
  if (o.series.length > 1 && !ej.multiples) controles.push({ label: 'Leyenda', kind: 'toggle', key: 'leyenda' });
  if (!ej.multiples) controles.push({ label: 'Altura', kind: 'range', key: 'altura', min: 220, max: 560, step: 20 });

  /** Las opciones que salen de los ajustes: siempre todas las claves, así quitar algo también se ve. */
  function opciones() {
    var r = JSON.parse(JSON.stringify(o));
    if (o.yAxis && o.yAxis.format) r.yAxis.format = o.yAxis.format;
    r.series = o.series.map(function (s) {
      var c = Object.assign({}, s);
      if (estado.tipo) {
        c.type = estado.tipo;
        c.stack = estado.apilar && estado.tipo !== 'line' && estado.tipo !== 'step' ? true : undefined;
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
  function crear() {
    if (chart) chart.destroy();
    // El título ya está arriba de la página: el gráfico no lo repite (el código sí lo lleva).
    var op = Object.assign({ background: false }, opciones(), { title: undefined, subtitle: undefined });
    chart = siteChart(ej.multiples ? LozChart.multiples('#grafico', op) : new LozChart('#grafico', op));
  }
  function aplicar(animar) {
    // Pasar de cartesiano a mapa u otra forma: se recrea; si no, cambia animando.
    if (ej.multiples) crear();
    else chart.setOptions(Object.assign({ background: false }, opciones(), { title: undefined, subtitle: undefined }), animar);
    mostrarCodigo();
  }
  crear();
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
    if (completo || d.length <= 4) return 'const datos = ' + js(d, 0) + ';';
    return 'const datos = ' + js(d.slice(0, 3), 0).replace(/\n\]$/, '\n  // … ' + (d.length - 3) + ' filas más\n]') + ';';
  }
  function sinDatos() {
    var r = opciones();
    delete r.data;
    return r;
  }
  function codigoJS(completo) {
    var fn = ej.multiples ? 'LozChart.multiples' : 'new LozChart';
    var r = sinDatos();
    var cuerpo = js(r, 0).replace(/^\{/, '{\n  data: datos,');
    return datos(completo) + '\n\n' + fn + "('#grafico', " + cuerpo + ');';
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
      " } from 'lozcharts/react';\n\n" +
      datos(false) +
      '\n\nexport function Grafico() {\n  return (\n    <' +
      comp +
      '\n      data={datos}\n' +
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
      '<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8">\n  <title>' +
      o.title +
      '</title>\n</head>\n<body>\n' +
      '  <div id="grafico" style="max-width: 900px; margin: 40px auto;"></div>\n\n' +
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
          avisar('Código copiado');
        },
        function () {
          avisar('No se pudo copiar: selecciónalo a mano');
        },
      );
    }
  });
  byId('descargar').addEventListener('click', function () {
    // Un archivo que funciona solo, con doble clic: la librería y los datos van adentro.
    var mapa = /choropleth|mapbubble/.test(JSON.stringify(o.series));
    var libs = [
      fetch('lib/lozcharts.umd.js').then(function (r) {
        return r.text();
      }),
    ];
    if (mapa)
      libs.push(
        fetch('lib/maps/world.umd.js').then(function (r) {
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
      avisar('Listo: ábrelo con doble clic');
    });
  });

  // ------------------------------------------------------------ Más ejemplos

  EJEMPLOS.filter(function (e) {
    return e.id !== ej.id;
  })
    .slice(0, 8)
    .forEach(function (e) {
      var a = document.createElement('a');
      a.href = 'demo.html?id=' + e.id;
      var t = document.createElement('strong');
      t.textContent = e.opciones.title;
      var s = document.createElement('span');
      s.textContent = e.tipo;
      a.append(t, s);
      byId('mas').appendChild(a);
    });
})();
