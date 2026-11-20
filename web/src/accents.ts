export type AccentId = 'vert' | 'bleu' | 'violet' | 'rose' | 'rouge' | 'orange' | 'turquoise' | 'neutre';

export interface AccentColours {
  /** The colour itself: links, bars, gauges, cells. */
  accent: string;
  /** Text drawn on top of it (the selected button of a switch, for example). */
  onAccent: string;
  /** Day-timeline state layers, tones of the accent itself (light tints in the light theme, deep tones in the dark one): screen sharing, the base under the hatches, microphone stripes, headphone bars. */
  layers: { share: string; base: string; mute: string; deaf: string };
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
  { id: 'vert', label: 'Vert', light: { accent: '#0e7c66', onAccent: '#ffffff', layers: { share: '#8bddc5', base: '#e4f9f2', mute: '#6fb5a1', deaf: '#024e3f' } }, dark: { accent: '#3ddbb5', onAccent: '#06201a', layers: { share: '#04755e', base: '#00261d', mute: '#02755e', deaf: '#7be9c9' } } },
  { id: 'bleu', label: 'Bleu', light: { accent: '#246dc1', onAccent: '#ffffff', layers: { share: '#a9cffe', base: '#edf4fe', mute: '#6fa7ee', deaf: '#054180' } }, dark: { accent: '#63a7fc', onAccent: '#051223', layers: { share: '#135196', base: '#031f40', mute: '#3164a3', deaf: '#b3d4fe' } } },
  { id: 'violet', label: 'Violet', light: { accent: '#785abd', onAccent: '#ffffff', layers: { share: '#d0c2ff', base: '#f4f1fe', mute: '#aa95e8', deaf: '#48317a' } }, dark: { accent: '#b096f9', onAccent: '#130d21', layers: { share: '#5b4293', base: '#22163d', mute: '#68549d', deaf: '#d4c8fe' } } },
  { id: 'rose', label: 'Rose', light: { accent: '#b0477f', onAccent: '#ffffff', layers: { share: '#feb8d8', base: '#ffeef5', mute: '#dd84af', deaf: '#6e204b' } }, dark: { accent: '#ed83b7', onAccent: '#1e0914', layers: { share: '#883260', base: '#370e24', mute: '#92456c', deaf: '#febad9' } } },
  { id: 'rouge', label: 'Rouge', light: { accent: '#b9463f', onAccent: '#ffffff', layers: { share: '#ffbab1', base: '#fef0ee', mute: '#e6867c', deaf: '#751f1c' } }, dark: { accent: '#f68377', onAccent: '#200a08', layers: { share: '#8e312a', base: '#3a0e0b', mute: '#9a463e', deaf: '#febfb7' } } },
  { id: 'orange', label: 'Orange', light: { accent: '#a65901', onAccent: '#ffffff', layers: { share: '#ffbe8c', base: '#fff0e6', mute: '#d59461', deaf: '#653401' } }, dark: { accent: '#e98f41', onAccent: '#1e0c01', layers: { share: '#7c4102', base: '#331700', mute: '#92500d', deaf: '#fec396' } } },
  { id: 'turquoise', label: 'Turquoise', light: { accent: '#047781', onAccent: '#ffffff', layers: { share: '#86d6df', base: '#e3f8fb', mute: '#6db2ba', deaf: '#014c53' } }, dark: { accent: '#07b6c5', onAccent: '#001518', layers: { share: '#025a62', base: '#012528', mute: '#05717a', deaf: '#7ee3ef' } } },
  { id: 'neutre', label: 'Neutre', light: { accent: '#607067', onAccent: '#ffffff', layers: { share: '#9fd7b9', base: '#f0f5f2', mute: '#9ba8a1', deaf: '#3a463f' } }, dark: { accent: '#97a89e', onAccent: '#00170b', layers: { share: '#245a40', base: '#1b211d', mute: '#5a675f', deaf: '#c7d5cd' } } },
];

export function findAccent(id: string): Accent | undefined {
  return ACCENTS.find((accent) => accent.id === id);
}
