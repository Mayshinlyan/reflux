import { plainText } from '../plainText';

describe('plainText', () => {
  it('turns trigger codes into plain words', () => {
    expect(plainText('A very large portion could still add a large_portion effect.')).toBe(
      'A very large portion could still add a large portion effect.',
    );
    expect(plainText('Fried, so high_fat applies, and raw_garlic_onion too.')).toBe(
      'Fried, so high-fat applies, and raw garlic or onion too.',
    );
  });

  it('capitalizes a code that starts a sentence', () => {
    expect(plainText('large_portion adds risk. spicy_food is next. high_fat helps.')).toBe(
      'Large portion adds risk. Spicy food is next. High-fat helps.',
    );
  });

  it('leaves ordinary text alone', () => {
    expect(plainText('Grilled salmon with rice, mild and low in fat.')).toBe(
      'Grilled salmon with rice, mild and low in fat.',
    );
  });
});
