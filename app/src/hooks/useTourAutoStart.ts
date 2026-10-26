import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useTour } from '@/components/tour/TourContext';
import { useSettings } from '@/db/DatabaseProvider';

/** Today settles first (the greeting, the cards' first nudge) before the tour dims it. */
const START_DELAY_MS = 600;

/**
 * Starts the app tour when Today is on screen: once, on the first visit after setting up, and again whenever Settings'
 * "Replay app tour" asks for it. `ready` is false until setting up is done; `prepare` runs just before it starts
 * (Today scrolls to the top so the spotlights are in view).
 */
export function useTourAutoStart(ready: boolean, prepare?: () => void) {
  const { begin, requested } = useTour();
  const { settings } = useSettings();
  const wanted = ready && (requested || !settings.tourDone);

  useFocusEffect(
    useCallback(() => {
      if (!wanted) return;
      const timer = setTimeout(() => begin(prepare), START_DELAY_MS);
      return () => clearTimeout(timer);
    }, [wanted, begin, prepare]),
  );
}
