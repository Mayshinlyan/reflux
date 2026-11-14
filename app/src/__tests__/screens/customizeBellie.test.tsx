import { fireEvent, render, screen } from '@testing-library/react-native';

import CustomizeBellieScreen from '@/app/bellies-things';
import { createTestDb } from '@/db/__tests__/testDb';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockParams: { preview?: string; gift?: string } = {};

// A small stand-in for the real provider's settings hook, backed by the real repository, so a save re-renders.
const mockListeners = new Set<() => void>();
jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect, useReducer } = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const repo = require('@/db/repositories/settings');
    const [, rerender] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      mockListeners.add(rerender);
      return () => void mockListeners.delete(rerender);
    }, []);
    return {
      settings: repo.getAllSettings(mockDb),
      reload: () => mockListeners.forEach((listener) => listener()),
      update: (key: string, value: unknown) => {
        repo.setSetting(mockDb, key, value);
        mockListeners.forEach((listener) => listener());
      },
    };
  },
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockParams = {};
});
afterEach(() => closeDb());

const tile = (name: string | RegExp) => screen.getByRole('button', { name });
const worn = () => getSetting(mockDb, 'bellieWorn');

describe('Customize Bellie', () => {
  it('starts with everything locked, each saying how many more check-in days it needs', async () => {
    await render(<CustomizeBellieScreen />);

    expect(screen.getByRole('header', { name: 'Customize Bellie' })).toBeTruthy();
    expect(tile('Round glasses, locked, unlock after 3 more days of check-in')).toBeTruthy();
    expect(tile('Scarf, locked, unlock after 30 more days of check-in')).toBeTruthy();
    expect(tile('Chef hat, locked, unlock after 50 more days of check-in')).toBeTruthy();
    expect(screen.getByText('3 more days')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Take it all off' })).toBeNull();
  });

  it('says in full, under the row, what the next locked item needs, and what a tapped one needs', async () => {
    mockParams = { preview: '12' };
    await render(<CustomizeBellieScreen />);

    expect(screen.getByText('Unlock after 2 more days of check-in')).toBeTruthy();

    await fireEvent.press(tile('Scarf, locked, unlock after 18 more days of check-in'));
    expect(screen.getByText('Unlock after 18 more days of check-in')).toBeTruthy();
    expect(worn()).toEqual([]);
  });

  it('lists what you own first, then the locked ones soonest first', async () => {
    mockParams = { preview: '12' };
    await render(<CustomizeBellieScreen />);

    const names = screen
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel as string)
      .filter((label) => /hat|glasses|scarf|bow|phones|cap/i.test(label));
    expect(names).toEqual([
      'Little hat',
      'Round glasses',
      'Bow tie',
      'Sunglasses, locked, unlock after 2 more days of check-in',
      'Headphones, locked, unlock after 9 more days of check-in',
      'Scarf, locked, unlock after 18 more days of check-in',
      'Nightcap, locked, unlock after 33 more days of check-in',
      'Chef hat, locked, unlock after 38 more days of check-in',
    ]);
  });

  it('puts things on and takes them off, saved at once, and stacks different spots', async () => {
    mockParams = { preview: '60' };
    await render(<CustomizeBellieScreen />);

    await fireEvent.press(tile('Little hat'));
    expect(worn()).toEqual(['hat']);
    expect(tile('Little hat').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(tile('Round glasses'));
    await fireEvent.press(tile('Scarf'));
    expect(worn()).toEqual(['hat', 'glasses', 'scarf']);

    await fireEvent.press(tile('Little hat'));
    expect(worn()).toEqual(['glasses', 'scarf']);
  });

  it('swaps what shared a spot: the chef hat takes the hat off, headphones go with any hat', async () => {
    mockParams = { preview: '60' };
    await render(<CustomizeBellieScreen />);

    await fireEvent.press(tile('Little hat'));
    await fireEvent.press(tile('Chef hat'));
    expect(worn()).toEqual(['chef']);
    expect(tile('Little hat').props.accessibilityState).toMatchObject({ selected: false });

    await fireEvent.press(tile('Headphones'));
    expect(worn()).toEqual(['chef', 'phones']);
  });

  it('takes everything off with one tap, and only offers it while something is on', async () => {
    mockParams = { preview: '60' };
    await render(<CustomizeBellieScreen />);
    expect(screen.queryByRole('button', { name: 'Take it all off' })).toBeNull();

    await fireEvent.press(tile('Bow tie'));
    await fireEvent.press(tile('Sunglasses'));
    await fireEvent.press(tile('Take it all off'));

    expect(worn()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Take it all off' })).toBeNull();
  });

  it('shows a gift box in place of an item until its gift has been opened', async () => {
    mockParams = { preview: '8', gift: '1' };
    setSetting(mockDb, 'giftsSeen', [3]);
    await render(<CustomizeBellieScreen />);

    // Round glasses were opened; the bow tie (day 7) is still a gift box.
    expect(tile('Round glasses')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A gift from Bellie, tap to open' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bow tie' })).toBeNull();
  });

  it('shows the item itself once its gift has been opened', async () => {
    setSetting(mockDb, 'giftsSeen', [3, 7]);
    mockParams = { preview: '8', gift: '1' };
    await render(<CustomizeBellieScreen />);

    expect(screen.queryByRole('button', { name: 'A gift from Bellie, tap to open' })).toBeNull();
    expect(tile('Bow tie')).toBeTruthy();
  });

  it('does nothing to what Bellie wears for a locked item', async () => {
    mockParams = { preview: '5' };
    await render(<CustomizeBellieScreen />);

    await fireEvent.press(tile('Chef hat, locked, unlock after 45 more days of check-in'));

    expect(worn()).toEqual([]);
  });

  it('wears the hat saved the old way, and folds it into the list when it is taken off', async () => {
    setSetting(mockDb, 'bellieHat', true);
    mockParams = { preview: '12' };
    await render(<CustomizeBellieScreen />);
    expect(tile('Little hat').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(tile('Little hat'));

    expect(worn()).toEqual([]);
    expect(getSetting(mockDb, 'bellieHat')).toBe(false);
    expect(tile('Little hat').props.accessibilityState).toMatchObject({ selected: false });
  });
});
