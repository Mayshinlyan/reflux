import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';

import { AvatarSheet } from '@/components/profile/AvatarSheet';

const mockUpdate = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({
  useSettings: () => ({ settings: { avatar: 'initial', userName: 'May' }, update: mockUpdate }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

const atWidth = (width: number) =>
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });

const optionSize = () => {
  const style = StyleSheet.flatten(screen.getAllByRole('radio')[0]!.props.style);
  return [style.width, style.height];
};

describe('AvatarSheet', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps 72pt circles on a normal phone', async () => {
    atWidth(390);
    await render(<AvatarSheet visible onClose={jest.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    expect(optionSize()).toEqual([72, 72]);
  });

  it('shrinks the circles so four still fit on a 320pt phone', async () => {
    atWidth(320);
    await render(<AvatarSheet visible onClose={jest.fn()} />);
    expect(optionSize()).toEqual([61, 61]);
  });

  it('saves the tapped avatar and closes', async () => {
    atWidth(390);
    const onClose = jest.fn();
    await render(<AvatarSheet visible onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Moon avatar'));
    expect(mockUpdate).toHaveBeenCalledWith('avatar', 'moon');
    expect(onClose).toHaveBeenCalled();
  });
});
