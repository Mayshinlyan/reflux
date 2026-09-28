import { Text, type TextProps } from 'react-native';

import { type ColorToken, typography, type TypographyVariant, useColors } from '@/theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
};

export function AppText({ variant = 'body', color = 'ink', style, ...rest }: Props) {
  const colors = useColors();
  return <Text {...rest} style={[typography[variant], { color: colors[color] }, style]} />;
}
