/** How the trigger codes read in a sentence; any other snake_case word just loses its underscores. */
const PHRASES: Record<string, string> = {
  high_fat: 'high-fat',
  raw_garlic_onion: 'raw garlic or onion',
};

/**
 * AI text for the screen, with internal codes like `large_portion` turned into plain words ("large portion").
 * The relay's prompt names the trigger codes, so the model sometimes writes them into its reasoning.
 */
export function plainText(text: string): string {
  return text.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (code, offset: number) => {
    const phrase = PHRASES[code] ?? code.replace(/_/g, ' ');
    const startsSentence = /(?:^|[.!?]\s+)$/.test(text.slice(0, offset));
    return startsSentence ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
  });
}
