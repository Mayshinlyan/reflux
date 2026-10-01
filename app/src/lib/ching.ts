import { createAudioPlayer, type AudioPlayer, setAudioModeAsync } from 'expo-audio';

import { logger } from '@/lib/logger';

const CHING = require('@/assets/sounds/coin.wav');

let player: AudioPlayer | null = null;

function ensurePlayer(): AudioPlayer {
  if (!player) {
    setAudioModeAsync({ playsInSilentMode: false }).catch((error) => logger.error('coinAudioMode', error));
    player = createAudioPlayer(CHING);
  }
  return player;
}

/** Loads the sound at app start: a player created at the moment of a save isn't ready to play yet. */
export function preloadChing(): void {
  try {
    ensurePlayer();
  } catch (error) {
    logger.error('coinSound', error);
  }
}

/**
 * The coin "ching", played the moment a log is saved. Silent when the phone is on silent, and mixed
 * with any music rather than pausing it. A sound is never worth failing a save, so errors are only logged.
 */
export function playChing(): void {
  try {
    const ching = ensurePlayer();
    // seekTo is async: playing before it lands can start at the end of the last ching, which is silent.
    ching
      .seekTo(0)
      .catch(() => {})
      .then(() => ching.play())
      .catch((error) => logger.error('coinSound', error));
  } catch (error) {
    logger.error('coinSound', error);
  }
}
