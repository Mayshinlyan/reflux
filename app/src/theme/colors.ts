/**
 * Color tokens, ported 1:1 from the `:root` block of docs/design/style-guide.html.
 * Do not invent new values here — change the style guide first.
 * Dark mode ships in Milestone 2; the palette is defined now so the structure is ready.
 */

export const lightColors = {
  bg: '#FBF7F2',
  surface: '#FFFFFF',
  surface2: '#F6F1EA',
  ink: '#2E2A26',
  inkSoft: '#635A52',
  hairline: '#EDE6DD',
  clay: '#C8664A',
  clayInk: '#8A4531',
  clayTint: '#F3E3DC',
  sage: '#8BA888',
  sageInk: '#4F6B4C',
  sageTint: '#EAF0E8',
  honey: '#D9A441',
  honeyInk: '#8A5F1E',
  honeyTint: '#FBF1DE',
  red: '#C4553D',
  redInk: '#8B3B29',
  redTint: '#F7E5DF',
  cta: '#B2543A',
  ctaInk: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof lightColors;
export type Palette = Record<ColorToken, string>;

export const darkColors: Palette = {
  bg: '#1F1B18',
  surface: '#2A2521',
  surface2: '#332D28',
  ink: '#F3ECE4',
  inkSoft: '#B3A89D',
  hairline: '#3D362F',
  clay: '#E08260',
  clayInk: '#F2C4B0',
  clayTint: '#3A2620',
  sage: '#A3C29E',
  sageInk: '#C9DDC5',
  sageTint: '#263427',
  honey: '#E8BD6A',
  honeyInk: '#F0D39A',
  honeyTint: '#3A2E14',
  red: '#DD7A62',
  redInk: '#F0AC98',
  redTint: '#3A2018',
  // The style guide doesn't define a dark CTA yet; reuse light until M2 dark mode.
  cta: lightColors.cta,
  ctaInk: lightColors.ctaInk,
};

/** Verdict colors are always paired with an icon + label, never used alone. */
export type Verdict = 'ok' | 'caution' | 'trigger';

export const verdictColors: Record<Verdict, { fg: ColorToken; bg: ColorToken; accent: ColorToken }> = {
  ok: { fg: 'sageInk', bg: 'sageTint', accent: 'sage' },
  caution: { fg: 'honeyInk', bg: 'honeyTint', accent: 'honey' },
  trigger: { fg: 'redInk', bg: 'redTint', accent: 'red' },
};
