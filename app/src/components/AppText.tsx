import { Text, type TextProps } from 'react-native';

import { type ColorToken, typography, type TypographyVariant, useColors } from '@/theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
};

// Headlines have tight line heights and fixed room around them, so they scale less than body text.
const HEADLINES: readonly TypographyVariant[] = ['hero', 'display', 'voice', 'voiceSmall'];
const HEADLINE_MAX_SCALE = 1.2;
const TEXT_MAX_SCALE = 1.4;

export function AppText({ variant = 'body', color = 'ink', style, ...rest }: Props) {
  const colors = useColors();
  const maxScale = HEADLINES.includes(variant) ? HEADLINE_MAX_SCALE : TEXT_MAX_SCALE;
  return (
    <Text
      maxFontSizeMultiplier={maxScale}
      {...rest}
      style={[typography[variant], { includeFontPadding: false }, { color: colors[color] }, style]}
    />
  );
}
