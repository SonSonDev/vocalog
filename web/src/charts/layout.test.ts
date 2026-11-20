import { describe, expect, it } from 'vitest';
import { clipToBars, layoutSpans } from './layout.ts';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const at = (minutes: number) => minutes * MIN;

describe('layoutSpans', () => {
  it('is proportional to the duration', () => {
    const [rect] = layoutSpans([{ startMs: at(360), endMs: at(720) }], 0, DAY, 320);
    expect(rect).toEqual({ x: 80, w: 80 - 1 });
  });

  it('keeps a 3-minute stay at the 2 px minimum, never wider', () => {
    const [rect] = layoutSpans([{ startMs: at(780), endMs: at(783) }], 0, DAY, 320);
    expect(rect!.w).toBe(2);
  });

  it('never overlaps consecutive stays, even when the minimum widens a short one', () => {
    const spans = [
      { startMs: at(780), endMs: at(782) },
      { startMs: at(782), endMs: at(784) },
      { startMs: at(784), endMs: at(804) },
      { startMs: at(805), endMs: at(806) },
    ];
    const rects = layoutSpans(spans, 0, DAY, 320);
    expect(rects).toHaveLength(4);
    for (let i = 0; i < rects.length - 1; i++) expect(rects[i]!.x + rects[i]!.w).toBeLessThanOrEqual(rects[i + 1]!.x);
    for (const rect of rects) expect(rect.w).toBeGreaterThanOrEqual(1);
  });

  it('cuts a widened short bar back to its neighbour', () => {
    // 10 px apart is plenty; 1 px apart forces the cut.
    const rects = layoutSpans([{ startMs: at(0), endMs: at(1) }, { startMs: at(6), endMs: at(60) }], 0, DAY, 320);
    expect(rects[0]!.x + rects[0]!.w).toBeLessThanOrEqual(rects[1]!.x);
  });

  it('does not drift over 96 back-to-back quarters of an hour', () => {
    const spans = Array.from({ length: 96 }, (_, i) => ({ startMs: at(i * 15), endMs: at((i + 1) * 15) }));
    const rects = layoutSpans(spans, 0, DAY, 391);
    const last = rects[95]!;
    expect(Math.abs(last.x + last.w - 391)).toBeLessThanOrEqual(1);
  });

  it('clips stays to the window', () => {
    const rects = layoutSpans([{ startMs: -at(60), endMs: at(60) }, { startMs: DAY - at(60), endMs: DAY + at(60) }], 0, DAY, 240);
    expect(rects[0]).toEqual({ x: 0, w: 10 - 1 });
    expect(rects[1]!.x).toBe(230);
    expect(rects[1]!.x + rects[1]!.w).toBeLessThanOrEqual(240);
  });

  it('returns nothing for an empty window, no width or no stays', () => {
    expect(layoutSpans([{ startMs: 0, endMs: 1 }], 0, DAY, 0)).toEqual([]);
    expect(layoutSpans([{ startMs: 0, endMs: 1 }], DAY, DAY, 100)).toEqual([]);
    expect(layoutSpans([{ startMs: 0, endMs: 1 }], DAY, 0, 100)).toEqual([]);
    expect(layoutSpans([], 0, DAY, 100)).toEqual([]);
  });
});

describe('layoutSpans outside the window', () => {
  const win = (startMs: number, endMs: number) => layoutSpans([{ startMs, endMs }], 0, DAY, 320)[0];

  it('gives nothing for a stay entirely before or after the window', () => {
    expect(win(-at(120), -at(60))).toEqual({ x: 0, w: 0 });
    expect(win(-at(120), 0)).toEqual({ x: 0, w: 0 });
    expect(win(DAY + at(60), DAY + at(120))).toEqual({ x: 0, w: 0 });
    expect(win(DAY, DAY + at(60))).toEqual({ x: 0, w: 0 });
  });

  it('keeps a stay in the last minute inside the track', () => {
    expect(win(DAY - at(1), DAY)).toEqual({ x: 318, w: 2 });
  });

  it('leaves the neighbours of an empty entry where they are', () => {
    const a = { startMs: at(60), endMs: at(120) };
    const b = { startMs: at(180), endMs: at(240) };
    const alone = layoutSpans([a, b], 0, DAY, 320);
    const withGhost = layoutSpans([a, { startMs: -at(120), endMs: -at(60) }, b], 0, DAY, 320);
    expect(withGhost).toHaveLength(3);
    expect([withGhost[0], withGhost[2]]).toEqual(alone);
  });
});

describe('clipToBars', () => {
  const stay = [{ startMs: at(360), endMs: at(720) }];
  const bars = layoutSpans(stay, 0, DAY, 320); // { x: 80, w: 79 }: one pixel short of the real end

  it('never lets a layer that ends with the session pass the end of the bar', () => {
    const layer = layoutSpans(stay, 0, DAY, 320, { gapPx: 0 });
    const [clipped] = clipToBars(layer, bars);
    expect(clipped!.x + clipped!.w).toBe(bars[0]!.x + bars[0]!.w);
    expect(clipped!.x).toBe(80);
  });

  it('gives two rectangles, with the separator between them, for a layer that spans a change of channel', () => {
    const two = [{ startMs: at(360), endMs: at(540) }, { startMs: at(540), endMs: at(720) }];
    const barRects = layoutSpans(two, 0, DAY, 320);
    const layer = layoutSpans([{ startMs: at(400), endMs: at(700) }], 0, DAY, 320, { gapPx: 0 });
    const clipped = clipToBars(layer, barRects);
    expect(clipped).toHaveLength(2);
    expect(clipped[1]!.x - (clipped[0]!.x + clipped[0]!.w)).toBeGreaterThanOrEqual(1);
    expect(clipped.map((rect) => rect.source)).toEqual([0, 0]);
  });

  it('returns the rectangles unchanged when there is no voice bar', () => {
    const layer = [{ x: 10, w: 20 }, { x: 40, w: 5 }];
    expect(clipToBars(layer, [])).toEqual([{ x: 10, w: 20, source: 0 }, { x: 40, w: 5, source: 1 }]);
  });

  it('keeps the index of the interval each piece comes from and drops pieces outside any bar', () => {
    const layer = [{ x: 0, w: 10 }, { x: 100, w: 20 }, { x: 300, w: 10 }];
    const clipped = clipToBars(layer, [{ x: 90, w: 40 }]);
    expect(clipped).toEqual([{ x: 100, w: 20, source: 1 }]);
  });
});
