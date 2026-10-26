/**
 * Leyenda: botones que muestran u ocultan series (aria-pressed), y su versión SVG para exportar.
 * La comparten el gráfico y los small multiples.
 */
import type { Theme } from './theme';
import { attrs, esc, html, textWidth } from './dom';

export interface LegendItem {
  key: string;
  name: string;
  color: string;
  symbol: 'line' | 'square' | 'dot';
  visible: boolean;
}

export class Legend {
  readonly el = html('div', { class: 'lc-legend', role: 'group' });
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(private readonly onToggle: (key: string) => void) {}

  get size(): number {
    return this.buttons.size;
  }

  /**
   * Crea los botones. Solo cuando cambian las series: recrearlos haría perder el foco del teclado.
   * `label` es el nombre del grupo para lectores de pantalla, en el idioma del gráfico.
   */
  render(items: LegendItem[], top: boolean, label: string): void {
    this.buttons.clear();
    this.el.setAttribute('aria-label', label);
    this.el.classList.toggle('lc-top', top);
    this.el.replaceChildren(
      ...items.map((item) => {
        const button = html('button', { type: 'button', class: 'lc-legend-btn' });
        const swatch = html('span', { class: `lc-swatch lc-${item.symbol}`, 'aria-hidden': 'true' });
        button.append(swatch, html('span', { class: 'lc-name' }, item.name));
        button.addEventListener('click', () => this.onToggle(item.key));
        this.buttons.set(item.key, button);
        return button;
      }),
    );
    this.sync(items);
  }

  /** Actualiza estado, colores y textos (por ejemplo, los porcentajes de un pie) sin recrear los botones. */
  sync(items: LegendItem[]): void {
    for (const item of items) {
      const button = this.buttons.get(item.key);
      if (!button) continue;
      button.setAttribute('aria-pressed', String(item.visible));
      (button.firstElementChild as HTMLElement).style.background = item.color;
      const name = button.lastElementChild as HTMLElement;
      if (name.textContent !== item.name) name.textContent = item.name;
    }
  }

  clear(): void {
    this.buttons.clear();
    this.el.replaceChildren();
    this.el.remove();
  }
}

/** Leyenda en SVG, con salto de línea cuando no cabe. Devuelve el markup y el alto que ocupa. */
export function legendSVG(
  items: LegendItem[],
  x0: number,
  y0: number,
  maxWidth: number,
  family: string,
  theme: Theme,
): { markup: string; height: number } {
  const font = `13px ${family}`;
  let markup = '';
  let x = x0;
  let y = y0;
  for (const item of items) {
    const itemW = 12 + 8 + textWidth(item.name, font) + 20;
    if (x + itemW > x0 + maxWidth && x > x0) {
      x = x0;
      y += 22;
    }
    const color = item.visible ? item.color : 'none';
    const outline = item.visible ? {} : { stroke: theme.textMuted, 'stroke-width': 1.5 };
    markup +=
      item.symbol === 'line'
        ? `<rect${attrs({ x, y: y + 5, width: 14, height: 3, rx: 1.5, fill: item.visible ? item.color : theme.textMuted })}/>`
        : item.symbol === 'dot'
          ? `<circle${attrs({ cx: x + 6, cy: y + 6, r: 5, fill: color, ...outline })}/>`
          : `<rect${attrs({ x, y, width: 12, height: 12, rx: 3, fill: color, ...outline })}/>`;
    const fill = item.visible ? theme.text : theme.textMuted;
    markup += `<text${attrs({ x: x + 20, y: y + 6, 'font-size': 13, fill, 'dominant-baseline': 'central' })}>${esc(item.name)}</text>`;
    x += itemW;
  }
  return { markup, height: y - y0 + 12 };
}
