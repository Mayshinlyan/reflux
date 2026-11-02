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
  displaySmall: { fontFamily: fontFamily.voiceBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.84 },
  voice: { fontFamily: fontFamily.voice, fontSize: 22, lineHeight: 26, letterSpacing: -0.66 },
  voiceSmall: { fontFamily: fontFamily.voice, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },
  // Headings, sheet and screen titles: the Figma "Belly/Section" style (it also replaced "Belly/Title").
  section: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26 },
  sectionSm: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  // The one instruction to read at a time, at arm's length: a recipe's step card (Figma 29e3).
  lead: { fontFamily: fontFamily.regular, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: fontFamily.regular, fontSize: 17, lineHeight: 25.5 },
  bodyEm: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 25.5 },
  small: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  // The short line under a heading.
  subtitle: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21 },
  // 13pt Nunito reads tight, so labels and captions get a little tracking.
  label: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
