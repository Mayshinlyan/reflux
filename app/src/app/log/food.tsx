import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FoodFlow, type MyFoodTarget } from '@/components/FoodFlow';
import { useDb } from '@/db/DatabaseProvider';
import { getSavedFood } from '@/db/repositories/savedFoods';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * The food screen: analyze a photo or a typed description, then "I ate this" adds it to the diary.
 * Scan on Today opens it with `?camera=1` to go straight to the camera. My foods opens it with
 * `?myFood=1` to add a food with a verdict, plus `&food=<id>` to check one already saved.
 */
export default function LogFoodScreen() {
  const { camera, myFood, food } = useLocalSearchParams<{
    camera?: string;
    myFood?: string;
    food?: string;
  }>();
  const db = useDb();
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
  return <FoodFlow openCamera={camera === '1'} myFood={target} />;
}
