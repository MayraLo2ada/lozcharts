# Cambios

## Sin publicar

- **Siete tipos nuevos:** cascada (`waterfall`), bala (`bullet`), sunburst, cuerdas (`chord`),
  red (`network`), línea de tiempo (`timeline`) y nube de palabras (`wordcloud`), con tooltip,
  teclado, tabla de datos, tema oscuro y animación como los demás.
- **Para crear tipos:** `derive` en `SeriesImpl` calcula los valores del eje con la serie completa
  (la cascada lo usa para los acumulados). `onHover` recibe `null` en los nodos que no son filas
  de datos (los interiores del sunburst).
- **Tooltip:** la muestra de color toma el color de cada dato (rama, grupo, carril, nodo de origen
  o celda), no el de la serie. Los tipos de serie lo definen con el gancho `swatch(ctx, i)`.

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
