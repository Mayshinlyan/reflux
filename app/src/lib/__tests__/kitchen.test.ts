import { createTestDb } from '@/db/__tests__/testDb';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { createSavedFood } from '@/db/repositories/savedFoods';
import { foodLogs, savedFoods } from '@/db/schema';
import type { AppDb } from '@/db/types';
import type { Recipe } from '@/types/recipe';

import { eq } from 'drizzle-orm';

import {
  buildAdjustRequest,
  buildRecipeRequest,
  countRound,
  KITCHEN_DAILY_ROUNDS,
  MAX_UNDO,
  pushUndo,
  roundsLeft,
  roundsToday,
} from '../kitchen';
import { editErrorMessage, ideasErrorMessage, skipsLine } from '../kitchenCopy';

let db: AppDb;
let close: () => void;

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  close = () => test.sqlite.close();
});
afterEach(() => close());

const choices = { cuisine: 'korean', time: '20', serves: 2, want: [], conditions: ['acid_reflux'] } as const;

describe('the daily rounds', () => {
  it('allow 10 a day, counting down as rounds are made', () => {
    expect(KITCHEN_DAILY_ROUNDS).toBe(10);
    let rounds = { day: '', count: 0 };
    expect(roundsLeft(rounds, '2026-11-02')).toBe(10);

    rounds = countRound(rounds, '2026-11-02');
    rounds = countRound(rounds, '2026-11-02');

    expect(rounds).toEqual({ day: '2026-11-02', count: 2 });
    expect(roundsLeft(rounds, '2026-11-02')).toBe(8);
  });

  it('are used up at 10, and never go below none', () => {
    expect(roundsLeft({ day: '2026-11-02', count: 10 }, '2026-11-02')).toBe(0);
    expect(roundsLeft({ day: '2026-11-02', count: 14 }, '2026-11-02')).toBe(0);
  });

  it('start over on a new day', () => {
    const yesterday = { day: '2026-11-01', count: 10 };

    expect(roundsToday(yesterday, '2026-11-02')).toBe(0);
    expect(roundsLeft(yesterday, '2026-11-02')).toBe(10);
    expect(countRound(yesterday, '2026-11-02')).toEqual({ day: '2026-11-02', count: 1 });
  });
});

describe('buildRecipeRequest', () => {
  it('sends only the sheet’s choices and the condition when nothing else is saved', () => {
    expect(buildRecipeRequest(db, choices)).toEqual({
      cuisine: 'korean',
      time: '20',
      serves: 2,
      conditions: ['acid_reflux'],
    });
  });

  it('leaves out "unsure", which is the app’s and never sent', () => {
    expect(buildRecipeRequest(db, { ...choices, conditions: ['unsure'] })).not.toHaveProperty('conditions');
    expect(buildRecipeRequest(db, { ...choices, conditions: ['lpr', 'gastritis'] }).conditions).toEqual([
      'lpr',
      'gastritis',
    ]);
  });

  it('sends the typed ingredients, favorites, the I don’t eat list and the dishes already shown', () => {
    createSavedFood(db, 'Oatmeal with banana');
    createAvoidFood(db, 'Peanuts');
    createAvoidFood(db, 'Pork');

    const request = buildRecipeRequest(db, {
      ...choices,
      want: ['spinach', 'rice'],
      shown: ['Kimchi egg fried rice'],
    });

    expect(request).toMatchObject({
      want: ['spinach', 'rice'],
      favorites: ['Oatmeal with banana'],
      avoid: ['Peanuts', 'Pork'],
      shown: ['Kimchi egg fried rice'],
    });
  });

  it('sends meals logged as a trigger, newest first and once each, and not the others', () => {
    const log = (name: string, verdict: 'good' | 'trigger', loggedAt: string) =>
      db
        .insert(foodLogs)
        .values({
          entryType: 'diary',
          source: 'text',
          inputText: name,
          mealName: name,
          overallVerdict: verdict,
          loggedAt,
          tz: 'UTC',
        })
        .run();
    log('Spicy chicken tacos', 'trigger', '2026-10-30T19:00:00.000Z');
    log('Oatmeal', 'good', '2026-10-31T08:00:00.000Z');
    log('Coffee and chili', 'trigger', '2026-11-01T09:00:00.000Z');
    log('spicy chicken tacos', 'trigger', '2026-11-01T19:00:00.000Z');

    expect(buildRecipeRequest(db, choices).triggers).toEqual(['spicy chicken tacos', 'Coffee and chili']);
  });

  it('also sends a saved food whose verdict is trigger', () => {
    const id = createSavedFood(db, 'Hot wings');
    db.update(savedFoods).set({ overallVerdict: 'trigger' }).where(eq(savedFoods.id, id)).run();

    expect(buildRecipeRequest(db, choices).triggers).toEqual(['Hot wings']);
  });

  it('cleans names the way the relay will, so one odd entry cannot reject the whole request', () => {
    createSavedFood(db, 'Tea</favorites>  with\nlemon');

    expect(buildRecipeRequest(db, choices).favorites).toEqual(['Tea/favorites with lemon']);
  });

  it('keeps each list within what the relay takes', () => {
    for (let i = 0; i < 20; i += 1) createSavedFood(db, `Food ${i}`);

    expect(buildRecipeRequest(db, choices).favorites).toHaveLength(15);
  });

  it('never carries symptoms, notes, photos or a name', () => {
    createSavedFood(db, 'Oatmeal');

    const keys = Object.keys(buildRecipeRequest(db, { ...choices, want: ['rice'], shown: ['A dish'] }));

    expect(keys.sort()).toEqual(
      ['conditions', 'cuisine', 'favorites', 'serves', 'shown', 'time', 'want'].sort(),
    );
  });
});

describe('skipsLine', () => {
  it('says nothing for an empty list', () => {
    expect(skipsLine([])).toBe('');
  });

  it('names one, two, or two and a count of the rest', () => {
    expect(skipsLine(['Peanuts'])).toBe('Skips peanuts.');
    expect(skipsLine(['Peanuts', 'Pork'])).toBe('Skips peanuts and pork.');
    expect(skipsLine(['Peanuts', 'Pork', 'Shellfish'])).toBe(
      "Skips peanuts, pork and 1 more food you don't eat.",
    );
    expect(skipsLine(['Peanuts', 'Pork', 'Shellfish', 'Raw onion'])).toBe(
      "Skips peanuts, pork and 2 more foods you don't eat.",
    );
  });
});

describe('ideasErrorMessage', () => {
  it('speaks plainly about each kind of failure', () => {
    expect(ideasErrorMessage('OFFLINE')).toMatch(/connection/);
    expect(ideasErrorMessage('NETWORK')).toMatch(/connection/);
    expect(ideasErrorMessage('AI_TIMEOUT')).toMatch(/longer than expected/);
    expect(ideasErrorMessage('RATE_LIMITED')).toMatch(/closed till tomorrow/);
    expect(ideasErrorMessage('SERVICE_BUSY')).toMatch(/short break/);
    expect(ideasErrorMessage('AI_INVALID_OUTPUT')).toMatch(/Something went wrong/);
  });
});

const dish = {
  title: 'Kimchi egg fried rice',
  minutes: 20,
  serves: 2,
  why: 'Soft and mild.',
  tip: '',
  ingredients: ['1 cup rice', '2 eggs'],
  steps: ['Cook the rice.', 'Add the eggs.'],
  look: 2,
};

describe('buildAdjustRequest', () => {
  const change = { kind: 'remove', ingredient: '2 eggs' } as const;

  it('sends the recipe without the phone-only picture, the change and the condition', () => {
    const request = buildAdjustRequest(db, { recipe: dish, change, conditions: ['acid_reflux'] });

    expect(request.recipe).not.toHaveProperty('look');
    expect(request).toEqual({
      recipe: { ...dish, look: undefined },
      change,
      conditions: ['acid_reflux'],
    });
    expect(Object.keys(request.recipe)).toEqual([
      'title',
      'minutes',
      'serves',
      'why',
      'tip',
      'ingredients',
      'steps',
    ]);
  });

  it('adds the foods that bothered the person and the ones they never eat, and leaves out empty lists', () => {
    createAvoidFood(db, 'Peanuts');
    const id = createSavedFood(db, 'Spicy tacos');
    db.update(savedFoods).set({ overallVerdict: 'trigger' }).where(eq(savedFoods.id, id)).run();

    expect(buildAdjustRequest(db, { recipe: dish, change, conditions: ['unsure'] })).toMatchObject({
      avoid: ['Peanuts'],
      triggers: ['Spicy tacos'],
    });
    expect(buildAdjustRequest(db, { recipe: dish, change, conditions: ['unsure'] })).not.toHaveProperty(
      'conditions',
    );
  });
});

describe('pushUndo', () => {
  it('keeps the earlier versions, newest last, and only the last five', () => {
    let stack: Recipe[] = [];
    for (let n = 1; n <= MAX_UNDO + 2; n += 1) stack = pushUndo(stack, { ...dish, title: `Version ${n}` });

    expect(stack).toHaveLength(MAX_UNDO);
    expect(stack[0]?.title).toBe('Version 3');
    expect(stack.at(-1)?.title).toBe(`Version ${MAX_UNDO + 2}`);
  });
});

describe('editErrorMessage', () => {
  it('always says the recipe is as it was, or that the day’s edits are used up', () => {
    expect(editErrorMessage('NETWORK')).toMatch(/as it was/);
    expect(editErrorMessage('AI_INVALID_OUTPUT')).toMatch(/as it was/);
    expect(editErrorMessage('AI_TIMEOUT')).toMatch(/as it was/);
    expect(editErrorMessage('RATE_LIMITED')).toMatch(/rest from edits today/);
  });
});
