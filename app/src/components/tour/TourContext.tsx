import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';

import { TOUR_STEPS, type TourStep, type TourViewId } from './steps';
import { TourOverlay } from './TourOverlay';

type Session = { steps: readonly TourStep[]; index: number };

type TourApi = {
  /**
   * Starts the tour from the first step; steps whose spotlight isn't on screen are left out. A no-op while it runs.
   * `prepare` runs just before it opens, and only if it does (Today scrolls to the top).
   */
  begin: (prepare?: () => void) => void;
  /** Settings' "Replay app tour": asks Today to start it as soon as it is on screen. */
  replay: () => void;
  /** A replay has been asked for and Today hasn't started it yet. */
  requested: boolean;
  /** Lets a view on Today be spotlighted; returns how to stop. */
  register: (id: TourViewId, ref: RefObject<View | null>) => () => void;
};

// Outside a provider (a screen under test on its own) the tour simply never starts.
const NO_TOUR: TourApi = {
  begin: () => {},
  replay: () => {},
  requested: false,
  register: () => () => {},
};

const TourContext = createContext<TourApi>(NO_TOUR);

export const useTour = () => useContext(TourContext);

/** Marks a view as something the tour can spotlight; put the returned ref on it. */
export function useTourTarget(id: TourViewId) {
  const { register } = useTour();
  const ref = useRef<View>(null);
  useEffect(() => register(id, ref), [id, register]);
  return ref;
}

/**
 * Figma row 18 "App tour". Wraps the tab screens and draws the tour over them (and over the tab bar). It runs once,
 * on the first visit to Today, and is remembered as `tourDone` however it ends: Done, the X, or the back button.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { update } = useSettings();
  const views = useRef(new Map<TourViewId, RefObject<View | null>>());
  const [session, setSession] = useState<Session | null>(null);
  // Mirrors `session` so the callbacks below stay the same function for the screen's life.
  const current = useRef<Session | null>(null);
  const [requested, setRequested] = useState(false);

  const open = useCallback((next: Session | null) => {
    current.current = next;
    setSession(next);
  }, []);

  const register = useCallback((id: TourViewId, ref: RefObject<View | null>) => {
    views.current.set(id, ref);
    return () => {
      if (views.current.get(id) === ref) views.current.delete(id);
    };
  }, []);

  const begin = useCallback(
    (prepare?: () => void) => {
      setRequested(false);
      if (current.current) return;
      const steps = TOUR_STEPS.filter(
        (step) => step.target?.kind !== 'view' || views.current.has(step.target.id),
      );
      if (steps.length === 0) return;
      prepare?.();
      open({ steps, index: 0 });
    },
    [open],
  );

  const replay = useCallback(() => setRequested(true), []);

  /** Today's view for a spotlight, if it is on screen. Stable, so the overlay doesn't re-measure for nothing. */
  const getView = useCallback((id: TourViewId) => views.current.get(id)?.current ?? null, []);

  const finish = useCallback(() => {
    open(null);
    try {
      update('tourDone', true);
    } catch (error) {
      logger.error('saveTourDone', error);
    }
  }, [open, update]);

  const next = useCallback(() => {
    const now = current.current;
    if (!now) return;
    if (now.index >= now.steps.length - 1) finish();
    else open({ ...now, index: now.index + 1 });
  }, [finish, open]);

  const back = useCallback(() => {
    const now = current.current;
    if (now && now.index > 0) open({ ...now, index: now.index - 1 });
  }, [open]);

  // The Android back button ends the tour instead of leaving the screen behind it.
  useEffect(() => {
    if (!session) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => subscription.remove();
  }, [session, finish]);

  const api = useMemo(() => ({ begin, replay, requested, register }), [begin, replay, requested, register]);

  return (
    <TourContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        {session && (
          <TourOverlay
            steps={session.steps}
            index={session.index}
            getView={getView}
            onNext={next}
            onBack={back}
            onClose={finish}
          />
        )}
      </View>
    </TourContext.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
