// Textos que comparten todas las páginas del sitio: la barra, el pie y lo que se repite.
// Cada texto lleva sus tres idiomas; ver la explicación de las marcas en scripts/sitio.mjs.
export default {
  saltar: { es: 'Saltar al contenido', en: 'Skip to content', pt: 'Pular para o conteúdo' },
  inicio_aria: { es: 'LozCharts, inicio', en: 'LozCharts, home', pt: 'LozCharts, início' },
  nav_aria: { es: 'Principal', en: 'Main', pt: 'Principal' },
  pie_aria: { es: 'Pie', en: 'Footer', pt: 'Rodapé' },
  nav_inicio: { es: 'Inicio', en: 'Home', pt: 'Início' },
  nav_galeria: { es: 'Galería', en: 'Gallery', pt: 'Galeria' },
  nav_docs: { es: 'Documentación', en: 'Docs', pt: 'Documentação' },
  // En la barra de un teléfono "Documentación" no cabe junto al selector de idioma: ahí dice "Docs".
  nav_docs_barra: {
    es: '<span class="largo">Documentación</span><span class="corto">Docs</span>',
    en: 'Docs',
    pt: '<span class="largo">Documentação</span><span class="corto">Docs</span>',
  },
  nav_caso: { es: 'Un caso real', en: 'A real case', pt: 'Um caso real' },
  tema_oscuro: { es: 'Cambiar a modo oscuro', en: 'Switch to dark mode', pt: 'Mudar para o modo escuro' },
  pie_firma: { es: 'LozCharts · por Mayra Lozada', en: 'LozCharts · by Mayra Lozada', pt: 'LozCharts · por Mayra Lozada' },
  pie_licencia: { es: 'LozCharts · licencia MIT', en: 'LozCharts · MIT license', pt: 'LozCharts · licença MIT' },
  usala_gratis: { es: 'Úsala gratis', en: 'Use it for free', pt: 'Use de graça' },
  // Anclas de la documentación de cada idioma (salen de los títulos de su README).
  ancla_instalar: { es: 'instalar', en: 'install', pt: 'instalação' },
  ancla_tipos: { es: 'tipos-de-serie', en: 'series-types', pt: 'tipos-de-série' },
};
