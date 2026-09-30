import { loadingMessage } from '../loadingMessages';

describe('loadingMessage', () => {
  it('starts with a line that matches what is being looked at', () => {
    expect(loadingMessage(0, 'text')).toBe('Looking at your food…');
    expect(loadingMessage(0, 'photo')).toBe('Looking at your photo…');
  });

  it('moves through reassuring lines and then stays on the last one', () => {
    const lines = [0, 1, 2, 3, 4, 10].map((step) => loadingMessage(step, 'text'));
    expect(lines.slice(0, 4)).toEqual([
      'Looking at your food…',
      'Checking for reflux triggers…',
      'Working out the ingredients…',
      'Almost there…',
    ]);
    expect(lines[4]).toBe('Almost there…');
    expect(lines[5]).toBe('Almost there…');
  });

  it('never goes out of range for a bad step', () => {
    expect(loadingMessage(-3, 'text')).toBe('Looking at your food…');
  });
});
