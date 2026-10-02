import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';

type Prompt = {
  /** What was just logged, e.g. "Lunch logged". */
  subtitle: string;
  /** The meal the symptoms would follow. Left out for a medication. */
  foodLogId?: number;
};

const FLUSH_FALLBACK_MS = 500;

/** Opens the symptom screen, linked to the meal when there is one. */
export function openSymptoms(foodLogId?: number) {
  router.push(
    foodLogId === undefined
      ? '/log/symptoms'
      : { pathname: '/log/symptoms', params: { afterFood: String(foodLogId) } },
  );
}

/**
 * State for the "Any symptoms?" question (SymptomPromptSheet) asked after a meal or dose is logged.
 * On iPhone the log came from the time sheet, and a second modal can't open while that one is still
 * closing, so `show` waits for `flush` (the time sheet's onDismissed). Android has no time sheet.
 */
export function useSymptomPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [visible, setVisible] = useState(false);
  const waiting = useRef<Prompt | null>(null);

  const open = (next: Prompt) => {
    setPrompt(next);
    setVisible(true);
  };
  const flush = () => {
    if (!waiting.current) return;
    open(waiting.current);
    waiting.current = null;
  };

  return {
    /** Kept after closing, so the subtitle doesn't blank out during the slide-down. */
    prompt,
    visible,
    show: (next: Prompt) => {
      if (Platform.OS !== 'ios') return open(next);
      waiting.current = next;
      // Backstop in case the time sheet never reports closing, so the question can't get lost.
      setTimeout(flush, FLUSH_FALLBACK_MS);
    },
    flush,
    hide: () => setVisible(false),
  };
}
