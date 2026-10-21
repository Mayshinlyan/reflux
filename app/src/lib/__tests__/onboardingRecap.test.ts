import { watchingLine } from '../onboardingRecap';

describe('watchingLine', () => {
  it('stays gentle when nothing was picked', () => {
    expect(watchingLine([])).toBe('Whatever you notice');
  });

  it('names one, two or three in a natural list, in the order given', () => {
    expect(watchingLine(['heartburn'])).toBe('Heartburn');
    expect(watchingLine(['heartburn', 'hoarseness'])).toBe('Heartburn and hoarse voice');
    expect(watchingLine(['heartburn', 'burping', 'hoarseness'])).toBe('Heartburn, burping and hoarse voice');
  });

  it('folds the rest into "N more" so the line stays short', () => {
    expect(watchingLine(['heartburn', 'burping', 'hoarseness', 'mucus', 'cough'])).toBe(
      'Heartburn, burping, hoarse voice and 2 more',
    );
  });
});
