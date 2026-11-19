export interface SpanRect {
  x: number;
  w: number;
}

export interface LayoutOptions {
  /** Narrowest visible bar, so a one-minute stay never disappears. */
  minPx?: number;
  /** Separator left before the next bar. */
  gapPx?: number;
}

/**
 * Places time intervals (sorted by start, not overlapping in time) on a track of `widthPx` pixels.
 * Both edges are rounded to the pixel, so rounding never accumulates; a bar is never narrower than `minPx`
 * and leaves `gapPx` before the next one. Widening a short bar may touch its neighbour: the neighbour keeps
 * its place and the short bar is cut back (down to 1 px). When two bars start on the same pixel the later one
 * moves right by that pixel, which is the only case where a bar is not at its exact place.
 * The result has the same length and order as the input.
 */
export function layoutSpans(
  spans: readonly { startMs: number; endMs: number }[],
  fromMs: number,
  toMs: number,
  widthPx: number,
  { minPx = 2, gapPx = 1 }: LayoutOptions = {},
): SpanRect[] {
  if (widthPx <= 0 || toMs <= fromMs) return [];
  const k = widthPx / (toMs - fromMs);
  const rects: SpanRect[] = [];
  for (const { startMs, endMs } of spans) {
    const start = Math.min(Math.max(startMs, fromMs), toMs);
    const end = Math.min(Math.max(endMs, fromMs), toMs);
    const x0 = Math.round((start - fromMs) * k);
    const x1 = Math.round((end - fromMs) * k);
    let x = x0;
    const previous = rects[rects.length - 1];
    if (previous && previous.x + previous.w > x0) {
      previous.w = Math.max(1, x0 - previous.x);
      x = Math.max(x0, previous.x + previous.w);
    }
    rects.push({ x, w: Math.max(minPx, x1 - x0 - gapPx) });
  }
  return rects;
}
