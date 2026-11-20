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
 * moves right by that pixel, which is the only case where a bar is not at its exact place. A bar is moved left
 * when its minimum width would cross the end of the track.
 * A stay that does not intersect the window gives `{ x: 0, w: 0 }` (nothing to draw): the result always has the
 * same length and order as the input, and empty entries are ignored when looking for a neighbour.
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
  let previous: SpanRect | undefined;
  for (const { startMs, endMs } of spans) {
    if (endMs <= fromMs || startMs >= toMs) {
      rects.push({ x: 0, w: 0 });
      continue;
    }
    const start = Math.max(startMs, fromMs);
    const end = Math.min(endMs, toMs);
    const x0 = Math.round((start - fromMs) * k);
    const x1 = Math.round((end - fromMs) * k);
    let x = x0;
    if (previous && previous.x + previous.w > x0) {
      previous.w = Math.max(1, x0 - previous.x);
      x = Math.max(x0, previous.x + previous.w);
    }
    const w = Math.min(widthPx, Math.max(minPx, x1 - x0 - gapPx));
    const rect = { x: Math.min(x, widthPx - w), w };
    rects.push(rect);
    previous = rect;
  }
  return rects;
}

export interface LayerRect extends SpanRect {
  /** Index of the original interval, to find its tooltip. */
  source: number;
}

/** Cuts a layer's rectangles to the voice bars: a state only describes time spent in voice. */
export function clipToBars(layer: readonly SpanRect[], bars: readonly SpanRect[]): LayerRect[] {
  if (bars.length === 0) return layer.map((rect, source) => ({ ...rect, source })); // the "En vocal" layer is hidden
  const out: LayerRect[] = [];
  layer.forEach((rect, source) => {
    for (const bar of bars) {
      const x = Math.max(rect.x, bar.x);
      const end = Math.min(rect.x + rect.w, bar.x + bar.w);
      if (end > x) out.push({ x, w: end - x, source });
    }
  });
  return out;
}
