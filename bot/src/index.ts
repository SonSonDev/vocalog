import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { LiveVoiceState } from '@vocalog/shared';
import { isAllowed } from './allowlist.ts';
import { reconcileJournal } from './collector.ts';
import { readConfig } from './config.ts';
import type { Config } from './config.ts';
import { migrate, openDb } from './db.ts';
import { flagsOf, fromDiscord, snapshot, toEvent } from './events.ts';
import { insertEvent, recordHeartbeat, upsertChannel, upsertGuild, upsertUser } from './store.ts';

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

client.once(Events.ClientReady, (ready) => {
  const nowMs = Date.now();
  const live: LiveVoiceState[] = [];
  for (const guild of ready.guilds.cache.values()) {
    if (!isAllowed(allowed, guild.id)) continue;
    upsertGuild(db, guild.id, guild.name, nowMs);
    for (const state of guild.voiceStates.cache.values()) {
      if (state.channelId === null || state.member?.user.bot) continue;
      live.push({ guildId: guild.id, userId: state.id, channelId: state.channelId, flags: flagsOf(fromDiscord(state)) });
      if (state.member) upsertUser(db, state.id, state.member.user.username, nowMs);
      if (state.channel) upsertChannel(db, state.channelId, guild.id, state.channel.name, nowMs);
    }
  }
  const written = reconcileJournal(db, live, nowMs);
  recordHeartbeat(db, nowMs);
  console.log(`Ready as ${ready.user.tag}; reconcile wrote ${written.length} event(s); ${live.length} user(s) in voice.`);
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  try {
    if (newState.member?.user.bot || !isAllowed(allowed, newState.guild.id)) return;
    const nowMs = Date.now();
    const before = fromDiscord(oldState);
    const after = fromDiscord(newState);
    const event = toEvent(before, after, nowMs);
    if (!event) return;
    insertEvent(db, event, { old: snapshot(before), new: snapshot(after) });
    upsertGuild(db, newState.guild.id, newState.guild.name, nowMs);
    if (newState.member) upsertUser(db, newState.id, newState.member.user.username, nowMs);
    if (newState.channel) upsertChannel(db, newState.channel.id, newState.guild.id, newState.channel.name, nowMs);
  } catch (error) {
    // One bad event must never stop the collector.
    console.error('Failed to record a voice event', error);
  }
});

client.on(Events.Error, (error) => console.error('Discord client error', error));

const heartbeat = setInterval(() => {
  try {
    recordHeartbeat(db, Date.now());
  } catch (error) {
    console.error('Failed to record heartbeat', error);
  }
}, HEARTBEAT_MS);

function shutdown(): void {
  clearInterval(heartbeat);
  try {
    recordHeartbeat(db, Date.now());
  } finally {
    void client.destroy();
    db.close();
    process.exit(0);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(token);
