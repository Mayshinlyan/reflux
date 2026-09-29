import { fireEvent, render, screen } from '@testing-library/react-native';

import HistoryScreen from '@/app/history';
import { createTestDb } from '@/db/__tests__/testDb';
import { createSymptomLog } from '@/db/repositories/symptoms';
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
