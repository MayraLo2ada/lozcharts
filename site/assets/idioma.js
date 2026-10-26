/*
 * Idioma del sitio. Va en el <head> de cada página, antes que los demás scripts.
 *
 * - window.IDIOMA: 'es', 'en' o 'pt', sacado de <html lang> (lo pone npm run site).
 * - window.LOCALE: el idioma completo ('es', 'en', 'pt-BR'), para Intl y la opción `locale`.
 * - window.tx({ es: '…', en: '…', pt: '…' }): el texto del idioma de la página. Lo que no es un
 *   objeto así pasa tal cual, y si falta un idioma queda el español.
 * - El selector de idioma de la barra: se cierra con Escape o al tocar fuera, y al cambiar de
 *   idioma conserva el ?id= de la página de ejemplo y, en la documentación, la sección.
 */
(function () {
  var lang = document.documentElement.lang || 'es';
  var idioma = lang.slice(0, 2).toLowerCase();
  if (idioma !== 'en' && idioma !== 'pt') idioma = 'es';
  window.IDIOMA = idioma;
  window.LOCALE = idioma === 'pt' ? 'pt-BR' : idioma;
  window.tx = function (o) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || !('es' in o)) return o;
    return idioma in o ? o[idioma] : o.es;
  };

  /** Anclas de la documentación de un enlace del selector (vacío fuera de la documentación). */
  function anclas(a) {
    var d = a.getAttribute('data-anclas');
    return d ? d.split(' ') : [];
  }
  function actual() {
    return document.querySelector('.idioma a[aria-current]');
  }
  function hash() {
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch (e) {
      return location.hash.slice(1);
    }
  }

  // Un enlace viejo a una sección de la documentación en otro idioma (docs.html#instalar, de
  // cuando el sitio era solo en español) lleva a esa sección en su idioma.
  function corregirAncla() {
    var h = hash();
    if (!h || document.getElementById(h)) return;
    var otros = document.querySelectorAll('.idioma a[data-anclas]:not([aria-current])');
    for (var i = 0; i < otros.length; i++)
      if (anclas(otros[i]).indexOf(h) >= 0) return location.replace(otros[i].getAttribute('href') + location.hash);
  }

  document.addEventListener('DOMContentLoaded', corregirAncla);

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.idioma a[hreflang]');
    if (a && !a.hasAttribute('aria-current')) {
      var destino = a.getAttribute('href') + location.search;
      var yo = actual();
      var k = yo ? anclas(yo).indexOf(hash()) : -1;
      if (k >= 0 && anclas(a)[k]) destino += '#' + anclas(a)[k];
      else if (location.hash && !a.hasAttribute('data-anclas')) destino += location.hash;
      e.preventDefault();
      location.href = destino;
      return;
    }
    document.querySelectorAll('details.idioma[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('details.idioma[open]').forEach(function (d) {
      d.removeAttribute('open');
      d.querySelector('summary').focus();
    });
  });
})();
