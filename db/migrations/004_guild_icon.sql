-- Additive only: the previous version of the bot keeps working on this schema (it never selects this column).
-- Discord icon hash of a server, null when it has none. The image itself is not stored: the dashboard server fetches
-- it from Discord and serves it, so visitors never contact Discord.
ALTER TABLE guilds ADD COLUMN icon TEXT;
