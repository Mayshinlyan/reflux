import {
  checkInBody,
  checkInTime,
  formatReminder,
  isQuietTime,
  REMINDER_OPTIONS,
  reminderOptionLabel,
} from '../reminderTiming';

/** A local-time Date, whatever the machine's zone. */
const at = (hours: number, minutes = 0) => new Date(2026, 9, 14, hours, minutes);

describe('formatReminder', () => {
  it('says Off, or the hours', () => {
    expect(formatReminder(null)).toBe('Off');
    expect(formatReminder(60)).toBe('1 hour');
    expect(formatReminder(120)).toBe('2 hours');
  });
});

describe('reminderOptionLabel', () => {
  it('reads as a sentence fragment', () => {
    expect(REMINDER_OPTIONS.map(reminderOptionLabel)).toEqual([
      '1 hour after a meal',
      '2 hours after a meal',
      '3 hours after a meal',
    ]);
  });
});

describe('checkInTime', () => {
  it('adds the minutes to the meal time', () => {
    expect(checkInTime(at(19, 45), 120)).toEqual(at(21, 45));
  });
});

describe('isQuietTime', () => {
  it('is quiet from bedtime for eight hours, across midnight', () => {
    expect(isQuietTime(at(22, 30), '22:30')).toBe(true);
    expect(isQuietTime(at(23, 59), '22:30')).toBe(true);
    expect(isQuietTime(at(3, 0), '22:30')).toBe(true);
    expect(isQuietTime(at(6, 29), '22:30')).toBe(true);
  });

  it('is not quiet before bedtime or once the morning has started', () => {
    expect(isQuietTime(at(22, 29), '22:30')).toBe(false);
    expect(isQuietTime(at(6, 30), '22:30')).toBe(false);
    expect(isQuietTime(at(12, 0), '22:30')).toBe(false);
  });

  it('handles a bedtime after midnight', () => {
    expect(isQuietTime(at(0, 59), '01:00')).toBe(false);
    expect(isQuietTime(at(1, 0), '01:00')).toBe(true);
    expect(isQuietTime(at(8, 59), '01:00')).toBe(true);
    expect(isQuietTime(at(9, 0), '01:00')).toBe(false);
  });
});

describe('checkInBody', () => {
  it('names the meal and how long ago', () => {
    expect(checkInBody('Spicy chicken tacos', 120)).toBe(
      'You had Spicy chicken tacos about 2 hours ago. Tap to check in.',
    );
    expect(checkInBody('Toast', 60)).toBe('You had Toast about 1 hour ago. Tap to check in.');
  });
});
