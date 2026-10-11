import {
  dayChoiceLabel,
  dayToLoggedAt,
  earliestMealTime,
  formatClockTime,
  formatMealTime,
  MEAL_DAYS_BACK,
  withTimeOf,
} from '../mealTime';

// A Wednesday, local time (the helpers are all local-clock, so the tests build local dates too).
const now = new Date(2026, 8, 30, 14, 20);

describe('dayChoiceLabel', () => {
  it('names today and yesterday, then the date', () => {
    expect(dayChoiceLabel(0, now)).toBe('Today');
    expect(dayChoiceLabel(1, now)).toBe('Yesterday');
    expect(dayChoiceLabel(2, now)).toBe('Mon 28 Sep');
    expect(dayChoiceLabel(MEAL_DAYS_BACK, now)).toBe('Thu 24 Sep');
  });

  it('crosses a month boundary', () => {
    expect(dayChoiceLabel(3, new Date(2026, 9, 2, 9, 0))).toBe('Tue 29 Sep');
  });
});

describe('earliestMealTime', () => {
  it('is midnight six days ago', () => {
    expect(earliestMealTime(now)).toEqual(new Date(2026, 8, 24, 0, 0));
  });
});

describe('withTimeOf', () => {
  it('keeps the day and takes the hour and minute', () => {
    expect(withTimeOf(new Date(2026, 8, 29, 23, 59), new Date(2026, 0, 1, 8, 15))).toEqual(
      new Date(2026, 8, 29, 8, 15),
    );
  });
});

describe('formatMealTime', () => {
  it('says Now with no chosen time', () => {
    expect(formatMealTime(null, now)).toBe('Now');
  });

  it('reads like a person would say it', () => {
    expect(formatMealTime(new Date(2026, 8, 30, 8, 5), now)).toBe('Today, 8:05 AM');
    expect(formatMealTime(new Date(2026, 8, 29, 19, 30), now)).toBe('Yesterday, 7:30 PM');
    expect(formatMealTime(new Date(2026, 8, 27, 12, 0), now)).toBe('Sun 27 Sep, 12:00 PM');
  });
});

describe('formatClockTime', () => {
  it('uses 12 for midnight', () => {
    expect(formatClockTime(new Date(2026, 8, 30, 0, 7))).toBe('12:07 AM');
  });
});

describe('dayToLoggedAt', () => {
  it('is noon on an earlier day this week', () => {
    expect(dayToLoggedAt('2026-09-28', now)).toEqual(new Date(2026, 8, 28, 12, 0));
    expect(dayToLoggedAt('2026-09-24', now)).toEqual(new Date(2026, 8, 24, 12, 0));
  });

  it('means "now" (null) for today, the future, junk, and days further back than the pickers allow', () => {
    expect(dayToLoggedAt('2026-09-30', now)).toBeNull();
    expect(dayToLoggedAt('2026-10-01', now)).toBeNull();
    expect(dayToLoggedAt('2026-09-23', now)).toBeNull();
    expect(dayToLoggedAt('nope', now)).toBeNull();
    expect(dayToLoggedAt('2026-02-31', now)).toBeNull();
  });
});
