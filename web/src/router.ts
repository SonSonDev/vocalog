import { PERIODS } from '@vocalog/shared';
import type { Period } from '@vocalog/shared';
import { useEffect, useState } from 'preact/hooks';

export type Route = { name: 'home' } | { name: 'member'; userId: string } | { name: 'day'; dayKey: string };

export function parseRoute(pathname: string): Route {
  const match = /^\/membres\/([^/]+)\/?$/.exec(pathname);
  if (match) {
    try {
      return { name: 'member', userId: decodeURIComponent(match[1]!) };
    } catch {
      return { name: 'home' };
    }
  }
  const day = /^\/jours\/(\d{4}-\d{2}-\d{2})\/?$/.exec(pathname);
  if (day) return { name: 'day', dayKey: day[1]! };
  return { name: 'home' };
}

/** `?serveur=<id>&periode=<period>`, the state that survives a reload and can be shared. */
export function readParams(search: string): { guildId: string | null; period: Period | null } {
  const params = new URLSearchParams(search);
  const period = params.get('periode');
  return {
    guildId: params.get('serveur'),
    period: period !== null && (PERIODS as readonly string[]).includes(period) ? (period as Period) : null,
  };
}

export function buildSearch(params: { guildId: string | null; period: Period }): string {
  const search = new URLSearchParams();
  if (params.guildId) search.set('serveur', params.guildId);
  search.set('periode', params.period);
  return `?${search.toString()}`;
}

export function memberPath(userId: string, search: string): string {
  return `/membres/${encodeURIComponent(userId)}${search}`;
}

export function dayPath(dayKey: string, search: string): string {
  return `/jours/${dayKey}${search}`;
}

const EVENT = 'vocalog:navigate';

export function navigate(to: string, replace = false): void {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(EVENT));
}

export interface Location {
  pathname: string;
  search: string;
}

/** The current location, re-read after any navigation or back/forward. */
export function useLocation(): Location {
  const read = (): Location => ({ pathname: window.location.pathname, search: window.location.search });
  const [location, setLocation] = useState<Location>(read);
  useEffect(() => {
    const update = (): void => setLocation(read());
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return location;
}
