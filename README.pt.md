# LozCharts

[English](https://github.com/MayraLo2ada/lozcharts/blob/main/README.md) · [Español](https://github.com/MayraLo2ada/lozcharts/blob/main/README.es.md) · **Português**

LozCharts é uma biblioteca de gráficos para a web. Ela é escrita em TypeScript, desenha em SVG (o
formato de imagem que fica nítido em qualquer tamanho) e não depende de nenhuma outra biblioteca.
Cada gráfico que você cria é um `LozChart`: você passa os seus dados e ele já sai com tooltip (a
caixinha com o valor que aparece quando você passa o mouse), legenda, modo claro e escuro, animação,
navegação pelo teclado e uma tabela de dados para leitores de tela. Tudo aquilo que normalmente você
acaba programando por fora.

São 26 tipos. Tem as linhas e as barras de sempre, mas também velas, mapa de calor, diagrama de
fluxos (sankey), cascata, linha do tempo, nuvem de palavras, mapas e small multiples, que são vários
gráficos pequenos com a mesma escala (a lista completa está em [Tipos de série](#tipos-de-série)).
Vem com zoom, anotações, rótulos no fim de cada linha, opção de baixar como imagem PNG ou SVG e como
planilha CSV, e componentes para React e para Angular, Vue ou Svelte.

## Instalação

Em um projeto com npm:

```bash
npm install lozcharts
```

```js
import { LozChart } from 'lozcharts';
import { Chart } from 'lozcharts/react'; // se você usa React
import 'lozcharts/maps/world'; // só se você for fazer mapas
```

Sem npm, com um `<script>` vindo da rede de distribuição gratuita do npm, ou baixando o arquivo
para o seu projeto:

```html
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
<!-- Só se você for fazer mapas: -->
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/maps/world.umd.js"></script>
```

`@1` sempre traz a última versão 1.x, que nunca quebra o que já funciona. Se preferir fixar uma
versão exata, escreva, por exemplo, `@1.1.0`.

## Seu primeiro gráfico

Copie isto em um arquivo `vendas.html` e abra com dois cliques. Não precisa instalar nada:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Meu primeiro gráfico</title>
  </head>
  <body>
    <div id="grafico"></div>
    <script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
    <script>
      new LozChart('#grafico', {
        title: 'Vendas por mês',
        data: [
          { mes: '2026-01', vendas: 42000 },
          { mes: '2026-02', vendas: 45500 },
          { mes: '2026-03', vendas: 51200 },
        ],
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'bar', field: 'vendas', name: 'Vendas' }],
      });
    </script>
  </body>
</html>
```

É só isso: os dados são uma lista de linhas, `xAxis.field` diz qual campo vai no eixo X e cada
série diz o seu `type` e o seu `field`. O tooltip, o teclado, o modo escuro e a tabela para leitores
de tela já vêm prontos.

## Três formas de usar

**1. Com `<script>`.** Você não precisa de servidor nem de compilar nada: coloca o arquivo junto da
sua página e cria o gráfico.

```html
<div id="grafico"></div>
<script src="lozcharts.umd.js"></script>
<script>
  new LozChart('#grafico', {/* opções */});
</script>
```

**2. Com `import` (Vite, webpack, Angular CLI) ou `require` (Node, Jest).** Lembre de chamar
`destroy()` quando desmontar o componente. No React você não precisa fazer isso na mão se usar os
componentes de `lozcharts/react` (veja [React](#react)), e no Angular, Vue ou Svelte você tem o
elemento `<loz-chart>` (veja [`<loz-chart>`](#loz-chart-angular-vue-svelte-ou-html-puro)).

```js
import { LozChart } from 'lozcharts'; // ou: const { LozChart } = require('lozcharts');
const chart = new LozChart(elemento, opcoes);
// ao desmontar o componente:
chart.destroy();
```

`LozChart` desenha na página, então precisa de um navegador (ou de um DOM de testes, como o jsdom no
Jest). No Node sem DOM você consegue importar, mas não criar gráficos.

**3. Com Django + HTMX.** Coloque as opções em JSON no atributo `data-lozchart`, ou o seletor de
um `<script type="application/json">`. Depois inicie os gráficos de novo toda vez que o HTMX trocar
um fragmento:

```html
<div data-lozchart="#opcoes-vendas"></div>
{{ opcoes|json_script:"opcoes-vendas" }}
<script>
  htmx.onLoad((el) => LozChart.initAll(el));
  document.body.addEventListener('htmx:beforeSwap', (e) => LozChart.destroyAll(e.detail.target));
</script>
```

Se o elemento já tinha um gráfico, `initAll` substitui, e de quebra limpa os que ficaram fora da
página. Em `examples/django` tem um exemplo completo (view, URL e templates), e em
`examples/htmx/index.html` outro que você abre sem Django.

## Exemplo completo

Este gráfico tem o que você mais vai usar: barras empilhadas, uma linha de meta, formato de moeda e
a legenda embaixo. Os comentários dizem que outros valores cada opção aceita.

```js
const chart = new LozChart('#grafico', {
  title: 'Vendas por mês',
  subtitle: 'Janeiro a dezembro de 2026',
  data: [
    { mes: '2026-01', online: 42000, loja: 31000, meta: 80000 },
    { mes: '2026-02', online: 45500, loja: 29800, meta: 82000 },
    // …
  ],
  xAxis: { field: 'mes', type: 'time' }, // 'category' | 'time' | 'linear'
  yAxis: { format: 'currency' }, // 'auto' | 'compact' | 'number' | 'percent' | 'currency' | função
  series: [
    { type: 'bar', field: 'online', name: 'Online', stack: true },
    { type: 'bar', field: 'loja', name: 'Loja', stack: true },
    { type: 'line', field: 'meta', name: 'Meta', smooth: true },
  ],
  theme: 'auto', // 'light' | 'dark' | 'auto'
  height: 320,
  legend: { position: 'bottom' },
  tooltip: true,
  animate: true,
  locale: 'pt-BR',
  currency: 'BRL',
});
```

<!-- vivo: ejemplo -->

## Tipos de série

| Nome         | Tipo          | Para que serve                                       | Campos                                                            |
| ------------ | ------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| LozLine      | `line`        | Evolução de um valor                                 | `field`; `smooth` para curva monótona                             |
| LozBar       | `bar`         | Comparar quantidades; agrupadas ou com `stack`       | `field`                                                           |
| LozArea      | `area`        | Volume acumulado; empilhável                         | `field`; `smooth`                                                 |
| LozStep      | `step`        | Valores que mudam de uma vez (tarifas, taxas)        | `field`; `step`: `'after'` (padrão), `'before'`, `'middle'`       |
| LozRange     | `range`       | Faixa entre um mínimo e um máximo                    | `field` (superior) e `low` (inferior)                             |
| LozScatter   | `scatter`     | Relação entre dois números                           | `field` (Y); X com `xAxis.type: 'linear'`                         |
| LozBubble    | `bubble`      | Como a dispersão, com um terceiro valor como tamanho | `field`, `size`; `sizeName` para o tooltip                        |
| LozCandle    | `candlestick` | Preços: abertura, máxima, mínima e fechamento        | `field` (fechamento), `open`, `high`, `low`                       |
| LozOHLC      | `ohlc`        | O mesmo que as velas, em traços                      | `field` (fechamento), `open`, `high`, `low`                       |
| LozPie       | `pie`         | Partes de um todo (poucas categorias)                | `xAxis.field` (categoria), `field` (valor)                        |
| LozDonut     | `donut`       | Como a pizza, com o total no centro                  | igual a `pie`; `innerRadius` (0,6)                                |
| LozGauge     | `gauge`       | Um indicador contra a sua faixa e a sua meta         | `field`; `target`; faixa com `yAxis.min` e `yAxis.max`            |
| LozBullet    | `bullet`      | Indicadores contra a sua meta e as suas faixas       | `xAxis.field` (indicador), `field`; `targetField`, `ranges`       |
| LozRadar     | `radar`       | Perfis em várias dimensões                           | `xAxis.field` (critério), `field` por série                       |
| LozFunnel    | `funnel`      | Etapas de um processo e a sua conversão              | `xAxis.field` (etapa), `field` (quantidade)                       |
| LozWaterfall | `waterfall`   | Como se chega de um número a outro (ponte)           | `field` (variação); `total` marca subtotais e totais              |
| LozHeatmap   | `heatmap`     | Padrões em uma grade (dia × hora)                    | `xAxis.field` (coluna), `y` (linha), `field` (valor)              |
| LozTreemap   | `treemap`     | Partes de um todo com muitas categorias              | `xAxis.field` (nome), `field` (tamanho); `group` opcional         |
| LozSunburst  | `sunburst`    | Hierarquia em anéis (região › país › cidade)         | `field` (valor); `levels` com os campos do caminho                |
| LozSankey    | `sankey`      | Fluxos entre etapas (de onde para onde)              | `xAxis.field` (origem), `to` (destino), `field` (quantidade)      |
| LozChord     | `chord`       | Fluxos com direção entre nós                         | `xAxis.field` (origem), `to` (destino), `field` (quantidade)      |
| LozNetwork   | `network`     | Relações sem direção (quem com quem)                 | `xAxis.field`, `to`; `field` (peso) e `group` opcionais           |
| LozTimeline  | `timeline`    | Períodos e marcos no tempo                           | `xAxis.field` (início), `end` (fim), `field` (nome); `group`      |
| LozWordcloud | `wordcloud`   | Palavras de acordo com o seu peso                    | `xAxis.field` (palavra), `field` (peso); `group` opcional         |
| LozMap       | `choropleth`  | Um valor por país, colorido                          | `xAxis.field` (país), `field`; veja [Mapas](#mapas)               |
| LozMap       | `mapbubble`   | Quantidades sobre o mapa                             | `xAxis.field`, `field`; `lat` e `lon` opcionais                   |
| LozMultiples | —             | Grade de gráficos pequenos                           | `LozChart.multiples(…)`; veja [Small multiples](#small-multiples) |

LozBar, LozLine e os outros são os nomes que eu uso nesta documentação e na galeria. No código, cada
tipo vai pelo seu nome curto: `type: 'bar'`.

A pizza (`pie`), a rosca (`donut`), o medidor (`gauge`) e o funil mostram uma série só. Na pizza e
na rosca, cada categoria tem a sua
cor e o seu botão na legenda, com a sua porcentagem; se você esconde uma, as porcentagens das outras
são recalculadas. Com mais de 8 categorias, as 7 primeiras ganham cor e o resto é somado em
"Outros", com o detalhe no tooltip e na tabela.

Meu conselho: se passar de 5 categorias, troque a pizza por barras horizontais ordenadas. Elas são
muito mais fáceis de ler.

Os rótulos se distribuem para não ficarem uns por cima dos outros. Em telas estreitas eles somem,
porque a legenda e o tooltip já dizem a mesma coisa, e `labels: false` desliga sempre. Se você
precisa de vários medidores ou vários funis, use small multiples.

```js
new LozChart('#categorias', {
  data: [{ categoria: 'Eletrônicos', vendas: 184200 } /* … */],
  xAxis: { field: 'categoria' },
  yAxis: { format: 'currency' },
  series: [{ type: 'donut', field: 'vendas', name: 'Vendas' }],
});

new LozChart('#meta', {
  data: [{ mes: 'Outubro', progresso: 0.78 }],
  xAxis: { field: 'mes' },
  yAxis: { format: 'percent', min: 0, max: 1 },
  series: [{ type: 'gauge', field: 'progresso', name: 'Progresso', target: 0.85 }],
});
```

<!-- vivo: categorias -->

<!-- vivo: meta -->

Para preços você tem velas (`candlestick`) e barras OHLC (`ohlc`, sigla em inglês para open, high,
low, close). Cada linha traz abertura, máxima, mínima e fechamento, e na série você diz como se
chama cada campo.

Barras com nomes compridos? Use `orientation: 'horizontal'`: o gráfico gira e as categorias vão
para o eixo vertical, onde cabem inteiras.

```js
new LozChart('#precos', {
  data: pregoes, // { dia, abertura, maxima, minima, fechamento }
  xAxis: { field: 'dia', type: 'time' },
  yAxis: { format: 'currency' },
  series: [{ type: 'candlestick', field: 'fechamento', open: 'abertura', high: 'maxima', low: 'minima', name: 'AURF' }],
});
```

## Mapa de calor, treemap e sankey

Os três esperam uma linha de dados por coisa desenhada: uma célula, um retângulo ou um fluxo.

```js
// Mapa de calor: uma linha de dados por célula.
new LozChart('#visitas', {
  data: visitas, // { hora: '09:00', dia: 'Segunda', visitas: 120 }
  xAxis: { field: 'hora' },
  series: [{ type: 'heatmap', field: 'visitas', name: 'Visitas', y: 'dia' }],
});

// Treemap: a área de cada retângulo é o seu valor; `group` agrupa por cor.
new LozChart('#produtos', {
  data: vendas, // { produto: 'Notebooks', categoria: 'Eletrônicos', vendas: 420000 }
  xAxis: { field: 'produto' },
  yAxis: { format: 'currency' },
  series: [{ type: 'treemap', field: 'vendas', name: 'Vendas', group: 'categoria' }],
});

// Sankey: uma linha por fluxo, de `xAxis.field` para `to`.
new LozChart('#jornada', {
  data: fluxos, // { origem: 'Busca', destino: 'Produto', sessoes: 4200 }
  xAxis: { field: 'origem' },
  series: [{ type: 'sankey', field: 'sessoes', name: 'Sessões', to: 'destino' }],
});
```

<!-- vivo: calor -->

O **mapa de calor** usa um tom só, que vai da superfície até a cor da série, misturado em OKLab
para que os passos de claridade fiquem uniformes. Se houver negativos, a escala vira divergente e
simétrica em torno do zero. A legenda de cor fica no canto superior direito, e com as setas você
percorre a grade nas duas direções. Se uma célula vier repetida, a última é a que aparece e a tabela
avisa.

No **treemap** eu uso o algoritmo _squarified_, que deixa os retângulos o mais quadrados possível,
porque assim fica mais fácil compará-los. O texto de cada retângulo pega a cor de maior contraste com
o preenchimento. Com `group`, cada grupo ganha uma cor da paleta e o seu título; se houver mais de 8
grupos, eles ficam em cinza.

O **sankey** monta as colunas pelo caminho mais longo a partir de cada origem e ordena os nós para
que se cruzem o mínimo possível. Cada fluxo leva a cor da sua origem. Se os seus dados tiverem um
ciclo, o fluxo que fecha o ciclo não é desenhado e você recebe um aviso no console. O tooltip diz
que parte da origem e do destino cada fluxo representa.

## Cascata, bullet e linha do tempo

```js
// Cascata: cada linha é uma variação; as marcadas em `total` partem do zero.
new LozChart('#resultado', {
  title: 'Das vendas ao lucro',
  data: [
    { etapa: 'Vendas', valor: 1200 },
    { etapa: 'Custo das vendas', valor: -500 },
    { etapa: 'Lucro bruto', total: true },
    { etapa: 'Despesas', valor: -300 },
    { etapa: 'Impostos', valor: -135 },
    { etapa: 'Lucro líquido', total: true },
  ],
  xAxis: { field: 'etapa' },
  series: [{ type: 'waterfall', field: 'valor', name: 'Resultado', total: 'total' }],
});

// Bullet: uma linha por indicador, com a sua meta e as faixas de qualidade ao fundo.
new LozChart('#kpi', {
  title: 'Vendas do trimestre por região',
  data: [
    { regiao: 'Norte', vendas: 512, meta: 480 },
    { regiao: 'Sul', vendas: 297, meta: 420 },
  ],
  xAxis: { field: 'regiao' },
  series: [{ type: 'bullet', field: 'vendas', name: 'Vendas', targetField: 'meta', ranges: [300, 450, 600] }],
});

// Linha do tempo: cada linha vai do X até `end`; sem fim, é um marco.
new LozChart('#plano', {
  title: 'Lançamento 2026',
  data: [
    { tarefa: 'Pesquisa', inicio: '2026-01-12', fim: '2026-02-27', equipe: 'Produto' },
    { tarefa: 'App para celular', inicio: '2026-04-20', fim: '2026-08-28', equipe: 'Engenharia' },
    { tarefa: 'Lançamento', inicio: '2026-09-15', equipe: 'Marketing' },
  ],
  xAxis: { field: 'inicio', type: 'time' },
  series: [{ type: 'timeline', field: 'tarefa', end: 'fim', group: 'equipe', name: 'Plano', today: true }],
});
```

<!-- vivo: resultado -->

<!-- vivo: kpi -->

<!-- vivo: plan -->

Na **cascata**, o eixo mostra os valores acumulados. Por isso ela pode cruzar o zero sem problema, e
uma queda grande não estica a escala. As subidas vêm preenchidas, as descidas vazadas e os totais em
cinza. A ponta aponta para onde o acumulado se moveu e o rótulo leva o sinal, então você nunca
depende de distinguir o verde do vermelho. Um total sem valor mostra o acumulado. Se você der um
valor, vale esse; e se não bater, você recebe um aviso no console e o tooltip mostra a diferença.

O **bullet** (o gráfico de metas) tem uma escala só para todas as linhas, porque as faixas valem para todas. Se os seus
indicadores têm unidades diferentes, faça um gráfico por indicador. As faixas vêm em tons de cinza,
mais escuros quanto pior, nunca em semáforo. O tooltip mostra a meta, a diferença (com sinal e em %)
e a faixa em que o valor cai. É uma série por gráfico.

Na **linha do tempo**, o nome de cada período vem de `label` ou, se você não informar, de `field`.
Com `group` você tem uma raia por grupo, cada uma com a sua cor. Sem grupos, os períodos que se
sobrepõem descem para outra linha, usando o menor número de linhas possível. O eixo vai de horas a
séculos conforme o intervalo, sem perder a precisão dos seus dados. O tooltip mostra o intervalo e a
duração ("4 meses e 8 dias") no idioma do gráfico (`locale`).

`today: true` marca o dia de hoje com uma linha vertical tracejada e o texto em cima. Se você passar
uma data (`today: '2026-06-30'`), ele marca essa. E se um período terminar antes de começar, ele
inverte e avisa no console.

## Sunburst, cordas, rede e nuvem de palavras

```js
// Sunburst: cada linha é uma folha com o seu caminho; os nós internos somam os filhos.
new LozChart('#vendas', {
  data: vendas, // { regiao: 'América', pais: 'Brasil', cidade: 'Campinas', vendas: 182000 }
  xAxis: { field: 'cidade' },
  series: [{ type: 'sunburst', field: 'vendas', name: 'Vendas', levels: ['regiao', 'pais', 'cidade'] }],
});

// Cordas: uma linha por fluxo com direção, de `xAxis.field` para `to`.
new LozChart('#migracao', {
  title: 'Mudanças entre regiões',
  data: mudancas, // { origem: 'Capital', destino: 'Interior', pessoas: 182 }
  xAxis: { field: 'origem' },
  series: [{ type: 'chord', field: 'pessoas', name: 'Pessoas', to: 'destino' }],
});

// Rede: uma linha por ligação; sem destino, só declara o nó.
new LozChart('#equipe', {
  title: 'Quem trabalha com quem',
  data: mensagens, // { pessoa: 'Ana', com: 'Luís', mensagens: 8, area: 'Design' }
  xAxis: { field: 'pessoa' },
  series: [{ type: 'network', field: 'mensagens', name: 'Mensagens', to: 'com', group: 'area' }],
});

// Nuvem de palavras: a área de cada palavra acompanha o seu peso.
new LozChart('#nuvem', {
  title: 'O que os clientes mais destacam?',
  data: mencoes, // { palavra: 'atendimento', mencoes: 412, tema: 'Serviço' }
  xAxis: { field: 'palavra' },
  series: [{ type: 'wordcloud', field: 'mencoes', name: 'Menções', group: 'tema' }],
});
```

O **sunburst** (anéis por níveis) começa em cima e avança no sentido horário, com os irmãos do maior para o menor.
Cada ramo do primeiro nível tem a sua cor, e os anéis de fora herdam essa cor em tons mais claros.
Sem `levels`, fica um anel só, como uma rosca. Ao passar o mouse, o caminho até a raiz é destacado.
Pelo teclado, ← → percorrem e ↑ ↓ sobem ou descem de nível.

Nas **cordas**, cada nó é um arco (o que sai mais o que entra) e cada fluxo é uma fita da cor da sua
origem. A ponta de destino fica separada do arco, e assim A → B não se confunde com B → A. Os arcos
seguem a ordem dos seus dados, então ordene você mesmo. Os laços, de um nó para ele mesmo, não são
desenhados.

A **rede** não tem direção: A → B e B → A somam na mesma ligação. A disposição é feita por forças e
é determinística, ou seja, os mesmos dados sempre dão o mesmo desenho. A área de cada nó acompanha o
seu grau e a espessura de cada ligação acompanha o seu peso; sem `field`, ela conta ligações. O
teclado e o tooltip falam de nós e citam os seus vizinhos principais.

A **nuvem de palavras** deixa todas as palavras na horizontal, para que dê para ler. As repetidas são
somadas. O que não cabe é omitido a partir das mais leves, com um aviso no console, e continua na
tabela. A cor de cada palavra é ajustada para chegar a 4,5:1 contra o fundo.

Nesses quatro tipos, valores zero, negativos ou vazios não são desenhados, mas a tabela de dados
lista todos do mesmo jeito. `labels: false` tira os rótulos.

## Mapas

Os contornos dos países pesam uns 110 KB, por isso ficam em um arquivo à parte. Você só carrega
esse arquivo se for fazer mapas.

```html
<script src="lozcharts.umd.js"></script>
<script src="maps/world.umd.js"></script>
```

```js
import { LozChart } from 'lozcharts';
import 'lozcharts/maps/world'; // registra o mapa do mundo como 'mundo'

new LozChart('#usuarios', {
  data: [
    { pais: 'COL', usuarios: 980000 },
    { pais: 'México', usuarios: 1830000 },
    { pais: 'Brazil', usuarios: 2650000 },
  ],
  xAxis: { field: 'pais' },
  series: [{ type: 'choropleth', field: 'usuarios', name: 'Usuários', fit: 'data' }],
});
```

<!-- vivo: usuarios -->

- Você pode escrever cada país com o código ISO de 3 letras, com o código numérico ou com o nome em
  inglês ou em espanhol. Maiúsculas e acentos não importam. Se algum não aparecer, você recebe um
  aviso no console.
- `fit: 'data'` enquadra só os países que têm dados, para mostrar uma região. Sem essa opção você vê
  o mundo inteiro, menos a Antártida.
- A projeção padrão (`projection`) é `'equalEarth'`, de áreas iguais: a honesta para colorir
  países. `'mercator'` é a dos mapas da web, que infla os países do norte.
- `mapbubble` coloca um círculo por linha, com a área proporcional ao valor, na sua `lat` e `lon` ou
  no centro do país.
- Para outro mapa, registre com `LozChart.registerMap('brasil', topojsonOuGeojson)` e coloque
  `map: 'brasil'` na série. Serve qualquer TopoJSON ou GeoJSON de polígonos em longitude e
  latitude.
- Os contornos vêm do Natural Earth 1:110m (domínio público), empacotados pelo world-atlas
  (licença ISC, em `maps/LICENSE`).

## React

```jsx
import { useMemo, useRef } from 'react';
import { Chart } from 'lozcharts/react';

function Vendas({ linhas }) {
  const chart = useRef(null);
  const data = useMemo(() => linhas, [linhas]);
  return (
    <>
      <Chart
        ref={chart}
        title="Vendas"
        data={data}
        xAxis={{ field: 'mes', type: 'time' }}
        series={[{ type: 'bar', field: 'vendas', name: 'Vendas' }]}
        zoom
        onZoom={(faixa) => console.log(faixa)}
      />
      <button onClick={() => chart.current?.download('png')}>Baixar</button>
    </>
  );
}
```

`Chart` recebe as opções do gráfico como props, mais `className`, `style` e `id` para o
contêiner. `Multiples` faz o mesmo com small multiples.

A única coisa com que você precisa tomar cuidado são os dados. Eles são comparados por referência:
se mudarem, o gráfico anima a partir do que está na tela. Use `useMemo` para não criar um array novo
a cada render. As outras opções são comparadas pelo conteúdo, então escrevê-las inline não redesenha
nada se elas não mudaram.

- `onHover`, `onZoom` e as outras funções sempre chamam a versão mais recente.
- O `ref` te dá a instância de `LozChart` (ou `LozMultiples`) com todos os métodos.
- Tem um exemplo completo em `examples/react`: rode `npm run example:react` e abra
  `examples/react/index.html`.

## `<loz-chart>`: Angular, Vue, Svelte ou HTML puro

`<loz-chart>` é um elemento HTML padrão (um Custom Element), então funciona com qualquer
framework, sem adaptador. Se você carrega `<script src="lozcharts.umd.js">`, ele já fica registrado;
com módulos, importe `'lozcharts/element'`.

```html
<loz-chart
  options='{"data": [{"mes": "2026-01", "vendas": 42000}], "xAxis": {"field": "mes", "type": "time"},
  "series": [{"type": "bar", "field": "vendas", "name": "Vendas"}]}'
></loz-chart>
```

```ts
// Angular (standalone): adicione CUSTOM_ELEMENTS_SCHEMA ao componente.
import 'lozcharts/element';
@Component({
  selector: 'app-vendas',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<loz-chart [options]="opcoes" (lozzoom)="aoDarZoom($event)"></loz-chart>`,
})
export class VendasComponent {
  opcoes = { data: [], xAxis: { field: 'mes', type: 'time' }, series: [{ type: 'line', field: 'vendas' }], zoom: true };
  aoDarZoom(e: CustomEvent) {
    console.log(e.detail); // [de, até] ou null
  }
}
```

- As opções vão no atributo `options` (como JSON) ou na propriedade `options` (como objeto).
  Se só os dados mudarem, o gráfico anima com `setData`; se mudar outra coisa, com `setOptions`.
  Com `facet`, ele cria small multiples.
- Ele emite `lozhover`, `lozzoom` e `lozclick`. Em `event.detail` vem o X ativo, o trecho visível ou
  `{ x, index, series }` do dado clicado. Com `facet` (small multiples), não emite eventos.
- `elemento.chart` é a instância, com todos os métodos. Quando você tira o elemento da página, o
  gráfico se destrói sozinho, então dentro de fragmentos HTMX você não precisa de `initAll`.

No Vue, avise o compilador que `loz-chart` é um elemento nativo da página e não um componente;
se não, funciona do mesmo jeito, mas aparece um aviso no console com "Failed to resolve component":

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'loz-chart' } } })],
};
```

```html
<script setup>
  import 'lozcharts/element';
</script>
<template>
  <loz-chart :options="opcoes" @lozclick="(e) => console.log(e.detail)"></loz-chart>
</template>
```

## TypeScript

Os tipos vêm no pacote e funcionam com qualquer `moduleResolution` (`bundler`, `node16`,
`nodenext` ou o antigo `node`). Se você escrever uma opção que não existe ou com erro de digitação
(`heigth`, `smoth`, `theme: 'escuro'`), o editor marca e sugere a certa.

```ts
import { LozChart, type LozChartOptions, type SeriesOptions } from 'lozcharts';

const series: SeriesOptions[] = [{ type: 'line', field: 'vendas', name: 'Vendas' }];
const opcoes: LozChartOptions = { data: linhas, xAxis: { field: 'mes', type: 'time' }, series };
const grafico: LozChart = new LozChart('#grafico', opcoes);
```

As suas linhas podem ter o próprio tipo, com `interface` ou com `type`
(`interface Venda { mes: string; vendas: number }`), e o `type` de cada série sugere os 26 tipos
enquanto você digita.

Em um projeto CommonJS (`require`), os tipos são os mesmos e são importados do mesmo jeito.

## LozCharts com IA

Se você pede gráficos ao ChatGPT, ao Claude ou ao Copilot, diga para usar o LozCharts e passe o
arquivo [llms.txt](llms.txt). É uma página só com tudo o que existe (tipos, opções e métodos) e as
regras para escrever código que funciona. Com isso ele não inventa opções, e você não precisa pedir
zoom, legenda, modo escuro nem acessibilidade: tudo isso já vem pronto. Se você usa TypeScript, os
tipos de `lozcharts` ainda marcam qualquer opção que não exista.

Algo assim já basta:

```text
Use o LozCharts; tudo o que você precisa saber está no llms.txt (vai em anexo).
Quero barras empilhadas com as vendas por mês, online e na loja, em reais,
e uma linha com a meta mensal.
```

## Muitos dados

Você pode passar 100.000 pontos para uma linha. Linhas, áreas, degraus e faixas desenham só o que
está visível e, quando há mais de dois dados por pixel, ficam com o primeiro, o mínimo, o máximo e o
último de cada coluna de pixels. O traço fica igual, nenhum pico se perde e o gráfico é criado em
uns 40 ms. Com `zoom`, você explora séries longas sem perder detalhe.

A tabela para leitores de tela mostra as primeiras 500 linhas e avisa que há mais. Para ter todos os
dados, use `download('csv')` ou `toCSV()`.

<!-- vivo: muchos -->

## Small multiples

Se você tem mais de 4 ou 5 séries, não coloque todas em um gráfico só: vira uma bagunça. Faça small
multiples, que são vários gráficos pequenos com a mesma escala, um por série ou um para cada valor
de um campo. Eles também servem para comparar o formato de várias categorias.

```js
// Um painel por série
LozChart.multiples('#cidades', {
  title: 'Temperatura máxima média por mês',
  facet: 'series',
  data: meses, // { mes, miami, lisboa, salvador, … }
  xAxis: { field: 'mes', type: 'time' },
  series: cidades.map((c) => ({ type: 'line', field: c.campo, name: c.nome })),
  height: 150, // altura de cada painel
});

// Um painel por valor de um campo
LozChart.multiples('#regioes', {
  facet: { field: 'regiao', order: ['Norte', 'Sudeste', 'Sul'] },
  data: vendas, // { mes, regiao, online, loja }
  xAxis: { field: 'mes', type: 'time' },
  series: [
    { type: 'area', field: 'online', name: 'Online', stack: true },
    { type: 'area', field: 'loja', name: 'Loja', stack: true },
  ],
});
```

<!-- vivo: ciudades -->

Todos os painéis compartilham o eixo do valor (`sharedY: false` desativa isso) e os mesmos X. Se
falta um mês em um painel, esse mês fica como um buraco. A área de dados tem o mesmo tamanho em
todos, então dá para comparar de relance.

- Os números do eixo aparecem só na primeira coluna, e os rótulos do X só no último painel de cada
  coluna. Isso é recalculado quando a largura muda.
- Se um painel tem barras, todos usam escala de banda e os números do eixo reservam a mesma
  largura: cada data cai na mesma vertical em todos os painéis.
- O mouse sobre um painel marca o mesmo dado em todos. Há uma legenda só (apenas ao facetar por
  campo), e esconder uma série esconde ela em todos os painéis.
- `columns` fixa o número de colunas. Se você não informar, cabem as que `minWidth` permitir (240 px
  por padrão).
- Com `facet: 'series'`, `context: true` desenha em cada painel as outras séries em cinza, atrás da
  dele.
- As `annotations` são desenhadas em todos os painéis, por exemplo uma meta em comum.
- Métodos: `setData`, `setOptions`, `setTheme`, `toggleSeries`, `toSVG`, `toCSV`, `download`,
  `destroy` e `charts` (os gráficos de cada painel). No HTMX, `initAll` cria os painéis se o JSON
  trouxer `facet`.

## Duas medidas com unidades diferentes

Com dois eixos Y, quem faz o gráfico decide onde as linhas se cruzam. Basta mover um eixo para que
uma medida "alcance" a outra, e quem lê tira conclusões que os dados não dizem. Por isso eu proponho
três caminhos, do que eu mais recomendo ao que eu menos recomendo.

**Painéis alinhados.** É o meu favorito. Cada medida fica no seu painel e com as suas unidades. Eles
compartilham o eixo X, as áreas de dados ficam alinhadas no pixel e o mouse se move nos dois ao
mesmo tempo.

```js
LozChart.multiples('#vendas-e-visitas', {
  facet: 'series',
  columns: 1,
  sharedY: false, // cada painel com o seu próprio eixo
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  series: [
    { type: 'bar', field: 'vendas', name: 'Vendas', format: 'currency' },
    { type: 'line', field: 'visitas', name: 'Visitas ao site', format: 'compact' },
  ],
});
```

**Índice base 100.** Use quando a pergunta é qual cresceu mais. O LozCharts divide cada série pelo
primeiro valor dela e multiplica por 100; assim as duas ficam na mesma unidade e compartilham o
eixo. O tooltip mostra o índice e também o valor original.

```js
new LozChart('#crescimento', {
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  yAxis: { index: true },
  series: [
    { type: 'line', field: 'vendas', name: 'Vendas', format: 'currency' },
    { type: 'line', field: 'visitas', name: 'Visitas ao site' },
  ],
});
```

**Eixo duplo, com salvaguardas.** Deixe para quando você realmente precisar, por exemplo porque o
seu público já espera por ele. `axis: 'right'` leva uma série para o eixo direito e `yAxis2`
configura esse eixo. O LozCharts garante que os dois eixos comecem no zero, que o zero fique na mesma
altura, que as linhas da grade coincidam (para isso ele escolhe o passo do eixo direito) e que a
legenda diga "(eixo direito)". Não funciona no modo índice nem na horizontal.

```js
new LozChart('#vendas-e-visitas', {
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  yAxis: { format: 'currency', title: 'Vendas' },
  yAxis2: { format: 'compact', title: 'Visitas' },
  series: [
    { type: 'bar', field: 'vendas', name: 'Vendas' },
    { type: 'line', field: 'visitas', name: 'Visitas ao site', axis: 'right' },
  ],
});
```

## Zoom, anotações e rótulos diretos

```js
new LozChart('#visitas', {
  title: 'Visitas diárias',
  data: dias, // { dia, web, app }, um ano
  xAxis: { field: 'dia', type: 'time' },
  series: [
    { type: 'line', field: 'web', name: 'Web' },
    { type: 'line', field: 'app', name: 'App' },
  ],
  zoom: { range: ['2026-06-01', '2026-08-31'] }, // janela inicial (opcional)
  endLabels: true,
  annotations: [
    { y: 8000, label: 'Meta diária' },
    { x: ['2026-06-29', '2026-07-21'], label: 'Campanha de férias' },
  ],
});
```

<!-- vivo: zoom -->

O **zoom** (`zoom: true`) funciona em gráficos verticais com eixos X e Y (cartesianos). Arraste sobre o gráfico
para marcar um trecho e dar zoom nele. Ctrl + roda do mouse, ou pinça no trackpad, aproxima e afasta
embaixo do ponteiro; Shift + roda, ou deslizar para o lado, move a janela, e dois cliques voltam para
tudo. Em uma tela sensível ao toque, com dois dedos você faz pinça e move, e com um continua
percorrendo os dados com o tooltip. A roda sozinha continua rolando a página: o gráfico não sequestra
a rolagem. Ao dar zoom, o eixo do valor se ajusta ao que está visível.

Embaixo aparece uma barra com um minigráfico de todos os dados. Você pode arrastar a janela ou as
bordas dela, ou movê-la pelo teclado. `zoom: { scrollbar: false }` tira a barra, e
`zoom: { reset: false }` tira o botão "Ver tudo", caso você coloque o seu próprio controle. Com o
foco no gráfico, + e − aproximam e afastam, 0 volta para tudo e, se com as setas você chegar a um
dado fora da janela, a janela vai atrás dele.

Se você tem vários gráficos com o mesmo eixo, como preço em cima e volume embaixo, dá para mover o
zoom de todos ao mesmo tempo. `onZoom` também recebe a janela exata em frações do eixo, e
`setZoomWindow` aplica essa janela em outro gráfico sem arredondar para um dado. Os dois precisam
compartilhar o eixo X e o tipo de escala: os dois de barras, ou os dois contínuos.

```js
const preco = new LozChart('#preco', { ...opcoes, zoom: true, onZoom: (faixa, janela) => volume.setZoomWindow(janela) });
const volume = new LozChart('#volume', { ...outras, zoom: { scrollbar: false, reset: false } });
```

Cada **anotação** (`annotations`) leva `x` ou `y`. Com um valor, desenha uma linha de referência, e
com dois, uma faixa. `x` aceita categorias, datas ou números; `y` aceita números (com
`axis: 'right'` para o eixo direito). O eixo se amplia para que uma meta sempre apareça. As faixas
ficam atrás dos dados e as linhas, com os seus textos, por cima. Se dois textos fossem se chocar, um
deles se desloca.

Com **rótulos no fim** (`endLabels: true`), o nome de cada linha, área ou degrau vai para a direita,
na altura do seu último dado visível; `{ value: true }` acrescenta o último valor. Os que se chocam
se distribuem sem se afastar do seu dado mais do que o necessário e, com zoom, acompanham o último
dado da janela.

O **destaque** (`emphasis: 'Salvador'` ou uma lista) deixa as séries citadas com a sua cor e por
cima, e as outras em cinza como contexto. Em small multiples por série, `context: true` faz o mesmo
em cada painel: a série dele em cor e as outras em cinza atrás.

## Opções

| Opção                        | Tipo                                         | Padrão                       | O que faz                                                                                                              |
| ---------------------------- | -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `title`, `subtitle`          | texto                                        | —                            | Cabeçalho do gráfico (também vai na exportação).                                                                       |
| `data`                       | array de objetos                             | —                            | Uma linha por ponto.                                                                                                   |
| `xAxis.field`                | texto                                        | —                            | Campo da posição X.                                                                                                    |
| `xAxis.type`                 | `'category'` `'time'` `'linear'`             | `'category'`                 | Datas aceitam `Date`, milissegundos ou texto (`'2026-03'` é lido no horário local).                                    |
| `xAxis.format`               | formato ou opções de `Intl.DateTimeFormat`   | automático                   | Rótulos do eixo X.                                                                                                     |
| `xAxis.title`, `yAxis.title` | texto                                        | —                            | Títulos dos eixos.                                                                                                     |
| `yAxis.format`               | veja abaixo                                  | `'auto'`                     | Formato do eixo Y e do tooltip.                                                                                        |
| `yAxis.min`, `yAxis.max`     | número                                       | calculados                   | Limites fixos.                                                                                                         |
| `yAxis2`                     | `{ format, title, min, max }`                | —                            | Eixo direito para as séries com `axis: 'right'`.                                                                       |
| `series[].axis`              | `'left'` `'right'`                           | `'left'`                     | Eixo do valor da série.                                                                                                |
| `yAxis.index`                | booleano                                     | `false`                      | Índice base 100: cada série em relação ao seu primeiro valor.                                                          |
| `yAxis.width`                | px                                           | —                            | Largura mínima para os números do eixo; alinha vários gráficos.                                                        |
| `xAxis.labels`               | booleano                                     | `true`                       | `false` esconde os rótulos do eixo X.                                                                                  |
| `xAxis.band`                 | booleano                                     | `false`                      | Força a escala de banda (pontos no centro da sua faixa), para alinhar com barras.                                      |
| `xAxis.grid`                 | booleano                                     | com datas ou números, `true` | Linhas verticais da grade em cada marca do eixo X. Com categorias elas não aparecem, a não ser que você peça.          |
| `yAxis.labels`               | booleano                                     | `true`                       | `false` esconde os números do eixo (a grade continua).                                                                 |
| `yAxis.zero`                 | booleano                                     | `false`                      | Força o zero (barras e áreas já incluem).                                                                              |
| `yAxis.type`                 | `'linear'` `'log'`                           | `'linear'`                   | Escala logarítmica: marcas em 1, 2 e 5 × 10ⁿ; só contam os valores positivos e não há zero.                            |
| `yAxis.grid`                 | booleano                                     | `true`                       | `false` tira a grade do valor (a linha do zero continua).                                                              |
| `series[].type`              | veja [Tipos de série](#tipos-de-série)       | —                            | Tipo registrado.                                                                                                       |
| `series[].field`             | texto                                        | —                            | Campo numérico.                                                                                                        |
| `series[].name`              | texto                                        | o campo                      | Nome visível; precisa ser único.                                                                                       |
| `series[].stack`             | `true` ou texto                              | —                            | Empilha barras ou áreas do mesmo grupo. Positivos e negativos são empilhados separadamente.                            |
| `series[].smooth`            | booleano                                     | `false`                      | Curva monótona (linha e área).                                                                                         |
| `series[].color`             | 1 a 8                                        | a sua posição                | Lugar na paleta.                                                                                                       |
| `series[].visible`           | booleano                                     | `true`                       | Visível no início.                                                                                                     |
| `series[].format`            | formato                                      | o do eixo Y                  | Formato próprio no tooltip.                                                                                            |
| `orientation`                | `'vertical'` `'horizontal'`                  | `'vertical'`                 | Na horizontal, as categorias vão no eixo vertical.                                                                     |
| `theme`                      | `'light'` `'dark'` `'auto'`                  | `'auto'`                     | `auto` segue o sistema e muda na hora.                                                                                 |
| `palette`                    | array de cores ou `{ light, dark }`          | a do LozCharts               | Cores próprias em ordem (máximo 8). Veja [Paleta própria](#paleta-própria).                                            |
| `height`                     | px                                           | `320`                        | Altura da área do gráfico com os eixos (um tipo de série pode pedir outra; a informada aqui é a que vale).             |
| `legend`                     | `false` ou `{ position: 'top' \| 'bottom' }` | embaixo                      | Só aparece com 2 ou mais séries.                                                                                       |
| `tooltip`                    | booleano ou `{ float }`                      | `true`                       | `false` desliga o tooltip e o ponteiro; `{ float: false }` tira só a caixa (o resto continua).                         |
| `animate`                    | booleano                                     | `true`                       | `false` desenha sem animação.                                                                                          |
| `locale`, `currency`         | texto                                        | o `lang` da página, `'USD'`  | Idioma dos textos da biblioteca (`'es'`, `'en'`, `'pt-BR'`) e dos números e datas com `Intl`.                          |
| `background`                 | booleano                                     | `true`                       | Pinta a superfície do tema atrás do gráfico.                                                                           |
| `onHover`                    | função                                       | —                            | Recebe o X do dado ativo (ou null ao sair), o índice da linha (−1) e a série. Com `highlight(x)`, sincroniza gráficos. |
| `selection`                  | array de índices de linha                    | —                            | Dados selecionados: aparecem normais e os outros ficam atenuados. Veja `select()`.                                     |
| `zoom`                       | booleano ou `{ range, scrollbar, reset }`    | `false`                      | Zoom no eixo X com barra de rolagem. Veja [Zoom](#zoom-anotações-e-rótulos-diretos).                                   |
| `onZoom`                     | função                                       | —                            | Recebe o primeiro e o último dado visíveis (ou null ao ver tudo) e a janela `{ start, end }`.                          |
| `onClick`                    | função                                       | —                            | Clique, Enter ou Espaço em um dado: recebe o X, o índice e a série (ou null se for de todas).                          |
| `annotations`                | array de `{ x \| y, label, axis }`           | —                            | Linhas de referência (um valor) e faixas (dois valores).                                                               |
| `endLabels`                  | booleano ou `{ value }`                      | `false`                      | Nome (e valor) no fim de cada linha, área ou degrau.                                                                   |
| `emphasis`                   | texto ou array                               | —                            | Séries em destaque; as outras ficam em cinza como contexto.                                                            |
| `ariaLabel`                  | texto                                        | automático                   | Descrição para leitores de tela.                                                                                       |

Os formatos são `'auto'` (compacto a partir de mil: 0 / 1 mil / 2 mil), `'compact'`, `'number'`,
`'percent'` (os dados vêm como fração: `0.25` = 25%), `'currency'` ou uma função
`(v) => texto`. O formato muda o que você vê no eixo; o tooltip sempre mostra o valor exato.

## Idiomas

O gráfico fala português do Brasil, inglês e espanhol: o tooltip, a legenda, os botões, o que um
leitor de tela ouve, a tabela de dados e os avisos do console. Ele escolhe o idioma assim:

1. A opção `locale`, se você passar (`'pt-BR'`, `'en'`, `'es'` ou com região, como `'es-MX'`).
2. Senão, o idioma da página (`<html lang="pt-BR">`).
3. Senão, inglês.

`locale` também decide como aparecem números e datas: `'pt-BR'` escreve 1.234,5 e "2 de março".

Quer outro idioma, ou mudar um só texto? Registre:

```js
LozChart.registerLocale('fr', { chart: { showAll: 'Tout voir' } }); // o que faltar vem do inglês
LozChart.registerLocale('pt', { chart: { showAll: 'Mostrar tudo' } }); // muda um texto
```

A lista completa de textos é o tipo `Messages` (em `src/core/i18n.ts`). Um tipo de série seu pode
dar o nome em cada idioma: `label: { pt: 'gráfico de Gantt', en: 'Gantt chart', es: 'diagrama de Gantt' }`.
O mapa-múndi encontra os países pelo código ISO ou pelo nome em português, inglês ou espanhol
(`'Alemanha'`, `'Germany'`, `'Alemania'`, e formas comuns como `'EUA'` ou `'USA'`).

## Paleta própria

O LozCharts traz a sua própria paleta de 8 cores, validada para daltonismo e com tons pensados para o
modo escuro. Se você precisa das cores da sua marca, passe em `palette`:

```js
new LozChart('#grafico', {
  palette: {
    light: ['#0a7d4f', '#6b3fa0', '#d9480f'],
    dark: ['#2fb37a', '#9b74d1', '#f0703a'], // opcional: se faltar, usa a light
  },
  // …
});
```

- Um array simples (`palette: ['#0a7d4f', …]`) vale para os dois modos.
- Cabem no máximo 8 cores, e esse número também é o de séries que cabem. As que sobram são
  agrupadas em "Outros" se estiverem empilhadas juntas; se não, são descartadas com um aviso. Uma cor
  nunca se repete.
- Antes de usar, confira a sua paleta em um simulador de daltonismo e meça o contraste. As cores de
  uma marca raramente foram pensadas para gráficos.

## Métodos

| Método                                                    | O que faz                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `setData(dados)`                                          | Troca os dados e anima a partir do estado atual (mesmo que haja uma animação pela metade).       |
| `options`                                                 | Opções em vigor, com os valores padrão (só leitura).                                             |
| `setOptions({...}, animar?)`                              | Combina opções novas com as atuais e redesenha.                                                  |
| `axisWidth`                                               | Largura que os números do eixo Y precisam agora (para alinhar gráficos com `yAxis.width`).       |
| `highlight(x)`                                            | Marca o dado com esse X (ou vários, com uma lista), sem tooltip; `null` limpa.                   |
| `highlightIndex(i)`                                       | Como `highlight`, por índice de linha ou lista de índices (uma célula de um mapa de calor).      |
| `select(índices)`, `selection`                            | Seleciona dados por índice (os outros ficam atenuados) e anuncia; `null` tira a seleção.         |
| `zoomTo(de, ate)`, `resetZoom()`                          | Dá zoom no eixo X em um trecho (com barras, inclui as categorias das pontas) ou volta para tudo. |
| `zoomRange`                                               | Primeiro e último dado visíveis com zoom, ou null.                                               |
| `zoomWindow`, `setZoomWindow({ start, end } \| null)`     | A janela exata do zoom em frações do eixo X, e o jeito de fixá-la (para sincronizar gráficos).   |
| `redraw()`                                                | Desenha de novo com o estado atual, sem animar (para tipos cujo desenho muda por fora).          |
| `setTheme('dark')`                                        | Troca o tema.                                                                                    |
| `toggleSeries('Online', visible?)`                        | Esconde ou mostra uma série; as outras mantêm a sua cor.                                         |
| `toSVG()`                                                 | SVG completo como texto, com título e legenda.                                                   |
| `toCSV()`                                                 | Os dados como CSV (números sem formatação, datas em ISO), para uma planilha.                     |
| `download('png' \| 'svg' \| 'csv', nome?)`                | Baixa a imagem (PNG com o dobro da resolução) ou os dados em CSV.                                |
| `destroy()`                                               | Remove o gráfico e para de escutar os eventos dele.                                              |
| `visibleSeries`                                           | Nomes das séries visíveis (as que você não escondeu na legenda).                                 |
| `element`                                                 | O elemento da página onde o gráfico está.                                                        |
| `LozChart.multiples(elemento, opcoes)`                    | Cria small multiples. Veja [Small multiples](#small-multiples).                                  |
| `LozChart.getChart(elemento)`                             | O gráfico que já está montado nesse elemento (ou nesse seletor), se houver um.                   |
| `LozChart.initAll(raiz)`, `destroyAll(raiz)`, `cleanup()` | Montagem automática para HTMX.                                                                   |
| `LozChart.registerSeries(nome, impl)`                     | Adiciona um tipo de série.                                                                       |
| `LozChart.seriesTypes`                                    | Os nomes dos tipos de série registrados.                                                         |
| `LozChart.registerMap(nome, topojsonOuGeojson)`           | Adiciona um mapa para `choropleth` e `mapbubble`.                                                |

Os métodos que mudam alguma coisa devolvem o próprio gráfico, então você pode encadear:
`chart.setTheme('dark').toggleSeries('Loja', false)`.

### Quando não há dados

O gráfico fica vazio, sem aviso nenhum: a mensagem é você quem decide. Enquanto ele não tem dados, o
elemento leva o atributo `data-empty`, então basta uma regra de CSS:

```css
#vendas[data-empty]::after {
  content: 'Ainda não há vendas este mês.';
  display: grid;
  place-items: center;
  position: absolute;
  inset: 0;
  color: #52514e;
}
#vendas {
  position: relative;
}
```

Se preferir fazer pelo código, verifique `chart.element.hasAttribute('data-empty')` depois do
`setData`. Quem usa um leitor de tela também ouve que o gráfico ainda não tem dados.

## Acessibilidade

Você não precisa ativar nada disto: vem em todo gráfico.

<!-- vivo: teclado -->

- O SVG tem `role="img"` e uma descrição (`aria-label`).
- Com o foco no gráfico, ← → (↑ ↓ na horizontal) percorrem os dados, Home e End vão para as
  pontas e Esc fecha o tooltip. Cada movimento é anunciado aos leitores de tela.
- Cada gráfico tem uma tabela oculta com todos os dados. Com zoom também, porque o zoom muda o que
  aparece, não os dados.
- Com zoom, + − e 0 aproximam, afastam e voltam para tudo. A barra de rolagem são três controles
  deslizantes (a janela e as suas duas bordas) que se movem com as setas, Page Up e Page Down, e
  Home e End, e que anunciam o trecho visível. O botão "Ver tudo" aparece ao dar zoom.
- As anotações com texto entram na descrição do gráfico ("Referências: Meta diária, 8
  mil").
- A legenda é feita de botões com `aria-pressed`.
- Respeita a preferência do sistema de reduzir o movimento (`prefers-reduced-motion`).

## Como funciona por dentro

Se você vai mexer no núcleo, isto te poupa de ler o código do zero.

- **Escalas** (`core/scales.ts`). Convertem dados em pixels. O Y é linear, uma regra de três.
  O X é de **banda** se houver barras: a largura é dividida em n faixas e cada série usa o centro
  `x.at(i)`. Se não houver barras, ele é **contínuo** e cada ponto fica no lugar da sua data real.
- **Marcas redondas do eixo** (`core/ticks.ts`). O passo é arredondado para 1, 2 ou 5 × 10ⁿ e o domínio é
  estendido até múltiplos desse passo. Para datas, ele escolhe o intervalo de calendário mais fino
  (hora, dia, mês, trimestre, ano…) que deixe espaço entre os rótulos.
- **Curva monótona** (`core/shapes.ts`). Suaviza sem inventar picos: onde os dados mudam de
  direção a curva fica plana, e as tangentes são cortadas para não passar do ponto.
- **Animação** (`chart.ts`). Cada estado é um "quadro" com o domínio Y e a base e a ponta de
  cada série. Animar é interpolar entre o quadro atual e o novo durante 600 ms, rápido no começo e suave na chegada (ease-out). Se
  outra mudança chegar no meio do caminho, ela parte do quadro que está na tela naquele momento.
- **Zoom** (`core/view.ts`). A janela visível é guardada como frações do eixo X, de 0 a 1. Assim
  ela vale igual para barras, datas e números, e não depende da largura. As escalas recebem a janela e
  esticam o eixo; o que fica fora cai fora da área e o recorte esconde. Para o eixo do
  valor só contam os dados da janela, e essa mudança é animada em 220 ms para acompanhar o gesto.
- **Rótulos sem choques** (`core/labels.ts`). Cada rótulo quer ficar na altura do seu dado. Os
  que se chocam formam um grupo centrado na média do que pediam, e os grupos que se chocam se
  juntam. Nenhum se afasta do seu dado mais do que o necessário.

## Criar um tipo de série

```js
LozChart.registerSeries('pontos', {
  legendSymbol: 'dot',
  draw({ frame, color, x, y, n }) {
    let s = '';
    for (let i = 0; i < n; i++) {
      if (isFinite(frame.y1[i])) s += `<circle cx="${x.at(i)}" cy="${y.map(frame.y1[i])}" r="4" fill="${color}"/>`;
    }
    return s;
  },
});
```

Um tipo pode pedir colunas extras com `columns: (o) => ({ low: o.low })`, e elas chegam animadas em
`frame.cols.low`. Se estiverem nas unidades do eixo, liste-as em `valueColumns` para que contem no
domínio e encolham ao esconder a série. `pointer: 'nearest'` troca a guia que segue o ponteiro (crosshair) por "o
ponto mais próximo", e `tooltip(ps, i, format)` personaliza o texto do tooltip e da tabela.

As séries desenham sempre em um plano lógico, com o índice no X e o valor no Y. Na horizontal, o
núcleo espelha esse plano pela diagonal, então um tipo novo funciona nas duas orientações sem
mudanças.

Além do plano cartesiano, há dois sistemas de coordenadas (`coords`):

- `'polar'`: o núcleo desenha anéis, raios e rótulos, e a série posiciona os seus pontos com
  `ctx.polar.point(i, valor)`. É assim que o radar faz.
- `'free'`: sem eixos. A série usa a área inteira (`ctx.width`, `ctx.height`) e responde `hit` (qual
  dado está embaixo do ponteiro) e `anchor` (onde apoiar o tooltip pelo teclado).

Com `legendBy: 'points'`, a legenda lista categorias, como na pizza: cada uma com
`ctx.pointColor(i)`, e as escondidas chegam como zero. `ctx.label(i)`, `ctx.format(v)`,
`ctx.percent(v)` e `ctx.measure(texto)` ajudam com os rótulos, e `domainValues(opcoes)` soma
valores fixos ao domínio (como a meta do gauge).

O resto do contexto e do contrato:

- `ctx.purpose` diz para que se está desenhando: `'screen'` (na página), `'export'` (`toSVG` e os
  downloads) ou `'overview'` (o minigráfico da barra do zoom, em cinza e com a superfície
  transparente; ali rótulos e detalhes sobram).
- `ctx.locale` e `ctx.currency` (também no `format` do tooltip) são o idioma e a moeda do
  gráfico, para escrever datas e textos com `Intl`.
- `ctx.siblings()` dá os contextos das séries visíveis do mesmo tipo, para o que várias séries
  lado a lado decidem juntas: duas cascatas têm rótulos as duas ou nenhuma.
- `hit(ctx, px, py)` também vale no cartesiano, em px do plano lógico: o tipo diz qual dado está
  embaixo do ponteiro (−1: nenhum). Se nenhuma série com `hit` encontrar um, o ponteiro segue como
  sempre, a não ser que todas as séries visíveis tenham `hit`.
- `click(ctx, i, evento)` recebe o clique no dado i, ou Enter e Espaço com o dado ativo. Ele é
  chamado na série embaixo do ponteiro (com `hit`, ou em `'free'`) ou, se não dá para saber qual é,
  em cada série visível que o tenha. Depois é chamada a opção `onClick` do gráfico.
- `preferredHeight(ps, largura)` é a altura que a série pede (com os eixos) quando você não informa
  `height`. Com várias séries, vale a maior.
- `derivedName`: com `derive`, o nome do valor calculado (`'acumulado'`). `toCSV` usa esse nome se
  o nome da série coincidir com um campo que também é exportado.
- Para a seleção (a opção `selection` ou `select()`), `ctx.isDimmed(i)` diz quais dados ficam
  atenuados. Um tipo com `dimmable: true` desenha esses dados com `DIM_OPACITY` (0,25): `dimOpacity(ctx, i)`
  dá o atributo, `dimmed(ctx, i, markup)` envolve um dado e `paintDimmed(ctx, (incluir) => …)`
  desenha em duas passadas um traço que junta muitos dados (todas as barras em um path). Sem
  `dimmable`, o núcleo deixa a série como está e marca os selecionados com `hover`.
- `chart.redraw()` desenha de novo sem animar. Serve para um tipo cujo desenho mudou por fora das
  opções, como uma imagem que terminou de carregar.

O zoom funciona em gráficos cartesianos. Um tipo `'free'` com o próprio eixo de tempo, como um
Gantt, não recebe zoom, porque a janela, os gestos, a barra de rolagem e o teclado se apoiam na
escala do índice do núcleo. Esse tipo pode oferecer o seu próprio recorte de datas com as suas
opções e `redraw()`.

**Peças do núcleo para extensões.** O pacote (e `window.LozChart` na versão para
`<script>`) exporta as mesmas peças com que os tipos da biblioteca são desenhados: cores (`parseColor`,
`toHex`, `toOklab`, `fromOklab`, `mixOklab`, `luminance`, `contrast`, `textOn`, `inkFor`,
`colorDomain`, `makeRamp`, `paint`, `paintColor`, `legendSpec`, `legendWidth`, `MAX_COLORS`),
formatos (`valueFormatter`, `compactFormatter`, `axisFormatter`, `parseTime`, `timeTickLabel`,
`timeFullLabel`), marcas de eixo (`niceStep`, `niceDomain`, `numberTicks`, `logTicks`, `logDomain`,
`chooseTimeInterval`, `timeTicks`, `detectTimeUnit`), escalas (`LinearScale`, `LogScale`,
`BandScale`, `ContinuousScale`), formas (`linePath`, `areaPath`, `barPath`, `stepPath`,
`polarPoint`, `r2`), a seleção (`DIM_OPACITY`, `dimOpacity`, `dimmed`, `paintDimmed`) e `esc`,
`attrs`, `textWidth`, `fitText`, `toCSV`, `slug` e `swatchOf`.

## Compilar a partir do código

Se você quer mudar a biblioteca ou rodar os testes dela:

```bash
npm install
npm run build   # dist/: lozcharts.js (ESM), lozcharts.umd.js (UMD), react.js, maps/ e types/
npm test        # testes (node:test)
npm run check   # formatação, tipos e testes: o mesmo que roda na integração contínua
```

Depois de compilar, abra `demo/index.html` com dois cliques e a galeria está pronta. Não precisa de
servidor. Para testar as suas mudanças em outro projeto da sua máquina, instale a partir da pasta:
`npm install ../lozcharts`. Ela fica ligada à pasta, então depois de cada mudança rode
`npm run build` e recarregue.

## Regras de design

As regras fixas que todos os tipos seguem (nomes, paleta e medidas de cada marca) estão em
[DESIGN.md](DESIGN.md).
