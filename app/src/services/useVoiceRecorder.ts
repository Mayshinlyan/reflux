import { RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { levelFromDb } from '@/lib/voiceLevel';

/** How often the wave is told how loud the voice is, about 14 times a second. */
const LEVEL_MS = 70;

const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

export type VoiceRecorder = {
  /** Opens the microphone and starts recording; `onLevel` gets 0 to 1 as the voice rises and falls. */
  start: (onLevel: (level: number) => void) => Promise<void>;
  /** Ends the recording and gives its file, or null when nothing was being recorded. */
  stop: () => Promise<string | null>;
  /** Ends the recording and throws it away (the caller deletes the file). */
  cancel: () => void;
};

/** One m4a recording at a time, with a live loudness reading for the wave. Cleaned up when the screen closes. */
export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(OPTIONS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recording = useRef(false);
  /** Bumped by every start and finish, so a microphone still opening can see it was told to stop and give up. */
  const generation = useRef(0);
  const opening = useRef<Promise<void> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  /** Ends whatever is open or opening. Resolves true when a recording was running and has been stopped. */
  const finish = useCallback(async (): Promise<boolean> => {
    generation.current += 1;
    clearTimer();
    const wasOpening = opening.current;
    // Let a microphone that is still opening settle; it sees the new generation and does not start recording.
    await wasOpening?.catch(() => {});
    let stopped = false;
    if (recording.current) {
      recording.current = false;
      try {
        await recorder.stop();
        stopped = true;
      } catch {
        // Already stopped (the phone took the microphone, say): nothing is running either way.
      }
    }
    // Back to playback only, so the ching and other sounds behave as before.
    if (wasOpening || stopped) await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return stopped;
  }, [clearTimer, recorder]);

  const start = useCallback(
    async (onLevel: (level: number) => void) => {
      await finish();
      // Its own number, so a start that comes right after this one makes this one give up.
      generation.current += 1;
      const mine = generation.current;
      const open = (async () => {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (generation.current !== mine) return;
        await recorder.prepareToRecordAsync();
        if (generation.current !== mine) return;
        recorder.record();
        recording.current = true;
        timer.current = setInterval(() => {
          onLevel(levelFromDb(recorder.getStatus().metering));
        }, LEVEL_MS);
      })();
      opening.current = open;
      try {
        await open;
      } finally {
        if (opening.current === open) opening.current = null;
      }
    },
    [finish, recorder],
  );

  const stop = useCallback(async () => {
    const stopped = await finish();
    return stopped ? recorder.uri : null;
  }, [finish, recorder]);

  const cancel = useCallback(() => {
    void finish().catch(() => {});
  }, [finish]);

  // Leaving the screen mid-recording must close the microphone.
  useEffect(() => cancel, [cancel]);

  // One object for the life of the screen, so effects that depend on it don't run again on every render.
  return useMemo(() => ({ start, stop, cancel }), [start, stop, cancel]);
}
