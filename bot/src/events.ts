import { VoiceFlag } from '@vocalog/shared';
import type { VoiceEvent } from '@vocalog/shared';
import type { VoiceState } from 'discord.js';

/** The part of a discord.js VoiceState the collector needs (kept minimal so it is easy to test). */
export interface VoiceStateLike {
  guildId: string;
  /** Member id. */
  id: string;
  channelId: string | null;
  selfMute: boolean | null;
  selfDeaf: boolean | null;
  serverMute: boolean | null;
  serverDeaf: boolean | null;
  streaming: boolean | null;
  selfVideo: boolean | null;
}

/** Adapts a discord.js VoiceState to the minimal shape used by the collector. */
export function fromDiscord(state: VoiceState): VoiceStateLike {
  return {
    guildId: state.guild.id,
    id: state.id,
    channelId: state.channelId,
    selfMute: state.selfMute,
    selfDeaf: state.selfDeaf,
    serverMute: state.serverMute,
    serverDeaf: state.serverDeaf,
    streaming: state.streaming,
    selfVideo: state.selfVideo,
  };
}

export function flagsOf(state: VoiceStateLike): number {
  return (
    (state.selfMute ? VoiceFlag.SelfMute : 0) |
    (state.selfDeaf ? VoiceFlag.SelfDeaf : 0) |
    (state.serverMute ? VoiceFlag.ServerMute : 0) |
    (state.serverDeaf ? VoiceFlag.ServerDeaf : 0) |
    (state.streaming ? VoiceFlag.Streaming : 0) |
    (state.selfVideo ? VoiceFlag.SelfVideo : 0)
  );
}

/** Plain snapshot of a state, stored as `raw_json`. */
export function snapshot(state: VoiceStateLike): Record<string, unknown> {
  return {
    channelId: state.channelId,
    selfMute: state.selfMute,
    selfDeaf: state.selfDeaf,
    serverMute: state.serverMute,
    serverDeaf: state.serverDeaf,
    streaming: state.streaming,
    selfVideo: state.selfVideo,
  };
}

/** Turns an old/new voice state pair into a journal event, or null when nothing relevant changed. */
export function toEvent(oldState: VoiceStateLike, newState: VoiceStateLike, atMs: number): VoiceEvent | null {
  const flags = flagsOf(newState);
  let kind: VoiceEvent['kind'];
  if (oldState.channelId === null && newState.channelId !== null) kind = 'join';
  else if (oldState.channelId !== null && newState.channelId === null) kind = 'leave';
  else if (oldState.channelId !== newState.channelId) kind = 'move';
  else if (flagsOf(oldState) !== flags) kind = 'state';
  else return null;

  return {
    guildId: newState.guildId,
    userId: newState.id,
    channelId: newState.channelId,
    kind,
    atMs,
    source: 'live',
    flags,
  };
}
