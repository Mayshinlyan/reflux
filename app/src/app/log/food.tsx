import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FoodFlow, type MyFoodTarget } from '@/components/FoodFlow';
import { FoodList } from '@/components/FoodList';
import { useDb } from '@/db/DatabaseProvider';
import { getSavedFood } from '@/db/repositories/savedFoods';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * The Food screen: straight to "What did you eat?" (a photo or a typed description), with the saved foods as a
 * Quick log row on top. `?manage=1` (Settings > My foods, and "See all") lists the saved foods to edit or log
 * instead. `?check=1` ("+ Log a new food" there) is the same check, which can also save the result to My foods;
 * `?camera=1` (Scan on Today) opens the camera straight away. `?myFood=1&food=<id>` re-checks a saved food
 * ("Get a verdict" / "Check again"), saving the verdict to it and not the diary. `?date=` (a day tapped in
 * Today's week strip) logs the meal on that day.
 */
export default function LogFoodScreen() {
  const db = useDb();
  const { camera, check, myFood, food, manage, date } = useLocalSearchParams<{
    camera?: string;
    check?: string;
    myFood?: string;
    food?: string;
    manage?: string;
    date?: string;
  }>();
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
  return <FoodFlow openCamera={camera === '1'} myFood={target} fromList={check === '1'} date={date} />;
}
