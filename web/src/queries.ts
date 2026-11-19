import type { Period } from '@vocalog/shared';
import { fetchDay, fetchMemberProfile, fetchMonth, fetchSummary, fetchWeek, fetchYear } from './api.ts';
import { prefetch } from './remoteCache.ts';
import { getSettings, timeZoneParam } from './settings.ts';

/** Part of every key: an answer is only valid for the time zone it was asked in. */
const zone = (): string => `${timeZoneParam(getSettings()) || 'server'}|${getSettings().weekStart}`;

/**
 * Every request the pages make, as a cache key and the function that loads it. The page and the prefetch (hover, focus,
 * neighbouring days) build them here, so both use the same key and a prefetched answer is the one the page shows.
 */
export interface Query<T> {
  key: string;
  load: () => Promise<T>;
}

export const summaryQuery = (guildId: string, period: Period): Query<Awaited<ReturnType<typeof fetchSummary>>> => ({
  key: `summary|${guildId}|${period}|${zone()}`,
  load: () => fetchSummary(guildId, period),
});

export const memberQuery = (guildId: string, userId: string, period: Period): Query<Awaited<ReturnType<typeof fetchMemberProfile>>> => ({
  key: `member|${guildId}|${userId}|${period}|${zone()}`,
  load: () => fetchMemberProfile(guildId, userId, period),
});

export const dayQuery = (guildId: string, dayKey: string): Query<Awaited<ReturnType<typeof fetchDay>>> => ({
  key: `day|${guildId}|${dayKey}|${zone()}`,
  load: () => fetchDay(guildId, dayKey),
});

export const weekQuery = (guildId: string, startKey: string): Query<Awaited<ReturnType<typeof fetchWeek>>> => ({
  key: `week|${guildId}|${startKey}|${zone()}`,
  load: () => fetchWeek(guildId, startKey),
});

export const monthQuery = (guildId: string, monthKey: string): Query<Awaited<ReturnType<typeof fetchMonth>>> => ({
  key: `month|${guildId}|${monthKey}|${zone()}`,
  load: () => fetchMonth(guildId, monthKey),
});

export const yearQuery = (guildId: string, yearKey: string): Query<Awaited<ReturnType<typeof fetchYear>>> => ({
  key: `year|${guildId}|${yearKey}|${zone()}`,
  load: () => fetchYear(guildId, yearKey),
});

export function prefetchQuery<T>(query: Query<T>): void {
  prefetch(query.key, query.load);
}
