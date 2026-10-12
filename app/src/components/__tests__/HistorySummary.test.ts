import { statsCardHeight, statsScrollDistance } from '../HistorySummary';

describe('stats card size', () => {
  it('takes about two thirds of the screen, as in Figma', () => {
    expect(statsCardHeight(874)).toBe(590);
    expect(statsCardHeight(932)).toBe(629);
  });

  it('never gets shorter than the tallest card needs, even on a short phone', () => {
    expect(statsCardHeight(667)).toBe(584);
  });

  it('scrolls past the card, its ticks and the gap under them before the entries are at full strength', () => {
    expect(statsScrollDistance(874)).toBe(590 + 14 + 24 + 32);
  });
});
