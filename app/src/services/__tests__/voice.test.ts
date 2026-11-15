import { AppError } from '@/lib/errors';

import { fetchVoiceLog } from '../relayClient';
import { localIso, toHeard, understand, VoiceError } from '../voice';

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

    expect(heard.foods).toEqual(['Pasta', 'Glass of wine']);
    expect(heard.symptoms).toEqual(['heartburn', 'custom:Hiccups']);
    expect(heard.at?.toISOString()).toBe('2026-11-14T04:00:00.000Z');
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

    expect(heard.foods).toEqual(['Toast']);
    const [uri, context] = mockFetch.mock.calls[0] ?? [];
    expect(uri).toBe('file:///voice.m4a');
    expect(context).toMatchObject({ foods: ['Oatmeal'], symptoms: ['Heartburn'] });
    expect(context?.now).toMatch(/[+-]\d{2}:\d{2}$/);
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
