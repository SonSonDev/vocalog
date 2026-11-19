import { describe, expect, it } from 'vitest';
import { layoutSpans } from './layout.ts';

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
