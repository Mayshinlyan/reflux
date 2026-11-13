import { fireEvent, render, screen } from '@testing-library/react-native';
import { Infinity as InfinityIcon, Utensils } from 'lucide-react-native';

import { lightColors } from '@/theme';

import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { CheckboxRow } from '../CheckboxRow';
import { ChoiceCard } from '../ChoiceCard';
import { ProgressBar } from '../ProgressBar';
import { SegmentedControl } from '../SegmentedControl';
import { SettingsRow } from '../SettingsRow';
import { SymptomChip } from '../SymptomChip';
import { TagChip } from '../TagChip';
import { TimePill } from '../TimePill';

describe('filled, outline-free styling', () => {
  it('uses surface2 for the secondary button and redTint for the danger button', async () => {
    await render(
      <>
        <Button label="Not now" variant="secondary" onPress={jest.fn()} />
        <Button label="Delete all data" variant="danger" onPress={jest.fn()} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Not now' })).toHaveStyle({
      backgroundColor: lightColors.surface2,
    });
    expect(screen.getByRole('button', { name: 'Delete all data' })).toHaveStyle({
      backgroundColor: lightColors.redTint,
    });
  });

  it('rests chips on surface, or surface2 inside a card, and tints them when selected', async () => {
    await render(
      <>
        <SymptomChip label="Hoarse voice" selected={false} onToggle={jest.fn()} />
        <SymptomChip label="Cough" selected={false} onToggle={jest.fn()} onCard />
        <SymptomChip label="Heartburn" selected onToggle={jest.fn()} />
        <TagChip label="Stress" selected={false} onPress={jest.fn()} />
        <TagChip label="Large meal" selected onPress={jest.fn()} />
      </>,
    );

    const bg = (name: string) => screen.getByRole('checkbox', { name });
    // Unselected on the page: white with the soft edge. Inside a card: surface2 with a transparent 1px.
    expect(bg('Hoarse voice')).toHaveStyle({
      backgroundColor: lightColors.surface,
      borderColor: lightColors.edge,
      minHeight: 38,
    });
    expect(bg('Cough')).toHaveStyle({ backgroundColor: lightColors.surface2, borderColor: 'transparent' });
    // Selected = a light green fill plus a 1px olive outline.
    const selected = {
      backgroundColor: lightColors.sageTint,
      borderWidth: 1,
      borderColor: lightColors.sageInk,
    };
    expect(bg('Heartburn')).toHaveStyle(selected);
    expect(bg('Stress')).toHaveStyle({ backgroundColor: lightColors.surface, borderColor: lightColors.edge });
    expect(bg('Large meal')).toHaveStyle(selected);
  });
});

describe('SettingsRow', () => {
  it('shows the value, and drops the chevron for a danger row', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <SettingsRow label="Bedtime" value="10:30 PM" onPress={onPress} />
        <SettingsRow label="Delete all data" onPress={onPress} danger />
      </>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Bedtime, 10:30 PM' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Delete all data')).toHaveStyle({ color: lightColors.redInk });
  });
});

describe('SegmentedControl', () => {
  it('selects the tapped option', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="week"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Week' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    await fireEvent.press(screen.getByRole('tab', { name: 'Month' }));

    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('can show an icon in place of text, named for a screen reader', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={[
          { value: 'week', label: 'W', accessibilityLabel: 'Week' },
          { value: 'all', label: 'All time', icon: InfinityIcon },
        ]}
        value="week"
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Week' })).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
    // The icon segment has no text, only its name.
    expect(screen.queryByText('All time')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'All time' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('can have nothing selected, for a range picked by hand', async () => {
    await render(
      <SegmentedControl
        options={[
          { value: 'week', label: 'W' },
          { value: 'month', label: 'M' },
        ]}
        value={null}
        onChange={jest.fn()}
      />,
    );

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.props.accessibilityState.selected).toBe(false);
    }
  });
});

describe('ProgressBar', () => {
  it('announces the step', async () => {
    await render(<ProgressBar step={2} total={6} />);

    expect(screen.getByLabelText('Step 2 of 6')).toBeTruthy();
  });
});

describe('ChoiceCard', () => {
  it('is a plain button without `selected`, and a radio with it', async () => {
    const onPress = jest.fn();
    const view = await render(
      <ChoiceCard title="Meal" subtitle="Log a plate" icon={Utensils} onPress={onPress} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Meal, Log a plate' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await view.rerender(<ChoiceCard title="Meal" icon={Utensils} onPress={onPress} selected />);
    const radio = screen.getByRole('radio', { name: 'Meal' });
    expect(radio.props.accessibilityState).toMatchObject({ checked: true });
    expect(radio).toHaveStyle({
      backgroundColor: lightColors.sageTint,
      borderWidth: 1,
      borderColor: lightColors.sageInk,
    });
  });
});

describe('CheckboxRow', () => {
  it('toggles and reports its state', async () => {
    const onToggle = jest.fn();
    await render(<CheckboxRow label="Also save to favorite foods" checked={false} onToggle={onToggle} />);

    const row = screen.getByRole('checkbox', { name: 'Also save to favorite foods' });
    expect(row.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(row);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('Avatar and TimePill', () => {
  it('shows the first letter of the name', async () => {
    await render(<Avatar name="may" />);

    expect(screen.getByText('M')).toBeTruthy();
  });

  it('shows an icon avatar instead of the letter', async () => {
    await render(<Avatar name="may" avatar="cat" />);

    expect(screen.getByLabelText('Cat avatar')).toBeTruthy();
    expect(screen.queryByText('M')).toBeNull();
  });

  it('shows the time', async () => {
    await render(<TimePill label="Today, 1:36 PM" />);

    expect(screen.getByText('Today, 1:36 PM')).toBeTruthy();
  });
});
