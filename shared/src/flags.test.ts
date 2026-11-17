import { describe, expect, it } from 'vitest';
import { flagTimesByUser } from './flags.ts';
import { VoiceFlag } from './types.ts';
import type { VoiceEvent } from './types.ts';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 16);
const WINDOW = { fromMs: T0, toMs: T0 + 24 * HOUR };

const ev = (userId: string, channelId: string | null, atMs: number, flags = 0, kind: VoiceEvent['kind'] = 'state'): VoiceEvent => ({
  guildId: 'g1',
  userId,
  channelId,
  kind,
  atMs,
  source: 'live',
  flags,
});

describe('flagTimesByUser', () => {
  it('counts muted, streaming and total voice time between state changes', () => {
    const events = [
      ev('a', 'c1', T0 + 1 * HOUR, 0, 'join'),
      ev('a', 'c1', T0 + 2 * HOUR, VoiceFlag.SelfMute), // muted from 2h
      ev('a', 'c1', T0 + 4 * HOUR, VoiceFlag.Streaming), // unmuted, streaming from 4h
      ev('a', null, T0 + 5 * HOUR, 0, 'leave'),
    ];
    const times = flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!;
    expect(times.voiceMs).toBe(4 * HOUR);
    expect(times.mutedMs).toBe(2 * HOUR);
    expect(times.streamingMs).toBe(HOUR);
    expect(times.videoMs).toBe(0);
    expect(times.deafMs).toBe(0);
  });

  it('counts a deafened user as muted too, and as deafened', () => {
    const events = [
      ev('a', 'c1', T0, VoiceFlag.SelfDeaf | VoiceFlag.SelfMute, 'join'),
      ev('a', null, T0 + HOUR, 0, 'leave'),
    ];
    const times = flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!;
    expect(times.mutedMs).toBe(HOUR);
    expect(times.deafMs).toBe(HOUR);
  });

  it('counts a deafen flag alone as muted as well', () => {
    const events = [ev('a', 'c1', T0, VoiceFlag.SelfDeaf, 'join'), ev('a', null, T0 + HOUR, 0, 'leave')];
    expect(flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!.mutedMs).toBe(HOUR);
  });

  it('does not count a server mute as the user muting', () => {
    const events = [ev('a', 'c1', T0, VoiceFlag.ServerMute, 'join'), ev('a', null, T0 + HOUR, 0, 'leave')];
    expect(flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!.mutedMs).toBe(0);
  });

  it('counts camera time', () => {
    const events = [ev('a', 'c1', T0, VoiceFlag.SelfVideo, 'join'), ev('a', null, T0 + 2 * HOUR, 0, 'leave')];
    expect(flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!.videoMs).toBe(2 * HOUR);
  });

  it('does not count time outside a voice channel', () => {
    const events = [
      ev('a', 'c1', T0, VoiceFlag.SelfMute, 'join'),
      ev('a', null, T0 + HOUR, 0, 'leave'),
      ev('a', 'c1', T0 + 3 * HOUR, 0, 'join'),
      ev('a', null, T0 + 4 * HOUR, 0, 'leave'),
    ];
    const times = flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!;
    expect(times.voiceMs).toBe(2 * HOUR);
    expect(times.mutedMs).toBe(HOUR);
  });

  it('keeps the flags across a move between channels', () => {
    const events = [
      ev('a', 'c1', T0, VoiceFlag.SelfMute, 'join'),
      ev('a', 'c2', T0 + HOUR, VoiceFlag.SelfMute, 'move'),
      ev('a', null, T0 + 2 * HOUR, 0, 'leave'),
    ];
    const times = flagTimesByUser(events, WINDOW, T0 + 24 * HOUR).get('a')!;
    expect(times.voiceMs).toBe(2 * HOUR);
    expect(times.mutedMs).toBe(2 * HOUR);
  });

  it('runs an open state up to now and clips to the window', () => {
    const events = [ev('a', 'c1', T0 - 2 * HOUR, VoiceFlag.SelfMute, 'join')];
    const times = flagTimesByUser(events, WINDOW, T0 + 3 * HOUR).get('a')!;
    expect(times.voiceMs).toBe(3 * HOUR); // from the window start to now
    expect(times.mutedMs).toBe(3 * HOUR);
  });

  it('handles unsorted events and keeps users independent', () => {
    const events = [
      ev('b', null, T0 + 2 * HOUR, 0, 'leave'),
      ev('a', 'c1', T0, VoiceFlag.SelfMute, 'join'),
      ev('b', 'c1', T0 + HOUR, 0, 'join'),
      ev('a', null, T0 + HOUR, 0, 'leave'),
    ];
    const result = flagTimesByUser(events, WINDOW, T0 + 24 * HOUR);
    expect(result.get('a')!.mutedMs).toBe(HOUR);
    expect(result.get('b')!.mutedMs).toBe(0);
    expect(result.get('b')!.voiceMs).toBe(HOUR);
  });

  it('returns nothing for a user who was never in voice in the window', () => {
    expect(flagTimesByUser([], WINDOW, T0).size).toBe(0);
  });
});
