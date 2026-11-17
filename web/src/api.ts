import type { GuildInfo, MemberProfile, MeResponse, Period, Summary } from '@vocalog/shared';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  // 401: the session ended. Reloading asks /api/me again, which then shows the login screen.
  if (response.status === 401) window.location.reload();
  if (!response.ok) throw new Error(`Le serveur a répondu ${response.status}`);
  return (await response.json()) as T;
}

export function fetchGuilds(): Promise<GuildInfo[]> {
  return getJson<GuildInfo[]>('/api/guilds');
}

export function fetchSummary(guildId: string, period: Period): Promise<Summary> {
  return getJson<Summary>(`/api/guilds/${encodeURIComponent(guildId)}/summary?period=${period}`);
}

export function fetchMemberProfile(guildId: string, userId: string, period: Period): Promise<MemberProfile> {
  return getJson<MemberProfile>(`/api/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}?period=${period}`);
}

export function fetchMe(): Promise<MeResponse> {
  return getJson<MeResponse>('/api/me');
}

/** Ends the session. The server answers 204 and clears the cookie. */
export async function logout(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST' });
}
