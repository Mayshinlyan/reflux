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

  it("uses lines about the user's comment when re-checking a verdict", () => {
    expect([0, 1, 2, 3].map((step) => loadingMessage(step, 'correction'))).toEqual([
      'Reading your comment…',
      'Taking your feedback into account…',
      'Updating the verdict…',
      'Almost there…',
    ]);
  });

  it('uses lines about cooking while the Kitchen makes recipe ideas', () => {
    expect([0, 1, 2, 3, 9].map((step) => loadingMessage(step, 'recipes'))).toEqual([
      'Bellie is cooking up ideas…',
      'Choosing foods that go easy on you…',
      'Writing out the steps…',
      'Almost there…',
      'Almost there…',
    ]);
  });

  it('never goes out of range for a bad step', () => {
    expect(loadingMessage(-3, 'text')).toBe('Looking at your food…');
  });
});
