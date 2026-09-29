import {
  HAPPY_LINES,
  lineForTap,
  MAX_TILT_X_DEG,
  MAX_TILT_Y_DEG,
  nextReaction,
  tiltFromTouch,
} from '../petMotion';

describe('tiltFromTouch', () => {
  it('does not tilt when touched in the centre', () => {
    expect(tiltFromTouch(100, 100, 200, 200)).toEqual({ rotateX: -0, rotateY: 0 });
  });

  it('turns the touched side away', () => {
    expect(tiltFromTouch(200, 100, 200, 200).rotateY).toBe(MAX_TILT_Y_DEG);
    expect(tiltFromTouch(0, 100, 200, 200).rotateY).toBe(-MAX_TILT_Y_DEG);
    expect(tiltFromTouch(100, 0, 200, 200).rotateX).toBe(MAX_TILT_X_DEG);
    expect(tiltFromTouch(100, 200, 200, 200).rotateX).toBe(-MAX_TILT_X_DEG);
  });

  it('clamps touches outside the pet and ignores zero-size layouts', () => {
    expect(tiltFromTouch(900, 100, 200, 200).rotateY).toBe(MAX_TILT_Y_DEG);
    expect(tiltFromTouch(10, 10, 0, 0)).toEqual({ rotateX: 0, rotateY: 0 });
  });
});

describe('tap cycling', () => {
  it('cycles hop → spin → wiggle', () => {
    expect([0, 1, 2, 3].map(nextReaction)).toEqual(['hop', 'spin', 'wiggle', 'hop']);
  });

  it('picks a different line on each tap and wraps around', () => {
    expect(lineForTap(0)).not.toBe(lineForTap(1));
    expect(lineForTap(HAPPY_LINES.length)).toBe(lineForTap(0));
  });
});
