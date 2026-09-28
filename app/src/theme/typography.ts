import type { TextStyle } from 'react-native';

/** Nunito weights loaded in the root layout (see `fontAssets`). */
export const fontFamily = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

/**
 * Type scale from docs/design/style-guide.html. Sizes are in points and scale with
 * the OS text-size setting (React Native's default `allowFontScaling`).
 */
export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25 },
  bodyEm: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 25 },
  label: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
