export interface OAuthSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface DiscordIdentity {
  /** `name` is the display name, `handle` the Discord @username. */
  user: { id: string; name: string; handle: string };
  /** Ids of every server the person belongs to (up to the 200 Discord returns). */
  guildIds: string[];
}

const API = 'https://discord.com/api/v10';
const TIMEOUT_MS = 8000;

/** Where to send the browser to log in. Scopes are the two non-privileged ones: identify and guilds. */
export function authorizeUrl(settings: OAuthSettings, state: string): string {
  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchanges the code for who the person is and which servers they are in. The access token lives only inside
 * this function: it is never returned, stored or logged. Errors carry no secret.
 */
export async function fetchDiscordIdentity(settings: OAuthSettings, code: string, fetchFn: typeof fetch): Promise<DiscordIdentity> {
  const tokenResponse = await fetchFn(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: settings.redirectUri,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`);
  const token = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof token.access_token !== 'string') throw new Error('Discord token exchange returned no access token');

  const headers = { authorization: `Bearer ${token.access_token}` };
  const [userResponse, guildsResponse] = await Promise.all([
    fetchFn(`${API}/users/@me`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }),
    fetchFn(`${API}/users/@me/guilds`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }),
  ]);
  if (!userResponse.ok) throw new Error(`Discord user request failed (${userResponse.status})`);
  if (!guildsResponse.ok) throw new Error(`Discord servers request failed (${guildsResponse.status})`);

  const user = (await userResponse.json()) as { id?: unknown; username?: unknown; global_name?: unknown };
  const guilds = (await guildsResponse.json()) as { id?: unknown }[];
  if (typeof user.id !== 'string' || typeof user.username !== 'string') throw new Error('Discord returned an unexpected user');
  if (!Array.isArray(guilds)) throw new Error('Discord returned an unexpected server list');

  return {
    user: { id: user.id, name: typeof user.global_name === 'string' && user.global_name !== '' ? user.global_name : user.username, handle: user.username },
    guildIds: guilds.map((guild) => guild.id).filter((id): id is string => typeof id === 'string'),
  };
}
