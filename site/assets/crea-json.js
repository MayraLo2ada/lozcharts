/*
 * Lector de JSON de «Crea el tuyo» (y de qa/capas.html): además del valor, guarda en qué línea empieza cada parte
 * ("layers[2].icon.if" → 31) para señalar los avisos, y explica los errores de escritura como lo
 * haría una persona ("falta una coma"), con la línea y la columna.
 */
(function () {
  'use strict';

  // Los mensajes en el idioma de la página (window.IDIOMA, de assets/idioma.js); sin él, español.
  var MENSAJES = {
    es: {
      comentario: 'JSON no admite comentarios con //; bórralo o ponlo en un campo "nota".',
      simples: 'Los textos van entre comillas dobles ("así"), no simples.',
      corto: 'El JSON termina antes de tiempo: falta cerrar algo.',
      comaAntes: function (c) {
        return 'Sobra una coma antes de "' + c + '", o falta un valor.';
      },
      comillas: function (p) {
        return '"' + p + '" debe ir entre comillas dobles: "' + p + '".';
      },
      valor: function (v) {
        return 'Aquí esperaba un valor (un texto, un número, una lista o un objeto) y encontré ' + v + '.';
      },
      sobra: function (c) {
        return 'Sobra la coma antes de "' + c + '".';
      },
      clave: function (p) {
        return 'La clave ' + p + ' va entre comillas dobles: "' + p + '".';
      },
      nombreClave: function (v) {
        return 'Aquí va el nombre de una clave entre comillas dobles y encontré ' + v + '.';
      },
      dosPuntos: function (k) {
        return 'Falta ":" después de "' + k + '".';
      },
      comaClave: 'Falta una coma antes de la clave que empieza aquí.',
      cerrar: function (c) {
        return c === '}' ? 'Falta una coma o cerrar el objeto con "}".' : 'Falta una coma o cerrar la lista con "]".';
      },
      comaLista: 'Falta una coma entre dos elementos de la lista.',
      partido: 'Un texto no puede partirse en dos líneas: falta cerrar las comillas.',
      sinCierre: 'Falta cerrar las comillas.',
      barra: 'Este texto tiene una barra invertida que JSON no entiende.',
      numero: 'Este número está mal escrito.',
      final: 'Sobra algo después del final del JSON.',
      elFinal: 'el final',
      unTexto: 'un texto',
    },
    en: {
      comentario: 'JSON doesn’t allow // comments; delete it or put it in a "note" field.',
      simples: 'Text goes in double quotes ("like this"), not single ones.',
      corto: 'The JSON ends too soon: something isn’t closed.',
      comaAntes: function (c) {
        return 'There’s an extra comma before "' + c + '", or a value is missing.';
      },
      comillas: function (p) {
        return '"' + p + '" needs double quotes: "' + p + '".';
      },
      valor: function (v) {
        return 'Expected a value here (text, a number, a list, or an object) and found ' + v + '.';
      },
      sobra: function (c) {
        return 'There’s an extra comma before "' + c + '".';
      },
      clave: function (p) {
        return 'The key ' + p + ' needs double quotes: "' + p + '".';
      },
      nombreClave: function (v) {
        return 'A key name in double quotes goes here, and I found ' + v + '.';
      },
      dosPuntos: function (k) {
        return '":" is missing after "' + k + '".';
      },
      comaClave: 'A comma is missing before the key that starts here.',
      cerrar: function (c) {
        return c === '}'
          ? 'A comma is missing, or the object needs a closing "}".'
          : 'A comma is missing, or the list needs a closing "]".';
      },
      comaLista: 'A comma is missing between two items of the list.',
      partido: 'Text can’t be split across two lines: a closing quote is missing.',
      sinCierre: 'A closing quote is missing.',
      barra: 'This text has a backslash JSON doesn’t understand.',
      numero: 'This number is written wrong.',
      final: 'There’s something extra after the end of the JSON.',
      elFinal: 'the end',
      unTexto: 'some text',
    },
    pt: {
      comentario: 'JSON não aceita comentários com //; apague ou coloque num campo "nota".',
      simples: 'Os textos vão entre aspas duplas ("assim"), não simples.',
      corto: 'O JSON termina antes da hora: falta fechar alguma coisa.',
      comaAntes: function (c) {
        return 'Sobra uma vírgula antes de "' + c + '", ou falta um valor.';
      },
      comillas: function (p) {
        return '"' + p + '" precisa de aspas duplas: "' + p + '".';
      },
      valor: function (v) {
        return 'Aqui eu esperava um valor (um texto, um número, uma lista ou um objeto) e encontrei ' + v + '.';
      },
      sobra: function (c) {
        return 'Sobra a vírgula antes de "' + c + '".';
      },
      clave: function (p) {
        return 'A chave ' + p + ' precisa de aspas duplas: "' + p + '".';
      },
      nombreClave: function (v) {
        return 'Aqui vai o nome de uma chave entre aspas duplas, e encontrei ' + v + '.';
      },
      dosPuntos: function (k) {
        return 'Falta ":" depois de "' + k + '".';
      },
      comaClave: 'Falta uma vírgula antes da chave que começa aqui.',
      cerrar: function (c) {
        return c === '}' ? 'Falta uma vírgula ou fechar o objeto com "}".' : 'Falta uma vírgula ou fechar a lista com "]".';
      },
      comaLista: 'Falta uma vírgula entre dois itens da lista.',
      partido: 'Um texto não pode ser quebrado em duas linhas: falta fechar as aspas.',
      sinCierre: 'Falta fechar as aspas.',
      barra: 'Este texto tem uma barra invertida que o JSON não entende.',
      numero: 'Este número está escrito errado.',
      final: 'Sobra algo depois do fim do JSON.',
      elFinal: 'o fim',
      unTexto: 'um texto',
    },
  };
  var M = MENSAJES[window.IDIOMA] || MENSAJES.es;

  function JsonError(message, line, column) {
    this.message = message;
    this.line = line;
    this.column = column;
  }

  function leer(texto) {
    var i = 0;
    var linea = 1;
    var inicioLinea = 0;
    var lineas = {};

    function columna() {
      return i - inicioLinea + 1;
    }
    function fallar(mensaje) {
      throw new JsonError(mensaje, linea, columna());
    }
    function espacios() {
      while (i < texto.length) {
        var c = texto[i];
        if (c === '\n') {
          linea++;
          inicioLinea = i + 1;
          i++;
        } else if (c === ' ' || c === '\t' || c === '\r') i++;
        else if (c === '/' && texto[i + 1] === '/') fallar(M.comentario);
        else break;
      }
    }
    function visto() {
      var c = texto[i];
      if (c === undefined) return M.elFinal;
      if (c === '"') return M.unTexto;
      return '"' + c + '"';
    }

    function valor(ruta) {
      espacios();
      lineas[ruta] = linea;
      var c = texto[i];
      if (c === '{') return objeto(ruta);
      if (c === '[') return lista(ruta);
      if (c === '"') return cadena();
      if (c === "'") fallar(M.simples);
      if (c === '-' || (c >= '0' && c <= '9')) return numero();
      if (texto.startsWith('true', i)) return ((i += 4), true);
      if (texto.startsWith('false', i)) return ((i += 5), false);
      if (texto.startsWith('null', i)) return ((i += 4), null);
      if (c === undefined) fallar(M.corto);
      if (c === '}' || c === ']') fallar(M.comaAntes(c));
      var palabra = /^[A-Za-z_][\w-]*/.exec(texto.slice(i));
      if (palabra) fallar(M.comillas(palabra[0]));
      fallar(M.valor(visto()));
    }

    function objeto(ruta) {
      var out = {};
      i++;
      espacios();
      if (texto[i] === '}') return (i++, out);
      for (;;) {
        espacios();
        if (texto[i] === '}') fallar(M.sobra('}'));
        if (texto[i] !== '"') {
          var palabra = /^[A-Za-z_][\w-]*/.exec(texto.slice(i));
          if (palabra) fallar(M.clave(palabra[0]));
          fallar(M.nombreClave(visto()));
        }
        var clave = cadena();
        espacios();
        if (texto[i] !== ':') fallar(M.dosPuntos(clave));
        i++;
        out[clave] = valor(ruta ? ruta + '.' + clave : clave);
        espacios();
        if (texto[i] === ',') {
          i++;
          continue;
        }
        if (texto[i] === '}') return (i++, out);
        if (texto[i] === '"') fallar(M.comaClave);
        fallar(M.cerrar('}'));
      }
    }

    function lista(ruta) {
      var out = [];
      i++;
      espacios();
      if (texto[i] === ']') return (i++, out);
      for (;;) {
        espacios();
        if (texto[i] === ']') fallar(M.sobra(']'));
        out.push(valor(ruta + '[' + out.length + ']'));
        espacios();
        if (texto[i] === ',') {
          i++;
          continue;
        }
        if (texto[i] === ']') return (i++, out);
        if (texto[i] === '{' || texto[i] === '"' || texto[i] === '[') fallar(M.comaLista);
        fallar(M.cerrar(']'));
      }
    }

    function cadena() {
      var desde = i;
      i++;
      while (i < texto.length && texto[i] !== '"') {
        if (texto[i] === '\n') fallar(M.partido);
        if (texto[i] === '\\') i++;
        i++;
      }
      if (i >= texto.length) fallar(M.sinCierre);
      i++;
      try {
        return JSON.parse(texto.slice(desde, i));
      } catch (e) {
        fallar(M.barra);
      }
    }

    function numero() {
      var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(texto.slice(i));
      if (!m) fallar(M.numero);
      i += m[0].length;
      return Number(m[0]);
    }

    var resultado = valor('');
    espacios();
    if (i < texto.length) fallar(M.final);
    return { valor: resultado, lineas: lineas };
  }

  /** La línea de una ruta de aviso: la suya, o la de su parte conocida más cercana. */
  function lineaDe(lineas, ruta) {
    var r = ruta;
    while (r) {
      if (lineas[r] !== undefined) return lineas[r];
      var corte = Math.max(r.lastIndexOf('.'), r.lastIndexOf('['));
      if (corte <= 0) break;
      r = r.slice(0, corte);
    }
    return lineas[r] !== undefined ? lineas[r] : 1;
  }

  window.LectorJSON = { leer: leer, lineaDe: lineaDe, JsonError: JsonError };
})();
