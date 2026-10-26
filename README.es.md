# LozCharts

[English](https://github.com/MayraLo2ada/lozcharts/blob/main/README.md) · **Español** · [Português](https://github.com/MayraLo2ada/lozcharts/blob/main/README.pt.md)

LozCharts es una librería de gráficos para la web. Está escrita en TypeScript, dibuja en SVG (el
formato de imagen que se ve nítido a cualquier tamaño) y no necesita ninguna otra librería. Cada
gráfico que creas es un `LozChart`: le das tus datos y ya sale con tooltip (la cajita con el dato
al pasar el puntero), leyenda, modo claro y oscuro, animación, manejo con teclado y una tabla de datos para lectores de
pantalla. Todo eso que normalmente terminas programando aparte.

Tiene 26 tipos. Están las líneas y las barras de siempre, pero también velas, mapa de calor,
diagrama de flujos (sankey), cascada, línea de tiempo, nube de palabras, mapas y small multiples,
que son muchos gráficos pequeños con la misma escala (la lista completa está en
[Tipos de serie](#tipos-de-serie)). Trae zoom, anotaciones, etiquetas al final de cada línea,
descarga como imagen PNG o SVG y como hoja CSV, y componentes para React y para Angular, Vue o
Svelte.

## Instalar

En un proyecto con npm:

```bash
npm install lozcharts
```

```js
import { LozChart } from 'lozcharts';
import { Chart } from 'lozcharts/react'; // si usas React
import 'lozcharts/maps/world'; // solo si haces mapas
```

Sin npm, con un `<script>` desde la red de distribución gratuita de npm, o bajando el archivo a
tu proyecto:

```html
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
<!-- Solo si haces mapas: -->
<script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/maps/world.umd.js"></script>
```

`@1` te da siempre la última versión 1.x, que nunca rompe lo que ya funciona. Si prefieres fijar
una versión exacta, escribe por ejemplo `@1.1.0`.

## Tu primer gráfico

Copia esto en un archivo `ventas.html` y ábrelo con doble clic. No necesitas instalar nada:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Mi primer gráfico</title>
  </head>
  <body>
    <div id="grafico"></div>
    <script src="https://cdn.jsdelivr.net/npm/lozcharts@1/dist/lozcharts.umd.js"></script>
    <script>
      new LozChart('#grafico', {
        title: 'Ventas por mes',
        data: [
          { mes: '2026-01', ventas: 42000 },
          { mes: '2026-02', ventas: 45500 },
          { mes: '2026-03', ventas: 51200 },
        ],
        xAxis: { field: 'mes', type: 'time' },
        yAxis: { format: 'currency' },
        series: [{ type: 'bar', field: 'ventas', name: 'Ventas' }],
      });
    </script>
  </body>
</html>
```

Eso es todo: los datos son una lista de filas, `xAxis.field` dice qué campo va en el eje X y cada
serie dice su `type` y su `field`. El tooltip, el teclado, el modo oscuro y la tabla para lectores
de pantalla ya vienen.

## Tres formas de usarla

**1. Con `<script>`.** No necesitas servidor ni compilar nada: pones el archivo junto a tu página y creas
el gráfico.

```html
<div id="grafico"></div>
<script src="lozcharts.umd.js"></script>
<script>
  new LozChart('#grafico', {/* opciones */});
</script>
```

**2. Con `import` (Vite, webpack, Angular CLI) o `require` (Node, Jest).** Acuérdate de llamar a `destroy()`
cuando desmontes el componente. En React no tienes que hacerlo a mano si usas los componentes de
`lozcharts/react` (ver [React](#react)), y en Angular, Vue o Svelte tienes el elemento
`<loz-chart>` (ver [`<loz-chart>`](#loz-chart-angular-vue-svelte-o-html-puro)).

```js
import { LozChart } from 'lozcharts'; // o: const { LozChart } = require('lozcharts');
const chart = new LozChart(elemento, opciones);
// al desmontar el componente:
chart.destroy();
```

`LozChart` dibuja en la página, así que necesita un navegador (o un DOM de pruebas, como jsdom en
Jest). En Node sin DOM puedes importarla, pero no crear gráficos.

**3. Con Django + HTMX.** Pon las opciones en JSON en el atributo `data-lozchart`, o el selector de
un `<script type="application/json">`. Luego vuelve a iniciar los gráficos cada vez que HTMX cambie
un fragmento:

```html
<div data-lozchart="#opciones-ventas"></div>
{{ opciones|json_script:"opciones-ventas" }}
<script>
  htmx.onLoad((el) => LozChart.initAll(el));
  document.body.addEventListener('htmx:beforeSwap', (e) => LozChart.destroyAll(e.detail.target));
</script>
```

Si el elemento ya tenía un gráfico, `initAll` lo reemplaza, y de paso limpia los que quedaron
fuera de la página. En `examples/django` hay un ejemplo completo (vista, URL y plantillas), y en
`examples/htmx/index.html` otro que abres sin Django.

## Ejemplo completo

Este gráfico tiene lo que más vas a usar: barras apiladas, una línea de meta, formato de moneda y
la leyenda abajo. Los comentarios dicen qué otros valores acepta cada opción.

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
    { type: 'bar', field: 'online', name: 'En línea', stack: true },
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

<!-- vivo: ejemplo -->

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
| LozDonut     | `donut`       | Como el pastel, con el total al centro           | igual que `pie`; `innerRadius` (0,6)                             |
| LozGauge     | `gauge`       | Un indicador contra su rango y su meta           | `field`; `target`; rango con `yAxis.min` y `yAxis.max`           |
| LozBullet    | `bullet`      | Indicadores contra su meta y sus rangos          | `xAxis.field` (indicador), `field`; `targetField`, `ranges`      |
| LozRadar     | `radar`       | Perfiles en varias dimensiones                   | `xAxis.field` (criterio), `field` por serie                      |
| LozFunnel    | `funnel`      | Pasos de un proceso y su conversión              | `xAxis.field` (paso), `field` (cantidad)                         |
| LozWaterfall | `waterfall`   | Cómo se llega de un número a otro (puente)       | `field` (variación); `total` marca subtotales y totales          |
| LozHeatmap   | `heatmap`     | Patrones en una rejilla (día × hora)             | `xAxis.field` (columna), `y` (fila), `field` (valor)             |
| LozTreemap   | `treemap`     | Partes de un todo con muchas categorías          | `xAxis.field` (nombre), `field` (tamaño); `group` opcional       |
| LozSunburst  | `sunburst`    | Jerarquía en anillos (región › país › ciudad)    | `field` (valor); `levels` con los campos de la ruta              |
| LozSankey    | `sankey`      | Flujos entre etapas (de dónde a dónde)           | `xAxis.field` (origen), `to` (destino), `field` (cantidad)       |
| LozChord     | `chord`       | Flujos con dirección entre nodos                 | `xAxis.field` (origen), `to` (destino), `field` (cantidad)       |
| LozNetwork   | `network`     | Relaciones sin dirección (quién con quién)       | `xAxis.field`, `to`; `field` (peso) y `group` opcionales         |
| LozTimeline  | `timeline`    | Tramos e hitos en el tiempo                      | `xAxis.field` (inicio), `end` (fin), `field` (nombre); `group`   |
| LozWordcloud | `wordcloud`   | Palabras según su peso                           | `xAxis.field` (palabra), `field` (peso); `group` opcional        |
| LozMap       | `choropleth`  | Un valor por país, coloreado                     | `xAxis.field` (país), `field`; ver [Mapas](#mapas)               |
| LozMap       | `mapbubble`   | Cantidades sobre el mapa                         | `xAxis.field`, `field`; `lat` y `lon` opcionales                 |
| LozMultiples | —             | Cuadrícula de gráficos pequeños                  | `LozChart.multiples(…)`; ver [Small multiples](#small-multiples) |

LozBar, LozLine y los demás son los nombres que uso en esta documentación y en la galería. En el
código cada tipo va por su nombre corto: `type: 'bar'`.

El pastel (`pie`), la dona (`donut`), el medidor (`gauge`) y el embudo muestran una sola serie. En
el pastel y la dona, cada categoría lleva su
color y su botón en la leyenda, con su porcentaje; si ocultas una, los porcentajes de las demás se
recalculan. Con más de 8 categorías, las 7 primeras van en color y el resto se suma en "Otros", con
el detalle en el tooltip y en la tabla.

Mi consejo: si pasas de 5 categorías, cambia el pastel por barras horizontales ordenadas. Se leen
mucho mejor.

Las etiquetas se reparten para no encimarse. En pantallas angostas se omiten, porque la leyenda y
el tooltip ya dicen lo mismo, y `labels: false` las apaga siempre. Si necesitas varios medidores
o varios embudos, usa small multiples.

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

<!-- vivo: categorias -->

<!-- vivo: meta -->

Para precios tienes velas (`candlestick`) y barras OHLC (`ohlc`, por sus siglas en inglés: open,
high, low, close). Cada fila trae apertura, máximo, mínimo y cierre, y en la serie dices cómo se
llama cada campo.

¿Barras con nombres largos? Pon `orientation: 'horizontal'`: el gráfico gira y las categorías pasan
al eje vertical, donde caben enteras.

```js
new LozChart('#precios', {
  data: sesiones, // { fecha, apertura, maximo, minimo, cierre }
  xAxis: { field: 'fecha', type: 'time' },
  yAxis: { format: 'currency' },
  series: [{ type: 'candlestick', field: 'cierre', open: 'apertura', high: 'maximo', low: 'minimo', name: 'AURF' }],
});
```

## Mapa de calor, treemap y sankey

Los tres esperan una fila de datos por cosa dibujada: una celda, un rectángulo o un flujo.

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

<!-- vivo: calor -->

El **mapa de calor** usa un solo tono, de la superficie al color de la serie, mezclado en OKLab
para que los pasos de claridad sean parejos. Si hay negativos, la escala pasa a ser divergente y
simétrica alrededor del cero. La leyenda de color va arriba a la derecha, y con las flechas recorres
la rejilla en las dos direcciones. Si una celda viene repetida, se dibuja la última y la tabla lo
avisa.

En el **treemap** uso el algoritmo _squarified_, que deja los rectángulos lo más cuadrados posible
porque así se comparan mejor. El texto de cada rectángulo toma el color de mayor contraste con su
relleno. Con `group`, cada grupo lleva un color de la paleta y su título; si hay más de 8 grupos,
van en gris.

El **sankey** arma las columnas con el camino más largo desde cada origen y ordena los nodos para
que se crucen lo menos posible. Cada flujo lleva el color de su origen. Si tus datos tienen un
ciclo, el flujo que lo cierra no se dibuja y te avisa en la consola. El tooltip dice qué parte del
origen y del destino representa cada flujo.

## Cascada, bala y línea de tiempo

```js
// Cascada: cada fila es una variación; las marcadas en `total` parten del cero.
new LozChart('#resultado', {
  title: 'De las ventas a la utilidad',
  data: [
    { paso: 'Ventas', monto: 1200 },
    { paso: 'Costo de ventas', monto: -500 },
    { paso: 'Utilidad bruta', total: true },
    { paso: 'Gastos', monto: -300 },
    { paso: 'Impuestos', monto: -135 },
    { paso: 'Utilidad neta', total: true },
  ],
  xAxis: { field: 'paso' },
  series: [{ type: 'waterfall', field: 'monto', name: 'Resultado', total: 'total' }],
});

// Bala: una fila por indicador, con su meta y los rangos de calidad de fondo.
new LozChart('#kpi', {
  title: 'Ventas del trimestre por región',
  data: [
    { region: 'Norte', ventas: 512, meta: 480 },
    { region: 'Sur', ventas: 297, meta: 420 },
  ],
  xAxis: { field: 'region' },
  series: [{ type: 'bullet', field: 'ventas', name: 'Ventas', targetField: 'meta', ranges: [300, 450, 600] }],
});

// Línea de tiempo: cada fila va de la X a `end`; sin fin es un hito.
new LozChart('#plan', {
  title: 'Lanzamiento 2026',
  data: [
    { tarea: 'Investigación', inicio: '2026-01-12', fin: '2026-02-27', equipo: 'Producto' },
    { tarea: 'App móvil', inicio: '2026-04-20', fin: '2026-08-28', equipo: 'Ingeniería' },
    { tarea: 'Lanzamiento', inicio: '2026-09-15', equipo: 'Marketing' },
  ],
  xAxis: { field: 'inicio', type: 'time' },
  series: [{ type: 'timeline', field: 'tarea', end: 'fin', group: 'equipo', name: 'Plan', today: true }],
});
```

<!-- vivo: resultado -->

<!-- vivo: kpi -->

<!-- vivo: plan -->

En la **cascada**, al eje van los acumulados. Por eso puede cruzar el cero sin problema, y una
bajada grande no estira la escala. Las subidas van rellenas, las bajadas huecas y los totales en
gris. La punta apunta hacia donde se movió el acumulado y la etiqueta lleva el signo, así que nunca
dependes de distinguir el verde del rojo. Un total sin valor muestra el acumulado. Si le das un
valor, manda ese; y si no cuadra, te avisa en la consola y el tooltip da la diferencia.

La **bala** (el gráfico de metas) tiene una sola escala para todas las filas, porque los rangos valen para todas. Si tus
indicadores tienen unidades distintas, haz un gráfico por indicador. Los rangos van en grises, más
intensos cuanto peor, nunca en semáforo. El tooltip da la meta, la diferencia (con signo y en %) y
el rango en que cae el valor. Va una serie por gráfico.

En la **línea de tiempo**, el nombre de cada tramo sale de `label` o, si no lo das, de `field`. Con
`group` tienes un carril por grupo, cada uno con su color. Sin grupos, los tramos que se solapan
bajan a otra fila, y se usan las menos filas posibles. El eje va de horas a siglos según el rango,
sin bajar de la precisión de tus datos. El tooltip da el rango y la duración ("4 meses y 8 días")
en el idioma del gráfico (`locale`).

`today: true` marca el día de hoy con una línea vertical discontinua y su texto arriba. Si le pasas
una fecha (`today: '2026-06-30'`), marca esa. Y si un tramo termina antes de empezar, lo invierte y
te avisa en la consola.

## Sunburst, cuerdas, red y nube de palabras

```js
// Sunburst: cada fila es una hoja con su ruta; los nodos interiores suman a sus hijos.
new LozChart('#ventas', {
  data: ventas, // { region: 'América', pais: 'México', ciudad: 'Monterrey', ventas: 182000 }
  xAxis: { field: 'ciudad' },
  series: [{ type: 'sunburst', field: 'ventas', name: 'Ventas', levels: ['region', 'pais', 'ciudad'] }],
});

// Cuerdas: una fila por flujo con dirección, de `xAxis.field` a `to`.
new LozChart('#migracion', {
  title: 'Mudanzas entre regiones',
  data: mudanzas, // { origen: 'Capital', destino: 'Centro', personas: 182 }
  xAxis: { field: 'origen' },
  series: [{ type: 'chord', field: 'personas', name: 'Personas', to: 'destino' }],
});

// Red: una fila por vínculo; sin destino, solo declara el nodo.
new LozChart('#equipo', {
  title: 'Quién trabaja con quién',
  data: mensajes, // { persona: 'Ana', con: 'Luis', mensajes: 8, area: 'Diseño' }
  xAxis: { field: 'persona' },
  series: [{ type: 'network', field: 'mensajes', name: 'Mensajes', to: 'con', group: 'area' }],
});

// Nube de palabras: el área de cada palabra va con su peso.
new LozChart('#nube', {
  title: '¿Qué destacan los clientes?',
  data: menciones, // { palabra: 'atención', menciones: 412, tema: 'Servicio' }
  xAxis: { field: 'palabra' },
  series: [{ type: 'wordcloud', field: 'menciones', name: 'Menciones', group: 'tema' }],
});
```

El **sunburst** (anillos por niveles) empieza arriba y avanza en el sentido del reloj, con los hermanos de mayor a menor.
Cada rama de primer nivel lleva su color, y los anillos de afuera lo heredan en tonos más claros.
Sin `levels` queda un solo anillo, como una dona. Al pasar el puntero se resalta la ruta hasta la
raíz. Con el teclado, ← → recorren y ↑ ↓ suben o bajan de nivel.

En las **cuerdas**, cada nodo es un arco (lo que sale más lo que entra) y cada flujo es una cinta
del color de su origen. El extremo de destino queda separado del arco, y así A → B no se confunde
con B → A. Los arcos van en el orden de tus datos, así que ordénalos tú. Los bucles, de un nodo a sí
mismo, no se dibujan.

La **red** no tiene dirección: A → B y B → A suman al mismo vínculo. El acomodo es por fuerzas y
determinista, o sea que los mismos datos dan siempre el mismo dibujo. El área de cada nodo va con su
grado y el grosor de cada vínculo con su peso; sin `field`, cuenta vínculos. El teclado y el tooltip
hablan de nodos y mencionan sus vecinos principales.

La **nube de palabras** pone todas las palabras horizontales, para que se lean. Las repetidas se
suman. Lo que no cabe se omite empezando por las más livianas, con un aviso en la consola, y sigue
en la tabla. El color de cada palabra se ajusta para llegar a 4,5:1 contra el fondo.

En estos cuatro tipos, los valores cero, negativos o vacíos no se dibujan, pero la tabla de datos
los lista igual. `labels: false` quita las etiquetas.

## Mapas

Los contornos de los países pesan unos 110 KB, así que van en un archivo aparte. Solo lo cargas si
vas a hacer mapas.

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

<!-- vivo: usuarios -->

- Cada país lo puedes escribir con su código ISO de 3 letras, con el numérico o con su nombre en
  inglés o en español. No importan las mayúsculas ni los acentos. Si alguno no aparece, te avisa en
  la consola.
- `fit: 'data'` encuadra solo los países que tienen datos, para mostrar una región. Sin esa opción
  ves el mundo entero, menos la Antártida.
- La proyección por defecto (`projection`) es `'equalEarth'`, de áreas iguales: la honesta para
  colorear países. `'mercator'` es la de los mapas web, que infla los países del norte.
- `mapbubble` pone un círculo por fila, con el área proporcional al valor, en su `lat` y `lon` o en
  el centro del país.
- Para otro mapa, regístralo con `LozChart.registerMap('colombia', topojsonOGeojson)` y pon
  `map: 'colombia'` en la serie. Sirve cualquier TopoJSON o GeoJSON de polígonos en longitud y
  latitud.
- Los contornos vienen de Natural Earth 1:110m (dominio público), empaquetados por world-atlas
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

`Chart` recibe las opciones del gráfico como props, más `className`, `style` e `id` para el
contenedor. `Multiples` hace lo mismo con small multiples.

Lo único que tienes que cuidar son los datos. Se comparan por referencia: si cambian, el gráfico
anima desde lo que se está viendo. Usa `useMemo` para no crear un arreglo nuevo en cada render. Las
demás opciones se comparan por contenido, así que escribirlas en línea no vuelve a dibujar nada si
no cambiaron.

- `onHover`, `onZoom` y las demás funciones siempre llaman a su versión más reciente.
- El `ref` te da la instancia de `LozChart` (o `LozMultiples`) con todos sus métodos.
- Hay un ejemplo completo en `examples/react`: corre `npm run example:react` y abre
  `examples/react/index.html`.

## `<loz-chart>`: Angular, Vue, Svelte o HTML puro

`<loz-chart>` es un elemento HTML estándar (un Custom Element), así que funciona con cualquier
framework, sin adaptador. Si cargas `<script src="lozcharts.umd.js">`, ya queda registrado; con
módulos, importa `'lozcharts/element'`.

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

- Las opciones van en el atributo `options` (como JSON) o en la propiedad `options` (como objeto).
  Si solo cambian los datos, el gráfico anima con `setData`; si cambia otra cosa, con `setOptions`.
  Con `facet` crea small multiples.
- Emite `lozhover`, `lozzoom` y `lozclick`. En `event.detail` viene la X activa, el tramo visible o
  `{ x, index, series }` del dato pulsado. Con `facet` (small multiples) no emite eventos.
- `elemento.chart` es la instancia, con todos sus métodos. Cuando quitas el elemento de la página,
  el gráfico se destruye solo, así que dentro de fragmentos HTMX no necesitas `initAll`.

En Vue, dile al compilador que `loz-chart` es un elemento propio de la página y no un componente;
si no, funciona igual pero te avisa en la consola con "Failed to resolve component":

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
  <loz-chart :options="opciones" @lozclick="(e) => console.log(e.detail)"></loz-chart>
</template>
```

## TypeScript

Los tipos vienen en el paquete y funcionan con cualquier `moduleResolution` (`bundler`, `node16`,
`nodenext` o el antiguo `node`). Si escribes una opción que no existe o con un error de tipeo
(`heigth`, `smoth`, `theme: 'oscuro'`), el editor te lo marca y te sugiere la buena.

```ts
import { LozChart, type LozChartOptions, type SeriesOptions } from 'lozcharts';

const series: SeriesOptions[] = [{ type: 'line', field: 'ventas', name: 'Ventas' }];
const opciones: LozChartOptions = { data: filas, xAxis: { field: 'mes', type: 'time' }, series };
const grafico: LozChart = new LozChart('#grafico', opciones);
```

Tus filas pueden tener su propio tipo, con `interface` o con `type`
(`interface Venta { mes: string; ventas: number }`), y `type` de cada serie te sugiere los 26
tipos mientras escribes.

En un proyecto CommonJS (`require`) los tipos son los mismos y se importan igual que arriba.

## LozCharts con IA

Si le pides gráficos a ChatGPT, Claude o Copilot, dile que use LozCharts y pásale el archivo
[llms.txt](llms.txt). Es una sola página con todo lo que existe (tipos, opciones y métodos) y las
reglas para escribir código que funcione. Con eso no se inventa opciones, y no tienes que pedirle
zoom, leyenda, modo oscuro ni accesibilidad: ya vienen hechos. Si usas TypeScript, los tipos de
`lozcharts` además te marcan cualquier opción que no exista.

Algo así basta:

```text
Usa LozCharts; todo lo que necesitas saber está en llms.txt (te lo adjunto).
Quiero barras apiladas con las ventas por mes, en línea y en tienda, en dólares,
y una línea con la meta mensual.
```

## Muchos datos

Puedes darle 100 000 puntos a una línea. Líneas, áreas, escalones y rangos dibujan solo lo que se
ve, y cuando hay más de dos datos por píxel se quedan con el primero, el mínimo, el máximo y el
último de cada columna de píxeles. El trazo se ve igual, ningún pico se pierde y el gráfico se crea
en unos 40 ms. Con `zoom` exploras series largas sin perder detalle.

La tabla para lectores de pantalla muestra las primeras 500 filas y avisa que hay más. Para tener
todos los datos, usa `download('csv')` o `toCSV()`.

<!-- vivo: muchos -->

## Small multiples

Si tienes más de 4 o 5 series, no las metas en un solo gráfico: se enredan. Haz small multiples,
que son muchos gráficos pequeños con la misma escala, uno por serie o uno por cada valor de un
campo. También sirven para comparar la forma de varias categorías.

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
    { type: 'area', field: 'online', name: 'En línea', stack: true },
    { type: 'area', field: 'tienda', name: 'Tienda', stack: true },
  ],
});
```

<!-- vivo: ciudades -->

Todos los paneles comparten el eje del valor (`sharedY: false` lo desactiva) y las mismas X. Si a
un panel le falta un mes, ese mes queda como hueco. El área de datos mide lo mismo en todos, así que
se comparan de un vistazo.

- Los números del eje salen solo en la primera columna, y las etiquetas X solo en el último panel
  de cada columna. Se recalcula cuando cambia el ancho.
- Si un panel tiene barras, todos usan escala de banda y los números del eje reservan el mismo
  ancho: cada fecha cae en la misma vertical en todos los paneles.
- El puntero sobre un panel marca el mismo dato en todos. Hay una sola leyenda (solo al facetar por
  campo), y ocultar una serie la oculta en todos los paneles.
- `columns` fija el número de columnas. Si no lo das, caben las que permita `minWidth` (240 px por
  defecto).
- Con `facet: 'series'`, `context: true` dibuja en cada panel las demás series en gris, detrás de
  la suya.
- Las `annotations` se dibujan en todos los paneles, por ejemplo una meta común.
- Métodos: `setData`, `setOptions`, `setTheme`, `toggleSeries`, `toSVG`, `toCSV`, `download`,
  `destroy` y `charts` (los gráficos de cada panel). En HTMX, `initAll` los crea si el JSON trae
  `facet`.

## Dos medidas con distintas unidades

Con dos ejes Y, quien hace el gráfico decide dónde se cruzan las líneas. Basta mover un eje para
que una medida "alcance" a la otra, y quien lo lee saca conclusiones que los datos no dicen. Por
eso te propongo tres caminos, del que más recomiendo al que menos.

**Paneles alineados.** Es mi favorito. Cada medida va en su panel y con sus unidades. Comparten el
eje X, las áreas de datos quedan alineadas al píxel y el puntero se mueve en los dos a la vez.

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

**Índice base 100.** Úsalo cuando la pregunta es cuál creció más. LozCharts divide cada serie por
su primer valor y la multiplica por 100; así las dos quedan en la misma unidad y comparten eje. El
tooltip muestra el índice y también el valor original.

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

**Doble eje, con salvaguardas.** Déjalo para cuando de verdad lo necesites, por ejemplo porque tu
público ya lo espera. `axis: 'right'` lleva una serie al eje derecho y `yAxis2` configura ese eje.
LozCharts se encarga de que los dos ejes empiecen en cero, de que el cero quede a la misma altura,
de que las líneas de la rejilla coincidan (para eso elige el paso del eje derecho) y de que la
leyenda diga "(eje derecho)". No funciona en modo índice ni en horizontal.

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

<!-- vivo: zoom -->

El **zoom** (`zoom: true`) funciona en gráficos verticales con ejes X e Y (cartesianos). Arrastra sobre el gráfico
para marcar un tramo y acercarlo. Ctrl + rueda, o pellizcar en el panel táctil, acerca y aleja bajo el
puntero; Shift + rueda, o deslizar de lado, mueve la ventana, y doble clic vuelve a todo. En una
pantalla táctil, con dos dedos pellizcas y mueves, y con uno sigues recorriendo los datos con el
tooltip. La rueda sola sigue moviendo la página: el gráfico no te la secuestra. Al acercar,
el eje del valor se ajusta a lo que se ve.

Debajo aparece un deslizante delgado: una línea con el tramo visible marcado y una perilla redonda en
cada extremo. Puedes arrastrar el tramo o sus perillas, hacer clic en la línea para centrar ahí la
ventana, o moverla con el teclado. `zoom: { scrollbar: 'mini' }` lo cambia por una barra con un mini
gráfico de todos los datos, `zoom: { scrollbar: false }` lo quita, y `zoom: { reset: false }` quita
el botón "Ver todo", por si pones tu propio control. Con el foco en el gráfico, + y − acercan y
alejan, 0 vuelve a todo, y si con las flechas llegas a un dato fuera de la ventana, la ventana lo
sigue.

El **zoom en el eje Y** (`zoom: { y: true }`) suma otro deslizante delgado, de pie a la izquierda del
eje Y, con el inicio abajo. Su ventana es una fracción del eje con todos los datos: el eje muestra
ese tramo con marcas redondas, y lo que queda fuera se corta en el borde del área. Con él, el eje del
valor ya no se ajusta solo a la ventana de X: manda el deslizante. Arrastrar sobre el gráfico marca
un rectángulo y acerca los dos ejes (un arrastre casi plano acerca solo uno), y Ctrl + rueda sobre
los números del eje Y acerca solo Y. Doble clic, 0, "Ver todo" y `resetZoom()` vuelven a todo en los
dos ejes. `zoom: { x: false, y: true }` deja el zoom solo en Y. Funciona en gráficos con eje Y
numérico, lineal o logarítmico, en vertical; en los demás se ignora.

```js
new LozChart('#sensor', { ...opciones, zoom: { y: true }, onZoom: (rango, x, y) => console.log(y) }); // y: { start, end }
```

Si tienes varios gráficos con el mismo eje, como precio arriba y volumen abajo, puedes mover el zoom
de todos a la vez. `onZoom` recibe también la ventana exacta en fracciones del eje, y
`setZoomWindow` la pone en otro gráfico sin redondear a un dato. Los dos tienen que compartir el eje
X y la clase de escala: de barras los dos, o continua los dos.

```js
const precio = new LozChart('#precio', { ...opciones, zoom: true, onZoom: (rango, ventana) => volumen.setZoomWindow(ventana) });
const volumen = new LozChart('#volumen', { ...otras, zoom: { scrollbar: false, reset: false } });
```

Cada **anotación** (`annotations`) lleva `x` o `y`. Con un valor dibuja una línea de referencia, y
con dos, una franja. `x` acepta categorías, fechas o números; `y` acepta números (con
`axis: 'right'` para el eje derecho). El eje se amplía para que una meta siempre se vea. Las franjas
van detrás de los datos y las líneas con sus textos, encima. Si dos textos chocarían, uno se corre.

Con **etiquetas al final** (`endLabels: true`), el nombre de cada línea, área o escalón va a la
derecha, a la altura de su último dato visible; `{ value: true }` agrega el último valor. Las que
chocan se reparten sin alejarse de su dato más de lo necesario, y con zoom siguen al último dato de
la ventana.

El **énfasis** (`emphasis: 'Bogotá'` o una lista) deja las series nombradas en su color y encima, y
las demás en gris como contexto. En small multiples por serie, `context: true` hace lo mismo en cada
panel: su serie en color y las demás en gris detrás.

## Opciones

| Opción                       | Tipo                                           | Por defecto                     | Qué hace                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `subtitle`          | texto                                          | —                               | Encabezado del gráfico (también va en la exportación).                                                                                                                      |
| `data`                       | arreglo de objetos                             | —                               | Una fila por punto.                                                                                                                                                         |
| `xAxis.field`                | texto                                          | —                               | Campo de la posición X.                                                                                                                                                     |
| `xAxis.type`                 | `'category'` `'time'` `'linear'`               | `'category'`                    | Fechas aceptan `Date`, milisegundos o texto (`'2026-03'` se lee en hora local).                                                                                             |
| `xAxis.format`               | formato u opciones de `Intl.DateTimeFormat`    | automático                      | Etiquetas del eje X.                                                                                                                                                        |
| `xAxis.title`, `yAxis.title` | texto                                          | —                               | Títulos de los ejes.                                                                                                                                                        |
| `yAxis.format`               | ver abajo                                      | `'auto'`                        | Formato del eje Y y del tooltip.                                                                                                                                            |
| `yAxis.min`, `yAxis.max`     | número                                         | calculados                      | Límites fijos.                                                                                                                                                              |
| `yAxis2`                     | `{ format, title, min, max }`                  | —                               | Eje derecho para las series con `axis: 'right'`.                                                                                                                            |
| `series[].axis`              | `'left'` `'right'`                             | `'left'`                        | Eje del valor de la serie.                                                                                                                                                  |
| `yAxis.index`                | booleano                                       | `false`                         | Índice base 100: cada serie respecto de su primer valor.                                                                                                                    |
| `yAxis.width`                | px                                             | —                               | Ancho mínimo para los números del eje; alinea varios gráficos.                                                                                                              |
| `xAxis.labels`               | booleano                                       | `true`                          | `false` oculta las etiquetas del eje X.                                                                                                                                     |
| `xAxis.band`                 | booleano                                       | `false`                         | Fuerza la escala de banda (puntos al centro de su franja), para alinear con barras.                                                                                         |
| `xAxis.grid`                 | booleano                                       | con fechas o números, `true`    | Líneas verticales de la rejilla en cada marca del eje X. Con categorías no van, salvo que las pidas.                                                                        |
| `yAxis.labels`               | booleano                                       | `true`                          | `false` oculta los números del eje (la rejilla queda).                                                                                                                      |
| `yAxis.zero`                 | booleano                                       | `false`                         | Fuerza el cero (barras y áreas ya lo incluyen).                                                                                                                             |
| `yAxis.type`                 | `'linear'` `'log'`                             | `'linear'`                      | Escala logarítmica: marcas en 1, 2 y 5 × 10ⁿ; solo cuentan los valores positivos y no hay cero.                                                                             |
| `yAxis.grid`                 | booleano                                       | `true`                          | `false` quita la rejilla del valor (la línea del cero queda).                                                                                                               |
| `series[].type`              | ver [Tipos de serie](#tipos-de-serie)          | —                               | Tipo registrado.                                                                                                                                                            |
| `series[].field`             | texto                                          | —                               | Campo numérico.                                                                                                                                                             |
| `series[].name`              | texto                                          | el campo                        | Nombre visible; debe ser único.                                                                                                                                             |
| `series[].stack`             | `true` o texto                                 | —                               | Apila barras o áreas del mismo grupo. Positivos y negativos se apilan por separado.                                                                                         |
| `series[].smooth`            | booleano                                       | `false`                         | Curva monótona (línea y área).                                                                                                                                              |
| `series[].color`             | 1 a 8                                          | su posición                     | Lugar en la paleta.                                                                                                                                                         |
| `series[].visible`           | booleano                                       | `true`                          | Visible al inicio.                                                                                                                                                          |
| `series[].format`            | formato                                        | el del eje Y                    | Formato propio en el tooltip.                                                                                                                                               |
| `orientation`                | `'vertical'` `'horizontal'`                    | `'vertical'`                    | En horizontal, las categorías van en el eje vertical.                                                                                                                       |
| `theme`                      | `'light'` `'dark'` `'auto'`                    | `'auto'`                        | `auto` sigue al sistema y cambia en vivo.                                                                                                                                   |
| `palette`                    | arreglo de colores o `{ light, dark }`         | la de LozCharts                 | Colores propios en orden (máximo 8). Ver [Paleta propia](#paleta-propia).                                                                                                   |
| `height`                     | px                                             | `320`                           | Alto del área del gráfico con sus ejes (un tipo de serie puede pedir otro; el dado aquí manda).                                                                             |
| `legend`                     | `false` o `{ position: 'top' \| 'bottom' }`    | abajo                           | Solo aparece con 2 o más series.                                                                                                                                            |
| `tooltip`                    | booleano o `{ float }`                         | `true`                          | `false` apaga tooltip y puntero; `{ float: false }` quita solo el recuadro (queda todo lo demás).                                                                           |
| `animate`                    | booleano                                       | `true`                          | `false` dibuja sin animación.                                                                                                                                               |
| `locale`, `currency`         | texto                                          | el `lang` de la página, `'USD'` | Idioma de los textos de la librería (`'es'`, `'en'`, `'pt-BR'`) y de los números y fechas con `Intl`.                                                                       |
| `background`                 | booleano                                       | `true`                          | Pinta la superficie del tema detrás del gráfico.                                                                                                                            |
| `onHover`                    | función                                        | —                               | Recibe la X del dato activo (o null al salir), su índice de fila (−1) y su serie. Con `highlight(x)` sincroniza gráficos.                                                   |
| `selection`                  | arreglo de índices de fila                     | —                               | Datos seleccionados: se ven normal y los demás quedan atenuados. Ver `select()`.                                                                                            |
| `zoom`                       | booleano o `{ range, x, y, scrollbar, reset }` | `false`                         | Zoom con un deslizante delgado (`scrollbar: 'mini'` para la barra con mini gráfico). `y: true` acerca también el eje Y. Ver [Zoom](#zoom-anotaciones-y-etiquetas-directas). |
| `onZoom`                     | función                                        | —                               | Recibe el primer y el último dato visibles (o null al ver todo), la ventana `{ start, end }` y la ventana Y.                                                                |
| `onClick`                    | función                                        | —                               | Clic, Enter o Espacio en un dato: recibe su X, su índice y la serie (o null si es de todas).                                                                                |
| `annotations`                | arreglo de `{ x \| y, label, axis }`           | —                               | Líneas de referencia (un valor) y franjas (dos valores).                                                                                                                    |
| `endLabels`                  | booleano o `{ value }`                         | `false`                         | Nombre (y valor) al final de cada línea, área o escalón.                                                                                                                    |
| `emphasis`                   | texto o arreglo                                | —                               | Series destacadas; las demás van en gris como contexto.                                                                                                                     |
| `ariaLabel`                  | texto                                          | automático                      | Descripción para lectores de pantalla.                                                                                                                                      |

Los formatos son `'auto'` (compacto desde mil: 0 / 1 mil / 2 mil), `'compact'`, `'number'`,
`'percent'` (los datos van como fracción: `0.25` = 25 %), `'currency'` o una función
`(v) => texto`. El formato cambia lo que ves en el eje; el tooltip siempre muestra el valor exacto.

## Idiomas

El gráfico habla español, inglés y portugués de Brasil: el tooltip, la leyenda, los botones, lo que
oye un lector de pantalla, la tabla de datos y los avisos de la consola. Elige el idioma así:

1. La opción `locale`, si la das (`'es'`, `'en'`, `'pt-BR'` o con región, como `'es-MX'`).
2. Si no, el idioma de la página (`<html lang="es">`).
3. Si tampoco, inglés.

`locale` decide también cómo se ven los números y las fechas: `'es-MX'` usa los textos en español
con los números de México.

¿Quieres otro idioma, o cambiar un solo texto? Regístralo:

```js
LozChart.registerLocale('fr', { chart: { showAll: 'Tout voir' } }); // lo que falte sale del inglés
LozChart.registerLocale('es', { chart: { showAll: 'Mostrar todo' } }); // cambia un texto
```

La lista completa de textos es el tipo `Messages` (en `src/core/i18n.ts`). Un tipo de serie propio
puede dar su nombre en cada idioma: `label: { es: 'diagrama de Gantt', en: 'Gantt chart', pt: 'gráfico de Gantt' }`.
El mapa del mundo encuentra los países por su código ISO o por su nombre en español, inglés o
portugués (`'Alemania'`, `'Germany'`, `'Alemanha'`, y formas comunes como `'EE. UU.'` o `'USA'`).

## Paleta propia

LozCharts trae su propia paleta de 8 colores, validada para daltonismo y con tonos pensados para el
modo oscuro. Si necesitas los colores de tu marca, pásalos en `palette`:

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
- Caben 8 colores como máximo, y ese número es también el de series que caben. Las que sobran se
  agrupan en "Otros" si están apiladas juntas; si no, se descartan con un aviso. Nunca se repite un
  color.
- Antes de usarla, revisa tu paleta con un simulador de daltonismo y mide el contraste. Los colores
  de una marca rara vez se pensaron para gráficos.

## Métodos

| Método                                                    | Qué hace                                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `setData(datos)`                                          | Cambia los datos y anima desde el estado actual (aunque haya una animación a medias).                                         |
| `options`                                                 | Opciones vigentes, con los valores por defecto (solo lectura).                                                                |
| `setOptions({...}, animar?)`                              | Combina opciones nuevas con las actuales y redibuja.                                                                          |
| `axisWidth`                                               | Ancho que necesitan hoy los números del eje Y (para alinear gráficos con `yAxis.width`).                                      |
| `highlight(x)`                                            | Marca el dato con esa X (o varios, con una lista), sin tooltip; `null` limpia.                                                |
| `highlightIndex(i)`                                       | Como `highlight`, por índice de fila o lista de índices (una celda de un mapa de calor).                                      |
| `select(índices)`, `selection`                            | Selecciona datos por índice (los demás se atenúan) y lo anuncia; `null` quita la selección.                                   |
| `zoomTo(desde, hasta)`, `resetZoom()`                     | Acerca el eje X a un tramo (con barras, incluye las categorías de los extremos) o vuelve a todo en los dos ejes.              |
| `zoomRange`                                               | Primer y último dato visibles con zoom, o null.                                                                               |
| `zoomWindow`, `setZoomWindow({ start, end } \| null)`     | La ventana exacta del zoom en fracciones del eje X, y fijarla (para sincronizar gráficos).                                    |
| `zoomYWindow`, `setZoomWindow(x, { start, end } \| null)` | La ventana del zoom en Y, en fracciones del eje desde abajo, y fijarla (pasa `chart.zoomWindow` como `x` para dejar X igual). |

| `redraw()` | Vuelve a dibujar con el estado actual, sin animar (para tipos cuyo dibujo cambia por fuera). |
| `setTheme('dark')` | Cambia el tema. |
| `toggleSeries('En línea', visible?)` | Oculta o muestra una serie; las demás conservan su color. |
| `toSVG()` | SVG completo como texto, con título y leyenda. |
| `toCSV()` | Los datos como CSV (números sin formato, fechas en ISO), para una hoja de cálculo. |
| `download('png' \| 'svg' \| 'csv', nombre?)` | Descarga la imagen (PNG al doble de resolución) o los datos en CSV. |
| `destroy()` | Quita el gráfico y deja de escuchar sus eventos. |
| `visibleSeries` | Nombres de las series visibles (las que no ocultaste en la leyenda). |
| `element` | El elemento de la página donde está el gráfico. |
| `LozChart.multiples(elemento, opciones)` | Crea small multiples. Ver [Small multiples](#small-multiples). |
| `LozChart.getChart(elemento)` | El gráfico que ya está montado en ese elemento (o en ese selector), si hay uno. |
| `LozChart.initAll(raíz)`, `destroyAll(raíz)`, `cleanup()` | Montaje automático para HTMX. |
| `LozChart.registerSeries(nombre, impl)` | Agrega un tipo de serie. |
| `LozChart.seriesTypes` | Los nombres de los tipos de serie registrados. |
| `LozChart.registerMap(nombre, topojsonOGeojson)` | Agrega un mapa para `choropleth` y `mapbubble`. |

Los métodos que cambian algo devuelven el mismo gráfico, así que puedes encadenarlos:
`chart.setTheme('dark').toggleSeries('Tienda', false)`.

### Cuando no hay datos

El gráfico se queda vacío, sin letrero: el mensaje lo decides tú. Mientras no tiene datos, su
elemento lleva el atributo `data-empty`, así que te basta una regla de CSS:

```css
#ventas[data-empty]::after {
  content: 'Todavía no hay ventas este mes.';
  display: grid;
  place-items: center;
  position: absolute;
  inset: 0;
  color: #52514e;
}
#ventas {
  position: relative;
}
```

Si prefieres hacerlo desde el código, pregunta por `chart.element.hasAttribute('data-empty')`
después de `setData`. Quien usa un lector de pantalla igual oye que el gráfico todavía no tiene
datos.

## Accesibilidad

No tienes que activar nada de esto: viene en cada gráfico.

<!-- vivo: teclado -->

- El SVG tiene `role="img"` y una descripción (`aria-label`).
- Con el foco en el gráfico, ← → (↑ ↓ en horizontal) recorren los datos, Inicio y Fin van a los
  extremos y Escape cierra el tooltip. Cada movimiento se anuncia a los lectores de pantalla.
- Cada gráfico lleva una tabla oculta con todos los datos. Con zoom también, porque el zoom cambia
  lo que se ve, no los datos.
- Con zoom, + − y 0 acercan, alejan y vuelven a todo. La barra de desplazamiento son tres controles
  deslizantes (la ventana y sus dos bordes) que se mueven con las flechas, Re Pág y Av Pág, e
  Inicio y Fin, y que anuncian el tramo visible. El botón "Ver todo" aparece al acercar.
- Las anotaciones con texto se leen en la descripción del gráfico ("Referencias: Meta diaria, 8
  mil").
- La leyenda son botones con `aria-pressed`.
- Respeta la preferencia del sistema de reducir el movimiento (`prefers-reduced-motion`).

## Cómo funciona por dentro

Si vas a tocar el núcleo, esto te ahorra leer el código de cero.

- **Escalas** (`core/scales.ts`). Convierten datos en píxeles. La Y es lineal, una regla de tres.
  La X es de **banda** si hay barras: el ancho se reparte en n franjas y cada serie usa el centro
  `x.at(i)`. Si no hay barras es **continua** y cada punto se ubica según su fecha real.
- **Marcas redondas del eje** (`core/ticks.ts`). El paso se redondea a 1, 2 o 5 × 10ⁿ y el dominio se
  extiende hasta múltiplos de ese paso. Para fechas elige el intervalo de calendario más fino (hora,
  día, mes, trimestre, año…) que deje espacio entre etiquetas.
- **Curva monótona** (`core/shapes.ts`). Suaviza sin inventar picos: donde los datos cambian de
  dirección la curva queda plana, y las tangentes se recortan para no pasarse.
- **Animación** (`chart.ts`). Cada estado es un "cuadro" con el dominio Y y la base y la punta de
  cada serie. Animar es interpolar entre el cuadro actual y el nuevo durante 600 ms, rápido al empezar y suave al llegar (ease-out). Si
  llega otro cambio a mitad de camino, parte del cuadro que se ve en ese momento.
- **Zoom** (`core/view.ts`). La ventana visible se guarda como fracciones del eje X, de 0 a 1. Así
  vale igual para barras, fechas y números, y no depende del ancho. Las escalas reciben la ventana y
  estiran el eje; lo que queda fuera cae fuera del área y el recorte lo esconde. Para el eje del
  valor solo cuentan los datos de la ventana, y ese cambio se anima en 220 ms para seguir al gesto.
- **Etiquetas sin choques** (`core/labels.ts`). Cada etiqueta quiere ir a la altura de su dato. Las
  que chocan forman un grupo centrado en el promedio de lo que pedían, y los grupos que chocan se
  juntan. Ninguna se aleja de su dato más de lo necesario.

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

Un tipo puede pedir columnas extra con `columns: (o) => ({ low: o.low })`, y le llegan animadas en
`frame.cols.low`. Si están en unidades del eje, nómbralas en `valueColumns` para que cuenten en el
dominio y se encojan al ocultar la serie. `pointer: 'nearest'` cambia la guía que sigue al puntero (crosshair) por "el
punto más cercano", y `tooltip(ps, i, format)` personaliza el texto del tooltip y de la tabla.

Las series dibujan siempre en un plano lógico, con el índice en X y el valor en Y. En horizontal, el
núcleo lo refleja sobre su diagonal, así que un tipo nuevo funciona en las dos orientaciones sin
cambios.

Además del plano cartesiano hay dos sistemas de coordenadas (`coords`):

- `'polar'`: el núcleo dibuja anillos, radios y etiquetas, y la serie ubica sus puntos con
  `ctx.polar.point(i, valor)`. Así lo hace el radar.
- `'free'`: sin ejes. La serie usa toda el área (`ctx.width`, `ctx.height`) y responde `hit` (qué
  dato hay bajo el puntero) y `anchor` (dónde apoyar el tooltip con el teclado).

Con `legendBy: 'points'` la leyenda lista categorías, como en el pie: cada una con
`ctx.pointColor(i)`, y las ocultas llegan en cero. `ctx.label(i)`, `ctx.format(v)`,
`ctx.percent(v)` y `ctx.measure(texto)` te ayudan con las etiquetas, y `domainValues(opciones)` suma
valores fijos al dominio (como la meta del gauge).

El resto del contexto y del contrato:

- `ctx.purpose` dice para qué se dibuja: `'screen'` (en la página), `'export'` (`toSVG` y las
  descargas) u `'overview'` (el mini gráfico de la barra del zoom, en gris y con la superficie
  transparente; ahí sobran etiquetas y detalles).
- `ctx.locale` y `ctx.currency` (también en el `format` del tooltip) son el idioma y la moneda del
  gráfico, para escribir fechas y textos con `Intl`.
- `ctx.siblings()` da los contextos de las series visibles del mismo tipo, para lo que varias series
  lado a lado deciden juntas: dos cascadas llevan etiquetas las dos o ninguna.
- `hit(ctx, px, py)` vale también en cartesiano, en px del plano lógico: el tipo dice qué dato hay
  bajo el puntero (−1: ninguno). Si ninguna serie con `hit` encuentra uno, el puntero sigue como
  siempre, salvo que todas las series visibles tengan `hit`.
- `click(ctx, i, evento)` recibe el clic en el dato i, o Enter y Espacio con el dato activo. Se
  llama a la serie bajo el puntero (con `hit`, o en `'free'`) o, si no se sabe cuál es, a cada serie
  visible que lo tenga. Después se llama a la opción `onClick` del gráfico.
- `preferredHeight(ps, ancho)` es el alto que pide la serie (ejes incluidos) cuando no le das
  `height`. Con varias series, gana el mayor.
- `derivedName`: con `derive`, cómo se llama el valor calculado (`'acumulado'`). `toCSV` lo usa si
  el nombre de la serie coincide con un campo que también exporta.
- Para la selección (la opción `selection` o `select()`), `ctx.isDimmed(i)` dice qué datos quedan
  atenuados. Un tipo con `dimmable: true` los dibuja con `DIM_OPACITY` (0,25): `dimOpacity(ctx, i)`
  da el atributo, `dimmed(ctx, i, markup)` envuelve un dato y `paintDimmed(ctx, (incluir) => …)`
  dibuja en dos pasadas un trazo que junta muchos datos (todas las barras en un path). Sin
  `dimmable`, el núcleo deja la serie como está y marca los seleccionados con `hover`.
- `chart.redraw()` vuelve a dibujar sin animar. Sirve para un tipo cuyo dibujo cambió por fuera de
  las opciones, como una imagen que terminó de prepararse.

El zoom funciona en gráficos cartesianos. Un tipo `'free'` con su propio eje de tiempo, como un
Gantt, no lo recibe, porque la ventana, los gestos, la barra de desplazamiento y el teclado se
apoyan en la escala del índice del núcleo. Ese tipo puede ofrecer su propio recorte de fechas con
sus opciones y `redraw()`.

**Piezas del núcleo para extensiones.** El paquete (y `window.LozChart` en la versión para
`<script>`) exporta lo mismo con que se dibujan los tipos de la librería: colores (`parseColor`,
`toHex`, `toOklab`, `fromOklab`, `mixOklab`, `luminance`, `contrast`, `textOn`, `inkFor`,
`colorDomain`, `makeRamp`, `paint`, `paintColor`, `legendSpec`, `legendWidth`, `MAX_COLORS`),
formatos (`valueFormatter`, `compactFormatter`, `axisFormatter`, `parseTime`, `timeTickLabel`,
`timeFullLabel`), marcas de eje (`niceStep`, `niceDomain`, `numberTicks`, `logTicks`, `logDomain`,
`chooseTimeInterval`, `timeTicks`, `detectTimeUnit`), escalas (`LinearScale`, `LogScale`,
`BandScale`, `ContinuousScale`), formas (`linePath`, `areaPath`, `barPath`, `stepPath`,
`polarPoint`, `r2`), la selección (`DIM_OPACITY`, `dimOpacity`, `dimmed`, `paintDimmed`) y `esc`,
`attrs`, `textWidth`, `fitText`, `toCSV`, `slug` y `swatchOf`.

## Compilar desde el código

Si quieres cambiar la librería o correr sus pruebas:

```bash
npm install
npm run build   # dist/: lozcharts.js (ESM), lozcharts.umd.js (UMD), react.js, maps/ y types/
npm test        # pruebas (node:test)
npm run check   # formato, tipos y pruebas: lo mismo que corre la integración continua
```

Después de compilar, abre `demo/index.html` con doble clic y tienes la galería. No hace falta
servidor. Para probar tus cambios en otro proyecto de tu máquina, instálala desde la carpeta:
`npm install ../lozcharts`. Queda enlazada a la carpeta, así que después de cada cambio corre
`npm run build` y recarga.

## Reglas de diseño

Las reglas fijas que siguen todos los tipos (nombres, paleta y medidas de cada marca) están en
[DESIGN.md](DESIGN.md).
