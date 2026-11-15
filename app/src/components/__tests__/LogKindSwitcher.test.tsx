import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { LogKindSwitcher } from '../LogKindSwitcher';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));

const tab = (name: string) => screen.getByRole('tab', { name });

describe('LogKindSwitcher', () => {
  beforeEach(() => mockReplace.mockClear());

  it('shows Food, How I feel and Medication, with the current one selected', async () => {
    await render(<LogKindSwitcher current="symptoms" />);

    expect(tab('Food').props.accessibilityState.selected).toBe(false);
    expect(tab('How I feel').props.accessibilityState.selected).toBe(true);
    expect(tab('Medication').props.accessibilityState.selected).toBe(false);
  });

  it('swaps to another kind in place', async () => {
    await render(<LogKindSwitcher current="food" />);

    await fireEvent.press(tab('Medication'));

    expect(mockReplace).toHaveBeenCalledWith('/log/medication');
  });

  it('keeps the day being logged', async () => {
    await render(<LogKindSwitcher current="food" date="2026-11-10" />);

    await fireEvent.press(tab('How I feel'));

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/log/symptoms', params: { date: '2026-11-10' } });
  });

  it('does nothing when the current kind is tapped', async () => {
    await render(<LogKindSwitcher current="food" />);

    await fireEvent.press(tab('Food'));

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('asks before throwing away what was entered, and switches only on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<LogKindSwitcher current="food" confirmLeave />);

    await fireEvent.press(tab('Medication'));

    expect(mockReplace).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    buttons.find((b) => b.text === 'Switch')?.onPress?.();
    expect(mockReplace).toHaveBeenCalledWith('/log/medication');
    alert.mockRestore();
  });
});
