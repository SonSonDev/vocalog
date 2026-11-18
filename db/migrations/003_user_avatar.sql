-- Additive only: the previous version of the bot keeps working on this schema (it never selects this column).
-- Discord avatar hash of a person (global avatar), null when they use a default avatar. The image itself is not stored:
-- the dashboard server fetches it from Discord and serves it, so visitors never contact Discord.
ALTER TABLE users ADD COLUMN avatar TEXT;
