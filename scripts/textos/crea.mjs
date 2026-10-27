// Textos de «Crea el tuyo» (site/plantillas/crea.html): el editor de gráficos por capas. Lo que
// cambia al escribir (avisos, el estado, los botones que responden) lo pone assets/crea.js.
export default {
  titulo: { es: 'Crea el tuyo · LozCharts', en: 'Make your own · LozCharts', pt: 'Crie o seu · LozCharts' },
  descripcion: {
    es: 'Inventa tu propio gráfico: descríbelo por capas en JSON, con íconos, condiciones y colores, y míralo dibujarse mientras escribes.',
    en: 'Invent your own chart: describe it in layers of JSON, with icons, conditions, and colors, and watch it draw as you type.',
    pt: 'Invente o seu próprio gráfico: descreva em camadas de JSON, com ícones, condições e cores, e veja ele se desenhar enquanto você digita.',
  },
  h1: { es: 'Crea el tuyo', en: 'Make your own', pt: 'Crie o seu' },
  intro: {
    es: 'Un gráfico también se puede armar por capas: celdas, textos, íconos, barras, líneas. Escríbelo en JSON a la izquierda y míralo a la derecha mientras escribes. Empieza por un ejemplo y cámbialo.',
    en: 'You can also build a chart in layers: cells, text, icons, bars, lines. Write it in JSON on the left and watch it on the right as you type. Start from an example and change it.',
    pt: 'Um gráfico também pode ser montado em camadas: células, textos, ícones, barras, linhas. Escreva em JSON à esquerda e veja à direita enquanto digita. Comece por um exemplo e mude.',
  },
  ejemplos_aria: { es: 'Ejemplos para empezar', en: 'Examples to start from', pt: 'Exemplos para começar' },
  editor_aria: { es: 'Editor y vista en vivo', en: 'Editor and live preview', pt: 'Editor e prévia ao vivo' },
  fuente_aria: {
    es: 'Especificación del gráfico en JSON. Tab sangra; Escape y luego Tab sale del editor.',
    en: 'Chart spec in JSON. Tab indents; press Escape, then Tab, to leave the editor.',
    pt: 'Especificação do gráfico em JSON. Tab recua; Escape e depois Tab sai do editor.',
  },
  archivo: { es: 'grafico.json', en: 'chart.json', pt: 'grafico.json' },
  ordenar: { es: 'Ordenar', en: 'Tidy up', pt: 'Organizar' },
  ordenar_titulo: { es: 'Ordena las sangrías', en: 'Fixes the indentation', pt: 'Organiza os recuos' },
  copiar: { es: 'Copiar JSON', en: 'Copy JSON', pt: 'Copiar JSON' },
  compartir: { es: 'Compartir enlace', en: 'Share link', pt: 'Compartilhar link' },
  en_vivo: { es: 'En vivo', en: 'Live', pt: 'Ao vivo' },
  velo: {
    es: 'Arregla el JSON y el gráfico vuelve a moverse.',
    en: 'Fix the JSON and the chart will start moving again.',
    pt: 'Arrume o JSON e o gráfico volta a se mexer.',
  },
  pista: {
    es: 'Pasa el puntero por encima, o entra con Tab y recórrelo con las flechas.',
    en: 'Hover over it, or Tab into it and move around with the arrow keys.',
    pt: 'Passe o ponteiro por cima, ou entre com Tab e percorra com as setas.',
  },
  guia_titulo: { es: 'Lo que puedes escribir', en: 'What you can write', pt: 'O que você pode escrever' },
  guia_intro: {
    es: 'Cada capa tiene una marca y sus canales. Los canales leen los campos de cada fila de tus datos.',
    en: 'Each layer has a mark and its channels. Channels read the fields of each row in your data.',
    pt: 'Cada camada tem uma marca e os seus canais. Os canais leem os campos de cada linha dos seus dados.',
  },
  marcas: { es: 'Marcas', en: 'Marks', pt: 'Marcas' },
  m_cell: {
    es: 'Una celda de una tabla: <code>x</code> e <code>y</code> son categorías.',
    en: 'A table cell: <code>x</code> and <code>y</code> are categories.',
    pt: 'Uma célula de tabela: <code>x</code> e <code>y</code> são categorias.',
  },
  m_text: {
    es: 'Un texto, con lo que quieras entre llaves: <code>"{nota} pts"</code>.',
    en: 'Some text, with anything you like in braces: <code>"{score} pts"</code>.',
    pt: 'Um texto, com o que quiser entre chaves: <code>"{nota} pts"</code>.',
  },
  m_icon: {
    es: 'Un ícono propio, un emoji, un <code>path</code> o una <code>image</code>.',
    en: 'One of our icons, an emoji, a <code>path</code>, or an <code>image</code>.',
    pt: 'Um ícone próprio, um emoji, um <code>path</code> ou uma <code>image</code>.',
  },
  m_point: {
    es: 'Un círculo; su <code>size</code> puede salir de un campo.',
    en: 'A circle; its <code>size</code> can come from a field.',
    pt: 'Um círculo; o <code>size</code> pode vir de um campo.',
  },
  m_bar: {
    es: 'Una barra desde el cero (o desde <code>y2</code>).',
    en: 'A bar from zero (or from <code>y2</code>).',
    pt: 'Uma barra a partir do zero (ou de <code>y2</code>).',
  },
  m_line: {
    es: 'Una línea por cada <code>group</code>, recta o con <code>"curve": "smooth"</code>.',
    en: 'One line per <code>group</code>, straight or with <code>"curve": "smooth"</code>.',
    pt: 'Uma linha por <code>group</code>, reta ou com <code>"curve": "smooth"</code>.',
  },
  m_spark: {
    es: 'Una línea chiquita por fila, con su último punto marcado.',
    en: 'A tiny line per row, with its last point marked.',
    pt: 'Uma linha pequenininha por linha, com o último ponto marcado.',
  },
  m_rule: {
    es: 'Una línea de referencia: <code>"y": 60</code> con su <code>label</code>.',
    en: 'A reference line: <code>"y": 60</code> with its <code>label</code>.',
    pt: 'Uma linha de referência: <code>"y": 60</code> com o seu <code>label</code>.',
  },
  m_link: {
    es: 'Las uniones de una red (<code>network</code>).',
    en: 'The links of a network (<code>network</code>).',
    pt: 'As ligações de uma rede (<code>network</code>).',
  },
  canales: { es: 'Canales', en: 'Channels', pt: 'Canais' },
  c_pos: {
    es: 'Un campo o una cuenta: <code>"nota * 10"</code>. Fijo: <code>{ "value": "Total" }</code>.',
    en: 'A field or a calculation: <code>"score * 10"</code>. Fixed: <code>{ "value": "Total" }</code>.',
    pt: 'Um campo ou uma conta: <code>"nota * 10"</code>. Fixo: <code>{ "value": "Total" }</code>.',
  },
  c_geo: {
    es: 'En un mapa, con <code>"geo": { "map": "mundo" }</code>.',
    en: 'On a map, with <code>"geo": { "map": "world" }</code>.',
    pt: 'Num mapa, com <code>"geo": { "map": "mundo" }</code>.',
  },
  c_texto: {
    es: 'Plantillas: lo que va entre llaves se calcula.',
    en: 'Templates: whatever is in braces gets calculated.',
    pt: 'Modelos: o que vai entre chaves é calculado.',
  },
  c_color: {
    es: 'Un valor, una tabla <code>{ "field", "map" }</code> o una condición.',
    en: 'A value, a lookup <code>{ "field", "map" }</code>, or a condition.',
    pt: 'Um valor, uma tabela <code>{ "field", "map" }</code> ou uma condição.',
  },
  c_filter: {
    es: 'Solo las filas que cumplen: <code>"nota &lt; 6"</code>.',
    en: 'Only the rows that match: <code>"score &lt; 6"</code>.',
    pt: 'Só as linhas que cumprem: <code>"nota &lt; 6"</code>.',
  },
  c_tooltip: {
    es: '<code>false</code>, o la lista de campos que quieres ver.',
    en: '<code>false</code>, or the list of fields you want to see.',
    pt: '<code>false</code>, ou a lista de campos que você quer ver.',
  },
  condiciones: { es: 'Condiciones y colores', en: 'Conditions and colors', pt: 'Condições e cores' },
  cond_codigo: {
    es: `"icon": {
  "if": "nota &gt;= 6",
  "then": "smile",
  "else": "sad"
},
"color": {
  "field": "nota",
  "scale": "traffic-light",
  "by": "column"
}`,
    en: `"icon": {
  "if": "grade &gt;= 6",
  "then": "smile",
  "else": "sad"
},
"color": {
  "field": "grade",
  "scale": "traffic-light",
  "by": "column"
}`,
    pt: `"icon": {
  "if": "nota &gt;= 6",
  "then": "smile",
  "else": "sad"
},
"color": {
  "field": "nota",
  "scale": "traffic-light",
  "by": "column"
}`,
  },
  condiciones_nota: {
    es: 'Compara con <code>==</code> <code>!=</code> <code>&lt;</code> <code>&gt;=</code>, junta con <code>and</code>, <code>or</code> y <code>not</code>, y usa <code>abs</code>, <code>round</code>, <code>min</code>, <code>max</code> o <code>contains</code>. Los colores son los del tema: <code>good</code>, <code>warn</code>, <code>bad</code>, la paleta (<code>violet</code>, <code>pink</code>…) o un <code>#hex</code>. La escala <code>traffic-light</code> compara por fila, por columna o con todo; <code>thresholds</code> pone cortes fijos.',
    en: 'Compare with <code>==</code> <code>!=</code> <code>&lt;</code> <code>&gt;=</code>, combine with <code>and</code>, <code>or</code>, and <code>not</code>, and use <code>abs</code>, <code>round</code>, <code>min</code>, <code>max</code>, or <code>contains</code>. Colors come from the theme: <code>good</code>, <code>warn</code>, <code>bad</code>, the palette (<code>violet</code>, <code>pink</code>…), or a <code>#hex</code>. The <code>traffic-light</code> scale compares by row, by column, or across everything; <code>thresholds</code> sets fixed cut-offs.',
    pt: 'Compare com <code>==</code> <code>!=</code> <code>&lt;</code> <code>&gt;=</code>, junte com <code>and</code>, <code>or</code> e <code>not</code>, e use <code>abs</code>, <code>round</code>, <code>min</code>, <code>max</code> ou <code>contains</code>. As cores são as do tema: <code>good</code>, <code>warn</code>, <code>bad</code>, a paleta (<code>violet</code>, <code>pink</code>…) ou um <code>#hex</code>. A escala <code>traffic-light</code> compara por linha, por coluna ou com tudo; <code>thresholds</code> define cortes fixos.',
  },
  iconos: { es: 'Íconos', en: 'Icons', pt: 'Ícones' },
  usar_titulo: { es: 'Llévalo a tu página', en: 'Put it on your page', pt: 'Leve para a sua página' },
  usar_intro: {
    es: 'Los gráficos por capas vienen aparte, para que quien no los usa no cargue con ellos. El mismo JSON sirve tal cual.',
    en: 'Layered charts come as a separate file, so pages that don’t use them don’t have to load them. The same JSON works as is.',
    pt: 'Os gráficos em camadas vêm à parte, para que quem não usa não precise carregar. O mesmo JSON funciona do jeito que está.',
  },
  usar_npm: { es: 'Con npm', en: 'With npm', pt: 'Com npm' },
  usar_script: { es: 'Con una etiqueta script', en: 'With a script tag', pt: 'Com uma tag script' },
  usar_docs: {
    es: 'Todo lo que se puede escribir está en la documentación.',
    en: 'Everything you can write is in the docs.',
    pt: 'Tudo o que dá para escrever está na documentação.',
  },
  ancla_capas: { es: 'gráficos-por-capas', en: 'layered-charts', pt: 'gráficos-em-camadas' },
};
