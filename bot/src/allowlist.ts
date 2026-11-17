/** Parses a comma-separated list of guild ids. Throws when the list is missing or empty. */
export function parseAllowList(raw: string | undefined): Set<string> {
  const ids = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0) {
    throw new Error('ALLOWED_GUILD_IDS must list at least one server id (comma-separated)');
  }
  return new Set(ids);
}

export function isAllowed(allowed: ReadonlySet<string>, guildId: string): boolean {
  return allowed.has(guildId);
}
