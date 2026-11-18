import type { NamedRef } from '@vocalog/shared';
import { useState } from 'preact/hooks';
import { initialsOf } from '../format.ts';

/**
 * A round picture of a person, served by the Vocalog server (never by Discord directly). Without a picture, or when
 * it cannot be loaded, the initials are shown instead. It is decoration: the name always sits next to it.
 */
export function Avatar({ user, guildId, size = 28 }: { user: NamedRef; guildId: string; size?: number }) {
  const src = user.avatar ? `/api/guilds/${encodeURIComponent(guildId)}/avatars/${encodeURIComponent(user.id)}?v=${encodeURIComponent(user.avatar)}` : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const style = { '--size': `${size}px` };
  if (src !== null && src !== failedSrc) {
    return <img class="avatar" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" style={style} onError={() => setFailedSrc(src)} />;
  }
  return (
    <span class="avatar avatar-initials" aria-hidden="true" style={style}>
      {initialsOf(user.name)}
    </span>
  );
}
