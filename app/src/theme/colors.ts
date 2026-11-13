/**
 * Color tokens, ported from the "Belly" design system in Figma (file GJLZZ8WEpLW1sf3TIgyXUU,
 * "Design Systems" page). docs/design/style-guide.html mirrors them.
 * Do not invent new values here — change Figma and the style guide first.
 * Dark mode ships in Milestone 2; the palette is defined now so the structure is ready.
 */

import type { AppVerdict } from '@/types/analysis';

export const lightColors = {
  // 2026-11-12 palette: a warm near-white page, white cards and a calm greyish-tan surface 2 (was cream #FAF1DE,
  // #FFFBF3 and #ECDAB9).
  bg: '#FFFDF9',
  surface: '#FFFFFF',
  surface2: '#F2EADB',
  ink: '#3A2F25',
  // Figma has #75675A (3.98:1 on surface2); darkened so it clears WCAG AA everywhere.
  inkSoft: '#65574A',
  // Unselected tab icons and footnotes: about 5.7:1 on bg and on surface, 4.8:1 on surface2.
  inkMuted: '#75634F',
  hairline: '#EBDCC2',
  // The 1px soft edge on cards, rows, fields, round buttons and the pills that sit on the page (about 1.4:1 on bg):
  // white shapes on the near-white page would otherwise disappear, and it stays faint enough not to look boxed in.
  edge: '#E6D9C0',
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
  lavenderInk: '#5B4A85',
  lavenderTint: '#E3DCF0',
  roseInk: '#8A3D52',
  roseTint: '#F3D5DC',
  mintInk: '#2F6B58',
  mintTint: '#CFE8DF',
  skyInk: '#3A5F85',
  skyTint: '#D3E4F2',
  cta: '#5F6B3A',
  ctaInk: '#FAF1DE',
} as const;

export type ColorToken = keyof typeof lightColors;
export type Palette = Record<ColorToken, string>;

/** The 1px soft edge on cards and rows; spread it next to the card's `backgroundColor`. */
export const cardEdge = (colors: Palette) => ({ borderWidth: 1, borderColor: colors.edge }) as const;

/**
 * The selected state (Figma "Selected" variants): a light green fill (`sageTint`, see `selectedFill`) plus a 1px
 * olive outline. Unselected keeps a transparent 1px so nothing shifts when it toggles.
 */
export const selectedEdge = (colors: Palette, selected: boolean) =>
  ({ borderWidth: 1, borderColor: selected ? colors.sageInk : 'transparent' }) as const;

/** The fill of anything selectable: light green when selected, otherwise `rest` (`surface` unless it sits on a card). */
export const selectedFill = (colors: Palette, selected: boolean, rest: string = colors.surface) =>
  selected ? colors.sageTint : rest;

/**
 * A pill or chip: selected is light green with the olive outline; unselected on the page is white with the soft
 * `edge`; unselected inside a card rests on `surface2` with no visible edge (still 1px, so nothing shifts).
 */
export const pillStyle = (colors: Palette, selected: boolean, onCard = false) =>
  ({
    backgroundColor: selectedFill(colors, selected, onCard ? colors.surface2 : colors.surface),
    borderWidth: 1,
    borderColor: selected ? colors.sageInk : onCard ? 'transparent' : colors.edge,
  }) as const;

export const darkColors: Palette = {
  bg: '#1F1B18',
  surface: '#2A2521',
  surface2: '#332D28',
  ink: '#F3ECE4',
  inkSoft: '#B3A89D',
  inkMuted: '#7D7268',
  hairline: '#3D362F',
  edge: '#4A4036',
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
  lavenderInk: '#CFC3EA',
  lavenderTint: '#2A2438',
  roseInk: '#EBB4C2',
  roseTint: '#3A1F27',
  mintInk: '#B5E0D0',
  mintTint: '#1B3029',
  skyInk: '#B3D0EA',
  skyTint: '#1C2A38',
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
