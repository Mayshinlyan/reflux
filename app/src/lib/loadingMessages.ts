/** How long each message stays before the next one, while the relay is working (a call takes ~5 to 12 s). */
export const LOADING_STEP_MS = 2500;

const TEXT_MESSAGES = [
  'Looking at your food…',
  'Checking for reflux triggers…',
  'Working out the ingredients…',
  'Almost there…',
] as const;

/** Shown while the AI re-checks a verdict with the user's comment (after Save). */
const CORRECTION_MESSAGES = [
  'Reading your comment…',
  'Taking your feedback into account…',
  'Updating the verdict…',
  'Almost there…',
] as const;

const PHOTO_MESSAGES = [
  'Looking at your photo…',
  'Spotting what’s on the plate…',
  'Checking for reflux triggers…',
  'Almost there…',
] as const;

/** Reassuring progress lines, so a wait feels like work is happening. Stays on the last one. */
export function loadingMessage(step: number, source: 'text' | 'photo' | 'correction'): string {
  const messages =
    source === 'correction' ? CORRECTION_MESSAGES : source === 'photo' ? PHOTO_MESSAGES : TEXT_MESSAGES;
  return messages[Math.min(Math.max(step, 0), messages.length - 1)] ?? messages[0];
}
