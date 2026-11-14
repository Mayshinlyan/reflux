import { parseTranscript, type VoiceHeard } from '@/lib/voiceParse';

/** Why a spoken log can't go on: the mic is off, nothing was heard, or Bellie couldn't be reached. */
export type VoiceProblem = 'permission' | 'nothing' | 'offline';

export class VoiceError extends Error {
  readonly problem: VoiceProblem;
  constructor(problem: VoiceProblem) {
    super(problem);
    this.name = 'VoiceError';
    this.problem = problem;
  }
}

/** `/log/voice?demo=<problem>` shows that problem on purpose, so each fallback screen can be tried on a phone. */
export const isVoiceProblem = (value: unknown): value is VoiceProblem =>
  value === 'permission' || value === 'nothing' || value === 'offline';

/** What the stand-in "hears". The real speech recognition replaces `startListening` in the next PR. */
export const DEMO_TRANSCRIPT =
  'I had pasta and a glass of wine around eight, and now my chest is burning a bit';

const WORD_MS = 200;
const LEVEL_MS = 70;
const THINK_MS = 1800;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Asks for the microphone. Rejects with `permission` when it is off. */
export async function requestMicrophone(demo?: VoiceProblem): Promise<void> {
  if (demo === 'permission') throw new VoiceError('permission');
}

export type Listening = {
  /** Stops listening and gives the words heard so far. */
  stop: () => string;
  /** Stops without keeping anything. */
  cancel: () => void;
};

export type ListenHandlers = {
  /** Everything heard so far, as it grows. Kept out of sight while listening; shown after "Done". */
  onWords: (words: string) => void;
  /** How loud the voice is right now, 0 (silence) to 1 (loud), about 14 times a second. Drives the wave. */
  onLevel: (level: number) => void;
};

/** Listens. The stand-in speaks a fixed sentence, with a made-up voice level that rises and falls as it goes. */
export function startListening({ onWords, onLevel }: ListenHandlers, demo?: VoiceProblem): Listening {
  const words = demo === 'nothing' ? [] : DEMO_TRANSCRIPT.split(' ');
  let shown = 0;
  let level = 0;
  const wordTimer = setInterval(() => {
    if (shown >= words.length) {
      clearInterval(wordTimer);
      return;
    }
    shown += 1;
    onWords(words.slice(0, shown).join(' '));
  }, WORD_MS);
  const levelTimer = setInterval(() => {
    // Loud and uneven while words come, settling to nothing once the sentence is done (always flat if nothing is said).
    const target = shown > 0 && shown < words.length ? 0.35 + Math.random() * 0.65 : 0;
    level += (target - level) * 0.5;
    onLevel(level);
  }, LEVEL_MS);
  const stopTimers = () => {
    clearInterval(wordTimer);
    clearInterval(levelTimer);
  };
  return {
    stop: () => {
      stopTimers();
      return words.slice(0, shown).join(' ');
    },
    cancel: stopTimers,
  };
}

/** Works out the food, symptoms and time in what was said. Rejects with `nothing` or `offline`. */
export async function understand(transcript: string, demo?: VoiceProblem): Promise<VoiceHeard> {
  await wait(THINK_MS);
  if (demo === 'offline') throw new VoiceError('offline');
  const heard = parseTranscript(transcript);
  if (heard.foods.length === 0 && heard.symptoms.length === 0) throw new VoiceError('nothing');
  return heard;
}
