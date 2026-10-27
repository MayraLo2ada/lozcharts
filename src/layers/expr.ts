/**
 * Expresiones de las capas: "valor >= meta", "abs(delta) > 2 and region == 'Costa'".
 *
 * Un lenguaje pequeño con su propio lector y su propio evaluador: nunca pasa por eval ni por
 * Function, no tiene acceso a propiedades (no hay "." ni "[]") y un nombre solo se busca entre los
 * campos propios de la fila. Lo que se escribe en un JSON no puede ejecutar código.
 *
 * - Valores: números (12, 1.5, 2e3), textos ('Costa' o "Costa"), true, false, null y campos. Un
 *   campo con espacios o signos va entre acentos graves: `tasa de caída`.
 * - Operadores, de menor a mayor precedencia: or (||), and (&&), not (!), comparaciones (== != < <=
 *   > >=; también = y <>), + y −, * / %, y el signo. + junta textos si alguno lo es.
 * - Funciones: abs, round(x, decimales), floor, ceil, sqrt, min, max, len, upper, lower, contains.
 * - Un dato que falta vale null: la cuenta con él da null y cualquier comparación da falso, así
 *   una fila incompleta no se pinta como si cumpliera.
 */
import { layerTexts, quoteList, type LayerTexts } from './texts';

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'lit'; v: boolean | null }
  | { k: 'field'; name: string; pos: number }
  | { k: 'not'; a: Node }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'call'; name: string; args: Node[]; pos: number };

/** Un error de lectura, con la posición (desde 1) donde está el problema y el mensaje ya en el idioma pedido. */
export class ExprError extends Error {
  constructor(
    message: string,
    readonly pos: number,
  ) {
    super(message);
    this.name = 'ExprError';
  }
}

const MAX_LENGTH = 500;
const MAX_DEPTH = 40;

type Token =
  | { t: 'num'; v: number; pos: number; text: string }
  | { t: 'str'; v: string; pos: number; text: string }
  | { t: 'name'; v: string; pos: number; text: string }
  | { t: 'field'; v: string; pos: number; text: string }
  | { t: 'op'; v: string; pos: number; text: string }
  | { t: 'end'; v: ''; pos: number; text: '' };

/** Operadores de dos y un carácter, con sus equivalentes: así el árbol solo conoce una forma de cada uno. */
const OPS = new Map<string, string>(
  Object.entries({
    '===': '==',
    '!==': '!=',
    '==': '==',
    '!=': '!=',
    '<>': '!=',
    '<=': '<=',
    '>=': '>=',
    '&&': 'and',
    '||': 'or',
    '=': '==',
    '<': '<',
    '>': '>',
    '+': '+',
    '-': '-',
    '*': '*',
    '/': '/',
    '%': '%',
    '!': 'not',
    '(': '(',
    ')': ')',
    ',': ',',
  }),
);
/** Errores típicos de tipeo: se dice qué se quiso escribir. */
const LOOKALIKES = new Map([
  ['=>', '>='],
  ['=<', '<='],
  ['=!', '!='],
]);
// Mapas y no objetos: un nombre como "constructor" no debe encontrar nada heredado.
const WORDS = new Map([
  ['and', 'and'],
  ['or', 'or'],
  ['not', 'not'],
]);
const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{N}_]/u;

function tokenize(src: string, T: LayerTexts['expr']): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const pos = i + 1;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: Number(m[0]), pos, text: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === "'" || c === '"') {
      let s = '';
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        // Una barra escapa la comilla o la barra misma: 'it\'s'.
        if (src[j] === '\\' && j + 1 < src.length) j++;
        s += src[j++];
      }
      if (j >= src.length) throw new ExprError(T.unclosedString(pos), pos);
      out.push({ t: 'str', v: s, pos, text: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const j = src.indexOf('`', i + 1);
      if (j < 0) throw new ExprError(T.unclosedField(pos), pos);
      out.push({ t: 'field', v: src.slice(i + 1, j), pos, text: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (NAME_START.test(c)) {
      let j = i + 1;
      while (j < src.length && NAME_PART.test(src[j])) j++;
      const word = src.slice(i, j);
      const op = WORDS.get(word.toLowerCase());
      out.push(op ? { t: 'op', v: op, pos, text: word } : { t: 'name', v: word, pos, text: word });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    const like = LOOKALIKES.get(two);
    if (like) throw new ExprError(T.didYouMean(two, like), pos);
    const op = [src.slice(i, i + 3), two, c].find((s) => OPS.has(s));
    if (!op) throw new ExprError(T.badChar(c, pos), pos);
    out.push({ t: 'op', v: OPS.get(op)!, pos, text: op });
    i += op.length;
  }
  out.push({ t: 'end', v: '', pos: src.length + 1, text: '' });
  return out;
}

interface Fn {
  min: number;
  max: number;
  run: (args: unknown[]) => unknown;
}

/** Funciones permitidas. Todas devuelven null si un valor falta o no sirve. */
const FUNCTIONS: Record<string, Fn> = Object.assign(Object.create(null) as Record<string, Fn>, {
  abs: { min: 1, max: 1, run: ([a]: unknown[]) => num1(a, Math.abs) },
  round: {
    min: 1,
    max: 2,
    run: ([a, d]: unknown[]) => {
      const v = toNumber(a);
      const k = d === undefined ? 0 : toNumber(d);
      if (!isFinite(v) || !isFinite(k)) return null;
      const f = Math.pow(10, Math.max(0, Math.min(10, Math.round(k))));
      return Math.round(v * f) / f;
    },
  },
  floor: { min: 1, max: 1, run: ([a]: unknown[]) => num1(a, Math.floor) },
  ceil: { min: 1, max: 1, run: ([a]: unknown[]) => num1(a, Math.ceil) },
  sqrt: { min: 1, max: 1, run: ([a]: unknown[]) => num1(a, (v) => (v >= 0 ? Math.sqrt(v) : NaN)) },
  min: { min: 1, max: Infinity, run: (args: unknown[]) => extreme(args, Math.min) },
  max: { min: 1, max: Infinity, run: (args: unknown[]) => extreme(args, Math.max) },
  len: { min: 1, max: 1, run: ([a]: unknown[]) => (a === null || a === undefined ? null : String(a).length) },
  upper: { min: 1, max: 1, run: ([a]: unknown[]) => (a === null || a === undefined ? null : String(a).toUpperCase()) },
  lower: { min: 1, max: 1, run: ([a]: unknown[]) => (a === null || a === undefined ? null : String(a).toLowerCase()) },
  contains: {
    min: 2,
    max: 2,
    run: ([a, b]: unknown[]) =>
      a === null || a === undefined || b === null || b === undefined ? false : String(a).includes(String(b)),
  },
});

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

function num1(a: unknown, f: (v: number) => number): number | null {
  const v = f(toNumber(a));
  return isFinite(v) ? v : null;
}

function extreme(args: unknown[], f: (...v: number[]) => number): number | null {
  const list = args.map(toNumber).filter(isFinite);
  return list.length ? f(...list) : null;
}

/** Lee una expresión. Lanza ExprError, con el mensaje en el idioma dado, si está mal escrita. */
export function parse(src: string, locale?: string): Node {
  const T = layerTexts(locale).expr;
  if (typeof src !== 'string' || !src.trim()) throw new ExprError(T.empty, 1);
  if (src.length > MAX_LENGTH) throw new ExprError(T.tooLong(MAX_LENGTH), MAX_LENGTH);
  const tokens = tokenize(src, T);
  let at = 0;
  let depth = 0;
  const peek = () => tokens[at];
  const isOp = (...ops: string[]) => peek().t === 'op' && ops.includes(String(peek().v));
  const expect = (op: string) => {
    const tok = peek();
    if (tok.t !== 'op' || tok.v !== op) throw new ExprError(T.needToken(op, tok.text, tok.pos), tok.pos);
    at++;
  };
  const deeper = (pos: number) => {
    if (++depth > MAX_DEPTH) throw new ExprError(T.tooDeep, pos);
  };

  const binary = (next: () => Node, ops: string[]): (() => Node) => {
    return () => {
      let a = next();
      while (isOp(...ops)) {
        const op = String(tokens[at++].v);
        a = { k: 'bin', op, a, b: next() };
      }
      return a;
    };
  };
  const unary = (): Node => {
    const tok = peek();
    if (tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
      at++;
      deeper(tok.pos);
      const a = unary();
      depth--;
      return tok.v === '-' ? { k: 'neg', a } : a;
    }
    return primary();
  };
  const mul = binary(unary, ['*', '/', '%']);
  const add = binary(mul, ['+', '-']);
  const cmp = binary(add, ['==', '!=', '<', '<=', '>', '>=']);
  const not = (): Node => {
    if (isOp('not')) {
      const pos = tokens[at++].pos;
      deeper(pos);
      const a = not();
      depth--;
      return { k: 'not', a };
    }
    return cmp();
  };
  const and = binary(not, ['and']);
  const or = binary(and, ['or']);

  function primary(): Node {
    const tok = tokens[at];
    switch (tok.t) {
      case 'num':
        at++;
        return { k: 'num', v: tok.v };
      case 'str':
        at++;
        return { k: 'str', v: tok.v };
      case 'field':
        at++;
        return { k: 'field', name: tok.v, pos: tok.pos };
      case 'name': {
        at++;
        const word = tok.v.toLowerCase();
        if (!isOp('(')) {
          if (word === 'true' || word === 'false') return { k: 'lit', v: word === 'true' };
          if (word === 'null') return { k: 'lit', v: null };
          return { k: 'field', name: tok.v, pos: tok.pos };
        }
        const fn = FUNCTIONS[word];
        if (!fn) throw new ExprError(T.unknownFunction(tok.v, quoteList(FUNCTION_NAMES)), tok.pos);
        at++;
        deeper(tok.pos);
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(or());
          while (isOp(',')) {
            at++;
            args.push(or());
          }
        }
        expect(')');
        depth--;
        if (args.length < fn.min || args.length > fn.max) throw new ExprError(T.arity(word, fn.min, fn.max), tok.pos);
        return { k: 'call', name: word, args, pos: tok.pos };
      }
      case 'op':
        if (tok.v === '(') {
          at++;
          deeper(tok.pos);
          const inner = or();
          expect(')');
          depth--;
          return inner;
        }
        throw new ExprError(T.needValue(tok.text, tok.pos), tok.pos);
      default:
        throw new ExprError(T.needValue('', tok.pos), tok.pos);
    }
  }

  const tree = or();
  const rest = peek();
  if (rest.t !== 'end') throw new ExprError(T.extra(rest.text, rest.pos), rest.pos);
  return tree;
}

/** Campos que nombra una expresión, sin repetir, en orden de aparición. */
export function fieldsOf(node: Node, out: string[] = []): string[] {
  switch (node.k) {
    case 'field':
      if (!out.includes(node.name)) out.push(node.name);
      break;
    case 'not':
    case 'neg':
      fieldsOf(node.a, out);
      break;
    case 'bin':
      fieldsOf(node.a, out);
      fieldsOf(node.b, out);
      break;
    case 'call':
      for (const a of node.args) fieldsOf(a, out);
      break;
  }
  return out;
}

const own = Object.prototype.hasOwnProperty;

/**
 * El valor de un campo de la fila: solo si es propio (nunca `constructor` ni `__proto__`) y
 * primitivo o fecha. Lo demás (objetos, listas, funciones) vale null.
 */
export function readField(row: object, name: string): unknown {
  if (!row || !own.call(row, name)) return null;
  const v = (row as Record<string, unknown>)[name];
  if (v === undefined || v === null) return null;
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v instanceof Date ? v : null;
}

/** Número de un valor: un número, un texto numérico o una fecha; NaN si falta o no es número. */
export function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

/** ¿Cuenta como verdadero? Falso: false, null, 0, NaN y el texto vacío. */
export function truthy(v: unknown): boolean {
  if (typeof v === 'number') return v !== 0 && !isNaN(v);
  return v !== null && v !== undefined && v !== false && v !== '';
}

const isNumeric = (v: unknown) => typeof v === 'number' || v instanceof Date;

function compare(op: string, a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return op === '!=' ? a !== b : false;
  // Número contra número, o contra un texto que es un número ("95" de un CSV): se comparan como números.
  if ((isNumeric(a) || isNumeric(b)) && isFinite(toNumber(a)) && isFinite(toNumber(b))) {
    const x = toNumber(a);
    const y = toNumber(b);
    switch (op) {
      case '==':
        return x === y;
      case '!=':
        return x !== y;
      case '<':
        return x < y;
      case '<=':
        return x <= y;
      case '>':
        return x > y;
      default:
        return x >= y;
    }
  }
  const x = String(a);
  const y = String(b);
  switch (op) {
    case '==':
      return x === y;
    case '!=':
      return x !== y;
    case '<':
      return x < y;
    case '<=':
      return x <= y;
    case '>':
      return x > y;
    default:
      return x >= y;
  }
}

function arithmetic(op: string, a: unknown, b: unknown): unknown {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (op === '+' && (typeof a === 'string' || typeof b === 'string') && !(isNumeric(a) && isNumeric(b))) {
    return String(a) + String(b);
  }
  const x = toNumber(a);
  const y = toNumber(b);
  let v: number;
  switch (op) {
    case '+':
      v = x + y;
      break;
    case '-':
      v = x - y;
      break;
    case '*':
      v = x * y;
      break;
    case '/':
      v = x / y;
      break;
    default:
      v = x % y;
  }
  // Dividir por cero o restar un texto no da un número: queda como dato que falta.
  return isFinite(v) ? v : null;
}

/** Evalúa el árbol con los campos de una fila. Nunca lanza: lo que no se puede calcular es null. */
export function evaluate(node: Node, row: object): unknown {
  switch (node.k) {
    case 'num':
    case 'str':
    case 'lit':
      return node.v;
    case 'field':
      return readField(row, node.name);
    case 'not':
      return !truthy(evaluate(node.a, row));
    case 'neg': {
      const v = toNumber(evaluate(node.a, row));
      return isFinite(v) ? -v : null;
    }
    case 'call':
      return FUNCTIONS[node.name].run(node.args.map((a) => evaluate(a, row)));
    case 'bin': {
      if (node.op === 'and') return truthy(evaluate(node.a, row)) && truthy(evaluate(node.b, row));
      if (node.op === 'or') return truthy(evaluate(node.a, row)) || truthy(evaluate(node.b, row));
      const a = evaluate(node.a, row);
      const b = evaluate(node.b, row);
      return ['+', '-', '*', '/', '%'].includes(node.op) ? arithmetic(node.op, a, b) : compare(node.op, a, b);
    }
  }
}

/** Lee y prepara una expresión: la función que la evalúa sobre una fila y los campos que usa. */
export function compile(src: string, locale?: string): { run: (row: object) => unknown; fields: string[] } {
  const tree = parse(src, locale);
  return { run: (row) => evaluate(tree, row), fields: fieldsOf(tree) };
}

// ------------------------------------------------------------ Plantillas

/** Un trozo de plantilla: texto fijo o una expresión entre llaves. */
export type Piece = string | { node: Node; src: string; at: number };

/**
 * Lee una plantilla de texto: "{valor} de {meta}" o "▲ {abs(delta)}". Lo que va entre llaves es
 * una expresión; {{ y }} escriben una llave literal. Lanza ExprError con la posición dentro de la plantilla.
 */
export function parseTemplate(src: string, locale?: string): Piece[] {
  const T = layerTexts(locale).expr;
  const out: Piece[] = [];
  let text = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if ((c === '{' || c === '}') && src[i + 1] === c) {
      text += c;
      i += 2;
      continue;
    }
    if (c !== '{') {
      text += c;
      i++;
      continue;
    }
    const end = src.indexOf('}', i + 1);
    if (end < 0) throw new ExprError(T.needToken('}', '', src.length + 1), i + 1);
    const inner = src.slice(i + 1, end);
    try {
      if (text) out.push(text);
      text = '';
      out.push({ node: parse(inner, locale), src: inner, at: i + 2 });
    } catch (err) {
      // La posición del error, contada desde el principio de la plantilla.
      if (err instanceof ExprError) throw new ExprError(err.message, err.pos + i + 1);
      throw err;
    }
    i = end + 1;
  }
  if (text) out.push(text);
  return out;
}

/** Campos que nombran las expresiones de una plantilla. */
export function templateFields(pieces: readonly Piece[]): string[] {
  const out: string[] = [];
  for (const p of pieces) if (typeof p !== 'string') fieldsOf(p.node, out);
  return out;
}

/**
 * Arma el texto de una plantilla con una fila. `format` escribe los valores (los números con el
 * formato de la capa y el idioma del gráfico); un valor que falta escribe `missing`.
 */
export function fillTemplate(pieces: readonly Piece[], row: object, format: (v: unknown) => string, missing = '–'): string {
  let s = '';
  for (const p of pieces) {
    if (typeof p === 'string') s += p;
    else {
      const v = evaluate(p.node, row);
      s += v === null || v === undefined ? missing : format(v);
    }
  }
  return s;
}
