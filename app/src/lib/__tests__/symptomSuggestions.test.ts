import { suggestSymptoms } from '../symptomSuggestions';

describe('suggestSymptoms', () => {
  it('lists the symptoms that match, word starts first', () => {
    const labels = suggestSymptoms('h').map((item) => item.label);

    // Heartburn and Hoarse voice start with an h; the rest only have one inside a word.
    expect(labels.slice(0, 2)).toEqual(['Hoarse voice', 'Heartburn']);
  });

  it('offers the symptoms the user added themselves', () => {
    expect(suggestSymptoms('hic', ['Hiccups']).map((item) => item.label)).toEqual(['Hiccups']);
  });

  it('says where the typed part matches, for the bold', () => {
    expect(suggestSymptoms('burn')[0]).toMatchObject({ label: 'Heartburn', matchStart: 5, matchLength: 4 });
  });

  it('suggests nothing for nothing typed', () => {
    expect(suggestSymptoms('  ')).toEqual([]);
  });
});
