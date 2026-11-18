import { createHmac, timingSafeEqual } from 'node:crypto';

/** Everything the server remembers about a logged-in person. No Discord token is kept. */
export interface Session {
  userId: string;
  userName: string;
  /** The Discord @username, when it was known at login (older cookies do not have it). */
  userHandle?: string;
  /** Servers the person belongs to AND that Vocalog records, fixed at login time. */
  guildIds: string[];
  expiresAtSec: number;
}

function mac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** `payload.signature`: the payload is readable, but cannot be changed without the secret. */
export function signSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify({ u: session.userId, n: session.userName, h: session.userHandle, g: session.guildIds, e: session.expiresAtSec })).toString('base64url');
  return `${payload}.${mac(payload, secret)}`;
}

/** The session behind a cookie value, or null when it is missing, forged, malformed or expired. */
export function verifySession(token: string | undefined, secret: string, nowSec: number): Session | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];

  const expected = Buffer.from(mac(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null) return null;
    const { u, n, h, g, e } = data;
    if (typeof u !== 'string' || typeof n !== 'string' || typeof e !== 'number') return null;
    if (!Array.isArray(g) || !g.every((id) => typeof id === 'string')) return null;
    if (e <= nowSec) return null;
    return { userId: u, userName: n, ...(typeof h === 'string' && h !== '' ? { userHandle: h } : {}), guildIds: g as string[], expiresAtSec: e };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name && !cookies.has(name)) cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
}

/** A cookie that scripts cannot read, is not sent on cross-site requests (except plain navigation) and is Secure over https. */
export function serializeCookie(name: string, value: string, options: { maxAgeSec: number; secure: boolean }): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${options.maxAgeSec}${options.secure ? '; Secure' : ''}`;
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { maxAgeSec: 0, secure });
}
