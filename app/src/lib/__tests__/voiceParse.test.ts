import { suggestSymptoms } from '../symptomSuggestions';
import { parseTranscript } from '../voiceParse';

const EVENING = new Date(2026, 10, 12, 21, 30);

describe('parseTranscript', () => {
  it('finds the foods, the symptom and the time in a spoken log', () => {
    const heard = parseTranscript(
      'I had pasta and a glass of wine around eight, and now my chest is burning a bit',
      EVENING,
    );

    expect(heard.foods).toEqual(['Pasta', 'Glass of wine']);
    expect(heard.symptoms).toEqual(['heartburn']);
    expect(heard.at?.getHours()).toBe(20);
    expect(heard.at?.getDate()).toBe(12);
  });

  it('takes the earlier hour when the later one has not happened yet', () => {
    const morning = new Date(2026, 10, 12, 10, 0);

    expect(parseTranscript('I ate toast around eight', morning).at?.getHours()).toBe(8);
  });

  it('honours am and pm when they are said', () => {
    expect(parseTranscript('I had soup at 7:15 am', EVENING).at).toEqual(new Date(2026, 10, 12, 7, 15));
  });

  it('leaves the time open when none is said', () => {
    expect(parseTranscript('I had soup', EVENING).at).toBeNull();
  });

  it('does not count a cough after eating as a plain cough too', () => {
    expect(parseTranscript('a cough after eating, and heartburn', EVENING).symptoms).toEqual([
      'heartburn',
      'cough_after_eating',
    ]);
  });

  it('finds nothing in words that say neither', () => {
    expect(parseTranscript('hello there', EVENING)).toEqual({ foods: [], symptoms: [], at: null });
  });
});

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
