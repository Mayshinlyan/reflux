import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet } from 'react-native';

import { BackHeader } from '@/components/BackHeader';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { VoiceConfirm } from '@/components/voice/VoiceConfirm';
import { FixFoodSheet, FixSymptomSheet } from '@/components/voice/VoiceFixSheets';
import { VoiceListening } from '@/components/voice/VoiceListening';
import { VoiceProblem } from '@/components/voice/VoiceProblem';
import { COMMON_FOODS } from '@/constants/commonFoods';
import type { LoggedSymptomKey } from '@/constants/symptomItems';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { createUncheckedMeal, listRecentMealNames } from '@/db/repositories/food';
import { listSavedFoods } from '@/db/repositories/savedFoods';
import { listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import { createSymptomLog } from '@/db/repositories/symptoms';
import { playChing } from '@/lib/ching';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { dayToLoggedAt } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import type { VoiceHeard } from '@/lib/voiceParse';
import { checkPendingMeals } from '@/services/pendingChecks';
import { scheduleCheckIn } from '@/services/reminders';
import {
  isVoiceProblem,
  type Listening,
  requestMicrophone,
  startListening,
  understand,
  VoiceError,
  type VoiceProblem as Problem,
} from '@/services/voice';
import { space } from '@/theme';

type Phase = 'listening' | 'working' | 'confirm' | 'problem';

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "Tell me" (Figma 45a to 45j): speak what you ate or how you feel, then check what Bellie heard before it is
 * saved. Listening (45b) -> working it out (45c, the app's own pot loader) -> "Did I get that?" (45d), where each
 * chip opens a sheet to fix it (45h to 45j). A mic that is off, silence or no signal each get their own screen
 * (45e to 45g). The speech itself is a stand-in for now (see `services/voice.ts`); `?demo=permission|nothing|offline`
 * shows a problem screen on purpose. `?date=` (a day tapped in Today's week strip) starts the time on that day.
 */
export default function LogVoiceScreen() {
  const db = useDb();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ date?: string; demo?: string }>();
  const demo = isVoiceProblem(params.demo) ? params.demo : undefined;

  const [phase, setPhase] = useState<Phase>('listening');
  const [problem, setProblem] = useState<Problem>('nothing');
  const [words, setWords] = useState('');
  const [heard, setHeard] = useState<VoiceHeard>({ foods: [], symptoms: [], at: null });
  const [foodSheet, setFoodSheet] = useState<{ index: number; open: boolean } | null>(null);
  const [symptomSheet, setSymptomSheet] = useState<{ key: LoggedSymptomKey; open: boolean } | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const listening = useRef<Listening | null>(null);
  const transcript = useRef('');
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

  /** Asks for the mic and starts listening from scratch. */
  const begin = useCallback(async () => {
    listening.current?.cancel();
    transcript.current = '';
    setWords('');
    setPhase('listening');
    try {
      await requestMicrophone(demo);
    } catch (error) {
      fail(error);
      return;
    }
    if (!alive.current) return;
    // A second "Talk again" during the permission check must not leave two listeners running.
    listening.current?.cancel();
    listening.current = startListening((heardSoFar) => {
      transcript.current = heardSoFar;
      setWords(heardSoFar);
    }, demo);
  }, [demo, fail]);

  /** Works out what was said. Kept apart so "Try again" after no signal reuses the same words. */
  const work = useCallback(async () => {
    setPhase('working');
    try {
      const result = await understand(transcript.current, demo);
      if (!alive.current) return;
      const day = params.date ? dayToLoggedAt(params.date, new Date()) : null;
      setHeard({ ...result, at: result.at ?? day });
      setPhase('confirm');
    } catch (error) {
      fail(error);
    }
  }, [demo, fail, params.date]);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the microphone once when the screen opens
    void begin();
    return () => {
      alive.current = false;
      listening.current?.cancel();
    };
  }, [begin]);

  const done = () => {
    // A fast double tap must not start the work twice.
    if (phase !== 'listening') return;
    const text = listening.current?.stop() ?? transcript.current;
    transcript.current = text;
    if (!text.trim()) {
      fail(new VoiceError('nothing'));
      return;
    }
    void work();
  };

  const typeInstead = () => router.replace('/log/food');

  const problemAction = () => {
    if (problem === 'permission') {
      void Linking.openSettings();
    } else if (problem === 'offline' && transcript.current.trim()) {
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
        <VoiceListening phase={phase} words={words} onDone={done} onTypeInstead={typeInstead} />
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
