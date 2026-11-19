import { PERIODS } from '@vocalog/shared';
import type { Period } from '@vocalog/shared';
import { useEffect, useReducer } from 'preact/hooks';
import { DEFAULT_ACCENT, findAccent } from './accents.ts';
import type { AccentId } from './accents.ts';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type WeekStart = 'monday' | 'sunday';

/** What a person chose for themselves. It lives in this browser only: nothing is sent to the server except the two that change the figures. */
export interface Settings {
  theme: ThemeMode;
  accent: AccentId;
  density: Density;
  /** Cut the animations even when the system does not ask for it. */
  reduceMotion: boolean;
  /** The period a page opens on when the link does not say. */
  defaultPeriod: Period;
  /** `server` (the server's own), `browser` (this device's) or an IANA name such as `Europe/Paris`. */
  timeZone: string;
  weekStart: WeekStart;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: DEFAULT_ACCENT,
  density: 'comfortable',
  reduceMotion: false,
  defaultPeriod: '30d',
  timeZone: 'server',
  weekStart: 'monday',
};

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const THEMES: readonly ThemeMode[] = ['system', 'light', 'dark'];
const DENSITIES: readonly Density[] = ['comfortable', 'compact'];
const WEEK_STARTS: readonly WeekStart[] = ['monday', 'sunday'];

/**
 * Settings from whatever was stored, field by field: a value that is missing, of the wrong kind or no longer offered falls
 * back to the default, so a damaged or older record never breaks the page. `legacyTheme` is the value the previous version
 * stored under its own key.
 */
export function parseSettings(raw: unknown, legacyTheme: string | null = null): Settings {
  const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback);
  const legacy = legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : DEFAULT_SETTINGS.theme;
  const timeZone = typeof stored.timeZone === 'string' && (stored.timeZone === 'server' || stored.timeZone === 'browser' || isValidTimeZone(stored.timeZone)) ? stored.timeZone : DEFAULT_SETTINGS.timeZone;
  return {
    theme: 'theme' in stored ? pick(stored.theme, THEMES, DEFAULT_SETTINGS.theme) : legacy,
    accent: typeof stored.accent === 'string' && findAccent(stored.accent) ? (stored.accent as AccentId) : DEFAULT_SETTINGS.accent,
    density: pick(stored.density, DENSITIES, DEFAULT_SETTINGS.density),
    reduceMotion: stored.reduceMotion === true,
    defaultPeriod: pick(stored.defaultPeriod, PERIODS, DEFAULT_SETTINGS.defaultPeriod),
    timeZone,
    weekStart: pick(stored.weekStart, WEEK_STARTS, DEFAULT_SETTINGS.weekStart),
  };
}

export function effectiveTheme(mode: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

/** The IANA name to send with a request, or an empty text when the server's own should be used. */
export function timeZoneParam(settings: Settings, browserZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  if (settings.timeZone === 'server') return '';
  return settings.timeZone === 'browser' ? browserZone : settings.timeZone;
}

/* ---- The store: one copy in memory, kept in the browser's storage, applied to the page and shared with the components. ---- */

const KEY = 'vocalog-settings';
const LEGACY_THEME_KEY = 'vocalog-theme';

let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

function readStored(): Settings {
  try {
    const text = window.localStorage.getItem(KEY);
    return parseSettings(text === null ? null : JSON.parse(text), window.localStorage.getItem(LEGACY_THEME_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Puts the settings on the page: the theme, the accent, the density and the motion are attributes and variables of the root. */
export function applySettings(settings: Settings): void {
  const root = document.documentElement;
  const theme = effectiveTheme(settings.theme, systemPrefersDark());
  root.dataset.theme = theme;
  root.dataset.density = settings.density;
  if (settings.reduceMotion) root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  const accent = findAccent(settings.accent);
  if (!accent || accent.id === DEFAULT_ACCENT) {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--on-accent');
  } else {
    root.style.setProperty('--accent', accent[theme].accent);
    root.style.setProperty('--on-accent', accent[theme].onAccent);
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore: the choice applies for this visit only
  }
  applySettings(current);
  for (const listener of listeners) listener();
}

export function resetSettings(): void {
  updateSettings(DEFAULT_SETTINGS);
}

/** Reads the stored settings and applies them; the system theme is followed while it is the chosen one. */
export function initSettings(): void {
  current = readStored();
  applySettings(current);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current.theme === 'system') applySettings(current);
  });
}

/** The current settings, and a new render when they change. */
export function useSettings(): Settings {
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    listeners.add(redraw as () => void);
    return () => {
      listeners.delete(redraw as () => void);
    };
  }, []);
  return current;
}

/** Every IANA time zone this browser knows (plus UTC), for the settings menu. */
export function timeZoneNames(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  return [...new Set(['UTC', ...supported])].sort((a, b) => a.localeCompare(b));
}

/** The query that carries the settings that change the figures (time zone, first day of the week); empty when all are the defaults. */
export function viewQuery(settings: Settings, browserZone?: string): string {
  const zone = timeZoneParam(settings, browserZone);
  const parts: string[] = [];
  if (zone) parts.push(`tz=${encodeURIComponent(zone)}`);
  if (settings.weekStart !== 'monday') parts.push(`ws=${settings.weekStart}`);
  return parts.join('&');
}
