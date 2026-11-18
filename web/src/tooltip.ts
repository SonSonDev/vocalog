export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

const OFFSET_X = 12;
const OFFSET_Y = 16;
const MARGIN = 6;

/**
 * Where to put a tooltip so it stays on screen: to the lower right of the pointer by default, flipped to the left
 * and/or above when it would overflow, and never past the edge of the window.
 */
export function placeTooltip(pointer: Point, tip: Size, viewport: Size): Point {
  let x = pointer.x + OFFSET_X;
  let y = pointer.y + OFFSET_Y;
  if (x + tip.width > viewport.width - MARGIN) x = pointer.x - OFFSET_X - tip.width;
  if (y + tip.height > viewport.height - MARGIN) y = pointer.y - OFFSET_Y / 2 - tip.height - OFFSET_Y / 2;
  return {
    x: Math.max(MARGIN, Math.min(x, viewport.width - tip.width - MARGIN)),
    y: Math.max(MARGIN, Math.min(y, viewport.height - tip.height - MARGIN)),
  };
}
