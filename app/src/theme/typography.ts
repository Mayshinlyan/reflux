import type { TextStyle } from 'react-native';

/** Font weights loaded in the root layout (see `useFonts` there). */
export const fontFamily = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  voice: 'Gaegu_400Regular',
  voiceBold: 'Gaegu_700Bold',
} as const;

/**
 * Type scale from the Figma "Belly/*" text styles. Gaegu is the voice (headlines, greetings,
 * warm one-liners, 20pt or larger); Nunito does the work (labels, rows, chips, buttons, data).
 * Sizes are in points and scale with the OS text-size setting. Gaegu tracking is -3%.
 */
export const typography = {
  hero: { fontFamily: fontFamily.voiceBold, fontSize: 46, lineHeight: 50, letterSpacing: -1.38 },
  display: { fontFamily: fontFamily.voiceBold, fontSize: 38, lineHeight: 42, letterSpacing: -1.14 },
  voice: { fontFamily: fontFamily.voice, fontSize: 22, lineHeight: 26, letterSpacing: -0.66 },
  voiceSmall: { fontFamily: fontFamily.voice, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },
  section: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 },
  title: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25.5 },
  bodyEm: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 25.5 },
  small: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
