import { addDays, dayLabel, formatTime, localDayKey } from '../localDay';

describe('localDayKey', () => {
  it('uses the zone the entry was logged in', () => {
    const iso = '2026-09-28T23:30:00.000Z';
    expect(localDayKey(iso, 'UTC')).toBe('2026-09-28');
    expect(localDayKey(iso, 'America/Los_Angeles')).toBe('2026-09-28');
    expect(localDayKey(iso, 'Asia/Tokyo')).toBe('2026-09-29');
    expect(localDayKey(iso, 'Pacific/Kiritimati')).toBe('2026-09-29');
  });

  it('handles DST transitions', () => {
    // UK clocks go forward at 01:00 UTC on 29 Mar 2026 and back at 01:00 UTC on 25 Oct 2026.
    expect(localDayKey('2026-03-28T23:30:00.000Z', 'Europe/London')).toBe('2026-03-28');
    expect(localDayKey('2026-03-29T23:30:00.000Z', 'Europe/London')).toBe('2026-03-30');
    expect(localDayKey('2026-10-24T23:30:00.000Z', 'Europe/London')).toBe('2026-10-25');
    expect(localDayKey('2026-10-25T23:30:00.000Z', 'Europe/London')).toBe('2026-10-25');
    // US spring forward, 8 Mar 2026.
    expect(localDayKey('2026-03-09T06:30:00.000Z', 'America/New_York')).toBe('2026-03-09');
    expect(localDayKey('2026-03-09T03:30:00.000Z', 'America/New_York')).toBe('2026-03-08');
  });

  it('falls back to UTC for an unknown zone', () => {
    expect(localDayKey('2026-09-28T23:30:00.000Z', 'Not/AZone')).toBe('2026-09-28');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dayLabel', () => {
  const now = new Date('2026-09-28T10:00:00.000Z');

  it('says Today and Yesterday relative to the device zone', () => {
    expect(dayLabel('2026-09-28', now, 'Europe/London')).toBe('Today');
    expect(dayLabel('2026-09-27', now, 'Europe/London')).toBe('Yesterday');
    // Already the 29th in Kiritimati (UTC+14).
    expect(dayLabel('2026-09-29', now, 'Pacific/Kiritimati')).toBe('Today');
  });

  it('shows a short date for older days, with the year only when different', () => {
    expect(dayLabel('2026-09-21', now, 'UTC')).toMatch(/21/);
    expect(dayLabel('2026-09-21', now, 'UTC')).not.toMatch(/2026/);
    expect(dayLabel('2025-12-31', now, 'UTC')).toMatch(/2025/);
  });
});

describe('formatTime', () => {
  it('shows the clock time where it was logged', () => {
    expect(formatTime('2026-09-28T19:20:00.000Z', 'Europe/London')).toMatch(/8:20/);
    expect(formatTime('2026-09-28T19:20:00.000Z', 'Asia/Tokyo')).toMatch(/4:20/);
  });
});
