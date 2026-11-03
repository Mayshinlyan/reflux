import {
  countInFridge,
  daysSince,
  FRIDGE_NUDGE_DAYS,
  fridgeIsStale,
  inFridge,
  itemsLine,
  updatedLine,
} from '../fridge';

const now = new Date('2026-11-10T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('how old the fridge is', () => {
  it('counts whole days and never goes below zero', () => {
    expect(daysSince(daysAgo(0), now)).toBe(0);
    expect(daysSince(daysAgo(3), now)).toBe(3);
    expect(daysSince(new Date(now.getTime() + 1000).toISOString(), now)).toBe(0);
    expect(daysSince('not a date', now)).toBe(0);
  });

  it('says it in plain words', () => {
    expect(updatedLine(daysAgo(0), now)).toBe('Updated today');
    expect(updatedLine(daysAgo(1), now)).toBe('Updated yesterday');
    expect(updatedLine(daysAgo(3), now)).toBe('Updated 3 days ago');
  });

  it('turns stale on the seventh day', () => {
    expect(FRIDGE_NUDGE_DAYS).toBe(7);
    expect(fridgeIsStale(daysAgo(6), now)).toBe(false);
    expect(fridgeIsStale(daysAgo(7), now)).toBe(true);
    expect(fridgeIsStale(daysAgo(30), now)).toBe(true);
  });

  it('counts things', () => {
    expect(itemsLine(1)).toBe('1 item');
    expect(itemsLine(14)).toBe('14 items');
  });
});

describe('inFridge: does a recipe line name something you have', () => {
  const fridge = ['eggs', 'rice', 'kimchi', 'Chicken breast', 'tomatoes', 'berries'];

  it.each([
    ['2 eggs', true],
    ['1 1/2 cups cooked rice', true],
    ['1/2 cup kimchi, rinsed', true],
    ['8 oz chicken breast, sliced', true],
    ['2 tbsp low-sodium soy sauce', false],
    ['1 scallion, green part only', false],
  ])('%s -> %s', (line, expected) => {
    expect(inFridge(line, fridge)).toBe(expected);
  });

  it('matches a singular line to a plural fridge name and the other way round', () => {
    expect(inFridge('1 egg', fridge)).toBe(true);
    expect(inFridge('1 tomato, diced', fridge)).toBe(true);
    expect(inFridge('1 cup blueberries', ['berry'])).toBe(false); // whole words only
    expect(inFridge('1 cup berries', ['berry'])).toBe(true);
    expect(inFridge('3 tomatoes', ['tomato'])).toBe(true);
  });

  it('matches whole words only and ignores capitals and accents', () => {
    expect(inFridge('1 tsp licorice powder', ['rice'])).toBe(false);
    expect(inFridge('1 JALAPEÑO', ['jalapeno'])).toBe(true);
    expect(inFridge('1 cup stir-fry sauce', ['stir fry'])).toBe(true);
  });

  it('matches nothing from an empty fridge', () => {
    expect(inFridge('2 eggs', [])).toBe(false);
  });

  it('counts the lines the fridge covers', () => {
    expect(countInFridge(['2 eggs', '1 cup cooked rice', '1 tbsp sesame oil'], fridge)).toBe(2);
  });
});
