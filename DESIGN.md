# Sistema de diseño de LozCharts

Reglas fijas para todos los tipos de gráfico. Los valores viven en `src/core/theme.ts`
(colores) y en cada serie (`src/series/*.ts`), no repetidos a mano.

## Nombres

Cada tipo tiene un nombre de la familia: LozLine, LozBar, LozArea, LozStep, LozRange, LozScatter,
LozBubble, LozCandle, LozOHLC, LozPie, LozDonut, LozGauge, LozRadar, LozFunnel, LozHeatmap, LozTreemap, LozSankey, LozWaterfall, LozBullet, LozSunburst, LozChord, LozNetwork,
LozTimeline, LozWordcloud, LozMap y LozMultiples. Ese nombre técnico solo aparece junto al código
(en la página de cada ejemplo); en la galería cada ficha dice el tipo como lo diría una persona
("Barras apiladas", "Mapa de calor"). En el código, el tipo usa su nombre corto (`type: 'bar'`).

## Paleta categórica "Violeta" (orden fijo, validada para daltonismo)

| Slot       | Claro     | Oscuro    |
| ---------- | --------- | --------- |
| 1 violeta  | `#5e2dad` | `#8b61e3` |
| 2 rosa     | `#db6ea5` | `#d1649c` |
| 3 ocre     | `#e2aa00` | `#b88a06` |
| 4 vino     | `#9c1854` | `#9d4e6b` |
| 5 verde    | `#31983d` | `#399e43` |
| 6 cielo    | `#4c99f8` | `#4996f5` |
| 7 coral    | `#e45934` | `#e05630` |
| 8 petróleo | `#009298` | `#0a999f` |

Son los mismos 8 colores validados de la paleta anterior (Coral), en otro orden: la marca de
LozCharts es violeta, rosa y blanco, y no debe parecerse a la de otras librerías que abren con
naranja. El orden salió de una búsqueda sobre todas las permutaciones con violeta y rosa
primero (25 oct 2026, `validate_palette.js`):

- Las 8, par vecino: pasan luminosidad, croma, daltonismo (peor ΔE 11,7) y distinción normal.
- Los primeros 3, todos contra todos: daltonismo ΔE 13,4, normal 16,9. Con 4 series, el
  daltonismo sigue en 11,2, pero vino y rosa quedan a 12,9 en visión normal: por eso la leyenda,
  las etiquetas al final y la tabla son obligatorias, no adorno.
- En claro, cielo (2,83:1) y ocre (2,05:1) no llegan a 3:1 contra la superficie: van con el
  tooltip de valores exactos y la tabla de datos. En oscuro, las 8 pasan 3:1.
- Texto sobre rellenos (treemap, mapa de calor): el texto o la superficie del tema y, si
  ninguno llega a 4,5:1 (el violeta del oscuro), negro o blanco puros.

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
- Rejilla: 1 px sólida y tenue, al 55 % del color de la rejilla: guía la vista sin competir con los
  datos. Horizontal en cada marca del valor y, con fechas o números en X, vertical en cada marca del
  eje X (con categorías no, las barras ya marcan cada una; `xAxis.grid` lo decide a mano). La línea
  del cero, entera y un poco más marcada. `yAxis.grid: false` quita la rejilla del valor, nunca la
  línea del cero (o la base, si el cero no se ve): sin ella las barras flotan.
- Selección (`selection`): lo seleccionado queda como siempre y el resto al 25 % de opacidad,
  también sus etiquetas: la diferencia es de claridad, no de tono, y no depende de distinguir
  colores. Conectores, ejes, nodos de un sankey y arcos de cuerdas no se atenúan: son la
  estructura. En un sunburst se ve entera la rama de lo seleccionado hasta la raíz. Las líneas y
  áreas no se cortan: llevan el punto de hover en cada dato seleccionado.
- Eje logarítmico (`yAxis.type: 'log'`): marcas en 1, 2 y 5 × 10ⁿ, o solo en potencias de 10 si no
  caben, con los extremos en marcas; nunca 3, 4 o 6, que en esta escala quedan apretados contra el
  siguiente. Sin cero, la base discreta va en el borde inferior y las barras parten de ahí.
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
- Mapa de calor: celdas con radio 2 y 2 px de aire (1 px si el paso es menor de 6 px). Un solo
  tono mezclado en OKLab desde la superficie (el mínimo arranca al 14 %, distinto de una celda
  vacía). Con negativos, divergente y simétrica: el cero en el gris de la rejilla, los negativos
  hacia el segundo color. Leyenda de 120 px arriba a la derecha. Valores dentro de las celdas solo
  si caben y hay 120 celdas o menos; todos exactos o todos compactos, nunca mezclados.
- Treemap: _squarified_; 2 px entre rectángulos y 4 px entre grupos (cada grupo se lee como un
  bloque); radio 2 px; franja de grupo de 20 px con el nombre en 600 y el total en secundario.
  El texto adentro usa el color del tema de mayor contraste con el relleno (≥ 4,5:1 salvo el
  violeta del oscuro, 4,1:1).
- Sankey: nodos de 12 px con radio 2, flujos con el color de su origen al 35 % (38 % en oscuro);
  al pasar el puntero, un velo de superficie atenúa el resto y el flujo activo sube al 65 %.
  Etiquetas de 12 px con halo de superficie: nombre en texto principal, valor en secundario.
- Cascada: barras de las marcas de siempre (24 px, punta de 4 px hacia donde se movió el
  acumulado). Subida rellena del color de la serie, bajada hueca con borde de 1,5 px del mismo
  color, total en el gris neutro (`other`); con varias cascadas, el total lleva una punta de 3 px
  del color de su serie. Conectores de 1 px en el color de la línea del cero, de grupo a grupo.
  Etiquetas de 12 px en texto secundario con halo y signo +/− (menos tipográfico), del lado al
  que se movió el acumulado; todas exactas o todas compactas; las variaciones todas o ninguna, los
  totales uno por uno. El eje deja un 8 % de aire para las etiquetas de los extremos.
- Bala: una fila por indicador, escala compartida con un solo eje abajo y su rejilla entre las
  filas. Nombres en texto principal, recortados al 40 % del ancho. Rangos de 24 px como máximo
  (60 % de la fila) en grises mezclados en OKLab desde la superficie hacia el texto, el peor el más
  intenso (claro: 17 % a 5,5 %; oscuro: 21 % a 7 %), nunca semáforo. El valor es una barra de un
  tercio de ese grosor, del color de la serie, con punta redondeada 2 px y anillo de 1 px de
  superficie. La meta, una marca de 3 px en texto principal con halo, siempre más alta que la
  barra. La etiqueta del valor nunca pisa la meta: salta al otro lado o no va.
- Sunburst: desde arriba en sentido horario, hermanos de mayor a menor, 2 px de superficie entre
  segmentos y anillos. Cada rama de primer nivel con su color en orden (más de 8: 7 y el resto en
  "Otros"); los anillos de afuera lo mezclan en OKLab hacia la superficie (16 % por nivel en claro,
  tope 56 %; 12 % en oscuro, tope 40 %). Agujero de 0,6 con un anillo y menos con más niveles, con
  el total al centro. Etiquetas adentro de 12 px/500 en la tinta de mayor contraste, tangenciales o
  radiales (la más horizontal), nunca de cabeza. Segmentos de menos de 3 px de arco: una banda sin
  etiqueta, pero apuntable. Hover: velo de superficie y la ruta hasta la raíz encima.
- Cuerdas: arcos de 10 px en el orden de los datos, desde arriba en sentido horario, con 5 px de
  hueco (máximo 25 % de la vuelta); largo = entrada + salida. Cintas cuadráticas por el centro, del
  color de su origen al 35 % (38 % en oscuro); el extremo de origen toca el arco y el de destino
  queda 4 px adentro. Etiquetas horizontales de 12 px por fuera con halo; el círculo conserva al
  menos el 60 % de su radio. Los bucles no se dibujan.
- Red: nodos con área según su grado (de 3 a 18 px de radio según el espacio), anillo de 1,5 px de
  superficie, los grandes abajo y los chicos encima. Vínculos de 0,75 a 3 px según su peso, en
  texto secundario al 28 % (34 % en oscuro). Con `group`, la paleta en orden y leyenda arriba; sin
  grupo, el color de la serie. Etiquetas de 12 px con halo, a la derecha o a la izquierda del nodo,
  nunca encimadas, hasta 30. Hover: velo de superficie, los vínculos del nodo en su color al 75 % y
  sus vecinos con nombre.
- Línea de tiempo: barras de hasta 24 px con radio 4 en filas de hasta 34 px; hitos en rombo de
  16 px con anillo de 1,5 px de superficie. Con `group`, un carril por grupo en el orden de la
  paleta, con su nombre en texto principal y una muestra de 10 px, separados por una línea de la
  rejilla. Rejilla vertical en cada fecha del eje. Nombres adentro si caben, a la derecha antes de
  la marca siguiente o recortados si conservan el 70 %; si no, no van. Hover: anillo de 2 px y
  guías de 1 px hasta el eje en el inicio y el fin. Hoy (`today`): línea de 1 px discontinua (4 3)
  en texto secundario, encima de las marcas, con su texto de 12 px arriba en una franja de 20 px que
  solo se reserva si la fecha cae en el eje; contra un borde, el texto se corre hacia adentro.
- Nube de palabras: cuerpo con la raíz del peso (el área va con el peso), mínimo de 12 px, la más
  pesada al centro, todas horizontales, en espiral desde el centro con la forma del área. 500 para
  el texto y 600 desde 24 px; 2 px de aire entre cajas. Sin grupo, el color de la serie en 3
  intensidades; con grupo, la paleta en orden y leyenda arriba. Todo color ajustado a 4,5:1 contra
  la superficie. Hover: velo de superficie al 72 % y la palabra activa con fondo de resaltado.
- Mapas: Equal Earth por defecto (áreas iguales: honesta al colorear superficies). Países con
  datos en la escala del mapa de calor, sin datos en el gris de la rejilla, fronteras de 0,5 px
  del color de la superficie; la Antártida se omite si no tiene datos. Burbujas al 70 % con
  anillo de superficie, la mayor de hasta 28 px de radio, las chicas encima.

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
  Con zoom en Y es un rectángulo; un arrastre casi plano (menos de 8 px) en un eje no lo cambia.
- La ventana muestra al menos 5 datos; los ticks de fecha nunca bajan de la granularidad de los
  datos (con datos diarios no aparecen horas).
- Deslizante delgado (por defecto): 22 px de alto, 4 px bajo las etiquetas X, alineado con el área
  de datos. Pista de 2 px en el color de la línea del cero; el tramo visible encima, de 3 px en texto
  secundario; perillas redondas de 14 px con relleno de superficie, borde de 1,5 px en el color del
  texto y una sombra mínima. Área táctil de 24 px (44 px con puntero grueso). Si la ventana es
  angosta, las perillas se separan hacia afuera (22 px entre centros como mínimo).
- Zoom en Y: el mismo deslizante, vertical, a la izquierda de los números del eje Y (22 px más 6 de
  respiro), a lo alto del área de datos y con el inicio abajo. El título del eje empieza donde
  empiezan los números. Los extremos del eje son los de la ventana, sin redondear, y las marcas se
  recalculan redondas; el recorte es exacto arriba y abajo.
- `scrollbar: 'mini'`: barra de 36 px, 10 px bajo las etiquetas X: mini gráfico en el gris de
  contexto, lo que está fuera de la ventana velado al 72 % con la superficie, ventana con borde de
  1 px en texto secundario (3:1 o más contra la superficie) y bordes de 10 × 22 px (área táctil de
  26 × 38 px) para estirarla.

- "Ver todo" va en el encabezado, a la derecha del título; su lugar queda reservado aunque no se vea,
  así el gráfico no salta al acercar y el botón nunca tapa datos ni anotaciones. Con
  `zoom: { reset: false }` no hay botón ni lugar reservado (quien lo quita da su propio control).

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

## Sitio: galería y página de un ejemplo

- Cada ejemplo tiene un título que dice algo de sus datos ("El Sur quedó lejos de su meta") y un
  subtítulo con la medida, la unidad y el periodo. Nada de títulos que describan el tipo de gráfico.
  Los datos son inventados, pero las cifras del título tienen que cuadrar con el gráfico.
- Galería: rejilla fluida de 1, 2, 3 (desde 1280 px) y 4 columnas (desde 2200 px), con fichas
  normales, grandes (dos columnas) y anchas (la fila entera); el orden de `ejemplos.js` arma filas
  completas en tres columnas. Cada ficha: título de la página (enlace al ejemplo) y subtítulo, el
  gráfico sin su propio encabezado (sigue en su nombre accesible) y al pie el tipo en palabras.
  "Código" y "Abrir y ajustar" aparecen al pasar o enfocar (siempre visibles en pantallas táctiles).
- Los gráficos de la galería toman el alto del ancho de su columna (entre 250 y 560 px).
- Página de un ejemplo: gráfico grande con "Por qué esta forma" y los ajustes al lado; abajo, el
  código con "Para usarlo" y el nombre técnico al lado. Alto inicial según la pantalla (340 a 820 px).

## Sitio: portada (`site/index.html`)

- Póster nocturno, siempre oscuro: negro `#050505`, hueso `#f4f2ee`, violeta `#9b6bff` (5,8:1),
  rosa `#ff4fa3` (6,7:1) y lima `#c8ff2e` solo para la acción principal («Úsala gratis») y como
  acento (pestaña elegida, línea de código que cambió, foco). Esquinas rectas, bordes de 1 o 2 px,
  sin sombras ni vidrio. Archivo (eje de ancho) para carteles y texto, Geist en barra y pie.
- Titular de la portada: el tamaño lo pone el CSS y el JS solo ensancha la letra hasta los bordes,
  así el alto nunca cambia al cargar. Respaldos de fuente con `size-adjust` y métricas de Archivo.
- Orden: portada con la tienda que se dibuja → laboratorio (seis tipos, tres juegos de datos,
  código en vivo) → los 26 tipos en un bento agrupado por la pregunta que responden → accesible →
  liviana → caso real (`caso-real.html`) → Gratis / Pro → ¿Dudas?
- Bento: grupos de 12 columnas que cierran sus filas sin huecos (6 en tableta, 1 en el celular);
  los gráficos se crean al acercarse y se vuelven a dibujar al pasar el puntero. El mapa del mundo
  se baja solo cuando un mapa se acerca. El globo no va en la portada.
- `prefers-reduced-motion` (o `?reducido` para probarlo) pone `.quieto` en `<html>` antes de pintar:
  sin letras que se arman, sin cortina, sin contadores; todo aparece directo.
