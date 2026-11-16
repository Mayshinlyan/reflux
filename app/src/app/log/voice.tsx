import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { BackHeader } from '@/components/BackHeader';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { VoiceConfirm } from '@/components/voice/VoiceConfirm';
import { FixFoodSheet, FixSymptomSheet } from '@/components/voice/VoiceFixSheets';
import { VoiceListening } from '@/components/voice/VoiceListening';
import { VoiceProblem } from '@/components/voice/VoiceProblem';
import { COMMON_FOODS } from '@/constants/commonFoods';
import { customSymptomLabel, isCustomSymptom, type LoggedSymptomKey } from '@/constants/symptomItems';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { createUncheckedMeal, listRecentMealNames } from '@/db/repositories/food';
import { listSavedFoods } from '@/db/repositories/savedFoods';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { createSymptomLog } from '@/db/repositories/symptoms';
import { playChing } from '@/lib/ching';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { dayToLoggedAt } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { checkPendingMeals } from '@/services/pendingChecks';
import { scheduleCheckIn } from '@/services/reminders';
import { useVoiceRecorder } from '@/services/useVoiceRecorder';
import {
  discardRecording,
  isVoiceProblem,
  requestMicrophone,
  understand,
  VoiceError,
  type VoiceHeard,
  type VoiceProblem as Problem,
} from '@/services/voice';
import { space } from '@/theme';

type Phase = 'listening' | 'working' | 'confirm' | 'problem';

/** A recording stops by itself after this long, so a phone left running can't send an hour of audio. */
const MAX_RECORDING_MS = 120_000;

/** How long the wave takes to follow a change in loudness, so it moves smoothly instead of flickering. */
const LEVEL_SMOOTHING_MS = 90;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "Tell me" (Figma 45a to 45j): speak what you ate or how you feel, then check what Bellie heard before it is
 * saved. Listening (45b) -> working it out (45c, the app's own pot loader) -> "Did I get that?" (45d), where each
 * chip opens a sheet to fix it (45h to 45j). A mic that is off, silence or no signal each get their own screen
 * (45e to 45g). The recording goes to the relay, which hears it and works out the foods, symptoms and time (see
 * `services/voice.ts`); `?demo=permission|nothing|offline` shows a problem screen on purpose. `?date=` (a day tapped in Today's week strip) starts the time on that day.
 */
export default function LogVoiceScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ date?: string; demo?: string }>();
  const demo = isVoiceProblem(params.demo) ? params.demo : undefined;

  const [phase, setPhase] = useState<Phase>('listening');
  const [problem, setProblem] = useState<Problem>('nothing');
  const [heard, setHeard] = useState<VoiceHeard>({ foods: [], symptoms: [], at: null });
  const [foodSheet, setFoodSheet] = useState<{ index: number; open: boolean } | null>(null);
  const [symptomSheet, setSymptomSheet] = useState<{ key: LoggedSymptomKey; open: boolean } | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  /** How loud the voice is, 0 to 1, smoothed: the wave's height. */
  const level = useSharedValue(0);
  const recorder = useVoiceRecorder();
  /** The recording once it has ended, kept so "Try again" after no signal sends the same audio. */
  const audioUri = useRef<string | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The latest `done`, for the recording limit's timer. */
  const finishRef = useRef<() => void>(() => {});
  const alive = useRef(true);

  const sources = useMemo(() => {
    try {
      return {
        saved: listSavedFoods(db).map((food) => ({ id: food.id, name: food.mealName })),
        recent: listRecentMealNames(db),
        common: COMMON_FOODS,
      };
    } catch (error) {
      logger.error('voiceSuggestionSources', error);
      return { saved: [], recent: [], common: COMMON_FOODS };
    }
  }, [db]);
  const ownSymptoms = useMemo(() => {
    try {
      return listSavedSymptoms(db, 'symptom').map((row) => row.name);
    } catch (error) {
      logger.error('listSavedSymptoms', error);
      return [];
    }
  }, [db]);

  const fail = useCallback((error: unknown) => {
    if (!alive.current) return;
    if (!(error instanceof VoiceError)) logger.error('voiceLog', error);
    setProblem(error instanceof VoiceError ? error.problem : 'nothing');
    setPhase('problem');
  }, []);

  const clearLimit = useCallback(() => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
  }, []);

  /** Deletes the recording from the phone: it is only kept while "Try again" might still need it. */
  const dropAudio = useCallback(() => {
    discardRecording(audioUri.current);
    audioUri.current = null;
  }, []);

  /** Asks for the mic and starts listening from scratch. */
  const begin = useCallback(async () => {
    recorder.cancel();
    clearLimit();
    dropAudio();
    setPhase('listening');
    try {
      await requestMicrophone(demo);
    } catch (error) {
      fail(error);
      return;
    }
    if (!alive.current) return;
    level.set(0);
    try {
      await recorder.start((loudness) => {
        level.set(withTiming(loudness, { duration: LEVEL_SMOOTHING_MS }));
      });
    } catch (error) {
      fail(error);
      return;
    }
    if (!alive.current) {
      recorder.cancel();
      return;
    }
    // A second "Talk again" while this one was opening must not leave two limit timers running.
    clearLimit();
    limitTimer.current = setTimeout(() => finishRef.current(), MAX_RECORDING_MS);
    // A light tap says the microphone is open.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [clearLimit, demo, dropAudio, fail, level, recorder]);

  /** Sends the recording and works out what was said. Kept apart so "Try again" after no signal reuses the same audio. */
  const work = useCallback(async () => {
    setPhase('working');
    try {
      const result = await understand(
        audioUri.current,
        { foods: [...sources.saved.map((food) => food.name), ...sources.recent], symptoms: ownSymptoms },
        demo,
      );
      // Understood: the recording is no longer needed anywhere.
      dropAudio();
      if (!alive.current) return;
      const day = params.date ? dayToLoggedAt(params.date, new Date()) : null;
      setHeard({ ...result, at: result.at ?? day });
      setPhase('confirm');
    } catch (error) {
      fail(error);
    }
  }, [demo, dropAudio, fail, ownSymptoms, params.date, sources]);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the microphone once when the screen opens
    void begin();
    return () => {
      alive.current = false;
      clearLimit();
      recorder.cancel();
      dropAudio();
    };
  }, [begin, clearLimit, dropAudio, recorder]);

  const done = () => {
    // A fast double tap must not start the work twice.
    if (phase !== 'listening') return;
    clearLimit();
    setPhase('working');
    void (async () => {
      try {
        audioUri.current = await recorder.stop();
      } catch (error) {
        fail(error);
        return;
      }
      if (alive.current) void work();
    })();
  };
  useEffect(() => {
    finishRef.current = done;
  });

  // Same place as Type on the arch: Food with its Food / How I feel / Medication tabs, for the same day.
  const typeInstead = () =>
    router.replace(params.date ? { pathname: '/log/type', params: { date: params.date } } : '/log/type');

  const problemAction = () => {
    if (problem === 'permission') {
      void Linking.openSettings();
    } else if (problem === 'offline' && audioUri.current) {
      void work();
    } else {
      void begin();
    }
  };

  const pickTime = () => {
    if (Platform.OS === 'android')
      pickTimeAndroid(heard.at ?? new Date(), (picked) =>
        setHeard((current) => ({ ...current, at: picked })),
      );
    else setTimeOpen(true);
  };

  /**
   * Saves what was confirmed: the foods as one meal (no verdict yet; the check follows in the background, like
   * "Just log it"), and the symptoms, linked to that meal. The time chip is when the meal was eaten; symptoms
   * said alongside a meal are happening now, so they take their own time.
   */
  const save = () => {
    if (saving) return;
    const { foods, symptoms, at } = heard;
    if (foods.length === 0 && symptoms.length === 0) return;
    setSaving(true);
    const when = at ?? new Date();
    let mealId: number | undefined;
    let symptomsId: number | undefined;
    try {
      if (foods.length > 0) {
        mealId = createUncheckedMeal(db, {
          source: 'text',
          inputText: foods.join(', '),
          loggedAt: when.toISOString(),
        });
      }
      if (symptoms.length > 0) {
        symptomsId = createSymptomLog(db, {
          items: symptoms.map((key) => ({ key })),
          foodLogId: mealId,
          ...(foods.length === 0 && at ? { loggedAt: at.toISOString(), tz: currentTimeZone() } : {}),
        });
      }
    } catch (error) {
      logger.error('saveVoiceLog', error);
      setSaving(false);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    // A symptom the person said in their own words joins "My symptoms", like one typed with a "+" chip, so it is
    // offered next time. The log is already saved, so a failure here only means it won't be offered.
    for (const key of symptoms.filter(isCustomSymptom)) {
      try {
        createSavedSymptom(db, customSymptomLabel(key), 'symptom');
      } catch (error) {
        logger.error('createSavedSymptom', error);
      }
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playChing();
    // One swap to the completion page, like the other logs; a meal (with any symptoms after it) is a meal log.
    router.replace({
      pathname: '/completion',
      params:
        mealId !== undefined
          ? { kind: 'meal', id: String(mealId) }
          : { kind: 'symptoms', id: String(symptomsId) },
    });
    if (mealId !== undefined) {
      void checkPendingMeals(db);
      if (typeof settings.checkInReminderMinutes === 'number') {
        void scheduleCheckIn({
          mealId,
          mealName: heard.foods.join(', '),
          eatenAt: when,
          minutes: settings.checkInReminderMinutes,
          bedtime: settings.bedtime,
        });
      }
    }
  };

  const closeFoodSheet = () => setFoodSheet((current) => current && { ...current, open: false });
  const closeSymptomSheet = () => setSymptomSheet((current) => current && { ...current, open: false });

  return (
    <Screen style={styles.screen}>
      <BackHeader close />
      {(phase === 'listening' || phase === 'working') && (
        <VoiceListening phase={phase} level={level} onDone={done} onTypeInstead={typeInstead} />
      )}
      {phase === 'problem' && (
        <VoiceProblem problem={problem} onAction={problemAction} onTypeInstead={typeInstead} />
      )}
      {phase === 'confirm' && (
        <VoiceConfirm
          foods={heard.foods}
          symptoms={heard.symptoms}
          at={heard.at}
          onFixFood={(index) => setFoodSheet({ index, open: true })}
          onFixSymptom={(key) => setSymptomSheet({ key, open: true })}
          onFixTime={pickTime}
          onSave={save}
          onTalkAgain={() => void begin()}
          saving={saving}
        />
      )}

      <FixFoodSheet
        visible={foodSheet?.open ?? false}
        onClose={closeFoodSheet}
        initial={foodSheet ? (heard.foods[foodSheet.index] ?? '') : ''}
        sources={sources}
        onUpdate={(text) => {
          if (foodSheet) {
            setHeard({
              ...heard,
              foods: heard.foods.map((food, index) => (index === foodSheet.index ? capitalise(text) : food)),
            });
          }
          closeFoodSheet();
        }}
        onRemove={() => {
          if (foodSheet) {
            setHeard({ ...heard, foods: heard.foods.filter((_, index) => index !== foodSheet.index) });
          }
          closeFoodSheet();
        }}
      />
      <FixSymptomSheet
        visible={symptomSheet?.open ?? false}
        onClose={closeSymptomSheet}
        current={symptomSheet?.key ?? 'heartburn'}
        ownLabels={ownSymptoms}
        onUpdate={(key) => {
          if (symptomSheet) {
            // Changing it to a symptom that is already on the card just drops the old one.
            const swapped = heard.symptoms.map((item) => (item === symptomSheet.key ? key : item));
            setHeard({
              ...heard,
              symptoms: swapped.filter((item, index) => swapped.indexOf(item) === index),
            });
          }
          closeSymptomSheet();
        }}
        onRemove={() => {
          if (symptomSheet) {
            setHeard({ ...heard, symptoms: heard.symptoms.filter((item) => item !== symptomSheet.key) });
          }
          closeSymptomSheet();
        }}
      />
      <MealTimeSheet
        visible={timeOpen}
        question="When was it?"
        confirmLabel="Update"
        initial={heard.at ?? undefined}
        onConfirm={(picked) => {
          setTimeOpen(false);
          if (picked) setHeard({ ...heard, at: picked });
        }}
        onClose={() => setTimeOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0, gap: space.s1 },
});
