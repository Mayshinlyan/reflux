import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import EditEntryScreen from '@/app/entry/edit';
import { createTestDb } from '@/db/__tests__/testDb';
import {
  createFoodLog,
  getFoodLog,
  listMealTags,
  saveMealDetails,
  updateFoodLog,
} from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { listSavedFoods, saveFoodFromLog } from '@/db/repositories/savedFoods';
import { createSymptomLog, getSymptomLog, listSymptomLogsForMeal } from '@/db/repositories/symptoms';
import { medicationLogs } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { analyzeFood } from '@/services/relayClient';

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
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/services/relayClient', () => ({ analyzeFood: jest.fn() }));
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
const analyze = analyzeFood as jest.Mock;
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
  analyze.mockReset();
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

describe('Edit entry: a meal', () => {
  it('opens with the meal as it is: verdict, name, time, portion, tags, symptoms and note', async () => {
    const id = seedMeal(at(10, 8, 12));
    saveMealDetails(mockDb, id, { portion: 'large', tags: ['stress'], notes: 'Felt full.' });
    createSymptomLog(mockDb, { items: [{ key: 'heartburn' }], foodLogId: id, loggedAt: at(10, 9) });
    await editMeal(id);

    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeTruthy();
    expect(screen.getByLabelText('Caution')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Spicy chicken tacos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today, 8:12 AM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Portion, Large' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Stress' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Alcohol' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Heartburn' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Burping' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByDisplayValue('Felt full.')).toBeTruthy();
  });

  it('saves new tags, a note and symptoms, then goes back to the entry', async () => {
    const id = seedMeal();
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alcohol' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Heartburn' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Burping' }));
    await fireEvent.changeText(screen.getByPlaceholderText('How did it feel?'), 'Felt fine until later.');
    await save();

    expect(listMealTags(mockDb, id)).toEqual(['alcohol']);
    expect(getFoodLog(mockDb, id)?.notes).toBe('Felt fine until later.');
    const linked = listSymptomLogsForMeal(mockDb, id);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.items.map((item) => item.key).sort()).toEqual(['burping', 'heartburn']);
    expect(mockToast).toHaveBeenLastCalledWith('Changes saved');
    expect(router.back).toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
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
    await fireEvent.changeText(screen.getByPlaceholderText('How did it feel?'), 'Changed my mind');

    expect(listMealTags(mockDb, id)).toEqual([]);
    expect(getFoodLog(mockDb, id)?.notes).toBeNull();
  });

  it('also saves to My foods when ticked, and only offers it when the meal is not saved yet', async () => {
    const id = seedMeal();
    await editMeal(id);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Also save to My foods' }));
    await save();

    expect(listSavedFoods(mockDb).map((food) => food.mealName)).toEqual(['Spicy chicken tacos']);
  });

  it('hides "Also save to My foods" for a meal that is already saved', async () => {
    const id = seedMeal();
    saveFoodFromLog(mockDb, id);
    await editMeal(id);

    expect(screen.queryByRole('checkbox', { name: 'Also save to My foods' })).toBeNull();
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

  describe('a new portion', () => {
    const checked = (verdict: 'caution' | 'trigger') => ({
      isFood: true,
      mealName: 'Spicy chicken tacos',
      items: [],
      overall: { verdict, confidence: 'high', reasoning: 'Big portion.' },
      meta,
    });

    it('re-checks the meal and saves the new verdict', async () => {
      const id = seedMeal();
      analyze.mockResolvedValue(checked('trigger'));
      await editMeal(id);

      await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
      await save();

      expect(analyze).toHaveBeenCalledWith({ text: 'spicy chicken tacos', portion: 'large' });
      expect(getFoodLog(mockDb, id)).toMatchObject({ portion: 'large', overallVerdict: 'trigger' });
      expect(mockToast).toHaveBeenLastCalledWith('Changes saved. Verdict updated for the new portion.');
    });

    it('keeps a verdict the user set earlier over the new one', async () => {
      const id = seedMeal();
      updateFoodLog(mockDb, id, { name: 'Spicy chicken tacos', verdict: 'good' });
      analyze.mockResolvedValue(checked('trigger'));
      await editMeal(id);

      await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
      await save();

      expect(getFoodLog(mockDb, id)).toMatchObject({ portion: 'large', overallVerdict: 'good' });
      expect(getFoodLog(mockDb, id)?.analysis?.overall).toMatchObject({
        verdict: 'trigger',
        userVerdict: 'good',
      });
    });

    it('keeps the edits and saves nothing when the re-check fails', async () => {
      const id = seedMeal();
      analyze.mockRejectedValue(new AppError('NETWORK'));
      await editMeal(id);

      await fireEvent.press(screen.getByRole('checkbox', { name: 'Stress' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Small' }));
      await save();

      expect(getFoodLog(mockDb, id)?.portion).toBeNull();
      expect(listMealTags(mockDb, id)).toEqual([]);
      expect(router.back).not.toHaveBeenCalled();
      // The screen still holds the edits, and Save changes works again.
      expect(screen.getByRole('button', { name: 'Portion, Small' })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: 'Stress' }).props.accessibilityState.checked).toBe(true);
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    });

    it('just notes the portion on a meal that was saved without a verdict', async () => {
      const id = seedMeal();
      mockSqlite.exec('UPDATE food_logs SET overall_verdict = NULL, analysis = NULL, analysis_meta = NULL');
      await editMeal(id);

      await fireEvent.press(screen.getByRole('button', { name: 'Portion, Regular' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Large' }));
      await save();

      expect(analyze).not.toHaveBeenCalled();
      expect(getFoodLog(mockDb, id)?.portion).toBe('large');
    });
  });
});

describe('Edit entry: a dose', () => {
  const seedDose = () => {
    const medId = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });
    return logMedication(mockDb, medId, { takenAt: at(10, 8, 30) });
  };

  it('shows the dose and its time, and nothing else to change', async () => {
    mockParams = { kind: 'medication', id: String(seedDose()) };
    await render(<EditEntryScreen />);

    expect(screen.getByRole('header', { name: 'Omeprazole 20mg' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today, 8:30 AM' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Portion/ })).toBeNull();
  });

  it('moves the dose to the time chosen on the wheel', async () => {
    mockParams = { kind: 'medication', id: String(seedDose()) };
    await render(<EditEntryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Today, 8:30 AM' }));
    expect(screen.getByText('When did you take this?')).toBeTruthy();
    const earlier = new Date(2026, 9, 10, 7, 0);
    await act(async () => mockWheel!.onValueChange(null, earlier));
    await fireEvent.press(screen.getByRole('button', { name: 'Set time' }));
    await save();

    expect(mockDb.select().from(medicationLogs).all()[0]?.takenAt).toBe(earlier.toISOString());
    expect(mockToast).toHaveBeenLastCalledWith('Changes saved');
    expect(router.back).toHaveBeenCalled();
  });

  it('leaves the dose as it was when the time is not changed', async () => {
    mockParams = { kind: 'medication', id: String(seedDose()) };
    await render(<EditEntryScreen />);

    await save();

    expect(mockDb.select().from(medicationLogs).all()[0]?.takenAt).toBe(at(10, 8, 30));
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
