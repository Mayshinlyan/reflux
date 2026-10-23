import { bellyMoodFor } from '../belly';
import { MAX_TILT_X_DEG, MAX_TILT_Y_DEG, tiltFromTouch } from '../bellyMotion';
import { weekOf } from '../week';

describe('bellyMoodFor', () => {
  it('follows the verdict, and is happy with none', () => {
    expect(bellyMoodFor('good')).toBe('happy');
    expect(bellyMoodFor('ok')).toBe('okay');
    expect(bellyMoodFor('caution')).toBe('caution');
    expect(bellyMoodFor('trigger')).toBe('avoid');
    expect(bellyMoodFor(null)).toBe('happy');
    expect(bellyMoodFor(undefined)).toBe('happy');
  });
});

describe('weekOf', () => {
  it('runs Sunday to Saturday around the given day', () => {
    // 2026-10-10 is a Saturday.
    const week = weekOf('2026-10-10');
    expect(week.map((day) => day.key)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(week.map((day) => day.letter).join('')).toBe('SMTWTFS');
    expect(week.filter((day) => day.isToday).map((day) => day.date)).toEqual([10]);
  });

  it('crosses a month boundary', () => {
    expect(weekOf('2026-11-01').map((day) => day.date)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekOf('2026-11-03')[0]?.key).toBe('2026-11-01');
    expect(weekOf('2026-10-31')[0]?.key).toBe('2026-10-25');
  });
});

describe('tiltFromTouch', () => {
  it('does not tilt when the touch is in the middle or the size is unknown', () => {
    expect(tiltFromTouch(130, 130, 260, 260)).toEqual({ rotateX: 0, rotateY: 0 });
    expect(tiltFromTouch(10, 10, 0, 0)).toEqual({ rotateX: 0, rotateY: 0 });
  });

  it('tilts away from the touched edge, up to the maximum', () => {
    expect(tiltFromTouch(260, 130, 260, 260).rotateY).toBe(MAX_TILT_Y_DEG);
    expect(tiltFromTouch(130, 0, 260, 260).rotateX).toBe(MAX_TILT_X_DEG);
    expect(tiltFromTouch(500, 500, 260, 260).rotateY).toBe(MAX_TILT_Y_DEG);
  });
});
