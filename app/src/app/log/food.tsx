import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FoodFlow, type MyFoodTarget } from '@/components/FoodFlow';
import { FoodList } from '@/components/FoodList';
import { useDb } from '@/db/DatabaseProvider';
import { getSavedFood, listSavedFoods } from '@/db/repositories/savedFoods';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/** A time passed from the Food list ("Add a food"), or null when absent or not a valid date. */
function parseAt(at: string | undefined): Date | null {
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The Food screen: "My foods" with one-tap Log, like Medications. With nothing saved yet it is the
 * photo/text check instead, as it is for `?check=1` ("Add a food" on the list, which can also save the
 * result to My foods) and `?camera=1` (Scan on Today, straight to the camera). `?myFood=1&food=<id>`
 * re-checks a saved food ("Get a verdict" / "Check again"), saving the verdict to it and not the diary.
 */
export default function LogFoodScreen() {
  const db = useDb();
  const { camera, check, at, myFood, food } = useLocalSearchParams<{
    camera?: string;
    check?: string;
    at?: string;
    myFood?: string;
    food?: string;
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
    return (
      <FoodFlow
        openCamera={camera === '1'}
        initialEatenAt={parseAt(at)}
        myFood={target}
        fromList={check === '1'}
      />
    );
  }
  return <FoodList />;
}
