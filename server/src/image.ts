const CDN = 'https://cdn.discordapp.com';
const TIMEOUT_MS = 5000;
const MAX_BYTES = 200_000;
const MAX_ENTRIES = 300;
const MISS_TTL_MS = 10 * 60_000;

export interface AvatarImage {
  body: Buffer;
  contentType: string;
}

/** Discord ids are numbers written as text; avatar hashes are 32 hexadecimal digits, with `a_` in front when animated. */
export function isUserId(value: string): boolean {
  return /^\d{15,25}$/.test(value);
}

export function isAvatarHash(value: string): boolean {
  return /^(a_)?[0-9a-f]{32}$/.test(value);
}

/** The two kinds of picture the dashboard shows: a person's avatar and a server's icon. */
export type ImageKind = 'avatars' | 'icons';

/**
 * Fetches avatars and server icons from Discord for the dashboard, so visitors never contact Discord themselves.
 *
 * The address is built here from a fixed kind and two checked values (an id and a hash, both read from the database),
 * never from anything the visitor sends, and redirects are refused: this can only reach Discord's image host. Only a
 * small PNG is accepted. Images are kept in memory (bounded); a failure is remembered for a few minutes so Discord is
 * not hammered.
 */
export function createImageProxy(fetchFn: typeof fetch, now: () => number) {
  const images = new Map<string, AvatarImage>();
  const misses = new Map<string, number>();

  return async function getImage(kind: ImageKind, id: string, hash: string): Promise<AvatarImage | null> {
    if (!isUserId(id) || !isAvatarHash(hash)) return null;
    const key = `${kind}/${id}/${hash}`;
    const known = images.get(key);
    if (known) return known;
    const missedAt = misses.get(key);
    if (missedAt !== undefined && now() - missedAt < MISS_TTL_MS) return null;

    try {
      const response = await fetchFn(`${CDN}/${kind}/${id}/${hash}.png?size=64`, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/png')) throw new Error(`unexpected answer (${response.status})`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_BYTES) throw new Error('unexpected size');
      const image = { body, contentType: 'image/png' };
      images.set(key, image);
      if (images.size > MAX_ENTRIES) images.delete(images.keys().next().value as string);
      misses.delete(key);
      return image;
    } catch {
      misses.set(key, now());
      if (misses.size > MAX_ENTRIES) misses.delete(misses.keys().next().value as string);
      return null;
    }
  };
}
