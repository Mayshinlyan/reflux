import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { CommitGoalPage, CommitProgressPage, type Goal } from '@/components/completion/CommitPage';
import { CompletionPage } from '@/components/completion/CompletionPage';
import { GiftPage } from '@/components/completion/GiftPage';
import { GrewPage } from '@/components/completion/GrewPage';
import { StreakPage } from '@/components/completion/StreakPage';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listCheckIns } from '@/db/repositories/checkIns';
import { isBellieStage } from '@/lib/bellieStage';
import { type LogKind, planCompletion } from '@/lib/completionFlow';
import { summarizeCheckIns } from '@/lib/streak';
import { currentTimeZone } from '@/lib/time';

const KINDS: readonly LogKind[] = ['meal', 'symptoms', 'dose'];

/**
 * What follows a saved log (Figma G1 to G5), in place of the old "Meal logged" toast: the completion, then on the
 * first check-in of the day the streak, a goal or progress card, and a gift on its milestone days. Every page can be
 * left, and nothing here is needed to log. Everything is worked out on the phone from the logs.
 * `?kind=meal|symptoms|dose`, `?id=` the entry just made (for Add details / Change time), `?note=` the dose line.
 */
export default function CompletionScreen() {
  const params = useLocalSearchParams<{ kind?: string; id?: string; note?: string; preview?: string }>();
  const kind: LogKind = KINDS.find((k) => k === params.kind) ?? 'meal';
  const db = useDb();
  const { settings, update: save } = useSettings();
  // A preview (development builds) plays the pages without saving a goal or a seen gift into the real settings.
  const preview = __DEV__ && Number.isInteger(Number(params.preview)) && Number(params.preview) >= 1;
  const update: typeof save = preview ? () => {} : save;

  // Worked out once, from the logs as they are right now, so the pages don't shift while they are on screen.
  const [{ summary, steps }] = useState(() => {
    const real = summarizeCheckIns(listCheckIns(db), new Date(), currentTimeZone());
    // Development builds only: `?preview=3` plays the pages as the first check-in of day 3 (a goal or gift not yet
    // picked or opened), so each page can be seen without waiting for the day. Never reachable in a release build.
    const day = __DEV__ ? Number(params.preview) : NaN;
    if (Number.isInteger(day) && day >= 1) {
      const result = { ...real, todayCount: 1, checkInDays: day, streak: day, returningAfterGap: false };
      return {
        summary: result,
        steps: planCompletion(result, { commitGoal: null, giftsSeen: [], stageSeen: 'baby' }),
      };
    }
    return {
      summary: real,
      steps: planCompletion(real, {
        commitGoal: settings.commitGoal,
        giftsSeen: settings.giftsSeen,
        stageSeen: isBellieStage(settings.bellieStageSeen) ? settings.bellieStageSeen : 'baby',
      }),
    };
  });
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Goal | null>(null);
  const step = steps[index] ?? steps[0]!;

  // A new meal replaced the log page, so closing goes on to Today, where the meal now is. Other logs go back to where they were opened.
  const close = () => (kind === 'meal' && !preview ? router.dismissTo('/') : router.back());
  const next = () => (index + 1 < steps.length ? setIndex(index + 1) : close());

  const quiet = useMemo(() => {
    const id = params.id;
    if (!id) return undefined;
    if (kind === 'meal') {
      return {
        label: 'Add details',
        onPress: () => router.replace({ pathname: '/log/food', params: { details: id } }),
      };
    }
    if (kind === 'symptoms') {
      return {
        label: 'Add details',
        onPress: () => router.replace({ pathname: '/log/symptoms', params: { id, details: '1' } }),
      };
    }
    return {
      label: 'Change time',
      onPress: () => router.replace({ pathname: '/entry/edit', params: { kind: 'medication', id } }),
    };
  }, [kind, params.id]);

  const markSeen = (day: number) => {
    if (!settings.giftsSeen.includes(day)) update('giftsSeen', [...settings.giftsSeen, day]);
  };

  switch (step.screen) {
    case 'streak':
      return <StreakPage summary={summary} onContinue={next} />;
    case 'grew':
      return (
        <GrewPage
          stage={step.stage}
          onContinue={() => {
            update('bellieStageSeen', step.stage);
            next();
          }}
        />
      );
    case 'commit':
      return step.mode === 'goal' ? (
        <CommitGoalPage
          picked={picked}
          onPick={setPicked}
          onCommit={() => {
            if (picked !== null) update('commitGoal', picked);
            next();
          }}
          onSkip={next}
        />
      ) : (
        <CommitProgressPage summary={summary} onContinue={next} />
      );
    case 'gift':
      return (
        <GiftPage
          day={step.day}
          onWear={() => {
            update('bellieHat', true);
            markSeen(step.day);
            next();
          }}
          onReport={() => {
            markSeen(step.day);
            router.replace('/weekly-report');
          }}
          onDone={() => {
            markSeen(step.day);
            next();
          }}
        />
      );
    default:
      return (
        <CompletionPage kind={kind} summary={summary} note={params.note} quiet={quiet} onContinue={next} />
      );
  }
}
