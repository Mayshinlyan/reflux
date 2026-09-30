import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import HistoryScreen from '@/app/history';
import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodLog, createUncheckedMeal, listDiaryFoodLogs } from '@/db/repositories/food';
import { createMedication, logMedication } from '@/db/repositories/medications';
import { createSymptomLog, getSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { lightColors } from '@/theme';

let mockDb: AppDb;
let closeDb: () => void;

jest.mock('@/db/DatabaseProvider', () => ({
  useDb: () => mockDb,
  useSettings: () => ({
    settings: { bedtime: '22:30', lateMealWindowMinutes: 180 },
    update: jest.fn(),
  }),
}));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    Image: (props: { accessibilityLabel?: string }) => <View accessibilityLabel={props.accessibilityLabel} />,
  };
});
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
});
afterEach(() => closeDb());

const seedFullEntry = () =>
  createSymptomLog(mockDb, {
    items: [
      { key: 'hoarseness' },
      { key: 'throat_clearing' },
      { key: 'swallowing' },
      { key: 'lump' },
      { key: 'heartburn' },
      { key: 'feeling_full' },
      { key: 'constipation' },
    ],
    tags: ['stress', 'large_meal'],
    notes: 'Lost voice',
  });

const openEntry = async () => {
  await fireEvent.press(screen.getByRole('button', { name: /^Symptoms: Throat & voice/ }));
};

/** Presses a button of the most recent Alert.alert, as a tap on the system dialog would. */
const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

describe('History: removing a symptom from an entry', () => {
  it('puts a minus on every symptom and every "anything else" tag', async () => {
    seedFullEntry();
    await render(<HistoryScreen />);
    await openEntry();

    for (const label of [
      'Hoarse voice',
      'Heartburn',
      'Feeling full',
      'Constipation',
      'Stress',
      'Large meal',
    ]) {
      expect(screen.getByRole('button', { name: `Remove ${label}` })).toBeTruthy();
    }
    expect(screen.queryByText(/only symptom/)).toBeNull();
  });

  it('asks first, and cancelling changes nothing', async () => {
    const id = seedFullEntry();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HistoryScreen />);
    await openEntry();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Heartburn' }));

    expect(alert).toHaveBeenLastCalledWith(
      'Remove Heartburn?',
      'It will be taken off this entry.',
      expect.any(Array),
    );
    pressAlertButton(alert, 'Cancel');
    expect(getSymptomLog(mockDb, id)?.items.map((item) => item.key)).toContain('heartburn');
    expect(screen.getByRole('button', { name: 'Remove Heartburn' })).toBeTruthy();
    alert.mockRestore();
  });

  it('removes the symptom once confirmed and updates the open sheet and the list straight away', async () => {
    const id = seedFullEntry();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HistoryScreen />);
    await openEntry();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Heartburn' }));
    await React.act(async () => pressAlertButton(alert, 'Remove'));

    expect(getSymptomLog(mockDb, id)?.items.map((item) => item.key)).not.toContain('heartburn');
    // The sheet is still open and no longer lists it; the empty Chest heading is gone too.
    expect(screen.queryByRole('button', { name: 'Remove Heartburn' })).toBeNull();
    expect(screen.queryByRole('header', { name: /^Chest/ })).toBeNull();
    expect(screen.getByRole('header', { name: 'Throat & voice · 4' })).toBeTruthy();
    // The row behind it now counts six symptoms and only names the areas that are left.
    expect(screen.getByText(/^6 symptoms · /)).toBeTruthy();
    expect(screen.getByText('Throat & voice · Tummy')).toBeTruthy();
    alert.mockRestore();
  });

  it('gives the last symptom no minus, and says why (its tags still have one)', async () => {
    createSymptomLog(mockDb, { items: [{ key: 'cough' }], tags: ['stress'] });
    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Symptoms: Chest/ }));

    expect(screen.queryByRole('button', { name: 'Remove Nagging cough' })).toBeNull();
    expect(screen.getByText(/only symptom, so it can.t be removed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Stress' })).toBeTruthy();
  });
});

describe('History: removing an "anything else" tag from an entry', () => {
  it('asks first, and cancelling changes nothing', async () => {
    const id = seedFullEntry();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HistoryScreen />);
    await openEntry();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Stress' }));

    expect(alert).toHaveBeenLastCalledWith(
      'Remove Stress?',
      'It will be taken off this entry.',
      expect.any(Array),
    );
    pressAlertButton(alert, 'Cancel');
    expect(getSymptomLog(mockDb, id)?.tags).toContain('stress');
    alert.mockRestore();
  });

  it('removes just that tag once confirmed, keeping the symptoms and note, and updates the open sheet', async () => {
    const id = seedFullEntry();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HistoryScreen />);
    await openEntry();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Stress' }));
    await React.act(async () => pressAlertButton(alert, 'Remove'));

    expect(getSymptomLog(mockDb, id)).toMatchObject({
      tags: ['large_meal'],
      notes: 'Lost voice',
      items: expect.arrayContaining([{ key: 'heartburn', score: 1 }]),
    });
    expect(screen.queryByRole('button', { name: 'Remove Stress' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Large meal' })).toBeTruthy();
    expect(screen.getByText(/^7 symptoms · /)).toBeTruthy(); // symptoms untouched
    alert.mockRestore();
  });

  it('lets every tag go, and then drops the empty "Anything else going on" heading', async () => {
    const id = seedFullEntry();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<HistoryScreen />);
    await openEntry();

    for (const label of ['Stress', 'Large meal']) {
      await fireEvent.press(screen.getByRole('button', { name: `Remove ${label}` }));
      await React.act(async () => pressAlertButton(alert, 'Remove'));
    }

    expect(getSymptomLog(mockDb, id)?.tags).toEqual([]);
    expect(screen.queryByRole('header', { name: 'Anything else going on' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Your note' })).toBeTruthy();
    alert.mockRestore();
  });
});

describe('History: symptom entry', () => {
  it('summarises the entry in the list by body area, with a count instead of a cut-off list', async () => {
    seedFullEntry();
    await render(<HistoryScreen />);

    expect(screen.getByText('Throat & voice · Chest · Tummy')).toBeTruthy();
    expect(screen.getByText(/^7 symptoms · /)).toBeTruthy();
    expect(screen.queryByText(/Hoarse voice, Throat clearing/)).toBeNull();
  });

  it('shows the detail organised under headings: areas, other factors, then the note in its own card', async () => {
    seedFullEntry();
    await render(<HistoryScreen />);
    await openEntry();

    expect(screen.getByText('Symptom entry')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Throat & voice · 4' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Chest · 1' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Tummy · 2' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Anything else going on' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Your note' })).toBeTruthy();

    for (const label of [
      'Hoarse voice',
      'Trouble swallowing',
      'Heartburn',
      'Feeling full',
      'Stress',
      'Large meal',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Lost voice')).toBeTruthy();
  });

  it('leaves out headings for things that were not logged', async () => {
    createSymptomLog(mockDb, { items: [{ key: 'cough' }] });
    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Symptoms: Chest/ }));

    expect(screen.getByRole('header', { name: 'Chest · 1' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: /Throat/ })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Anything else going on' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Your note' })).toBeNull();
  });

  it('files a retired symptom (Trouble sleeping on an older entry) under "Other"', async () => {
    createSymptomLog(mockDb, { items: [{ key: 'sleep' }] });
    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /^Symptoms: Other/ }));

    expect(screen.getByRole('header', { name: 'Other · 1' })).toBeTruthy();
    expect(screen.getByText('Trouble sleeping')).toBeTruthy();
  });

  it('makes Edit the obvious main action and Delete a quiet one', async () => {
    seedFullEntry();
    await render(<HistoryScreen />);
    await openEntry();

    const backgroundOf = (name: string) => {
      const style = screen.getByRole('button', { name }).props.style;
      const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
      return [resolved].flat(Infinity).find((s: { backgroundColor?: string }) => s?.backgroundColor)
        ?.backgroundColor;
    };

    // Filled terracotta, like the app's other primary buttons, and clearly labelled.
    expect(backgroundOf('Edit entry')).toBe(lightColors.cta);
    // Delete does not compete with it: no tinted fill, just red text on the sheet.
    expect(backgroundOf('Delete')).toBe(lightColors.surface);
  });
});

const seedMeal = (overrides: { photoUri?: string | null; loggedAt?: string; tz?: string } = {}) =>
  createFoodLog(mockDb, {
    loggedAt: overrides.loggedAt,
    tz: overrides.tz,
    entryType: 'diary',
    source: overrides.photoUri ? 'photo' : 'text',
    inputText: overrides.photoUri ? null : 'dim sum',
    photoUri: overrides.photoUri ?? null,
    analysis: {
      isFood: true,
      mealName: 'Steamed dim sum',
      items: [
        {
          name: 'Shrimp dumpling',
          ingredients: [
            { name: 'shrimp', matchedCategories: [] },
            { name: 'chili oil', matchedCategories: ['spicy'] },
          ],
          verdict: 'caution',
          reasoning: 'Chili oil can be a trigger.',
          matchedTriggers: [{ category: 'spicy', evidence: 'chili oil' }],
        },
      ],
      overall: { verdict: 'caution', confidence: 'medium', reasoning: 'A few triggers here.' },
    },
    meta: { model: 'm', promptVersion: 'p', rulesetVersion: 'r' },
  });

describe('History: saved meals', () => {
  it('lists a meal saved from Log food with its verdict', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    expect(screen.getByText('Steamed dim sum')).toBeTruthy();
    expect(screen.getByLabelText('Caution')).toBeTruthy();
  });

  it('badges a meal eaten within 3 hours of bedtime, in the list and the detail', async () => {
    seedMeal({ loggedAt: new Date().toISOString().slice(0, 10) + 'T20:00:00Z', tz: 'UTC' });
    await render(<HistoryScreen />);

    expect(screen.getByLabelText('Late meal, close to bedtime')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }));
    expect(screen.getAllByLabelText('Late meal, close to bedtime')).toHaveLength(2);
  });

  it('does not badge an earlier meal', async () => {
    seedMeal({ loggedAt: new Date().toISOString().slice(0, 10) + 'T12:00:00Z', tz: 'UTC' });
    await render(<HistoryScreen />);

    expect(screen.queryByLabelText('Late meal, close to bedtime')).toBeNull();
  });

  it('opens the full analysis: overall reasoning, items, ingredients and the note', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }));

    expect(screen.getByText('A few triggers here.')).toBeTruthy();
    expect(screen.getByText('Shrimp dumpling')).toBeTruthy();
    expect(screen.getByText(/shrimp, chili oil/)).toBeTruthy();
    expect(screen.getByText('Chili oil can be a trigger.')).toBeTruthy();
    // The meal name is the sheet heading only once (the card's own title is hidden there).
    expect(screen.getAllByText('Steamed dim sum')).toHaveLength(2); // list row + sheet heading
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('shows the meal photo for a photo entry', async () => {
    seedMeal({ photoUri: 'file:///doc/photos/meal.jpg' });
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }));

    expect(screen.getByLabelText('Your meal photo')).toBeTruthy();
  });

  it('shows no photo for a typed entry', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }));

    expect(screen.queryByLabelText('Your meal photo')).toBeNull();
  });
});

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

describe('History: swipe to delete an entry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('asks first, and Cancel keeps the meal', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Steamed dim sum' }));
    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete this entry?');
    pressAlertButton(alert, 'Cancel');

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('removes the meal from the list once confirmed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Steamed dim sum' }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Meal: Steamed dim sum/ })).toBeNull();
  });

  it('offers Delete to screen readers as an action on the row', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(alert.mock.calls.at(-1)?.[0]).toBe('Delete this entry?');
  });

  it('deletes a symptom entry the same way', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seedFullEntry();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Delete Throat & voice/ }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(screen.queryByRole('button', { name: /^Symptoms: Throat & voice/ })).toBeNull();
  });

  it('deletes a medication entry the same way', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    logMedication(mockDb, id);
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete Omeprazole 20 mg' }));
    await act(async () => pressAlertButton(alert, 'Delete'));

    expect(screen.queryByText('Omeprazole 20 mg')).toBeNull();
  });
});

describe('History: log a meal again', () => {
  it('logs the meal again from its detail sheet', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Log again' }));

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Meal: Steamed dim sum/ })).toHaveLength(2);
  });

  it('logs the meal again from the swipe-right action', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Log Steamed dim sum again' }));

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(2);
  });

  it('offers Log again to screen readers as an action on the row', async () => {
    seedMeal();
    await render(<HistoryScreen />);

    await fireEvent(screen.getByRole('button', { name: /^Meal: Steamed dim sum/ }), 'accessibilityAction', {
      nativeEvent: { actionName: 'relog' },
    });

    expect(listDiaryFoodLogs(mockDb, ALL_TIME)).toHaveLength(2);
  });

  it('does not offer Log again on symptom entries', async () => {
    seedFullEntry();
    await render(<HistoryScreen />);

    expect(screen.queryByRole('button', { name: /again$/ })).toBeNull();
  });
});

describe('History: meals saved without a verdict', () => {
  it('lists the meal with no verdict badge and says so in the detail', async () => {
    createUncheckedMeal(mockDb, { source: 'text', inputText: 'grilled fish' });
    await render(<HistoryScreen />);

    expect(screen.queryByText('Caution')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Meal: grilled fish/ }));

    expect(screen.getByText('Saved without a verdict.')).toBeTruthy();
  });
});

describe('History: medications', () => {
  it('lists a logged medication', async () => {
    const id = createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20 mg' });
    logMedication(mockDb, id);
    await render(<HistoryScreen />);

    expect(screen.getByText('Omeprazole 20 mg')).toBeTruthy();
  });
});
