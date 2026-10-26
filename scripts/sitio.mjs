// Arma el sitio en site/. Uso: npm run site (compila antes).
//
// 1. Copia la librería compilada a site/lib.
// 2. Genera cada página en los tres idiomas desde su plantilla (site/plantillas/) y sus textos
//    (scripts/textos/): inglés en la raíz, español en site/es/ y portugués en site/pt/. La
//    documentación de cada idioma sale de su README, así nunca queda desactualizada.
// 3. Deja páginas puente en las rutas viejas en español (galeria.html → es/galeria.html).
// 4. Pone versiones en las URLs de los recursos propios de cada página (ver `versionar`).
//
// Las páginas generadas no van en git (.gitignore): lo que se edita son las plantillas y los textos.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const SITIO = 'site';

mkdirSync('site/lib/maps', { recursive: true });
copyFileSync('dist/lozcharts.umd.js', 'site/lib/lozcharts.umd.js');
copyFileSync('dist/maps/world.umd.js', 'site/lib/maps/world.umd.js');
copyFileSync('llms.txt', 'site/llms.txt');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Ancla como la de GitHub: minúsculas, sin signos, espacios a guiones (las letras con acento quedan). */
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

/**
 * Texto en línea: `código`, **negrita**, _cursiva_ y [enlaces](url). El código se aparta antes
 * con una marca, así una negrita puede llevar código adentro (**Con `<script>`.**).
 */
function inline(text) {
  const codigos = [];
  const marcado = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codigos.push(c) - 1}\u0000`);
  return esc(marcado)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => {
      // Las anclas del README apuntan a esta misma página; los archivos del repositorio
      // (llms.txt, DESIGN.md) no viven en el sitio, así que van a GitHub.
      const relativo = !url.startsWith('#') && !/^[a-z]+:/i.test(url);
      const href = relativo ? 'https://github.com/MayraLo2ada/lozcharts/blob/main/' + url.replace(/^\.\//, '') : url;
      return `<a href="${href}">${t}</a>`;
    })
    .replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${esc(codigos[n])}</code>`);
}

const LENGUAJES = { bash: 'Terminal', html: 'HTML', js: 'JavaScript', jsx: 'React (JSX)', ts: 'TypeScript' };
/** Lo poco que escribe el script mismo en la documentación, en cada idioma. */
const PALABRAS = {
  es: { text: 'Texto', codigo: 'Código', copiar: 'Copiar' },
  en: { text: 'Text', codigo: 'Code', copiar: 'Copy' },
  pt: { text: 'Texto', codigo: 'Código', copiar: 'Copiar' },
};

/** Un bloque de código con su barra: el lenguaje y el botón de copiar (lo activa la plantilla). */
function bloque(lang, body, idioma = 'es') {
  const p = PALABRAS[idioma];
  const nombre = LENGUAJES[lang] || (lang === 'text' ? p.text : lang) || p.codigo;
  return (
    `<div class="bloque"><div class="bloque-barra"><span>${esc(nombre)}</span>` +
    `<button type="button" class="copiar" hidden>${p.copiar}</button></div>` +
    `<pre class="code"><code>${esc(body.join('\n'))}</code></pre></div>`
  );
}

/**
 * Markdown del README a bloques: títulos, párrafos, listas, citas, tablas, código y gráficos vivos.
 * Cada bloque dice a qué columna va: 'txt' (prosa), 'ej' (código y gráficos) o 'ancho' (tablas).
 * Un comentario `<!-- vivo: nombre -->` en su propia línea es un gráfico vivo que dibuja la
 * plantilla; en GitHub no se ve.
 */
export function bloques(md, idioma = 'es') {
  // La línea de idiomas de arriba del README (English · Español · Português) es para GitHub y npm;
  // en el sitio el selector de idioma está en la barra.
  const lines = md.split('\n').filter((l) => !/^\S*(English|Español|Português)\S* · .*(README|Español|Português)/.test(l));
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++;
      out.push({ col: 'ej', html: bloque(lang, body, idioma) });
      continue;
    }
    const vivo = /^<!--\s*vivo:\s*([\w-]+)\s*-->\s*$/.exec(line);
    if (vivo) {
      out.push({ col: 'ej', html: `<figure class="vivo" data-vivo="${vivo[1]}"></figure>` });
      i++;
      continue;
    }
    if (line.startsWith('<!--')) {
      for (; i < lines.length && !lines[i].includes('-->'); i++);
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const id = slug(h[2].replace(/`/g, ''));
      if (level > 1) out.push({ col: 'h' + level, id, html: inline(h[2]) });
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
      const cells = (r) =>
        r
          .slice(1, -1)
          .split(/(?<!\\)\|/)
          .map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push({
        col: 'ancho',
        html:
          '<div class="tabla"><table><thead><tr>' +
          head.map((c) => `<th scope="col">${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body
            .map(
              (r) =>
                '<tr>' +
                r.map((c, k) => `<td data-th="${esc(head[k].replace(/`/g, ''))}"><span>${inline(c)}</span></td>`).join('') +
                '</tr>',
            )
            .join('') +
          '</tbody></table></div>',
      });
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      const items = [];
      for (; i < lines.length && (/^\s*[-*]\s/.test(lines[i]) || /^\s{2,}\S/.test(lines[i])); i++) {
        if (/^[-*]\s/.test(lines[i])) items.push(lines[i].replace(/^[-*]\s/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim().replace(/^[-*]\s/, '');
      }
      out.push({ col: 'txt', html: '<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>' });
      continue;
    }
    if (line.startsWith('>')) {
      const body = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) body.push(lines[i].replace(/^>\s?/, ''));
      out.push({ col: 'txt', html: `<blockquote>${inline(body.join(' '))}</blockquote>` });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#|```|\||>|<!--|\s*[-*]\s)/.test(lines[i]); i++) para.push(lines[i]);
    out.push({ col: 'txt', html: `<p>${inline(para.join(' '))}</p>` });
  }
  return out;
}

/**
 * Agrupa los bloques de una sección en pares de prosa y ejemplo: una racha de texto con la racha
 * de código que la sigue. En pantallas anchas cada par va en dos columnas, la prosa a la izquierda
 * y su código al lado. Un ejemplo sin texto antes se junta con el texto que lo explica después, y
 * el texto que queda al final de la sección se suma al último par. Las tablas van a todo el ancho.
 */
function pares(seccion) {
  const grupos = [];
  let par = null;
  const cerrar = () => {
    if (par) grupos.push(par);
    par = null;
  };
  for (const b of seccion) {
    if (b.col === 'ancho') {
      cerrar();
      grupos.push(b);
      continue;
    }
    if (!par) par = { txt: [], ej: [] };
    if (b.col === 'txt' && par.ej.length && par.txt.length) {
      cerrar();
      par = { txt: [], ej: [] };
    }
    par[b.col === 'ej' ? 'ej' : 'txt'].push(b.html);
  }
  cerrar();
  // Texto suelto al final: va con el par anterior si no hay una tabla de por medio.
  const ultimo = grupos[grupos.length - 1];
  const previo = grupos[grupos.length - 2];
  if (ultimo && previo && ultimo.txt && !ultimo.ej.length && previo.txt) {
    previo.txt.push(...ultimo.txt);
    grupos.pop();
  }
  return grupos
    .map((g) => {
      if (!g.txt) return g.html;
      if (!g.ej.length) return `<div class="par solo"><div class="txt">${g.txt.join('\n')}</div></div>`;
      return `<div class="par"><div class="txt">${g.txt.join('\n')}</div><div class="ej">${g.ej.join('\n')}</div></div>`;
    })
    .join('\n');
}

/**
 * Grupos del índice: la sección con la que empieza cada uno, por su ancla en el README en español.
 * Los README de los tres idiomas tienen las mismas secciones en el mismo orden, así que en inglés
 * y portugués el grupo empieza en la sección del mismo número. Si un título cambia y su ancla ya
 * no está aquí, la sección sigue en el grupo anterior (no se rompe nada, solo cambia el agrupado).
 */
const GRUPOS = {
  instalar: { es: 'Para empezar', en: 'Getting started', pt: 'Primeiros passos' },
  'tipos-de-serie': { es: 'Tipos de gráfico', en: 'Chart types', pt: 'Tipos de gráfico' },
  react: { es: 'Con tu framework', en: 'With your framework', pt: 'Com o seu framework' },
  'muchos-datos': { es: 'Guías', en: 'Guides', pt: 'Guias' },
  opciones: { es: 'Referencia', en: 'Reference', pt: 'Referência' },
  'cómo-funciona-por-dentro': { es: 'Por dentro', en: 'Under the hood', pt: 'Por dentro' },
};

/** Las secciones `##` de un README: la introducción (sin título) y las demás. */
function secciones(md, idioma) {
  const lista = [];
  let actual = { h: null, cuerpo: [] };
  for (const b of bloques(md, idioma)) {
    if (b.col === 'h2') {
      lista.push(actual);
      actual = { h: b, cuerpo: [] };
    } else if (/^h\d$/.test(b.col))
      actual.cuerpo.push({ col: 'txt', id: b.id, html: `<${b.col} id="${b.id}">${b.html}</${b.col}>` });
    else actual.cuerpo.push(b);
  }
  lista.push(actual);
  return lista;
}

/**
 * El README completo: la introducción, las secciones en pares y el índice agrupado. `inicios` dice
 * en qué número de sección empieza cada grupo del índice (sale del README en español).
 */
export function documentacion(md, idioma = 'es', inicios = null) {
  const [intro, ...resto] = secciones(md, idioma);
  if (!inicios) inicios = gruposPorNumero(resto);
  const introHtml = `<div class="intro">${intro.cuerpo.map((b) => b.html).join('\n')}</div>`;
  const html = resto
    .map(
      (s) => `<section class="sec" aria-labelledby="${s.h.id}"><h2 id="${s.h.id}">${s.h.html}</h2>\n${pares(s.cuerpo)}</section>`,
    )
    .join('\n');
  let indice = '';
  let abierto = false;
  resto.forEach((s, k) => {
    if (inicios.has(k)) {
      if (abierto) indice += '</ol></li>\n';
      indice += `<li class="grupo"><span class="grupo-titulo">${inicios.get(k)[idioma]}</span><ol>\n`;
      abierto = true;
    }
    indice += `<li><a href="#${s.h.id}">${s.h.html}</a></li>\n`;
  });
  if (abierto) indice += '</ol></li>';
  // Las anclas de todos los títulos, en orden: el selector de idioma lleva a la misma sección.
  const anclas = resto.flatMap((s) => [s.h.id, ...s.cuerpo.filter((b) => b.id).map((b) => b.id)]);
  return { intro: introHtml, html, indice, secciones: resto.length, anclas };
}

/** Número de sección → títulos del grupo que empieza ahí (ver GRUPOS). */
function gruposPorNumero(resto) {
  const inicios = new Map();
  resto.forEach((s, k) => {
    if (GRUPOS[s.h.id]) inicios.set(k, GRUPOS[s.h.id]);
  });
  return inicios;
}

/* ------------------------------------------------------------------------------------------------
 * Idiomas
 * ------------------------------------------------------------------------------------------------
 * Cada página tiene una plantilla en site/plantillas/ con marcas {{…}} y sus textos en
 * scripts/textos/<página>.mjs (más los comunes en scripts/textos/comun.mjs), cada texto con sus
 * tres idiomas juntos: { es: '…', en: '…', pt: '…' }. Así, al cambiar una frase se ven las tres.
 *
 * Marcas de las plantillas:
 *   {{clave}}        un texto de los diccionarios (puede llevar HTML)
 *   {{p:pagina}}     el enlace a otra página del mismo idioma (galeria, docs, caso, demo, inicio)
 *   {{raiz}}         la ruta a la raíz del sitio ('' en inglés, '../' en las carpetas)
 *   {{lang}}         el idioma de la página (en, es, pt-BR): va en <html lang> y la librería lo
 *                    toma como su `locale`
 *   {{og_locale}}    el idioma para Open Graph (en_US, es_LA, pt_BR)
 *   {{url}}          la dirección completa de esta página
 *   {{alternos}}     canonical y hreflang de la página
 *   {{selector}}     el selector de idioma de la barra
 *   {{idiomas_pie}}  los tres idiomas como enlaces, para el pie
 * Una marca sin texto detiene el armado: mejor un error que una página con {{algo}} a la vista.
 */
export const BASE = 'https://mayralo2ada.github.io/lozcharts/';
export const IDIOMAS = {
  en: { lang: 'en', carpeta: '', og: 'en_US', nombre: 'English', corto: 'EN', readme: 'README.md', etiqueta: 'Language' },
  es: { lang: 'es', carpeta: 'es/', og: 'es_LA', nombre: 'Español', corto: 'ES', readme: 'README.es.md', etiqueta: 'Idioma' },
  pt: {
    lang: 'pt-BR',
    carpeta: 'pt/',
    og: 'pt_BR',
    nombre: 'Português',
    corto: 'PT',
    readme: 'README.pt.md',
    etiqueta: 'Idioma',
  },
};
/** Las páginas: su plantilla y su nombre de archivo en cada idioma. */
export const PAGINAS = {
  inicio: { plantilla: 'index.html', en: 'index.html', es: 'index.html', pt: 'index.html' },
  galeria: { plantilla: 'galeria.html', en: 'gallery.html', es: 'galeria.html', pt: 'galeria.html' },
  demo: { plantilla: 'demo.html', en: 'demo.html', es: 'demo.html', pt: 'demo.html' },
  caso: { plantilla: 'caso-real.html', en: 'case-study.html', es: 'caso-real.html', pt: 'caso-real.html' },
  docs: { plantilla: 'docs.html', en: 'docs.html', es: 'docs.html', pt: 'docs.html' },
};
/**
 * Rutas viejas, de cuando el sitio era solo en español: quedan como puente a la página en español.
 * index.html, docs.html y demo.html no hacen falta: hoy son las páginas en inglés (una ancla vieja
 * de docs.html, como #instalar, la lleva assets/idioma.js a es/docs.html).
 */
const PUENTES = { 'galeria.html': 'galeria', 'caso-real.html': 'caso' };

/** Enlace de una página a otra del mismo idioma (las dos viven en la misma carpeta). */
const enlace = (idioma, pagina) => (pagina === 'inicio' ? './' : PAGINAS[pagina][idioma]);
/** Dirección completa de una página. */
const direccion = (idioma, pagina) => BASE + IDIOMAS[idioma].carpeta + (pagina === 'inicio' ? '' : PAGINAS[pagina][idioma]);
/** Enlace desde una página en `desde` a la misma página en `hacia`. */
const enlaceIdioma = (desde, hacia, pagina) =>
  (IDIOMAS[desde].carpeta ? '../' : '') + IDIOMAS[hacia].carpeta + (pagina === 'inicio' ? '' : PAGINAS[pagina][hacia]) || './';

const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

/** Lee un diccionario de textos y revisa que cada texto traiga los tres idiomas. */
async function diccionario(nombre) {
  const archivo = join('scripts/textos', nombre + '.mjs');
  if (!existsSync(archivo)) return {};
  const textos = (await import(pathToFileURL(archivo).href)).default;
  for (const [clave, t] of Object.entries(textos))
    for (const idioma of Object.keys(IDIOMAS))
      if (typeof t?.[idioma] !== 'string') throw new Error(`${archivo}: a "${clave}" le falta el texto en "${idioma}"`);
  return textos;
}

/** El selector de idioma de la barra: un desplegable que funciona sin JavaScript. */
function selector(idioma, pagina, anclas) {
  const yo = IDIOMAS[idioma];
  const items = Object.entries(IDIOMAS)
    .map(([id, i]) => {
      const actual = id === idioma ? ' aria-current="true"' : '';
      const datos = anclas ? ` data-anclas="${anclas[id].join(' ')}"` : '';
      return `<li><a href="${enlaceIdioma(idioma, id, pagina)}" hreflang="${i.lang}" lang="${i.lang}"${actual}${datos}><span>${i.corto}</span>${i.nombre}</a></li>`;
    })
    .join('');
  return (
    `<details class="idioma"><summary aria-label="${yo.etiqueta}: ${yo.nombre}" title="${yo.etiqueta}">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>` +
    `<span>${yo.corto}</span></summary><ul>${items}</ul></details>`
  );
}

/** Arma una página en un idioma: reemplaza las marcas de la plantilla. */
function armar(plantilla, idioma, pagina, textos, extra = {}) {
  const yo = IDIOMAS[idioma];
  const alternos = [
    `<link rel="canonical" href="${direccion(idioma, pagina)}" />`,
    ...Object.entries(IDIOMAS).map(([id, i]) => `<link rel="alternate" hreflang="${i.lang}" href="${direccion(id, pagina)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${direccion('en', pagina)}" />`,
  ].join('\n    ');
  const pie = Object.entries(IDIOMAS)
    .map(([id, i]) =>
      id === idioma
        ? `<a aria-current="true" lang="${i.lang}">${i.nombre}</a>`
        : `<a href="${enlaceIdioma(idioma, id, pagina)}" hreflang="${i.lang}" lang="${i.lang}">${i.nombre}</a>`,
    )
    .join(' ');
  const fijas = {
    raiz: yo.carpeta ? '../' : '',
    lang: yo.lang,
    og_locale: yo.og,
    url: direccion(idioma, pagina),
    alternos,
    selector: selector(idioma, pagina, extra.anclas),
    idiomas_pie: `<span class="idiomas-pie">${pie}</span>`,
  };
  return plantilla.replace(/\{\{([\w:.-]+)\}\}/g, (todo, clave) => {
    if (clave.startsWith('p:')) {
      const p = clave.slice(2);
      if (!PAGINAS[p]) throw new Error(`site/plantillas/${PAGINAS[pagina].plantilla}: no conozco la página "${p}"`);
      return enlace(idioma, p);
    }
    if (clave in fijas) return fijas[clave];
    if (clave in textos) return textos[clave][idioma];
    throw new Error(`site/plantillas/${PAGINAS[pagina].plantilla}: falta el texto {{${clave}}}`);
  });
}

/** Página puente de una ruta vieja: lleva a la nueva, con su ?búsqueda y su #ancla. */
function puente(destino) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>LozCharts</title>
    <link rel="canonical" href="${BASE}${destino}" />
    <meta http-equiv="refresh" content="0; url=${destino}" />
    <script>
      location.replace('${destino}' + location.search + location.hash);
    </script>
  </head>
  <body>
    <p>Esta página se mudó a <a href="${destino}">${destino}</a>.</p>
  </body>
</html>
`;
}

const comun = await diccionario('comun');
const readmes = Object.fromEntries(Object.keys(IDIOMAS).map((id) => [id, readFileSync(IDIOMAS[id].readme, 'utf8')]));
// Los grupos del índice salen del README en español; los demás los toman por número de sección.
const inicios = gruposPorNumero(secciones(readmes.es, 'es').slice(1));
const docs = Object.fromEntries(Object.keys(IDIOMAS).map((id) => [id, documentacion(readmes[id], id, inicios)]));
const cuantas = new Set(Object.values(docs).map((d) => d.anclas.length));
if (cuantas.size > 1)
  console.warn(
    'Ojo: los README no tienen los mismos títulos (' +
      Object.entries(docs)
        .map(([id, d]) => `${id}: ${d.anclas.length}`)
        .join(', ') +
      '). El selector de idioma de la documentación puede llevar a otra sección.',
  );
const anclas = Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, d.anclas]));

// `node scripts/sitio.mjs galeria docs` arma solo esas páginas (para probar una mientras otra
// está a medio traducir); sin nombres, todas.
const solo = process.argv.slice(2);
const generadas = [];
for (const [pagina, p] of Object.entries(PAGINAS)) {
  if (solo.length && !solo.includes(pagina)) continue;
  const plantilla = readFileSync(join(SITIO, 'plantillas', p.plantilla), 'utf8');
  const textos = { ...comun, ...(await diccionario(pagina)) };
  for (const idioma of Object.keys(IDIOMAS)) {
    let html = armar(plantilla, idioma, pagina, textos, pagina === 'docs' ? { anclas } : {});
    if (pagina === 'docs') {
      const d = docs[idioma];
      html = html
        .replace('<!--INDICE-->', () => d.indice)
        .replace('<!--INTRO-->', () => d.intro)
        .replace('<!--CONTENIDO-->', () => d.html);
    }
    const archivo = join(SITIO, IDIOMAS[idioma].carpeta, p[idioma]);
    mkdirSync(dirname(archivo), { recursive: true });
    writeFileSync(archivo, html);
    generadas.push(archivo);
  }
}
for (const [viejo, pagina] of Object.entries(PUENTES)) {
  writeFileSync(join(SITIO, viejo), puente(IDIOMAS.es.carpeta + PAGINAS[pagina].es));
}

/*
 * Versiones contra la caché del navegador
 * ---------------------------------------
 * Un servidor simple (python3 -m http.server, GitHub Pages) no le dice al navegador cuánto tiempo
 * guardar cada archivo, y Chrome lo decide por su cuenta: a veces sigue usando un
 * assets/ejemplos.js o un lib/lozcharts.umd.js viejo aunque ya cambió. Para evitarlo, cada
 * referencia a un recurso propio lleva una versión sacada del contenido del archivo:
 *
 *   <script src="assets/site.js?v=3f9c1a2b7d"></script>
 *
 * Si el archivo cambia, cambia la versión, la URL es otra y el navegador lo vuelve a bajar. Si no
 * cambia, la URL es la misma y la caché sigue sirviendo.
 *
 * Cómo lo hace, sin depender de cómo esté escrita cada página:
 * - Recorre las páginas que acaba de generar, en los tres idiomas (no las plantillas ni
 *   propuestas/, que son borradores). Las de es/ y pt/ apuntan a ../assets/…: la ruta se resuelve
 *   desde la carpeta de cada página.
 * - Busca etiquetas HTML de verdad (`<script`, `<link`, `<img`, `<source`…) con `src` o `href`.
 *   El código de ejemplo que muestra una página va escapado (`&lt;script`), así que no se toca.
 *   Los enlaces `<a>` tampoco: llevan a otra página o a un archivo para bajar, no a un recurso
 *   que la página cargue.
 * - Solo versiona rutas relativas que apuntan a un archivo que existe dentro de site/ y que no es
 *   una página .html. Las URLs con http(s):, //, /, # o mailto: quedan como están.
 * - Quita la versión anterior (`?v=…`) antes de poner la nueva: correrlo dos veces da lo mismo, y
 *   una página que alguien editó a mano, con versión o sin ella, queda bien al volver a armar.
 * - Las páginas generadas no van en git, así que las versiones tampoco: no hay choques entre ramas
 *   por una línea de versión. GitHub Pages arma el sitio con `npm run site` en cada push.
 *
 * Lo que no cubre: las URLs que arma un script mientras corre (un fetch dentro de un .js).
 */
const huellas = new Map();
function huella(archivo) {
  if (!huellas.has(archivo)) huellas.set(archivo, createHash('sha256').update(readFileSync(archivo)).digest('hex').slice(0, 10));
  return huellas.get(archivo);
}

/** Versiona las referencias de una página que vive en `carpeta` (ver el comentario de arriba). */
export function versionar(pagina, carpeta, raiz = SITIO) {
  return pagina.replace(/<([a-z][a-z0-9-]*)\s[^<>]*>/gi, (etiqueta, nombre) =>
    nombre.toLowerCase() === 'a'
      ? etiqueta
      : etiqueta.replace(/(\s(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi, (todo, attr, q, url) => {
          if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return todo;
          const ruta = url.replace(/[?#].*$/, '');
          if (!ruta || /\.html?$/i.test(ruta)) return todo;
          const archivo = normalize(join(carpeta, decodeURI(ruta)));
          if (relative(raiz, archivo).startsWith('..') || !existsSync(archivo) || !statSync(archivo).isFile()) return todo;
          const ancla = url.includes('#') ? url.slice(url.indexOf('#')) : '';
          const query = url.slice(ruta.length, url.length - ancla.length).replace(/^\?/, '');
          const params = query.split('&').filter((p) => p && !p.startsWith('v='));
          return `${attr}${q}${ruta}?${[...params, `v=${huella(archivo)}`].join('&')}${ancla}${q}`;
        }),
  );
}

// Se versionan las páginas generadas (no las plantillas ni propuestas/, que son borradores).
for (const archivo of generadas) {
  const antes = readFileSync(archivo, 'utf8');
  const despues = versionar(antes, dirname(archivo));
  if (despues !== antes) writeFileSync(archivo, despues);
}

console.log(
  `Sitio listo: ${generadas.length} páginas en ${Object.keys(IDIOMAS).length} idiomas, con versiones; ` +
    `documentación de ${docs.es.secciones} secciones.`,
);
