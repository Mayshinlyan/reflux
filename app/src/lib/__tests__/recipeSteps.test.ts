import { STEP_TONES, stepKind, stepTime, stepTone } from '../recipeSteps';

describe('stepKind', () => {
  it.each([
    ['Rinse the kimchi and chop it small.', 'chop'],
    ['Slice the carrots into thin coins.', 'chop'],
    ['Warm the sesame oil, then stir-fry the kimchi for 2 minutes.', 'heat'],
    ['Simmer the broth with the tofu until it is hot all the way through.', 'heat'],
    ['Bring the water to a boil.', 'heat'],
    ['Bake for 12 minutes until the fish flakes.', 'bake'],
    ['Roast the potatoes until soft.', 'bake'],
    ['Turn off the heat and let it rest for 5 minutes.', 'wait'],
    ['Let it cool before you taste it.', 'wait'],
    ['Spoon it into bowls and serve warm.', 'serve'],
    ['Plate the fish over the rice.', 'serve'],
    ['Push the rice aside, scramble the eggs, then fold everything together.', 'stir'],
    ['Whisk the miso into the broth.', 'stir'],
    ['Add the rice and the soy sauce.', 'add'],
    ['Drizzle with a little sesame oil.', 'add'],
    ['Take a moment to enjoy the smell.', 'serve'],
    ['Season with a pinch of salt.', 'add'],
    ['Taste and adjust.', 'other'],
    ['Set aside the onions.', 'other'],
  ])('reads %s as %s', (text, kind) => {
    expect(stepKind(text)).toBe(kind);
  });

  it('does not match the end of a longer word', () => {
    expect(stepKind('Walk through the forest.')).toBe('other');
  });
});

describe('stepTime', () => {
  it.each([
    ['Stir-fry the kimchi for 2 minutes.', '2 min'],
    ['Simmer for 10 mins.', '10 min'],
    ['Bake for 12 to 15 minutes.', '12–15 min'],
    ['Cook 10-12 minutes.', '10–12 min'],
    ['Marinate for 1 hour.', '1 hr'],
    ['Slow cook for 1.5 hours.', '1 hr 30 min'],
    ['Rest for 90 minutes.', '1 hr 30 min'],
    ['Simmer for 2 to 3 hours.', '2 hr to 3 hr'],
  ])('finds the time in %s', (text, label) => {
    expect(stepTime(text)).toBe(label);
  });

  it.each([['Chop the kimchi.'], ['Add 2 eggs.'], ['Stir until hot.'], ['Cook for 0 minutes.']])(
    'finds none in %s',
    (text) => {
      expect(stepTime(text)).toBeNull();
    },
  );

  it('does not read the bottom of a fraction as the time', () => {
    expect(stepTime('Cook for 1/2 minute.')).toBeNull();
  });

  it('uses the first time a step names', () => {
    expect(stepTime('Simmer for 5 minutes, then rest for 10 minutes.')).toBe('5 min');
  });
});

describe('stepTone', () => {
  it('takes the soft colours in turn, so neighbouring cards differ', () => {
    expect(stepTone(0)).toEqual(STEP_TONES[0]);
    expect(stepTone(STEP_TONES.length)).toEqual(STEP_TONES[0]);
    expect(stepTone(0)).not.toEqual(stepTone(1));
    expect(stepTone(-1)).toEqual(STEP_TONES[STEP_TONES.length - 1]);
  });
});
