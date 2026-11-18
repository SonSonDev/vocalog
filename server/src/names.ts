import type { NamedRef } from '@vocalog/shared';
import { channelNames, userAvatars, userHandles, userNames } from './queries.ts';
import type { Db } from './queries.ts';

/**
 * Turns ids into the names shown on one server: people (name on that server, `@username`, avatar hash) and channels.
 * An unknown id gets a readable fallback built from its last four characters.
 */
export function createNamer(db: Db, guildId: string): { user: (id: string) => NamedRef; channel: (id: string) => NamedRef } {
  const users = userNames(db, guildId);
  const handles = userHandles(db);
  const avatars = userAvatars(db);
  const channels = channelNames(db, guildId);
  return {
    user: (id) => ({ id, name: users.get(id) ?? `Membre ${id.slice(-4)}`, handle: handles.get(id), avatar: avatars.get(id) }),
    channel: (id) => ({ id, name: channels.get(id) ?? `Salon ${id.slice(-4)}` }),
  };
}
