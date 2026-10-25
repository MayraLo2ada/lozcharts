# Sistema de diseño de LozCharts

Reglas fijas para todos los tipos de gráfico. Los valores viven en `src/core/theme.ts`
(colores) y en cada serie (`src/series/*.ts`), no repetidos a mano.

## Nombres

Cada tipo tiene un nombre de la familia: LozLine, LozBar, LozArea, LozStep, LozRange, LozScatter,
LozBubble, LozCandle, LozOHLC, LozPie, LozDonut, LozGauge, LozRadar, LozFunnel y LozMultiples. En la galería aparecen como etiquetas de 12 px con
borde redondeado, en texto secundario (sin mayúsculas sostenidas). En el código, el tipo usa su
nombre corto (`type: 'bar'`).

## Paleta categórica "Coral" (orden fijo, validada para daltonismo)

| Slot       | Claro     | Oscuro    |
| ---------- | --------- | --------- |
| 1 coral    | `#e45934` | `#e05630` |
| 2 petróleo | `#009298` | `#0a999f` |
| 3 violeta  | `#5e2dad` | `#8b61e3` |
| 4 vino     | `#9c1854` | `#9d4e6b` |
| 5 cielo    | `#4c99f8` | `#4996f5` |
| 6 verde    | `#31983d` | `#399e43` |
| 7 rosa     | `#db6ea5` | `#d1649c` |
| 8 ocre     | `#e2aa00` | `#b88a06` |

Se diseñó en OKLCH y el orden se escogió con una búsqueda sobre todas las permutaciones:
primero importa que los colores que más se usan juntos (los primeros) se distingan entre todos,
no solo con su vecino. Validación (25 oct 2026, `validate_palette.js` de la skill dataviz):

- Las 8, par vecino: pasan luminosidad, croma, daltonismo (peor ΔE 12,7 en claro y 10,2 en
  oscuro; la anterior daba 9,1 y 8,4) y distinción normal.
- Los primeros 4, todos contra todos: pasan en los dos temas (daltonismo ΔE ≥ 9,5). Coral y
  verde, el par clásico que se confunde, quedan lejos: el verde va sexto.
- Con 5 o más series ninguna paleta de 8 separa todos los pares (tampoco la de amCharts ni la
  anterior). En oscuro, cielo y violeta quedan a ΔE 7 para daltonismo: por eso la leyenda, las
  etiquetas directas y la tabla son obligatorias, no adorno.
- En claro, cielo (2,83:1) y ocre (2,05:1) no llegan a 3:1 contra la superficie: van con el
  tooltip de valores exactos y la tabla de datos. En oscuro, las 8 pasan 3:1.
- El coral, primer color, es también el anillo de foco: 3,5:1 en claro.

- Nunca ciclar: con más de 8 series apiladas del mismo grupo, las sobrantes se agrupan en
  "Otros" (gris neutro); si no se pueden agrupar, se muestran 8 y se avisa en consola.
- El color sigue a la serie (su posición en `series`), no a su visibilidad.
- Esta es la paleta por defecto. La opción `palette` la reemplaza (máximo 8 colores, uno por
  tema si se quiere); las reglas de orden fijo y de no ciclar se mantienen.

## Superficies y texto

|                  | Claro     | Oscuro    |
| ---------------- | --------- | --------- |
| Superficie       | `#fcfcfb` | `#1a1a19` |
| Texto principal  | `#0b0b0b` | `#f0efec` |
| Texto secundario | `#52514e` | `#c3c2b7` |
| Rejilla          | `#e7e6e1` | `#2f2f2d` |
| Línea del cero   | `#a9a8a1` | `#64635e` |

El oscuro tiene sus propios valores; no es una inversión.

## Marcas

- Barras: máximo 24 px, punta de datos redondeada 4 px (solo el segmento exterior de una pila),
  base recta, 2 px de espacio entre vecinas y entre segmentos apilados.
- Líneas: 2 px, uniones y extremos redondeados. Suave = curva monótona.
- Áreas: relleno al 10 % del color de la serie y su línea encima.
- Puntos de hover: radio 4,5 px con anillo de 2 px del color de la superficie.
- Rejilla: 1 px sólida y discreta; la línea del cero un poco más marcada.
- Línea escalonada: mismo trazo que la línea; cambia de nivel en ángulo recto.
- Banda de rango: relleno al 16 %, sin borde; es contexto, no protagonista.
- Dispersión: puntos de 8 px con anillo exterior de 2 px del color de la superficie.
- Burbujas: el área (no el radio) es proporcional al valor; la mayor mide hasta 32 px de radio,
  al 75 % de opacidad; las grandes se dibujan primero para que las pequeñas queden encima.
- Velas: cuerpo de hasta 14 px; la vela que sube es hueca y la que baja es rellena, siempre del
  color de su serie (la dirección no depende de verde y rojo). Mecha de 1 px.
- OHLC: trazo de 1,5 px; marca de apertura a la izquierda y de cierre a la derecha.
- Barras horizontales: las categorías ocupan como máximo el 40 % del ancho y se recortan con "…".
- Pie y donut: empiezan arriba y avanzan en sentido horario, en el orden de los datos (ordénalos de
  mayor a menor). 2 px del color de la superficie entre porciones. Cada categoría tiene su color
  en el orden de la paleta; con más de 8, las 7 primeras llevan color y el resto (al menos dos) se
  suma en "Otros", en gris neutro, con su detalle en el tooltip y la tabla. Etiquetas afuera
  con guía de 1 px, separadas al menos 16 px; si no caben o achicarían el pie a menos del 60 %,
  no se dibujan. Donut: agujero de 0,6 y el total visible al centro en texto principal.
- Gauge: arco de 240° abierto abajo, grosor del 12 % del radio, pista en el color de la rejilla.
  El número va al centro en texto principal; la meta es una marca de 2 px en texto principal con
  halo de superficie.
- Radar: como un área (relleno al 10 % y borde de 2 px). Rejilla poligonal (circular con menos
  de 3 categorías), anillo del cero marcado y números del valor con halo de superficie.
- Embudo: barras rectas centradas (no trapecios: comparar largos es más preciso), del color de la
  serie, 2 px entre pasos; a la derecha el valor y la parte del inicio, y entre pasos la conversión.

## Texto

- Etiquetas de 12 px en texto secundario con números tabulares. Título 15 px/600, subtítulo 13 px.
- Los textos nunca van del color de la serie: la identidad la da una muestra al lado
  (cuadrado en barras y áreas, trazo corto en líneas y en el tooltip).
- Eje Y compacto desde mil (0 / 1 mil / 2 mil). Las etiquetas del eje X se miden y se saltan si no caben.
- La fuente se hereda de la página.

## Interacción

- Tooltip en todo gráfico: crosshair en línea y área, banda resaltada en barras y velas, punto más
  cercano en dispersión y burbujas. Muestra la fecha o categoría completa, el valor exacto de cada
  serie (valor en negrita, nombre después), el total si hay pila y el detalle de las velas.
- El tooltip se construye con `textContent`, nunca con `innerHTML` de datos del usuario.
- Leyenda solo con 2 o más series; botones con `aria-pressed`, 32 px de alto mínimo.
- Animación 600 ms ease-out; nada si `prefers-reduced-motion`.

## Anotaciones, etiquetas al final y énfasis

- Línea de referencia: 1 px discontinua (4 3) en texto secundario, encima de los datos. Su texto,
  12 px/500 en texto secundario con halo de 3 px del color de la superficie: al final de una línea
  horizontal (encima, o debajo si no cabe) y arriba a la derecha de una vertical.
- Franja: el mismo gris del resaltado del hover (5 % del texto), detrás de los datos, con su texto
  adentro arriba. Los textos que chocarían se corren una línea.
- Etiquetas al final: nunca a costa de los datos (el área conserva la mitad del ancho; si no caben
  56 px, no van y queda la leyenda). Marca de 10 × 2 px del color de la serie y el nombre en texto principal
  (el valor, si se pide, en secundario). Ocupan como máximo el 30 % del ancho; lo que no cabe se
  recorta con "…". Separación mínima 15 px entre etiquetas.
- Énfasis: las series de contexto van en gris (`#a9a8a1` claro, `#6b6a65` oscuro: tenue pero legible, unos 2,4:1), debajo de las
  destacadas y sin punto de hover. La leyenda las muestra en el mismo gris.

## Zoom

- Selección al arrastrar: el primer color de la paleta al 10 % con borde, de alto completo, y el
  tramo en texto arriba ("mar – jun"): no se confunde con una franja y se sabe a dónde se acerca.
- La ventana muestra al menos 5 datos; los ticks de fecha nunca bajan de la granularidad de los
  datos (con datos diarios no aparecen horas).
- Barra de desplazamiento de 36 px, 10 px bajo las etiquetas X, alineada con el área de datos: mini
  gráfico en el gris de contexto, lo que está fuera de la ventana velado al 72 % con la superficie,
  ventana con borde de 1 px en texto secundario (3:1 o más contra la superficie) y bordes de
  10 × 22 px (área táctil de 26 × 38 px) para estirarla.
- "Ver todo" va en el encabezado, a la derecha del título; su lugar queda reservado aunque no se vea,
  así el gráfico no salta al acercar y el botón nunca tapa datos ni anotaciones.

## Un eje Y, salvo que se pida el segundo con salvaguardas

Por defecto, un solo eje Y. Para dos medidas con distintas unidades, primero: paneles alineados
(`facet: 'series'`, `columns: 1`, `sharedY: false`) o índice base 100 (`yAxis.index`), con la línea
de 100 marcada como referencia igual que el cero.

El doble eje (`yAxis2`, `axis: 'right'`) existe como opción explícita, con salvaguardas fijas:
los dos ejes incluyen el cero y lo comparten a la misma altura, el eje derecho usa la misma
cantidad de ticks que el izquierdo (rejilla compartida, paso 1, 2, 2,5 o 5 × 10ⁿ), cada eje lleva
su título arriba y la leyenda marca "(eje derecho)". Los números van en texto secundario, nunca
del color de la serie.

## Small multiples

- Mismo eje del valor y mismas X en todos los paneles: comparar formas solo es honesto con la
  misma escala.
- Números del eje solo en la primera columna y etiquetas X solo al pie de cada columna (como en
  ggplot); la rejilla sí va en todos. El área de datos mide lo mismo en todos los paneles.
- Paneles alineados al píxel: misma escala X (banda si alguno tiene barras) y mismo ancho
  reservado para los números del eje.
- Título del panel de 13 px; paneles de 180 px de alto por defecto, columnas de 240 px como mínimo.
- El color sigue a la serie también aquí: por serie, cada panel conserva el color de su posición.
- Una sola leyenda arriba de la cuadrícula; el puntero marca el mismo dato en todos los paneles y
  el tooltip solo aparece en el panel bajo el puntero.

## Demo (`demo/index.html`)

Hanken Grotesk con la fuente del sistema como respaldo. Separadores de 1 px en vez de tarjetas.
Cuadrícula de 2 columnas que pasa a 1 bajo 860 px. Selector de tema segmentado arriba a la derecha.
