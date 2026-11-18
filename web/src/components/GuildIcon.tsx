import type { GuildInfo } from '@vocalog/shared';
import { useState } from 'preact/hooks';
import { initialsOf } from '../format.ts';

/**
 * The picture of a server, served by the Vocalog server (never by Discord directly). A rounded square, to tell it from the
 * round pictures of people. Without an icon, or when it cannot be loaded, the initials of the server are shown.
 */
export function GuildIcon({ guild, size = 32 }: { guild: GuildInfo | null; size?: number }) {
  const src = guild?.icon ? `/api/guilds/${encodeURIComponent(guild.id)}/icon?v=${encodeURIComponent(guild.icon)}` : null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const style = { '--size': `${size}px` };
  if (src !== null && src !== failedSrc) {
    return <img class="avatar guild-icon" src={src} alt="" width={size} height={size} decoding="async" style={style} onError={() => setFailedSrc(src)} />;
  }
  return (
    <span class="avatar avatar-initials guild-icon" aria-hidden="true" style={style}>
      {guild ? initialsOf(guild.name) : ''}
    </span>
  );
}
