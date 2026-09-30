import {
  clockFromDate,
  composeMealTime,
  dayChoiceLabel,
  formatClockTime,
  formatMealTime,
  MEAL_DAY_CHOICES,
} from '../mealTime';

// A Wednesday, local time (the helpers are all local-clock, so the tests build local dates too).
const now = new Date(2026, 8, 30, 14, 20);

describe('dayChoiceLabel', () => {
  it('names today and yesterday, then the date', () => {
    expect(dayChoiceLabel(0, now)).toBe('Today');
    expect(dayChoiceLabel(1, now)).toBe('Yesterday');
    expect(dayChoiceLabel(2, now)).toBe('Mon 28 Sep');
    expect(dayChoiceLabel(MEAL_DAY_CHOICES - 1, now)).toBe('Thu 24 Sep');
  });

  it('crosses a month boundary', () => {
    expect(dayChoiceLabel(3, new Date(2026, 9, 2, 9, 0))).toBe('Tue 29 Sep');
  });
});

describe('composeMealTime', () => {
  it('builds a local time on the chosen day', () => {
    const at = composeMealTime(now, { dayOffset: 1, hour12: 8, minute: 15, pm: false });
    expect(at).toEqual(new Date(2026, 8, 29, 8, 15));
  });

  it('maps 12 AM to midnight and 12 PM to noon', () => {
    expect(composeMealTime(now, { dayOffset: 0, hour12: 12, minute: 0, pm: false }).getHours()).toBe(0);
    expect(composeMealTime(now, { dayOffset: 0, hour12: 12, minute: 0, pm: true }).getHours()).toBe(12);
    expect(composeMealTime(now, { dayOffset: 0, hour12: 11, minute: 55, pm: true }).getHours()).toBe(23);
  });
});

describe('clockFromDate', () => {
  it('reads a Date back into picker fields, rounding the minute down', () => {
    expect(clockFromDate(new Date(2026, 8, 29, 20, 47), now)).toEqual({
      dayOffset: 1,
      hour12: 8,
      minute: 45,
      pm: true,
    });
  });

  it('keeps midnight and noon as 12', () => {
    expect(clockFromDate(new Date(2026, 8, 30, 0, 0), now)).toMatchObject({ hour12: 12, pm: false });
    expect(clockFromDate(new Date(2026, 8, 30, 12, 5), now)).toMatchObject({ hour12: 12, pm: true });
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
