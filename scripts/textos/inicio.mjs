// Textos de la portada (site/plantillas/index.html). Lo que dibuja o cambia el JavaScript
// (laboratorio, los 26 tipos, la lectura del gráfico) está en assets/portada*.js con tx().
// Los titulares que se arman letra por letra van en dos claves, una por línea (cada una se
// ajusta sola al ancho): en inglés y portugués, de largo parecido al español.
export default {
  // ------------------------------------------------------------ Cabeza, Open Graph y JSON-LD
  titulo: {
    es: 'LozCharts · Gráficos para la web, gratis y accesibles',
    en: 'LozCharts · Free, accessible charts for the web',
    pt: 'LozCharts · Gráficos para a web, gratuitos e acessíveis',
  },
  descripcion: {
    es: 'LozCharts es una librería de gráficos para la web: 26 tipos que se leen con teclado y lector de pantalla, en claro y oscuro, con zoom, y se guardan como imagen o como hoja de datos. Gratis, con licencia MIT, sin nada más que instalar y en {{kb}} KB.',
    en: 'LozCharts is a charting library for the web: 26 chart types you can read with a keyboard and a screen reader, in light and dark mode, with zoom, and you can save them as an image or a spreadsheet. Free, MIT licensed, nothing else to install, and {{kb}} KB.',
    pt: 'LozCharts é uma biblioteca de gráficos para a web: 26 tipos que dá para ler com teclado e leitor de tela, nos modos claro e escuro, com zoom, e que você salva como imagem ou planilha. Grátis, com licença MIT, sem mais nada para instalar e com {{kb}} KB.',
  },
  og_titulo: {
    es: 'LozCharts · Tus números, en grande.',
    en: 'LozCharts · Your numbers, loud and clear.',
    pt: 'LozCharts · Seus números, em destaque.',
  },
  og_descripcion: {
    es: '26 tipos de gráfico para la web, accesibles, sin nada más que instalar y en {{kb}} KB. Gratis para todos, también para empresas.',
    en: '26 accessible chart types for the web, nothing else to install, {{kb}} KB. Free for everyone, companies included.',
    pt: '26 tipos de gráfico acessíveis para a web, sem mais nada para instalar e com {{kb}} KB. Grátis para todo mundo, inclusive empresas.',
  },
  // La imagen (assets/og-portada.png) está en español: en los otros idiomas el texto lo dice.
  og_imagen_alt: {
    es: 'Portada de LozCharts: el titular «Tus números, en grande.» y las ventas de una tienda en barras violeta y rosa, con diciembre en 143 mil dólares.',
    en: 'LozCharts cover, in Spanish: the headline “Tus números, en grande.” (your numbers, loud and clear) and a store’s sales in purple and pink bars, with December at $143K.',
    pt: 'Capa do LozCharts, em espanhol: o título “Tus números, en grande.” (seus números, em destaque) e as vendas de uma loja em barras roxas e rosa, com dezembro em US$ 143 mil.',
  },
  tw_descripcion: {
    es: '26 tipos de gráfico para la web, accesibles, sin nada más que instalar y en {{kb}} KB. Gratis, con licencia MIT.',
    en: '26 accessible chart types for the web, nothing else to install, {{kb}} KB. Free and MIT licensed.',
    pt: '26 tipos de gráfico acessíveis para a web, sem mais nada para instalar e com {{kb}} KB. Grátis, com licença MIT.',
  },
  ld_descripcion: {
    es: 'Librería de gráficos para la web: 26 tipos accesibles con teclado, lector de pantalla y colores para daltonismo, modo claro y oscuro, zoom, y se guardan como imagen o como hoja de datos. Sin nada más que instalar y en {{kb}} KB comprimida.',
    en: 'Charting library for the web: 26 chart types that work with a keyboard, a screen reader, and colorblind-safe colors, with light and dark mode and zoom, and you can save them as an image or a spreadsheet. Nothing else to install, {{kb}} KB compressed.',
    pt: 'Biblioteca de gráficos para a web: 26 tipos acessíveis com teclado, leitor de tela e cores para daltonismo, modo claro e escuro, zoom, e você salva como imagem ou planilha. Sem mais nada para instalar e com {{kb}} KB comprimida.',
  },
  ld_plataforma: { es: 'Navegador web', en: 'Web browser', pt: 'Navegador web' },
  ld_so: {
    es: 'Cualquiera con un navegador moderno',
    en: 'Any with a modern web browser',
    pt: 'Qualquer um com um navegador moderno',
  },

  // ------------------------------------------------------------ Portada
  portada_l1: { es: 'Tus números,', en: 'Your numbers,', pt: 'Seus números,' },
  portada_l2: { es: 'en grande.', en: 'loud and clear.', pt: 'em destaque.' },
  // La lectura de diciembre antes de que el puntero la cambie: igual a lo que arma portada.js.
  lectura_mes: { es: 'Diciembre · ventas', en: 'December · sales', pt: 'Dezembro · vendas' },
  lectura_valor: { es: '$143 mil', en: '$143K', pt: 'US$ 143 mil' },
  lectura_meta: { es: '23 mil sobre la meta', en: '$23K over goal', pt: 'US$ 23 mil acima da meta' },
  figura_desc: {
    es: 'Ventas de una tienda en 2026, en línea y en el local, contra su meta. En diciembre vendió 143 mil dólares, 23 mil sobre la meta.',
    en: 'A store’s sales in 2026, online and in store, against its goal. In December it sold $143,000, $23,000 over goal.',
    pt: 'Vendas de uma loja em 2026, on-line e na loja física, comparadas com a meta. Em dezembro, vendeu US$ 143 mil, US$ 23 mil acima da meta.',
  },
  pie_portada: {
    es: '<b>LozCharts</b> es mi librería de gráficos para la web. 26 tipos, de la línea de toda la vida al diagrama de flujos, que se leen con teclado y con lector de pantalla. Pasa el puntero por las barras y busca el mes en que esta tienda pasó su meta.',
    en: '<b>LozCharts</b> is my charting library for the web. 26 chart types, from the good old line chart to the flow diagram, and you can read every one with a keyboard and a screen reader. Move your pointer over the bars and find the month this store beat its goal.',
    pt: '<b>LozCharts</b> é a minha biblioteca de gráficos para a web. São 26 tipos, da linha de sempre ao diagrama de fluxos, que dá para ler com teclado e com leitor de tela. Passe o mouse pelas barras e procure o mês em que esta loja bateu a meta.',
  },
  resumen_aria: { es: 'En resumen', en: 'At a glance', pt: 'Em resumo' },
  sello_gratis: { es: 'Gratis', en: 'Free', pt: 'Grátis' },
  mira_caso: { es: 'Mira un caso real', en: 'See a real case', pt: 'Veja um caso real' },

  // ------------------------------------------------------------ Laboratorio
  et_pruebala: { es: 'Pruébala', en: 'Try it', pt: 'Experimente' },
  lab_l1: { es: 'Juega con', en: 'Play with', pt: 'Brinque com' },
  lab_l2: { es: 'tus datos.', en: 'your data.', pt: 'seus dados.' },
  lab_texto: {
    es: 'Toca un tipo, cambia los datos, prende la luz. Al lado está el código que dibuja el gráfico, y lo que acaba de cambiar se enciende. Cópialo y llévatelo a tu página.',
    en: 'Pick a type, change the data, turn on the lights. Next to it is the code that draws the chart, and whatever just changed lights up. Copy it and take it to your page.',
    pt: 'Escolha um tipo, troque os dados, acenda a luz. Ao lado está o código que desenha o gráfico, e o que acabou de mudar se acende. Copie e leve para a sua página.',
  },
  tipo_grafico_aria: { es: 'Tipo de gráfico', en: 'Chart type', pt: 'Tipo de gráfico' },
  datos_aria: { es: 'Datos de ejemplo', en: 'Sample data', pt: 'Dados de exemplo' },
  otros_numeros: { es: 'Otros números', en: 'New numbers', pt: 'Outros números' },
  modo_claro: { es: 'Modo claro', en: 'Light mode', pt: 'Modo claro' },
  // El primer juego de datos; después lo cambia portada-lab.js.
  total_rotulo: { es: 'Ventas del semestre', en: 'Six-month sales', pt: 'Vendas do semestre' },
  forma_usarlo_aria: { es: 'Forma de usarlo', en: 'How to use it', pt: 'Como usar' },
  copiar: { es: 'Copiar', en: 'Copy', pt: 'Copiar' },
  codigo_pie: {
    es: 'Lo que se enciende acaba de cambiar. Al copiar van todas las filas, no solo las cuatro que se ven.',
    en: 'Whatever lights up just changed. When you copy, you get every row, not just the four on screen.',
    pt: 'O que acende acabou de mudar. Ao copiar, vão todas as linhas, não só as quatro que aparecem.',
  },

  // ------------------------------------------------------------ Crea el tuyo (gráficos por capas)
  et_capas: { es: 'Nuevo · Crea el tuyo', en: 'New · Make your own', pt: 'Novo · Crie o seu' },
  capas_l1: { es: 'Inventa', en: 'Invent', pt: 'Invente' },
  capas_l2: { es: 'tu gráfico.', en: 'your chart.', pt: 'seu gráfico.' },
  capas_texto: {
    es: 'Cuando ningún tipo te sirve, armas el tuyo por capas: cuadritos, caritas, íconos, puntos, barras y líneas, uno encima del otro. Lo describes en un JSON corto y se dibuja al instante. Trae 29 íconos propios, sin emojis ni imágenes de afuera.',
    en: 'When no chart type fits, you build your own in layers: squares, faces, icons, dots, bars, and lines, one on top of the other. You describe it in a short JSON and it draws right away. It comes with 29 icons of its own, no emojis or outside images.',
    pt: 'Quando nenhum tipo serve, você monta o seu em camadas: quadradinhos, carinhas, ícones, pontos, barras e linhas, um em cima do outro. Você descreve num JSON curto e ele se desenha na hora. Vem com 29 ícones próprios, sem emojis nem imagens de fora.',
  },
  capas_ejemplos_aria: {
    es: 'Ejemplos de gráficos por capas',
    en: 'Layered chart examples',
    pt: 'Exemplos de gráficos em camadas',
  },
  capas_json_aria: {
    es: 'El JSON que dibuja el gráfico',
    en: 'The JSON that draws the chart',
    pt: 'O JSON que desenha o gráfico',
  },
  capas_cta: { es: 'Abre el editor', en: 'Open the editor', pt: 'Abra o editor' },
  capas_docs: { es: 'Cómo se escribe', en: 'How to write one', pt: 'Como se escreve' },

  // ------------------------------------------------------------ Los 26 tipos
  et_tipos: { es: 'Los 26 tipos', en: 'All 26 types', pt: 'Os 26 tipos' },
  tipos_l1: { es: '26 formas de', en: '26 ways to', pt: '26 jeitos de' },
  tipos_l2: { es: 'contar lo mismo.', en: 'tell one story.', pt: 'contar a mesma coisa.' },
  tipos_texto: {
    es: 'Elige por la pregunta que quieres contestar, no por el nombre del gráfico. Pasa el puntero por uno y se vuelve a dibujar. Ninguno es una imagen: son los mismos que vas a poner en tu página, con su cajita de datos y su teclado.',
    en: 'Choose by the question you want to answer, not by the name of the chart. Hover over one and it draws itself again. None of them is a picture: they’re the same charts you’ll put on your page, with their tooltip and keyboard support.',
    pt: 'Escolha pela pergunta que você quer responder, não pelo nome do gráfico. Passe o mouse por um e ele se desenha de novo. Nenhum é imagem: são os mesmos que você vai colocar na sua página, com tooltip e teclado.',
  },
  ver_galeria: {
    es: 'Ver la galería con el código de cada uno',
    en: 'See the gallery, with the code for each one',
    pt: 'Ver a galeria com o código de cada um',
  },

  // ------------------------------------------------------------ Accesible
  et_accesible: { es: 'Accesible', en: 'Accessible', pt: 'Acessível' },
  acc_l1: { es: 'Se entiende', en: 'Makes sense', pt: 'Dá pra entender' },
  acc_l2: { es: 'sin verlo.', en: 'without seeing it.', pt: 'sem enxergar.' },
  ver_daltonismo: { es: 'Verlo con daltonismo', en: 'See it with color blindness', pt: 'Ver com daltonismo' },
  voz_quien: {
    es: 'Lo que oye un lector de pantalla',
    en: 'What you hear on a screen reader',
    pt: 'O que se ouve num leitor de tela',
  },
  // Hasta que portada.js pone el nombre que le da la librería al gráfico.
  voz_inicial: {
    es: 'Usuarios activos por ciudad, en miles.',
    en: 'Active users by city, in thousands.',
    pt: 'Usuários ativos por cidade, em milhares.',
  },
  acc_texto: {
    es: 'Haz clic en el gráfico y muévete con las flechas. Arriba va, palabra por palabra, lo que escucha quien usa lector de pantalla.',
    en: 'Click the chart and move around with the arrow keys. Up above, word for word, is what someone using a screen reader hears.',
    pt: 'Clique no gráfico e ande com as setas. Ali em cima aparece, palavra por palavra, o que ouve quem usa leitor de tela.',
  },
  acc_1: {
    es: 'Se recorre con flechas, Inicio, Fin y Escape.',
    en: 'You get around with the arrow keys, Home, End, and Escape.',
    pt: 'Dá para percorrer com as setas, Home, End e Esc.',
  },
  acc_2: {
    es: 'Cada línea lleva su nombre al final, así nadie tiene que adivinar colores.',
    en: 'Each line has its name at the end, so nobody has to guess colors.',
    pt: 'Cada linha leva o nome no final, assim ninguém precisa adivinhar cores.',
  },
  acc_3: {
    es: 'La paleta está probada para daltonismo. Usa el botón y compara.',
    en: 'The palette is tested for color blindness. Use the button and compare.',
    pt: 'A paleta foi testada para daltonismo. Use o botão e compare.',
  },
  acc_4: {
    es: 'Debajo de cada gráfico hay una tabla que solo leen los lectores de pantalla.',
    en: 'Under every chart there’s a table that only screen readers read.',
    pt: 'Embaixo de cada gráfico há uma tabela que só os leitores de tela leem.',
  },

  // ------------------------------------------------------------ Liviana
  et_liviana: { es: 'Liviana', en: 'Lightweight', pt: 'Leve' },
  kb_l1: { es: '{{kb}} KB.', en: '{{kb}} KB.', pt: '{{kb}} KB.' },
  kb_l2: { es: 'Y ya.', en: 'That’s it.', pt: 'E só.' },
  kb_texto: {
    es: 'Comprimida y sin nada aparte que instalar ni actualizar cada lunes. Guarda el gráfico como imagen (PNG o SVG) y los datos como hoja (CSV), tiene zoom, y cambia sola a modo oscuro cuando tu sistema lo hace.',
    en: 'Compressed, with nothing else to install or update every Monday. Save the chart as an image (PNG or SVG) and the data as a spreadsheet (CSV). It has zoom, and it switches to dark mode on its own when your system does.',
    pt: 'Comprimida e sem nada à parte para instalar nem atualizar toda segunda-feira. Salve o gráfico como imagem (PNG ou SVG) e os dados como planilha (CSV). Tem zoom e muda sozinha para o modo escuro quando o seu sistema muda.',
  },
  // Antes y después del enlace a llms.txt (el enlace queda en la plantilla, con su ruta).
  kb_trae: { es: 'Trae un', en: 'It comes with an', pt: 'Vem com um' },
  kb_llms: {
    es: ', una hoja de instrucciones para que la IA con la que programas sepa qué opciones existen y no se invente otras.',
    en: ', a cheat sheet so the AI you code with knows which options exist and doesn’t make up new ones.',
    pt: ', uma folha de instruções para a IA com que você programa saber quais opções existem e não inventar outras.',
  },
  donde_rotulo: { es: 'Funciona donde ya trabajas', en: 'Works with what you already use', pt: 'Funciona onde você já trabalha' },

  // ------------------------------------------------------------ Un caso real
  caso_l1: { es: 'Doña Carmen', en: 'Doña Carmen', pt: 'Dona Carmen' },
  caso_l2: { es: 'vendía bien.', en: 'sold plenty.', pt: 'vendia bem.' },
  caso_texto: {
    es: 'Su tienda lleva veintidós años en la misma esquina de Cali. Las ventas vivían en un cuaderno y después en una hoja de cálculo que solo entendía su hija Lucía. Nadie sabía cuánto. Son ocho gráficos, y ahora la familia los lee en la mesa del comedor.',
    en: 'Her store has been on the same corner in Cali for twenty-two years. Sales lived in a notebook, then in a spreadsheet only her daughter Lucía understood. Nobody knew how much. It’s eight charts, and now the family reads them at the dinner table.',
    pt: 'A loja dela está na mesma esquina de Cali há vinte e dois anos. As vendas moravam num caderno e depois numa planilha que só a filha, Lucía, entendia. Ninguém sabia quanto. São oito gráficos, e agora a família lê tudo na mesa de jantar.',
  },

  // ------------------------------------------------------------ Gratis
  et_modelo: { es: 'Gratis', en: 'Free', pt: 'Grátis' },
  modelo_l1: { es: 'Todo es gratis.', en: 'All of it is free.', pt: 'Tudo é grátis.' },
  modelo_l2: { es: 'Sin letra pequeña.', en: 'No fine print.', pt: 'Sem letra miúda.' },
  gratis_titulo: { es: 'Gratis.', en: 'Free.', pt: 'Grátis.' },
  gratis_bajada: {
    es: 'Para siempre, para todos. También si eres una empresa grande.',
    en: 'Forever, for everyone. Even if you’re a big company.',
    pt: 'Para sempre, para todo mundo. Mesmo se você for uma empresa grande.',
  },
  gratis_1: {
    es: '<b>Los 26 tipos</b> y las rejillas de gráficos pequeños',
    en: '<b>All 26 types</b> and grids of small multiples',
    pt: '<b>Os 26 tipos</b> e as grades de gráficos pequenos',
  },
  gratis_2: {
    es: 'Zoom, anotaciones y nombres al final de cada línea',
    en: 'Zoom, annotations, and labels at the end of each line',
    pt: 'Zoom, anotações e nomes no fim de cada linha',
  },
  gratis_3: {
    es: 'Guardar como imagen (PNG, SVG) o como hoja (CSV)',
    en: 'Save as an image (PNG, SVG) or a spreadsheet (CSV)',
    pt: 'Salvar como imagem (PNG, SVG) ou planilha (CSV)',
  },
  gratis_4: {
    es: 'Teclado, lector de pantalla y colores para daltonismo',
    en: 'Keyboard, screen reader, and colorblind-safe colors',
    pt: 'Teclado, leitor de tela e cores para daltonismo',
  },
  gratis_5: { es: 'Modo claro y oscuro', en: 'Light and dark mode', pt: 'Modo claro e escuro' },
  gratis_6: {
    es: 'React, Angular, Vue, Svelte y Django + HTMX',
    en: 'React, Angular, Vue, Svelte, and Django + HTMX',
    pt: 'React, Angular, Vue, Svelte e Django + HTMX',
  },
  gratis_7: {
    es: 'llms.txt para tu asistente de código',
    en: 'llms.txt for your coding assistant',
    pt: 'llms.txt para o seu assistente de código',
  },
  gratis_8: {
    es: '<b>Licencia MIT:</b> úsala gratis, cámbiala, métela en tu producto',
    en: '<b>MIT license:</b> use it for free, change it, ship it in your product',
    pt: '<b>Licença MIT:</b> use de graça, mude o que quiser, coloque no seu produto',
  },
  gratis_nota: {
    es: 'Sin registro y sin tarjeta. Copias un archivo y listo.',
    en: 'No sign-up, no card. Copy one file and you’re done.',
    pt: 'Sem cadastro e sem cartão. Você copia um arquivo e pronto.',
  },
  // ------------------------------------------------------------ Dudas y pie
  // El titular se arma letra por letra; el <span> pinta de rosa la segunda mitad.
  dudas_titulo: {
    es: '¿Du<span class="rosa">das?</span>',
    en: 'Ques<span class="rosa">tions?</span>',
    pt: 'Dúvi<span class="rosa">das?</span>',
  },
  dudas_enlace: {
    es: 'Déjame tu pregunta en GitHub y te contesto yo.',
    en: 'Leave me your question on GitHub and I’ll answer it myself.',
    pt: 'Deixe sua pergunta no GitHub que eu mesma respondo.',
  },
  dudas_quien: {
    es: 'Soy Mayra Lozada. Hice LozCharts y la sigo cuidando.',
    en: 'I’m Mayra Lozada. I made LozCharts and I still look after it.',
    pt: 'Sou a Mayra Lozada. Fiz o LozCharts e continuo cuidando dele.',
  },
  pie_texto: {
    es: 'LozCharts · Licencia MIT · En español, inglés y portugués',
    en: 'LozCharts · MIT license · In English, Spanish, and Portuguese',
    pt: 'LozCharts · Licença MIT · Em português, espanhol e inglês',
  },
};
