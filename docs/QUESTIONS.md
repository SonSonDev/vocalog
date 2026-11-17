# Open questions
Doubtful behaviours awaiting the developer's answer. Ask, never decide silently. Remove once answered
(and record the answer in SPEC / DECISIONS).
- [ ] Opt-out and deletion — should it be a slash command, a button in the dashboard, or a request to the developer? Recommendation: slash command `/optout` plus a dashboard button; deletion on request first.
- [ ] Timezone for "per day" and "per hour" statistics — one fixed timezone for the group, or per-viewer? Recommendation: one timezone per server (default Europe/Paris), configurable.
- [ ] What counts as "together" — same channel at the same time, with or without muted members? Recommendation: same channel, regardless of mute, with a note in the UI.
- [ ] Is a muted-only or AFK-channel presence counted as voice time? Recommendation: count it as voice time but expose the AFK channel separately.
- [ ] Server selector when a user belongs to several servers — remember the last one? Recommendation: yes, in local storage.
- [ ] Backup retention — how many nightly backups to keep? Recommendation: 14.
- [ ] Linter and formatter — which to adopt? To be checked online and logged in the first slice.
- [ ] Should the journal also keep the raw gateway `VOICE_STATE_UPDATE` packet (via the `raw` event) instead of a state snapshot? Recommendation: keep the snapshot for now; revisit if a missing field ever matters.
- [ ] Name history — keep only the current names in `users`/`channels`/`guilds`, or add a history table now? Recommendation: current names now, history table when the UI needs it.
