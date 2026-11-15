import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { LogKindSwitcher, SwitchKindProvider } from '../LogKindSwitcher';

const tab = (name: string) => screen.getByRole('tab', { name });
const inside = (ui: React.ReactElement, onSwitch = jest.fn()) => (
  <SwitchKindProvider onSwitch={onSwitch}>{ui}</SwitchKindProvider>
);

describe('LogKindSwitcher', () => {
  it('shows Food, How I feel and Medication, with the current one selected', async () => {
    await render(inside(<LogKindSwitcher current="symptoms" />));

    expect(tab('Food').props.accessibilityState.selected).toBe(false);
    expect(tab('How I feel').props.accessibilityState.selected).toBe(true);
    expect(tab('Medication').props.accessibilityState.selected).toBe(false);
  });

  it('switches to another kind in place', async () => {
    const onSwitch = jest.fn();
    await render(inside(<LogKindSwitcher current="food" />, onSwitch));

    await fireEvent.press(tab('Medication'));

    expect(onSwitch).toHaveBeenCalledWith('medication');
  });

  it('does nothing when the current kind is tapped', async () => {
    const onSwitch = jest.fn();
    await render(inside(<LogKindSwitcher current="food" />, onSwitch));

    await fireEvent.press(tab('Food'));

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('asks before throwing away what was entered, and switches only on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onSwitch = jest.fn();
    await render(inside(<LogKindSwitcher current="food" confirmLeave />, onSwitch));

    await fireEvent.press(tab('Medication'));

    expect(onSwitch).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as AlertButton[];
    buttons.find((b) => b.text === 'Switch')?.onPress?.();
    expect(onSwitch).toHaveBeenCalledWith('medication');
    alert.mockRestore();
  });

  it('draws nothing outside the tabbed log', async () => {
    await render(<LogKindSwitcher current="food" />);

    expect(screen.queryByRole('tab')).toBeNull();
  });
});
