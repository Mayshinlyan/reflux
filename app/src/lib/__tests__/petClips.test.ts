import { clipFor, posterFor } from '../petClips';

describe('clipFor', () => {
  it('celebrates over everything else', () => {
    expect(clipFor({ mood: 'unwell', hasLogs: true, celebrating: true })).toBe('celebrate');
  });

  it('follows the mood', () => {
    expect(clipFor({ mood: 'happy', hasLogs: true, celebrating: false })).toBe('idle_happy');
    expect(clipFor({ mood: 'unwell', hasLogs: true, celebrating: false })).toBe('idle_unwell');
  });

  it('uses the calm neutral clip for a pet with no entries yet', () => {
    expect(clipFor({ mood: 'happy', hasLogs: false, celebrating: false })).toBe('idle_neutral');
  });
});

describe('posterFor', () => {
  it('picks the still that matches the mood', () => {
    expect(posterFor('happy')).toBe('poster_happy');
    expect(posterFor('unwell')).toBe('poster_unwell');
  });
});
