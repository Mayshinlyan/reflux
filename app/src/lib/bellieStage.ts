/**
 * Bellie grows up with check-in days (Figma "Belly growth"): a Baby from the first day, Little after a month of
 * check-ins, Kid after three, Teenager after six and Adult after a year. It counts days with a check-in, never calendar
 * days, and never shrinks: a gap changes nothing.
 */
export const BELLIE_STAGES = ['baby', 'little', 'kid', 'teenager', 'adult'] as const;
export type BellieStage = (typeof BELLIE_STAGES)[number];

/** The check-in day each stage starts on. */
export const STAGE_FROM_DAY: Record<BellieStage, number> = {
  baby: 0,
  little: 30,
  kid: 90,
  teenager: 180,
  adult: 365,
};

export const STAGE_NAME: Record<BellieStage, string> = {
  baby: 'Baby',
  little: 'Little',
  kid: 'Kid',
  teenager: 'Teenager',
  adult: 'Adult',
};

export function isBellieStage(value: unknown): value is BellieStage {
  return typeof value === 'string' && (BELLIE_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: BellieStage): number {
  return BELLIE_STAGES.indexOf(stage);
}

/** The stage a number of check-in days has reached. */
export function stageForDays(days: number): BellieStage {
  let reached: BellieStage = 'baby';
  for (const stage of BELLIE_STAGES) {
    if (days >= STAGE_FROM_DAY[stage]) reached = stage;
  }
  return reached;
}

/** The big line on the "Bellie grew" page. */
export const STAGE_TITLE: Record<BellieStage, string> = {
  baby: 'Hello, Bellie',
  little: 'Bellie is growing up',
  kid: 'Bellie is a kid now',
  teenager: 'Bellie is a teenager now',
  adult: 'Bellie is all grown up',
};

/** The line under it: what got Bellie there. */
export function stageLine(stage: BellieStage): string {
  return `${STAGE_FROM_DAY[stage]} days of check-ins`;
}
