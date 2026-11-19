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

interface Props {
  spans: readonly TimelineSpan[];
  fromMs: number;
  toMs: number;
  style?: Record<string, string>;
  /** Drawn under the bars (day separators of the week page). */
  children?: ComponentChildren;
}

const HEIGHT = 24;
/** Narrower than this, a name would be cut mid-letter: only the tooltip and the table carry it. */
const LABEL_MIN_PX = 40;

/**
 * One row of stays as SVG rectangles in real pixels. The track keeps its HTML box (height, background, hour hairlines);
 * colours come from CSS classes so themes and the accent colour apply without a reload.
 */
export function TimelineTrack({ spans, fromMs, toMs, style, children }: Props) {
  const [ref, width] = useWidth<HTMLSpanElement>();
  const rects = layoutSpans(spans, fromMs, toMs, width);
  return (
    <span ref={ref} class="tl-track" style={style} aria-hidden="true">
      {children}
      <svg class="tl-svg" width="100%" height={HEIGHT}>
        {rects.map((rect, index) => {
          const span = spans[index]!;
          return (
            // A nested <svg> clips its content: a name never spills out of its bar.
            <svg key={index} x={rect.x} width={rect.w} height={HEIGHT} data-tip={span.tip}>
              <rect class="tl-rect" width={rect.w} height={HEIGHT} rx={Math.min(3, rect.w / 2)} />
              {span.label && rect.w >= LABEL_MIN_PX && (
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
