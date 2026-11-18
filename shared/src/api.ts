/** Types of the JSON API, shared by the server and the web app. */
import type { FlagTimes } from './flags.ts';
import type { MemberStats } from './profile.ts';
import type { DayStrip } from './timeline.ts';

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
  /** Hash of the person's Discord avatar when they have one. The image is served by `/api/guilds/<id>/avatars/<user>`. */
  avatar?: string;
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
  /** One presence strip per day (06:00 to 06:00) of the period, newest first, at most 31. */
  days: DayStrip[];
}

/** One day in detail: who was in voice and when. */
export interface DayView {
  guild: GuildInfo;
  dayKey: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  generatedAtMs: number;
  /** The neighbouring days that can be opened, or null at either end. */
  prevDayKey: string | null;
  nextDayKey: string | null;
  totalMs: number;
  peak: { count: number; atMs: number } | null;
  /** Average number of people in each quarter hour from `startMs`. */
  bins: number[];
  members: { user: NamedRef; totalMs: number; spans: { channel: NamedRef; startMs: number; endMs: number }[] }[];
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
