/**
 * Temas claro y oscuro. El oscuro tiene sus propios valores (no es una inversión):
 * cada color de la paleta se eligió y validó contra su propia superficie.
 */

import type { PaletteOption } from '../types';

export interface Theme {
  name: 'light' | 'dark';
  /** Paleta categórica en orden fijo (hasta 8 colores). */
  palette: readonly string[];
  surface: string;
  text: string;
  textMuted: string;
  grid: string;
  zero: string;
  /** Banda de hover en barras. */
  highlight: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
  /** Color neutro para el grupo "Otros". */
  other: string;
}

export const LIGHT: Theme = {
  name: 'light',
  palette: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  surface: '#fcfcfb',
  text: '#0b0b0b',
  textMuted: '#52514e',
  grid: '#e7e6e1',
  zero: '#a9a8a1',
  highlight: 'rgba(11, 11, 11, 0.05)',
  tooltipBg: '#ffffff',
  tooltipBorder: '#dedcd6',
  tooltipShadow: '0 4px 16px rgba(11, 11, 11, 0.10)',
  other: '#8a8984',
};

export const DARK: Theme = {
  name: 'dark',
  palette: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  surface: '#1a1a19',
  text: '#f0efec',
  textMuted: '#c3c2b7',
  grid: '#2f2f2d',
  zero: '#64635e',
  highlight: 'rgba(240, 239, 236, 0.07)',
  tooltipBg: '#252523',
  tooltipBorder: '#3b3b38',
  tooltipShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
  other: '#8e8d86',
};

/** Máximo de colores categóricos: más series se agrupan o se dividen, nunca se cicla. */
export const MAX_COLORS = 8;

/** Tema del modo dado, con la paleta propia si la hay. */
export function resolveTheme(mode: 'light' | 'dark', custom?: PaletteOption): Theme {
  const base = mode === 'dark' ? DARK : LIGHT;
  if (!custom) return base;
  const list = isList(custom) ? custom : mode === 'dark' ? (custom.dark ?? custom.light) : custom.light;
  if (!list.length) return base;
  if (list.length > MAX_COLORS)
    console.warn(`LozChart: la paleta tiene ${list.length} colores; se usan los primeros ${MAX_COLORS}.`);
  return { ...base, palette: list.slice(0, MAX_COLORS) };
}

function isList(p: PaletteOption): p is readonly string[] {
  return Array.isArray(p);
}

/** Variables CSS para las partes HTML (leyenda, tooltip, títulos). */
export function themeVars(t: Theme): Record<string, string> {
  return {
    '--lc-surface': t.surface,
    '--lc-text': t.text,
    '--lc-text-muted': t.textMuted,
    '--lc-grid': t.grid,
    '--lc-focus': t.palette[0],
    '--lc-tooltip-bg': t.tooltipBg,
    '--lc-tooltip-border': t.tooltipBorder,
    '--lc-tooltip-shadow': t.tooltipShadow,
  };
}

const STYLE_ID = 'lozchart-styles';

const CSS = `
.lc-root{position:relative;width:100%;min-width:0;box-sizing:border-box;color:var(--lc-text);font-family:inherit;font-variant-numeric:tabular-nums;-webkit-tap-highlight-color:transparent}
.lc-root.lc-bg{background:var(--lc-surface)}
.lc-root *,.lc-root *::before,.lc-root *::after{box-sizing:border-box}
.lc-header{margin:0 0 12px}
.lc-title{font-size:15px;font-weight:600;line-height:1.35;margin:0;color:var(--lc-text)}
.lc-subtitle{font-size:13px;line-height:1.4;margin:2px 0 0;color:var(--lc-text-muted)}
.lc-plot{position:relative}
.lc-svg{display:block;max-width:100%;overflow:visible;border-radius:4px}
.lc-svg:focus{outline:none}
.lc-svg:focus-visible{outline:2px solid var(--lc-focus);outline-offset:4px}
.lc-legend{display:flex;flex-wrap:wrap;gap:4px 4px;margin:10px 0 0;padding:0;list-style:none}
.lc-legend.lc-top{margin:0 0 10px}
.lc-legend-btn{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:4px 10px 4px 8px;border:0;border-radius:6px;background:transparent;color:var(--lc-text);font:inherit;font-size:13px;line-height:1.2;cursor:pointer;transition:opacity .15s}
.lc-legend-btn:hover{background:var(--lc-grid)}
.lc-legend-btn:focus-visible{outline:2px solid var(--lc-focus);outline-offset:1px}
.lc-legend-btn[aria-pressed="false"]{color:var(--lc-text-muted)}
.lc-legend-btn[aria-pressed="false"] .lc-swatch{background:transparent!important;box-shadow:inset 0 0 0 1.5px var(--lc-text-muted)}
.lc-legend-btn[aria-pressed="false"] .lc-name{text-decoration:line-through;text-decoration-thickness:1px}
.lc-swatch{flex:none;display:inline-block;width:12px;height:12px;border-radius:3px}
.lc-swatch.lc-line{height:3px;width:14px;border-radius:2px}
.lc-swatch.lc-dot{width:10px;height:10px;border-radius:50%}
.lc-tooltip{position:absolute;top:0;left:0;z-index:5;pointer-events:none;min-width:140px;max-width:min(280px,calc(100% - 16px));padding:10px 12px;border:1px solid var(--lc-tooltip-border);border-radius:8px;background:var(--lc-tooltip-bg);box-shadow:var(--lc-tooltip-shadow);color:var(--lc-text);font-size:13px;line-height:1.35;opacity:0;transition:opacity .12s}
.lc-tooltip.lc-show{opacity:1}
.lc-tt-head{font-weight:600;margin:0 0 6px;color:var(--lc-text)}
.lc-tt-row{display:flex;align-items:center;gap:8px;padding:2px 0}
.lc-tt-key{flex:none;width:12px;height:3px;border-radius:2px}
.lc-tt-val{font-weight:600;color:var(--lc-text)}
.lc-tt-name{color:var(--lc-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lc-tt-detail{gap:12px;padding:0 0 0 20px;font-size:12px}
.lc-tt-detail .lc-tt-name{min-width:56px}
.lc-tt-detail .lc-tt-val{font-weight:500}
.lc-tt-total{margin-top:4px;padding-top:6px;border-top:1px solid var(--lc-tooltip-border)}
.lc-tt-total.lc-tt-mid{margin-bottom:4px;padding-bottom:6px;border-bottom:1px solid var(--lc-tooltip-border)}
.lc-tt-total .lc-tt-val{padding-left:20px}
.lc-sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.lc-tooltip,.lc-legend-btn{transition:none}}
`;

/** Inyecta los estilos una sola vez por documento. */
export function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
