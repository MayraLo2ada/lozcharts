# Sistema de diseño de LozChart

Reglas fijas para todos los tipos de gráfico. Los valores viven en `src/core/theme.ts`
(colores) y en cada serie (`src/series/*.ts`), no repetidos a mano.

## Paleta categórica (orden fijo, validada para daltonismo)

| Slot       | Claro     | Oscuro    |
| ---------- | --------- | --------- |
| 1 azul     | `#2a78d6` | `#3987e5` |
| 2 naranja  | `#eb6834` | `#d95926` |
| 3 aqua     | `#1baf7a` | `#199e70` |
| 4 amarillo | `#eda100` | `#c98500` |
| 5 magenta  | `#e87ba4` | `#d55181` |
| 6 verde    | `#008300` | `#008300` |
| 7 violeta  | `#6250d6` | `#9085e9` |
| 8 rojo     | `#e34948` | `#e66767` |

Validación (24 oct 2026): las dos paletas pasan el rango de luminosidad, el croma mínimo, la
separación para daltonismo (peor par vecino ΔE 9,1 en claro y 8,4 en oscuro) y la distinción
normal. En claro, aqua, amarillo y magenta tienen menos de 3:1 de contraste con la superficie:
por eso el tooltip con valores exactos y la tabla de datos son obligatorios, no opcionales.

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

## Small multiples

- Mismo eje del valor y mismas X en todos los paneles: comparar formas solo es honesto con la
  misma escala.
- Números del eje solo en la primera columna (como en ggplot); la rejilla sí va en todos.
- Título del panel de 13 px; paneles de 180 px de alto por defecto, columnas de 240 px como mínimo.
- El color sigue a la serie también aquí: por serie, cada panel conserva el color de su posición.
- Una sola leyenda arriba de la cuadrícula; el puntero marca el mismo dato en todos los paneles y
  el tooltip solo aparece en el panel bajo el puntero.

## Demo (`demo/index.html`)

Hanken Grotesk con la fuente del sistema como respaldo. Separadores de 1 px en vez de tarjetas.
Cuadrícula de 2 columnas que pasa a 1 bajo 860 px. Selector de tema segmentado arriba a la derecha.
