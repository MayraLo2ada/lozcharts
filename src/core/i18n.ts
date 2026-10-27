/**
 * Idiomas: todo texto que la librería muestra, anuncia o escribe en la consola, en español,
 * inglés y portugués de Brasil.
 *
 * - La opción `locale` del gráfico decide el idioma de los textos y de los formatos (Intl). Sin
 *   ella, el de la página (`<html lang>`) si hay catálogo para él; si no, inglés.
 * - Cualquier variante cae en su idioma: 'es-MX' usa el catálogo 'es' y formatea como en México.
 * - `registerLocale(code, mensajes)` agrega un idioma (lo que falte sale del inglés) o cambia
 *   textos de uno que ya existe (lo que no se da queda como estaba).
 *
 * Los textos que dependen de un número o de un nombre son funciones: así cada idioma arma la
 * frase con su orden, su plural y su concordancia ("1 fila cierra" y "3 filas cierran").
 */

/** Una palabra en singular y en plural: ['etapa', 'etapas']. */
export type Words = readonly [singular: string, plural: string];

/** Nombre de un tipo de serie en la descripción accesible, cómo se llaman sus datos y su valor calculado. */
export interface TypeTexts {
  /** "barras", "bar chart": va en "Gráfico de barras con 12 categorías". */
  label?: string;
  /** Cómo se llaman sus datos al contarlos. Sin esto, categorías o puntos según el eje. */
  items?: Words;
  /** Con `derive`: el nombre del valor calculado en el CSV ("acumulado"). */
  derived?: string;
}

export interface Messages {
  /** El gráfico: botones, anuncios en vivo, descripción accesible y tabla de datos. */
  chart: {
    /** Botón que deshace el zoom. */
    showAll: string;
    /** Nombre del grupo de botones de la leyenda. */
    legend: string;
    /** Nombre de los small multiples sin título. */
    grid: string;
    /** Se mostró o se ocultó una serie (o una categoría) desde la leyenda. */
    shown: (name: string) => string;
    hidden: (name: string) => string;
    /** Con zoom: qué tramo se ve ahora, o que se ve todo. */
    zoomedTo: (from: string, to: string) => string;
    zoomedAll: string;
    /** "Selección: 3 de 12 celdas". */
    selection: (selected: number, total: number, items: Words) => string;
    selectionCleared: string;
    /** Marca de un dato seleccionado, entre paréntesis después de su nombre. */
    inSelection: string;
    /** Marca de una categoría oculta desde la leyenda, en la tabla de datos. */
    hiddenInChart: string;
    /** Nombre de una serie que se lee en el eje derecho. */
    rightAxis: (name: string) => string;
    /** Título de la tabla de datos accesible si el gráfico no tiene título. */
    tableTitle: string;
    /** La tabla muestra solo las primeras filas (los números ya vienen formateados). */
    tableTruncated: (title: string, shown: string, total: string) => string;
    /** Valor original de una serie convertida a índice base 100. */
    realValue: string;
    /** Total de una pila en el tooltip. */
    total: string;
    /** Columna del valor de una serie en el CSV, cuando su nombre choca con el de otra columna. */
    value: string;
    /** Una diferencia en puntos porcentuales ("7 p. p."), ya formateada y con signo. */
    percentPoints: (value: string) => string;
    /** "Gráfico de barras y líneas": con los nombres de los tipos (ver types). */
    chartOf: (kinds: string[]) => string;
    /** Si ningún tipo tiene nombre. */
    chart: string;
    /** "Gráfico de barras, todavía sin datos." (`what` ya trae el título). */
    noDataYet: (what: string) => string;
    /** "Gráfico de barras con 12 categorías" (sin el punto final). */
    withCount: (what: string, count: string) => string;
    /** "12 categorías". */
    count: (n: number, items: Words) => string;
    /** "2 series y 12 categorías". */
    seriesAndItems: (series: string, items: string) => string;
    series: Words;
    points: Words;
    categories: Words;
    /** " (3 sumadas en Otros)": categorías que el gráfico juntó en una porción. */
    folded: (n: number) => string;
    /** ", de enero a diciembre": de dónde a dónde va el eje X. */
    span: (from: string, to: string) => string;
    /** " El más alto es noviembre, con 1,4 M $." y " Todos valen 7." (con su espacio inicial). */
    highest: (x: string, value: string) => string;
    allEqual: (value: string) => string;
    /** " Recorre los datos con las flechas." según el eje. */
    explore: (keys: string) => string;
    arrows: string;
    arrowsUpDown: string;
    arrowsLeftRight: string;
    /** Atajos del zoom, con su espacio inicial. */
    zoomKeys: string;
    /** " Referencias: Meta, 120 mil $; Campaña de verano." */
    notes: (items: string[]) => string;
    /** Una fecha que va a mitad de frase: en español va en minúscula ("de enero de 2026"). */
    midSentence: (date: string) => string;
    /** Encabezado de una fecha semanal ("Semana del 2 de marzo de 2026"), con la fecha ya escrita. */
    weekOf: (date: string) => string;
  };
  /** Deslizantes del zoom: el del eje X y, con zoom en Y, el vertical. */
  scrollbar: {
    window: string;
    start: string;
    end: string;
    /** Lo que dice la ventana: "De marzo a junio". */
    range: (from: string, to: string) => string;
    /** El deslizante vertical: el tramo de valores que se ve, su borde de abajo y el de arriba. */
    yWindow: string;
    yStart: string;
    yEnd: string;
    /** Lo que dice su ventana: "Valores de 20 a 80". */
    yRange: (from: string, to: string) => string;
  };
  /** Palabras que comparten varios tipos de serie (tooltip, leyendas, tabla). */
  data: {
    noData: string;
    /** Un dato que no se dibuja, con el porqué al lado. */
    notShown: string;
    zeroOrLess: string;
    belowZero: string;
    missingEnds: string;
    /** Una fila de un sunburst sin ningún nivel. */
    noPath: string;
    total: string;
    ofTotal: string;
    /** Parte de un grupo o de un padre: "De Américas". */
    of: (name: string) => string;
    group: string;
    noGroup: string;
    /** Lo que se junta cuando no alcanzan los colores. */
    others: string;
    unnamed: string;
    target: string;
    vsTarget: string;
  };
  bullet: {
    band: string;
    upTo: (v: string) => string;
    between: (a: string, b: string) => string;
    /** Más allá de la última franja. */
    above: (v: string) => string;
    /** "(2 de 3)": en qué franja cae. */
    position: (k: number, n: number) => string;
  };
  candlestick: { open: string; high: string; low: string; close: string };
  scatter: { size: string };
  funnel: { fromStart: string; fromPrevious: string };
  heatmap: { repeated: (name: string) => string };
  network: {
    connections: string;
    connectedMostly: string;
    connected: string;
    andMore: (n: string) => string;
    none: string;
    noWeight: string;
    noSource: string;
    /** Un vínculo entre dos nodos: "Ana y Luis". */
    pair: (a: string, b: string) => string;
  };
  flows: {
    /** Parte de lo que sale de un nodo y de lo que llega a otro (sankey y cuerdas). */
    outOf: (name: string) => string;
    into: (name: string) => string;
    cycle: string;
    sameNode: string;
  };
  timeline: {
    noValidDate: string;
    end: string;
    notADate: string;
    duration: string;
    note: string;
    reversed: string;
    today: string;
    /** Por si el entorno no tiene Intl con unidades: año, mes, día, hora y minuto. */
    units: readonly [Words, Words, Words, Words, Words];
    /** Para unir "3 meses y 12 días" si el entorno no tiene Intl.ListFormat. */
    and: string;
  };
  waterfall: {
    step: string;
    total: string;
    subtotal: string;
    unexplained: string;
    cumulative: string;
    up: string;
    down: string;
    flat: string;
  };
  wordcloud: {
    noWord: string;
    addsTo: string;
    joins: string;
    rows: (n: string) => string;
    noRoom: string;
    noWeight: string;
  };
  /** Nombre de cada tipo de serie (por su nombre registrado) y cómo se llaman sus datos. */
  types: Record<string, TypeTexts>;
  /** Avisos de consola y errores. */
  warnings: {
    noOptions: string;
    noXField: string;
    badInit: string;
    badAttribute: string;
    noElement: (target: string) => string;
    intl: (message: string) => string;
    notObjects: (n: number) => string;
    noXFieldRows: (field: string) => string;
    lostRows: (lost: number, total: number, time: boolean, field: string) => string;
    unknownType: (type: string) => string;
    emptySeries: (field: string, name: string) => string;
    duplicateNames: (names: string) => string;
    cannotMix: (name: string, type: string, other: string) => string;
    singleSeries: (type: string, name: string) => string;
    tooManySeries: (n: number, max: number) => string;
    noRightAxis: (name: string) => string;
    indexNeedsPositive: (name: string) => string;
    palette: (n: number, max: number) => string;
    noCanvas: string;
    pngFailed: string;
    pieNegative: (name: string, rows: string, count: number) => string;
    chordLoops: (name: string, list: string, count: number) => string;
    sankeyCycles: (name: string, list: string, count: number) => string;
    noMap: (name: string) => string;
    missingPlaces: (name: string, list: string) => string;
    timelineSwapped: (name: string, list: string, count: number) => string;
    waterfallTotals: (name: string, rows: string, count: number) => string;
    wordcloudOmitted: (name: string, count: number) => string;
  };
}

/** Mensajes parciales para registerLocale: cada parte es opcional, hasta el último texto. */
export type PartialMessages = {
  [K in keyof Messages]?: Messages[K] extends Record<string, TypeTexts> ? Record<string, TypeTexts> : Partial<Messages[K]>;
};

const plural = (n: number, [one, many]: Words) => (n === 1 ? one : many);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "a, b y c" con la conjunción del idioma. */
const join = (items: string[], and: string) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;

// ---------------------------------------------------------------- Español

const es: Messages = {
  chart: {
    showAll: 'Ver todo',
    legend: 'Leyenda: pulsa un nombre para mostrarlo u ocultarlo',
    grid: 'Gráficos en cuadrícula',
    shown: (name) => `Ahora se ve ${name}`,
    hidden: (name) => `Ya no se ve ${name}`,
    zoomedTo: (from, to) => `Ahora ves de ${from} a ${to}`,
    zoomedAll: 'Ahora ves todos los datos',
    selection: (k, n, items) => `Selección: ${k} de ${n} ${plural(n, items)}`,
    selectionCleared: 'Ya no hay nada seleccionado',
    inSelection: 'en la selección',
    hiddenInChart: 'oculta en el gráfico',
    rightAxis: (name) => `${name} (eje derecho)`,
    tableTitle: 'Datos del gráfico',
    tableTruncated: (title, shown, total) =>
      `${title} (aquí van las primeras ${shown} de ${total} filas; descarga el CSV para verlas todas)`,
    realValue: 'Valor real',
    total: 'Total',
    value: 'valor',
    percentPoints: (v) => `${v} p. p.`,
    chartOf: (kinds) => 'Gráfico de ' + join(kinds, 'y'),
    chart: 'Gráfico',
    noDataYet: (what) => `${what}, todavía sin datos.`,
    withCount: (what, count) => `${what} con ${count}`,
    count: (n, items) => `${n} ${plural(n, items)}`,
    seriesAndItems: (series, items) => `${series} y ${items}`,
    series: ['serie', 'series'],
    points: ['punto', 'puntos'],
    categories: ['categoría', 'categorías'],
    folded: (n) => ` (${n} sumadas en Otros)`,
    span: (from, to) => `, de ${from} a ${to}`,
    highest: (x, v) => ` El más alto es ${x}, con ${v}.`,
    allEqual: (v) => ` Todos valen ${v}.`,
    explore: (keys) => ` Recorre los datos con ${keys}.`,
    arrows: 'las flechas',
    arrowsUpDown: 'las flechas arriba y abajo',
    arrowsLeftRight: 'las flechas izquierda y derecha',
    zoomKeys: ' Con + y − acercas o alejas; con 0 vuelves a verlo todo.',
    notes: (items) => ` Referencias: ${items.join('; ')}.`,
    midSentence: lower,
    weekOf: (date) => `Semana del ${date}`,
  },
  scrollbar: {
    window: 'Tramo visible',
    start: 'Inicio del tramo visible',
    end: 'Fin del tramo visible',
    range: (from, to) => `De ${from} a ${to}`,
    yWindow: 'Valores visibles',
    yStart: 'Valor más bajo visible',
    yEnd: 'Valor más alto visible',
    yRange: (from, to) => `Valores de ${from} a ${to}`,
  },
  data: {
    noData: 'Sin dato',
    notShown: 'No aparece',
    zeroOrLess: 'vale cero o menos',
    belowZero: 'vale menos de cero',
    missingEnds: 'le falta el origen o el destino',
    noPath: 'le falta la ruta',
    total: 'Total',
    ofTotal: 'Del total',
    of: (name) => `De ${name}`,
    group: 'Grupo',
    noGroup: 'Sin grupo',
    others: 'Otros',
    unnamed: 'Sin nombre',
    target: 'Meta',
    vsTarget: 'Frente a la meta',
  },
  bullet: {
    band: 'Franja',
    upTo: (v) => `Hasta ${v}`,
    between: (a, b) => `Entre ${a} y ${b}`,
    above: (v) => `Más de ${v} (pasa la última)`,
    position: (k, n) => `(${k} de ${n})`,
  },
  candlestick: { open: 'Apertura', high: 'Máximo', low: 'Mínimo', close: 'Cierre' },
  scatter: { size: 'Tamaño' },
  funnel: { fromStart: 'Del inicio', fromPrevious: 'Del paso anterior' },
  heatmap: { repeated: (name) => `${name} (repetida; se muestra la última)` },
  network: {
    connections: 'Conexiones',
    connectedMostly: 'Conectado sobre todo con',
    connected: 'Conectado con',
    andMore: (n) => ` y ${n} más`,
    none: 'ningún otro',
    noWeight: 'su peso es cero o menos',
    noSource: 'le falta el origen',
    pair: (a, b) => `${a} y ${b}`,
  },
  flows: {
    outOf: (name) => `De lo que sale de ${name}`,
    into: (name) => `De lo que llega a ${name}`,
    cycle: 'cerraría un ciclo',
    sameNode: 'empieza y termina en el mismo lugar',
  },
  timeline: {
    noValidDate: 'Sin fecha válida',
    end: 'Fin',
    notADate: 'no es una fecha válida',
    duration: 'Duración',
    note: 'Nota',
    reversed: 'las fechas venían al revés',
    today: 'Hoy',
    units: [
      ['año', 'años'],
      ['mes', 'meses'],
      ['día', 'días'],
      ['hora', 'horas'],
      ['minuto', 'minutos'],
    ],
    and: 'y',
  },
  waterfall: {
    step: 'Paso',
    total: 'Total',
    subtotal: 'Subtotal',
    unexplained: 'Diferencia sin explicar',
    cumulative: 'Acumulado',
    up: 'Subida',
    down: 'Bajada',
    flat: 'Sin cambio',
  },
  wordcloud: {
    noWord: 'la fila no tiene palabra',
    addsTo: 'Se suma a',
    joins: 'Junta',
    rows: (n) => `${n} filas`,
    noRoom: 'no cabe en el espacio',
    noWeight: 'su peso es cero o menos',
  },
  types: {
    line: { label: 'líneas' },
    bar: { label: 'barras' },
    area: { label: 'áreas' },
    step: { label: 'líneas escalonadas' },
    range: { label: 'bandas de rango' },
    scatter: { label: 'dispersión' },
    bubble: { label: 'burbujas' },
    candlestick: { label: 'velas' },
    ohlc: { label: 'barras de precios' },
    pie: { label: 'sectores', items: ['categoría', 'categorías'] },
    donut: { label: 'anillo', items: ['categoría', 'categorías'] },
    gauge: { label: 'medidor' },
    radar: { label: 'radar', items: ['criterio', 'criterios'] },
    funnel: { label: 'embudo', items: ['etapa', 'etapas'] },
    heatmap: { label: 'mapa de calor', items: ['celda', 'celdas'] },
    treemap: { label: 'rectángulos', items: ['parte', 'partes'] },
    sankey: { label: 'flujos', items: ['conexión', 'conexiones'] },
    choropleth: { label: 'mapa por colores', items: ['lugar', 'lugares'] },
    mapbubble: { label: 'mapa de burbujas', items: ['lugar', 'lugares'] },
    waterfall: { label: 'cascada', items: ['paso', 'pasos'], derived: 'acumulado' },
    bullet: { label: 'metas', items: ['indicador', 'indicadores'] },
    sunburst: { label: 'anillos por niveles', items: ['parte', 'partes'] },
    chord: { label: 'cuerdas', items: ['conexión', 'conexiones'] },
    timeline: { label: 'línea de tiempo', items: ['tramo', 'tramos'] },
    wordcloud: { label: 'nube de palabras', items: ['palabra', 'palabras'] },
    network: { label: 'red', items: ['conexión', 'conexiones'] },
  },
  warnings: {
    noOptions: "LozCharts: faltan las opciones. Pasa un objeto como { data, xAxis: { field: 'mes' }, series: [...] }.",
    noXField: "LozCharts: falta xAxis.field, el campo de cada fila que va en el eje X (por ejemplo xAxis: { field: 'mes' }).",
    badInit:
      'LozCharts: no pude leer las opciones de data-lozchart; revisa que sean un JSON válido o el selector de un <script>.',
    badAttribute: 'LozCharts: el atributo options no es un JSON válido, así que el gráfico sigue con las opciones anteriores.',
    noElement: (target) =>
      `LozCharts: no encontré nada que coincida con "${target}" en la página. Revisa el selector o crea el gráfico cuando el elemento ya exista.`,
    intl: (message) =>
      `LozCharts: Intl no acepta el locale, la moneda o el formato que diste (${message}); uso uno parecido. Revisa locale ('es', 'en', 'pt-BR'), currency (código ISO como 'USD') y xAxis.format.`,
    notObjects: (n) =>
      `LozCharts: ${n} de las filas de data no son objetos y las dejo fuera. Cada fila debe ser como { mes: 'ene', ventas: 120 }.`,
    noXFieldRows: (field) =>
      `LozCharts: ninguna fila tiene el campo "${field}" que pide xAxis.field. Revisa cómo está escrito (las mayúsculas cuentan).`,
    lostRows: (lost, total, time, field) =>
      `LozCharts: ${lost} de ${total} filas no tienen ${time ? 'una fecha válida (Date, milisegundos o texto como 2026-03-15)' : 'un número'} en "${field}" y quedan fuera del gráfico.`,
    unknownType: (type) =>
      `LozCharts: no conozco el tipo "${type}" y no dibujo esa serie. Revisa cómo está escrito o regístralo con LozChart.registerSeries('${type}', …).`,
    emptySeries: (field, name) =>
      `LozCharts: ninguna fila tiene el campo "${field}" de la serie "${name}", así que queda vacía. Revisa cómo está escrito (las mayúsculas cuentan).`,
    duplicateNames: (names) =>
      `LozCharts: hay varias series que se llaman ${names}; la leyenda y el tooltip no las distinguen y ocultar una oculta todas. Dale a cada una su propio name.`,
    cannotMix: (name, type, other) =>
      `LozCharts: "${name}" es de tipo ${type} y no se puede mezclar con ${other}, así que la dejo fuera. Ponla en otro gráfico.`,
    singleSeries: (type, name) =>
      `LozCharts: un gráfico de tipo ${type} muestra una sola serie; dibujo "${name}" y dejo fuera las demás. Para verlas todas, usa facet.`,
    tooManySeries: (n, max) =>
      `LozCharts: hay ${n} series y la paleta tiene ${max} colores, así que dibujo solo las primeras ${max}. Agrupa el resto o divide el gráfico.`,
    noRightAxis: (name) =>
      `LozCharts: "${name}" pide el eje derecho, pero en modo índice o en horizontal no hay; la dibujo en el izquierdo.`,
    indexNeedsPositive: (name) =>
      `LozCharts: "${name}" no empieza con un valor positivo, así que no puedo pasarla a índice base 100 y queda sin dibujar.`,
    palette: (n, max) => `LozCharts: tu paleta tiene ${n} colores y uso solo los primeros ${max}; con más, cuesta distinguirlos.`,
    noCanvas:
      'LozCharts: este navegador no deja dibujar en canvas, así que no puedo crear la imagen. Descarga el SVG en su lugar.',
    pngFailed: 'LozCharts: no pude crear el PNG. Vuelve a intentarlo o descarga el SVG.',
    pieNegative: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: en "${name}", ${one ? 'la fila' : 'las filas'} ${rows} ` +
        `${one ? 'tiene un valor negativo' : 'tienen valores negativos'}: un pie no puede mostrar partes negativas y ${one ? 'cuenta' : 'cuentan'} como cero. ` +
        'Para comparar subidas y bajadas, usa barras o una cascada.'
      );
    },
    chordLoops: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: en las cuerdas "${name}", ${one ? '1 fila empieza y termina' : `${k} filas empiezan y terminan`} en el mismo lugar y no ${one ? 'se dibuja' : 'se dibujan'}: ${list}. ` +
        'Cada cuerda necesita un origen y un destino distintos.'
      );
    },
    sankeyCycles: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: en el sankey "${name}", ${one ? '1 fila cierra' : `${k} filas cierran`} un ciclo y no ${one ? 'se dibuja' : 'se dibujan'}: ${list}. ` +
        `Un sankey va siempre hacia adelante; revisa el sentido de ${one ? 'ese flujo' : 'esos flujos'}.`
      );
    },
    noMap: (name) =>
      `LozCharts: no hay ningún mapa registrado como "${name}". Regístralo con LozChart.registerMap('${name}', …) antes de dibujar.`,
    missingPlaces: (name, list) =>
      `LozCharts: no encuentro estos lugares en el mapa "${name}": ${list}. Revisa cómo están escritos.`,
    timelineSwapped: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: en la línea de tiempo "${name}", ${list} ${one ? 'termina' : 'terminan'} antes de empezar. ` +
        `Lo dibujo con las fechas al revés; revisa el inicio y el fin de ${one ? 'esa fila' : 'esas filas'}.`
      );
    },
    waterfallTotals: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: en la cascada "${name}", ${one ? 'el total de la fila' : 'los totales de las filas'} ${rows} ` +
        `no ${one ? 'cuadra' : 'cuadran'} con la suma de los pasos anteriores. Dibujo ${one ? 'el total' : 'los totales'} que diste; revisa los datos si esperabas que cuadraran.`
      );
    },
    wordcloudOmitted: (name, k) =>
      `LozCharts: en la nube "${name}" no ${k === 1 ? 'cabe 1 palabra, la de menor peso' : `caben ${k} palabras, las de menor peso`}. ` +
      'Siguen en la tabla de datos; para que entren, agranda el gráfico o acorta la lista.',
  },
};

// ---------------------------------------------------------------- English

const en: Messages = {
  chart: {
    showAll: 'Show all',
    legend: 'Legend: select a name to show or hide it',
    grid: 'Chart grid',
    shown: (name) => `${name} is visible now`,
    hidden: (name) => `${name} is hidden now`,
    zoomedTo: (from, to) => `Now showing ${from} to ${to}`,
    zoomedAll: 'Now showing all the data',
    selection: (k, n, items) => `Selected: ${k} of ${n} ${plural(n, items)}`,
    selectionCleared: 'Nothing is selected now',
    inSelection: 'selected',
    hiddenInChart: 'hidden in the chart',
    rightAxis: (name) => `${name} (right axis)`,
    tableTitle: 'Chart data',
    tableTruncated: (title, shown, total) =>
      `${title} (showing the first ${shown} of ${total} rows; download the CSV to see them all)`,
    realValue: 'Actual value',
    total: 'Total',
    value: 'value',
    percentPoints: (v) => `${v} pp`,
    chartOf: (kinds) => upper(join(kinds, 'and')),
    chart: 'Chart',
    noDataYet: (what) => `${what}, no data yet.`,
    withCount: (what, count) => `${what} with ${count}`,
    count: (n, items) => `${n} ${plural(n, items)}`,
    seriesAndItems: (series, items) => `${series} and ${items}`,
    series: ['series', 'series'],
    points: ['point', 'points'],
    categories: ['category', 'categories'],
    folded: (n) => ` (${n} grouped into Other)`,
    span: (from, to) => `, from ${from} to ${to}`,
    highest: (x, v) => ` The highest is ${x}, at ${v}.`,
    allEqual: (v) => ` All values are ${v}.`,
    explore: (keys) => ` Use ${keys} to move through the data.`,
    arrows: 'the arrow keys',
    arrowsUpDown: 'the up and down arrow keys',
    arrowsLeftRight: 'the left and right arrow keys',
    zoomKeys: ' Press + or − to zoom in or out, and 0 to see everything again.',
    notes: (items) => ` Reference marks: ${items.join('; ')}.`,
    midSentence: (date) => date,
    weekOf: (date) => `Week of ${date}`,
  },
  scrollbar: {
    window: 'Visible range',
    start: 'Start of the visible range',
    end: 'End of the visible range',
    range: (from, to) => `${from} to ${to}`,
    yWindow: 'Visible values',
    yStart: 'Lowest visible value',
    yEnd: 'Highest visible value',
    yRange: (from, to) => `Values from ${from} to ${to}`,
  },
  data: {
    noData: 'No data',
    notShown: 'Not shown',
    zeroOrLess: 'it’s zero or less',
    belowZero: 'it’s below zero',
    missingEnds: 'it’s missing its source or target',
    noPath: 'it’s missing its path',
    total: 'Total',
    ofTotal: 'Of total',
    of: (name) => `Of ${name}`,
    group: 'Group',
    noGroup: 'No group',
    others: 'Other',
    unnamed: 'Unnamed',
    target: 'Target',
    vsTarget: 'Vs. target',
  },
  bullet: {
    band: 'Band',
    upTo: (v) => `Up to ${v}`,
    between: (a, b) => `${a} to ${b}`,
    above: (v) => `Over ${v} (past the last band)`,
    position: (k, n) => `(${k} of ${n})`,
  },
  candlestick: { open: 'Open', high: 'High', low: 'Low', close: 'Close' },
  scatter: { size: 'Size' },
  funnel: { fromStart: 'From start', fromPrevious: 'From previous stage' },
  heatmap: { repeated: (name) => `${name} (repeated; showing the last one)` },
  network: {
    connections: 'Connections',
    connectedMostly: 'Mostly connected to',
    connected: 'Connected to',
    andMore: (n) => ` and ${n} more`,
    none: 'no others',
    noWeight: 'its weight is zero or less',
    noSource: 'it’s missing its source',
    pair: (a, b) => `${a} and ${b}`,
  },
  flows: {
    outOf: (name) => `Of what leaves ${name}`,
    into: (name) => `Of what reaches ${name}`,
    cycle: 'it would close a loop',
    sameNode: 'it starts and ends at the same place',
  },
  timeline: {
    noValidDate: 'No valid date',
    end: 'End',
    notADate: 'not a valid date',
    duration: 'Duration',
    note: 'Note',
    reversed: 'the dates were reversed',
    today: 'Today',
    units: [
      ['year', 'years'],
      ['month', 'months'],
      ['day', 'days'],
      ['hour', 'hours'],
      ['minute', 'minutes'],
    ],
    and: 'and',
  },
  waterfall: {
    step: 'Step',
    total: 'Total',
    subtotal: 'Subtotal',
    unexplained: 'Unexplained difference',
    cumulative: 'Running total',
    up: 'Increase',
    down: 'Decrease',
    flat: 'No change',
  },
  wordcloud: {
    noWord: 'the row has no word',
    addsTo: 'Added to',
    joins: 'Combines',
    rows: (n) => `${n} rows`,
    noRoom: 'it doesn’t fit in the space',
    noWeight: 'its weight is zero or less',
  },
  types: {
    line: { label: 'line chart' },
    bar: { label: 'bar chart' },
    area: { label: 'area chart' },
    step: { label: 'step chart' },
    range: { label: 'range band' },
    scatter: { label: 'scatter plot' },
    bubble: { label: 'bubble chart' },
    candlestick: { label: 'candlestick chart' },
    ohlc: { label: 'OHLC chart' },
    pie: { label: 'pie chart', items: ['category', 'categories'] },
    donut: { label: 'donut chart', items: ['category', 'categories'] },
    gauge: { label: 'gauge' },
    radar: { label: 'radar chart', items: ['criterion', 'criteria'] },
    funnel: { label: 'funnel chart', items: ['stage', 'stages'] },
    heatmap: { label: 'heatmap', items: ['cell', 'cells'] },
    treemap: { label: 'treemap', items: ['part', 'parts'] },
    sankey: { label: 'sankey diagram', items: ['connection', 'connections'] },
    choropleth: { label: 'choropleth map', items: ['place', 'places'] },
    mapbubble: { label: 'bubble map', items: ['place', 'places'] },
    waterfall: { label: 'waterfall chart', items: ['step', 'steps'], derived: 'running total' },
    bullet: { label: 'bullet chart', items: ['indicator', 'indicators'] },
    sunburst: { label: 'sunburst chart', items: ['part', 'parts'] },
    chord: { label: 'chord diagram', items: ['connection', 'connections'] },
    timeline: { label: 'timeline', items: ['entry', 'entries'] },
    wordcloud: { label: 'word cloud', items: ['word', 'words'] },
    network: { label: 'network graph', items: ['connection', 'connections'] },
  },
  warnings: {
    noOptions: "LozCharts: the options are missing. Pass an object like { data, xAxis: { field: 'month' }, series: [...] }.",
    noXField:
      "LozCharts: xAxis.field is missing. It's the field of each row that goes on the X axis (for example xAxis: { field: 'month' }).",
    badInit: "LozCharts: I couldn't read the data-lozchart options. Check that they're valid JSON or the selector of a <script>.",
    badAttribute: "LozCharts: the options attribute isn't valid JSON, so the chart keeps its previous options.",
    noElement: (target) =>
      `LozCharts: nothing on the page matches "${target}". Check the selector, or create the chart once the element exists.`,
    intl: (message) =>
      `LozCharts: Intl doesn't accept the locale, currency or format you gave (${message}), so I'm using a close one. Check locale ('es', 'en', 'pt-BR'), currency (an ISO code like 'USD') and xAxis.format.`,
    notObjects: (n) =>
      `LozCharts: ${n} ${n === 1 ? "row in data isn't an object" : "rows in data aren't objects"}, so I'm leaving ${n === 1 ? 'it' : 'them'} out. Each row should look like { month: 'Jan', sales: 120 }.`,
    noXFieldRows: (field) =>
      `LozCharts: no row has the field "${field}" that xAxis.field asks for. Check how it's spelled (case matters).`,
    lostRows: (lost, total, time, field) =>
      `LozCharts: ${lost} of ${total} rows don't have ${time ? 'a valid date (a Date, milliseconds or text like 2026-03-15)' : 'a number'} in "${field}", so they're left out of the chart.`,
    unknownType: (type) =>
      `LozCharts: I don't know the type "${type}", so I'm not drawing that series. Check how it's spelled, or register it with LozChart.registerSeries('${type}', …).`,
    emptySeries: (field, name) =>
      `LozCharts: no row has the field "${field}" for the series "${name}", so it's empty. Check how it's spelled (case matters).`,
    duplicateNames: (names) =>
      `LozCharts: more than one series is named ${names}. The legend and the tooltip can't tell them apart, and hiding one hides them all. Give each one its own name.`,
    cannotMix: (name, type, other) =>
      `LozCharts: "${name}" is a ${type} series and can't be mixed with ${other}, so I'm leaving it out. Put it in another chart.`,
    singleSeries: (type, name) =>
      `LozCharts: a ${type} chart shows a single series. I'm drawing "${name}" and leaving out the rest. To see them all, use facet.`,
    tooManySeries: (n, max) =>
      `LozCharts: there are ${n} series and the palette has ${max} colors, so I'm only drawing the first ${max}. Group the rest or split the chart.`,
    noRightAxis: (name) =>
      `LozCharts: "${name}" asks for the right axis, but index mode and horizontal charts don't have one, so I'm drawing it on the left.`,
    indexNeedsPositive: (name) =>
      `LozCharts: "${name}" doesn't start with a positive value, so I can't turn it into a base-100 index and it isn't drawn.`,
    palette: (n, max) =>
      `LozCharts: your palette has ${n} colors and I only use the first ${max}; with more, they're hard to tell apart.`,
    noCanvas: "LozCharts: this browser doesn't allow drawing on a canvas, so I can't create the image. Download the SVG instead.",
    pngFailed: "LozCharts: I couldn't create the PNG. Try again or download the SVG.",
    pieNegative: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: in "${name}", ${one ? 'row' : 'rows'} ${rows} ${one ? 'has a negative value' : 'have negative values'}. ` +
        `A pie can't show negative parts, so ${one ? 'it counts' : 'they count'} as zero. To compare ups and downs, use bars or a waterfall.`
      );
    },
    chordLoops: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: in the chord diagram "${name}", ${one ? '1 row starts and ends' : `${k} rows start and end`} at the same place, so ${one ? "it isn't" : "they aren't"} drawn: ${list}. ` +
        'Each chord needs a different source and target.'
      );
    },
    sankeyCycles: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: in the sankey "${name}", ${one ? '1 row closes' : `${k} rows close`} a loop, so ${one ? "it isn't" : "they aren't"} drawn: ${list}. ` +
        `A sankey always flows forward; check the direction of ${one ? 'that flow' : 'those flows'}.`
      );
    },
    noMap: (name) =>
      `LozCharts: there's no map registered as "${name}". Register it with LozChart.registerMap('${name}', …) before drawing.`,
    missingPlaces: (name, list) =>
      `LozCharts: I can't find these places on the map "${name}": ${list}. Check how they're spelled.`,
    timelineSwapped: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: in the timeline "${name}", ${list} ${one ? 'ends before it starts' : 'end before they start'}. ` +
        `I'm drawing ${one ? 'it' : 'them'} with the dates swapped; check the start and end of ${one ? 'that row' : 'those rows'}.`
      );
    },
    waterfallTotals: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: in the waterfall "${name}", the ${one ? 'total in row' : 'totals in rows'} ${rows} ` +
        `${one ? "doesn't" : "don't"} match the sum of the steps before. I'm drawing the ${one ? 'total' : 'totals'} you gave; check the data if you expected ${one ? 'it' : 'them'} to match.`
      );
    },
    wordcloudOmitted: (name, k) =>
      `LozCharts: in the word cloud "${name}", ${k === 1 ? "1 word doesn't fit, the one with the lowest weight" : `${k} words don't fit, the ones with the lowest weight`}. ` +
      `${k === 1 ? "It's" : "They're"} still in the data table; to fit ${k === 1 ? 'it' : 'them'}, make the chart bigger or shorten the list.`,
  },
};

// ---------------------------------------------------------------- Português (Brasil)

const pt: Messages = {
  chart: {
    showAll: 'Ver tudo',
    legend: 'Legenda: clique em um nome para mostrar ou ocultar',
    grid: 'Gráficos em grade',
    shown: (name) => `Agora aparece: ${name}`,
    hidden: (name) => `Não aparece mais: ${name}`,
    zoomedTo: (from, to) => `Agora você vê de ${from} a ${to}`,
    zoomedAll: 'Agora você vê todos os dados',
    selection: (k, n, items) => `Seleção: ${k} de ${n} ${plural(n, items)}`,
    selectionCleared: 'Não há mais nada selecionado',
    inSelection: 'na seleção',
    hiddenInChart: 'oculta no gráfico',
    rightAxis: (name) => `${name} (eixo direito)`,
    tableTitle: 'Dados do gráfico',
    tableTruncated: (title, shown, total) =>
      `${title} (aqui estão as primeiras ${shown} de ${total} linhas; baixe o CSV para ver todas)`,
    realValue: 'Valor real',
    total: 'Total',
    value: 'valor',
    percentPoints: (v) => `${v} p.p.`,
    chartOf: (kinds) => 'Gráfico de ' + join(kinds, 'e'),
    chart: 'Gráfico',
    noDataYet: (what) => `${what}, ainda sem dados.`,
    withCount: (what, count) => `${what} com ${count}`,
    count: (n, items) => `${n} ${plural(n, items)}`,
    seriesAndItems: (series, items) => `${series} e ${items}`,
    series: ['série', 'séries'],
    points: ['ponto', 'pontos'],
    categories: ['categoria', 'categorias'],
    folded: (n) => ` (${n} somadas em Outros)`,
    span: (from, to) => `, de ${from} a ${to}`,
    highest: (x, v) => ` O mais alto é ${x}, com ${v}.`,
    allEqual: (v) => ` Todos valem ${v}.`,
    explore: (keys) => ` Navegue pelos dados com ${keys}.`,
    arrows: 'as setas',
    arrowsUpDown: 'as setas para cima e para baixo',
    arrowsLeftRight: 'as setas para a esquerda e para a direita',
    zoomKeys: ' Com + e − você aproxima ou afasta; com 0 volta a ver tudo.',
    notes: (items) => ` Referências: ${items.join('; ')}.`,
    midSentence: lower,
    weekOf: (date) => `Semana de ${date}`,
  },
  scrollbar: {
    window: 'Trecho visível',
    start: 'Início do trecho visível',
    end: 'Fim do trecho visível',
    range: (from, to) => `De ${from} a ${to}`,
    yWindow: 'Valores visíveis',
    yStart: 'Menor valor visível',
    yEnd: 'Maior valor visível',
    yRange: (from, to) => `Valores de ${from} a ${to}`,
  },
  data: {
    noData: 'Sem dado',
    notShown: 'Não aparece',
    zeroOrLess: 'vale zero ou menos',
    belowZero: 'vale menos que zero',
    missingEnds: 'falta a origem ou o destino',
    noPath: 'falta o caminho',
    total: 'Total',
    ofTotal: 'Do total',
    of: (name) => `De ${name}`,
    group: 'Grupo',
    noGroup: 'Sem grupo',
    others: 'Outros',
    unnamed: 'Sem nome',
    target: 'Meta',
    vsTarget: 'Em relação à meta',
  },
  bullet: {
    band: 'Faixa',
    upTo: (v) => `Até ${v}`,
    between: (a, b) => `Entre ${a} e ${b}`,
    above: (v) => `Acima de ${v} (passa da última)`,
    position: (k, n) => `(${k} de ${n})`,
  },
  candlestick: { open: 'Abertura', high: 'Máxima', low: 'Mínima', close: 'Fechamento' },
  scatter: { size: 'Tamanho' },
  funnel: { fromStart: 'Do início', fromPrevious: 'Da etapa anterior' },
  heatmap: { repeated: (name) => `${name} (repetida; vale a última)` },
  network: {
    connections: 'Conexões',
    connectedMostly: 'Conectado principalmente a',
    connected: 'Conectado a',
    andMore: (n) => ` e mais ${n}`,
    none: 'nenhum outro',
    noWeight: 'o peso é zero ou menos',
    noSource: 'falta a origem',
    pair: (a, b) => `${a} e ${b}`,
  },
  flows: {
    outOf: (name) => `Do que sai de ${name}`,
    into: (name) => `Do que chega a ${name}`,
    cycle: 'fecharia um ciclo',
    sameNode: 'começa e termina no mesmo lugar',
  },
  timeline: {
    noValidDate: 'Sem data válida',
    end: 'Fim',
    notADate: 'não é uma data válida',
    duration: 'Duração',
    note: 'Observação',
    reversed: 'as datas vieram invertidas',
    today: 'Hoje',
    units: [
      ['ano', 'anos'],
      ['mês', 'meses'],
      ['dia', 'dias'],
      ['hora', 'horas'],
      ['minuto', 'minutos'],
    ],
    and: 'e',
  },
  waterfall: {
    step: 'Passo',
    total: 'Total',
    subtotal: 'Subtotal',
    unexplained: 'Diferença sem explicação',
    cumulative: 'Acumulado',
    up: 'Alta',
    down: 'Queda',
    flat: 'Sem mudança',
  },
  wordcloud: {
    noWord: 'a linha não tem palavra',
    addsTo: 'Somada a',
    joins: 'Junta',
    rows: (n) => `${n} linhas`,
    noRoom: 'não cabe no espaço',
    noWeight: 'o peso é zero ou menos',
  },
  types: {
    line: { label: 'linhas' },
    bar: { label: 'barras' },
    area: { label: 'áreas' },
    step: { label: 'linhas em degraus' },
    range: { label: 'faixas de intervalo' },
    scatter: { label: 'dispersão' },
    bubble: { label: 'bolhas' },
    candlestick: { label: 'candlestick' },
    ohlc: { label: 'barras OHLC' },
    pie: { label: 'pizza', items: ['categoria', 'categorias'] },
    donut: { label: 'rosca', items: ['categoria', 'categorias'] },
    gauge: { label: 'medidor' },
    radar: { label: 'radar', items: ['critério', 'critérios'] },
    funnel: { label: 'funil', items: ['etapa', 'etapas'] },
    heatmap: { label: 'mapa de calor', items: ['célula', 'células'] },
    treemap: { label: 'retângulos', items: ['parte', 'partes'] },
    sankey: { label: 'fluxos', items: ['conexão', 'conexões'] },
    choropleth: { label: 'mapa por cores', items: ['lugar', 'lugares'] },
    mapbubble: { label: 'mapa de bolhas', items: ['lugar', 'lugares'] },
    waterfall: { label: 'cascata', items: ['passo', 'passos'], derived: 'acumulado' },
    bullet: { label: 'metas', items: ['indicador', 'indicadores'] },
    sunburst: { label: 'anéis por nível', items: ['parte', 'partes'] },
    chord: { label: 'cordas', items: ['conexão', 'conexões'] },
    timeline: { label: 'linha do tempo', items: ['item', 'itens'] },
    wordcloud: { label: 'nuvem de palavras', items: ['palavra', 'palavras'] },
    network: { label: 'rede', items: ['conexão', 'conexões'] },
  },
  warnings: {
    noOptions: "LozCharts: faltam as opções. Passe um objeto como { data, xAxis: { field: 'mes' }, series: [...] }.",
    noXField: "LozCharts: falta xAxis.field, o campo de cada linha que vai no eixo X (por exemplo xAxis: { field: 'mes' }).",
    badInit: 'LozCharts: não consegui ler as opções de data-lozchart; confira se são um JSON válido ou o seletor de um <script>.',
    badAttribute: 'LozCharts: o atributo options não é um JSON válido, então o gráfico continua com as opções anteriores.',
    noElement: (target) =>
      `LozCharts: não encontrei nada que corresponda a "${target}" na página. Confira o seletor ou crie o gráfico quando o elemento já existir.`,
    intl: (message) =>
      `LozCharts: o Intl não aceita o locale, a moeda ou o formato que você passou (${message}); uso um parecido. Confira locale ('es', 'en', 'pt-BR'), currency (código ISO como 'BRL') e xAxis.format.`,
    notObjects: (n) =>
      `LozCharts: ${n} das linhas de data não ${n === 1 ? 'é objeto e fica' : 'são objetos e ficam'} de fora. Cada linha deve ser como { mes: 'jan', vendas: 120 }.`,
    noXFieldRows: (field) =>
      `LozCharts: nenhuma linha tem o campo "${field}" que xAxis.field pede. Confira como está escrito (maiúsculas e minúsculas fazem diferença).`,
    lostRows: (lost, total, time, field) =>
      `LozCharts: ${lost} de ${total} linhas não têm ${time ? 'uma data válida (Date, milissegundos ou texto como 2026-03-15)' : 'um número'} em "${field}" e ficam fora do gráfico.`,
    unknownType: (type) =>
      `LozCharts: não conheço o tipo "${type}" e não desenho essa série. Confira como está escrito ou registre com LozChart.registerSeries('${type}', …).`,
    emptySeries: (field, name) =>
      `LozCharts: nenhuma linha tem o campo "${field}" da série "${name}", então ela fica vazia. Confira como está escrito (maiúsculas e minúsculas fazem diferença).`,
    duplicateNames: (names) =>
      `LozCharts: há várias séries chamadas ${names}; a legenda e o tooltip não conseguem diferenciá-las, e ocultar uma oculta todas. Dê a cada uma o seu próprio name.`,
    cannotMix: (name, type, other) =>
      `LozCharts: "${name}" é do tipo ${type} e não pode ser misturada com ${other}, então fica de fora. Coloque em outro gráfico.`,
    singleSeries: (type, name) =>
      `LozCharts: um gráfico do tipo ${type} mostra uma única série; desenho "${name}" e deixo as outras de fora. Para ver todas, use facet.`,
    tooManySeries: (n, max) =>
      `LozCharts: há ${n} séries e a paleta tem ${max} cores, então desenho só as primeiras ${max}. Agrupe o resto ou divida o gráfico.`,
    noRightAxis: (name) =>
      `LozCharts: "${name}" pede o eixo direito, mas no modo índice ou na horizontal ele não existe; desenho no esquerdo.`,
    indexNeedsPositive: (name) =>
      `LozCharts: "${name}" não começa com um valor positivo, então não consigo convertê-la em índice base 100 e ela fica sem desenhar.`,
    palette: (n, max) =>
      `LozCharts: sua paleta tem ${n} cores e uso só as primeiras ${max}; com mais, fica difícil diferenciá-las.`,
    noCanvas: 'LozCharts: este navegador não permite desenhar em canvas, então não consigo criar a imagem. Baixe o SVG.',
    pngFailed: 'LozCharts: não consegui criar o PNG. Tente de novo ou baixe o SVG.',
    pieNegative: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: em "${name}", ${one ? 'a linha' : 'as linhas'} ${rows} ` +
        `${one ? 'tem um valor negativo' : 'têm valores negativos'}: uma pizza não mostra partes negativas e ${one ? 'ela conta' : 'elas contam'} como zero. ` +
        'Para comparar altas e quedas, use barras ou uma cascata.'
      );
    },
    chordLoops: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: nas cordas "${name}", ${one ? '1 linha começa e termina' : `${k} linhas começam e terminam`} no mesmo lugar e não ${one ? 'é desenhada' : 'são desenhadas'}: ${list}. ` +
        'Cada corda precisa de uma origem e um destino diferentes.'
      );
    },
    sankeyCycles: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: no sankey "${name}", ${one ? '1 linha fecha' : `${k} linhas fecham`} um ciclo e não ${one ? 'é desenhada' : 'são desenhadas'}: ${list}. ` +
        `Um sankey sempre segue para a frente; confira o sentido ${one ? 'desse fluxo' : 'desses fluxos'}.`
      );
    },
    noMap: (name) =>
      `LozCharts: não há nenhum mapa registrado como "${name}". Registre com LozChart.registerMap('${name}', …) antes de desenhar.`,
    missingPlaces: (name, list) =>
      `LozCharts: não encontro estes lugares no mapa "${name}": ${list}. Confira como estão escritos.`,
    timelineSwapped: (name, list, k) => {
      const one = k === 1;
      return (
        `LozCharts: na linha do tempo "${name}", ${list} ${one ? 'termina' : 'terminam'} antes de começar. ` +
        `Desenho com as datas invertidas; confira o início e o fim ${one ? 'dessa linha' : 'dessas linhas'}.`
      );
    },
    waterfallTotals: (name, rows, k) => {
      const one = k === 1;
      return (
        `LozCharts: na cascata "${name}", ${one ? 'o total da linha' : 'os totais das linhas'} ${rows} ` +
        `não ${one ? 'bate' : 'batem'} com a soma dos passos anteriores. Desenho ${one ? 'o total' : 'os totais'} que você passou; confira os dados se esperava que ${one ? 'batesse' : 'batessem'}.`
      );
    },
    wordcloudOmitted: (name, k) =>
      `LozCharts: na nuvem "${name}" não ${k === 1 ? 'cabe 1 palavra, a de menor peso' : `cabem ${k} palavras, as de menor peso`}. ` +
      `${k === 1 ? 'Ela continua' : 'Elas continuam'} na tabela de dados; para que ${k === 1 ? 'caiba' : 'caibam'}, aumente o gráfico ou encurte a lista.`,
  },
};

// ---------------------------------------------------------------- Registro y elección

const catalogs = new Map<string, Messages>([
  ['es', es],
  ['en', en],
  ['pt', pt],
]);

/** 'pt-BR' → 'pt-br'; 'es_ES' → 'es-es': la forma con la que se guardan y se buscan los catálogos. */
const keyOf = (code: string) => code.trim().toLowerCase().replace(/_/g, '-');
/** El idioma sin la región: 'pt-br' → 'pt'. */
const languageOf = (code: string) => keyOf(code).split('-')[0];

/** El catálogo de un código: el exacto ('pt-br'), el de su idioma ('pt') o ninguno. */
function lookup(code: string): Messages | undefined {
  const key = keyOf(code);
  return catalogs.get(key) ?? catalogs.get(languageOf(key));
}

/**
 * Agrega un idioma o cambia textos de uno que existe. Un idioma nuevo toma del inglés lo que no
 * se dé; uno que ya existe ('es', 'pt-BR' sobre 'pt') conserva lo que no se cambie. Los nombres de
 * los tipos se combinan tipo por tipo: `{ types: { bar: { label: 'colonnes' } } }` cambia solo ese.
 */
export function registerLocale(code: string, messages: PartialMessages): void {
  const base = lookup(code) ?? en;
  const out = { ...base } as Record<string, unknown>;
  for (const [group, value] of Object.entries(messages)) {
    if (!value || typeof value !== 'object') continue;
    const prev = (base as unknown as Record<string, Record<string, unknown>>)[group] ?? {};
    if (group === 'types') {
      const types: Record<string, TypeTexts> = { ...(prev as Record<string, TypeTexts>) };
      for (const [name, texts] of Object.entries(value as Record<string, TypeTexts>)) types[name] = merge(types[name], texts);
      out.types = types;
    } else out[group] = merge(prev, value);
  }
  catalogs.set(keyOf(code), out as unknown as Messages);
}

/** `base` con lo definido en `extra`: un texto ausente o undefined queda como estaba. */
function merge<T extends object>(base: T | undefined, extra: object): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) out[k] = v;
  return out as T;
}

/**
 * Idioma por defecto: el de la página (`<html lang="pt-BR">`) si hay catálogo para él (español,
 * inglés, portugués o uno registrado); si no hay o es otro, inglés.
 */
export function defaultLocale(): string {
  const lang = typeof document !== 'undefined' ? document.documentElement?.lang?.trim() : '';
  return lang && lookup(lang) ? lang : 'en';
}

/** Los mensajes de un idioma: su catálogo, el de su idioma sin región, o inglés. Sin idioma, el de la página. */
export function messages(locale?: string): Messages {
  return lookup(locale ?? defaultLocale()) ?? en;
}

/**
 * Un texto de una extensión en uno o varios idiomas: el mismo para todos ('barras'), uno por
 * idioma ({ es: 'barras', en: 'bar chart', pt: 'barras' }, con o sin región: 'pt-BR') o una
 * función del locale del gráfico.
 */
export type Localized<T> = T | Readonly<Record<string, T>> | ((locale: string) => T);

/**
 * El valor de un Localized en el idioma dado: su función, o la clave exacta ('pt-br'), la del
 * idioma ('pt'), otra variante del idioma ('pt-BR' para 'pt-PT'), la del inglés o la primera que haya.
 */
export function localized<T>(value: Localized<T> | undefined, locale?: string): T | undefined {
  if (value === undefined || value === null) return undefined;
  const code = locale ?? defaultLocale();
  if (typeof value === 'function') return (value as (locale: string) => T)(code);
  if (typeof value !== 'object' || Array.isArray(value)) return value as T;
  const byKey = new Map(Object.entries(value as Record<string, T>).map(([k, v]) => [keyOf(k), v] as const));
  const lang = languageOf(code);
  const sameLanguage = [...byKey].find(([k]) => languageOf(k) === lang)?.[1];
  const english = [...byKey].find(([k]) => languageOf(k) === 'en')?.[1];
  return byKey.get(keyOf(code)) ?? byKey.get(lang) ?? sameLanguage ?? english ?? byKey.values().next().value;
}

/** El idioma, sin la región, de un locale ('pt-BR' → 'pt'); sin locale, el de la página. */
export function language(locale?: string): string {
  return languageOf(locale ?? defaultLocale());
}

/** El idioma que puede usar Intl para un locale mal escrito ('es_ES' → 'es'), o inglés. */
export function intlFallback(locale: string): string {
  return languageOf(locale) || 'en';
}
