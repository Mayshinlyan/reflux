import { tabBarBottomOffset } from '../FloatingTabBar';
import { CARD_MIN_HEIGHT, statsCardHeight, statsScrollDistance } from '../HistorySummary';

describe('stats card size', () => {
  it('fills the list from under the title and controls down to 16 above the tab bar', () => {
    // List 796 tall, 148 taken by the title and controls, a 34 home indicator: bar 34 + 60 up, 16 gap.
    expect(statsCardHeight(796, 148, 34)).toBe(796 - 148 - (34 + 60 + 16));
  });

  it('leaves the bar its 16 when the phone has no home indicator', () => {
    expect(tabBarBottomOffset(0)).toBe(16);
    expect(statsCardHeight(796, 148, 0)).toBe(796 - 148 - (16 + 60 + 16));
  });

  it('never gets shorter than the tallest card needs, and is that tall before the list is measured', () => {
    expect(statsCardHeight(400, 148, 34)).toBe(CARD_MIN_HEIGHT);
    expect(statsCardHeight(0, 0, 0)).toBe(CARD_MIN_HEIGHT);
  });

  it('scrolls past the card and the gap under it before the entries are at full strength', () => {
    expect(statsScrollDistance(540)).toBe(540 + 32);
  });
});
