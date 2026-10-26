/** Descargar un SVG como archivo .svg o .png. */
import { messages } from './i18n';

/** "Ventas por mes" → "ventas-por-mes". */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Nombre del archivo sin extensión: el que se dio (sin repetir la extensión si ya la trae:
 * "ventas.csv" no se vuelve "ventas.csv.csv"), o el título en minúsculas y sin acentos.
 */
export function fileName(given: string | undefined, title: string | undefined, type: string): string {
  const base = given?.trim().replace(new RegExp(`\\.${type}$`, 'i'), '');
  return base || slug(title ?? '') || 'lozchart';
}

/** Descarga el markup como SVG, o lo rasteriza a PNG al doble de resolución. */
export async function downloadImage(
  markup: string,
  width: number,
  height: number,
  type: 'png' | 'svg',
  name: string,
  locale?: string,
): Promise<void> {
  if (type === 'svg') {
    saveBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg');
    return;
  }
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  await img.decode();
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(messages(locale).warnings.noCanvas);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(messages(locale).warnings.pngFailed);
  saveBlob(blob, name + '.png');
}

/**
 * Tabla a CSV (RFC 4180): los campos con coma, comillas o salto de línea van entre comillas, y
 * las comillas se duplican. Empieza con BOM para que Excel lea bien los acentos.
 * Un texto que empieza con = + - @ (o tabulador o retorno) va precedido de un apóstrofo: una
 * hoja de cálculo lo tomaría como fórmula, y los datos pueden venir de cualquiera.
 */
export function toCSV(rows: readonly (readonly (string | number)[])[]): string {
  const cell = (v: string | number) => {
    let s = typeof v === 'number' ? (isFinite(v) ? String(v) : '') : v;
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Una fecha para el CSV, en la hora local en que se dibuja: '2026-03-01' si cae a medianoche y
 * '2026-03-01 14:30' (con segundos si los tiene) si no. En UTC, un día de los datos se leería en
 * la hoja de cálculo como el día anterior en cualquier zona al este de Greenwich.
 */
export function csvDate(t: number): string {
  if (!isFinite(t)) return '';
  const d = new Date(t);
  const two = (n: number) => String(n).padStart(2, '0');
  const day = `${String(d.getFullYear()).padStart(4, '0')}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const h = d.getHours();
  const m = d.getMinutes();
  const sec = d.getSeconds() + d.getMilliseconds() / 1000;
  if (!h && !m && !sec) return day;
  return `${day} ${two(h)}:${two(m)}` + (sec ? `:${two(Math.floor(sec))}` : '');
}

/** Descarga un texto CSV. */
export function downloadCSV(csv: string, name: string): void {
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name + '.csv');
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
