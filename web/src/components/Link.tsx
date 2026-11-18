import type { ComponentChildren } from 'preact';
import { navigate } from '../router.ts';

interface Props {
  to: string;
  class?: string;
  /** Called when the pointer, the focus or a finger reaches the link: the next page's data can start loading. */
  onPrefetch?: () => void;
  children: ComponentChildren;
}

/** A real link (works with middle click and "open in a new tab") that navigates without reloading on a plain click. */
export function Link({ to, class: className, onPrefetch, children }: Props) {
  return (
    <a
      href={to}
      class={className}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      onTouchStart={onPrefetch}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
        window.scrollTo(0, 0);
      }}
    >
      {children}
    </a>
  );
}
