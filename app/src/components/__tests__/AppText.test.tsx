import { render, screen } from '@testing-library/react-native';

import { AppText } from '../AppText';

describe('AppText', () => {
  it('caps text scaling at 1.4 for body text and 1.2 for headlines', async () => {
    await render(
      <>
        <AppText>body</AppText>
        <AppText variant="display">headline</AppText>
      </>,
    );
    expect(screen.getByText('body').props.maxFontSizeMultiplier).toBe(1.4);
    expect(screen.getByText('headline').props.maxFontSizeMultiplier).toBe(1.2);
  });

  it('lets a caller override the cap', async () => {
    await render(<AppText maxFontSizeMultiplier={2}>big</AppText>);
    expect(screen.getByText('big').props.maxFontSizeMultiplier).toBe(2);
  });

  it('drops the extra Android font padding', async () => {
    await render(<AppText>text</AppText>);
    expect(screen.getByText('text')).toHaveStyle({ includeFontPadding: false });
  });
});
