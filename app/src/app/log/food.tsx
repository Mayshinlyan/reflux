import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FoodFlow, type MyFoodTarget } from '@/components/FoodFlow';
import { FoodList } from '@/components/FoodList';
import { useDb } from '@/db/DatabaseProvider';
import { getSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * The Food screen: the saved foods, tap one to log it. `?manage=1` (Settings > My foods) edits them instead.
 * With nothing saved yet it is the photo/text check instead, as it is for `?check=1` ("Log a new food" on the list, which can also save the
 * result to My foods) and `?camera=1` (Scan on Today, straight to the camera). `?myFood=1&food=<id>`
 * re-checks a saved food ("Get a verdict" / "Check again"), saving the verdict to it and not the diary.
 */
export default function LogFoodScreen() {
  const db = useDb();
  const { camera, check, myFood, food, manage } = useLocalSearchParams<{
    camera?: string;
    check?: string;
    myFood?: string;
    food?: string;
    manage?: string;
  }>();
  // Decided once on arrival, so deleting the last food doesn't swap the screen out from under the user.
  const [hasFoods] = useState(() => {
    try {
      return listSavedFoods(db).length > 0;
    } catch {
      return false; // the check still works without the list
    }
  });
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

  if (target || camera === '1' || check === '1' || !hasFoods) {
    return <FoodFlow openCamera={camera === '1'} myFood={target} fromList={check === '1'} />;
  }
  return <FoodList manage={manage === '1'} />;
}
