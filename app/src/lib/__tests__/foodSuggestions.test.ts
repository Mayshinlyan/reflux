import { applySuggestion, MAX_SUGGESTIONS, suggestForPhrase, suggestFoods } from '../foodSuggestions';

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

  it('names where each food comes from, with favorites first and the rest A to Z', () => {
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

  it('sorts favorites A to Z among themselves, ahead of everything else', () => {
    const result = suggestFoods('oat', {
      saved: [
        { id: 1, name: 'Oat cake' },
        { id: 2, name: 'Oat bran' },
      ],
      recent: ['Oat aside'],
      common: [],
    });
    expect(result.map((r) => r.name)).toEqual(['Oat bran', 'Oat cake', 'Oat aside']);
  });

  it('sorts without regard to case', () => {
    const result = suggestFoods('o', { ...none, common: ['orange', 'Oat bran', 'Olive oil'] });
    expect(result.map((r) => r.name)).toEqual(['Oat bran', 'Olive oil', 'orange']);
  });

  it('keeps favorites, then past meals, then word-start matches when there are more than fit, then orders those', () => {
    const result = suggestFoods(
      'oat',
      {
        saved: [{ id: 1, name: 'Zesty oat bowl' }],
        recent: ['Mid oats'],
        common: ['Boat noodles', 'Oat bran', 'Oat cake', 'Oatmeal'],
      },
      4,
    );
    // Cut: the favorite, the past meal, then the first two word-start matches ("Boat noodles" matches mid-word).
    expect(result.map((r) => r.name)).toEqual(['Zesty oat bowl', 'Mid oats', 'Oat bran', 'Oat cake']);
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

describe('suggestForPhrase', () => {
  const sources = {
    saved: [{ id: 3, name: 'Creamy pumpkin soup' }],
    recent: ['Pumpkin soup'],
    common: ['Roasted pumpkin soup', 'Cream cheese', 'Oatmeal'],
  };

  it('matches the last words typed and says where they start', () => {
    const text = "it's pumpkin so";
    const { suggestions, replaceFrom } = suggestForPhrase(text, sources);
    expect(suggestions.map((s) => s.name)).toEqual([
      'Creamy pumpkin soup',
      'Pumpkin soup',
      'Roasted pumpkin soup',
    ]);
    expect(text.slice(replaceFrom)).toBe('pumpkin so');
  });

  it('falls back to fewer words when the longer phrase finds nothing', () => {
    const text = 'no cream';
    const { suggestions, replaceFrom } = suggestForPhrase(text, sources);
    expect(suggestions.map((s) => s.name)).toEqual(['Creamy pumpkin soup', 'Cream cheese']);
    expect(text.slice(replaceFrom)).toBe('cream');
  });

  it('only looks after the last comma', () => {
    const text = 'pumpkin soup, oat';
    const { suggestions, replaceFrom } = suggestForPhrase(text, sources);
    expect(suggestions.map((s) => s.name)).toEqual(['Oatmeal']);
    expect(text.slice(replaceFrom)).toBe('oat');
  });

  it('waits for two letters', () => {
    expect(suggestForPhrase('it is o', sources).suggestions).toEqual([]);
    expect(suggestForPhrase('', sources).suggestions).toEqual([]);
  });

  it('suggests nothing after a space or comma', () => {
    expect(suggestForPhrase('pumpkin so ', sources).suggestions).toEqual([]);
    expect(suggestForPhrase('pumpkin,', sources).suggestions).toEqual([]);
  });

  it('stops once the words are a food in full, even a favorite', () => {
    expect(suggestForPhrase('it is oatmeal', sources).suggestions).toEqual([]);
    expect(suggestForPhrase('it is creamy pumpkin soup', sources).suggestions).toEqual([]);
  });
});

describe('applySuggestion', () => {
  it('replaces the typed words with the food and a space', () => {
    expect(applySuggestion("it's pumpkin so", 5, 'Pumpkin soup')).toBe("it's Pumpkin soup ");
  });
});
