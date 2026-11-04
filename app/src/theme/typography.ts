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
 * warm one-liners, 18pt or larger); Nunito does the work (labels, rows, chips, buttons, data).
 * Sizes are in points and scale with the OS text-size setting. Gaegu tracking is -3%.
 * Every text in the app takes its size from here; do not set fontSize or lineHeight elsewhere.
 */
export const typography = {
  hero: { fontFamily: fontFamily.voiceBold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  display: { fontFamily: fontFamily.voiceBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.96 },
  displaySmall: { fontFamily: fontFamily.voiceBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.72 },
  voice: { fontFamily: fontFamily.voice, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },
  voiceSmall: { fontFamily: fontFamily.voice, fontSize: 18, lineHeight: 22, letterSpacing: -0.54 },
  // Headings, sheet and screen titles: the Figma "Belly/Section" style (it also replaced "Belly/Title").
  section: { fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24 },
  sectionSm: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 22 },
  // The one instruction to read at a time, at arm's length: a recipe's step card (Figma 29e3).
  lead: { fontFamily: fontFamily.regular, fontSize: 18, lineHeight: 25 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyEm: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  // The short line under a heading.
  subtitle: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 19 },
  // 12pt Nunito reads tight, so labels and captions get a little tracking.
  label: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
