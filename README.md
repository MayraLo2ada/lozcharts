# LozCharts

Gráficos SVG interactivos, accesibles y sin dependencias, escritos en TypeScript. La librería se
llama LozCharts y cada gráfico que creas es un `LozChart`.
Modo claro, oscuro y automático; tooltip, leyenda, teclado, animación y exportación a SVG/PNG.

Tipos: líneas, barras (verticales u horizontales, agrupadas y apiladas), áreas, líneas
escalonadas, bandas de rango, dispersión, burbujas, velas, OHLC, pie, donut, gauge, radar, embudo,
mapa de calor, treemap, sankey, mapas coropléticos y de burbujas, y small multiples. Con zoom,
anotaciones, etiquetas directas, exportación a PNG, SVG y CSV, y un componente para React.

## Instalación y build

```bash
npm install
npm run build   # dist/: lozcharts.js (ESM), lozcharts.umd.js (UMD), react.js, maps/ y types/
npm test        # pruebas (node:test)
npm run check   # formato, tipos y pruebas: lo mismo que corre la integración continua
```

Abre `demo/index.html` con doble clic para ver la galería (después de `npm run build`).

## Tres formas de usarla

**1. Con `<script>` (sin servidor):**

```html
<div id="grafico"></div>
<script src="lozcharts.umd.js"></script>
<script>
  new LozChart('#grafico', {/* opciones */});
</script>
```

**2. Con `import` (Vite, webpack) o `require` (Node, Jest):**

```js
import { LozChart } from 'lozcharts';
const chart = new LozChart(elemento, opciones);
// al desmontar el componente:
chart.destroy();
```

**En React:** los componentes de `lozcharts/react` (ver [React](#react)). **En Angular, Vue o
Svelte:** el elemento `<loz-chart>` (ver [`<loz-chart>`](#loz-chart-angular-vue-svelte-o-html-puro)).

**3. Con Django + HTMX:** pon las opciones en JSON en el atributo `data-lozchart`
(o el selector de un `<script type="application/json">`) y re-inicializa en cada swap:

```html
<div data-lozchart="#opciones-ventas"></div>
{{ opciones|json_script:"opciones-ventas" }}
<script>
  htmx.onLoad((el) => LozChart.initAll(el));
  document.body.addEventListener('htmx:beforeSwap', (e) => LozChart.destroyAll(e.detail.target));
</script>
```

`initAll` reemplaza el gráfico si el elemento ya tenía uno y limpia los que quedaron fuera de la página.
Ejemplo completo en `examples/django` (vista, URL y plantillas) y, para verlo sin Django,
`examples/htmx/index.html`.

## Ejemplo completo

```js
const chart = new LozChart('#grafico', {
  title: 'Ventas por mes',
  subtitle: 'Enero a diciembre 2026',
  data: [
    { mes: '2026-01', online: 42000, tienda: 31000, meta: 80000 },
    { mes: '2026-02', online: 45500, tienda: 29800, meta: 82000 },
    // …
  ],
  xAxis: { field: 'mes', type: 'time' }, // 'category' | 'time' | 'linear'
  yAxis: { format: 'currency' }, // 'auto' | 'compact' | 'number' | 'percent' | 'currency' | función
  series: [
    { type: 'bar', field: 'online', name: 'Online', stack: true },
    { type: 'bar', field: 'tienda', name: 'Tienda', stack: true },
    { type: 'line', field: 'meta', name: 'Meta', smooth: true },
  ],
  theme: 'auto', // 'light' | 'dark' | 'auto'
  height: 320,
  legend: { position: 'bottom' },
  tooltip: true,
  animate: true,
  locale: 'es',
  currency: 'USD',
});
```

## Tipos de serie

| Nombre       | Tipo          | Para qué sirve                                   | Campos                                                           |
| ------------ | ------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| LozLine      | `line`        | Evolución de un valor                            | `field`; `smooth` para curva monótona                            |
| LozBar       | `bar`         | Comparar cantidades; agrupadas o con `stack`     | `field`                                                          |
| LozArea      | `area`        | Volumen acumulado; apilable                      | `field`; `smooth`                                                |
| LozStep      | `step`        | Valores que cambian de golpe (tarifas, tasas)    | `field`; `step`: `'after'` (por defecto), `'before'`, `'middle'` |
| LozRange     | `range`       | Banda entre un mínimo y un máximo                | `field` (superior) y `low` (inferior)                            |
| LozScatter   | `scatter`     | Relación entre dos números                       | `field` (Y); X con `xAxis.type: 'linear'`                        |
| LozBubble    | `bubble`      | Como dispersión, con un tercer valor como tamaño | `field`, `size`; `sizeName` para el tooltip                      |
| LozCandle    | `candlestick` | Precios: apertura, máximo, mínimo y cierre       | `field` (cierre), `open`, `high`, `low`                          |
| LozOHLC      | `ohlc`        | Lo mismo que las velas, en trazos                | `field` (cierre), `open`, `high`, `low`                          |
| LozPie       | `pie`         | Partes de un todo (pocas categorías)             | `xAxis.field` (categoría), `field` (valor)                       |
| LozDonut     | `donut`       | Como el pie, con el total al centro              | igual que `pie`; `innerRadius` (0,6)                             |
| LozGauge     | `gauge`       | Un indicador contra su rango y su meta           | `field`; `target`; rango con `yAxis.min` y `yAxis.max`           |
| LozRadar     | `radar`       | Perfiles en varias dimensiones                   | `xAxis.field` (criterio), `field` por serie                      |
| LozFunnel    | `funnel`      | Pasos de un proceso y su conversión              | `xAxis.field` (paso), `field` (cantidad)                         |
| LozHeatmap   | `heatmap`     | Patrones en una rejilla (día × hora)             | `xAxis.field` (columna), `y` (fila), `field` (valor)             |
| LozTreemap   | `treemap`     | Partes de un todo con muchas categorías          | `xAxis.field` (nombre), `field` (tamaño); `group` opcional       |
| LozSankey    | `sankey`      | Flujos entre etapas (de dónde a dónde)           | `xAxis.field` (origen), `to` (destino), `field` (cantidad)       |
| LozMap       | `choropleth`  | Un valor por país, coloreado                     | `xAxis.field` (país), `field`; ver [Mapas](#mapas)               |
| LozMap       | `mapbubble`   | Cantidades sobre el mapa                         | `xAxis.field`, `field`; `lat` y `lon` opcionales                 |
| LozMultiples | —             | Cuadrícula de gráficos pequeños                  | `LozChart.multiples(…)`; ver [Small multiples](#small-multiples) |

Los nombres (LozBar, LozLine…) son los de la familia LozCharts en la documentación; en el código
cada tipo se elige con su nombre corto: `type: 'bar'`.

**Pie, donut, gauge y embudo** muestran una sola serie. En el pie y el donut cada categoría tiene
su color y su botón en la leyenda, con su porcentaje (ocultarla lo recalcula); con más de 8
categorías, las 7 primeras llevan color y el resto se suma en "Otros", con su detalle en el
tooltip y la tabla. Si son más de 5, considera barras horizontales ordenadas: se leen mejor. Las etiquetas (`labels: false` las apaga) se reparten para no
encimarse y se omiten en pantallas angostas, donde la leyenda y el tooltip ya lo dicen.
Para varios gauges o varios embudos, usa small multiples.

```js
new LozChart('#categorias', {
  data: [{ categoria: 'Electrónica', ventas: 184200 } /* … */],
  xAxis: { field: 'categoria' },
  yAxis: { format: 'currency' },
  series: [{ type: 'donut', field: 'ventas', name: 'Ventas' }],
});

new LozChart('#meta', {
  data: [{ mes: 'Octubre', avance: 0.78 }],
  xAxis: { field: 'mes' },
  yAxis: { format: 'percent', min: 0, max: 1 },
  series: [{ type: 'gauge', field: 'avance', name: 'Avance', target: 0.85 }],
});
```

Con `orientation: 'horizontal'` el gráfico gira: las categorías van en el eje vertical. Sirve
sobre todo para barras con nombres largos.

```js
new LozChart('#precios', {
  data: sesiones, // { fecha, apertura, maximo, minimo, cierre }
  xAxis: { field: 'fecha', type: 'time' },
  yAxis: { format: 'currency' },
  series: [{ type: 'candlestick', field: 'cierre', open: 'apertura', high: 'maximo', low: 'minimo', name: 'AURF' }],
});
```

## Mapa de calor, treemap y sankey

```js
// Mapa de calor: una fila de datos por celda.
new LozChart('#visitas', {
  data: visitas, // { hora: '09:00', dia: 'Lunes', visitas: 120 }
  xAxis: { field: 'hora' },
  series: [{ type: 'heatmap', field: 'visitas', name: 'Visitas', y: 'dia' }],
});

// Treemap: el área de cada rectángulo es su valor; `group` los agrupa por color.
new LozChart('#productos', {
  data: ventas, // { producto: 'Laptops', categoria: 'Electrónica', ventas: 420000 }
  xAxis: { field: 'producto' },
  yAxis: { format: 'currency' },
  series: [{ type: 'treemap', field: 'ventas', name: 'Ventas', group: 'categoria' }],
});

// Sankey: una fila por flujo, de `xAxis.field` a `to`.
new LozChart('#recorrido', {
  data: flujos, // { origen: 'Búsqueda', destino: 'Producto', sesiones: 4200 }
  xAxis: { field: 'origen' },
  series: [{ type: 'sankey', field: 'sesiones', name: 'Sesiones', to: 'destino' }],
});
```

- **Mapa de calor:** un solo tono que va de la superficie al color de la serie (mezclado en OKLab,
  con pasos de claridad parejos); si hay negativos, divergente y simétrico alrededor del cero.
  Leyenda de color arriba a la derecha. Las flechas recorren la rejilla en dos dimensiones. Si una
  celda se repite, se dibuja la última y la tabla lo avisa.
- **Treemap:** algoritmo _squarified_ (rectángulos lo más cuadrados posible, que se comparan
  mejor). El texto de cada rectángulo elige el color de mayor contraste con su relleno. Con `group`,
  cada grupo lleva un color de la paleta y su título; más de 8 grupos van en gris.
- **Sankey:** las columnas salen del camino más largo desde cada origen y los nodos se ordenan
  para cruzar lo menos posible. Cada flujo lleva el color de su origen. Si los datos tienen un
  ciclo, el flujo que lo cierra no se dibuja y se avisa en la consola. El tooltip dice qué parte
  del origen y del destino representa cada flujo.

## Mapas

Los contornos van aparte (pesan unos 110 KB): solo los carga quien hace mapas.

```html
<script src="lozcharts.umd.js"></script>
<script src="maps/world.umd.js"></script>
```

```js
import { LozChart } from 'lozcharts';
import 'lozcharts/maps/world'; // registra el mapa del mundo como 'mundo'

new LozChart('#usuarios', {
  data: [
    { pais: 'COL', usuarios: 980000 },
    { pais: 'México', usuarios: 1830000 },
    { pais: 'Brazil', usuarios: 2650000 },
  ],
  xAxis: { field: 'pais' },
  series: [{ type: 'choropleth', field: 'usuarios', name: 'Usuarios', fit: 'data' }],
});
```

- **Cada país se encuentra por** su código ISO de 3 letras, el numérico o su nombre en inglés o en
  español, sin importar mayúsculas ni acentos. Los que no se encuentran se avisan en la consola.
- **`fit: 'data'`** encuadra solo los países con datos (una región); por defecto se ve el mundo sin
  la Antártida.
- **`projection`:** `'equalEarth'` (por defecto) es de áreas iguales, la honesta para colorear
  países; `'mercator'` es la de los mapas web, que infla los países del norte.
- **`mapbubble`** pone un círculo por fila con el área proporcional al valor: en su `lat` y `lon`,
  o en el centro del país.
- **Otros mapas:** `LozChart.registerMap('colombia', topojsonOGeojson)` y `map: 'colombia'` en la
  serie. Sirve cualquier TopoJSON o GeoJSON de polígonos en longitud y latitud.
- **Origen de los datos:** Natural Earth 1:110m (dominio público), empaquetado por world-atlas
  (licencia ISC, en `maps/LICENSE`).

## React

```jsx
import { useMemo, useRef } from 'react';
import { Chart } from 'lozcharts/react';

function Ventas({ filas }) {
  const chart = useRef(null);
  const data = useMemo(() => filas, [filas]);
  return (
    <>
      <Chart
        ref={chart}
        title="Ventas"
        data={data}
        xAxis={{ field: 'mes', type: 'time' }}
        series={[{ type: 'bar', field: 'ventas', name: 'Ventas' }]}
        zoom
        onZoom={(rango) => console.log(rango)}
      />
      <button onClick={() => chart.current?.download('png')}>Descargar</button>
    </>
  );
}
```

- Las opciones del gráfico van como props, más `className`, `style` e `id` para el contenedor.
  `Multiples` hace lo mismo con small multiples.
- Los datos se comparan por referencia: si cambian, el gráfico anima desde lo que se ve (usa
  `useMemo` para no crear un arreglo nuevo en cada render). Las demás opciones se comparan por
  contenido: escribirlas en línea no vuelve a dibujar nada si no cambiaron.
- `onHover`, `onZoom` y demás funciones siempre llaman a su versión más reciente.
- El `ref` da la instancia de `LozChart` (o `LozMultiples`) con todos sus métodos.
- Ejemplo completo en `examples/react` (`npm run example:react` y abre
  `examples/react/index.html`).

## `<loz-chart>`: Angular, Vue, Svelte o HTML puro

Un elemento HTML estándar (Custom Element) que sirve en cualquier framework sin adaptador. Con
`<script src="lozcharts.umd.js">` ya queda registrado; con módulos, `import 'lozcharts/element'`.

```html
<loz-chart
  options='{"data": [{"mes": "2026-01", "ventas": 42000}], "xAxis": {"field": "mes", "type": "time"},
  "series": [{"type": "bar", "field": "ventas", "name": "Ventas"}]}'
></loz-chart>
```

```ts
// Angular (standalone): agrega CUSTOM_ELEMENTS_SCHEMA al componente.
import 'lozcharts/element';
@Component({
  selector: 'app-ventas',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<loz-chart [options]="opciones" (lozzoom)="alHacerZoom($event)"></loz-chart>`,
})
export class VentasComponent {
  opciones = { data: [], xAxis: { field: 'mes', type: 'time' }, series: [{ type: 'line', field: 'ventas' }], zoom: true };
  alHacerZoom(e: CustomEvent) {
    console.log(e.detail); // [desde, hasta] o null
  }
}
```

- Las opciones van en el atributo `options` (JSON) o en la propiedad `options` (un objeto). Si
  solo cambian los datos, el gráfico anima con `setData`; si cambia otra cosa, con `setOptions`.
  Con `facet` crea small multiples.
- Emite `lozhover` y `lozzoom` (en `event.detail`, la X activa o el tramo visible); con `facet`
  (small multiples) no emite eventos.
- `elemento.chart` da la instancia con todos sus métodos. Al quitar el elemento de la página, el
  gráfico se destruye solo: dentro de fragmentos HTMX no hace falta `initAll`.

## Muchos datos

Líneas, áreas, escalones y rangos dibujan solo lo que se ve y, con más de dos datos por píxel, el
primero, el mínimo, el máximo y el último de cada columna de píxeles: con 100 000 puntos el trazo
se ve igual, ningún pico se pierde y el gráfico se crea en unos 40 ms. Con `zoom` se exploran
series largas sin perder detalle. La tabla para lectores de pantalla muestra las primeras 500
filas y avisa; `download('csv')` o `toCSV()` dan todos los datos.

## Small multiples

Muchos gráficos pequeños con la misma escala, uno por serie o por valor de un campo. Es la
salida correcta cuando hay más de 4 o 5 series (que en un solo gráfico se enredan) o cuando se
quiere comparar la forma de varias categorías.

```js
// Un panel por serie
LozChart.multiples('#ciudades', {
  title: 'Temperatura máxima media por mes',
  facet: 'series',
  data: meses, // { mes, miami, madrid, bogota, … }
  xAxis: { field: 'mes', type: 'time' },
  series: ciudades.map((c) => ({ type: 'line', field: c.campo, name: c.nombre })),
  height: 150, // alto de cada panel
});

// Un panel por valor de un campo
LozChart.multiples('#regiones', {
  facet: { field: 'region', order: ['Norte', 'Centro', 'Sur'] },
  data: ventas, // { mes, region, online, tienda }
  xAxis: { field: 'mes', type: 'time' },
  series: [
    { type: 'area', field: 'online', name: 'Online', stack: true },
    { type: 'area', field: 'tienda', name: 'Tienda', stack: true },
  ],
});
```

- Todos los paneles comparten el eje del valor (`sharedY: false` lo desactiva) y las mismas X: si a
  un panel le falta un mes, ese mes queda como hueco.
- Los números del eje solo aparecen en la primera columna y las etiquetas X solo en el último panel
  de cada columna; se recalcula al cambiar el ancho. El área de datos mide lo mismo en todos.
- Si un panel tiene barras, todos usan escala de banda y los números del eje reservan el mismo
  ancho: cada fecha cae en la misma vertical en todos los paneles.
- El puntero sobre un panel marca el mismo dato en todos. La leyenda es una sola (solo al facetar
  por campo) y oculta la serie en todos los paneles.
- `columns` fija las columnas; si no, caben las que permita `minWidth` (240 px por defecto).
- Con `facet: 'series'`, `context: true` dibuja en cada panel las demás series en gris, detrás de la suya.
- Las `annotations` se dibujan en todos los paneles (una meta común, por ejemplo).
- Métodos: `setData`, `setOptions`, `setTheme`, `toggleSeries`, `toSVG`, `download`, `destroy` y
  `charts` (los gráficos de cada panel). En HTMX, `initAll` los crea si el JSON trae `facet`.

## Dos medidas con distintas unidades

Con dos ejes Y, quien dibuja decide dónde se cruzan las líneas: basta mover un eje para que una
medida "alcance" a la otra, y el lector saca conclusiones que los datos no dicen. Por eso LozCharts
ofrece tres caminos, del más al menos recomendable.

**Paneles alineados.** Cada medida en su panel y con sus unidades; mismo eje X, áreas de datos
alineadas al píxel y puntero sincronizado.

```js
LozChart.multiples('#ventas-y-visitas', {
  facet: 'series',
  columns: 1,
  sharedY: false, // cada panel con su propio eje
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  series: [
    { type: 'bar', field: 'ventas', name: 'Ventas', format: 'currency' },
    { type: 'line', field: 'visitas', name: 'Visitas a la web', format: 'compact' },
  ],
});
```

**Índice base 100.** Para comparar cuál creció más: cada serie se divide por su primer valor y se
multiplica por 100, así comparten un eje con la misma unidad. El tooltip muestra el índice y el
valor original.

```js
new LozChart('#crecimiento', {
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  yAxis: { index: true },
  series: [
    { type: 'line', field: 'ventas', name: 'Ventas', format: 'currency' },
    { type: 'line', field: 'visitas', name: 'Visitas a la web' },
  ],
});
```

**Doble eje, con salvaguardas.** Si de verdad hace falta (por ejemplo, porque el público ya lo
espera), `axis: 'right'` lleva una serie al eje derecho y `yAxis2` lo configura. LozCharts hace que
los dos ejes empiecen en cero, que el cero quede a la misma altura, que las líneas de la rejilla
coincidan (el paso del eje derecho se elige para eso) y que la leyenda diga "(eje derecho)". No
aplica en modo índice ni en horizontal.

```js
new LozChart('#ventas-y-visitas', {
  data: meses,
  xAxis: { field: 'mes', type: 'time' },
  yAxis: { format: 'currency', title: 'Ventas' },
  yAxis2: { format: 'compact', title: 'Visitas' },
  series: [
    { type: 'bar', field: 'ventas', name: 'Ventas' },
    { type: 'line', field: 'visitas', name: 'Visitas a la web', axis: 'right' },
  ],
});
```

## Zoom, anotaciones y etiquetas directas

```js
new LozChart('#visitas', {
  title: 'Visitas diarias',
  data: dias, // { fecha, web, app }, un año
  xAxis: { field: 'fecha', type: 'time' },
  series: [
    { type: 'line', field: 'web', name: 'Web' },
    { type: 'line', field: 'app', name: 'App' },
  ],
  zoom: { range: ['2026-06-01', '2026-08-31'] }, // ventana inicial (opcional)
  endLabels: true,
  annotations: [
    { y: 8000, label: 'Meta diaria' },
    { x: ['2026-06-29', '2026-07-21'], label: 'Campaña de verano' },
  ],
});
```

**Zoom** (`zoom: true`, gráficos cartesianos verticales). Arrastrar sobre el gráfico marca un tramo
y lo acerca; Ctrl + rueda (o pellizcar el trackpad) acerca y aleja bajo el puntero; Shift + rueda o
deslizar de lado mueve la ventana; doble clic vuelve a todo. En pantallas táctiles, dos dedos
pellizcan y se mueven juntos, y un dedo sigue recorriendo los datos con el tooltip. La rueda sola
sigue moviendo la página: el gráfico no secuestra el scroll. Al acercar, el eje del valor se
ajusta a lo que se ve. Debajo va una barra con un mini gráfico de todos los datos: se arrastra la
ventana o sus bordes, y también se maneja con el teclado (`zoom: { scrollbar: false }` la quita).
Con el foco en el gráfico, + y − acercan y alejan, 0 vuelve a todo, y si las flechas llevan a un
dato fuera de la ventana, la ventana lo sigue.

**Anotaciones** (`annotations`). Cada una da `x` o `y`: un valor dibuja una línea de referencia y
dos valores una franja. `x` acepta categorías, fechas o números; `y`, números (y `axis: 'right'`
para el eje derecho). El eje se amplía para que una meta siempre se vea. Las franjas van detrás de
los datos; las líneas y sus textos, encima. Los textos que chocarían se corren.

**Etiquetas al final** (`endLabels: true`, o `{ value: true }` para agregar el último valor). El
nombre de cada línea, área o escalón va a la derecha, a la altura de su último dato visible; las que
chocan se reparten sin alejarse de su dato más de lo necesario. Con zoom, siguen al último dato de
la ventana.

**Énfasis** (`emphasis: 'Bogotá'` o una lista). Las series nombradas van en su color y encima; las
demás quedan en gris como contexto. En small multiples por serie, `context: true` hace lo mismo en
cada panel: su serie en color y las demás en gris detrás.

## Opciones

| Opción                       | Tipo                                        | Por defecto     | Qué hace                                                                                          |
| ---------------------------- | ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `title`, `subtitle`          | texto                                       | —               | Encabezado del gráfico (también va en la exportación).                                            |
| `data`                       | arreglo de objetos                          | —               | Una fila por punto.                                                                               |
| `xAxis.field`                | texto                                       | —               | Campo de la posición X.                                                                           |
| `xAxis.type`                 | `'category'` `'time'` `'linear'`            | `'category'`    | Fechas aceptan `Date`, milisegundos o texto (`'2026-03'` se lee en hora local).                   |
| `xAxis.format`               | formato u opciones de `Intl.DateTimeFormat` | automático      | Etiquetas del eje X.                                                                              |
| `xAxis.title`, `yAxis.title` | texto                                       | —               | Títulos de los ejes.                                                                              |
| `yAxis.format`               | ver abajo                                   | `'auto'`        | Formato del eje Y y del tooltip.                                                                  |
| `yAxis.min`, `yAxis.max`     | número                                      | calculados      | Límites fijos.                                                                                    |
| `yAxis2`                     | `{ format, title, min, max }`               | —               | Eje derecho para las series con `axis: 'right'`.                                                  |
| `series[].axis`              | `'left'` `'right'`                          | `'left'`        | Eje del valor de la serie.                                                                        |
| `yAxis.index`                | booleano                                    | `false`         | Índice base 100: cada serie respecto de su primer valor.                                          |
| `yAxis.width`                | px                                          | —               | Ancho mínimo para los números del eje; alinea varios gráficos.                                    |
| `xAxis.labels`               | booleano                                    | `true`          | `false` oculta las etiquetas del eje X.                                                           |
| `xAxis.band`                 | booleano                                    | `false`         | Fuerza la escala de banda (puntos al centro de su franja), para alinear con barras.               |
| `yAxis.labels`               | booleano                                    | `true`          | `false` oculta los números del eje (la rejilla queda).                                            |
| `yAxis.zero`                 | booleano                                    | `false`         | Fuerza el cero (barras y áreas ya lo incluyen).                                                   |
| `series[].type`              | ver [Tipos de serie](#tipos-de-serie)       | —               | Tipo registrado.                                                                                  |
| `series[].field`             | texto                                       | —               | Campo numérico.                                                                                   |
| `series[].name`              | texto                                       | el campo        | Nombre visible; debe ser único.                                                                   |
| `series[].stack`             | `true` o texto                              | —               | Apila barras o áreas del mismo grupo. Positivos y negativos se apilan por separado.               |
| `series[].smooth`            | booleano                                    | `false`         | Curva monótona (línea y área).                                                                    |
| `series[].color`             | 1 a 8                                       | su posición     | Slot de la paleta.                                                                                |
| `series[].visible`           | booleano                                    | `true`          | Visible al inicio.                                                                                |
| `series[].format`            | formato                                     | el del eje Y    | Formato propio en el tooltip.                                                                     |
| `orientation`                | `'vertical'` `'horizontal'`                 | `'vertical'`    | En horizontal, las categorías van en el eje vertical.                                             |
| `theme`                      | `'light'` `'dark'` `'auto'`                 | `'auto'`        | `auto` sigue al sistema y cambia en vivo.                                                         |
| `palette`                    | arreglo de colores o `{ light, dark }`      | la de LozCharts | Colores propios en orden (máximo 8). Ver [Paleta propia](#paleta-propia).                         |
| `height`                     | px                                          | `320`           | Alto del área del gráfico con sus ejes.                                                           |
| `legend`                     | `false` o `{ position: 'top' \| 'bottom' }` | abajo           | Solo aparece con 2 o más series.                                                                  |
| `tooltip`, `animate`         | booleano                                    | `true`          |                                                                                                   |
| `locale`, `currency`         | texto                                       | `'es'`, `'USD'` | Para `Intl`.                                                                                      |
| `background`                 | booleano                                    | `true`          | Pinta la superficie del tema detrás del gráfico.                                                  |
| `onHover`                    | función                                     | —               | Recibe la X del dato activo (o null al salir). Con `highlight(x)` sincroniza gráficos.            |
| `zoom`                       | booleano o `{ range, scrollbar }`           | `false`         | Zoom en el eje X con barra de desplazamiento. Ver [Zoom](#zoom-anotaciones-y-etiquetas-directas). |
| `onZoom`                     | función                                     | —               | Recibe el primer y el último dato visibles, o null al ver todo.                                   |
| `annotations`                | arreglo de `{ x \| y, label, axis }`        | —               | Líneas de referencia (un valor) y franjas (dos valores).                                          |
| `endLabels`                  | booleano o `{ value }`                      | `false`         | Nombre (y valor) al final de cada línea, área o escalón.                                          |
| `emphasis`                   | texto o arreglo                             | —               | Series destacadas; las demás van en gris como contexto.                                           |
| `ariaLabel`                  | texto                                       | automático      | Descripción para lectores de pantalla.                                                            |

**Formatos:** `'auto'` (compacto desde mil: 0 / 1 mil / 2 mil), `'compact'`, `'number'`,
`'percent'` (los datos van como fracción: `0.25` = 25 %), `'currency'`, o una función
`(v) => texto`. El tooltip siempre muestra el valor exacto.

## Paleta propia

Por defecto LozCharts usa su paleta de 8 colores, validada para daltonismo y con tonos propios para
el modo oscuro. Para usar los colores de una marca:

```js
new LozChart('#grafico', {
  palette: {
    light: ['#0a7d4f', '#6b3fa0', '#d9480f'],
    dark: ['#2fb37a', '#9b74d1', '#f0703a'], // opcional: si falta, se usa light
  },
  // …
});
```

- Un arreglo simple (`palette: ['#0a7d4f', …]`) vale para los dos modos.
- Máximo 8 colores. El número de colores es el número de series que caben: las sobrantes se
  agrupan en "Otros" si están apiladas juntas, o se descartan con un aviso. Nunca se repite un color.
- Valida tu paleta para daltonismo y contraste antes de usarla; los colores de marca rara vez
  están pensados para gráficos.

## Métodos

| Método                                                    | Qué hace                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `setData(datos)`                                          | Cambia los datos y anima desde el estado actual (aunque haya una animación a medias).            |
| `setOptions({...}, animar?)`                              | Combina opciones nuevas con las actuales y redibuja.                                             |
| `axisWidth`                                               | Ancho que necesitan hoy los números del eje Y (para alinear gráficos con `yAxis.width`).         |
| `highlight(x)`                                            | Marca el dato con esa X, sin tooltip; `null` limpia.                                             |
| `zoomTo(desde, hasta)`, `resetZoom()`                     | Acerca el eje X a un tramo (con barras, incluye las categorías de los extremos) o vuelve a todo. |
| `zoomRange`                                               | Primer y último dato visibles con zoom, o null.                                                  |
| `setTheme('dark')`                                        | Cambia el tema.                                                                                  |
| `toggleSeries('Online', visible?)`                        | Oculta o muestra una serie; las demás conservan su color.                                        |
| `toSVG()`                                                 | SVG completo como texto, con título y leyenda.                                                   |
| `toCSV()`                                                 | Los datos como CSV (números sin formato, fechas en ISO), para una hoja de cálculo.               |
| `download('png' \| 'svg' \| 'csv', nombre?)`              | Descarga la imagen (PNG al doble de resolución) o los datos en CSV.                              |
| `destroy()`                                               | Quita el gráfico y sus listeners.                                                                |
| `LozChart.initAll(raíz)`, `destroyAll(raíz)`, `cleanup()` | Montaje automático para HTMX.                                                                    |
| `LozChart.registerSeries(nombre, impl)`                   | Agrega un tipo de serie.                                                                         |
| `LozChart.registerMap(nombre, topojsonOGeojson)`          | Agrega un mapa para `choropleth` y `mapbubble`.                                                  |

## Accesibilidad

- El SVG tiene `role="img"` y una descripción (`aria-label`).
- Con el foco en el gráfico, ← → (↑ ↓ en horizontal) recorren los datos, Inicio/Fin van a los extremos y Escape cierra el tooltip.
  Cada movimiento se anuncia a los lectores de pantalla.
- Una tabla oculta con todos los datos acompaña a cada gráfico (con zoom también: el zoom cambia lo que se ve, no los datos).
- Con zoom, + − y 0 acercan, alejan y vuelven a todo; la barra de desplazamiento son tres controles deslizantes (la ventana y sus dos
  bordes) que se mueven con las flechas, Re Pág/Av Pág e Inicio/Fin, y anuncian el tramo visible. El botón "Ver todo" aparece al acercar.
- Las anotaciones con texto se leen en la descripción del gráfico ("Referencias: Meta diaria, 8 mil").
- La leyenda son botones con `aria-pressed`.
- Respeta `prefers-reduced-motion`.

## Cómo funciona por dentro

- **Escalas** (`core/scales.ts`): convierten datos en píxeles. La Y es lineal (una regla de tres).
  La X es de **banda** si hay barras: el ancho se reparte en n franjas y cada serie usa el centro
  `x.at(i)`. Si no hay barras es **continua**: cada punto se ubica según su fecha real.
- **Ticks bonitos** (`core/ticks.ts`): el paso se redondea a 1, 2 o 5 × 10ⁿ y el dominio se
  extiende hasta múltiplos de ese paso. Para fechas se elige el intervalo de calendario más fino
  (hora, día, mes, trimestre, año…) que deje espacio entre etiquetas.
- **Curva monótona** (`core/shapes.ts`): suaviza sin inventar picos. Donde los datos cambian de
  dirección la curva queda plana y las tangentes se recortan para no pasarse.
- **Animación** (`chart.ts`): cada estado es un "cuadro" con el dominio Y y la base y punta de cada
  serie. Animar es interpolar entre el cuadro actual y el nuevo durante 600 ms con ease-out.
  Si llega otro cambio a mitad de camino, parte del cuadro que se ve en ese momento.
- **Zoom** (`core/view.ts`): la ventana visible se guarda como fracciones del eje X (de 0 a 1), así
  vale igual para barras, fechas y números y no depende del ancho. Las escalas reciben la ventana y
  estiran el eje; lo que queda fuera cae fuera del área y el recorte lo esconde. Para el eje del
  valor solo cuentan los datos de la ventana, y ese cambio se anima en 220 ms para seguir al gesto.
- **Etiquetas sin choques** (`core/labels.ts`): cada etiqueta quiere ir a la altura de su dato; las
  que chocan forman un grupo centrado en el promedio de lo que pedían, y los grupos que chocan se
  juntan. Nadie se aleja de su dato más de lo necesario.

## Crear un tipo de serie

```js
LozChart.registerSeries('puntos', {
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

Un tipo puede pedir columnas extra con `columns: (o) => ({ low: o.low })`: llegan animadas en
`frame.cols.low`. Si están en unidades del eje, nómbralas en `valueColumns` para que cuenten en el
dominio y se encojan al ocultar la serie. `pointer: 'nearest'` cambia el crosshair por "el punto más
cercano", y `tooltip(ps, i, format)` personaliza el texto del tooltip y de la tabla.

Las series dibujan siempre en un plano lógico (índice en X, valor en Y). En horizontal, el núcleo
lo refleja sobre su diagonal, así que un tipo nuevo funciona en las dos orientaciones sin cambios.

Además del plano cartesiano hay dos sistemas de coordenadas (`coords`):

- `'polar'`: el núcleo dibuja anillos, radios y etiquetas; la serie ubica sus puntos con
  `ctx.polar.point(i, valor)` (así lo hace el radar).
- `'free'`: sin ejes; la serie usa todo el área (`ctx.width`, `ctx.height`) y responde `hit` (qué
  dato hay bajo el puntero) y `anchor` (dónde apoyar el tooltip con el teclado).

`legendBy: 'points'` hace que la leyenda liste categorías (como el pie): cada una con
`ctx.pointColor(i)`, y las ocultas llegan en cero. `ctx.label(i)`, `ctx.format(v)`,
`ctx.percent(v)` y `ctx.measure(texto)` ayudan con las etiquetas, y `domainValues(opciones)` suma
valores fijos al dominio (como la meta del gauge).

## Reglas de diseño

Ver [DESIGN.md](DESIGN.md).
