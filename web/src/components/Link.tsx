import type { ComponentChildren } from 'preact';
import { navigate } from '../router.ts';

interface Props {
  to: string;
  class?: string;
  children: ComponentChildren;
}

/** A real link (works with middle click and "open in a new tab") that navigates without reloading on a plain click. */
export function Link({ to, class: className, children }: Props) {
  return (
    <a
      href={to}
      class={className}
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
