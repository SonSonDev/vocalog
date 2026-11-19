import { VoiceFlag } from './types.ts';
import type { VoiceEvent } from './types.ts';

/** Time spent in voice with each state on. All values are in ms. */
export interface FlagTimes {
  /** Total time in a voice channel. */
  voiceMs: number;
  /** Microphone off by the user: muted, or deafened (deafening also silences the microphone). A server mute is not counted. */
  mutedMs: number;
  /** Headphones off (self-deafened). */
  deafMs: number;
  /** Screen sharing (Go Live). */
  streamingMs: number;
  /** Camera on. */
  videoMs: number;
}

const empty = (): FlagTimes => ({ voiceMs: 0, mutedMs: 0, deafMs: 0, streamingMs: 0, videoMs: 0 });

/**
 * Time per user with each voice state on, from the event journal of ONE server.
 * Between two events the state is the one set by the earlier event; the last open state runs to `nowMs`.
 * Only time inside [fromMs, min(toMs, nowMs)) counts.
 */
export function flagTimesByUser(
  events: readonly VoiceEvent[],
  window: { fromMs: number; toMs: number },
  nowMs: number,
): Map<string, FlagTimes> {
  const limit = Math.min(window.toMs, nowMs);
  const result = new Map<string, FlagTimes>();
  const state = new Map<string, { channelId: string | null; flags: number; sinceMs: number }>();

  const accrue = (userId: string, startMs: number, endMs: number, flags: number): void => {
    const from = Math.max(startMs, window.fromMs);
    const to = Math.min(endMs, limit);
    if (to <= from) return;
    let times = result.get(userId);
    if (!times) {
      times = empty();
      result.set(userId, times);
    }
    const length = to - from;
    times.voiceMs += length;
    if (flags & (VoiceFlag.SelfMute | VoiceFlag.SelfDeaf)) times.mutedMs += length;
    if (flags & VoiceFlag.SelfDeaf) times.deafMs += length;
    if (flags & VoiceFlag.Streaming) times.streamingMs += length;
    if (flags & VoiceFlag.SelfVideo) times.videoMs += length;
  };

  for (const event of [...events].sort((a, b) => a.atMs - b.atMs)) {
    const current = state.get(event.userId);
    if (current && current.channelId !== null) accrue(event.userId, current.sinceMs, event.atMs, current.flags);
    state.set(event.userId, {
      channelId: event.channelId,
      flags: event.channelId === null ? 0 : event.flags,
      sinceMs: event.atMs,
    });
  }
  for (const [userId, current] of state) {
    if (current.channelId !== null) accrue(userId, current.sinceMs, nowMs, current.flags);
  }
  return result;
}

export function emptyFlagTimes(): FlagTimes {
  return empty();
}

/** A stretch of time, UTC epoch milliseconds, `endMs` exclusive. */
export interface Interval {
  startMs: number;
  endMs: number;
}

/** When each voice state was on, for one user. Same meaning as `FlagTimes`: `mute` includes deafened, a server mute is not counted. */
export interface FlagIntervals {
  share: Interval[];
  mute: Interval[];
  deaf: Interval[];
}

const STATES: { key: keyof FlagIntervals; mask: number }[] = [
  { key: 'share', mask: VoiceFlag.Streaming },
  { key: 'mute', mask: VoiceFlag.SelfMute | VoiceFlag.SelfDeaf },
  { key: 'deaf', mask: VoiceFlag.SelfDeaf },
];

/**
 * The stretches of time in [fromMs, min(toMs, nowMs)) where each voice state was on, per user, from the journal of ONE server.
 * Stretches that touch (a change of channel, an unrelated flag changing) are merged; leaving voice ends them.
 */
export function flagIntervalsByUser(
  events: readonly VoiceEvent[],
  window: { fromMs: number; toMs: number },
  nowMs: number,
): Map<string, FlagIntervals> {
  const limit = Math.min(window.toMs, nowMs);
  const result = new Map<string, FlagIntervals>();
  const state = new Map<string, { channelId: string | null; flags: number; sinceMs: number }>();

  const accrue = (userId: string, startMs: number, endMs: number, flags: number): void => {
    const from = Math.max(startMs, window.fromMs);
    const to = Math.min(endMs, limit);
    if (to <= from) return;
    let intervals = result.get(userId);
    if (!intervals) {
      intervals = { share: [], mute: [], deaf: [] };
      result.set(userId, intervals);
    }
    for (const { key, mask } of STATES) {
      if (!(flags & mask)) continue;
      const list = intervals[key];
      const last = list[list.length - 1];
      if (last && last.endMs === from) last.endMs = to;
      else list.push({ startMs: from, endMs: to });
    }
  };

  for (const event of [...events].sort((a, b) => a.atMs - b.atMs)) {
    const current = state.get(event.userId);
    if (current && current.channelId !== null) accrue(event.userId, current.sinceMs, event.atMs, current.flags);
    state.set(event.userId, { channelId: event.channelId, flags: event.channelId === null ? 0 : event.flags, sinceMs: event.atMs });
  }
  for (const [userId, current] of state) {
    if (current.channelId !== null) accrue(userId, current.sinceMs, nowMs, current.flags);
  }
  return result;
}
