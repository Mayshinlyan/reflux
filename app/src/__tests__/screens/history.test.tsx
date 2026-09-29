import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import HistoryScreen from '@/app/history';
import { createTestDb } from '@/db/__tests__/testDb';
import { createSymptomLog, getSymptomLog } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { lightColors } from '@/theme';

let mockDb: AppDb;
let closeDb: () => void;

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
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
