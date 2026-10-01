import {
  derivePetState,
  foodDelta,
  hasStageUp,
  type PetLogs,
  statusLine,
  symptomDelta,
} from '../petProgress';

const BEDTIME = '22:30';
const WINDOW = 180;
const empty: PetLogs = { food: [], symptoms: [], medications: [] };
const derive = (logs: Partial<PetLogs>) => derivePetState({ ...empty, ...logs }, BEDTIME, WINDOW);

const meal = (at: string, verdict: 'good' | 'ok' | 'caution' | 'trigger') => ({
  loggedAt: at,
  tz: 'UTC',
  verdict,
});
/** n OK meals at noon on successive days. */
const okMeals = (n: number) =>
  Array.from({ length: n }, (_, i) => meal(new Date(Date.UTC(2026, 0, 1 + i, 12)).toISOString(), 'ok'));

describe('deltas', () => {
  it('scores food by verdict, with an extra penalty for a late non-OK meal', () => {
    expect(foodDelta('ok', false)).toBe(8);
    expect(foodDelta('caution', false)).toBe(-4);
    expect(foodDelta('trigger', false)).toBe(-10);
    expect(foodDelta('caution', true)).toBe(-8);
    expect(foodDelta('trigger', true)).toBe(-14);
    expect(foodDelta('ok', true)).toBe(8);
    // A verdict set to OK by hand counts as OK, late or not.
    expect(foodDelta('good', false)).toBe(8);
    expect(foodDelta('good', true)).toBe(8);
  });

  it('scores symptoms by average severity', () => {
    expect(symptomDelta([1, 2])).toBe(3);
    expect(symptomDelta([3])).toBe(0);
    expect(symptomDelta([3, 4])).toBe(0);
    expect(symptomDelta([4, 5])).toBe(-8);
    expect(symptomDelta([])).toBe(0);
  });
});

describe('derivePetState', () => {
  it('starts as a happy little pet with no progress', () => {
    expect(derive({})).toEqual({ stage: 0, progress: 0, mood: 'happy' });
  });

  it('adds up progress from every kind of log', () => {
    const state = derive({
      food: [meal('2026-03-01T12:00:00Z', 'ok')],
      symptoms: [{ loggedAt: '2026-03-01T13:00:00Z', scores: [1] }],
      medications: [{ takenAt: '2026-03-01T14:00:00Z' }],
    });
    expect(state.progress).toBe(14);
  });

  it('replays in time order, not input order (the clamp at 0 depends on it)', () => {
    const state = derive({
      food: [meal('2026-03-02T12:00:00Z', 'trigger'), meal('2026-03-01T12:00:00Z', 'ok')],
    });
    expect(state.progress).toBe(0); // +8 then -10 clamps to 0
    expect(state.mood).toBe('unwell');
  });

  it('never drops below 0', () => {
    const state = derive({ food: [meal('2026-03-01T12:00:00Z', 'trigger')] });
    expect(state.progress).toBe(0);
  });

  it('carries overflow into the next stage', () => {
    // 13 OK meals = 104 -> stage 1 with 4 progress.
    expect(derive({ food: okMeals(13) })).toEqual({ stage: 1, progress: 4, mood: 'happy' });
  });

  it('never moves a stage backwards', () => {
    const logs = [...okMeals(13), meal('2026-04-01T12:00:00Z', 'trigger')];
    expect(derive({ food: logs })).toMatchObject({ stage: 1, progress: 0 });
  });

  it('caps at the grown stage with full progress', () => {
    expect(derive({ food: okMeals(40) })).toEqual({ stage: 2, progress: 100, mood: 'happy' });
  });

  it('penalises a late non-OK meal more, and follows a bedtime change', () => {
    const logs = { food: [meal('2026-03-01T12:00:00Z', 'ok'), meal('2026-03-01T20:00:00Z', 'caution')] };
    expect(derivePetState({ ...empty, ...logs }, '22:30', WINDOW).progress).toBe(0); // 8 - 8
    expect(derivePetState({ ...empty, ...logs }, '01:00', WINDOW).progress).toBe(4); // 8 - 4
  });

  it('takes its mood from the most recent log', () => {
    const bad = { food: [meal('2026-03-01T12:00:00Z', 'trigger')] };
    const thenMeds = { ...bad, medications: [{ takenAt: '2026-03-01T15:00:00Z' }] };
    expect(derive(bad).mood).toBe('unwell');
    expect(derive(thenMeds).mood).toBe('happy'); // taking meds is never punished
  });

  it('recomputes when an entry is deleted', () => {
    const logs = [...okMeals(3), meal('2026-03-10T12:00:00Z', 'trigger')];
    expect(derive({ food: logs }).mood).toBe('unwell');
    expect(derive({ food: logs.slice(0, 3) })).toMatchObject({ progress: 24, mood: 'happy' });
  });
});

describe('statusLine', () => {
  it('is warm in every mood', () => {
    expect(statusLine('Mochi', 'happy', true, 'mochi')).toBe('Mochi is thriving!');
    expect(statusLine('Mochi', 'happy', false, 'mochi')).toBe('Mochi is happy to see you!');
    expect(statusLine('Mochi', 'unwell', true, 'mochi')).toBe(
      "Mochi's feeling a little under the weather today.",
    );
    expect(statusLine('Buddy', 'unwell', true, 'dog')).toBe("Buddy's feeling a little ruff today.");
  });
});

describe('hasStageUp', () => {
  it('is true only when the pet is past the last stage the user saw', () => {
    expect(hasStageUp(1, 0)).toBe(true);
    expect(hasStageUp(2, 0)).toBe(true);
    expect(hasStageUp(1, 1)).toBe(false);
    expect(hasStageUp(0, 0)).toBe(false);
  });

  it('does not celebrate a pet that fell back below what was seen', () => {
    expect(hasStageUp(0, 1)).toBe(false);
  });
});
