// Textos del caso de doña Carmen (site/plantillas/caso-real.html). Los títulos y datos de los
// gráficos, los meses del lector de pantalla y lo que cambia al pasar de capítulo están en
// assets/caso-real.js y assets/caso-real-datos.js.
// En inglés queda "Doña Carmen" y "Don Julio"; en portugués, "dona Carmen" y "seu Julio", que es
// como se dice allá. Las cifras siguen en pesos colombianos, escritas con el formato de cada idioma.
export default {
  // ---------- Cabeza ----------
  titulo: {
    es: 'El año de doña Carmen · Un caso con LozCharts',
    en: 'Doña Carmen’s year · A LozCharts case study',
    pt: 'O ano de dona Carmen · Um caso com o LozCharts',
  },
  descripcion: {
    es: 'Una tienda de barrio pasa de una hoja de cálculo desordenada a gráficos que entiende toda la familia. Un caso contado en ocho gráficos de LozCharts que puedes tocar.',
    en: 'A corner store in Colombia goes from a messy spreadsheet to charts the whole family understands. A case told in eight LozCharts charts you can play with.',
    pt: 'Um mercadinho de bairro na Colômbia troca uma planilha bagunçada por gráficos que a família inteira entende. Um caso contado em oito gráficos do LozCharts que dá para tocar.',
  },
  og_titulo: { es: 'El año de doña Carmen', en: 'Doña Carmen’s year', pt: 'O ano de dona Carmen' },
  og_descripcion: {
    es: 'Doña Carmen vendía bien y nadie sabía cuánto. Su año contado en ocho gráficos de LozCharts que se dejan tocar.',
    en: 'Doña Carmen sold plenty, and nobody knew how much. Her year, told in eight LozCharts charts you can play with.',
    pt: 'Dona Carmen vendia bem e ninguém sabia quanto. O ano dela contado em oito gráficos do LozCharts que dá para tocar.',
  },
  saltar_historia: { es: 'Saltar a la historia', en: 'Skip to the story', pt: 'Pular para a história' },

  // ---------- Portada ----------
  volanta: { es: 'Un caso en ocho gráficos', en: 'A case in eight charts', pt: 'Um caso em oito gráficos' },
  lugar: { es: 'Cali, 2025', en: 'Cali, Colombia, 2025', pt: 'Cali, Colômbia, 2025' },
  titular_1: { es: 'Doña Carmen', en: 'Doña Carmen', pt: 'Dona Carmen' },
  titular_2: { es: 'vendía bien.', en: 'sold plenty.', pt: 'vendia bem.' },
  titular_3: { es: 'Nadie sabía', en: 'Nobody knew', pt: 'Ninguém sabia' },
  titular_4: { es: 'cuánto.', en: 'how much.', pt: 'quanto.' },
  entrada: {
    es: 'Su tienda lleva veintidós años en la misma esquina. Las ventas vivían en un cuaderno y después en una hoja de cálculo que solo entendía su hija Lucía. Baja y mira cómo esa hoja se vuelve algo que la familia lee en la mesa del comedor. Cada gráfico que vas a ver es LozCharts y se deja tocar.',
    en: 'Her little store has been on the same street corner for twenty-two years. Sales lived in a notebook, then in a spreadsheet only her daughter Lucía could make sense of. Scroll down and watch that spreadsheet turn into something the family reads at the dinner table. Every chart you’re about to see is LozCharts, and you can play with all of them.',
    pt: 'O mercadinho dela está na mesma esquina há vinte e dois anos. As vendas moravam num caderno e depois numa planilha que só a filha, Lucía, entendia. Role a página e veja essa planilha virar algo que a família lê na mesa de jantar. Todos os gráficos que você vai ver são do LozCharts, e dá para mexer em cada um.',
  },
  aclaracion: {
    es: 'Doña Carmen, su familia y sus números son inventados. La tienda de la esquina, no tanto: seguro conoces una.',
    en: 'Doña Carmen, her family, and her numbers are made up. The corner store, not so much: you probably know one just like it.',
    pt: 'Dona Carmen, a família dela e os números são inventados. O mercadinho da esquina, nem tanto: com certeza você conhece um.',
  },
  empezar: { es: 'Empieza la historia', en: 'Start the story', pt: 'Comece a história' },
  volver: { es: 'Volver a la portada', en: 'Back to the home page', pt: 'Voltar para o início' },

  // ---------- La hoja de cálculo de enero (desordenada a propósito, en cada idioma) ----------
  planilla_archivo: {
    es: 'ventas_2025_FINAL_v3 (2).xlsx',
    en: 'sales_2025_FINAL_v3 (2).xlsx',
    pt: 'vendas_2025_FINAL_v3 (2).xlsx',
  },
  planilla_fecha: { es: 'fecha', en: 'date', pt: 'data' },
  planilla_que: { es: 'qué', en: 'what', pt: 'o quê' },
  planilla_valor: { es: 'valor', en: 'amount', pt: 'valor' },
  f1: { es: '3 ene', en: 'Jan 3', pt: '3 jan' },
  q1: { es: 'pan + leche', en: 'bread + milk', pt: 'pão + leite' },
  v1: { es: '18.500', en: '18,500', pt: '18.500' },
  f2: { es: '3/1', en: '1/3', pt: '3/1' },
  q2: { es: 'fiado don Pacho', en: 'Don Pacho tab', pt: 'fiado seu Pacho' },
  v2: { es: '12000', en: '12000', pt: '12000' },
  f3: { es: 'enero 4', en: '4 January', pt: 'janeiro 4' },
  q3: { es: 'recarga', en: 'phone top-up', pt: 'recarga' },
  v3: { es: '$5.000', en: '$5,000', pt: '$5.000' },
  f4: { es: '04-01', en: '01-04', pt: '04-01' },
  v4: { es: '7.200', en: '7,200', pt: '7.200' },
  f5: { es: '5 ene', en: 'Jan 5', pt: '5 jan' },
  q5: { es: 'mercado Yoli (Madrid)', en: 'groceries Yoli (Madrid)', pt: 'compras Yoli (Madri)' },
  v5: { es: '186.000', en: '186,000', pt: '186.000' },
  f6: { es: '5 ene', en: 'Jan 5', pt: '5 jan' },
  q6: { es: 'cerveza x6', en: 'beer x6', pt: 'cerveja x6' },
  v6: { es: '21 mil', en: '21k', pt: '21 mil' },
  f7: { es: 'sábado', en: 'Saturday', pt: 'sábado' },
  q7: { es: 'de todo un poco', en: 'a bit of everything', pt: 'um pouco de tudo' },
  v7: { es: '2.304.900', en: '2,304,900', pt: '2.304.900' },
  f8: { es: '6 ene', en: 'Jan 6', pt: '6 jan' },
  q8: { es: 'velas', en: 'candles', pt: 'velas' },
  v8: { es: '#¡VALOR!', en: '#VALUE!', pt: '#VALOR!' },
  planilla_nota: { es: '¿y esto qué es?', en: 'wait, what’s this?', pt: 'e isso aqui, o que é?' },
  planilla_cuenta: {
    es: '<strong>4.318</strong> filas más',
    en: '<strong>4,318</strong> more rows',
    pt: 'mais <strong>4.318</strong> linhas',
  },
  planilla_pie: {
    es: 'Así empieza: la hoja de cálculo de la tienda en enero.',
    en: 'Here’s where it starts: the store’s spreadsheet in January.',
    pt: 'Assim começa: a planilha do mercadinho em janeiro.',
  },

  // ---------- El escenario (el gráfico fijo) ----------
  historia_titulo: {
    es: 'La historia de la tienda, mes a mes',
    en: 'The store’s story, month by month',
    pt: 'A história do mercadinho, mês a mês',
  },
  escenario_aria: { es: 'Gráfico de la historia', en: 'The story’s chart', pt: 'Gráfico da história' },

  // ---------- Los capítulos ----------
  // mes_*: el mes de la historia (encabezado grande y tarjeta); t_*: título del gráfico; s_*: subtítulo.
  mes_1: { es: 'Enero', en: 'January', pt: 'Janeiro' },
  mes_2: { es: 'Febrero', en: 'February', pt: 'Fevereiro' },
  mes_3: { es: 'Marzo', en: 'March', pt: 'Março' },
  mes_4: { es: 'Abril', en: 'April', pt: 'Abril' },
  mes_5: { es: 'Mayo', en: 'May', pt: 'Maio' },
  mes_6: { es: 'Junio', en: 'June', pt: 'Junho' },
  mes_7: { es: 'Julio', en: 'July', pt: 'Julho' },
  mes_8: { es: 'Agosto', en: 'August', pt: 'Agosto' },

  t_diario: { es: 'Ventas de cada día de 2025', en: 'Daily sales, 2025', pt: 'Vendas de cada dia de 2025' },
  s_diario: {
    es: '365 filas, una por día, en pesos colombianos',
    en: '365 rows, one per day, in Colombian pesos',
    pt: '365 linhas, uma por dia, em pesos colombianos',
  },
  c1_titulo: {
    es: 'Primero, pasar el cuaderno a limpio.',
    en: 'First, copy the notebook out neatly.',
    pt: 'Primeiro, passar o caderno a limpo.',
  },
  c1_texto: {
    es: 'Lucía copia el año entero, un día por fila, y le pide a LozCharts una línea. Sale un serrucho. Los domingos se cae, los sábados se dispara y en el medio no se entiende nada.',
    en: 'Lucía types in the whole year, one day per row, and asks LozCharts for a line chart. Out comes a saw blade. It drops every Sunday, shoots up every Saturday, and everything in between is a blur.',
    pt: 'Lucía digita o ano inteiro, um dia por linha, e pede ao LozCharts um gráfico de linha. Sai um serrote. Cai todo domingo, dispara todo sábado e, no meio, não dá para entender nada.',
  },
  c1_tipo: { es: 'Línea', en: 'Line', pt: 'Linha' },

  t_mensual: { es: 'Ventas por mes, 2025', en: 'Monthly sales, 2025', pt: 'Vendas por mês, 2025' },
  s_mensual: {
    es: 'Suma de cada mes, en pesos colombianos',
    en: 'Each month added up, in Colombian pesos',
    pt: 'Soma de cada mês, em pesos colombianos',
  },
  c2_titulo: {
    es: 'Sumado por mes, el serrucho se calma.',
    en: 'Added up by month, the saw blade settles down.',
    pt: 'Somado por mês, o serrote se acalma.',
  },
  // Lo que va antes de la cifra que cuenta: en inglés y portugués "$" se leería como dólares.
  cifra_prefijo: { es: '$', en: '', pt: '' },
  c2_cifra: { es: '$506', en: '506', pt: '506' },
  c2_cifra_txt: {
    es: 'millones vendidos en el año',
    en: 'million pesos in sales this year',
    pt: 'milhões de pesos vendidos no ano',
  },
  c2_texto: {
    es: 'Pasa el puntero o el dedo por las barras: sale una cajita con el valor exacto, en pesos y sin redondear. Diciembre se ve de lejos.',
    en: 'Run your pointer or your finger over the bars: a little box pops up with the exact amount, in pesos, not rounded. December stands out a mile away.',
    pt: 'Passe o mouse ou o dedo pelas barras: aparece uma caixinha com o valor exato, em pesos e sem arredondar. Dezembro se vê de longe.',
  },
  c2_tipo: { es: 'Barras con su dato exacto', en: 'Bars with an exact-value tooltip', pt: 'Barras com tooltip do valor exato' },

  t_diciembre: { es: 'Diciembre de 2025, día por día', en: 'December 2025, day by day', pt: 'Dezembro de 2025, dia a dia' },
  s_diciembre: {
    es: 'Arrastra sobre la línea para acercar; doble clic para ver el año',
    en: 'Drag across the line to zoom in; double-click to see the whole year',
    pt: 'Arraste sobre a linha para dar zoom; clique duas vezes para ver o ano',
  },
  c3_titulo: {
    es: '«¿Y qué pasó en diciembre?»',
    en: '“So what happened in December?”',
    pt: '“E o que aconteceu em dezembro?”',
  },
  c3_texto: {
    es: 'Eso pregunta doña Carmen. Lucía arrastra sobre la línea y acerca: el 24 vendieron <strong>$5,15 millones</strong>, lo de casi cuatro días normales. El 25 la tienda abrió un rato, por terquedad.',
    en: 'That’s Doña Carmen’s question. Lucía drags across the line and zooms in: on the 24th, Christmas Eve, the big night in Colombia, they sold <strong>5.15 million pesos</strong>, almost four normal days’ worth. On the 25th the store opened for a little while, out of sheer stubbornness.',
    pt: 'É a pergunta de dona Carmen. Lucía arrasta sobre a linha e dá zoom: no dia 24, véspera de Natal, venderam <strong>5,15 milhões de pesos</strong>, quase quatro dias normais. No dia 25 o mercadinho abriu um pouquinho, por pura teimosia.',
  },
  c3_texto_2: {
    es: 'Debajo queda una barra con el año completo: arrastra la ventana y mira otro mes.',
    en: 'Underneath sits a bar with the whole year: drag the window to look at another month.',
    pt: 'Embaixo fica uma barra com o ano inteiro: arraste a janela e veja outro mês.',
  },
  c3_tipo: { es: 'Zoom', en: 'Zoom', pt: 'Zoom' },

  s_escuchar: {
    es: 'Haz clic en el gráfico y usa las flechas ← →',
    en: 'Click the chart and use the ← → arrow keys',
    pt: 'Clique no gráfico e use as setas ← →',
  },
  c4_titulo: {
    es: 'Don Julio no ve bien. Lo escucha.',
    en: 'Don Julio can’t see well. He listens.',
    pt: 'Seu Julio não enxerga bem. Ele escuta.',
  },
  c4_texto: {
    es: 'El hermano de Carmen lleva las cuentas desde hace treinta años. Con su lector de pantalla recorre el gráfico con las flechas y oye cada mes. Nadie tuvo que configurar nada: cada gráfico trae su descripción y su tabla de datos.',
    en: 'Carmen’s brother has kept the books for thirty years. With his screen reader, he moves through the chart with the arrow keys and hears every month. Nobody had to set anything up: every chart comes with its own description and data table.',
    pt: 'O irmão de Carmen cuida das contas há trinta anos. Com o leitor de tela, ele percorre o gráfico com as setas e ouve cada mês. Ninguém precisou configurar nada: todo gráfico já vem com a descrição e a tabela de dados.',
  },
  oido_que: { es: 'Lo que oye don Julio', en: 'What Don Julio hears', pt: 'O que seu Julio ouve' },
  oido_texto: {
    es: 'Enero, 34.783.000 pesos. 1 de 12.',
    en: 'January, 34,783,000 pesos. 1 of 12.',
    pt: 'Janeiro, 34.783.000 pesos. 1 de 12.',
  },
  oido_escuchar: { es: 'Escúchalo en voz alta', en: 'Hear it out loud', pt: 'Ouça em voz alta' },
  oido_pausar: { es: 'Pausar el recorrido', en: 'Pause the walkthrough', pt: 'Pausar o percurso' },
  c4_tipo: { es: 'Accesibilidad', en: 'Accessibility', pt: 'Acessibilidade' },

  t_canasta: { es: 'Qué se vende, 2025', en: 'What sells, 2025', pt: 'O que se vende, 2025' },
  s_canasta: {
    es: 'El área de cada rectángulo es lo vendido en el año',
    en: 'Each rectangle’s area is what it sold in the year',
    pt: 'A área de cada retângulo é o que ele vendeu no ano',
  },
  c5_titulo: {
    es: 'La canasta básica manda. Las recargas pagan la luz.',
    en: 'The basics rule. Phone top-ups pay the electric bill.',
    pt: 'A cesta básica manda. As recargas pagam a conta de luz.',
  },
  c5_texto: {
    es: 'Granos, leche y pan son más de la mitad. Pero las recargas de celular, que nadie anotaba aparte, dejaron treinta millones en el año. Ahora tienen su propio rectángulo.',
    en: 'Grains, milk, and bread are more than half. But prepaid phone top-ups, which nobody ever wrote down separately, brought in thirty million pesos over the year. Now they get their own rectangle.',
    pt: 'Grãos, leite e pão são mais da metade. Mas as recargas de celular, que ninguém anotava separado, renderam trinta milhões de pesos no ano. Agora elas têm o próprio retângulo.',
  },
  c5_tipo: { es: 'Rectángulos (treemap)', en: 'Treemap', pt: 'Retângulos (treemap)' },

  t_horas: {
    es: 'Clientes por hora, promedio de 2025',
    en: 'Customers per hour, 2025 average',
    pt: 'Clientes por hora, média de 2025',
  },
  s_horas: {
    es: 'Cuanto más oscura la celda, más gente en la tienda',
    en: 'The darker the cell, the more people in the store',
    pt: 'Quanto mais escura a célula, mais gente no mercadinho',
  },
  c6_titulo: {
    es: 'Sábado, siete de la mañana: fila hasta la esquina.',
    en: 'Saturday, 7 a.m.: a line all the way to the corner.',
    pt: 'Sábado, sete da manhã: fila até a esquina.',
  },
  c6_texto: {
    es: 'Y los martes a las tres de la tarde no entra casi nadie. Carmen dice que es porque la gente ve la novela. Ella también la ve. Ahora Yeison sabe a qué hora llegar.',
    en: 'And on Tuesdays at three in the afternoon, hardly anyone comes in. Carmen says it’s because everyone’s watching the telenovela. So is she. Now Yeison knows what time to show up.',
    pt: 'E às terças, às três da tarde, quase ninguém entra. Carmen diz que é porque o povo está vendo a novela. Ela também está. Agora o Yeison sabe a que horas chegar.',
  },
  c6_tipo: { es: 'Mapa de calor', en: 'Heatmap', pt: 'Mapa de calor' },

  t_lejos: {
    es: 'Mercados a domicilio pagados desde otra ciudad',
    en: 'Grocery deliveries paid for from another city',
    pt: 'Compras entregues em casa, pagas de outra cidade',
  },
  s_lejos: {
    es: 'Pedidos en 2025; la burbuja crece con la cantidad',
    en: 'Orders in 2025; the bigger the bubble, the more orders',
    pt: 'Pedidos em 2025; a bolha cresce com a quantidade',
  },
  c7_titulo: {
    es: 'Hay clientes que nunca entran a la tienda.',
    en: 'Some customers never set foot in the store.',
    pt: 'Tem cliente que nunca entra no mercadinho.',
  },
  c7_texto: {
    es: 'Viven en Madrid, en Nueva York, en Santiago. Le escriben a Carmen por WhatsApp, pagan el mercado de la mamá y ella se lo lleva a la casa. Fueron 244 pedidos en el año.',
    en: 'They live in Madrid, in New York, in Santiago. They message Carmen on WhatsApp, pay for their mom’s groceries, and she takes them to her door. That added up to 244 orders in the year.',
    pt: 'Moram em Madri, em Nova York, em Santiago. Mandam mensagem para Carmen pelo WhatsApp, pagam as compras da mãe e ela leva tudo até a casa. Foram 244 pedidos no ano.',
  },
  c7_tipo: { es: 'Mapa en globo', en: 'Globe map', pt: 'Mapa em globo' },

  t_cierre: {
    es: 'De lo vendido a lo que queda, 2025',
    en: 'From sales to what’s left, 2025',
    pt: 'Das vendas ao que sobra, 2025',
  },
  s_cierre: {
    es: 'En pesos colombianos; las bajadas van huecas',
    en: 'In Colombian pesos; the drops are drawn hollow',
    pt: 'Em pesos colombianos; as quedas ficam vazadas',
  },
  c8_titulo: {
    es: 'La cuenta que a nadie le gusta hacer.',
    en: 'The math nobody likes to do.',
    pt: 'A conta que ninguém gosta de fazer.',
  },
  c8_cifra: { es: '$59', en: '59', pt: '59' },
  c8_cifra_txt: {
    es: 'millones quedan, de 506 vendidos',
    en: 'million pesos left, out of 506 million in sales',
    pt: 'milhões de pesos sobram, dos 506 vendidos',
  },
  c8_texto: {
    es: 'Casi todo se va en mercancía. El fiado que nunca volvió suma 4,2 millones. Don Pacho, sabemos quién eres.',
    en: 'Almost all of it goes back into stock. The tabs neighbors ran up and never paid add up to 4.2 million pesos. Don Pacho, we know who you are.',
    pt: 'Quase tudo vai para a mercadoria. O fiado que nunca voltou soma 4,2 milhões de pesos. Seu Pacho, a gente sabe quem é você.',
  },
  c8_tipo: { es: 'Cascada', en: 'Waterfall', pt: 'Cascata' },

  relato_fin: {
    es: 'En septiembre, Lucía imprimió la cascada y doña Carmen la pegó en la nevera.',
    en: 'In September, Lucía printed the waterfall and Doña Carmen stuck it on the fridge.',
    pt: 'Em setembro, Lucía imprimiu a cascata e dona Carmen prendeu na porta da geladeira.',
  },

  // ---------- Cierre ----------
  cierre_1: { es: 'Los gráficos son gratis.', en: 'The charts are free.', pt: 'Os gráficos são de graça.' },
  cierre_2: {
    es: 'Todos, y para todos.',
    en: 'All of them, for everyone.',
    pt: 'Todos, e para todo mundo.',
  },
  cierre_texto: {
    es: 'Todo lo que viste viene en la librería, con licencia MIT: la puedes usar en tu empresa, en tu tesis o en la tienda de tu mamá. Sin registro y sin tarjeta.',
    en: 'Everything you saw comes with the library, under the MIT license: use it at your company, in your thesis, or at your mom’s store. No sign-up, no credit card.',
    pt: 'Tudo o que você viu vem na biblioteca, com licença MIT: dá para usar na sua empresa, no seu TCC ou no mercadinho da sua mãe. Sem cadastro e sem cartão.',
  },
  ver_galeria: { es: 'Mira la galería', en: 'See the gallery', pt: 'Veja a galeria' },
  dudas: {
    es: '¿Dudas? <a href="https://github.com/MayraLo2ada/lozcharts/issues">Abre un tema en GitHub</a> y te contesto yo, Mayra.',
    en: 'Questions? <a href="https://github.com/MayraLo2ada/lozcharts/issues">Open an issue on GitHub</a> and I’ll answer it myself. —Mayra',
    pt: 'Dúvidas? <a href="https://github.com/MayraLo2ada/lozcharts/issues">Abra uma issue no GitHub</a> e quem responde sou eu, a Mayra.',
  },

  // ---------- Pie ----------
  pie_inventados: {
    es: 'Carmen, Lucía, Julio y Yeison son inventados, y sus cifras también.',
    en: 'Carmen, Lucía, Julio, and Yeison are made up, and so are their numbers.',
    pt: 'Carmen, Lucía, Julio e Yeison são inventados, e os números deles também.',
  },
};
