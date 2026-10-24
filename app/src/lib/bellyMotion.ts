/**
 * Pure helpers for the belly's tap response, kept apart from Reanimated so they can be unit-tested.
 * (Ported from the old pet.) Tapping the belly is play and a way into the Log page; it never changes data.
 */

/** Maximum tilt when the finger lands on the very edge. */
export const MAX_TILT_Y_DEG = 22;
export const MAX_TILT_X_DEG = 14;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Tilts the belly toward the touch point, as if pressing on a physical object: touching the right side
 * turns the right side away (positive rotateY), touching the top tips the top away (positive rotateX).
 */
export function tiltFromTouch(x: number, y: number, width: number, height: number) {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0 };
  const dx = clamp((x - width / 2) / (width / 2), -1, 1);
  const dy = clamp((y - height / 2) / (height / 2), -1, 1);
  // `0 - …` rather than a leading minus, so a centred touch gives 0 and not -0.
  return { rotateY: dx * MAX_TILT_Y_DEG, rotateX: 0 - dy * MAX_TILT_X_DEG };
}
