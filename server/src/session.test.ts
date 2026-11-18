import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { clearCookie, parseCookies, serializeCookie, signSession, verifySession } from './session.ts';
import type { Session } from './session.ts';

const SECRET = 'a-secret-of-at-least-thirty-two-characters!!';
const NOW = 1_800_000_000;
const session: Session = { userId: '42', userName: 'Alex', guildIds: ['g1', 'g2'], expiresAtSec: NOW + 3600 };

describe('signSession and verifySession', () => {
  it('round-trips a valid session', () => {
    expect(verifySession(signSession(session, SECRET), SECRET, NOW)).toEqual(session);
  });

  it('rejects a session signed with another secret', () => {
    expect(verifySession(signSession(session, 'another-secret-of-at-least-thirty-two-chars'), SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered payload (forged server list)', () => {
    const [, signature] = signSession(session, SECRET).split('.');
    const forged = Buffer.from(JSON.stringify({ u: '42', n: 'Alex', g: ['g1', 'g2', 'g-secret'], e: NOW + 3600 })).toString('base64url');
    expect(verifySession(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signSession(session, SECRET);
    expect(verifySession(token.slice(0, -2) + 'xx', SECRET, NOW)).toBeNull();
  });

  it('rejects an expired session, including one expiring right now', () => {
    expect(verifySession(signSession(session, SECRET), SECRET, NOW + 3600)).toBeNull();
    expect(verifySession(signSession(session, SECRET), SECRET, NOW + 7200)).toBeNull();
  });

  it('rejects missing, empty and malformed values without throwing', () => {
    for (const value of [undefined, '', 'nodot', 'a.b.c', '.', 'a.', '.b', '%%%.%%%']) {
      expect(verifySession(value, SECRET, NOW)).toBeNull();
    }
  });

  it('rejects a correctly signed payload of the wrong shape', () => {
    // Signed with the real secret on purpose: only the shape check can reject these.
    const signRaw = (data: unknown): string => {
      const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
      return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('base64url')}`;
    };
    const good = { u: '42', n: 'Alex', g: ['g1'], e: NOW + 3600 };
    expect(verifySession(signRaw(good), SECRET, NOW)).not.toBeNull(); // the helper really produces valid tokens
    for (const bad of [{ ...good, u: 42 }, { ...good, n: null }, { ...good, g: 'g1' }, { ...good, g: ['g1', 7] }, { ...good, e: '9' }, null, 'text', [1]]) {
      expect(verifySession(signRaw(bad), SECRET, NOW), JSON.stringify(bad)).toBeNull();
    }
  });

  it('does not contain the secret', () => {
    expect(signSession(session, SECRET)).not.toContain(SECRET);
  });
});

describe('cookies', () => {
  it('parses a cookie header and keeps the first value of a name', () => {
    const cookies = parseCookies('a=1; vocalog_session=abc.def; a=2');
    expect(cookies.get('a')).toBe('1');
    expect(cookies.get('vocalog_session')).toBe('abc.def');
  });

  it('returns nothing without a header', () => {
    expect(parseCookies(undefined).size).toBe(0);
  });

  it('builds a cookie that scripts cannot read, with SameSite and Secure when asked', () => {
    const secure = serializeCookie('s', 'v', { maxAgeSec: 60, secure: true });
    expect(secure).toContain('HttpOnly');
    expect(secure).toContain('SameSite=Lax');
    expect(secure).toContain('Secure');
    expect(secure).toContain('Max-Age=60');
    expect(serializeCookie('s', 'v', { maxAgeSec: 60, secure: false })).not.toContain('Secure');
  });

  it('clears a cookie with a zero lifetime', () => {
    expect(clearCookie('s', true)).toContain('Max-Age=0');
  });
});

describe('session @username', () => {
  const secret = SECRET;
  const base = { userId: 'u1', userName: 'Alex', guildIds: ['g1'], expiresAtSec: 2_000_000_000 };

  it('survives a round trip when present and is absent otherwise', () => {
    expect(verifySession(signSession({ ...base, userHandle: 'alex_42' }, secret), secret, 1)?.userHandle).toBe('alex_42');
    expect(verifySession(signSession(base, secret), secret, 1)?.userHandle).toBeUndefined();
  });

  it('ignores a handle that is not text', () => {
    const payload = Buffer.from(JSON.stringify({ u: 'u1', n: 'Alex', h: 42, g: ['g1'], e: 2_000_000_000 })).toString('base64url');
    const token = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
    expect(verifySession(token, secret, 1)?.userHandle).toBeUndefined();
  });
});
