import {
  daysOf,
  EMPTY_SELECTION,
  inSelection,
  monthGrid,
  monthsBetween,
  nextSelection,
  selectionPeriod,
} from '../calendar';

describe('monthsBetween', () => {
  it('lists the months from the first day to the last, oldest first', () => {
    expect(monthsBetween('2026-08-20', '2026-10-03').map((m) => m.title)).toEqual([
      'August 2026',
      'September 2026',
      'October 2026',
    ]);
  });

  it('crosses a year boundary', () => {
    expect(monthsBetween('2025-11-30', '2026-01-02').map((m) => m.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });

  it('is one month when both days are in it', () => {
    expect(monthsBetween('2026-10-01', '2026-10-31')).toHaveLength(1);
  });
});

describe('monthGrid', () => {
  it('starts the month under its weekday, Sunday first, and pads the last week', () => {
    // 1 Oct 2026 is a Thursday.
    const weeks = monthGrid({ year: 2026, month: 9 });
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[1]?.[0]).toBe('2026-10-04');
    expect(weeks.at(-1)).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('knows a leap February, and a month that needs six weeks', () => {
    expect(monthGrid({ year: 2028, month: 1 }).flat().filter(Boolean)).toHaveLength(29);
    // 1 Nov 2026 is a Sunday; 1 Aug 2026 is a Saturday and runs to six rows.
    expect(monthGrid({ year: 2026, month: 7 })).toHaveLength(6);
  });
});

describe('nextSelection', () => {
  it('sets the start on the first tap and the end on the second', () => {
    const first = nextSelection(EMPTY_SELECTION, '2026-10-04');
    expect(first).toEqual({ start: '2026-10-04', end: null });
    expect(nextSelection(first, '2026-10-10')).toEqual({ start: '2026-10-04', end: '2026-10-10' });
  });

  it('puts an earlier second tap first, so the two are the ends of the range', () => {
    expect(nextSelection({ start: '2026-10-10', end: null }, '2026-10-04')).toEqual({
      start: '2026-10-04',
      end: '2026-10-10',
    });
  });

  it('lets the same day be tapped twice for a single day', () => {
    expect(nextSelection({ start: '2026-10-04', end: null }, '2026-10-04')).toEqual({
      start: '2026-10-04',
      end: '2026-10-04',
    });
  });

  it('starts over once a range is complete', () => {
    expect(nextSelection({ start: '2026-10-04', end: '2026-10-10' }, '2026-09-01')).toEqual({
      start: '2026-09-01',
      end: null,
    });
  });
});

describe('selectionPeriod, inSelection and daysOf', () => {
  it('is nothing when nothing is chosen, one day for a start alone, and the span otherwise', () => {
    expect(selectionPeriod(EMPTY_SELECTION)).toBeNull();
    expect(selectionPeriod({ start: '2026-10-04', end: null })).toEqual({
      startKey: '2026-10-04',
      endKey: '2026-10-04',
    });
    expect(selectionPeriod({ start: '2026-10-04', end: '2026-10-10' })).toEqual({
      startKey: '2026-10-04',
      endKey: '2026-10-10',
    });
  });

  it('includes both ends and the days between', () => {
    const selection = { start: '2026-10-04', end: '2026-10-10' };
    expect(inSelection(selection, '2026-10-04')).toBe(true);
    expect(inSelection(selection, '2026-10-07')).toBe(true);
    expect(inSelection(selection, '2026-10-10')).toBe(true);
    expect(inSelection(selection, '2026-10-11')).toBe(false);
    expect(inSelection(EMPTY_SELECTION, '2026-10-04')).toBe(false);
  });

  it('lists every day of a period, across a month end', () => {
    expect(daysOf({ startKey: '2026-09-29', endKey: '2026-10-02' })).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });
});
