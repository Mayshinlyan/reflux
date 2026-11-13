import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import MedicationScreen from '@/app/log/medication';
import { createTestDb } from '@/db/__tests__/testDb';
import {
  createMedication,
  listMedicationLogs,
  listMedications,
  logMedication,
} from '@/db/repositories/medications';
import type { AppDb } from '@/db/types';

let mockDb: AppDb;
let closeDb: () => void;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockToast = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => true,
    replace: jest.fn(),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useNavigation: () => ({ setOptions: jest.fn() }),
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

// The sheets read safe-area insets.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

const press = async (role: 'button' | 'radio', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

/** Log now: a tap on the medicine logs a dose right away. */
const logNow = async (name = 'Omeprazole 20mg') => press('button', name);

const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockPush.mockClear();
  mockToast.mockClear();
  // Most tests are of Profile > Medications; "from Log" tests clear this.
  mockParams = { manage: '1' };
});
afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

const seedOmeprazole = () =>
  createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });

describe('Medications: logging', () => {
  it('has a "Which medication?" title from Log and "Medications" from Profile', async () => {
    seedOmeprazole();
    mockParams = {};
    await render(<MedicationScreen />);
    expect(screen.getByRole('header', { name: 'Which medication?' })).toBeTruthy();
    expect(screen.getByText('Tap a medicine to log a dose now.')).toBeTruthy();
    await screen.unmount();

    mockParams = { manage: '1' };
    await render(<MedicationScreen />);
    expect(screen.getByRole('header', { name: 'Medications' })).toBeTruthy();
  });

  it('opens the completion page for the dose, which carries what Change time needs', async () => {
    mockParams = {};
    seedOmeprazole();
    await render(<MedicationScreen />);

    await press('button', 'Omeprazole 20mg');

    const [log] = listMedicationLogs(mockDb, ALL_TIME);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/completion',
      params: { kind: 'dose', id: String(log.id), note: expect.stringMatching(/^Omeprazole, /) },
    });
  });

  it('logs a dose right now from a tap on the medicine, with no sheet, no details page and no symptom question', async () => {
    mockParams = {};
    const id = seedOmeprazole();
    await render(<MedicationScreen />);

    await press('button', 'Omeprazole 20mg');

    expect(listMedicationLogs(mockDb, ALL_TIME)).toEqual([
      expect.objectContaining({ medicationId: id, name: 'Omeprazole', type: 'ppi', doseText: '20mg' }),
    ]);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/completion',
      params: expect.objectContaining({ kind: 'dose' }),
    });
    expect(screen.queryByText('When did you take this?')).toBeNull();
    expect(screen.queryByText(/Any symptoms/)).toBeNull();
  });

  it('has no Log button anywhere; when managing the list a tap opens the medication instead of logging', async () => {
    seedOmeprazole();
    await render(<MedicationScreen />);

    expect(screen.queryByText('Log')).toBeNull();
    await press('button', 'Omeprazole 20mg');
    expect(screen.getByText('Remove from my list')).toBeTruthy();
  });

  it('says when it was last taken today, and ignores a double-tap', async () => {
    mockParams = {};
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);
    expect(screen.queryByText(/Taken today/)).toBeNull();

    await logNow();

    expect(screen.getByText(/PPI · Taken today /)).toBeTruthy();
    const loggedRow = screen.getByRole('button', { name: 'Omeprazole 20mg' });
    expect(loggedRow.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(loggedRow); // a second tap right away
    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('cannot log twice from two taps in the same instant', async () => {
    mockParams = {};
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);
    const button = screen.getByRole('button', { name: 'Omeprazole 20mg' });

    // Both calls happen before React can re-render the button away.
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });

    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('can be tapped again after a moment, so a second dose can be logged, and counts them', async () => {
    mockParams = {};
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);

    await logNow();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Omeprazole 20mg' }).props.accessibilityState).toMatchObject({
      disabled: false,
    });
    await logNow();

    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(2);
    expect(screen.getByText(/Taken today .* \(2×\)/)).toBeTruthy();
  });

  it('shows earlier logs from today when the screen opens', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    await render(<MedicationScreen />);

    expect(screen.getByText(/PPI · Taken today /)).toBeTruthy();
  });

  it('says so in a few words when there are no medications yet', async () => {
    await render(<MedicationScreen />);
    expect(screen.getByText('No medications yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a medication' })).toBeTruthy();
  });

  it('has no instruction line under the title when managing, and keeps it when logging', async () => {
    seedOmeprazole();
    const { unmount } = await render(<MedicationScreen />);
    expect(screen.queryByText('Tap a medication to see it.')).toBeNull();
    expect(screen.queryByText(/Tap a medicine to log/)).toBeNull();
    await unmount();

    mockParams = {};
    await render(<MedicationScreen />);
    expect(screen.getByText(/Tap a medicine to log a dose now/)).toBeTruthy();
  });
});

describe('Medications: adding', () => {
  const openPicker = async () => {
    await press('button', 'Add a medication');
    await press('button', 'Medication');
  };

  it('picks a common medication, fills in its type, and offers its usual doses', async () => {
    await render(<MedicationScreen />);
    await openPicker();

    await press('radio', 'Famotidine (Pepcid)');
    expect(screen.getByText('Type: H2 blocker')).toBeTruthy();
    expect(screen.getAllByRole('radio').map((chip) => chip.props.accessibilityLabel)).toEqual([
      '10mg',
      '20mg',
      '40mg',
      'Other dose',
    ]);
    await press('radio', '20mg');
    await press('button', 'Add medication');

    expect(listMedications(mockDb)).toEqual([
      expect.objectContaining({
        name: 'Famotidine (Pepcid)',
        type: 'h2_blocker',
        defaultDose: '20mg',
        active: true,
      }),
    ]);
    expect(mockToast).toHaveBeenCalledWith('Famotidine (Pepcid) added');
    expect(screen.getByRole('button', { name: 'Famotidine (Pepcid) 20mg' })).toBeTruthy();
  });

  it('cannot add until a medication is chosen', async () => {
    await render(<MedicationScreen />);
    await press('button', 'Add a medication');

    expect(screen.getByRole('button', { name: 'Add medication' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('lets the dose be left out, changed, or typed in', async () => {
    await render(<MedicationScreen />);
    await openPicker();
    await press('radio', 'Tums');

    await press('radio', '2 tablets');
    await press('radio', '2 tablets'); // tapping again clears it
    await press('radio', 'Other dose');
    await fireEvent.changeText(screen.getByLabelText('Dose'), '4 tablets');
    await press('button', 'Add medication');

    expect(listMedications(mockDb)[0]).toMatchObject({
      name: 'Tums',
      type: 'antacid',
      defaultDose: '4 tablets',
    });
  });

  it('saves a medication that is not on the list with its own name, type and dose', async () => {
    await render(<MedicationScreen />);
    await openPicker();
    await press('radio', 'Not listed? Enter your own');

    expect(screen.getByRole('button', { name: 'Add medication' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Zegerid ');
    await press('radio', 'PPI');
    await fireEvent.changeText(screen.getByLabelText('Dose'), '40mg');
    await press('button', 'Add medication');

    expect(listMedications(mockDb)).toEqual([
      expect.objectContaining({ name: 'Zegerid', type: 'ppi', defaultDose: '40mg', active: true }),
    ]);
    expect(screen.getByText('PPI')).toBeTruthy();
  });

  it('will not add a not-listed medication without a name', async () => {
    await render(<MedicationScreen />);
    await openPicker();
    await press('radio', 'Not listed? Enter your own');
    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');

    expect(screen.getByRole('button', { name: 'Add medication' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('offers exactly one type at a time for a not-listed medication', async () => {
    await render(<MedicationScreen />);
    await openPicker();
    await press('radio', 'Not listed? Enter your own');

    const checked = () =>
      screen
        .getAllByRole('radio')
        .filter((chip) => chip.props.accessibilityState?.checked)
        .map((chip) => chip.props.accessibilityLabel);
    expect(checked()).toEqual(['PPI']);
    await press('radio', 'Antacid');
    expect(checked()).toEqual(['Antacid']);
  });

  it('goes back from the form to the list without leaving the screen', async () => {
    await render(<MedicationScreen />);
    await press('button', 'Add a medication');
    expect(screen.getByRole('header', { name: 'Add medication' })).toBeTruthy(); // the form is open

    await press('button', 'Back');

    expect(screen.getByRole('button', { name: 'Add a medication' })).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('Medications: editing and removing', () => {
  it('edits a medication, and earlier logs keep the name they were logged under', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    await render(<MedicationScreen />);

    // Tapping it shows the medication first; the fields open after Edit.
    await press('button', 'Omeprazole 20mg');
    expect(screen.getByRole('header', { name: 'Omeprazole 20mg' })).toBeTruthy();
    expect(screen.queryByLabelText('Name')).toBeNull();
    await press('button', 'Edit');
    expect(screen.getByLabelText('Name').props.value).toBe('Omeprazole');
    expect(screen.getByLabelText('Dose').props.value).toBe('20mg');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Omeprazole (generic)');
    await fireEvent.changeText(screen.getByLabelText('Dose'), '40mg');
    await press('button', 'Save changes');

    expect(listMedications(mockDb)[0]).toMatchObject({ name: 'Omeprazole (generic)', defaultDose: '40mg' });
    expect(listMedicationLogs(mockDb, ALL_TIME)[0]).toMatchObject({ name: 'Omeprazole', doseText: '20mg' });
    expect(screen.getByRole('button', { name: 'Omeprazole (generic) 40mg' })).toBeTruthy();
  });

  it('removes a medication from the list after confirming, but keeps its logs', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MedicationScreen />);

    await press('button', 'Omeprazole 20mg');
    await press('button', 'Remove from my list');
    expect(alert).toHaveBeenLastCalledWith(
      'Remove Omeprazole?',
      'It leaves your list, but past logs stay in History.',
      expect.any(Array),
    );
    await act(async () => pressAlertButton(alert, 'Remove'));

    expect(listMedications(mockDb)).toEqual([]);
    expect(listMedications(mockDb, { includeArchived: true })).toHaveLength(1);
    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(1);
    expect(screen.getByText('No medications yet.')).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith('Removed from your list');
    alert.mockRestore();
  });

  it('keeps the medication if removing is cancelled', async () => {
    seedOmeprazole();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MedicationScreen />);

    await press('button', 'Omeprazole 20mg');
    await press('button', 'Remove from my list');
    pressAlertButton(alert, 'Cancel');

    expect(listMedications(mockDb)).toHaveLength(1);
    alert.mockRestore();
  });
});

describe('Medications: logging for an earlier day', () => {
  // A day tapped in Today's week strip: a tap on the medicine logs it at noon of that day.
  const noonYesterday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0);
  };
  const yesterdayKey = () => {
    const day = noonYesterday();
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  };

  it('logs a tap at noon of that day, does not count it as taken today, and ignores a double tap', async () => {
    mockParams = { date: yesterdayKey() };
    seedOmeprazole();
    await render(<MedicationScreen />);

    const row = screen.getByRole('button', { name: 'Omeprazole 20mg' });

    // Both taps land before React can re-render the row disabled.
    await act(async () => {
      void fireEvent.press(row);
      void fireEvent.press(row);
    });

    const logs = listMedicationLogs(mockDb, ALL_TIME);
    expect(logs).toHaveLength(1);
    expect(logs[0].takenAt).toBe(noonYesterday().toISOString());
    expect(screen.queryByText(/Taken today/)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/completion',
      params: expect.objectContaining({ kind: 'dose', note: 'Omeprazole, Yesterday, 12:00 PM' }),
    });
  });
});
