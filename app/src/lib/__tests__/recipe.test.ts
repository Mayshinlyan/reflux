import {
  cleanFoodName,
  formatMinutes,
  isRecipe,
  isRecipeIdeas,
  isVideoId,
  parseWanted,
  pickRecipe,
  recipeMeta,
  videoUrl,
} from '../recipe';

const recipe = {
  title: 'Kimchi egg fried rice',
  minutes: 20,
  serves: 2,
  why: 'Soft rice and egg are easy on the stomach.',
  tip: '',
  ingredients: ['1 1/2 cups cooked rice', '2 eggs'],
  steps: ['Chop the kimchi.', 'Stir-fry it.'],
};

describe('isRecipe', () => {
  it('accepts a whole recipe, including an empty tip', () => {
    expect(isRecipe(recipe)).toBe(true);
  });

  it.each([
    ['null', null],
    ['text', 'a recipe'],
    ['no title', { ...recipe, title: '' }],
    ['minutes as text', { ...recipe, minutes: '20' }],
    ['minutes that are not a number', { ...recipe, minutes: Number.NaN }],
    ['no why', { ...recipe, why: undefined }],
    ['no ingredients', { ...recipe, ingredients: [] }],
    ['an ingredient that is not text', { ...recipe, ingredients: ['rice', 3] }],
    ['an empty step', { ...recipe, steps: [''] }],
    ['no steps', { ...recipe, steps: undefined }],
  ])('rejects %s', (_name, value) => {
    expect(isRecipe(value)).toBe(false);
  });
});

describe('isRecipeIdeas', () => {
  it('needs at least one good recipe, and every one good', () => {
    expect(isRecipeIdeas({ recipes: [recipe] })).toBe(true);
    expect(isRecipeIdeas({ recipes: [] })).toBe(false);
    expect(isRecipeIdeas({ recipes: [recipe, { title: 'Half a recipe' }] })).toBe(false);
    expect(isRecipeIdeas({})).toBe(false);
    expect(isRecipeIdeas(null)).toBe(false);
  });
});

describe('pickRecipe', () => {
  it('keeps only the fields that are shown, as a copy', () => {
    const picked = pickRecipe({ ...recipe, extra: 'x' } as typeof recipe);

    expect(Object.keys(picked).sort()).toEqual(
      ['ingredients', 'minutes', 'serves', 'steps', 'tip', 'title', 'why'].sort(),
    );
    expect(picked.ingredients).not.toBe(recipe.ingredients);
  });

  it('keeps a real look, and leaves the field out when there is none or it is not one of the five', () => {
    expect(pickRecipe({ ...recipe, look: 2 }).look).toBe(2);
    expect('look' in pickRecipe(recipe)).toBe(false);
    expect('look' in pickRecipe({ ...recipe, look: 8 })).toBe(false);
  });
});

describe('isRecipe and the look', () => {
  it('accepts a recipe with or without a look, and refuses one with a look that does not exist', () => {
    expect(isRecipe({ ...recipe, look: 0 })).toBe(true);
    expect(isRecipe({ ...recipe, look: 4 })).toBe(true);
    expect(isRecipe(recipe)).toBe(true);
    expect(isRecipe({ ...recipe, look: 5 })).toBe(false);
    expect(isRecipe({ ...recipe, look: 'bowl' })).toBe(false);
  });
});

describe('parseWanted', () => {
  it('splits on commas, semicolons and lines, tidies each and drops repeats', () => {
    expect(parseWanted(' rice,  spinach ;\nEggs, rice ,, ')).toEqual(['rice', 'spinach', 'Eggs']);
  });

  it('stops at ten, cuts each to 40 characters and drops angle brackets', () => {
    expect(parseWanted(Array.from({ length: 14 }, (_, i) => `food${i}`).join(','))).toHaveLength(10);
    expect(parseWanted('x'.repeat(60))[0]).toHaveLength(40);
    expect(parseWanted('<b>rice</b>')).toEqual(['brice/b']);
  });

  it('gives nothing for an empty box', () => {
    expect(parseWanted('')).toEqual([]);
    expect(parseWanted('  ,  ')).toEqual([]);
  });
});

describe('cleanFoodName', () => {
  it('flattens line breaks and spaces and cuts to the cap', () => {
    expect(cleanFoodName('  Tea\n\nwith   lemon ')).toBe('Tea with lemon');
    expect(cleanFoodName('x'.repeat(100), 20)).toHaveLength(20);
  });
});

describe('time words', () => {
  it('writes minutes and hours plainly', () => {
    expect(formatMinutes(20)).toBe('20 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(80)).toBe('1 hr 20 min');
    expect(formatMinutes(120)).toBe('2 hr');
  });

  it('puts the time and servings on one line', () => {
    expect(recipeMeta(recipe)).toBe('20 min · serves 2');
  });
});

describe('the video of a recipe', () => {
  it('knows a YouTube video id: eleven letters, digits, dashes and underscores', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('a-b_c-d_e-f')).toBe(true);
    for (const bad of [
      '',
      'short',
      'twelve chars',
      'has space!!',
      'x'.repeat(12),
      12345678901,
      null,
      undefined,
    ]) {
      expect(isVideoId(bad)).toBe(false);
    }
  });

  it('builds the watch address from the id', () => {
    expect(videoUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('keeps a real video id with the recipe, and leaves the field out otherwise', () => {
    expect(pickRecipe({ ...recipe, videoId: 'dQw4w9WgXcQ' }).videoId).toBe('dQw4w9WgXcQ');
    expect('videoId' in pickRecipe(recipe)).toBe(false);
    expect('videoId' in pickRecipe({ ...recipe, videoId: 'nope' })).toBe(false);
  });

  it('accepts a recipe with or without a video id, and refuses one that is not an id', () => {
    expect(isRecipe({ ...recipe, videoId: 'dQw4w9WgXcQ' })).toBe(true);
    expect(isRecipe(recipe)).toBe(true);
    expect(isRecipe({ ...recipe, videoId: 'nope' })).toBe(false);
  });
});
