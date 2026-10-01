import { render, screen } from '@testing-library/react-native';

import type { AppVerdict } from '@/types/analysis';

import { VERDICT_LABELS, VerdictBadge } from '../VerdictBadge';

describe('VerdictBadge', () => {
  it.each<[AppVerdict, string]>([
    ['good', 'OK'],
    ['ok', 'Likely OK'],
    ['caution', 'Caution'],
    ['trigger', 'Likely trigger'],
  ])('labels %s as "%s"', async (verdict, label) => {
    await render(<VerdictBadge verdict={verdict} />);
    expect(VERDICT_LABELS[verdict]).toBe(label);
    expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
  });
});
