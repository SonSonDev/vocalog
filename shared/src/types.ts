export type EventKind = 'join' | 'leave' | 'move' | 'state';
export type EventSource = 'live' | 'reconcile';

/** One voice event. `channelId` is the channel AFTER the event (null when the user left voice). */
export interface VoiceEvent {
  guildId: string;
  userId: string;
  channelId: string | null;
  kind: EventKind;
  /** UTC epoch milliseconds. */
  atMs: number;
  source: EventSource;
  /** Bitmask of voice state flags after the event, see `VoiceFlag`. */
  flags: number;
}

/** Voice state flags stored in `VoiceEvent.flags`. */
export const VoiceFlag = {
  SelfMute: 1,
  SelfDeaf: 2,
  ServerMute: 4,
  ServerDeaf: 8,
  Streaming: 16,
  SelfVideo: 32,
} as const;

/** A user currently in a voice channel, as seen live (used to reconcile after a restart). */
export interface LiveVoiceState {
  guildId: string;
  userId: string;
  channelId: string;
  flags: number;
}

/** A continuous stay of one user in one voice channel. `endMs` is null while still open. */
export interface Session {
  guildId: string;
  userId: string;
  channelId: string;
  startMs: number;
  endMs: number | null;
}
