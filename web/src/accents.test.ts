import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ACCENT, findAccent } from './accents.ts';

// The surfaces of docs/DESIGN.md.
const LIGHT = { page: '#f4f7f6', card: '#ffffff' };
const DARK = { page: '#0d1211', card: '#141b19' };

const linear = (value: number): number => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => linear(parseInt(hex.slice(index, index + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe('accents', () => {
  it('has the original colour as the default, kept exactly', () => {
    expect(DEFAULT_ACCENT).toBe('vert');
    expect(findAccent('vert')).toMatchObject({ light: { accent: '#0e7c66', onAccent: '#ffffff' }, dark: { accent: '#3ddbb5', onAccent: '#06201a' } });
  });

  it('gives every hue a unique id and well-formed colours', () => {
    expect(new Set(ACCENTS.map((accent) => accent.id)).size).toBe(ACCENTS.length);
    for (const accent of ACCENTS) {
      for (const hex of [accent.light.accent, accent.light.onAccent, accent.dark.accent, accent.dark.onAccent]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(findAccent('nope')).toBeUndefined();
  });

  it.each(ACCENTS.map((accent) => [accent.id, accent] as const))('keeps %s readable: text in the accent and text on it, in both themes', (_id, accent) => {
    // Light theme: the accent as text on the page and on a card, and white text on the accent (WCAG AA is 4.5).
    expect(contrast(accent.light.accent, LIGHT.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent.light.accent, LIGHT.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent.light.onAccent, accent.light.accent)).toBeGreaterThanOrEqual(4.5);
    // Dark theme.
    expect(contrast(accent.dark.accent, DARK.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent.dark.accent, DARK.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accent.dark.onAccent, accent.dark.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(ACCENTS.map((accent) => [accent.id, accent] as const))('keeps the day layers of %s apart from the accent bar and readable, in both themes', (_id, accent) => {
    for (const colours of [accent.light, accent.dark]) {
      const { share, base, mute, deaf } = colours.layers;
      for (const hex of [share, base, mute, deaf]) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrast(share, colours.accent)).toBeGreaterThanOrEqual(3);
      expect(contrast(base, colours.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(deaf, base)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
