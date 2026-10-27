/**
 * Textos de los gráficos por capas, en español, inglés y portugués de Brasil: los avisos de la
 * validación, los errores de las expresiones y lo que el gráfico muestra o anuncia (la leyenda del
 * semáforo, el nombre de cada ícono). Van aparte del catálogo general mientras las capas son una
 * muestra; si se quedan, pasan a core/i18n como un grupo más.
 */
import { language } from '@lozcharts/core';

export interface LayerTexts {
  /** Nombre del tipo en la descripción accesible y cómo se llaman sus datos. */
  label: string;
  items: readonly [string, string];
  /** Encabezado de la primera columna de la tabla de datos, y de la columna del valor. */
  item: string;
  value: string;
  /** Minigráfico: primer y último valor, el cambio entre ellos y los extremos. */
  spark: { first: string; last: string; change: string; lowest: string; highest: string };
  worse: string;
  better: string;
  byRow: string;
  byColumn: string;
  /** Tramos de una escala por umbrales: "menos de 90", "90 a 95", "95 o más". */
  below: (v: string) => string;
  between: (a: string, b: string) => string;
  above: (v: string) => string;
  /** Nombre de cada ícono propio, para lectores de pantalla. */
  icons: Record<string, string>;
  /** "Ícono": el texto alternativo de un ícono hecho con un path o una imagen sin `alt`. */
  icon: string;
  expr: {
    empty: string;
    tooLong: (max: number) => string;
    tooDeep: string;
    badChar: (ch: string, pos: number) => string;
    unclosedString: (pos: number) => string;
    unclosedField: (pos: number) => string;
    /** Falta un valor (un número, un campo, un texto) donde está `found` (vacío: al final). */
    needValue: (found: string, pos: number) => string;
    /** Falta un cierre o una coma. */
    needToken: (token: string, found: string, pos: number) => string;
    extra: (found: string, pos: number) => string;
    didYouMean: (found: string, op: string) => string;
    unknownFunction: (name: string, list: string) => string;
    arity: (name: string, min: number, max: number) => string;
  };
  check: {
    notObject: string;
    noLayers: string;
    badData: string;
    notRows: (name: string, count: number) => string;
    unknownData: (name: string, list: string) => string;
    unknownKey: (key: string, hint: string) => string;
    unknownMark: (mark: string, list: string, hint: string) => string;
    missing: (channel: string, mark: string) => string;
    noField: (field: string, data: string, hint: string) => string;
    badExpr: (message: string) => string;
    unknownColor: (value: string, hint: string) => string;
    unknownIcon: (value: string, hint: string) => string;
    unknownScale: (value: string) => string;
    badBy: (value: string) => string;
    badThresholds: string;
    badCond: string;
    badMap: string;
    badNumber: (key: string) => string;
    badChoice: (key: string, list: string) => string;
    needsGeo: (key: string) => string;
    needsNetwork: (key: string) => string;
    needsPosition: (mark: string) => string;
    noMap: (name: string) => string;
    /** "¿Quisiste decir "valor"?", con su espacio inicial; vacío si no hay a qué parecerse. */
    hint: (name: string) => string;
  };
}

const es: LayerTexts = {
  label: 'capas',
  items: ['dato', 'datos'],
  item: 'Dato',
  value: 'Valor',
  spark: { first: 'Primero', last: 'Último', change: 'Cambio', lowest: 'Mínimo', highest: 'Máximo' },
  worse: 'Peor',
  better: 'Mejor',
  byRow: 'por fila',
  byColumn: 'por columna',
  below: (v) => `menos de ${v}`,
  between: (a, b) => `${a} a ${b}`,
  above: (v) => `${v} o más`,
  icon: 'Ícono',
  icons: {
    pin: 'marcador',
    smile: 'carita feliz',
    meh: 'carita seria',
    sad: 'carita triste',
    alert: 'alerta',
    check: 'visto bueno',
    cross: 'equis',
    'arrow-up': 'flecha arriba',
    'arrow-down': 'flecha abajo',
    antenna: 'antena',
    star: 'estrella',
    fire: 'fuego',
    bolt: 'rayo',
    heart: 'corazón',
    flag: 'bandera',
    dot: 'punto',
    info: 'información',
    clock: 'reloj',
    signal: 'señal',
    home: 'casa',
    user: 'persona',
    sun: 'sol',
    cloud: 'nube',
    partly: 'sol con nubes',
    rain: 'lluvia',
    storm: 'tormenta',
    snow: 'nieve',
    wind: 'viento',
    plane: 'avión de papel',
  },
  expr: {
    empty: 'La expresión está vacía.',
    tooLong: (max) => `La expresión es muy larga (más de ${max} caracteres).`,
    tooDeep: 'La expresión tiene demasiados paréntesis anidados.',
    badChar: (ch, pos) =>
      `El carácter "${ch}" no se puede usar en una expresión (posición ${pos}). Si es parte del nombre de un campo, escríbelo entre acentos graves: \`mi campo\`.`,
    unclosedString: (pos) => `Falta cerrar el texto que empieza en la posición ${pos}.`,
    unclosedField: (pos) => `Falta cerrar con \` el nombre de campo que empieza en la posición ${pos}.`,
    needValue: (found, pos) =>
      found ? `Esperaba un valor en la posición ${pos} y encontré "${found}".` : 'Falta un valor al final de la expresión.',
    needToken: (token, found, pos) =>
      found ? `Esperaba "${token}" en la posición ${pos} y encontré "${found}".` : `Falta "${token}" al final de la expresión.`,
    extra: (found, pos) => `Sobra "${found}" en la posición ${pos}.`,
    didYouMean: (found, op) => `"${found}" no es un operador; ¿quisiste decir "${op}"?`,
    unknownFunction: (name, list) => `No conozco la función "${name}". Puedes usar ${list}.`,
    arity: (name, min, max) =>
      min === max
        ? `${name}() lleva ${min} ${min === 1 ? 'valor' : 'valores'}.`
        : `${name}() lleva de ${min} a ${max === Infinity ? 'varios' : max} valores.`,
  },
  check: {
    notObject: 'La especificación debe ser un objeto JSON, como { "data": [...], "layers": [...] }.',
    noLayers: 'Falta "layers": la lista de capas, por ejemplo [{ "mark": "point", "x": "mes", "y": "ventas" }].',
    badData: '"data" debe ser una lista de filas o un objeto con listas con nombre ({ "sitios": [...] }).',
    notRows: (name, k) =>
      `${k} ${k === 1 ? 'fila' : 'filas'} de "${name}" no ${k === 1 ? 'es un objeto' : 'son objetos'} y quedan fuera.`,
    unknownData: (name, list) => `No hay datos llamados "${name}". ${list ? `Los que hay: ${list}.` : ''}`,
    unknownKey: (key, hint) => `No conozco "${key}" aquí, así que lo ignoro.${hint}`,
    unknownMark: (mark, list, hint) => `No conozco la marca "${mark}".${hint} Las que hay: ${list}.`,
    missing: (channel, mark) => `Una capa "${mark}" necesita "${channel}".`,
    noField: (field, data, hint) => `Ninguna fila de ${data} tiene el campo "${field}".${hint}`,
    badExpr: (message) => message,
    unknownColor: (value, hint) =>
      `No conozco el color "${value}".${hint} Usa un nombre (good, warn, bad, violet, pink…), un número de la paleta del 1 al 8 o un #hex.`,
    unknownIcon: (value, hint) => `No conozco el ícono "${value}".${hint} También puedes poner un emoji.`,
    unknownScale: (value) => `No conozco la escala "${value}". Usa "traffic-light", "sequential" o "diverging".`,
    badBy: (value) => `"by" no puede ser "${value}": usa "row" (por fila), "column" (por columna) o "all" (todo junto).`,
    badThresholds: '"thresholds" debe ser una lista de números de menor a mayor, como [90, 95].',
    badCond: 'Una condición lleva "if" (la pregunta) y "then" (y, si quieres, "else").',
    badMap: '"map" debe ser un objeto que traduce cada valor, como { "bien": "good", "mal": "bad" }.',
    badNumber: (key) => `"${key}" debe ser un número.`,
    badChoice: (key, list) => `"${key}" debe ser ${list}.`,
    needsGeo: (key) => `"${key}" solo sirve en un mapa: agrega "geo": { "map": "mundo" } al gráfico.`,
    needsNetwork: (key) => `"${key}" solo sirve en una red: agrega "network": { "nodes": ..., "links": ... } al gráfico.`,
    needsPosition: (mark) => `La capa "${mark}" no sabe dónde ir: dale "x" e "y" (o "lon" y "lat" en un mapa).`,
    noMap: (name) =>
      `No hay ningún mapa llamado "${name}". Carga el del mundo con @lozcharts/core/maps/world (o maps/world.umd.js).`,
    hint: (name) => (name ? ` ¿Quisiste decir "${name}"?` : ''),
  },
};

const en: LayerTexts = {
  label: 'layered chart',
  items: ['item', 'items'],
  item: 'Item',
  value: 'Value',
  spark: { first: 'First', last: 'Last', change: 'Change', lowest: 'Lowest', highest: 'Highest' },
  worse: 'Worse',
  better: 'Better',
  byRow: 'by row',
  byColumn: 'by column',
  below: (v) => `under ${v}`,
  between: (a, b) => `${a} to ${b}`,
  above: (v) => `${v} and up`,
  icon: 'Icon',
  icons: {
    pin: 'pin',
    smile: 'happy face',
    meh: 'neutral face',
    sad: 'sad face',
    alert: 'warning',
    check: 'check mark',
    cross: 'cross mark',
    'arrow-up': 'up arrow',
    'arrow-down': 'down arrow',
    antenna: 'antenna',
    star: 'star',
    fire: 'fire',
    bolt: 'lightning',
    heart: 'heart',
    flag: 'flag',
    dot: 'dot',
    info: 'information',
    clock: 'clock',
    signal: 'signal',
    home: 'home',
    user: 'person',
    sun: 'sun',
    cloud: 'cloud',
    partly: 'partly cloudy',
    rain: 'rain',
    storm: 'storm',
    snow: 'snow',
    wind: 'wind',
    plane: 'paper plane',
  },
  expr: {
    empty: 'The expression is empty.',
    tooLong: (max) => `The expression is too long (over ${max} characters).`,
    tooDeep: 'The expression has too many nested parentheses.',
    badChar: (ch, pos) =>
      `"${ch}" can't be used in an expression (position ${pos}). If it's part of a field name, wrap the name in backticks: \`my field\`.`,
    unclosedString: (pos) => `The text that starts at position ${pos} is never closed.`,
    unclosedField: (pos) => `The field name that starts at position ${pos} needs a closing \`.`,
    needValue: (found, pos) =>
      found ? `Expected a value at position ${pos} but found "${found}".` : 'A value is missing at the end of the expression.',
    needToken: (token, found, pos) =>
      found
        ? `Expected "${token}" at position ${pos} but found "${found}".`
        : `"${token}" is missing at the end of the expression.`,
    extra: (found, pos) => `Unexpected "${found}" at position ${pos}.`,
    didYouMean: (found, op) => `"${found}" isn't an operator; did you mean "${op}"?`,
    unknownFunction: (name, list) => `There's no function called "${name}". You can use ${list}.`,
    arity: (name, min, max) =>
      min === max
        ? `${name}() takes ${min} ${min === 1 ? 'value' : 'values'}.`
        : `${name}() takes ${min} to ${max === Infinity ? 'any number of' : max} values.`,
  },
  check: {
    notObject: 'The spec must be a JSON object, like { "data": [...], "layers": [...] }.',
    noLayers: '"layers" is missing: the list of layers, for example [{ "mark": "point", "x": "month", "y": "sales" }].',
    badData: '"data" must be a list of rows or an object with named lists ({ "sites": [...] }).',
    notRows: (name, k) =>
      `${k} ${k === 1 ? 'row' : 'rows'} in "${name}" ${k === 1 ? "isn't an object" : "aren't objects"} and ${k === 1 ? 'is' : 'are'} left out.`,
    unknownData: (name, list) => `There's no data called "${name}". ${list ? `Available: ${list}.` : ''}`,
    unknownKey: (key, hint) => `"${key}" isn't known here, so it's ignored.${hint}`,
    unknownMark: (mark, list, hint) => `There's no mark called "${mark}".${hint} Available: ${list}.`,
    missing: (channel, mark) => `A "${mark}" layer needs "${channel}".`,
    noField: (field, data, hint) => `No row in ${data} has the field "${field}".${hint}`,
    badExpr: (message) => message,
    unknownColor: (value, hint) =>
      `"${value}" isn't a known color.${hint} Use a name (good, warn, bad, violet, pink…), a palette number from 1 to 8 or a #hex.`,
    unknownIcon: (value, hint) => `There's no icon called "${value}".${hint} You can also use an emoji.`,
    unknownScale: (value) => `There's no scale called "${value}". Use "traffic-light", "sequential" or "diverging".`,
    badBy: (value) => `"by" can't be "${value}": use "row", "column" or "all".`,
    badThresholds: '"thresholds" must be a list of numbers from low to high, like [90, 95].',
    badCond: 'A condition needs "if" (the question) and "then" (and "else" if you like).',
    badMap: '"map" must be an object that translates each value, like { "ok": "good", "down": "bad" }.',
    badNumber: (key) => `"${key}" must be a number.`,
    badChoice: (key, list) => `"${key}" must be ${list}.`,
    needsGeo: (key) => `"${key}" only works on a map: add "geo": { "map": "mundo" } to the chart.`,
    needsNetwork: (key) => `"${key}" only works in a network: add "network": { "nodes": ..., "links": ... } to the chart.`,
    needsPosition: (mark) => `The "${mark}" layer doesn't know where to go: give it "x" and "y" (or "lon" and "lat" on a map).`,
    noMap: (name) =>
      `There's no map called "${name}". Load the world map with @lozcharts/core/maps/world (or maps/world.umd.js).`,
    hint: (name) => (name ? ` Did you mean "${name}"?` : ''),
  },
};

const pt: LayerTexts = {
  label: 'camadas',
  items: ['item', 'itens'],
  item: 'Item',
  value: 'Valor',
  spark: { first: 'Primeiro', last: 'Último', change: 'Variação', lowest: 'Mínimo', highest: 'Máximo' },
  worse: 'Pior',
  better: 'Melhor',
  byRow: 'por linha',
  byColumn: 'por coluna',
  below: (v) => `menos de ${v}`,
  between: (a, b) => `${a} a ${b}`,
  above: (v) => `${v} ou mais`,
  icon: 'Ícone',
  icons: {
    pin: 'marcador',
    smile: 'carinha feliz',
    meh: 'carinha neutra',
    sad: 'carinha triste',
    alert: 'alerta',
    check: 'sinal de certo',
    cross: 'xis',
    'arrow-up': 'seta para cima',
    'arrow-down': 'seta para baixo',
    antenna: 'antena',
    star: 'estrela',
    fire: 'fogo',
    bolt: 'raio',
    heart: 'coração',
    flag: 'bandeira',
    dot: 'ponto',
    info: 'informação',
    clock: 'relógio',
    signal: 'sinal',
    home: 'casa',
    user: 'pessoa',
    sun: 'sol',
    cloud: 'nuvem',
    partly: 'sol com nuvens',
    rain: 'chuva',
    storm: 'tempestade',
    snow: 'neve',
    wind: 'vento',
    plane: 'avião de papel',
  },
  expr: {
    empty: 'A expressão está vazia.',
    tooLong: (max) => `A expressão é longa demais (mais de ${max} caracteres).`,
    tooDeep: 'A expressão tem parênteses aninhados demais.',
    badChar: (ch, pos) =>
      `O caractere "${ch}" não pode ser usado numa expressão (posição ${pos}). Se faz parte do nome de um campo, escreva entre crases: \`meu campo\`.`,
    unclosedString: (pos) => `Falta fechar o texto que começa na posição ${pos}.`,
    unclosedField: (pos) => `Falta fechar com \` o nome de campo que começa na posição ${pos}.`,
    needValue: (found, pos) =>
      found ? `Esperava um valor na posição ${pos} e encontrei "${found}".` : 'Falta um valor no fim da expressão.',
    needToken: (token, found, pos) =>
      found ? `Esperava "${token}" na posição ${pos} e encontrei "${found}".` : `Falta "${token}" no fim da expressão.`,
    extra: (found, pos) => `Sobra "${found}" na posição ${pos}.`,
    didYouMean: (found, op) => `"${found}" não é um operador; você quis dizer "${op}"?`,
    unknownFunction: (name, list) => `Não conheço a função "${name}". Você pode usar ${list}.`,
    arity: (name, min, max) =>
      min === max
        ? `${name}() leva ${min} ${min === 1 ? 'valor' : 'valores'}.`
        : `${name}() leva de ${min} a ${max === Infinity ? 'vários' : max} valores.`,
  },
  check: {
    notObject: 'A especificação deve ser um objeto JSON, como { "data": [...], "layers": [...] }.',
    noLayers: 'Falta "layers": a lista de camadas, por exemplo [{ "mark": "point", "x": "mes", "y": "vendas" }].',
    badData: '"data" deve ser uma lista de linhas ou um objeto com listas com nome ({ "sites": [...] }).',
    notRows: (name, k) =>
      `${k} ${k === 1 ? 'linha' : 'linhas'} de "${name}" não ${k === 1 ? 'é um objeto e fica' : 'são objetos e ficam'} de fora.`,
    unknownData: (name, list) => `Não há dados chamados "${name}". ${list ? `Os que existem: ${list}.` : ''}`,
    unknownKey: (key, hint) => `Não conheço "${key}" aqui, então ignoro.${hint}`,
    unknownMark: (mark, list, hint) => `Não conheço a marca "${mark}".${hint} As que existem: ${list}.`,
    missing: (channel, mark) => `Uma camada "${mark}" precisa de "${channel}".`,
    noField: (field, data, hint) => `Nenhuma linha de ${data} tem o campo "${field}".${hint}`,
    badExpr: (message) => message,
    unknownColor: (value, hint) =>
      `Não conheço a cor "${value}".${hint} Use um nome (good, warn, bad, violet, pink…), um número da paleta de 1 a 8 ou um #hex.`,
    unknownIcon: (value, hint) => `Não conheço o ícone "${value}".${hint} Você também pode usar um emoji.`,
    unknownScale: (value) => `Não conheço a escala "${value}". Use "traffic-light", "sequential" ou "diverging".`,
    badBy: (value) => `"by" não pode ser "${value}": use "row" (por linha), "column" (por coluna) ou "all" (tudo junto).`,
    badThresholds: '"thresholds" deve ser uma lista de números do menor para o maior, como [90, 95].',
    badCond: 'Uma condição leva "if" (a pergunta) e "then" (e, se quiser, "else").',
    badMap: '"map" deve ser um objeto que traduz cada valor, como { "bom": "good", "ruim": "bad" }.',
    badNumber: (key) => `"${key}" deve ser um número.`,
    badChoice: (key, list) => `"${key}" deve ser ${list}.`,
    needsGeo: (key) => `"${key}" só funciona num mapa: adicione "geo": { "map": "mundo" } ao gráfico.`,
    needsNetwork: (key) => `"${key}" só funciona numa rede: adicione "network": { "nodes": ..., "links": ... } ao gráfico.`,
    needsPosition: (mark) => `A camada "${mark}" não sabe onde ficar: dê "x" e "y" (ou "lon" e "lat" num mapa).`,
    noMap: (name) =>
      `Não há nenhum mapa chamado "${name}". Carregue o do mundo com @lozcharts/core/maps/world (ou maps/world.umd.js).`,
    hint: (name) => (name ? ` Você quis dizer "${name}"?` : ''),
  },
};

const catalogs: Record<string, LayerTexts> = { es, en, pt };

/** Los textos en el idioma del gráfico (sin región), o en inglés. */
export function layerTexts(locale?: string): LayerTexts {
  return catalogs[language(locale)] ?? en;
}

/** "a, b o c": una lista corta para los avisos, con comillas. */
export function quoteList(list: readonly string[]): string {
  return list.map((s) => `"${s}"`).join(', ');
}

/**
 * El nombre conocido más parecido a `name` (distancia de edición pequeña o mayúsculas distintas),
 * para sugerir en un aviso; '' si ninguno se parece.
 */
export function closest(name: string, known: Iterable<string>): string {
  const target = name.toLowerCase();
  let best = '';
  let bestDist = Infinity;
  for (const k of known) {
    const d = k.toLowerCase() === target ? 0 : distance(target, k.toLowerCase());
    if (d < bestDist) [best, bestDist] = [k, d];
  }
  // Hasta un tercio de las letras mal: "colour" → "color", pero "zzz" no se parece a nada.
  return bestDist <= Math.max(1, Math.floor(name.length / 3)) ? best : '';
}

/** Distancia de edición entre dos textos cortos, con el cambio de dos letras vecinas como un solo error ("valro"). */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
