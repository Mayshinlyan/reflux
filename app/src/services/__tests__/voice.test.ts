import { AppError } from '@/lib/errors';

import { fetchVoiceLog } from '../relayClient';
import { localIso, mealTitle, toHeard, understand, VoiceError } from '../voice';

jest.mock('expo-audio', () => ({
  getRecordingPermissionsAsync: jest.fn(),
  requestRecordingPermissionsAsync: jest.fn(),
}));
jest.mock('../relayClient', () => ({ fetchVoiceLog: jest.fn() }));

const mockFetch = jest.mocked(fetchVoiceLog);
const WORDS = { foods: ['Oatmeal'], symptoms: ['Heartburn'] };

describe('toHeard', () => {
  it('keeps built-in symptoms as keys and turns other words into the person own symptom', () => {
    const heard = toHeard({
      foods: ['pasta', ' glass of wine ', 'Pasta'],
      symptoms: ['heartburn', 'Hiccups', 'heartburn'],
      at: '2026-11-13T20:00:00-08:00',
    });

    // A relay from before meals: one list of foods and one time become one meal with no label.
    expect(heard.meals).toEqual([
      { label: null, foods: ['Pasta', 'Glass of wine'], at: new Date('2026-11-14T04:00:00.000Z') },
    ]);
    expect(heard.symptoms).toEqual(['heartburn', 'custom:Hiccups']);
    // With a meal, the symptoms take no time of their own.
    expect(heard.at).toBeNull();
  });

  it('keeps each meal with its own label, foods and time', () => {
    const heard = toHeard({
      foods: ['ignored'],
      symptoms: [],
      at: null,
      meals: [
        { label: 'lunch', foods: ['chicken salad', 'iced tea'], at: '2026-11-13T12:30:00-08:00' },
        { label: 'snack', foods: ['granola bar'], at: '2026-11-13T15:45:00-08:00' },
        { label: 'dinner', foods: ['pasta', 'Iced tea'], at: '2026-11-13T19:00:00-08:00' },
      ],
    });

    expect(heard.meals.map((meal) => meal.label)).toEqual(['lunch', 'snack', 'dinner']);
    expect(heard.meals.map((meal) => meal.foods)).toEqual([
      ['Chicken salad', 'Iced tea'],
      ['Granola bar'],
      ['Pasta', 'Iced tea'],
    ]);
    expect(heard.meals.map((meal) => meal.at?.toISOString())).toEqual([
      '2026-11-13T20:30:00.000Z',
      '2026-11-13T23:45:00.000Z',
      '2026-11-14T03:00:00.000Z',
    ]);
  });

  it('drops a meal with no foods, an unknown label, and meals beyond five', () => {
    const heard = toHeard({
      foods: [],
      symptoms: [],
      at: null,
      meals: [
        { label: 'brunch', foods: ['eggs'], at: null },
        { label: 'lunch', foods: ['  '], at: null },
        ...Array.from({ length: 6 }, (_, index) => ({ label: 'snack', foods: [`food ${index}`], at: null })),
      ],
    });

    expect(heard.meals[0]).toEqual({ label: null, foods: ['Eggs'], at: null });
    expect(heard.meals.every((meal) => meal.foods.length > 0)).toBe(true);
    expect(heard.meals.length).toBeLessThanOrEqual(5);
  });

  it('uses the symptoms time only when nothing was eaten', () => {
    const symptomsOnly = toHeard({ foods: [], symptoms: ['heartburn'], at: '2026-11-13T08:00:00-08:00' });
    expect(symptomsOnly.meals).toEqual([]);
    expect(symptomsOnly.at?.toISOString()).toBe('2026-11-13T16:00:00.000Z');

    const withMeal = toHeard({
      foods: [],
      symptoms: ['heartburn'],
      at: '2026-11-13T08:00:00-08:00',
      meals: [{ label: 'dinner', foods: ['pasta'], at: null }],
    });
    expect(withMeal.at).toBeNull();
  });

  it('titles a meal by the label, or Food when it has none', () => {
    expect(mealTitle({ label: 'dinner' })).toBe('Dinner');
    expect(mealTitle({ label: 'snack' })).toBe('Snack');
    expect(mealTitle({ label: null })).toBe('Food');
  });

  it('knows a built-in symptom by its label, in any capitals', () => {
    const heard = toHeard({ foods: [], symptoms: ['hoarse voice', 'LUMP IN THROAT', 'Heartburn'], at: null });

    expect(heard.symptoms).toEqual(['hoarseness', 'lump', 'heartburn']);
  });

  it('spells a symptom the way the person already saved it, whatever the capitals', () => {
    const heard = toHeard({ foods: [], symptoms: ['hiccups', 'HICCUPS', 'dry mouth'], at: null }, [
      'Hiccups',
      'Sore gums',
    ]);

    // The two hiccups are one symptom, in the saved spelling; a new one is capitalised.
    expect(heard.symptoms).toEqual(['custom:Hiccups', 'custom:Dry mouth']);
  });

  it('skips a blank symptom', () => {
    expect(toHeard({ foods: [], symptoms: ['  ', ''], at: null }).symptoms).toEqual([]);
  });

  it('turns a retired symptom into the person own words and a bad time into now', () => {
    const heard = toHeard({ foods: [], symptoms: ['sleep'], at: 'not a time' });

    expect(heard.symptoms).toEqual(['custom:Sleep']);
    expect(heard.at).toBeNull();
  });
});

describe('localIso', () => {
  it('writes the local time with its UTC offset', () => {
    expect(localIso(new Date(2026, 10, 13, 21, 30, 5))).toMatch(/^2026-11-13T21:30:05[+-]\d{2}:\d{2}$/);
  });
});

describe('understand', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends the recording with the phone clock and the person own words', async () => {
    mockFetch.mockResolvedValue({
      transcript: 'I had toast',
      foods: ['toast'],
      symptoms: [],
      at: null,
    });

    const heard = await understand('file:///voice.m4a', WORDS);

    expect(heard.meals.map((meal) => meal.foods)).toEqual([['Toast']]);
    const [uri, context] = mockFetch.mock.calls[0] ?? [];
    expect(uri).toBe('file:///voice.m4a');
    expect(context).toMatchObject({ foods: ['Oatmeal'], symptoms: ['Heartburn'] });
    expect(context?.now).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('returns each meal the relay sorted, each at its own time', async () => {
    mockFetch.mockResolvedValue({
      transcript: 'lunch was a salad and dinner was pasta',
      foods: ['Salad', 'Pasta'],
      symptoms: [],
      at: '2026-11-13T19:00:00-08:00',
      meals: [
        { label: 'lunch', foods: ['Salad'], at: '2026-11-13T12:30:00-08:00' },
        { label: 'dinner', foods: ['Pasta'], at: '2026-11-13T19:00:00-08:00' },
      ],
    });

    const heard = await understand('file:///voice.m4a', WORDS);

    expect(heard.meals.map((meal) => [meal.label, meal.foods])).toEqual([
      ['lunch', ['Salad']],
      ['dinner', ['Pasta']],
    ]);
    expect(heard.meals[0]?.at?.getTime()).toBeLessThan(heard.meals[1]?.at?.getTime() ?? 0);
  });

  it('says nothing was heard when there is no food or symptom, or no recording', async () => {
    mockFetch.mockResolvedValue({ transcript: 'hello', foods: [], symptoms: [], at: null });

    await expect(understand('file:///voice.m4a', WORDS)).rejects.toMatchObject({ problem: 'nothing' });
    await expect(understand(null, WORDS)).rejects.toMatchObject({ problem: 'nothing' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('says nothing was heard when the relay turns the recording down, and offline for anything else', async () => {
    mockFetch.mockRejectedValueOnce(new AppError('INPUT_REJECTED', 'r1'));
    await expect(understand('file:///voice.m4a', WORDS)).rejects.toMatchObject({ problem: 'nothing' });

    mockFetch.mockRejectedValueOnce(new AppError('NETWORK', 'r2'));
    await expect(understand('file:///voice.m4a', WORDS)).rejects.toBeInstanceOf(VoiceError);
    mockFetch.mockRejectedValueOnce(new AppError('RATE_LIMITED', 'r3'));
    await expect(understand('file:///voice.m4a', WORDS)).rejects.toMatchObject({ problem: 'offline' });
  });

  it('shows a problem on purpose without calling the relay', async () => {
    await expect(understand('file:///voice.m4a', WORDS, 'offline')).rejects.toMatchObject({
      problem: 'offline',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
