import { Platform } from 'react-native';

import { createTestDb } from '@/db/__tests__/testDb';
import { createSavedFood } from '@/db/repositories/savedFoods';
import { getSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { logger } from '@/lib/logger';

import { ensureWidgetToken, syncWidget } from '../widgetSync';

const mockUpdateSnapshot = jest.fn();
let mockDirectory: string | null = 'file:///widgets/';

jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('expo-widgets', () => ({
  get widgetsDirectory() {
    return mockDirectory;
  },
}));
jest.mock('@/widgets/FoodWidget', () => ({
  __esModule: true,
  default: { updateSnapshot: (...args: unknown[]) => mockUpdateSnapshot(...args) },
}));
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: () => Promise.resolve(), localUri: 'file:///cache/bellie-says.png' }),
  },
}));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(base: string, name?: string) {
      this.uri = name ? `${base}${name}` : base;
    }
    get exists() {
      return false;
    }
    copy() {}
    delete() {}
  },
}));

let db: AppDb;
let close: () => void;

beforeEach(() => {
  const test = createTestDb();
  db = test.db;
  close = () => test.sqlite.close();
  mockUpdateSnapshot.mockClear();
  mockDirectory = 'file:///widgets/';
});
afterEach(() => close());

describe('ensureWidgetToken', () => {
  it('makes a token once and keeps it', () => {
    const token = ensureWidgetToken(db);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(ensureWidgetToken(db)).toBe(token);
    expect(getSetting(db, 'widgetToken')).toBe(token);
  });
});

describe('syncWidget', () => {
  it('gives the widget Bellie, the first three saved foods and the token', async () => {
    for (const name of ['Oatmeal', 'Chicken', 'Smoothie', 'Toast']) createSavedFood(db, name);

    await syncWidget(db);

    expect(mockUpdateSnapshot).toHaveBeenCalledTimes(1);
    const snapshot = mockUpdateSnapshot.mock.calls[0][0];
    expect(snapshot.art).toBe('file:///widgets/bellie-says.png');
    expect(snapshot.foods.map((food: { name: string }) => food.name)).toEqual([
      'Chicken',
      'Oatmeal',
      'Smoothie',
    ]);
    expect(snapshot.token).toBe(getSetting(db, 'widgetToken'));
  });

  it('shows no foods when none are saved', async () => {
    await syncWidget(db);
    expect(mockUpdateSnapshot.mock.calls[0][0].foods).toEqual([]);
  });

  it('keeps the same token on every sync', async () => {
    await syncWidget(db);
    await syncWidget(db);
    expect(mockUpdateSnapshot.mock.calls[1][0].token).toBe(mockUpdateSnapshot.mock.calls[0][0].token);
  });

  it('does nothing without an App Group folder', async () => {
    mockDirectory = null;
    await syncWidget(db);
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
  });

  it('does nothing off iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await syncWidget(db);
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('does not throw when the widget refuses the update, and logs only a code', async () => {
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {});
    mockUpdateSnapshot.mockImplementationOnce(() => {
      throw new Error('no widget host');
    });
    await expect(syncWidget(db)).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith('syncWidget', expect.objectContaining({ code: 'INTERNAL' }));
  });
});
