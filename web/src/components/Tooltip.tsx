import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { placeTooltip } from '../tooltip.ts';

const TOUCH_VISIBLE_MS = 2500;

/**
 * One tooltip for the whole page, shown at once and following the pointer. The browser's own `title` tooltip waits about
 * half a second, which feels broken on a chart you scan with the mouse.
 *
 * Any element with a `data-tip="text"` attribute gets it (a line break in the text makes a second line). It listens
 * to the document once instead of mounting a component per cell, which matters for the hundreds of cells of the strips
 * and the heat map. The text is a hint only: whatever it says is also available as normal text or a table.
 */
export function TooltipLayer() {
  const [text, setText] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  // Place the tooltip after each render, once its size is known, without going through state for every movement.
  const place = (): void => {
    const element = box.current;
    if (!element) return;
    const { x, y } = placeTooltip(pointer.current, { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  useLayoutEffect(place, [text]);

  useEffect(() => {
    let frame = 0;
    let touchTimer = 0;
    const tipOf = (target: EventTarget | null): string | null => (target instanceof Element ? target.closest('[data-tip]')?.getAttribute('data-tip') ?? null : null);
    const hide = (): void => {
      window.clearTimeout(touchTimer);
      setText(null);
    };

    const onOver = (event: PointerEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
      const next = tipOf(event.target);
      setText(next);
      window.clearTimeout(touchTimer);
      if (next !== null && event.pointerType === 'touch') touchTimer = window.setTimeout(hide, TOUCH_VISIBLE_MS);
    };
    const onMove = (event: PointerEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (frame === 0) {
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          place();
        });
      }
    };
    const onFocus = (event: FocusEvent): void => {
      const next = tipOf(event.target);
      if (next === null || !(event.target instanceof Element)) return;
      const rect = event.target.getBoundingClientRect();
      pointer.current = { x: rect.left + rect.width / 2, y: rect.top };
      setText(next);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerdown', onOver);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(touchTimer);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onOver);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey);
      document.documentElement.removeEventListener('pointerleave', hide);
      window.removeEventListener('scroll', hide);
    };
  }, []);

  return (
    <div ref={box} class="tooltip" role="tooltip" hidden={text === null}>
      {text}
    </div>
  );
}
