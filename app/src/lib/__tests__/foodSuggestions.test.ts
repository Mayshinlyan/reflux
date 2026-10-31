import { MAX_SUGGESTIONS, suggestFoods } from '../foodSuggestions';

const none = { saved: [], recent: [], common: [] } as const;

describe('suggestFoods', () => {
  it('suggests nothing for an empty or blank query', () => {
    const sources = { ...none, common: ['Oatmeal'] };
    expect(suggestFoods('', sources)).toEqual([]);
    expect(suggestFoods('   ', sources)).toEqual([]);
  });

  it('matches anywhere in the name, ignoring case, and says where', () => {
    const [match] = suggestFoods('MEAL', { ...none, common: ['Oatmeal with banana'] });
    expect(match).toMatchObject({ name: 'Oatmeal with banana', matchStart: 3, matchLength: 4 });
  });

  it('lists favorites, then past meals, then common foods', () => {
    const result = suggestFoods('oat', {
      saved: [{ id: 7, name: 'Oatmeal with banana' }],
      recent: ['Oat milk latte'],
      common: ['Oatmeal'],
    });
    expect(result.map((r) => [r.name, r.source, r.id])).toEqual([
      ['Oatmeal with banana', 'favorite', 7],
      ['Oat milk latte', 'recent', undefined],
      ['Oatmeal', 'common', undefined],
    ]);
  });

  it('puts a match at the start of a word above one in the middle', () => {
    const result = suggestFoods('oat', { ...none, recent: ['Boat noodles'], common: ['Rolled oats'] });
    expect(result.map((r) => r.name)).toEqual(['Rolled oats', 'Boat noodles']);
  });

  it('shows a name once, whichever source has it first', () => {
    const result = suggestFoods('oat', {
      saved: [{ id: 1, name: 'Oatmeal' }],
      recent: ['oatmeal', 'Oat bran'],
      common: ['OATMEAL'],
    });
    expect(result.map((r) => [r.name, r.source])).toEqual([
      ['Oatmeal', 'favorite'],
      ['Oat bran', 'recent'],
    ]);
  });

  it('does not suggest a food back once it is typed in full, except a favorite', () => {
    expect(
      suggestFoods('oatmeal', { ...none, recent: ['Oatmeal'], common: ['Oatmeal porridge'] }),
    ).toHaveLength(1);
    const withFavorite = suggestFoods('oatmeal', { ...none, saved: [{ id: 2, name: 'Oatmeal' }] });
    expect(withFavorite).toEqual([expect.objectContaining({ name: 'Oatmeal', source: 'favorite', id: 2 })]);
  });

  it('stops at five', () => {
    const common = Array.from({ length: 12 }, (_, i) => `Oat ${i}`);
    expect(suggestFoods('oat', { ...none, common })).toHaveLength(MAX_SUGGESTIONS);
    expect(suggestFoods('oat', { ...none, common }, 2)).toHaveLength(2);
  });

  it('suggests nothing when nothing matches', () => {
    expect(suggestFoods('zzz', { ...none, common: ['Oatmeal'] })).toEqual([]);
  });
});
