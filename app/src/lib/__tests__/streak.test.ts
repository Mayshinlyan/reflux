import type { CheckInStamp } from '@/db/repositories/checkIns';

import { mondayOf, summarizeCheckIns } from '../streak';

const TZ = 'UTC';
const now = new Date('2026-11-12T15:00:00Z'); // a Thursday
const stamp = (iso: string, kind: CheckInStamp['kind'] = 'meal'): CheckInStamp => ({ at: iso, kind });

describe('mondayOf', () => {
  it('finds the Monday, also from a Sunday', () => {
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
  });
});

describe('summarizeCheckIns', () => {
  it('counts a first ever check-in as day 1', () => {
    const summary = summarizeCheckIns([stamp('2026-11-12T08:00:00Z')], now, TZ);
    expect(summary).toMatchObject({ todayCount: 1, checkInDays: 1, streak: 1, returningAfterGap: false });
  });

  it('counts days in a row, any kind of log', () => {
    const summary = summarizeCheckIns(
      [
        stamp('2026-11-10T08:00:00Z'),
        stamp('2026-11-11T08:00:00Z', 'symptoms'),
        stamp('2026-11-12T08:00:00Z', 'dose'),
        stamp('2026-11-12T09:00:00Z'),
      ],
      now,
      TZ,
    );
    expect(summary).toMatchObject({ todayCount: 2, checkInDays: 3, streak: 3, returningAfterGap: false });
    expect(summary.weekDays).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(summary.counts).toEqual({ meals: 2, symptoms: 1, doses: 1 });
    expect(summary.todayByKind).toEqual({ meals: 1, symptoms: 0, doses: 1 });
  });

  it('is warm about a gap: the check-in days stay, the streak restarts', () => {
    const summary = summarizeCheckIns(
      [stamp('2026-11-05T08:00:00Z'), stamp('2026-11-12T08:00:00Z')],
      now,
      TZ,
    );
    expect(summary).toMatchObject({ checkInDays: 2, streak: 1, returningAfterGap: true });
  });

  it('has no streak when nothing was logged today', () => {
    const summary = summarizeCheckIns([stamp('2026-11-11T08:00:00Z')], now, TZ);
    expect(summary).toMatchObject({ todayCount: 0, streak: 0, returningAfterGap: false });
  });
});
