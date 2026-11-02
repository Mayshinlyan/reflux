import { isLook, LOOK_COUNT, LOOKS, lookFor, lookForRound } from '../recipeLook';

describe('looks', () => {
  it('are five, each on its own colour', () => {
    expect(LOOK_COUNT).toBe(5);
    expect(new Set(LOOKS.map((look) => look.tint)).size).toBe(5);
    expect(new Set(LOOKS.map((look) => look.key)).size).toBe(5);
  });

  it('give the three ideas of any round three different looks', () => {
    for (let round = 0; round < 40; round += 1) {
      const looks = [0, 1, 2].map((index) => lookForRound(round, index));
      expect(new Set(looks).size).toBe(3);
      for (const look of looks) expect(isLook(look)).toBe(true);
    }
  });

  it('start the next round on a different picture', () => {
    for (let round = 0; round < 20; round += 1) {
      expect(lookForRound(round + 1, 0)).not.toBe(lookForRound(round, 0));
    }
  });

  it('use every look over a few rounds', () => {
    const seen = new Set<number>();
    for (let round = 0; round < 5; round += 1)
      for (let index = 0; index < 3; index += 1) seen.add(lookForRound(round, index));
    expect(seen.size).toBe(5);
  });

  it('treat a bad round number as the first round', () => {
    expect(lookForRound(-3, 0)).toBe(lookForRound(0, 0));
  });
});

describe('lookFor', () => {
  it('keeps the look a recipe has', () => {
    expect(lookFor({ title: 'Kimchi egg fried rice', look: 3 })).toBe(3);
  });

  it('works one out from the name when a recipe has none, the same every time', () => {
    const first = lookFor({ title: 'Miso salmon bowl' });
    expect(isLook(first)).toBe(true);
    expect(lookFor({ title: 'Miso salmon bowl' })).toBe(first);
  });

  it('does not trust a look that is not one of the five', () => {
    for (const look of [5, -1, 1.5, Number.NaN]) {
      expect(isLook(lookFor({ title: 'Miso salmon bowl', look }))).toBe(true);
      expect(lookFor({ title: 'Miso salmon bowl', look })).toBe(lookFor({ title: 'Miso salmon bowl' }));
    }
  });
});
