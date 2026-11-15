import { levelFromDb } from '../voiceLevel';

describe('levelFromDb', () => {
  it('is a flat line for silence and full height for loud speech', () => {
    expect(levelFromDb(-160)).toBe(0);
    expect(levelFromDb(undefined)).toBe(0);
    expect(levelFromDb(0)).toBe(1);
    expect(levelFromDb(-27.5)).toBeCloseTo(0.5);
  });
});
