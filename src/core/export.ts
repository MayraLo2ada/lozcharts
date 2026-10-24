/** Descargar un SVG como archivo .svg o .png. */

/** "Ventas por mes" → "ventas-por-mes". */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Descarga el markup como SVG, o lo rasteriza a PNG al doble de resolución. */
export async function downloadImage(
  markup: string,
  width: number,
  height: number,
  type: 'png' | 'svg',
  name: string,
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
  if (!ctx) throw new Error('LozChart: el navegador no permite canvas.');
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('LozChart: no pude generar el PNG.');
  saveBlob(blob, name + '.png');
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
