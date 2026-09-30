import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { FoodFlow } from '@/components/FoodFlow';
import { FoodList } from '@/components/FoodList';
import { useDb } from '@/db/DatabaseProvider';
import { listSavedFoods } from '@/db/repositories/savedFoods';

/** A time passed from the Food list ("Check a new food"), or null when absent or not a valid date. */
function parseAt(at: string | undefined): Date | null {
  if (!at) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The Food screen: "My foods" with one-tap Log, like Medications. With nothing saved yet (or for
 * `?check=1`, from "Check a new food") it is the photo/text check instead. Scan on Today opens the
 * check with `?camera=1` to go straight to the camera.
 */
export default function LogFoodScreen() {
  const db = useDb();
  const { camera, check, at } = useLocalSearchParams<{ camera?: string; check?: string; at?: string }>();
  // Decided once on arrival, so deleting the last food doesn't swap the screen out from under the user.
  const [hasFoods] = useState(() => {
    try {
      return listSavedFoods(db).length > 0;
    } catch {
      return false; // the check still works without the list
    }
  });

  if (camera === '1' || check === '1' || !hasFoods) {
    return <FoodFlow openCamera={camera === '1'} initialEatenAt={parseAt(at)} />;
  }
  return <FoodList />;
}
