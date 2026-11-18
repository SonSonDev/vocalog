import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { LiveVoiceState } from '@vocalog/shared';
import { isAllowed } from './allowlist.ts';
import { reconcileJournal } from './collector.ts';
import { readConfig } from './config.ts';
import type { Config } from './config.ts';
import { migrate, openDb } from './db.ts';
import { flagsOf, fromDiscord, snapshot, toEvent } from './events.ts';
import { createLossTracker, shouldWriteHeartbeat } from './liveness.ts';
import { insertEvent, lastHeartbeat, recordHeartbeat, upsertChannel, upsertGuild, upsertMember, upsertUser } from './store.ts';

const HEARTBEAT_MS = 60_000;

let config: Config;
try {
  config = readConfig(process.env);
} catch (error) {
  // Exit non-zero with a message that names the variable; systemd will report the failure.
  console.error((error as Error).message);
  process.exit(1);
}
const { token, allowedGuildIds: allowed, dbPath } = config;
mkdirSync(dirname(dbPath), { recursive: true });

const db = openDb(dbPath);
const applied = migrate(db);
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(', ')}`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const losses = createLossTracker();

function watchedGuilds(): Guild[] {
  return [...client.guilds.cache.values()].filter((guild) => isAllowed(allowed, guild.id));
}

/** The last moment events were certainly flowing: the last heartbeat, which is only written while connected. */
function aliveUntil(): number {
  return lastHeartbeat(db) ?? Date.now();
}

/** Records the names and the AFK channel of a server and returns who is in voice there right now. */
function collectGuild(guild: Guild, nowMs: number): LiveVoiceState[] {
  upsertGuild(db, { id: guild.id, name: guild.name, afkChannelId: guild.afkChannelId, icon: guild.icon }, nowMs);
  for (const channel of guild.channels.cache.values()) {
    if (channel.isVoiceBased()) upsertChannel(db, { id: channel.id, guildId: guild.id, name: channel.name, type: channel.type }, nowMs);
  }
  const live: LiveVoiceState[] = [];
  for (const state of guild.voiceStates.cache.values()) {
    if (state.channelId === null || state.member?.user.bot) continue;
    live.push({ guildId: guild.id, userId: state.id, channelId: state.channelId, flags: flagsOf(fromDiscord(state)) });
    if (state.member) {
      upsertUser(db, state.id, state.member.user.username, nowMs, state.member.user.avatar);
      upsertMember(db, guild.id, state.id, state.member.displayName, false, nowMs);
    }
  }
  return live;
}

function heartbeatIfSafe(nowMs: number): void {
  const watched = watchedGuilds();
  if (shouldWriteHeartbeat(client.ws.status, watched.map((guild) => Boolean(guild.available)))) recordHeartbeat(db, nowMs);
}

// First start: bring the whole journal in line with who is in voice. Servers that are unavailable right now are
// left alone; they are resynchronised when they become available.
client.once(Events.ClientReady, (ready) => {
  const nowMs = Date.now();
  const watched = watchedGuilds();
  const unavailable = new Set(watched.filter((guild) => !guild.available).map((guild) => guild.id));
  const live = watched.filter((guild) => guild.available).flatMap((guild) => collectGuild(guild, nowMs));
  const written = reconcileJournal(db, live, nowMs, { exceptGuildIds: unavailable });
  heartbeatIfSafe(nowMs);
  console.log(`Ready as ${ready.user.tag}; reconcile wrote ${written.length} event(s); ${live.length} user(s) in voice; ${unavailable.size} server(s) unavailable.`);
});

// A server became available: at start, or after a full reconnection (Discord rebuilt its voice states, so the cache is exact now).
client.on(Events.GuildAvailable, (guild) => {
  if (!isAllowed(allowed, guild.id)) return;
  try {
    const nowMs = Date.now();
    const live = collectGuild(guild, nowMs);
    const written = reconcileJournal(db, live, nowMs, { guildId: guild.id, aliveUntilMs: losses.take(guild.id) });
    if (written.length > 0) console.log(`Server back online: resync wrote ${written.length} event(s).`);
  } catch (error) {
    console.error('Failed to resynchronise a server', error);
  }
});

// Events may be missed from now on: remember since when, so sessions are closed at the right moment later.
client.on(Events.ShardDisconnect, () => losses.markLost(watchedGuilds().map((guild) => guild.id), aliveUntil()));
client.on(Events.GuildUnavailable, (guild) => {
  if (isAllowed(allowed, guild.id)) losses.markLost([guild.id], aliveUntil());
});
// A resumed connection replays what was missed: nothing was lost.
client.on(Events.ShardResume, () => losses.clearAll());

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  try {
    if (newState.member?.user.bot || !isAllowed(allowed, newState.guild.id)) return;
    const nowMs = Date.now();
    const before = fromDiscord(oldState);
    const after = fromDiscord(newState);
    const event = toEvent(before, after, nowMs);
    if (!event) return;
    insertEvent(db, event, { old: snapshot(before), new: snapshot(after) });
    upsertGuild(db, { id: newState.guild.id, name: newState.guild.name, afkChannelId: newState.guild.afkChannelId, icon: newState.guild.icon }, nowMs);
    if (newState.member) {
      upsertUser(db, newState.id, newState.member.user.username, nowMs, newState.member.user.avatar);
      upsertMember(db, newState.guild.id, newState.id, newState.member.displayName, false, nowMs);
    }
    if (newState.channel) {
      upsertChannel(db, { id: newState.channel.id, guildId: newState.guild.id, name: newState.channel.name, type: newState.channel.type }, nowMs);
    }
  } catch (error) {
    // One bad event must never stop the collector.
    console.error('Failed to record a voice event', error);
  }
});

// Keep names and the AFK channel up to date when someone renames a channel or changes the server settings.
client.on(Events.ChannelUpdate, (_old, channel) => {
  try {
    if (channel.isDMBased() || !isAllowed(allowed, channel.guildId) || !channel.isVoiceBased()) return;
    upsertChannel(db, { id: channel.id, guildId: channel.guildId, name: channel.name, type: channel.type }, Date.now());
  } catch (error) {
    console.error('Failed to record a channel change', error);
  }
});
client.on(Events.GuildUpdate, (_old, guild) => {
  try {
    if (isAllowed(allowed, guild.id)) upsertGuild(db, { id: guild.id, name: guild.name, afkChannelId: guild.afkChannelId, icon: guild.icon }, Date.now());
  } catch (error) {
    console.error('Failed to record a server change', error);
  }
});

client.on(Events.Error, (error) => console.error('Discord client error', error));

const heartbeat = setInterval(() => {
  try {
    heartbeatIfSafe(Date.now());
  } catch (error) {
    console.error('Failed to record heartbeat', error);
  }
}, HEARTBEAT_MS);

function shutdown(): void {
  clearInterval(heartbeat);
  try {
    heartbeatIfSafe(Date.now());
  } finally {
    void client.destroy();
    db.close();
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(token);
