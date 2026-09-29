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
const mockToast = jest.fn();

jest.mock('@/db/DatabaseProvider', () => ({ useDb: () => mockDb }));
// Sentry's SDK starts a cleanup timer on import; not needed here.
jest.mock('@/lib/sentry', () => ({ Sentry: { captureException: jest.fn() }, initSentry: jest.fn() }));
jest.mock('@/components/Toast', () => ({ useToast: () => mockToast }));
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), canGoBack: () => true, replace: jest.fn() },
  useNavigation: () => ({ setOptions: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));

const ALL_TIME = { from: '2000-01-01T00:00:00.000Z', to: '2100-01-01T00:00:00.000Z' };

const press = async (role: 'button' | 'radio', name: string) =>
  fireEvent.press(screen.getByRole(role, { name }));

const pressAlertButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
};

beforeEach(() => {
  const { db, sqlite } = createTestDb();
  mockDb = db;
  closeDb = () => sqlite.close();
  mockBack.mockClear();
  mockToast.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
  closeDb();
});

const seedOmeprazole = () =>
  createMedication(mockDb, { name: 'Omeprazole', type: 'ppi', defaultDose: '20mg' });

describe('Medications: one-tap logging', () => {
  it('logs a saved medication with a single tap, keeping a snapshot of its name, type and dose', async () => {
    const id = seedOmeprazole();
    await render(<MedicationScreen />);

    await press('button', 'Log Omeprazole 20mg');

    expect(listMedicationLogs(mockDb, ALL_TIME)).toEqual([
      expect.objectContaining({ medicationId: id, name: 'Omeprazole', type: 'ppi', doseText: '20mg' }),
    ]);
    expect(mockToast).toHaveBeenCalledWith('Omeprazole logged');
  });

  it('confirms on the row, says when it was last taken today, and ignores a double-tap', async () => {
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);
    expect(screen.queryByText(/Taken today/)).toBeNull();

    await press('button', 'Log Omeprazole 20mg');

    expect(screen.getByText('Logged ✓')).toBeTruthy();
    expect(screen.getByText(/PPI · Taken today /)).toBeTruthy();
    const loggedButton = screen.getByRole('button', { name: 'Omeprazole logged' });
    expect(loggedButton.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(loggedButton); // a second tap right away
    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('cannot log twice from two taps in the same instant', async () => {
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);
    const button = screen.getByRole('button', { name: 'Log Omeprazole 20mg' });

    // Both calls happen before React can re-render the button as disabled.
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });

    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(1);
  });

  it('returns to "Log" after a moment so a second dose can be logged, and counts them', async () => {
    jest.useFakeTimers();
    seedOmeprazole();
    await render(<MedicationScreen />);

    await press('button', 'Log Omeprazole 20mg');
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Logged ✓')).toBeNull();
    await press('button', 'Log Omeprazole 20mg');

    expect(listMedicationLogs(mockDb, ALL_TIME)).toHaveLength(2);
    expect(screen.getByText(/Taken today .* \(2×\)/)).toBeTruthy();
  });

  it('shows earlier logs from today when the screen opens', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    await render(<MedicationScreen />);

    expect(screen.getByText(/PPI · Taken today /)).toBeTruthy();
  });

  it('explains what to do when there are no medications yet', async () => {
    await render(<MedicationScreen />);
    expect(screen.getByText(/Add the medications you take/)).toBeTruthy();
  });
});

describe('Medications: adding', () => {
  const openPicker = async () => {
    await press('button', '+ Add a medication');
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
    expect(screen.getByRole('button', { name: 'Log Famotidine (Pepcid) 20mg' })).toBeTruthy();
  });

  it('cannot add until a medication is chosen', async () => {
    await render(<MedicationScreen />);
    await press('button', '+ Add a medication');

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
    await press('button', '+ Add a medication');
    expect(screen.getByRole('header', { name: 'Add medication' })).toBeTruthy(); // the form is open

    await press('button', 'Back');

    expect(screen.getByRole('button', { name: '+ Add a medication' })).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('Medications: editing and removing', () => {
  it('edits a medication, and earlier logs keep the name they were logged under', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    await render(<MedicationScreen />);

    await press('button', 'Edit Omeprazole 20mg');
    expect(screen.getByLabelText('Name').props.value).toBe('Omeprazole');
    expect(screen.getByLabelText('Dose').props.value).toBe('20mg');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Omeprazole (generic)');
    await fireEvent.changeText(screen.getByLabelText('Dose'), '40mg');
    await press('button', 'Save changes');

    expect(listMedications(mockDb)[0]).toMatchObject({ name: 'Omeprazole (generic)', defaultDose: '40mg' });
    expect(listMedicationLogs(mockDb, ALL_TIME)[0]).toMatchObject({ name: 'Omeprazole', doseText: '20mg' });
    expect(screen.getByRole('button', { name: 'Log Omeprazole (generic) 40mg' })).toBeTruthy();
  });

  it('removes a medication from the list after confirming, but keeps its logs', async () => {
    const id = seedOmeprazole();
    logMedication(mockDb, id);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MedicationScreen />);

    await press('button', 'Edit Omeprazole 20mg');
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
    expect(screen.getByText(/Add the medications you take/)).toBeTruthy();
    expect(mockToast).toHaveBeenCalledWith('Removed from your list');
    alert.mockRestore();
  });

  it('keeps the medication if removing is cancelled', async () => {
    seedOmeprazole();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<MedicationScreen />);

    await press('button', 'Edit Omeprazole 20mg');
    await press('button', 'Remove from my list');
    pressAlertButton(alert, 'Cancel');

    expect(listMedications(mockDb)).toHaveLength(1);
    alert.mockRestore();
  });
});
