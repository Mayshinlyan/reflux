import { posterFor, viewFor } from '../petClips';

const base = {
  mood: 'happy' as const,
  celebrating: false,
  reacting: false,
  active: true,
  reduceMotion: false,
};

describe('viewFor', () => {
  it('shows a still pet at rest, matching its mood', () => {
    expect(viewFor(base)).toEqual({ kind: 'still', poster: 'poster_happy' });
    expect(viewFor({ ...base, mood: 'unwell' })).toEqual({ kind: 'still', poster: 'poster_unwell' });
  });

  it('plays the mood clip for a tap', () => {
    expect(viewFor({ ...base, reacting: true })).toEqual({ kind: 'clip', clip: 'react_happy' });
    expect(viewFor({ ...base, mood: 'unwell', reacting: true })).toEqual({
      kind: 'clip',
      clip: 'react_unwell',
    });
  });

  it('celebrates over a tap reaction', () => {
    expect(viewFor({ ...base, celebrating: true, reacting: true })).toEqual({
      kind: 'clip',
      clip: 'celebrate',
    });
  });

  it('plays nothing off screen or with reduced motion', () => {
    const due = { ...base, celebrating: true, reacting: true };
    expect(viewFor({ ...due, active: false })).toEqual({ kind: 'still', poster: 'poster_happy' });
    expect(viewFor({ ...due, reduceMotion: true })).toEqual({ kind: 'still', poster: 'poster_happy' });
  });
});

describe('posterFor', () => {
  it('picks the still that matches the mood', () => {
    expect(posterFor('happy')).toBe('poster_happy');
    expect(posterFor('unwell')).toBe('poster_unwell');
  });
});
