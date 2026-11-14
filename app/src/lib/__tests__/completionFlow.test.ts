import { planCompletion, REPORT_GIFT_KEY, statLineFor, streakHeadline, subtitleFor } from '../completionFlow';
import type { BellieStage } from '../bellieStage';
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
const fresh: { commitGoal: number | null; giftsSeen: number[]; stageSeen: BellieStage } = {
  commitGoal: null,
  giftsSeen: [],
  stageSeen: 'baby',
};
const allSeen = [3, 7, 10, 14, 21, 30, 45, 50, REPORT_GIFT_KEY];
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

  it('shows progress and the round glasses on day 3', () => {
    const steps = planCompletion(summary({ checkInDays: 3 }), fresh);
    expect(steps.map((step) => step.screen)).toEqual(['completion', 'streak', 'commit', 'gift']);
    expect(steps[2]).toEqual({ screen: 'commit', mode: 'progress' });
    expect(steps[3]).toEqual({ screen: 'gift', gift: { kind: 'item', item: 'glasses', day: 3 } });
  });

  it('gives the bow tie and then the first report on day 7, each once', () => {
    const steps = planCompletion(summary({ checkInDays: 7 }), { ...fresh, giftsSeen: [3] });
    expect(steps.slice(-2)).toEqual([
      { screen: 'gift', gift: { kind: 'item', item: 'bow', day: 7 } },
      { screen: 'gift', gift: { kind: 'report' } },
    ]);
    expect(screens(summary({ checkInDays: 7 }), { ...fresh, giftsSeen: allSeen })).toEqual([
      'completion',
      'streak',
    ]);
  });

  it('gives a gift for every item on the day it unlocks', () => {
    const days: [number, string][] = [
      [10, 'hat'],
      [14, 'shades'],
      [21, 'phones'],
      [30, 'scarf'],
      [45, 'night'],
      [50, 'chef'],
    ];
    for (const [day, item] of days) {
      const steps = planCompletion(summary({ checkInDays: day }), {
        ...fresh,
        giftsSeen: [3, 7, REPORT_GIFT_KEY],
        stageSeen: 'adult',
      });
      expect(steps.at(-1)).toEqual({ screen: 'gift', gift: { kind: 'item', item, day } });
    }
  });

  it('does not hand over an item late: it is already in Customize Bellie as a gift box', () => {
    expect(
      screens(summary({ checkInDays: 11 }), {
        ...fresh,
        giftsSeen: [3, 7, REPORT_GIFT_KEY],
        stageSeen: 'adult',
      }),
    ).toEqual(['completion', 'streak']);
  });

  it('still gives the first report on day 8 if day 7 had no check-in', () => {
    const steps = planCompletion(summary({ checkInDays: 8 }), { ...fresh, giftsSeen: [3, 7] });
    expect(steps.at(-1)).toEqual({ screen: 'gift', gift: { kind: 'report' } });
  });

  it('keeps ordinary days short', () => {
    expect(screens(summary({ checkInDays: 5 }), { ...fresh, giftsSeen: allSeen })).toEqual([
      'completion',
      'streak',
    ]);
  });
});

describe('planCompletion: Bellie grows', () => {
  it('shows the grew page after the streak on the first check-in that reaches a new stage', () => {
    const steps = planCompletion(summary({ checkInDays: 30 }), { ...fresh, giftsSeen: allSeen });
    expect(steps.map((step) => step.screen)).toEqual(['completion', 'streak', 'grew']);
    expect(steps[2]).toEqual({ screen: 'grew', stage: 'little' });
  });

  it('shows it once: nothing more when the stage was already seen', () => {
    expect(
      screens(summary({ checkInDays: 45 }), { ...fresh, giftsSeen: allSeen, stageSeen: 'little' }),
    ).toEqual(['completion', 'streak']);
  });

  it('jumps to the newest stage reached when several were skipped, and not on a later log of the day', () => {
    const steps = planCompletion(summary({ checkInDays: 400 }), { ...fresh, giftsSeen: allSeen });
    expect(steps.map((step) => step.screen)).toContain('grew');
    expect(steps.find((step) => step.screen === 'grew')).toEqual({ screen: 'grew', stage: 'adult' });
    expect(screens(summary({ checkInDays: 400, todayCount: 2 }))).toEqual(['completion']);
  });

  it('never grows back down', () => {
    expect(screens(summary({ checkInDays: 10 }), { ...fresh, giftsSeen: allSeen, stageSeen: 'kid' })).toEqual(
      ['completion', 'streak'],
    );
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

  it('counts symptom check-ins by kind, like meals and doses, and ends the dose line without a full stop', () => {
    expect(
      statLineFor('symptoms', summary({ todayCount: 5, todayByKind: { meals: 2, symptoms: 2, doses: 1 } })),
    ).toBe('2 check-ins today');
    expect(subtitleFor('dose', 'Metformin, 8:30 AM')).toBe('Metformin, 8:30 AM');
  });

  it('says welcome back after a gap, never a loss', () => {
    expect(streakHeadline(summary({ returningAfterGap: true, checkInDays: 4 })).title).toBe('Welcome back');
    expect(streakHeadline(summary({ streak: 4 }))).toMatchObject({ big: '4', title: 'days checking in' });
  });
});
