import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import EditEntryScreen from '@/app/entry/edit';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, getFoodLog, listMealTags, saveMealDetails } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { listSavedFoods, saveFoodFromLog } from '@/db/repositories/savedFoods';
import { createSymptomLog, getSymptomLog, listSymptomLogsForMeal } from '@/db/repositories/symptoms';
import { medicationLogs } from '@/db/schema';
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
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
// The edit screen never calls the relay: a changed meal is not checked again.
const mockAnalyze = jest.fn();
jest.mock('@/services/relayClient', () => ({ analyzeFood: (...args: unknown[]) => mockAnalyze(...args) }));
// The native wheel can't render here: the stand-in keeps its latest props so a test can "turn" it.
let mockWheel: {
  value: Date;
  minimumDate: Date;
  onValueChange: (event: unknown, date: Date) => void;
} | null = null;
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: NonNullable<typeof mockWheel>) => {
    mockWheel = props;
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));

// Saturday 10 Oct 2026, local noon. Only the clock is faked.
const NOW = new Date(2026, 9, 10, 12, 0);
const meta = { model: 'm', promptVersion: 'p', rulesetVersion: 'r' };

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
  mockWheel = null;
  mockAnalyze.mockReset();
  (router.back as jest.Mock).mockClear();
  mockToast.mockClear();
});
afterEach(() => {
  closeDb();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

const seedMeal = (loggedAt = at(10, 8)) =>
  createFoodLog(mockDb, {
    entryType: 'diary',
    source: 'text',
    inputText: 'spicy chicken tacos',
    loggedAt,
    analysis: {
      isFood: true,
      mealName: 'Spicy chicken tacos',
      items: [],
      overall: { verdict: 'caution', confidence: 'medium', reasoning: 'Chili can irritate.' },
    },
    meta,
  });

const editMeal = async (id: number) => {
  mockParams = { kind: 'food', id: String(id) };
  await render(<EditEntryScreen />);
};

const save = async () =>
  act(async () => fireEvent.press(screen.getByRole('button', { name: 'Save changes' })));

const checked = (name: string) => screen.getByRole('checkbox', { name }).props.accessibilityState.checked;

/** The "+" chip: open it, type, and submit, as on the check-in. */
const addOwn = async (label: string, text: string) => {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  const field = screen.getByLabelText(label);
  await fireEvent.changeText(field, text);
  await fireEvent(field, 'submitEditing');
};

describe('Edit entry: a meal', () => {
  it('opens like the check-in, with the meal as it is: verdict, name, time, tags, symptoms and note', async () => {
    const id = seedMeal(at(10, 8, 12));
    saveMealDetails(mockDb, id, { tags: ['stress'], notes: 'Felt full.' });
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], foodLogId: id, loggedAt: at(10, 9) });
    await editMeal(id);

    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeTruthy();
    expect(screen.getByLabelText('Caution')).toBeTruthy();
    expect(screen.getByDisplayValue('Spicy chicken tacos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today, 8:12 AM' })).toBeTruthy();
    expect(screen.getByText("What's going on?")).toBeTruthy();
    expect(screen.getByText('Anything bothering you now?')).toBeTruthy();
    expect(checked('Stress')).toBe(true);
    expect(checked('Alcohol')).toBe(false);
    expect(checked('Heartburn')).toBe(true);
    expect(checked('Burping')).toBe(false);
    expect(screen.getByDisplayValue('Felt full.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Add a note (optional)')).toBeTruthy();
    // The check-in's own lines and the old edit controls are gone.
    expect(screen.queryByText(/How's your belly/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Portion/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Also save to favorite foods' })).toBeNull();
  });

  it('leaves out the verdict badge for a meal that was saved without one', async () => {
    const id = seedMeal();
    mockSqlite.exec('UPDATE food_logs SET overall_verdict = NULL, analysis = NULL, analysis_meta = NULL');
    await editMeal(id);

    expect(screen.queryByLabelText('Caution')).toBeNull();
    expect(screen.getByDisplayValue('Spicy chicken tacos')).toBeTruthy();
  });

  it('shows a factor the user typed when logging the meal, and keeps it when saving', async () => {
    const id = seedMeal();
    saveMealDetails(mockDb, id, { tags: ['stress', 'custom:Skipped breakfast'] });
    await editMeal(id);

    expect(checked('Skipped breakfast')).toBe(true);
    await save();
    expect(listMealTags(mockDb, id).sort()).toEqual(['custom:Skipped breakfast', 'stress']);
  });

  it('lets a factor the user typed be taken off the meal', async () => {
    const id = seedMeal();
    saveMealDetails(mockDb, id, { tags: ['stress', 'custom:Skipped breakfast'] });
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Skipped breakfast' }));
    await save();
    expect(listMealTags(mockDb, id)).toEqual(['stress']);
  });

  it('saves new tags, a note and symptoms, then goes back to the entry', async () => {
    const id = seedMeal();
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alcohol' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Burping' }));
    await fireEvent.changeText(
      screen.getByPlaceholderText('Add a note (optional)'),
      'Felt fine until later.',
    );
    await save();

    expect(listMealTags(mockDb, id)).toEqual(['alcohol']);
    expect(getFoodLog(mockDb, id)?.notes).toBe('Felt fine until later.');
    const linked = listSymptomLogsForMeal(mockDb, id);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.items.map((item) => item.key).sort()).toEqual(['burping', 'heartburn']);
    expect(mockToast).toHaveBeenLastCalledWith('Changes saved');
    expect(router.back).toHaveBeenCalled();
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('takes a symptom off the meal when it is unticked, and removes a log left empty', async () => {
    const id = seedMeal();
    const logId = createSymptomLog(mockDb, {
      items: [{ key: 'heartburn' }],
      foodLogId: id,
      loggedAt: at(10, 9),
    });
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await save();

    expect(getSymptomLog(mockDb, logId)).toBeUndefined();
    expect(listSymptomLogsForMeal(mockDb, id)).toEqual([]);
  });

  it('saves nothing until Save changes, and leaves the meal alone on back', async () => {
    const id = seedMeal();
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await fireEvent.changeText(screen.getByPlaceholderText('Add a note (optional)'), 'Changed my mind');
    await fireEvent.changeText(screen.getByLabelText('Meal name'), 'Something else');

    expect(listMealTags(mockDb, id)).toEqual([]);
    expect(getFoodLog(mockDb, id)?.notes).toBeNull();
    expect(getFoodLog(mockDb, id)?.mealName).toBe('Spicy chicken tacos');
  });

  describe('the name', () => {
    it('renames the meal, trimmed, and keeps its verdict without checking it again', async () => {
      const id = seedMeal();
      await editMeal(id);

      await fireEvent.changeText(screen.getByLabelText('Meal name'), '  Chicken tacos ');
      await save();

      expect(getFoodLog(mockDb, id)).toMatchObject({ mealName: 'Chicken tacos', overallVerdict: 'caution' });
      expect(mockAnalyze).not.toHaveBeenCalled();
      expect(router.back).toHaveBeenCalled();
    });

    it('does not save a blank name', async () => {
      const id = seedMeal();
      await editMeal(id);

      await fireEvent.changeText(screen.getByLabelText('Meal name'), '   ');
      expect(screen.getByRole('button', { name: 'Save changes' }).props.accessibilityState.disabled).toBe(
        true,
      );
      await save();

      expect(getFoodLog(mockDb, id)?.mealName).toBe('Spicy chicken tacos');
      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe('the "+" chips', () => {
    it('adds a factor of your own: picked, saved to My additions, tagged on the meal', async () => {
      const id = seedMeal();
      await editMeal(id);

      await addOwn("Add your own to What's going on?", 'Skipped breakfast');
      expect(checked('Skipped breakfast')).toBe(true);
      await save();

      expect(listMealTags(mockDb, id)).toEqual(['custom:Skipped breakfast']);
    });

    it('adds a symptom of your own, linked to the meal', async () => {
      const id = seedMeal();
      await editMeal(id);

      await addOwn('Add your own symptom', 'Hiccups');
      expect(checked('Hiccups')).toBe(true);
      await save();

      const linked = listSymptomLogsForMeal(mockDb, id);
      expect(linked.flatMap((log) => log.items.map((item) => item.key))).toEqual(['custom:Hiccups']);
    });

    it('shows a symptom typed earlier, and takes it off when unticked', async () => {
      const id = seedMeal();
      createSymptomLog(mockDb, { items: [{ key: 'custom:Hiccups' }], foodLogId: id, loggedAt: at(10, 9) });
      await editMeal(id);

      expect(checked('Hiccups')).toBe(true);
      await fireEvent.press(screen.getByRole('checkbox', { name: 'Hiccups' }));
      await save();

      expect(listSymptomLogsForMeal(mockDb, id)).toEqual([]);
    });
  });

  describe('the star', () => {
    it('adds the meal to favorite foods when ticked', async () => {
      const id = seedMeal();
      await editMeal(id);

      await fireEvent.press(screen.getByRole('checkbox', { name: 'Add to favorite foods' }));
      await save();

      expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Spicy chicken tacos']);
    });

    it('is left out for a meal that is already a favorite', async () => {
      const id = seedMeal();
      saveFoodFromLog(mockDb, id);
      await editMeal(id);

      expect(screen.queryByRole('checkbox', { name: 'Add to favorite foods' })).toBeNull();
    });
  });

  it('keeps the portion and the verdict it had, since Portion is no longer edited', async () => {
    const id = seedMeal();
    saveMealDetails(mockDb, id, { portion: 'large' });
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
    await save();

    expect(getFoodLog(mockDb, id)).toMatchObject({ portion: 'large', overallVerdict: 'caution' });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('moves the meal to the time chosen on the wheel', async () => {
    const id = seedMeal(at(9, 20));
    await editMeal(id);

    await fireEvent.press(screen.getByRole('button', { name: 'Yesterday, 8:00 PM' }));
    expect(screen.getByText('When did you eat this?')).toBeTruthy();
    // The wheel opens on the meal's own time and can reach back to its day.
    expect(mockWheel?.value.getTime()).toBe(new Date(at(9, 20)).getTime());
    const earlier = new Date(2026, 9, 9, 18, 30);
    await act(async () => mockWheel!.onValueChange(null, earlier));
    await fireEvent.press(screen.getByRole('button', { name: 'Set time' }));
    expect(screen.getByRole('button', { name: 'Yesterday, 6:30 PM' })).toBeTruthy();
    await save();

    expect(getFoodLog(mockDb, id)?.loggedAt).toBe(earlier.toISOString());
  });

  it('lets an old meal be edited without pulling its time forward', async () => {
    const id = seedMeal(new Date(2026, 8, 1, 12).toISOString());
    await editMeal(id);

    await fireEvent.press(screen.getByRole('button', { name: /^Tue 1 Sep, 12:00 PM/ }));
    // Leaving the wheel alone keeps the time as it was.
    await fireEvent.press(screen.getByRole('button', { name: 'Set time' }));
    expect(mockWheel!.minimumDate.getTime()).toBe(new Date(2026, 8, 1, 12).getTime());
    await save();

    expect(getFoodLog(mockDb, id)?.loggedAt).toBe(new Date(2026, 8, 1, 12).toISOString());
  });
});

describe('Edit entry: a dose', () => {
  const seedDose = (options: { doseText?: string; notes?: string } = {}) => {
    const medId = createMedication(mockDb, {
      name: 'Omeprazole (Prilosec)',
      type: 'ppi',
      defaultDose: '20mg',
    });
    return logMedication(mockDb, medId, { takenAt: at(10, 8, 30), ...options });
  };
  const editDose = async (id: number) => {
    mockParams = { kind: 'medication', id: String(id) };
    await render(<EditEntryScreen />);
  };
  const stored = () => mockDb.select().from(medicationLogs).all()[0];

  it('opens like the dose details: name, time, type, the dose chosen and the note', async () => {
    await editDose(seedDose({ notes: 'With breakfast' }));

    expect(screen.getByRole('header', { name: 'Omeprazole (Prilosec)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today, 8:30 AM' })).toBeTruthy();
    expect(screen.getByText('PPI')).toBeTruthy();
    expect(screen.getByText('Dose')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '20mg' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: '40mg' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByDisplayValue('With breakfast')).toBeTruthy();
  });

  it('saves a different dose and a note', async () => {
    await editDose(seedDose());

    await fireEvent.press(screen.getByRole('radio', { name: '40mg' }));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Taken with breakfast'), 'After lunch');
    await save();

    expect(stored()).toMatchObject({ doseText: '40mg', notes: 'After lunch', takenAt: at(10, 8, 30) });
    expect(mockToast).toHaveBeenLastCalledWith('Changes saved');
    expect(router.back).toHaveBeenCalled();
  });

  it('starts on "Other" for a dose that is not one of the chips, and can change it', async () => {
    await editDose(seedDose({ doseText: '30mg' }));

    expect(screen.getByRole('radio', { name: 'Other' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.changeText(screen.getByDisplayValue('30mg'), '35mg');
    await save();

    expect(stored()?.doseText).toBe('35mg');
  });

  it('clears the dose when the chosen chip is tapped again', async () => {
    await editDose(seedDose());

    await fireEvent.press(screen.getByRole('radio', { name: '20mg' }));
    await save();

    expect(stored()?.doseText).toBeNull();
  });

  it('moves the dose to the time chosen on the wheel', async () => {
    await editDose(seedDose());

    await fireEvent.press(screen.getByRole('button', { name: 'Today, 8:30 AM' }));
    expect(screen.getByText('When did you take this?')).toBeTruthy();
    const earlier = new Date(2026, 9, 10, 7, 0);
    await act(async () => mockWheel!.onValueChange(null, earlier));
    await fireEvent.press(screen.getByRole('button', { name: 'Set time' }));
    await save();

    expect(stored()?.takenAt).toBe(earlier.toISOString());
  });

  it('leaves the dose as it was when nothing is changed', async () => {
    await editDose(seedDose());

    await save();

    expect(stored()).toMatchObject({ takenAt: at(10, 8, 30), doseText: '20mg', notes: null });
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Edit entry: nothing to edit', () => {
  it('says so for a missing entry', async () => {
    mockParams = { kind: 'food', id: '999' };
    await render(<EditEntryScreen />);
    expect(screen.getByText("This entry can't be edited here.")).toBeTruthy();
  });

  it('does not offer a symptom entry here', async () => {
    const id = createSymptomLog(mockDb, { items: [{ key: 'cough' }], loggedAt: at(10, 9) });
    mockParams = { kind: 'symptom', id: String(id) };
    await render(<EditEntryScreen />);

    expect(screen.getByText("This entry can't be edited here.")).toBeTruthy();
  });
});
