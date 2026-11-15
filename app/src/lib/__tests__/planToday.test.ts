import type { StoredMeal } from '@/db/repositories/mealPlans';
import type { PlanDish } from '@/types/mealPlan';

import {
  afterPhrase,
  loggedMealFor,
  nextPlannedMeal,
  swapOffer,
  triggerName,
  weekLine,
  weekResult,
} from '../planToday';

const dish = (title: string, ingredients: string[] = ['2 salmon fillets']): PlanDish => ({
  id: title,
  title,
  minutes: 30,
  serves: 2,
  why: 'Mild.',
  tip: '',
  keepsDays: 2,
  ingredients,
  steps: ['Cook.'],
});

let id = 1;
const meal = (
  day: string,
  slot: StoredMeal['slot'],
  title: string,
  over: Partial<StoredMeal> = {},
): StoredMeal => ({
  id: id++,
  day,
  slot,
  dishId: title,
  dish: dish(title),
  locked: false,
  skipped: false,
  loggedAt: null,
  ...over,
});

const at = (hour: number, minute = 0) => new Date(2026, 10, 16, hour, minute);
const iso = (hour: number, minute = 0) => at(hour, minute).toISOString();
const TODAY = '2026-11-16';

describe('the next planned meal', () => {
  const lunch = meal(TODAY, 'lunch', 'Congee');
  const dinner = meal(TODAY, 'dinner', 'Miso salmon');

  it('is the first meal of today still to come', () => {
    expect(nextPlannedMeal([dinner, lunch], TODAY, at(9), [])?.dish.title).toBe('Congee');
    expect(nextPlannedMeal([lunch, dinner], TODAY, at(17), [])?.dish.title).toBe('Miso salmon');
  });

  it('skips meals that are skipped, on other days, or whose time has passed', () => {
    expect(nextPlannedMeal([{ ...lunch, skipped: true }], TODAY, at(9), [])).toBeNull();
    expect(nextPlannedMeal([meal('2026-11-17', 'dinner', 'Later')], TODAY, at(9), [])).toBeNull();
    expect(nextPlannedMeal([meal(TODAY, 'breakfast', 'Oats')], TODAY, at(12), [])).toBeNull();
  });

  it('goes once the meal was logged after "Log it", and stays if they backed out', () => {
    const tapped = { ...dinner, loggedAt: iso(18) };
    expect(nextPlannedMeal([tapped], TODAY, at(19), [])?.id).toBe(dinner.id);
    const saved = { createdAt: iso(18, 5), loggedAt: iso(18, 5) };
    expect(nextPlannedMeal([tapped], TODAY, at(19), [saved])).toBeNull();
  });

  it('does not count a meal eaten hours away from the tap, such as a later snack', () => {
    const snack = { createdAt: iso(23), loggedAt: iso(23) };
    expect(loggedMealFor({ ...dinner, loggedAt: iso(18) }, [snack])).toBeNull();
    expect(nextPlannedMeal([{ ...dinner, loggedAt: iso(18) }], TODAY, at(23, 30), [snack])?.id).toBe(
      dinner.id,
    );
  });

  it('does not count a meal saved before "Log it" was tapped, or when it was never tapped', () => {
    const before = { createdAt: iso(12), loggedAt: iso(12) };
    expect(loggedMealFor({ ...dinner, loggedAt: iso(18) }, [before])).toBeNull();
    expect(loggedMealFor(dinner, [before])).toBeNull();
  });
});

describe('the "felt off" swap offer', () => {
  const dinner = meal(TODAY, 'dinner', 'Miso salmon', { loggedAt: iso(18) });
  const tomorrow = meal('2026-11-17', 'dinner', 'Roast chicken');
  const lunchLater = meal('2026-11-17', 'lunch', 'Rice bowl');
  const ate = { createdAt: iso(18, 5), loggedAt: iso(18, 30) };
  const heartburn = { loggedAt: iso(20, 30), items: [{ key: 'heartburn' }] };

  it('comes after a logged planned meal followed by a symptom, for the next meal of the same kind', () => {
    const offer = swapOffer([dinner, lunchLater, tomorrow], TODAY, at(21), [ate], [heartburn], null);
    expect(offer?.meal.id).toBe(dinner.id);
    expect(offer?.next.id).toBe(tomorrow.id);
    expect(offer?.after).toBe('two hours');
    expect(offer?.symptom).toBeTruthy();
  });

  it('needs a meal that was really logged', () => {
    expect(swapOffer([dinner, tomorrow], TODAY, at(21), [], [heartburn], null)).toBeNull();
    expect(
      swapOffer([{ ...dinner, loggedAt: null }, tomorrow], TODAY, at(21), [ate], [heartburn], null),
    ).toBeNull();
  });

  it('needs a symptom within a few hours, and a real one (not a lifestyle-only check-in)', () => {
    const late = { loggedAt: iso(23, 45), items: [{ key: 'heartburn' }] };
    expect(swapOffer([dinner, tomorrow], TODAY, at(23, 50), [ate], [late], null)).toBeNull();
    const lifestyle = { loggedAt: iso(20), items: [] };
    expect(swapOffer([dinner, tomorrow], TODAY, at(21), [ate], [lifestyle], null)).toBeNull();
  });

  it('does not go back to an earlier meal once a later one was offered', () => {
    const earlier = meal('2026-11-15', 'dinner', 'Soup', { loggedAt: iso(18) });
    const atePast = { createdAt: iso(18, 5), loggedAt: iso(18, 30) };
    const feltPast = { loggedAt: iso(20, 30), items: [{ key: 'heartburn' }] };
    // The later meal (today's dinner) was offered last, so yesterday's is not asked about again.
    const offer = swapOffer(
      [earlier, dinner, tomorrow],
      TODAY,
      at(21),
      [atePast, ate],
      [feltPast, heartburn],
      dinner.id,
    );
    expect(offer).toBeNull();
  });

  it('asks once per meal, and only when there is a meal left to swap', () => {
    expect(swapOffer([dinner, tomorrow], TODAY, at(21), [ate], [heartburn], dinner.id)).toBeNull();
    expect(swapOffer([dinner], TODAY, at(21), [ate], [heartburn], null)).toBeNull();
    expect(
      swapOffer([dinner, { ...tomorrow, skipped: true }], TODAY, at(21), [ate], [heartburn], null),
    ).toBeNull();
  });
});

describe('how the week went', () => {
  it('counts logged meals and those with no symptom soon after', () => {
    const a = meal(TODAY, 'dinner', 'Miso salmon', { loggedAt: iso(18) });
    const b = meal('2026-11-17', 'dinner', 'Roast chicken', { loggedAt: iso(18) });
    const unlogged = meal('2026-11-18', 'dinner', 'Soup');
    const eaten = [{ createdAt: iso(18, 5), loggedAt: iso(18, 30) }];
    // Both "Log it" taps are the same minute here, so only the first meal's tap precedes the saved meal.
    const result = weekResult([a, unlogged], eaten, [{ loggedAt: iso(20), items: [{ key: 'heartburn' }] }]);
    expect(result).toEqual({ logged: 1, well: 0, wellTitles: [] });
    // Each diary meal answers for one planned meal only: one saved meal cannot make two.
    expect(weekResult([a, b], eaten, [])).toEqual({ logged: 1, well: 1, wellTitles: ['Miso salmon'] });
    const second = { createdAt: iso(18, 6), loggedAt: iso(18, 40) };
    expect(weekResult([a, b, unlogged], [...eaten, second], [])).toEqual({
      logged: 2,
      well: 2,
      wellTitles: ['Miso salmon', 'Roast chicken'],
    });
  });
});

describe('wording', () => {
  it('says how the week went', () => {
    expect(weekLine(6, 5)).toBe('5 of your 6 logged meals sat well. Keep those and plan the rest.');
    expect(weekLine(4, 4)).toBe('All 4 of your logged meals sat well. Keep those and plan the rest.');
    expect(weekLine(1, 1)).toBe('The meal you logged sat well. Keep those and plan the rest.');
  });

  it('says how long after a meal', () => {
    expect(afterPhrase(20)).toBe('20 minutes');
    expect(afterPhrase(60)).toBe('an hour');
    expect(afterPhrase(125)).toBe('two hours');
  });

  it('notes the main food, not the whole dish', () => {
    expect(triggerName(meal(TODAY, 'dinner', 'Miso salmon with rice'))).toBe('salmon fillets');
    expect(triggerName({ ...meal(TODAY, 'dinner', 'Toast'), dish: dish('Toast', []) })).toBe('Toast');
  });
});
