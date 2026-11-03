import { LOG_BUTTON_RAISE, tabBarHeight } from '../FloatingTabBar';
import { CARD_MIN_HEIGHT, statsCardHeight } from '../HistorySummary';

// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

describe('stats card size', () => {
  it('is one fixed height: from under the title and controls down to a gap above the Log button', () => {
    // List 830 tall, 148 taken by the title and controls, a 34 home indicator: an 86 pill and its gap, the 20 the Log
    // button rises over the pill, and a 16 gap.
    expect(statsCardHeight(830, 148, 34)).toBe(830 - 148 - (86 + 20 + 16));
  });

  it('floats the pill 16 above the edge when the phone has no home indicator', () => {
    expect(tabBarHeight(0)).toBe(80);
    expect(statsCardHeight(830, 148, 0)).toBe(830 - 148 - (80 + 20 + 16));
  });

  it('never runs under the tab bar or the Log button that rises over it', () => {
    for (const inset of [0, 20, 34]) {
      const height = statsCardHeight(830, 148, inset);
      const cardBottom = 148 + height;
      const logButtonTop = 830 - tabBarHeight(inset) - LOG_BUTTON_RAISE;
      expect(cardBottom).toBeLessThanOrEqual(logButtonTop);
    }
  });

  it('never gets shorter than the least a card needs, and is that tall before the list is measured', () => {
    expect(statsCardHeight(400, 148, 34)).toBe(CARD_MIN_HEIGHT);
    expect(statsCardHeight(0, 0, 0)).toBe(CARD_MIN_HEIGHT);
  });
});
