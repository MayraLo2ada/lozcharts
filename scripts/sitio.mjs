// Arma el sitio en site/. Uso: npm run site (compila antes).
//
// 1. Copia la librería compilada a site/lib.
// 2. Genera site/docs.html desde el README con la plantilla site/docs.template.html, así la
//    documentación nunca queda desactualizada.
// 3. Pone versiones en las URLs de los recursos propios de cada página (ver `versionar`).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

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
      // Los enlaces internos del README apuntan a anclas de esta misma página.
      const href = url.startsWith('#') ? url : url.replace(/^\.\//, 'https://github.com/MayraLo2ada/lozcharts/blob/main/');
      return `<a href="${href}">${t}</a>`;
    })
    .replace(/\u0000(\d+)\u0000/g, (_, n) => `<code>${esc(codigos[n])}</code>`);
}

const LENGUAJES = { bash: 'Terminal', html: 'HTML', js: 'JavaScript', jsx: 'React (JSX)', ts: 'TypeScript', text: 'Texto' };

/** Un bloque de código con su barra: el lenguaje y el botón de copiar (lo activa la plantilla). */
function bloque(lang, body) {
  const nombre = LENGUAJES[lang] || lang || 'Código';
  return (
    `<div class="bloque"><div class="bloque-barra"><span>${esc(nombre)}</span>` +
    `<button type="button" class="copiar" hidden>Copiar</button></div>` +
    `<pre class="code"><code>${esc(body.join('\n'))}</code></pre></div>`
  );
}

/**
 * Markdown del README a bloques: títulos, párrafos, listas, citas, tablas, código y gráficos vivos.
 * Cada bloque dice a qué columna va: 'txt' (prosa), 'ej' (código y gráficos) o 'ancho' (tablas).
 * Un comentario `<!-- vivo: nombre -->` en su propia línea es un gráfico vivo que dibuja la
 * plantilla; en GitHub no se ve.
 */
export function bloques(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++;
      out.push({ col: 'ej', html: bloque(lang, body) });
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
 * Grupos del índice: la sección con la que empieza cada uno. Si un título cambia y su ancla ya no
 * está aquí, la sección sigue en el grupo anterior (no se rompe nada, solo cambia el agrupado).
 */
const GRUPOS = {
  'instalar-y-compilar': 'Para empezar',
  'tipos-de-serie': 'Tipos de gráfico',
  react: 'Con tu framework',
  'muchos-datos': 'Guías',
  opciones: 'Referencia',
  'cómo-funciona-por-dentro': 'Por dentro',
};

/** El README completo: la introducción, las secciones en pares y el índice agrupado. */
export function documentacion(md) {
  const secciones = [];
  let actual = { h: null, cuerpo: [] };
  for (const b of bloques(md)) {
    if (b.col === 'h2') {
      secciones.push(actual);
      actual = { h: b, cuerpo: [] };
    } else if (/^h\d$/.test(b.col)) actual.cuerpo.push({ col: 'txt', html: `<${b.col} id="${b.id}">${b.html}</${b.col}>` });
    else actual.cuerpo.push(b);
  }
  secciones.push(actual);
  const [intro, ...resto] = secciones;
  const introHtml = `<div class="intro">${intro.cuerpo.map((b) => b.html).join('\n')}</div>`;
  const html = resto
    .map(
      (s) => `<section class="sec" aria-labelledby="${s.h.id}"><h2 id="${s.h.id}">${s.h.html}</h2>\n${pares(s.cuerpo)}</section>`,
    )
    .join('\n');
  let indice = '';
  let abierto = false;
  for (const s of resto) {
    if (GRUPOS[s.h.id]) {
      if (abierto) indice += '</ol></li>\n';
      indice += `<li class="grupo"><span class="grupo-titulo">${GRUPOS[s.h.id]}</span><ol>\n`;
      abierto = true;
    }
    indice += `<li><a href="#${s.h.id}">${s.h.html}</a></li>\n`;
  }
  if (abierto) indice += '</ol></li>';
  return { intro: introHtml, html, indice, secciones: resto.length };
}

const readme = readFileSync('README.md', 'utf8');
const { intro, html, indice, secciones } = documentacion(readme);
const template = readFileSync('site/docs.template.html', 'utf8');
writeFileSync(
  'site/docs.html',
  template
    .replace('<!--INDICE-->', () => indice)
    .replace('<!--INTRO-->', () => intro)
    .replace('<!--CONTENIDO-->', () => html),
);

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
 * - Recorre las páginas .html de site/ (no las subcarpetas: propuestas/ son borradores). La
 *   plantilla de la documentación no se toca; docs.html se versiona después de generarse.
 * - Busca etiquetas HTML de verdad (`<script`, `<link`, `<img`, `<source`…) con `src` o `href`.
 *   El código de ejemplo que muestra una página va escapado (`&lt;script`), así que no se toca.
 *   Los enlaces `<a>` tampoco: llevan a otra página o a un archivo para bajar, no a un recurso
 *   que la página cargue.
 * - Solo versiona rutas relativas que apuntan a un archivo que existe dentro de site/ y que no es
 *   una página .html. Las URLs con http(s):, //, /, # o mailto: quedan como están.
 * - Quita la versión anterior (`?v=…`) antes de poner la nueva: correrlo dos veces da lo mismo, y
 *   una página que alguien editó a mano, con versión o sin ella, queda bien al volver a armar.
 * - Solo escribe la página si algo cambió. index.html, galeria.html y demo.html están en git: la
 *   versión nueva aparece en el diff cuando cambia su recurso, y si dos ramas chocan en esa línea
 *   basta con quedarse con cualquiera de las dos y volver a correr `npm run site`.
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

let paginas = 0;
for (const nombre of readdirSync(SITIO)) {
  if (!nombre.endsWith('.html') || nombre.endsWith('.template.html')) continue;
  const archivo = join(SITIO, nombre);
  const antes = readFileSync(archivo, 'utf8');
  const despues = versionar(antes, dirname(archivo));
  if (despues !== antes) writeFileSync(archivo, despues);
  paginas++;
}

console.log(`Sitio listo: ${secciones} secciones en la documentación y versiones en ${paginas} páginas.`);
