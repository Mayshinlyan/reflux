import { isLateMeal } from '../mealTiming';

const WINDOW = 180;

describe('isLateMeal', () => {
  it('flags a meal within 3 hours before bedtime', () => {
    // 19:45 in New York (EDT, UTC-4) is 23:45 UTC.
    expect(isLateMeal('2026-06-01T23:45:00Z', 'America/New_York', '22:30', WINDOW)).toBe(true);
  });

  it('does not flag an earlier meal', () => {
    expect(isLateMeal('2026-06-01T22:00:00Z', 'America/New_York', '22:30', WINDOW)).toBe(false); // 18:00
  });

  it('includes exactly 3 hours and excludes one minute more', () => {
    expect(isLateMeal('2026-06-01T19:30:00Z', 'UTC', '22:30', WINDOW)).toBe(true);
    expect(isLateMeal('2026-06-01T19:29:00Z', 'UTC', '22:30', WINDOW)).toBe(false);
  });

  it('flags a meal eaten after bedtime', () => {
    expect(isLateMeal('2026-06-01T23:30:00Z', 'UTC', '22:30', WINDOW)).toBe(true);
  });

  it('handles a bedtime after midnight', () => {
    expect(isLateMeal('2026-06-01T22:30:00Z', 'UTC', '01:00', WINDOW)).toBe(true);
    expect(isLateMeal('2026-06-01T20:00:00Z', 'UTC', '01:00', WINDOW)).toBe(false);
  });

  it('handles a meal just after midnight against a late bedtime', () => {
    expect(isLateMeal('2026-06-02T00:30:00Z', 'UTC', '23:30', WINDOW)).toBe(true);
  });

  it('uses the zone the meal was logged in, not the device zone', () => {
    // Same instant: 23:45 in London (BST) is 18:45 in New York.
    expect(isLateMeal('2026-06-01T22:45:00Z', 'Europe/London', '23:30', WINDOW)).toBe(true);
    expect(isLateMeal('2026-06-01T22:45:00Z', 'America/New_York', '23:30', WINDOW)).toBe(false);
  });

  it('respects a custom window and an unknown zone', () => {
    expect(isLateMeal('2026-06-01T20:30:00Z', 'UTC', '22:30', 60)).toBe(false);
    expect(isLateMeal('2026-06-01T21:45:00Z', 'Not/AZone', '22:30', 60)).toBe(true);
  });

  it('never flags with an invalid bedtime', () => {
    expect(isLateMeal('2026-06-01T22:30:00Z', 'UTC', 'late', WINDOW)).toBe(false);
  });
});
