import { COINS_PER_LOG, coinGain, coinsForLogs } from '../coins';

describe('coinsForLogs', () => {
  it('pays the same for every entry', () => {
    expect(coinsForLogs(0)).toBe(0);
    expect(coinsForLogs(3)).toBe(3 * COINS_PER_LOG);
  });

  it('never goes negative', () => {
    expect(coinsForLogs(-2)).toBe(0);
  });
});

describe('coinGain', () => {
  it('is zero on the first read', () => {
    expect(coinGain(null, 12)).toBe(0);
  });

  it('is the increase since the last read', () => {
    expect(coinGain(4, 5)).toBe(1);
    expect(coinGain(4, 7)).toBe(3);
  });

  it('is zero when nothing changed or an entry was deleted', () => {
    expect(coinGain(5, 5)).toBe(0);
    expect(coinGain(5, 4)).toBe(0);
  });
});
