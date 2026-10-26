import { CARD_MARGIN, holeFor, placeCard, TAIL_WIDTH } from '../layout';

const SCREEN = { width: 402, height: 874 };
const NO_INSETS = { top: 0, bottom: 0 };

describe('holeFor', () => {
  it('pads the target on every side', () => {
    expect(holeFor({ x: 100, y: 200, width: 50, height: 40 }, 8, SCREEN)).toEqual({
      x: 92,
      y: 192,
      width: 66,
      height: 56,
    });
  });

  it('keeps the cut-out on the screen', () => {
    expect(holeFor({ x: 2, y: 860, width: 400, height: 20 }, 8, SCREEN)).toEqual({
      x: 0,
      y: 852,
      width: 402,
      height: 22,
    });
  });
});

describe('placeCard', () => {
  it('centres the card when there is no target', () => {
    const placed = placeCard(null, SCREEN, 200, NO_INSETS);
    expect(placed.top).toBe(337);
    expect(placed.tail).toBeNull();
    expect(placed.left).toBe(CARD_MARGIN);
    expect(placed.width).toBe(SCREEN.width - 2 * CARD_MARGIN);
  });

  it('puts the card below a target near the top, with the tail on its top edge', () => {
    const hole = { x: 61, y: 247, width: 280, height: 296 };
    const placed = placeCard(hole, SCREEN, 230, NO_INSETS);
    expect(placed.top).toBe(247 + 296 + 14);
    expect(placed.tail?.side).toBe('below');
  });

  it('puts the card above a target at the bottom, with the tail on its bottom edge', () => {
    const hole = { x: 95, y: 790, width: 76, height: 60 };
    const placed = placeCard(hole, SCREEN, 230, NO_INSETS);
    expect(placed.top).toBe(790 - 14 - 230);
    expect(placed.tail?.side).toBe('above');
  });

  it('points the tail at the middle of the target', () => {
    const hole = { x: 190, y: 100, width: 22, height: 40 };
    const placed = placeCard(hole, SCREEN, 200, NO_INSETS);
    // The middle of the target is x = 201, so the tail's left edge is half its width before that.
    expect(placed.tail?.left).toBe(201 - TAIL_WIDTH / 2);
  });

  it('keeps the tail inside the card’s rounded corners for a target at the edge', () => {
    const left = placeCard({ x: 0, y: 100, width: 20, height: 20 }, SCREEN, 200, NO_INSETS);
    const right = placeCard({ x: 382, y: 100, width: 20, height: 20 }, SCREEN, 200, NO_INSETS);
    expect(left.tail?.left).toBe(CARD_MARGIN + 28);
    expect(right.tail?.left).toBe(SCREEN.width - CARD_MARGIN - 28 - TAIL_WIDTH);
  });

  it('keeps the card clear of the home indicator and the status bar', () => {
    const insets = { top: 59, bottom: 34 };
    const tall = placeCard({ x: 100, y: 400, width: 50, height: 50 }, SCREEN, 900, insets);
    expect(tall.top).toBeGreaterThanOrEqual(insets.top + CARD_MARGIN);
    const low = placeCard({ x: 100, y: 500, width: 50, height: 50 }, SCREEN, 400, insets);
    expect(low.top + 400).toBeLessThanOrEqual(SCREEN.height - insets.bottom - CARD_MARGIN);
  });

  it('caps the card’s width on a wide screen and centres it', () => {
    const placed = placeCard(null, { width: 820, height: 1180 }, 200, NO_INSETS);
    expect(placed.width).toBe(400);
    expect(placed.left).toBe(210);
  });
});
