import { VoiceFlag } from '@vocalog/shared';
import { describe, expect, it } from 'vitest';
import { flagsOf, toEvent } from './events.ts';
import type { VoiceStateLike } from './events.ts';

const state = (channelId: string | null, extra: Partial<VoiceStateLike> = {}): VoiceStateLike => ({
  guildId: 'g1',
  id: 'u1',
  channelId,
  selfMute: false,
  selfDeaf: false,
  serverMute: false,
  serverDeaf: false,
  streaming: false,
  selfVideo: false,
  ...extra,
});

describe('toEvent', () => {
  it('detects a join', () => {
    expect(toEvent(state(null), state('c1'), 10)?.kind).toBe('join');
  });

  it('detects a leave with a null channel', () => {
    const event = toEvent(state('c1'), state(null), 10);
    expect(event?.kind).toBe('leave');
    expect(event?.channelId).toBeNull();
  });

  it('detects a move between channels', () => {
    const event = toEvent(state('c1'), state('c2'), 10);
    expect(event?.kind).toBe('move');
    expect(event?.channelId).toBe('c2');
  });

  it('detects a state change in the same channel', () => {
    const event = toEvent(state('c1'), state('c1', { selfMute: true, streaming: true }), 10);
    expect(event?.kind).toBe('state');
    expect(event?.flags).toBe(VoiceFlag.SelfMute | VoiceFlag.Streaming);
  });

  it('returns null when nothing changed', () => {
    expect(toEvent(state('c1'), state('c1'), 10)).toBeNull();
  });

  it('copies guild, user, time and marks the event as live', () => {
    expect(toEvent(state(null), state('c1'), 42)).toMatchObject({ guildId: 'g1', userId: 'u1', atMs: 42, source: 'live' });
  });
});

describe('flagsOf', () => {
  it('combines flags and treats null as false', () => {
    expect(flagsOf(state('c1', { selfDeaf: true, serverMute: true, selfVideo: null }))).toBe(
      VoiceFlag.SelfDeaf | VoiceFlag.ServerMute,
    );
  });
});
