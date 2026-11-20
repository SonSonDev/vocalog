/** Types of the JSON API, shared by the server and the web app. */
import type { FlagIntervals, FlagTimes } from './flags.ts';
import type { MemberStats } from './profile.ts';
import type { MemberYear, MonthCalendar, MonthStrip, WeekStrip, YearCalendar, YearStrip } from './calendar.ts';
import type { DayStrip } from './timeline.ts';

export const PERIODS = ['7d', '30d', '1y', 'all'] as const;
export type Period = (typeof PERIODS)[number];

export interface GuildInfo {
  id: string;
  name: string;
  /** Hash of the server's Discord icon when it has one, served by `/api/guilds/<id>/icon`. */
  icon?: string;
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
  /** One strip per week of the period, newest first, at most 12. */
  weeks: WeekStrip[];
  /** One strip per month of the period, newest first, at most 12. */
  months: MonthStrip[];
  /** One strip per year of the period, newest first, at most 6. */
  years: YearStrip[];
  /** The group's voice time on each day of the last 53 weeks, whatever the period. */
  yearGrid: MemberYear;
}

/** One week in detail (Monday 06:00 to the next Monday 06:00): who was in voice and when. */
export interface WeekView {
  guild: GuildInfo;
  startKey: string;
  startMs: number;
  endMs: number;
  timeZone: string;
  generatedAtMs: number;
  /** The neighbouring weeks that can be opened, or null at either end. */
  prevStartKey: string | null;
  nextStartKey: string | null;
  days: { dayKey: string; startMs: number; endMs: number; totalMs: number }[];
  totalMs: number;
  peak: { count: number; atMs: number } | null;
  /** Average number of people in each hour from `startMs`. */
  bins: number[];
  members: { user: NamedRef; totalMs: number; spans: { channel: NamedRef; startMs: number; endMs: number }[] }[];
}

/** One month as a calendar. */
export interface MonthView extends Omit<MonthCalendar, 'weeks'> {
  guild: GuildInfo;
  timeZone: string;
  generatedAtMs: number;
  prevMonthKey: string | null;
  nextMonthKey: string | null;
  weeks: MonthCalendar['weeks'];
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
  /** Part of `totalMs` spent in the server's AFK channel (still voice time, shown apart). */
  afkMs: number;
  peak: { count: number; atMs: number } | null;
  /** Average number of people in each quarter hour from `startMs`. */
  bins: number[];
  members: {
    user: NamedRef;
    totalMs: number;
    afkMs: number;
    spans: { channel: NamedRef; startMs: number; endMs: number; afk: boolean }[];
    /** When screen sharing, microphone off and headphones off were on, clipped to the day. */
    states: FlagIntervals;
  }[];
}

/** Personal statistics of one member, with names resolved. */
export interface MemberProfile extends Omit<MemberStats, 'userId' | 'channels' | 'together' | 'longestSession'> {
  /** The member's voice time on each day of the last 53 weeks, whatever the period. */
  yearGrid: MemberYear;
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
  /** The server's own time zone, shown in the settings menu next to the one a person may choose. */
  serverTimeZone: string;
  user: NamedRef | null;
}

/** One year as twelve small calendars. */
export interface YearView extends YearCalendar {
  guild: GuildInfo;
  timeZone: string;
  generatedAtMs: number;
  prevYearKey: string | null;
  nextYearKey: string | null;
}
