import { tabBarHeight } from '../FloatingTabBar';
import { CARD_MIN_HEIGHT, statsCardHeight, statsScrollDistance } from '../HistorySummary';

// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

describe('stats card size', () => {
  it('fills the list from under the title and controls down to the row of dots above the tab bar', () => {
    // List 830 tall, 148 taken by the title and controls, a 34 home indicator: an 86 pill and its gap, an 8 gap, and the 44 row of dots.
    expect(statsCardHeight(830, 148, 34)).toBe(830 - 148 - (86 + 8 + 44));
  });

  it('floats the pill 16 above the edge when the phone has no home indicator', () => {
    expect(tabBarHeight(0)).toBe(80);
    expect(statsCardHeight(830, 148, 0)).toBe(830 - 148 - (80 + 8 + 44));
  });

  it('never gets shorter than the least a card needs, and is that tall before the list is measured', () => {
    expect(statsCardHeight(400, 148, 34)).toBe(CARD_MIN_HEIGHT);
    expect(statsCardHeight(0, 0, 0)).toBe(CARD_MIN_HEIGHT);
  });

  it('scrolls past the card, its dots and the gap under them before the entries are at full strength', () => {
    expect(statsScrollDistance(540)).toBe(540 + 44 + 32);
  });
});
