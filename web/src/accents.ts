export type AccentId = 'vert' | 'bleu' | 'violet' | 'rose' | 'rouge' | 'orange' | 'turquoise' | 'neutre';

export interface AccentColours {
  /** The colour itself: links, bars, gauges, cells. */
  accent: string;
  /** Text drawn on top of it (the selected button of a switch, for example). */
  onAccent: string;
}

export interface Accent {
  id: AccentId;
  label: string;
  light: AccentColours;
  dark: AccentColours;
}

export const DEFAULT_ACCENT: AccentId = 'vert';

/**
 * The hues the site can take. Every pair was computed (OKLCH, constant lightness, then adjusted) so that text in the accent
 * reads on the page background (4.8:1 or more in the light theme, 7:1 in the dark one) and text on the accent reads on the
 * accent (same limits); `accents.test.ts` checks it again. `vert` is the original colour, kept exactly.
 */
export const ACCENTS: readonly Accent[] = [
  { id: 'vert', label: 'Vert', light: { accent: '#0e7c66', onAccent: '#ffffff' }, dark: { accent: '#3ddbb5', onAccent: '#06201a' } },
  { id: 'bleu', label: 'Bleu', light: { accent: '#246dc1', onAccent: '#ffffff' }, dark: { accent: '#63a7fc', onAccent: '#051223' } },
  { id: 'violet', label: 'Violet', light: { accent: '#785abd', onAccent: '#ffffff' }, dark: { accent: '#b096f9', onAccent: '#130d21' } },
  { id: 'rose', label: 'Rose', light: { accent: '#b0477f', onAccent: '#ffffff' }, dark: { accent: '#ed83b7', onAccent: '#1e0914' } },
  { id: 'rouge', label: 'Rouge', light: { accent: '#b9463f', onAccent: '#ffffff' }, dark: { accent: '#f68377', onAccent: '#200a08' } },
  { id: 'orange', label: 'Orange', light: { accent: '#a65901', onAccent: '#ffffff' }, dark: { accent: '#e98f41', onAccent: '#1e0c01' } },
  { id: 'turquoise', label: 'Turquoise', light: { accent: '#047781', onAccent: '#ffffff' }, dark: { accent: '#07b6c5', onAccent: '#001518' } },
  { id: 'neutre', label: 'Neutre', light: { accent: '#607067', onAccent: '#ffffff' }, dark: { accent: '#97a89e', onAccent: '#00170b' } },
];

export function findAccent(id: string): Accent | undefined {
  return ACCENTS.find((accent) => accent.id === id);
}
