// Arma el sitio en site/: copia la librería compilada a site/lib y genera site/docs.html desde el
// README (la documentación nunca queda desactualizada). Uso: npm run site (compila antes).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('site/lib/maps', { recursive: true });
copyFileSync('dist/lozcharts.umd.js', 'site/lib/lozcharts.umd.js');
copyFileSync('dist/maps/world.umd.js', 'site/lib/maps/world.umd.js');
copyFileSync('llms.txt', 'site/llms.txt');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Ancla como la de GitHub: minúsculas, sin signos, espacios a guiones (las letras con acento quedan). */
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

/** Texto en línea: `código`, **negrita**, _cursiva_ y [enlaces](url). */
function inline(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts
    .map((p) => {
      if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return `<code>${esc(p.slice(1, -1))}</code>`;
      return esc(p)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => {
          // Los enlaces internos del README apuntan a anclas de esta misma página.
          const href = url.startsWith('#') ? url : url.replace(/^\.\//, 'https://github.com/MayraLo2ada/lozcharts/blob/main/');
          return `<a href="${href}">${t}</a>`;
        });
    })
    .join('');
}

/** Markdown del README a HTML: títulos, párrafos, listas, citas, tablas y bloques de código. */
export function markdown(md) {
  const lines = md.split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++;
      out.push(`<pre class="code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const html = inline(h[2]);
      const id = slug(h[2].replace(/`/g, ''));
      if (level === 2) toc.push({ id, html });
      if (level > 1) out.push(`<h${level} id="${id}">${html}</h${level}>`);
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
      out.push(
        '<div class="table"><table><thead><tr>' +
          head.map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>' +
          body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table></div>',
      );
      continue;
    }
    if (/^\s*[-*]\s/.test(line)) {
      const items = [];
      for (; i < lines.length && (/^\s*[-*]\s/.test(lines[i]) || /^\s{2,}\S/.test(lines[i])); i++) {
        if (/^[-*]\s/.test(lines[i])) items.push(lines[i].replace(/^[-*]\s/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim().replace(/^[-*]\s/, '');
      }
      out.push('<ul>' + items.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }
    if (line.startsWith('>')) {
      const body = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) body.push(lines[i].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para = [];
    for (; i < lines.length && lines[i].trim() && !/^(#|```|\||>|\s*[-*]\s)/.test(lines[i]); i++) para.push(lines[i]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

const readme = readFileSync('README.md', 'utf8');
const { html, toc } = markdown(readme);
const template = readFileSync('site/docs.template.html', 'utf8');
writeFileSync(
  'site/docs.html',
  template
    .replace('<!--INDICE-->', toc.map((t) => `<li><a href="#${t.id}">${t.html}</a></li>`).join('\n'))
    .replace('<!--CONTENIDO-->', html),
);
console.log(`Sitio listo: ${toc.length} secciones en la documentación.`);
