import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { AppVerdict } from '@/types/analysis';

import { VERDICT_LABELS, VerdictBadge } from '../VerdictBadge';

describe('VerdictBadge', () => {
  it.each<[AppVerdict, string]>([
    ['good', 'Good'],
    ['ok', 'Okay'],
    ['caution', 'Caution'],
    ['trigger', 'Avoid'],
  ])('labels %s as "%s"', async (verdict, label) => {
    await render(<VerdictBadge verdict={verdict} />);
    expect(VERDICT_LABELS[verdict]).toBe(label);
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('sits at the start of its row unless the screen says otherwise', async () => {
    await render(<VerdictBadge verdict="trigger" />);
    expect(StyleSheet.flatten(screen.getByLabelText('Avoid').props.style).alignSelf).toBe('flex-start');
  });

  it('takes a style override, e.g. to centre it', async () => {
    await render(<VerdictBadge verdict="trigger" style={{ alignSelf: 'center' }} />);
    expect(StyleSheet.flatten(screen.getByLabelText('Avoid').props.style).alignSelf).toBe('center');
  });
});
