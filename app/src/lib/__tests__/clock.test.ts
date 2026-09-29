import { BEDTIME_OPTIONS, formatClock } from '../clock';

describe('formatClock', () => {
  it('shows 24-hour times the way a phone does', () => {
    expect(formatClock('22:30')).toBe('10:30 PM');
    expect(formatClock('23:00')).toBe('11:00 PM');
    expect(formatClock('20:00')).toBe('8:00 PM');
    expect(formatClock('07:05')).toBe('7:05 AM');
  });

  it('handles midnight and noon', () => {
    expect(formatClock('00:00')).toBe('12:00 AM');
    expect(formatClock('00:30')).toBe('12:30 AM');
    expect(formatClock('12:00')).toBe('12:00 PM');
    expect(formatClock('12:45')).toBe('12:45 PM');
  });

  it('returns anything that is not HH:MM unchanged', () => {
    expect(formatClock('25:00')).toBe('25:00');
    expect(formatClock('10:5')).toBe('10:5');
    expect(formatClock('bedtime')).toBe('bedtime');
  });
});

describe('BEDTIME_OPTIONS', () => {
  it('runs from 8:00 PM to 2:00 AM in half-hour steps', () => {
    expect(BEDTIME_OPTIONS).toHaveLength(13);
    expect(BEDTIME_OPTIONS[0]).toBe('20:00');
    expect(BEDTIME_OPTIONS.at(-1)).toBe('02:00');
    expect(BEDTIME_OPTIONS.map(formatClock)).toEqual([
      '8:00 PM',
      '8:30 PM',
      '9:00 PM',
      '9:30 PM',
      '10:00 PM',
      '10:30 PM',
      '11:00 PM',
      '11:30 PM',
      '12:00 AM',
      '12:30 AM',
      '1:00 AM',
      '1:30 AM',
      '2:00 AM',
    ]);
  });

  it('includes the default bedtime and only valid HH:MM values (so each can be stored)', () => {
    expect(BEDTIME_OPTIONS).toContain('22:30');
    for (const option of BEDTIME_OPTIONS) expect(option).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});
