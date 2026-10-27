/*
 * Lector de JSON del editor: además del valor, guarda en qué línea empieza cada parte
 * ("layers[2].icon.if" → 31) para señalar los avisos, y explica los errores de escritura como lo
 * haría una persona ("falta una coma"), con la línea y la columna.
 */
(function () {
  'use strict';

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
        else if (c === '/' && texto[i + 1] === '/')
          fallar('JSON no admite comentarios con //; bórralo o ponlo en un campo "nota".');
        else break;
      }
    }
    function visto() {
      var c = texto[i];
      if (c === undefined) return 'el final';
      if (c === '"') return 'un texto';
      return '"' + c + '"';
    }

    function valor(ruta) {
      espacios();
      lineas[ruta] = linea;
      var c = texto[i];
      if (c === '{') return objeto(ruta);
      if (c === '[') return lista(ruta);
      if (c === '"') return cadena();
      if (c === "'") fallar('Los textos van entre comillas dobles ("así"), no simples.');
      if (c === '-' || (c >= '0' && c <= '9')) return numero();
      if (texto.startsWith('true', i)) return ((i += 4), true);
      if (texto.startsWith('false', i)) return ((i += 5), false);
      if (texto.startsWith('null', i)) return ((i += 4), null);
      if (c === undefined) fallar('El JSON termina antes de tiempo: falta cerrar algo.');
      if (c === '}' || c === ']') fallar('Sobra una coma antes de "' + c + '", o falta un valor.');
      var palabra = /^[A-Za-z_][\w-]*/.exec(texto.slice(i));
      if (palabra) fallar('"' + palabra[0] + '" debe ir entre comillas dobles: "' + palabra[0] + '".');
      fallar('Aquí esperaba un valor (un texto, un número, una lista o un objeto) y encontré ' + visto() + '.');
    }

    function objeto(ruta) {
      var out = {};
      i++;
      espacios();
      if (texto[i] === '}') return (i++, out);
      for (;;) {
        espacios();
        if (texto[i] === '}') fallar('Sobra la coma antes de "}".');
        if (texto[i] !== '"') {
          var palabra = /^[A-Za-z_][\w-]*/.exec(texto.slice(i));
          if (palabra) fallar('La clave ' + palabra[0] + ' va entre comillas dobles: "' + palabra[0] + '".');
          fallar('Aquí va el nombre de una clave entre comillas dobles y encontré ' + visto() + '.');
        }
        var clave = cadena();
        espacios();
        if (texto[i] !== ':') fallar('Falta ":" después de "' + clave + '".');
        i++;
        out[clave] = valor(ruta ? ruta + '.' + clave : clave);
        espacios();
        if (texto[i] === ',') {
          i++;
          continue;
        }
        if (texto[i] === '}') return (i++, out);
        if (texto[i] === '"') fallar('Falta una coma antes de la clave que empieza aquí.');
        fallar('Falta una coma o cerrar el objeto con "}".');
      }
    }

    function lista(ruta) {
      var out = [];
      i++;
      espacios();
      if (texto[i] === ']') return (i++, out);
      for (;;) {
        espacios();
        if (texto[i] === ']') fallar('Sobra la coma antes de "]".');
        out.push(valor(ruta + '[' + out.length + ']'));
        espacios();
        if (texto[i] === ',') {
          i++;
          continue;
        }
        if (texto[i] === ']') return (i++, out);
        if (texto[i] === '{' || texto[i] === '"' || texto[i] === '[') fallar('Falta una coma entre dos elementos de la lista.');
        fallar('Falta una coma o cerrar la lista con "]".');
      }
    }

    function cadena() {
      var desde = i;
      i++;
      while (i < texto.length && texto[i] !== '"') {
        if (texto[i] === '\n') fallar('Un texto no puede partirse en dos líneas: falta cerrar las comillas.');
        if (texto[i] === '\\') i++;
        i++;
      }
      if (i >= texto.length) fallar('Falta cerrar las comillas.');
      i++;
      try {
        return JSON.parse(texto.slice(desde, i));
      } catch (e) {
        fallar('Este texto tiene una barra invertida que JSON no entiende.');
      }
    }

    function numero() {
      var m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(texto.slice(i));
      if (!m) fallar('Este número está mal escrito.');
      i += m[0].length;
      return Number(m[0]);
    }

    var resultado = valor('');
    espacios();
    if (i < texto.length) fallar('Sobra algo después del final del JSON.');
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
