import type { ComponentChildren } from 'preact';
import { clipToBars, layoutSpans } from './layout.ts';
import { useWidth } from './useWidth.ts';

export interface TimelineSpan {
  startMs: number;
  endMs: number;
  tip: string;
  /** Shown inside the bar when it is wide enough. */
  label?: string;
  /** Time in the AFK channel: still voice time, drawn in a desaturated neutral. */
  afk?: boolean;
}

/** A state drawn over the voice bar. Deafened always includes microphone off, so `deaf` is drawn over `mute` in the same band. */
export type OverlayKind = 'share' | 'mute' | 'deaf';

export interface TimelineOverlay {
  kind: OverlayKind;
  spans: readonly TimelineSpan[];
}

interface Props {
  spans: readonly TimelineSpan[];
  /** Layers drawn over the bar: screen sharing in the top half, microphone off and headphones off (over it) in the bottom half. Draw order is the array order. */
  overlays?: readonly TimelineOverlay[];
  fromMs: number;
  toMs: number;
  style?: Record<string, string>;
  /** Drawn under the bars (day separators of the week page). */
  children?: ComponentChildren;
}

const HEIGHT = 24;
const BAND = HEIGHT / 2;
const BAND_ROW: Record<OverlayKind, number> = { share: 0, mute: 1, deaf: 1 };
/** Narrower than this, a name would be cut mid-letter: only the tooltip and the table carry it. */
const LABEL_MIN_PX = 40;

/**
 * One row of stays as SVG rectangles in real pixels. The track keeps its HTML box (height, background, hour hairlines);
 * colours come from CSS classes so themes and the accent colour apply without a reload.
 */
export function TimelineTrack({ spans, overlays = [], fromMs, toMs, style, children }: Props) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  const rects = layoutSpans(spans, fromMs, toMs, width);
  // The bands would sit on the channel name, so the name gives way as soon as a layer is shown.
  const showLabels = overlays.length === 0;
  return (
    <span ref={ref} class="tl-track" style={style} aria-hidden="true">
      {children}
      <svg class="tl-svg" width="100%" height={HEIGHT}>
        {rects.map((rect, index) => {
          if (rect.w === 0) return null; // outside the window
          const span = spans[index]!;
          return (
            // A nested <svg> clips its content: a name never spills out of its bar.
            <svg key={index} x={rect.x} width={rect.w} height={HEIGHT} data-tip={span.tip}>
              <rect class={span.afk ? 'tl-rect tl-rect-afk' : 'tl-rect'} width={rect.w} height={HEIGHT} rx={Math.min(3, rect.w / 2)} />
              {showLabels && span.label && rect.w >= LABEL_MIN_PX && (
                <text class={span.afk ? 'tl-label tl-label-afk' : 'tl-label'} x={6} y={HEIGHT / 2} dominant-baseline="central">
                  {span.label}
                </text>
              )}
            </svg>
          );
        })}
        {overlays.map((overlay) =>
          clipToBars(layoutSpans(overlay.spans, fromMs, toMs, width, { gapPx: 0 }), rects)
            .filter((rect) => rect.w > 0)
            .map((rect) => (
            <rect
              key={`${overlay.kind}${rect.source}-${rect.x}`}
              class={`tl-rect tl-rect-${overlay.kind}`}
              x={rect.x}
              y={BAND_ROW[overlay.kind] * BAND}
              width={rect.w}
              height={BAND}
              rx={Math.min(3, rect.w / 2)}
              data-tip={overlay.spans[rect.source]!.tip}
            />
          )),
        )}
      </svg>
    </span>
  );
}
