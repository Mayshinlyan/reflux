import type { PetMood } from './petProgress';

/**
 * Which pre-rendered clip the pet plays. The clips are transparent animated WebPs built
 * from the green-screen videos by art/build-clips.sh. Pure, so it can be unit-tested
 * away from the image view.
 */
export type PetClip = 'idle_happy' | 'idle_unwell' | 'idle_neutral' | 'celebrate';

/** Clip canvas is 380x360; the pet is laid out with this height-to-width ratio. */
export const PET_ASPECT = 360 / 380;

/**
 * The celebrate clip is 60 frames at 15 fps, played once (FPS and the loop count of 1 in
 * art/build-clips.sh). Change them together.
 */
export const CELEBRATE_MS = 4000;

type Input = {
  mood: PetMood;
  /** False until the first entry is logged: a brand-new pet just sits there. */
  hasLogs: boolean;
  celebrating: boolean;
};

export function clipFor({ mood, hasLogs, celebrating }: Input): PetClip {
  if (celebrating) return 'celebrate';
  if (mood === 'unwell') return 'idle_unwell';
  return hasLogs ? 'idle_happy' : 'idle_neutral';
}

/** The still shown with reduced motion (and before a clip loads). */
export function posterFor(mood: PetMood): 'poster_happy' | 'poster_unwell' {
  return mood === 'unwell' ? 'poster_unwell' : 'poster_happy';
}
