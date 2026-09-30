import type { PetMood } from './petProgress';

/**
 * What the pet shows. It is a still image most of the time; a pre-rendered 3D clip plays
 * once when it is tapped (matching its mood) or on a stage-up, then it returns to the
 * still. The clips are transparent WebPs built from the green-screen videos by
 * art/build-clips.sh. Pure, so it can be unit-tested away from the image view.
 */
export type PetClip = 'react_happy' | 'react_unwell' | 'celebrate';
export type PetPoster = 'poster_happy' | 'poster_unwell';
export type PetView = { kind: 'still'; poster: PetPoster } | { kind: 'clip'; clip: PetClip };

/** Clip and poster canvas is 600x700; the pet is laid out with this height-to-width ratio. */
export const PET_ASPECT = 700 / 600;

/**
 * How long each clip runs: frames x 83 ms (12 fps). Must match the frame counts that
 * art/build-clips.sh prints; change them together.
 */
export const CLIP_MS: Record<PetClip, number> = {
  react_happy: 41 * 83,
  react_unwell: 41 * 83,
  celebrate: 48 * 83,
};

type Input = {
  mood: PetMood;
  /** The stage-up celebration is due. */
  celebrating: boolean;
  /** A tap reaction is under way. */
  reacting: boolean;
  /** Today is on screen and the app is in the foreground. */
  active: boolean;
  reduceMotion: boolean;
};

export function posterFor(mood: PetMood): PetPoster {
  return mood === 'unwell' ? 'poster_unwell' : 'poster_happy';
}

export function viewFor({ mood, celebrating, reacting, active, reduceMotion }: Input): PetView {
  // Off screen or with reduced motion, nothing plays. A clip interrupted by leaving
  // Today starts again from its first frame on return.
  if (reduceMotion || !active) return { kind: 'still', poster: posterFor(mood) };
  if (celebrating) return { kind: 'clip', clip: 'celebrate' };
  if (reacting) return { kind: 'clip', clip: mood === 'unwell' ? 'react_unwell' : 'react_happy' };
  return { kind: 'still', poster: posterFor(mood) };
}
