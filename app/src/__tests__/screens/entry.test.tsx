import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import EntryScreen from '@/app/entry/index';
import { createTestDb } from '@/db/__tests__/testDb';
import {
  createFoodLog,
  createUncheckedMeal,
  getFoodLog,
  saveMealDetails,
  setMealAnalysis,
  updateFoodLog,
} from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { createSavedFood, isFoodSaved } from '@/db/repositories/savedFoods';
import { createSymptomLog, getSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { notifyEntriesChanged } from '@/lib/entriesChanged';

let mockDb: AppDb;
let closeDb: () => void;
let mockSqlite: ReturnType<typeof createTestDb>['sqlite'];
let mockParams: Record<string, string> = {};

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180, checkInReminderMinutes: null },
    update: jest.fn(),
  }),
}));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
// Reanimated's native runtime can't load in Jest; use its mocks (which lack useReducedMotion).
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
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
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
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

const seedTacos = (loggedAt = at(10, 19, 45), advice: { summary?: string; tip?: string } = {}) =>
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
      overall: { verdict: 'caution', confidence: 'medium', reasoning: 'Chili can irritate.', ...advice },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

describe('Entry: a meal', () => {
  it('has a back arrow, not a close X, because it pushes in from the side', async () => {
    mockParams = { kind: 'food', id: String(seedTacos()) };
    await render(<EntryScreen />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('shows the name and when, then the verdict, the tags they picked, symptoms after and note', async () => {
    const id = seedTacos();
    saveMealDetails(mockDb, id, { portion: 'large', tags: ['large_meal'], notes: 'Felt fine until later.' });
    createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }, { key: 'burping' }],
      foodLogId: id,
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    // Bellie and the badge say the verdict; there is no speech bubble repeating it.
    expect(screen.queryByRole('header', { name: 'Your belly might not love this.' })).toBeNull();
    expect(screen.getByLabelText('Belly feels cautious')).toBeTruthy();
    expect(screen.getByLabelText('Caution')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Spicy chicken tacos' })).toBeTruthy();
    // Just when it was eaten: no portion, which can't be set anywhere.
    expect(screen.getByText('Sat, Oct 10 · 7:45 PM')).toBeTruthy();
    expect(screen.queryByText(/portion/i)).toBeNull();
    // Only the tags they picked; the matched triggers and Late meal live under "Why?".
    expect(screen.getByText('Large meal')).toBeTruthy();
    expect(screen.queryByText('Spicy')).toBeNull();
    expect(screen.queryByText('Late meal')).toBeNull();
    expect(screen.getByText('Symptoms')).toBeTruthy();
    expect(screen.getByText('Heartburn')).toBeTruthy();
    expect(screen.getByText('Burping')).toBeTruthy();
    // The time is already under the title, so it is not repeated under the symptoms.
    expect(screen.queryByText(/Logged at/)).toBeNull();
    expect(screen.getByText('Felt fine until later.')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('shows the AI summary, and the tip and the reasons in an open "Why?"', async () => {
    const id = seedTacos(at(10, 19, 45), {
      summary: 'Spicy and acidic, and eaten close to bedtime.',
      tip: 'Try a milder salsa, or have it earlier.',
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByText('Spicy and acidic, and eaten close to bedtime.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Why?' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByText('Better next time')).toBeTruthy();
    expect(screen.getByText('Try a milder salsa, or have it earlier.')).toBeTruthy();
    expect(screen.getByText('Chili can irritate.')).toBeTruthy();
    expect(screen.getByText(/Key ingredients:\s*chili/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Why?' }));

    expect(screen.queryByText('Better next time')).toBeNull();
    expect(screen.queryByText('Chili can irritate.')).toBeNull();
  });

  it('leaves out the tip when the meal was checked before tips existed', async () => {
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByText('Better next time')).toBeNull();
    expect(screen.getByText('Chili can irritate.')).toBeTruthy();
  });

  it('leaves out the symptoms, note and tags when there is nothing to show', async () => {
    const id = seedTacos(at(10, 8, 0));
    updateFoodLog(mockDb, id, { name: 'Oatmeal' });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.queryByText('Symptoms')).toBeNull();
    expect(screen.queryByText('Note')).toBeNull();
    expect(screen.queryByText('Late meal')).toBeNull();
    expect(screen.getByText('Sat, Oct 10 · 8:00 AM')).toBeTruthy();
  });

  it('saves the meal to favorite foods with the heart, and takes it out with a second tap', async () => {
    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add to favorite foods' }));
    expect(isFoodSaved(mockDb, 'Spicy chicken tacos')).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove from favorite foods' }));
    expect(isFoodSaved(mockDb, 'Spicy chicken tacos')).toBe(false);
    expect(screen.getByRole('button', { name: 'Add to favorite foods' })).toBeTruthy();
  });

  it('shows the heart filled when the meal is already a favorite, with no Saved row', async () => {
    const id = seedTacos();
    mockSqlite.exec('UPDATE food_logs SET overall_verdict = NULL, analysis = NULL, analysis_meta = NULL');
    createSavedFood(mockDb, 'Spicy chicken tacos');
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByRole('button', { name: 'Remove from favorite foods' })).toBeTruthy();
    expect(screen.queryByText('Saved to favorite foods')).toBeNull();
    expect(screen.queryByText('Portion')).toBeNull();
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

  it('keeps what is possibly related behind a closed row, worked out from the meal it followed', async () => {
    const mealId = seedTacos();
    const id = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      foodLogId: mealId,
      loggedAt: at(10, 21, 40),
    });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByText('Possibly related')).toBeTruthy();
    expect(screen.queryByText('Spicy chicken tacos, 2 hours before')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Possibly related' }));
    expect(screen.getByText('Spicy chicken tacos, 2 hours before')).toBeTruthy();
    expect(screen.getByText('A late meal, 3 hours before bed')).toBeTruthy();
    expect(screen.queryByText(/Not a diagnosis/)).toBeNull();
    // A second press closes it again.
    await fireEvent.press(screen.getByRole('button', { name: 'Possibly related' }));
    expect(screen.queryByText('Spicy chicken tacos, 2 hours before')).toBeNull();
    // The symptom is the title and Bellie shows the meal it followed; it is not listed again as a chip card.
    expect(screen.queryByText('Symptoms')).toBeNull();
    expect(screen.getByLabelText('Belly feels cautious')).toBeTruthy();
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
    // The type is one tag under the date, like a meal's tags, not a Details card.
    expect(screen.getByText('PPI')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
    expect(screen.queryByText('Type')).toBeNull();
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

  it('deletes at once with no alert, warns with a haptic and goes back to History', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EntryScreen />);

    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));

    expect(alert).not.toHaveBeenCalled();
    expect(getSymptomLog(mockDb, id)).toBeUndefined();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
    expect(mockToast).toHaveBeenLastCalledWith('Entry deleted', {
      action: { label: 'Undo', onPress: expect.any(Function) },
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('brings the entry back, as it was, when the toast’s Undo is pressed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = seedTacos();
    const before = getFoodLog(mockDb, id);
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);
    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    expect(getFoodLog(mockDb, id)).toBeUndefined();

    await act(async () => mockToast.mock.calls.at(-1)?.[1].action.onPress());

    expect(getFoodLog(mockDb, id)).toEqual(before);
  });

  it('drops a meal’s check-in reminder when the meal is deleted, but not for other entries', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
    const symptomId = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(symptomId) };
    const { unmount } = await render(<EntryScreen />);
    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    await unmount();

    const id = seedTacos();
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);
    await openMenu();
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Delete entry' }));

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`meal-${id}`);
  });
});

describe('Entry: one that is not there', () => {
  it('explains, and goes back to History', async () => {
    mockParams = { kind: 'food', id: '999' };
    await render(<EntryScreen />);

    expect(screen.getByText("This entry isn't here any more")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
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

describe('a meal still being checked (Figma row 44)', () => {
  const verdict = {
    analysis: {
      isFood: true as const,
      mealName: 'Spicy chicken tacos',
      items: [],
      overall: {
        verdict: 'caution' as const,
        confidence: 'medium' as const,
        reasoning: 'Chili can irritate.',
      },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  };

  it('shows the name, a Checking badge and skeleton blocks instead of a verdict', async () => {
    const id = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'spicy chicken tacos',
      loggedAt: at(10, 11, 0),
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByRole('header', { name: 'spicy chicken tacos' })).toBeTruthy();
    expect(screen.getByLabelText('Checking this meal')).toBeTruthy();
    // In the middle under Bellie, not hugging the left like on Today.
    expect(StyleSheet.flatten(screen.getByLabelText('Checking this meal').props.style).alignSelf).toBe(
      'center',
    );
    expect(screen.getByText('Why?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull();
    expect(screen.getByLabelText('Add to favorite foods')).toBeTruthy();
  });

  it('has no name or heart yet for a photo meal, which the check names', async () => {
    const id = createUncheckedMeal(mockDb, {
      source: 'photo',
      photoUri: 'meal.jpg',
      loggedAt: at(10, 11, 0),
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);

    expect(screen.getByLabelText('Checking this meal')).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Meal' })).toBeNull();
    expect(screen.queryByLabelText('Add to favorite foods')).toBeNull();
  });

  it('fills in the verdict when the check finishes, without leaving the page', async () => {
    const id = createUncheckedMeal(mockDb, {
      source: 'text',
      inputText: 'spicy chicken tacos',
      loggedAt: at(10, 11, 0),
    });
    mockParams = { kind: 'food', id: String(id) };
    await render(<EntryScreen />);
    expect(screen.getByLabelText('Checking this meal')).toBeTruthy();

    await act(async () => {
      setMealAnalysis(mockDb, id, verdict);
      notifyEntriesChanged();
    });

    expect(screen.queryByLabelText('Checking this meal')).toBeNull();
    expect(screen.getByLabelText('Caution')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Why?' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });
});
