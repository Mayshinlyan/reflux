import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { FoodFlow, type MyFoodTarget } from '@/components/FoodFlow';
import { FoodList } from '@/components/FoodList';
import { useDb } from '@/db/DatabaseProvider';
import { getSavedFood, type StoredSavedFood } from '@/db/repositories/savedFoods';
import { getSetting } from '@/db/repositories/settings';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { isQuickLogAllowed } from '@/lib/widgetLinks';

/**
 * The Food screen: straight to "What did you eat?" (a photo or a typed description), with the saved foods as a
 * Quick log row on top. `?manage=1` (Profile > Favorite foods, and "See all") lists the saved foods to edit or log
 * instead. "Add a food" there opens `?myFood=1` with no food, which checks a new favorite and saves it to the list.
 * `?camera=1` opens the camera straight away (the home-screen widget's "Snap food" bubble; a denied camera
 * keeps this screen and says why). The tab bar's "+" and Bellie on Today both open this screen plain.
 * `?myFood=1&food=<id>` re-checks a saved food ("Get a verdict" / "Check again"),
 * saving the verdict to it and not the diary. `?date=` (a day tapped in Today's week strip) logs the meal on
 * that day. `?quickLog=<id>&t=<token>` (a saved food on the home-screen widget) logs that saved food at once,
 * like its Quick log chip; without the widget's token, or for a removed food, it is just this screen.
 * `?details=<id>` (the "Add details" button on the Meal logged toast) opens the details step for that diary meal.
 * `?prefill=<text>` starts the "Describe it" box with that text (a Kitchen recipe's "Log this meal").
 */
export default function LogFoodScreen() {
  const db = useDb();
  const { camera, myFood, food, manage, date, quickLog, t, details, prefill } = useLocalSearchParams<{
    camera?: string;
    myFood?: string;
    food?: string;
    manage?: string;
    date?: string;
    quickLog?: string;
    t?: string;
    details?: string;
    prefill?: string;
  }>();
  const detailsFor = Number.isInteger(Number(details)) && details ? Number(details) : undefined;
  // A link can open the app from anywhere, so only the widget's own (token-carrying) link may log a meal.
  const quickFood = useMemo<StoredSavedFood | undefined>(() => {
    if (!quickLog) return undefined;
    try {
      if (!isQuickLogAllowed(t, getSetting(db, 'widgetToken'))) return undefined;
      return getSavedFood(db, Number(quickLog)) ?? undefined;
    } catch {
      logger.error('loadQuickLog', new AppError('INTERNAL'));
      return undefined;
    }
  }, [db, quickLog, t]);
  const [target] = useState<MyFoodTarget | undefined>(() => {
    if (myFood !== '1') return undefined;
    let saved = null;
    try {
      saved = food ? getSavedFood(db, Number(food)) : null;
    } catch {
      logger.error('loadSavedFood', new AppError('INTERNAL'));
    }
    // A removed food (or a bad id) falls back to adding a new one.
    if (!saved) return {};
    // A text food starts from what was typed, which can say more than its short name.
    const name = saved.source === 'text' ? (saved.inputText ?? saved.mealName) : saved.mealName;
    return { id: saved.id, name };
  });

  if (manage === '1' && !target) return <FoodList />;
  return (
    <FoodFlow
      // A widget tap while this screen is already open starts a fresh flow, so the new food is logged.
      key={quickFood ? `${quickFood.id}:${t}` : 'flow'}
      openCamera={camera === '1'}
      myFood={target}
      date={date}
      quickLog={quickFood}
      detailsFor={detailsFor}
      initialText={prefill ? prefill.slice(0, 200) : undefined}
    />
  );
}
