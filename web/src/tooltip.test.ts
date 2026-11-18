import { describe, expect, it } from 'vitest';
import { placeTooltip } from './tooltip.ts';

const viewport = { width: 1000, height: 600 };
const tip = { width: 120, height: 40 };

describe('placeTooltip', () => {
  it('goes to the lower right of the pointer', () => {
    expect(placeTooltip({ x: 100, y: 100 }, tip, viewport)).toEqual({ x: 112, y: 116 });
  });

  it('flips to the left near the right edge', () => {
    const placed = placeTooltip({ x: 950, y: 100 }, tip, viewport);
    expect(placed.x + tip.width).toBeLessThanOrEqual(950);
    expect(placed.y).toBe(116);
  });

  it('flips above near the bottom edge, without covering the pointer', () => {
    const placed = placeTooltip({ x: 100, y: 580 }, tip, viewport);
    expect(placed.y + tip.height).toBeLessThanOrEqual(580);
  });

  it('never leaves the window, even in a corner or when the tooltip is wider than the window', () => {
    for (const pointer of [{ x: 0, y: 0 }, { x: 1000, y: 600 }, { x: 1000, y: 0 }, { x: 0, y: 600 }]) {
      const placed = placeTooltip(pointer, tip, viewport);
      expect(placed.x).toBeGreaterThanOrEqual(0);
      expect(placed.y).toBeGreaterThanOrEqual(0);
      expect(placed.x + tip.width).toBeLessThanOrEqual(viewport.width);
      expect(placed.y + tip.height).toBeLessThanOrEqual(viewport.height);
    }
    const narrow = placeTooltip({ x: 50, y: 50 }, { width: 400, height: 40 }, { width: 300, height: 600 });
    expect(narrow.x).toBeGreaterThanOrEqual(0);
  });
});
