/** Types of the JSON API, shared by the server and the web app. */
import type { FlagTimes } from './flags.ts';
import type { MemberStats } from './profile.ts';

export const PERIODS = ['7d', '30d', '1y', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export interface GuildInfo {
  id: string;
  name: string;
}

export interface NamedRef {
  id: string;
  name: string;
  /** The Discord username (the @handle), when known. `name` is what the person shows on that server. */
  handle?: string;
}

export interface Summary {
  guild: GuildInfo;
  period: Period;
  fromMs: number;
  toMs: number;
  timeZone: string;
  generatedAtMs: number;
  totals: {
    totalMs: number;
    avgPerDayMs: number;
    sessionCount: number;
    activeMembers: number;
    days: number;
    streakDays: number;
  };
  longestSession: { user: NamedRef; channel: NamedRef; startMs: number; durationMs: number } | null;
  peak: { count: number; atMs: number } | null;
  members: { user: NamedRef; totalMs: number; sessions: number; hourMs: number[] }[];
  channels: { channel: NamedRef; totalMs: number }[];
  /** Voice time in ms, indexed [weekday 0=Monday..6=Sunday][local hour 0..23]. */
  heat: number[][];
}

/** Personal statistics of one member, with names resolved. */
export interface MemberProfile extends Omit<MemberStats, 'userId' | 'channels' | 'together' | 'longestSession'> {
  guild: GuildInfo;
  user: NamedRef;
  period: Period;
  fromMs: number;
  toMs: number;
  timeZone: string;
  generatedAtMs: number;
  longestSession: { channel: NamedRef; startMs: number; durationMs: number } | null;
  channels: { channel: NamedRef; totalMs: number }[];
  together: {
    withOthersMs: number;
    aloneMs: number;
    top: { user: NamedRef; ms: number }[];
  };
}

/** Who is looking: the answer of GET /api/me. The `authMode` 'none' exists only for local development. */
export interface MeResponse {
  authMode: 'discord' | 'none';
  user: NamedRef | null;
}
