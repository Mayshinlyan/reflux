import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Alert, type AlertButton } from 'react-native';
import { router } from 'expo-router';

import EntryScreen from '@/app/entry/index';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, getFoodLog, saveMealDetails, updateFoodLog } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { saveFoodFromLog } from '@/db/repositories/savedFoods';
import { createSymptomLog, getSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
let mockSqlite: ReturnType<typeof createTestDb>['sqlite'];
let mockParams: Record<string, string> = {};

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180 },
    update: jest.fn(),
  }),
}));
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
const mockToast = jest.fn();
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

// Saturday 10 Oct 2026, local noon. Only the clock is faked.
const NOW = new Date(2026, 9, 10, 12, 0);

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'performance',
      'hrtime',
    ],
  });
  const { db, sqlite } = createTestDb();
  mockDb = db;
  mockSqlite = sqlite;
  closeDb = () => sqlite.close();
  mockParams = {};
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
  mockToast.mockClear();
});
afterEach(() => {
  closeDb();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

const seedTacos = (loggedAt = at(10, 19, 45)) =>
  createFoodLog(mockDb, {
    entryType: 'diary',
    source: 'text',
    inputText: 'spicy chicken tacos',
    loggedAt,
    analysis: {
      isFood: true,
      mealName: 'Spicy chicken tacos',
      items: [
        {
          name: 'Tacos',
          ingredients: [{ name: 'chili', matchedCategories: ['spicy'] }],
          verdict: 'caution',
          reasoning: 'Chili can irritate.',
          matchedTriggers: [{ category: 'spicy', evidence: 'chili' }],
        },
      ],
      overall: { verdict: 'caution', confidence: 'medium', reasoning: 'Chili can irritate.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

describe('Entry: a meal', () => {
  it('shows the verdict, name, when, tags, details, symptoms after and note', async () => {
    const id = seedTacos();
    saveMealDetails(mockDb, id, { portion: 'large', tags: ['large_meal'], notes: 'Felt fine until later.' });
    createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }, { key: 'burping' }],
      foodLogId: id,
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByLabelText('Caution')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Spicy chicken tacos' })).toBeTruthy();
    expect(screen.getByText('Sat, Oct 10 · 7:45 PM')).toBeTruthy();
    // Lifestyle tags, matched triggers, and Late meal (7:45 PM is within 3 hours of 10:30 PM).
    expect(screen.getByText('Large meal')).toBeTruthy();
    expect(screen.getByText('Spicy')).toBeTruthy();
    expect(screen.getByText('Late meal')).toBeTruthy();
    expect(screen.getByText('Large')).toBeTruthy();
    expect(screen.getByText('Saved to My foods')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.getByText('Symptoms')).toBeTruthy();
    expect(screen.getByText('Heartburn')).toBeTruthy();
    expect(screen.getByText('Burping')).toBeTruthy();
    expect(screen.getByText('Logged at 9:40 PM')).toBeTruthy();
    expect(screen.getByText('Felt fine until later.')).toBeTruthy();
  });

  it('says Yes once the meal is in My foods', async () => {
    const id = seedTacos();
    saveFoodFromLog(mockDb, id);
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByText('Yes')).toBeTruthy();
  });

  it('leaves out the symptoms, note and tags cards when there is nothing to show', async () => {
    const id = seedTacos(at(10, 8, 0));
    updateFoodLog(mockDb, id, { name: 'Oatmeal' });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByText('Symptoms')).toBeNull();
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.queryByText('Late meal')).toBeNull();
    expect(screen.getByText('Regular')).toBeTruthy();
  });

  it('shows a meal saved without a verdict with no badge', async () => {
    const id = seedTacos();
    mockSqlite.exec('UPDATE food_logs SET overall_verdict = NULL, analysis = NULL, analysis_meta = NULL');
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByLabelText('Caution')).toBeNull();
    expect(screen.getByRole('header', { name: 'Spicy chicken tacos' })).toBeTruthy();
  });
});

describe('Entry: a symptom entry', () => {
  it('shows what was felt, the tags, the meal it followed and the note', async () => {
    const mealId = seedTacos();
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }, { key: 'burping' }],
      tags: ['stress'],
      notes: 'Worse lying down.',
      foodLogId: mealId,
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByRole('header', { name: 'Heartburn, Burping' })).toBeTruthy();
    expect(screen.getByText('Sat, Oct 10 · 9:40 PM')).toBeTruthy();
    expect(screen.getByText('Stress')).toBeTruthy();
    expect(screen.getByText('After Spicy chicken tacos')).toBeTruthy();
    expect(screen.getByText('Worse lying down.')).toBeTruthy();
  });

  it('names a lifestyle-only check-in by its factors, with no symptoms or possibly related card', async () => {
    const id = createSymptomLog(mockDb, {
      items: [],
      tags: ['stress', 'custom:Skipped breakfast'],
      notes: 'Rushed morning.',
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByRole('header', { name: 'Stress, Skipped breakfast' })).toBeTruthy();
    expect(screen.getByText('Sat, Oct 10 · 9:40 PM')).toBeTruthy();
    // The factors name the entry, so they are not repeated as tag chips under the date.
    expect(screen.queryAllByText('Stress')).toHaveLength(0);
    expect(screen.queryByText('Symptoms')).toBeNull();
    expect(screen.queryByText('Possibly related')).toBeNull();
    expect(screen.getByText('Rushed morning.')).toBeTruthy();
  });

  it('shows what is possibly related, worked out from the meal it followed', async () => {
    const mealId = seedTacos();
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      foodLogId: mealId,
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByText('Possibly related')).toBeTruthy();
    expect(screen.getByText('Spicy chicken tacos, 2 hours before')).toBeTruthy();
    expect(screen.getByText('A late meal, 3 hours before bed')).toBeTruthy();
    expect(screen.getByText(/Not a diagnosis/)).toBeTruthy();
  });

  it('has no possibly related card when no meal was linked, and shows a typed tag as its own text', async () => {
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'custom:Hiccups' }],
      tags: ['custom:Skipped breakfast'],
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByText('Possibly related')).toBeNull();
    expect(screen.getByText('Skipped breakfast')).toBeTruthy();
    expect(screen.getAllByText('Hiccups').length).toBeGreaterThan(0);
  });
});

describe('Entry: a dose', () => {
  it('shows the medicine, when it was taken and its type', async () => {
    const medId = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });
    const id = logMedication(mockDb, medId, { takenAt: at(10, 8, 30) });
    mockParams = { kind: 'medication', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByRole('header', { name: 'Omeprazole 20mg' })).toBeTruthy();
    expect(screen.getByText('Sat, Oct 10 · 8:30 AM')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('PPI')).toBeTruthy();
  });
});

describe('Entry: the menu', () => {
  const openMenu = async () => fireEvent.press(screen.getByRole('button', { name: 'More' }));

  it('offers Edit entry and Delete entry', async () => {
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByRole('menu')).toBeNull();
    await openMenu();

    expect(screen.getByRole('menuitem', { name: 'Edit entry' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Delete entry' })).toBeTruthy();
  });

  it('closes when the page behind it is tapped', async () => {
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('button', { name: 'Close menu' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the editor for a meal or a dose', async () => {
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Edit entry' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/entry/edit',
      params: { kind: 'food', id: String(id) },
    });
  });

  it('opens the symptoms screen for a symptom entry', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Edit entry' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/log/symptoms', params: { id: String(id) } });
  });

  it('asks before deleting, and Cancel keeps the entry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete this entry?');
    pressAlertButton(alert, 'Cancel');

    expect(getFoodLog(mockDb, id)).toBeDefined();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('drops a meal’s check-in reminder when the meal is deleted, but not for other entries', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
    const symptomId = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(symptomId) };
    const { unmount } = await render(<EntryScreen />);
    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    await act(async () => pressAlertButton(alert, 'Delete'));
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    await unmount();

    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);
    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`meal-${id}`);
  });

  it('deletes the entry once confirmed and goes back to History', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(getSymptomLog(mockDb, id)).toBeUndefined();
    expect(mockToast).toHaveBeenLastCalledWith('Entry deleted');
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Entry: one that is not there', () => {
  it('explains, and goes back to History', async () => {
    mockParams = { kind: 'food', id: '999' };
    await render(<EntryScreen />);

    expect(screen.getByText("This entry isn't here any more")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to History' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('treats a malformed link the same way', async () => {
    mockParams = { kind: 'banana', id: 'x' };
    await render(<EntryScreen />);

    expect(screen.getByText("This entry isn't here any more")).toBeTruthy();
  });

  it('does not show a food check, which is not part of the diary', async () => {
    const id = createFoodLog(mockDb, {
      entryType: 'check',
      source: 'text',
      analysis: {
        isFood: true,
        mealName: 'Mint tea',
        items: [],
        overall: { verdict: 'caution', confidence: 'high', reasoning: 'Mint.' },
      },
      meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByText("This entry isn't here any more")).toBeTruthy();
  });
});
