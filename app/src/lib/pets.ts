/**
 * The companion pets the app can show. Only the wording differs between pets (stage names, tap
 * lines, the unwell line); growth, mood and progress rules are shared (see petProgress.ts).
 * Artwork lives with the component (components/Pet.tsx). A picker for the pet can build on
 * `Settings.petAnimal`; Mochi is the default.
 */
export type PetAnimal = 'mochi' | 'dog';

export type PetSpec = {
  defaultName: string;
  /** Names for the three growth stages, youngest first. */
  stageNames: readonly [string, string, string];
  /** Speech-bubble lines only this pet says, added to the shared ones. */
  tapLines: readonly string[];
  unwellLine: (name: string) => string;
};

export const PETS: Record<PetAnimal, PetSpec> = {
  mochi: {
    defaultName: 'Mochi',
    stageNames: ['Little Mochi', 'Growing Mochi', 'Grown Mochi'],
    tapLines: [],
    unwellLine: (name) => `${name}'s feeling a little under the weather today.`,
  },
  dog: {
    defaultName: 'Buddy',
    stageNames: ['Puppy', 'Young dog', 'Grown dog'],
    tapLines: ['Woof!'],
    unwellLine: (name) => `${name}'s feeling a little ruff today.`,
  },
};
