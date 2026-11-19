import type { ComponentChildren } from 'preact';
import { layoutSpans } from './layout.ts';
import { useWidth } from './useWidth.ts';

export interface TimelineSpan {
  startMs: number;
  endMs: number;
  tip: string;
  /** Shown inside the bar when it is wide enough. */
  label?: string;
}

export type TimelineKind = 'voice' | 'share' | 'mute' | 'deaf';

interface Props {
  spans: readonly TimelineSpan[];
  /** `voice` is the main bar with its channel name; the others are thin lanes under it, each with its own colour and texture. */
  kind?: TimelineKind;
  fromMs: number;
  toMs: number;
  style?: Record<string, string>;
  /** Drawn under the bars (day separators of the week page). */
  children?: ComponentChildren;
}

const HEIGHT = 24;
const LANE_HEIGHT = 8;
/** Narrower than this, a name would be cut mid-letter: only the tooltip and the table carry it. */
const LABEL_MIN_PX = 40;

/**
 * One row of stays as SVG rectangles in real pixels. The track keeps its HTML box (height, background, hour hairlines);
 * colours come from CSS classes so themes and the accent colour apply without a reload.
 */
export function TimelineTrack({ spans, kind = 'voice', fromMs, toMs, style, children }: Props) {
  const height = kind === 'voice' ? HEIGHT : LANE_HEIGHT;
  const [ref, width] = useWidth<HTMLSpanElement>();
  const rects = layoutSpans(spans, fromMs, toMs, width);
  return (
    <span ref={ref} class={kind === 'voice' ? 'tl-track' : 'tl-track tl-lane'} style={style} aria-hidden="true">
      {children}
      <svg class="tl-svg" width="100%" height={height}>
        {rects.map((rect, index) => {
          const span = spans[index]!;
          return (
            // A nested <svg> clips its content: a name never spills out of its bar.
            <svg key={index} x={rect.x} width={rect.w} height={height} data-tip={span.tip}>
              <rect class={`tl-rect tl-rect-${kind}`} width={rect.w} height={height} rx={Math.min(3, rect.w / 2)} />
              {kind === 'voice' && span.label && rect.w >= LABEL_MIN_PX && (
                <text class="tl-label" x={6} y={HEIGHT / 2} dominant-baseline="central">
                  {span.label}
                </text>
              )}
            </svg>
          );
        })}
      </svg>
    </span>
  );
}
