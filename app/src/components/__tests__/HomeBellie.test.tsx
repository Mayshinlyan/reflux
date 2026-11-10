import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { HomeBellie } from '../HomeBellie';

const mockJiggle = {
  style: {},
  reduceMotion: false,
  pressIn: jest.fn(),
  pressOut: jest.fn(),
  play: jest.fn(),
};

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('@/hooks/useBellyJiggle', () => ({ useBellyJiggle: () => mockJiggle }));
// The tour code behind Bellie's spotlight reaches for the router, which can't load in Jest.
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('../Belly', () => ({ Belly: () => null }));
jest.mock('../SpeechBubble', () => ({ SpeechBubble: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const bellie = () => screen.getByRole('button', { name: 'Log' });

beforeEach(() => {
  jest.clearAllMocks();
  mockJiggle.reduceMotion = false;
});

describe('HomeBellie', () => {
  it('presses on the tap itself, with the jiggle playing as it opens', async () => {
    const onPress = jest.fn();
    await render(<HomeBellie line="Tap me to log" mood="happy" onPress={onPress} />);

    await fireEvent.press(bellie());

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockJiggle.play).toHaveBeenCalledTimes(1);
  });

  it('taps on touch-down, with the squash, not on release', async () => {
    const onPress = jest.fn();
    await render(<HomeBellie line="Tap me to log" mood="happy" onPress={onPress} />);

    await fireEvent(bellie(), 'pressIn', { nativeEvent: { locationX: 10, locationY: 10 } });

    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(mockJiggle.pressIn).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('still taps with Reduce Motion on, because a haptic is not motion', async () => {
    mockJiggle.reduceMotion = true;
    await render(<HomeBellie line="Tap me to log" mood="happy" onPress={jest.fn()} />);

    await fireEvent(bellie(), 'pressIn', { nativeEvent: { locationX: 10, locationY: 10 } });

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});
