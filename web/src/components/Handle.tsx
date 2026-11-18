import type { NamedRef } from '@vocalog/shared';
import { visibleHandle } from '../format.ts';

/** The Discord @username in small muted text, shown only when it adds something to the displayed name. */
export function Handle({ user }: { user: NamedRef }) {
  const text = visibleHandle(user.name, user.handle);
  return text === null ? null : <span class="handle">{text}</span>;
}
