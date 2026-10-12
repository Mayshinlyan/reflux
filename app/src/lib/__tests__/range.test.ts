import {
  inPeriod,
  isCurrent,
  loadWindow,
  periodLabel,
  periodOf,
  samePeriod,
  shiftPeriod,
  spanLabel,
} from '../range';

describe('periodOf', () => {
  it('is the Sunday-to-Saturday week for a week', () => {
    // Saturday 10 Oct 2026.
    expect(periodOf('week', '2026-10-10')).toEqual({ startKey: '2026-10-04', endKey: '2026-10-10' });
    // A Sunday starts its own week.
    expect(periodOf('week', '2026-10-04')).toEqual({ startKey: '2026-10-04', endKey: '2026-10-10' });
  });

  it('is the whole calendar month for a month, including a leap February', () => {
    expect(periodOf('month', '2026-10-10')).toEqual({ startKey: '2026-10-01', endKey: '2026-10-31' });
    expect(periodOf('month', '2028-02-15')).toEqual({ startKey: '2028-02-01', endKey: '2028-02-29' });
  });
});

describe('shiftPeriod', () => {
  it('steps whole weeks across a month boundary', () => {
    const week = periodOf('week', '2026-10-10');
    expect(shiftPeriod('week', week, -1)).toEqual({ startKey: '2026-09-27', endKey: '2026-10-03' });
    expect(shiftPeriod('week', week, 1)).toEqual({ startKey: '2026-10-11', endKey: '2026-10-17' });
  });

  it('steps whole months across a year boundary', () => {
    const jan = periodOf('month', '2026-01-20');
    expect(shiftPeriod('month', jan, -1)).toEqual({ startKey: '2025-12-01', endKey: '2025-12-31' });
    expect(shiftPeriod('month', periodOf('month', '2026-12-05'), 1)).toEqual({
      startKey: '2027-01-01',
      endKey: '2027-01-31',
    });
  });
});

describe('periodLabel', () => {
  const today = '2026-10-10';

  it('writes a week inside one month as "Oct 4 – 10"', () => {
    expect(periodLabel('week', periodOf('week', today), today)).toBe('Oct 4 – 10');
  });

  it('names both months when a week spans two', () => {
    expect(periodLabel('week', periodOf('week', '2026-10-01'), today)).toBe('Sep 27 – Oct 3');
  });

  it('writes a month by name, adding the year only for another year', () => {
    expect(periodLabel('month', periodOf('month', today), today)).toBe('October');
    expect(periodLabel('month', periodOf('month', '2025-12-03'), today)).toBe('December 2025');
  });

  it('adds the year to a week in another year', () => {
    expect(periodLabel('week', periodOf('week', '2025-12-31'), today)).toBe('Dec 28 – Jan 3, 2025 – 2026');
    expect(periodLabel('week', periodOf('week', '2025-06-10'), today)).toBe('Jun 8 – 14, 2025');
  });
});

describe('spanLabel', () => {
  const today = '2026-10-10';

  it('writes any span of days like a week: one month is short, two months name both', () => {
    expect(spanLabel({ startKey: '2026-10-04', endKey: '2026-10-10' }, today)).toBe('Oct 4 – 10');
    expect(spanLabel({ startKey: '2026-09-03', endKey: '2026-10-10' }, today)).toBe('Sep 3 – Oct 10');
  });

  it('writes one day as just that day, and adds the year for another year', () => {
    expect(spanLabel({ startKey: '2026-10-10', endKey: '2026-10-10' }, today)).toBe('Oct 10');
    expect(spanLabel({ startKey: '2025-03-02', endKey: '2026-10-10' }, today)).toBe(
      'Mar 2 – Oct 10, 2025 – 2026',
    );
  });
});

describe('isCurrent', () => {
  it('is true for a period that reaches today, so there is nothing to step forward to', () => {
    expect(isCurrent(periodOf('week', '2026-10-10'), '2026-10-10')).toBe(true);
    expect(isCurrent(periodOf('month', '2026-10-10'), '2026-10-10')).toBe(true);
    expect(isCurrent(periodOf('week', '2026-10-03'), '2026-10-10')).toBe(false);
  });
});

describe('inPeriod, samePeriod and loadWindow', () => {
  const week = periodOf('week', '2026-10-10');

  it('includes both ends of the period', () => {
    expect(inPeriod(week, '2026-10-04')).toBe(true);
    expect(inPeriod(week, '2026-10-10')).toBe(true);
    expect(inPeriod(week, '2026-10-03')).toBe(false);
    expect(inPeriod(week, '2026-10-11')).toBe(false);
  });

  it('compares periods by their days', () => {
    expect(samePeriod(week, periodOf('week', '2026-10-06'))).toBe(true);
    expect(samePeriod(week, shiftPeriod('week', week, -1))).toBe(false);
  });

  it('loads a day either side so entries logged in other zones are not clipped', () => {
    const { from, to } = loadWindow(week);
    expect(new Date(from).getTime()).toBeLessThanOrEqual(new Date(2026, 9, 3).getTime());
    expect(new Date(to).getTime()).toBeGreaterThanOrEqual(new Date(2026, 9, 12).getTime());
  });
});
