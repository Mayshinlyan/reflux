import {
  BELLIE_STAGES,
  isBellieStage,
  STAGE_FROM_DAY,
  STAGE_TITLE,
  stageForDays,
  stageIndex,
  stageLine,
} from '../bellieStage';

describe('stageForDays', () => {
  it('is a Baby until a month of check-ins, then Little, Kid, Teenager and Adult', () => {
    expect([0, 1, 29].map(stageForDays)).toEqual(['baby', 'baby', 'baby']);
    expect([30, 89].map(stageForDays)).toEqual(['little', 'little']);
    expect([90, 179].map(stageForDays)).toEqual(['kid', 'kid']);
    expect([180, 364].map(stageForDays)).toEqual(['teenager', 'teenager']);
    expect([365, 1000].map(stageForDays)).toEqual(['adult', 'adult']);
  });

  it('only goes up with the days', () => {
    let last = 0;
    for (let days = 0; days <= 400; days++) {
      const index = stageIndex(stageForDays(days));
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
  });
});

describe('stages', () => {
  it('lists them youngest first, each starting later than the one before', () => {
    const days = BELLIE_STAGES.map((stage) => STAGE_FROM_DAY[stage]);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(new Set(days).size).toBe(BELLIE_STAGES.length);
  });

  it('knows a stage from any other value', () => {
    expect(isBellieStage('kid')).toBe(true);
    expect(isBellieStage('toddler')).toBe(false);
    expect(isBellieStage(3)).toBe(false);
    expect(isBellieStage(null)).toBe(false);
  });

  it('words the grew page: a line for each stage and the days that got Bellie there', () => {
    expect(STAGE_TITLE.kid).toBe('Bellie is a kid now');
    expect(stageLine('kid')).toBe('90 days of check-ins');
    expect(stageLine('adult')).toBe('365 days of check-ins');
  });
});
