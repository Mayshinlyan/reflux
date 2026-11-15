import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useDb, useSettings } from '@/db/DatabaseProvider';
import { createAvoidFood } from '@/db/repositories/avoidFoods';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import {
  getCurrentPlan,
  markMealLogOffered,
  type StoredMeal,
  setMealSkipped,
} from '@/db/repositories/mealPlans';
import { listSymptomLogs } from '@/db/repositories/symptoms';
import { onEntriesChanged } from '@/lib/entriesChanged';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { nextPlannedMeal, type SwapOffer, swapOffer, triggerName } from '@/lib/planToday';
import { nowIso } from '@/lib/time';

type State = { card: StoredMeal | null; offer: SwapOffer | null };
const NONE: State = { card: null, offer: null };

/**
 * What Today shows from the week plan: the next planned meal, and (after a planned meal was logged and a symptom
 * followed) an offer to swap a later one. Nothing at all unless "Offer to log planned meals" is on, and nothing here
 * ever writes to the diary: "Log it" only opens the log with the dish typed in.
 */
export function usePlanToday() {
  const db = useDb();
  const { settings, update } = useSettings();
  const [state, setState] = useState<State>(NONE);
  const enabled = settings.offerPlannedMeals;
  const offered = settings.swapOfferMeal;

  // `fromFocus`: Today has just come into view. Only then can the swap offer open, so it never slides up over another
  // screen (an entry saved in the log flow tells Today to reload while that flow is still closing).
  const load = useCallback(
    (fromFocus: boolean) => {
      if (!enabled) {
        setState(NONE);
        return;
      }
      try {
        const plan = getCurrentPlan(db);
        if (!plan) {
          setState(NONE);
          return;
        }
        const now = new Date();
        const today = todayKey();
        // Meals and symptoms from yesterday on cover a dinner and a symptom just after midnight.
        const range = {
          from: new Date(`${addDays(today, -1)}T00:00:00`).toISOString(),
          to: new Date(now.getTime() + 86_400_000).toISOString(),
        };
        const eaten = listDiaryFoodLogs(db, range);
        const symptoms = listSymptomLogs(db, range);
        const card = nextPlannedMeal(plan.meals, today, now, eaten);
        setState((was) => ({
          card,
          offer: fromFocus ? swapOffer(plan.meals, today, now, eaten, symptoms, offered) : was.offer,
        }));
      } catch (error) {
        // Today simply shows no plan card; the diary is untouched.
        logger.error('loadPlanToday', error);
        setState(NONE);
      }
    },
    [db, enabled, offered],
  );
  const reload = useCallback(() => load(false), [load]);

  useFocusEffect(useCallback(() => load(true), [load]));
  useEffect(() => onEntriesChanged(reload), [reload]);

  const logIt = (meal: StoredMeal) => {
    try {
      markMealLogOffered(db, meal.id, nowIso());
    } catch (error) {
      logger.error('markPlannedMeal', error);
    }
    router.push({ pathname: '/log/food', params: { prefill: meal.dish.title } });
  };

  const notToday = (meal: StoredMeal) => {
    try {
      setMealSkipped(db, meal.id, true);
    } catch (error) {
      logger.error('skipPlannedMeal', error);
    }
    reload();
  };

  /** Asked once per meal: whatever they answer, it is not offered again for it. */
  const closeOffer = (current: SwapOffer) => {
    try {
      update('swapOfferMeal', current.meal.id);
    } catch (error) {
      logger.error('saveSwapOffer', error);
    }
    setState((was) => ({ ...was, offer: null }));
  };

  const swapNext = (current: SwapOffer, note: boolean) => {
    if (note) {
      try {
        createAvoidFood(db, triggerName(current.meal));
      } catch (error) {
        logger.error('noteTrigger', error);
      }
    }
    closeOffer(current);
    router.push({ pathname: '/plan', params: { swap: String(current.next.id) } });
  };

  return { card: state.card, offer: state.offer, logIt, notToday, closeOffer, swapNext };
}
