import { planCompletion, statLineFor, streakHeadline } from '../completionFlow';
import type { CheckInSummary } from '../streak';

const summary = (over: Partial<CheckInSummary> = {}): CheckInSummary => ({
  todayCount: 1,
  checkInDays: 1,
  streak: 1,
  returningAfterGap: false,
  weekDays: [],
  counts: { meals: 1, symptoms: 0, doses: 0 },
  todayByKind: { meals: 1, symptoms: 0, doses: 0 },
  ...over,
});
const fresh: { commitGoal: number | null; giftsSeen: number[] } = { commitGoal: null, giftsSeen: [] };
const screens = (s: CheckInSummary, memory = fresh) => planCompletion(s, memory).map((step) => step.screen);

describe('planCompletion', () => {
  it('shows only the completion after the first log of the day', () => {
    expect(screens(summary({ todayCount: 2, checkInDays: 3 }))).toEqual(['completion']);
  });

  it('adds the streak and a goal on day 1', () => {
    expect(screens(summary())).toEqual(['completion', 'streak', 'commit']);
  });

  it('stops asking for a goal once one is picked', () => {
    expect(screens(summary({ checkInDays: 2 }), { ...fresh, commitGoal: 7 })).toEqual([
      'completion',
      'streak',
    ]);
  });

  it('shows progress and the hat on day 3', () => {
    const steps = planCompletion(summary({ checkInDays: 3 }), fresh);
    expect(steps.map((step) => step.screen)).toEqual(['completion', 'streak', 'commit', 'gift']);
    expect(steps[2]).toEqual({ screen: 'commit', mode: 'progress' });
    expect(steps[3]).toEqual({ screen: 'gift', day: 3 });
  });

  it('gives the first report on day 7, once', () => {
    const seenHat = { ...fresh, giftsSeen: [3] };
    expect(planCompletion(summary({ checkInDays: 7 }), seenHat).at(-1)).toEqual({ screen: 'gift', day: 7 });
    expect(screens(summary({ checkInDays: 7 }), { ...fresh, giftsSeen: [3, 7] })).toEqual([
      'completion',
      'streak',
    ]);
  });

  it('still gives the hat on day 4 if day 3 had no check-in', () => {
    expect(planCompletion(summary({ checkInDays: 4 }), fresh).at(-1)).toEqual({ screen: 'gift', day: 3 });
  });

  it('keeps ordinary days short', () => {
    expect(screens(summary({ checkInDays: 5 }), { ...fresh, giftsSeen: [3] })).toEqual([
      'completion',
      'streak',
    ]);
  });
});

describe('copy', () => {
  it('words the stat line by kind', () => {
    expect(statLineFor('meal', summary({ todayByKind: { meals: 2, symptoms: 0, doses: 0 } }))).toBe(
      '2 meals today',
    );
    expect(statLineFor('symptoms', summary({ todayByKind: { meals: 0, symptoms: 1, doses: 0 } }))).toBe(
      '1 check-in today',
    );
    expect(statLineFor('dose', summary({ todayByKind: { meals: 0, symptoms: 0, doses: 2 } }))).toBe(
      '2 doses today',
    );
  });

  it('says welcome back after a gap, never a loss', () => {
    expect(streakHeadline(summary({ returningAfterGap: true, checkInDays: 4 })).title).toBe('Welcome back');
    expect(streakHeadline(summary({ streak: 4 }))).toMatchObject({ big: '4', title: 'days checking in' });
  });
});
