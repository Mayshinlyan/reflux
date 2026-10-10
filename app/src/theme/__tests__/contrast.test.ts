import { darkColors, lightColors, type Palette } from '../colors';

/** WCAG 2.x relative luminance of a "#RRGGBB" color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

// Every text-on-background pairing the app uses. WCAG AA for body text is 4.5:1.
const PAIRS: [text: keyof Palette, background: keyof Palette][] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'surface2'],
  ['inkSoft', 'bg'],
  ['inkSoft', 'surface'],
  ['inkSoft', 'surface2'],
  ['clayInk', 'bg'],
  ['clayInk', 'clayTint'],
  ['sageInk', 'bg'],
  ['sageInk', 'sageTint'],
  ['honeyInk', 'honeyTint'],
  ['redInk', 'redTint'],
  ['ctaInk', 'cta'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s palette contrast', (_name, palette) => {
  it.each(PAIRS)('%s text on %s meets WCAG AA (4.5:1)', (text, background) => {
    expect(contrast(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5);
  });
});
