import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import FridgeScreen from '@/app/fridge';
import { createTestDb } from '@/db/__tests__/testDb';
import { listFridgeItems, replaceFridge } from '@/db/repositories/fridgeItems';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { pickFoodPhoto } from '@/services/photoPicker';
import { scanFridge } from '@/services/relayClient';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
jest.mock('@/services/relayClient', () => ({ scanFridge: jest.fn() }));
jest.mock('@/services/photoPicker', () => ({ pickFoodPhoto: jest.fn() }));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), push: jest.fn() } }));

const scan = scanFridge as jest.Mock;
const pick = pickFoodPhoto as jest.Mock;

const press = async (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** Taps the + tile and picks "Choose from photos" in the system action list. */
async function addLibraryPhoto(uri: string) {
  pick.mockResolvedValueOnce({ status: 'ok', photo: { uri, width: 10, height: 10 } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await press('Add a photo');
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => buttons.find((button) => button.text === 'Choose from photos')?.onPress?.());
  alert.mockRestore();
}

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  scan.mockReset();
  pick.mockReset();
});
afterEach(() => closeDb());

describe('My fridge: with nothing saved', () => {
  it('asks for photos, and Find ingredients waits for the first one', async () => {
    await render(<FridgeScreen />);

    expect(screen.getByRole('header', { name: 'My fridge' })).toBeTruthy();
    expect(screen.getByText('Snap a photo or two of your shelves.')).toBeTruthy();
    expect(screen.getByText('Photos are only used to find ingredients.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find ingredients' })).toBeDisabled();

    await addLibraryPhoto('file:///one.jpg');

    expect(screen.getByLabelText('Photo 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find ingredients' })).toBeEnabled();
  });

  it('takes at most three photos', async () => {
    await render(<FridgeScreen />);
    await addLibraryPhoto('file:///1.jpg');
    await addLibraryPhoto('file:///2.jpg');
    await addLibraryPhoto('file:///3.jpg');

    expect(screen.queryByRole('button', { name: 'Add a photo' })).toBeNull();
  });

  it('lets a photo be taken out again', async () => {
    await render(<FridgeScreen />);
    await addLibraryPhoto('file:///1.jpg');
    await press('Remove photo 1');

    expect(screen.queryByLabelText('Photo 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Find ingredients' })).toBeDisabled();
  });

  it('says why when the camera is off', async () => {
    pick.mockResolvedValueOnce({ status: 'denied' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<FridgeScreen />);
    await press('Add a photo');
    const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === 'Take a photo')?.onPress?.());
    alert.mockRestore();

    expect(screen.getByText(/Camera access is off/)).toBeTruthy();
  });

  it('sends the photos, saves what Bellie found and shows the list', async () => {
    scan.mockResolvedValue(['eggs', 'rice', 'Kimchi', 'eggs']);
    await render(<FridgeScreen />);
    await addLibraryPhoto('file:///one.jpg');
    await addLibraryPhoto('file:///two.jpg');
    await press('Find ingredients');

    await waitFor(() => expect(screen.getByText('Bellie found 3 items')).toBeTruthy());
    expect(scan.mock.calls[0]?.[0]).toEqual(['file:///one.jpg', 'file:///two.jpg']);
    expect(listFridgeItems(mockDb).map((item) => item.name)).toEqual(['eggs', 'Kimchi', 'rice']);
    expect(screen.getByText('Updated today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add more photos' })).toBeTruthy();
  });

  it('says it could not read the photos when none of them held food, and saves nothing', async () => {
    scan.mockResolvedValue([]);
    await render(<FridgeScreen />);
    await addLibraryPhoto('file:///one.jpg');
    await press('Find ingredients');

    await waitFor(() => expect(screen.getByText("Couldn't read the photos")).toBeTruthy());
    expect(screen.getByText('Try again, with the fridge door open and good light.')).toBeTruthy();
    expect(listFridgeItems(mockDb)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('says it found nothing new when every item is already in the fridge', async () => {
    replaceFridge(mockDb, ['milk', 'eggs']);
    scan.mockResolvedValue(['Milk', 'eggs']);
    await render(<FridgeScreen />);
    await press('Add more photos');
    await addLibraryPhoto('file:///one.jpg');
    await press('Find ingredients');

    await waitFor(() => expect(screen.getByText("Couldn't read the photos")).toBeTruthy());
    expect(listFridgeItems(mockDb).map((item) => item.name)).toEqual(['eggs', 'milk']);
  });

  it('keeps the old list when a scan fails, and says why', async () => {
    replaceFridge(mockDb, ['milk']);
    scan.mockRejectedValue(new AppError('RATE_LIMITED'));
    await render(<FridgeScreen />);
    await press('Add more photos');
    await addLibraryPhoto('file:///one.jpg');
    await press('Find ingredients');

    await waitFor(() =>
      expect(screen.getByText("That's enough fridge scans for today. Try again tomorrow.")).toBeTruthy(),
    );
    expect(listFridgeItems(mockDb).map((item) => item.name)).toEqual(['milk']);
  });
});

describe('My fridge: with a saved list', () => {
  beforeEach(() => replaceFridge(mockDb, ['eggs', 'rice']));

  it('opens on the list, with no manual add', async () => {
    await render(<FridgeScreen />);

    expect(screen.getByText('Bellie found 2 items')).toBeTruthy();
    expect(screen.getByText('Updated today')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove eggs' })).toBeTruthy();
    expect(screen.queryByText(/not quite right/i)).toBeNull();
    expect(screen.queryByText(/photos are only used/i)).toBeNull();
    expect(screen.queryByText(/add your own/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a photo' })).toBeNull();
  });

  it('removes an item with its ×', async () => {
    await render(<FridgeScreen />);
    await press('Remove eggs');

    expect(screen.queryByRole('button', { name: 'Remove eggs' })).toBeNull();
    expect(screen.getByText('Bellie found 1 item')).toBeTruthy();
    expect(listFridgeItems(mockDb).map((item) => item.name)).toEqual(['rice']);
  });

  it('asks for new photos once the last item is removed', async () => {
    await render(<FridgeScreen />);
    await press('Remove eggs');
    await press('Remove rice');

    expect(screen.getByText('Snap a photo or two of your shelves.')).toBeTruthy();
  });

  it('Done goes back to the Kitchen', async () => {
    await render(<FridgeScreen />);
    await press('Done');

    expect(mockBack).toHaveBeenCalled();
  });

  it('Add more photos adds what it finds to the list and skips a name already there', async () => {
    scan.mockResolvedValue(['Rice', 'corn']);
    await render(<FridgeScreen />);
    await press('Add more photos');
    await addLibraryPhoto('file:///shelf.jpg');
    await press('Find ingredients');

    await waitFor(() => expect(screen.getByText('Bellie found 3 items')).toBeTruthy());
    expect(listFridgeItems(mockDb).map((item) => item.name)).toEqual(['corn', 'eggs', 'rice']);
  });

  it('Add more photos opens the photo step, and Back from there returns to the list', async () => {
    await render(<FridgeScreen />);
    await press('Add more photos');
    expect(screen.getByText('Snap a photo or two of your shelves.')).toBeTruthy();

    await press('Back');
    expect(screen.getByText('Bellie found 2 items')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await press('Back');
    expect(mockBack).toHaveBeenCalled();
  });
});
