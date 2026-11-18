import { describe, expect, it } from 'vitest';
import {
  binClock,
  formatDayLong,
  formatDayShort,
  formatHourLabel,
  formatPeople,
  timelineView,
  initialsOf,
  barPercent,
  busiestCell,
  busiestHour,
  describeTimeDifference,
  formatDateTime,
  formatDayKey,
  formatDuration,
  formatHours,
  formatMinuteOfDay,
  formatPercent,
  formatRank,
  formatSignedPercent,
  maxOf,
  shareOf,
  visibleHandle,
} from './format.ts';

const HOUR = 3_600_000;
const MIN = 60_000;

describe('formatDuration', () => {
  it('shows minutes under an hour', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45 * MIN)).toBe('45 min');
  });

  it('shows hours and padded minutes', () => {
    expect(formatDuration(7 * HOUR + 5 * MIN)).toBe('7 h 05');
    expect(formatDuration(10 * HOUR)).toBe('10 h 00');
  });

  it('rounds to the nearest minute', () => {
    expect(formatDuration(59.6 * MIN)).toBe('1 h 00');
  });
});

describe('formatHours', () => {
  it('rounds to whole hours', () => {
    expect(formatHours(212.4 * HOUR)).toBe('212 h');
  });
});

describe('formatDateTime', () => {
  it('formats in the requested time zone', () => {
    const text = formatDateTime(Date.UTC(2026, 10, 14, 20, 0), 'Europe/Paris'); // Saturday... 21:00 in Paris
    expect(text).toContain('21:00');
    expect(text).toContain('14');
  });
});

describe('busiestCell and busiestHour', () => {
  it('finds the busiest cell', () => {
    const heat = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
    heat[4]![21] = 5;
    heat[2]![9] = 2;
    expect(busiestCell(heat)).toEqual({ weekday: 4, hour: 21 });
  });

  it('returns null when empty', () => {
    expect(busiestCell(Array.from({ length: 7 }, () => new Array<number>(24).fill(0)))).toBeNull();
    expect(busiestHour(new Array<number>(24).fill(0))).toBeNull();
  });

  it('finds the busiest hour of a profile', () => {
    const profile = new Array<number>(24).fill(0);
    profile[22] = 3;
    profile[10] = 1;
    expect(busiestHour(profile)).toBe(22);
  });
});

describe('bars', () => {
  it('computes percentages relative to the max', () => {
    expect(maxOf([1, 5, 3])).toBe(5);
    expect(barPercent(5, 5)).toBe(100);
    expect(barPercent(2.5, 5)).toBe(50);
  });

  it('keeps tiny non-zero values visible and zero invisible', () => {
    expect(barPercent(1, 1000)).toBe(2);
    expect(barPercent(0, 5)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });
});

describe('profile formatting', () => {
  it('formats a minute of the day', () => {
    expect(formatMinuteOfDay(20 * 60 + 35)).toBe('20 h 35');
    expect(formatMinuteOfDay(5)).toBe('0 h 05');
  });

  it('formats percentages with a sign', () => {
    expect(formatPercent(0.4166)).toBe('42 %');
    expect(formatSignedPercent(18)).toBe('+18 %');
    expect(formatSignedPercent(-7)).toBe('−7 %');
    expect(formatSignedPercent(0)).toBe('0 %');
  });

  it('formats ranks in French', () => {
    expect(formatRank(1)).toBe('1er');
    expect(formatRank(3)).toBe('3e');
  });

  it('computes a share safely', () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(1, 0)).toBe(0);
  });

  it('formats a day key', () => {
    expect(formatDayKey('2026-11-16')).toContain('16');
    expect(formatDayKey('2026-11-16')).toContain('nov');
  });
});

describe('describeTimeDifference', () => {
  it('says later or earlier than the group', () => {
    expect(describeTimeDifference(21 * 60, 20 * 60)).toBe('1 h 00 plus tard que le groupe');
    expect(describeTimeDifference(19 * 60 + 30, 20 * 60)).toBe('30 min plus tôt que le groupe');
  });

  it('treats a few minutes as the same', () => {
    expect(describeTimeDifference(20 * 60 + 3, 20 * 60)).toBe('comme le groupe');
  });

  it('compares across midnight sensibly', () => {
    // 00:30 is later than 23:00 for a night owl, not 22 hours earlier.
    expect(describeTimeDifference(30, 23 * 60)).toBe('1 h 30 plus tard que le groupe');
  });
});

describe('visibleHandle', () => {
  it('shows the handle with an @ when it differs from the name', () => {
    expect(visibleHandle('Alexandre', 'alex_42')).toBe('@alex_42');
  });

  it('hides it when it is missing or the same as the name, ignoring case and spaces', () => {
    expect(visibleHandle('Alex', undefined)).toBeNull();
    expect(visibleHandle('Alex', '')).toBeNull();
    expect(visibleHandle('Alex', 'alex')).toBeNull();
    expect(visibleHandle(' Alex ', 'ALEX')).toBeNull();
  });
});

describe('timeline helpers', () => {
  it('writes a day key as a French date', () => {
    expect(formatDayLong('2026-11-17')).toBe('mardi 17 novembre');
    expect(formatDayShort('2026-11-17')).toBe('mar. 17 nov.');
  });

  it('gives the clock time of a bin on a day that starts at 06:00', () => {
    expect(binClock(0, 30)).toBe('06:00');
    expect(binClock(29, 30)).toBe('20:30');
    expect(binClock(36, 30)).toBe('00:00');
    expect(binClock(47, 30)).toBe('05:30');
    expect(binClock(1, 15)).toBe('06:15');
  });

  it('says how many people', () => {
    expect(formatPeople(0)).toBe('personne');
    expect(formatPeople(1)).toBe('1 personne');
    expect(formatPeople(2)).toBe('2 personnes');
    expect(formatPeople(1.5)).toBe('1,5 personne');
  });

  it('builds initials for a picture-less avatar', () => {
    expect(initialsOf('Alex Martin')).toBe('AM');
    expect(initialsOf('boogy')).toBe('B');
    expect(initialsOf('  zzz best game ever ')).toBe('ZB');
    expect(initialsOf('🎮 Gamer')).toBe('🎮G');
    expect(initialsOf('')).toBe('?');
  });
});

describe('timelineView', () => {
  const H = 3_600_000;
  const day = { startMs: Date.UTC(2026, 10, 17, 6), endMs: Date.UTC(2026, 10, 18, 6) };
  const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 17, hour, minute);

  it('frames the activity with a margin, on whole hours', () => {
    const view = timelineView(day, at(21, 12), at(23, 40));
    expect(view).toEqual({ startMs: at(20), endMs: at(25), stepMs: H });
  });

  it('keeps at least three hours and stays inside the day', () => {
    const view = timelineView(day, at(6, 5), at(6, 20));
    expect(view.startMs).toBe(day.startMs);
    expect(view.endMs - view.startMs).toBe(3 * H);
    const late = timelineView(day, Date.UTC(2026, 10, 18, 5, 40), Date.UTC(2026, 10, 18, 5, 55));
    expect(late.endMs).toBe(day.endMs);
    expect(late.startMs).toBeGreaterThanOrEqual(day.startMs);
  });

  it('widens the step of the time marks for a long activity', () => {
    expect(timelineView(day, at(10), at(18)).stepMs).toBe(2 * H);
    expect(timelineView(day, at(8), at(23)).stepMs).toBe(3 * H);
  });

  it('labels a whole hour', () => {
    expect(formatHourLabel(at(21), 'UTC')).toBe('21 h');
  });
});
