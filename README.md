# LozChart

Gráficos SVG interactivos, accesibles y sin dependencias, escritos en TypeScript.
Modo claro, oscuro y automático; tooltip, leyenda, teclado, animación y exportación a SVG/PNG.

> Estado: **fase 1** — líneas, barras (agrupadas y apiladas) y áreas.

## Instalación y build

```bash
npm install
npm run build   # dist/lozchart.js (ESM), dist/lozchart.umd.js (UMD) y dist/types
npm test        # pruebas del núcleo (ticks, formatos, curva monótona)
```

Abre `demo/index.html` con doble clic para ver la galería (después de `npm run build`).

## Tres formas de usarla

**1. Con `<script>` (sin servidor):**

```html
<div id="grafico"></div>
<script src="lozchart.umd.js"></script>
<script>
  new LozChart('#grafico', {/* opciones */});
</script>
```

**2. Con `import` (Vite, React, Angular):**

```js
import { LozChart } from 'lozchart';
const chart = new LozChart(elemento, opciones);
// al desmontar el componente:
chart.destroy();
```

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

## Opciones

| Opción                       | Tipo                                        | Por defecto     | Qué hace                                                                            |
| ---------------------------- | ------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `title`, `subtitle`          | texto                                       | —               | Encabezado del gráfico (también va en la exportación).                              |
| `data`                       | arreglo de objetos                          | —               | Una fila por punto.                                                                 |
| `xAxis.field`                | texto                                       | —               | Campo de la posición X.                                                             |
| `xAxis.type`                 | `'category'` `'time'` `'linear'`            | `'category'`    | Fechas aceptan `Date`, milisegundos o texto (`'2026-03'` se lee en hora local).     |
| `xAxis.format`               | formato u opciones de `Intl.DateTimeFormat` | automático      | Etiquetas del eje X.                                                                |
| `xAxis.title`, `yAxis.title` | texto                                       | —               | Títulos de los ejes.                                                                |
| `yAxis.format`               | ver abajo                                   | `'auto'`        | Formato del eje Y y del tooltip.                                                    |
| `yAxis.min`, `yAxis.max`     | número                                      | calculados      | Límites fijos.                                                                      |
| `yAxis.zero`                 | booleano                                    | `false`         | Fuerza el cero (barras y áreas ya lo incluyen).                                     |
| `series[].type`              | `'line'` `'bar'` `'area'` o propio          | —               | Tipo registrado.                                                                    |
| `series[].field`             | texto                                       | —               | Campo numérico.                                                                     |
| `series[].name`              | texto                                       | el campo        | Nombre visible; debe ser único.                                                     |
| `series[].stack`             | `true` o texto                              | —               | Apila barras o áreas del mismo grupo. Positivos y negativos se apilan por separado. |
| `series[].smooth`            | booleano                                    | `false`         | Curva monótona (línea y área).                                                      |
| `series[].color`             | 1 a 8                                       | su posición     | Slot de la paleta.                                                                  |
| `series[].visible`           | booleano                                    | `true`          | Visible al inicio.                                                                  |
| `series[].format`            | formato                                     | el del eje Y    | Formato propio en el tooltip.                                                       |
| `theme`                      | `'light'` `'dark'` `'auto'`                 | `'auto'`        | `auto` sigue al sistema y cambia en vivo.                                           |
| `palette`                    | arreglo de colores o `{ light, dark }`      | la de LozChart  | Colores propios en orden (máximo 8). Ver [Paleta propia](#paleta-propia).           |
| `height`                     | px                                          | `320`           | Alto del área del gráfico con sus ejes.                                             |
| `legend`                     | `false` o `{ position: 'top' \| 'bottom' }` | abajo           | Solo aparece con 2 o más series.                                                    |
| `tooltip`, `animate`         | booleano                                    | `true`          |                                                                                     |
| `locale`, `currency`         | texto                                       | `'es'`, `'USD'` | Para `Intl`.                                                                        |
| `background`                 | booleano                                    | `true`          | Pinta la superficie del tema detrás del gráfico.                                    |
| `ariaLabel`                  | texto                                       | automático      | Descripción para lectores de pantalla.                                              |

**Formatos:** `'auto'` (compacto desde mil: 0 / 1 mil / 2 mil), `'compact'`, `'number'`,
`'percent'` (los datos van como fracción: `0.25` = 25 %), `'currency'`, o una función
`(v) => texto`. El tooltip siempre muestra el valor exacto.

## Paleta propia

Por defecto LozChart usa su paleta de 8 colores, validada para daltonismo y con tonos propios para
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

| Método                                                    | Qué hace                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `setData(datos)`                                          | Cambia los datos y anima desde el estado actual (aunque haya una animación a medias). |
| `setOptions({...})`                                       | Combina opciones nuevas con las actuales y redibuja.                                  |
| `setTheme('dark')`                                        | Cambia el tema.                                                                       |
| `toggleSeries('Online', visible?)`                        | Oculta o muestra una serie; las demás conservan su color.                             |
| `toSVG()`                                                 | SVG completo como texto, con título y leyenda.                                        |
| `download('png' \| 'svg', nombre?)`                       | Descarga la imagen (PNG al doble de resolución).                                      |
| `destroy()`                                               | Quita el gráfico y sus listeners.                                                     |
| `LozChart.initAll(raíz)`, `destroyAll(raíz)`, `cleanup()` | Montaje automático para HTMX.                                                         |
| `LozChart.registerSeries(nombre, impl)`                   | Agrega un tipo de serie.                                                              |

## Accesibilidad

- El SVG tiene `role="img"` y una descripción (`aria-label`).
- Con el foco en el gráfico, ← → recorren los datos, Inicio/Fin van a los extremos y Escape cierra el tooltip.
  Cada movimiento se anuncia a los lectores de pantalla.
- Una tabla oculta con todos los datos acompaña a cada gráfico.
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

## Crear un tipo de serie

```js
LozChart.registerSeries('puntos', {
  legendSymbol: 'square',
  draw({ frame, color, x, y, n }) {
    let s = '';
    for (let i = 0; i < n; i++) {
      if (isFinite(frame.y1[i])) s += `<circle cx="${x.at(i)}" cy="${y.map(frame.y1[i])}" r="4" fill="${color}"/>`;
    }
    return s;
  },
});
```

## Reglas de diseño

Ver [DESIGN.md](DESIGN.md).
