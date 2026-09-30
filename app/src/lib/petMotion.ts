/**
 * Pure helpers for the pet's tap response, kept separate from Reanimated so they can
 * be unit-tested. Taps are play only: nothing here touches pet progress, mood or stage.
 */

/** Maximum tilt when the finger lands on the very edge of the pet. */
export const MAX_TILT_Y_DEG = 22;
export const MAX_TILT_X_DEG = 14;

/** Minimum gap between tap reactions, so button-mashing cycles instead of stacking. */
export const TAP_COOLDOWN_MS = 600;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Tilts the pet toward the touch point, as if pressing on a physical object:
 * touching the right side turns the right side away (positive rotateY), touching
 * the top tips the top away (positive rotateX).
 */
export function tiltFromTouch(x: number, y: number, width: number, height: number) {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0 };
  const dx = clamp((x - width / 2) / (width / 2), -1, 1);
  const dy = clamp((y - height / 2) / (height / 2), -1, 1);
  return { rotateY: dx * MAX_TILT_Y_DEG, rotateX: -dy * MAX_TILT_X_DEG };
}

/** Friendly lines shown in the speech bubble; each tap picks the next one. */
export const HAPPY_LINES = [
  'Hi!',
  'Thanks for checking in',
  'Wheee!',
  'You’re doing great',
  'Woof!',
] as const;

export function lineForTap(tapCount: number): string {
  return HAPPY_LINES[tapCount % HAPPY_LINES.length] ?? 'Hi!';
}
