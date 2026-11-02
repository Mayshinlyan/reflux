import { render, screen } from '@testing-library/react-native';

import KitchenScreen from '@/app/(tabs)/kitchen';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

describe('Kitchen', () => {
  it('has its title and a note that recipe ideas are coming', async () => {
    await render(<KitchenScreen />);

    expect(screen.getByRole('header', { name: 'Kitchen' })).toBeTruthy();
    expect(screen.getByText('What shall we cook?')).toBeTruthy();
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
