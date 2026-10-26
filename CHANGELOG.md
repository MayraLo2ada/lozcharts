# Cambios

## 1.1.0 (25 de octubre de 2026)

Primera versión en npm.

- **Siete tipos nuevos:** cascada (`waterfall`), bala (`bullet`), sunburst, cuerdas (`chord`),
  red (`network`), línea de tiempo (`timeline`) y nube de palabras (`wordcloud`). Igual que los
  demás, traen tooltip, teclado, tabla de datos, tema oscuro y animación.
- **Para crear tipos:** `derive` en `SeriesImpl` calcula los valores del eje con la serie completa
  (la cascada lo usa para los acumulados). `onHover` recibe `null` en los nodos que no son filas
  de datos (los interiores del sunburst).
- **Tooltip:** la muestra de color toma el color de cada dato (rama, grupo, carril, nodo de origen
  o celda), no el de la serie. Los tipos de serie lo definen con el gancho `swatch(ctx, i)`.
- **Para extensiones:** el paquete exporta las piezas del núcleo con las que se dibujan sus tipos:
  colores (contraste, mezcla en OKLab, rampas), formatos de número y fecha, marcas de eje, `esc`,
  `attrs`, `textWidth`, `fitText`, `toCSV` y `swatchOf`.
  En el build para `<script>` llegan en `window.LozChart`, y `chart.options` da las opciones
  vigentes (también en los small multiples).
- **Opciones nuevas:** `tooltip: { float: false }` quita solo el recuadro flotante y conserva el
  puntero, el crosshair, el teclado, los avisos y `onHover`. `zoom: { reset: false }` quita el botón
  "Ver todo". `yAxis.grid: false` quita la rejilla del valor. `yAxis.type: 'log'`: escala
  logarítmica con marcas en 1, 2 y 5 × 10ⁿ. `onClick(x, índice, serie)`, también con Enter o
  Espacio sobre el dato activo (en `<loz-chart>`, el evento `lozclick`).
- **Zoom exacto:** `onZoom` recibe también la ventana en fracciones del eje (`{ start, end }`), y
  `setZoomWindow` la fija sin redondear a un dato; `zoomWindow` la da. Sirve para sincronizar
  varios gráficos.
- **`chart.redraw()`:** vuelve a dibujar con el estado actual, sin animar.
- **Más para crear tipos:** `ctx.purpose` (`'screen'`, `'export'` u `'overview'`), `ctx.locale` y
  `ctx.currency` (también en el `format` del tooltip), `ctx.siblings()`, `hit` también en
  cartesiano, el gancho `click(ctx, i, evento)`, `preferredHeight(ps, ancho)` y `derivedName`.
  Exporta además `inkFor`, `MAX_COLORS`, `legendSpec`, `legendWidth`, `toOklab`, `fromOklab`,
  `LogScale`, `logTicks` y `logDomain`.
- **Línea de tiempo:** `label` (el campo con el nombre del tramo; por defecto `field`) y `today`
  (línea de hoy o de una fecha dada). Fechas, eje y duraciones en el idioma del gráfico.
- **Cascada:** `toCSV` ya no repite el encabezado cuando la serie se llama como su campo (el valor
  sale como "monto (acumulado)"); varias cascadas lado a lado deciden juntas si llevan etiquetas, y
  el mini gráfico del zoom va sin ellas.
- **Selección:** la opción `selection` (índices de fila) y `chart.select()` dejan lo seleccionado
  como siempre y atenúan el resto en barras, cascada, bala, velas, dispersión, burbujas, pie,
  donut, embudo, mapa de calor, treemap, sunburst, sankey, cuerdas, red, línea de tiempo, nube y
  mapas; en líneas, áreas y radar se marcan los seleccionados. Se anuncia, va en la descripción y en
  la tabla de datos. `onHover` recibe también el índice de la fila y la serie, y `highlight()`
  acepta varias X (`highlightIndex()`, índices).
- **Corregido:** el tooltip oculto ya no abre un scroll horizontal al achicarse la ventana.
- **Paquete:** los tipos funcionan con cualquier `moduleResolution` de TypeScript: `bundler`,
  `node16` y `nodenext` (antes, ahí `LozChart` quedaba sin tipos y no avisaba de nada) y el antiguo
  `node`, también en `lozcharts/react`, `lozcharts/element` y `lozcharts/maps/world`. `require`
  tiene sus propios tipos. `lozcharts/react` y `lozcharts/element` se pueden cargar con `require`
  en las versiones de Node que lo permiten, y el paquete expone `lozcharts/package.json`.
- **Sin datos:** el gráfico se queda vacío, sin letrero, y su elemento lleva `data-empty` para que
  cada página ponga su propio mensaje (ver README).
- **TypeScript:** `data` acepta filas tipadas con `interface` (`DataRow`), y `type` de cada serie
  sugiere los 26 tipos de la librería (`SeriesType`).
- **Avisos que te dicen qué pasó:** cuando un campo no aparece en ninguna fila, cuando hay filas sin
  fecha o número válido en la X o que no son objetos, cuando dos series se llaman igual y cuando un
  pie o un donut trae valores negativos. Sin opciones o sin `xAxis.field`, un error que dice qué
  falta. Una moneda o un idioma que el navegador no conoce ya no impiden dibujar.
- **Corregido, de lo más importante a lo menos:**
  - Con más de unas 65 000 filas, dispersión, burbujas, mapas, pie, mapa de calor, red, sankey,
    cuerdas, embudo y línea de tiempo ya no fallan en Safari.
  - Burbujas: todas las series comparten la escala del tamaño (antes no se podían comparar).
  - Globo: por defecto mira a los lugares con datos.
  - CSV: la X numérica sale como número, las fechas en la hora local (antes, en UTC, el día podía
    correrse) y `download()` no repite la extensión.
  - Velas y OHLC: la variación es correcta con aperturas negativas.
  - Barras agrupadas: un grupo ya no invade a la categoría vecina cuando hay muchas.
  - Barras horizontales: el eje se vuelve a redondear al cambiar el ancho.
  - Small multiples: el área de datos mide lo mismo en todos los paneles, y la cuadrícula llena el
    ancho.
  - Bala, mapa de calor, embudo y mapa de burbujas: valores, nombres largos y burbujas del borde ya
    no se enciman ni se cortan.
  - Un dato que no se dibuja dice "No aparece" y por qué, igual en todos los tipos; los porcentajes
    ínfimos o casi totales se escriben "<0,1 %" y ">99,9 %".
  - El número central del medidor, la dona y los anillos cuenta sin decimales que no existen.
  - React y `<loz-chart>`: quitar `yAxis` quita también su mínimo, su máximo y su formato.
  - El lector de pantalla dice cuando no hay datos y cuando todos los valores son iguales.
  - Números diminutos (como 1e-13) ya no dejan el eje en cero.

## 1.0.0 (25 de octubre de 2026)

Primera versión completa.

- **Tipos:** líneas, barras (verticales, horizontales, agrupadas y apiladas), áreas, escalones,
  bandas de rango, dispersión, burbujas, velas, OHLC, pie, donut, gauge, radar, embudo, mapa de
  calor, treemap, sankey, mapas coropléticos y de burbujas, y small multiples.
- **Explorar:** zoom en el eje X con barra de desplazamiento y mini gráfico, anotaciones (líneas
  de referencia y franjas), etiquetas al final de cada línea, énfasis de series, doble eje con
  salvaguardas e índice base 100.
- **Muchos datos:** las líneas dibujan solo lo visible y, con más de dos datos por píxel, los
  extremos de cada columna; 100 000 puntos en unos 40 ms.
- **Accesibilidad:** descripción para lectores de pantalla, tabla de datos, recorrido con teclado
  (también en dos dimensiones en el mapa de calor), avisos en vivo, foco visible, paleta validada
  para daltonismo y respeto por `prefers-reduced-motion`.
- **Exportar:** PNG, SVG y CSV.
- **Integraciones:** `<script>`, módulos ES, componente de React (`lozcharts/react`), elemento
  `<loz-chart>` para Angular, Vue o Svelte (`lozcharts/element`) y Django + HTMX (`initAll`).
- **Mapas:** mapa del mundo aparte (`lozcharts/maps/world`), con proyecciones Equal Earth y
  Mercator; cualquier TopoJSON o GeoJSON con `registerMap`.
- **Paleta Violeta** por defecto (violeta, rosa, ocre, vino, verde, cielo, coral, petróleo), validada para daltonismo y con tonos propios para el modo oscuro.
- **Globo terráqueo** (`projection: 'orthographic'`, `rotate`).
