export type AccentId = 'vert' | 'bleu' | 'violet' | 'rose' | 'rouge' | 'orange' | 'turquoise' | 'neutre';

export interface AccentColours {
  /** The colour itself: links, bars, gauges, cells. */
  accent: string;
  /** Text drawn on top of it (the selected button of a switch, for example). */
  onAccent: string;
  /** Screen sharing drawn over a bar in the accent: far enough in lightness (3.5:1 or more) to stand out, in a hue away from the accent. */
  share: string;
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
  { id: 'vert', label: 'Vert', light: { accent: '#0e7c66', onAccent: '#ffffff', share: '#bedafe' }, dark: { accent: '#3ddbb5', onAccent: '#06201a', share: '#2b61a3' } },
  { id: 'bleu', label: 'Bleu', light: { accent: '#246dc1', onAccent: '#ffffff', share: '#efd369' }, dark: { accent: '#63a7fc', onAccent: '#051223', share: '#594900' } },
  { id: 'violet', label: 'Violet', light: { accent: '#785abd', onAccent: '#ffffff', share: '#efd369' }, dark: { accent: '#b096f9', onAccent: '#130d21', share: '#594900' } },
  { id: 'rose', label: 'Rose', light: { accent: '#b0477f', onAccent: '#ffffff', share: '#b9d7fd' }, dark: { accent: '#ed83b7', onAccent: '#1e0914', share: '#124a89' } },
  { id: 'rouge', label: 'Rouge', light: { accent: '#b9463f', onAccent: '#ffffff', share: '#b9d7fd' }, dark: { accent: '#f68377', onAccent: '#200a08', share: '#124a89' } },
  { id: 'orange', label: 'Orange', light: { accent: '#a65901', onAccent: '#ffffff', share: '#b9d7fd' }, dark: { accent: '#e98f41', onAccent: '#1e0c01', share: '#124a89' } },
  { id: 'turquoise', label: 'Turquoise', light: { accent: '#047781', onAccent: '#ffffff', share: '#efd369' }, dark: { accent: '#07b6c5', onAccent: '#001518', share: '#594900' } },
  { id: 'neutre', label: 'Neutre', light: { accent: '#607067', onAccent: '#ffffff', share: '#b9d7fd' }, dark: { accent: '#97a89e', onAccent: '#00170b', share: '#124a89' } },
];

export function findAccent(id: string): Accent | undefined {
  return ACCENTS.find((accent) => accent.id === id);
}
