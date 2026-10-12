import { tabBarHeight } from '../FloatingTabBar';
import { CARD_MIN_HEIGHT, statsCardHeight, statsScrollDistance } from '../HistorySummary';

describe('stats card size', () => {
  it('fills the list from under the title and controls down to 32 above the tab bar', () => {
    // List 830 tall, 148 taken by the title and controls, a 34 home indicator: a 90 bar, then a 32 gap.
    expect(statsCardHeight(830, 148, 34)).toBe(830 - 148 - (90 + 32));
  });

  it('gives the bar 16 under its icons when the phone has no home indicator', () => {
    expect(tabBarHeight(0)).toBe(72);
    expect(statsCardHeight(830, 148, 0)).toBe(830 - 148 - (72 + 32));
  });

  it('never gets shorter than the tallest card needs, and is that tall before the list is measured', () => {
    expect(statsCardHeight(400, 148, 34)).toBe(CARD_MIN_HEIGHT);
    expect(statsCardHeight(0, 0, 0)).toBe(CARD_MIN_HEIGHT);
  });

  it('scrolls past the card and the gap under it before the entries are at full strength', () => {
    expect(statsScrollDistance(540)).toBe(540 + 32);
  });
});
