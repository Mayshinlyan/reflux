/**
 * Color tokens, ported from the "Belly" design system in Figma (file GJLZZ8WEpLW1sf3TIgyXUU,
 * "Design Systems" page). docs/design/style-guide.html mirrors them.
 * Do not invent new values here — change Figma and the style guide first.
 * Dark mode ships in Milestone 2; the palette is defined now so the structure is ready.
 */

import type { AppVerdict } from '@/types/analysis';

export const lightColors = {
  bg: '#FAF1DE',
  surface: '#FFFBF3',
  surface2: '#ECDAB9',
  ink: '#3A2F25',
  inkSoft: '#75675A',
  hairline: '#EBDCC2',
  clay: '#C8664A',
  clayInk: '#8A4531',
  clayTint: '#F3D3C0',
  sage: '#8E9A6D',
  sageInk: '#55612F',
  sageTint: '#D8E0B6',
  good: '#5E8F63',
  goodInk: '#2F5A3A',
  goodTint: '#D3E8D6',
  honey: '#D9A441',
  // Figma has #8A5F1E; nudged darker so it clears WCAG AA (4.5:1) on honeyTint.
  honeyInk: '#855A1A',
  honeyTint: '#F8E3B2',
  red: '#C4553D',
  redInk: '#8B3B29',
  redTint: '#F5D9CF',
  cta: '#5F6B3A',
  ctaInk: '#FAF1DE',
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
  sage: '#A9B58A',
  sageInk: '#C9DDC5',
  sageTint: '#263427',
  good: '#6FB07A',
  goodInk: '#BFE6C4',
  goodTint: '#1E3A26',
  honey: '#E8BD6A',
  honeyInk: '#F0D39A',
  honeyTint: '#3A2E14',
  red: '#DD7A62',
  redInk: '#F0AC98',
  redTint: '#3A2018',
  // The design system doesn't define a dark CTA yet; reuse light until M2 dark mode.
  cta: lightColors.cta,
  ctaInk: lightColors.ctaInk,
};

/** Verdict colors are always paired with an icon + label, never used alone. */
export const verdictColors: Record<AppVerdict, { fg: ColorToken; bg: ColorToken; accent: ColorToken }> = {
  good: { fg: 'goodInk', bg: 'goodTint', accent: 'good' },
  ok: { fg: 'sageInk', bg: 'sageTint', accent: 'sage' },
  caution: { fg: 'honeyInk', bg: 'honeyTint', accent: 'honey' },
  trigger: { fg: 'redInk', bg: 'redTint', accent: 'red' },
};
