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

/** Shown in the Kitchen while recipe ideas are made, which takes longer than a meal check (Figma row 29c). */
const RECIPE_MESSAGES = [
  'Bellie is cooking up ideas…',
  'Choosing foods that go easy on you…',
  'Writing out the steps…',
  'Almost there…',
] as const;

/** Shown on My fridge while the photos are read (Figma 29m). */
const FRIDGE_MESSAGES = [
  'Bellie is looking through your fridge…',
  'Reading the shelves…',
  'Making your list…',
  'Almost there…',
] as const;

/** Shown on the voice log while Bellie works out what was said (Figma 45c). */
const VOICE_MESSAGES = [
  'Listening back…',
  'Working out what you said…',
  'Sorting food from how you feel…',
  'Almost there…',
] as const;

/** Shown on the prep day while the dishes are put into one cooking session (Figma E2c). */
const PREP_MESSAGES = [
  'Bellie is lining up your prep…',
  'Finding what the dishes share…',
  'Putting the steps in order…',
  'Almost there…',
] as const;

export type LoadingSource = 'text' | 'photo' | 'correction' | 'recipes' | 'fridge' | 'voice' | 'prep';

const MESSAGES: Record<LoadingSource, readonly string[]> = {
  text: TEXT_MESSAGES,
  photo: PHOTO_MESSAGES,
  correction: CORRECTION_MESSAGES,
  recipes: RECIPE_MESSAGES,
  fridge: FRIDGE_MESSAGES,
  voice: VOICE_MESSAGES,
  prep: PREP_MESSAGES,
};

/** Reassuring progress lines, so a wait feels like work is happening. Stays on the last one. */
export function loadingMessage(step: number, source: LoadingSource): string {
  const messages = MESSAGES[source];
  return messages[Math.min(Math.max(step, 0), messages.length - 1)] ?? TEXT_MESSAGES[0];
}
