import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChefHat, ShoppingBasket } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/kitchen/ListRow';
import { PlanMealCard } from '@/components/kitchen/PlanMealCard';
import { PlanSkeleton } from '@/components/kitchen/PlanSkeleton';
import { PlanWeekStrip } from '@/components/kitchen/PlanWeekStrip';
import { SwapSheet } from '@/components/kitchen/SwapSheet';
import { Screen } from '@/components/Screen';
import { TopBarButton } from '@/components/TopBar';
import { useDb } from '@/db/DatabaseProvider';
import {
  createPlan,
  deletePlan,
  getCurrentPlan,
  redoPlan,
  type StoredMeal,
  type StoredPlan,
  setMealLocked,
  setMealSkipped,
  swapMeal,
} from '@/db/repositories/mealPlans';
import { listFridgeItems } from '@/db/repositories/fridgeItems';
import { getPlanChecks } from '@/db/repositories/planChecks';
import { getSetting, setSetting } from '@/db/repositories/settings';
import type { AppDb } from '@/db/types';
import { AppError, type ErrorCode } from '@/lib/errors';
import { buildRecipeRequest, todayKey } from '@/lib/kitchen';
import { ideasErrorMessage } from '@/lib/kitchenCopy';
import { logger } from '@/lib/logger';
import {
  buildPlanRequest,
  mealsFromResult,
  planSlots,
  planSummary,
  planWeek,
  planWeekStart,
} from '@/lib/mealPlan';
import { dishFromRecipe } from '@/lib/planDish';
import { prepDishes, prepSummary } from '@/lib/prep';
import { buildShoppingList, shoppingSummary } from '@/lib/shopping';
import { setRecipeDraft } from '@/lib/recipeDraft';
import { fetchMealPlan, fetchRecipeIdeas } from '@/services/relayClient';
import { cancelPrepReminder } from '@/services/reminders';
import { space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';
import { slotLabel } from '@/constants/mealPlan';

type Status = 'loading' | 'ready' | 'error';

/** The prep day moves (or goes) with the plan, so a reminder for the old one is dropped; it can be turned on again. */
function dropPrepReminder(db: AppDb): void {
  try {
    if (getSetting(db, 'prepReminderPlan') === null) return;
    setSetting(db, 'prepReminderPlan', null);
    void cancelPrepReminder();
  } catch (error) {
    logger.error('dropPrepReminder', error);
  }
}

/**
 * The week plan (Figma "meal planning flow" C and D). Opened with `make=new` it asks the relay for a plan from the
 * set-up choices, with `make=redo` it plans again every meal that is not locked or skipped, and with neither it just
 * shows the current plan. While it waits it shows Bellie and the shape of the week; when it is ready, the week on top,
 * the picked day's meals below (swap, lock, skip each), and a way to redo or start over. A plan is an intention: nothing
 * here ever writes to the food diary.
 */
export default function PlanScreen() {
  const db = useDb();
  const colors = useColors();
  const { make } = useLocalSearchParams<{ make?: string }>();
  const kind = make === 'new' || make === 'redo' ? make : null;
  const [plan, setPlan] = useState<StoredPlan | null>(() => getCurrentPlan(db));
  const [status, setStatus] = useState<Status>(kind ? 'loading' : 'ready');
  const [errorCode, setErrorCode] = useState<ErrorCode | 'EMPTY'>('INTERNAL');
  const [picked, setPicked] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<StoredMeal | null>(null);
  const running = useRef<AbortController | null>(null);
  const started = useRef(false);
  // What was last asked, so Try again repeats that (a failed redo must not become a new plan).
  const [lastAction, setLastAction] = useState<'new' | 'redo' | null>(kind);

  const refresh = useCallback(() => {
    try {
      setPlan(getCurrentPlan(db));
    } catch (error) {
      logger.error('loadMealPlan', error);
    }
  }, [db]);

  // Back from the shopping list, whose own items change the summary.
  useFocusEffect(
    useCallback(() => {
      if (!running.current) refresh();
    }, [refresh]),
  );

  const generate = useCallback(
    async (what: 'new' | 'redo') => {
      const controller = new AbortController();
      running.current = controller;
      setLastAction(what);
      setStatus('loading');
      try {
        const today = todayKey();
        const current = what === 'redo' ? getCurrentPlan(db) : null;
        const choices = current ? current.choices : getSetting(db, 'planChoices');
        const weekStart = current ? current.weekStart : planWeekStart(today);
        const taken = new Set(
          (current?.meals ?? []).filter((m) => m.locked || m.skipped).map((m) => `${m.day}|${m.slot}`),
        );
        const slots = planSlots(choices, weekStart, today).filter(
          (slot) => !taken.has(`${slot.day}|${slot.slot}`),
        );
        if (slots.length === 0) {
          // A redo with every meal locked or skipped has nothing to do; a new plan with no days left cannot be made.
          if (current) {
            setStatus('ready');
            return;
          }
          setErrorCode('EMPTY');
          setStatus('error');
          return;
        }
        const request = buildPlanRequest(db, {
          choices,
          slots,
          keep: (current?.meals ?? []).filter((m) => m.locked && !m.skipped).map((m) => m.dish.title),
          serves: getSetting(db, 'kitchenServes'),
          conditions: getSetting(db, 'conditions'),
        });
        const result = await fetchMealPlan(request, controller.signal);
        if (controller.signal.aborted) return;
        const meals = mealsFromResult(result, slots);
        if (!meals) throw new AppError('AI_INVALID_OUTPUT');
        const saved = current
          ? redoPlan(db, current.id, choices, today, meals)
          : createPlan(db, { weekStart, choices, meals });
        dropPrepReminder(db);
        setPlan(saved);
        setPicked(null);
        setStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.error('makeMealPlan', error);
        setErrorCode(error instanceof AppError ? error.code : 'INTERNAL');
        setStatus('error');
      }
    },
    [db],
  );

  useEffect(() => {
    if (kind && !started.current) {
      started.current = true;
      void generate(kind);
    }
    return () => {
      running.current?.abort();
      // So a remount (strict mode) asks again instead of waiting on an answer that was cancelled.
      started.current = false;
    };
  }, [kind, generate]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const days = plan ? planWeek(plan.weekStart) : [];
  const byDay = new Map<string, StoredMeal[]>();
  for (const meal of plan?.meals ?? []) byDay.set(meal.day, [...(byDay.get(meal.day) ?? []), meal]);
  const today = todayKey();
  const shownDay =
    picked ??
    (byDay.has(today) ? today : (days.find((day) => byDay.has(day.key))?.key ?? days[0]?.key ?? null));
  const dayName = days.find((day) => day.key === shownDay)?.name ?? '';

  const guard = (label: string, action: () => void) => {
    try {
      action();
      refresh();
      Haptics.selectionAsync().catch(() => {});
    } catch (error) {
      logger.error(label, error);
    }
  };

  const open = (meal: StoredMeal) => {
    setRecipeDraft({
      recipe: meal.dish,
      cuisine: plan?.choices.cuisines.find((key) => key !== 'any') ?? 'any',
      prep: { keepsDays: meal.dish.keepsDays, mode: plan?.mode ?? 'daily' },
    });
    router.push('/recipe');
  };

  const loadAlternatives = useCallback(
    (signal: AbortSignal): Promise<Recipe[]> => {
      const request = buildRecipeRequest(db, {
        cuisine: plan?.choices.cuisines.find((key) => key !== 'any') ?? 'any',
        time: '40',
        serves: getSetting(db, 'kitchenServes'),
        want: [],
        conditions: getSetting(db, 'conditions'),
        useFridge: plan?.choices.useFridge ?? false,
        shown: (plan?.meals ?? []).map((meal) => meal.dish.title),
      });
      return fetchRecipeIdeas(request, signal);
    },
    [db, plan],
  );

  const pick = (recipe: Recipe) => {
    const meal = swapping;
    setSwapping(null);
    if (!meal) return;
    guard('swapMeal', () => swapMeal(db, meal.id, dishFromRecipe(recipe, `s${Date.now().toString(36)}`)));
  };

  const startOver = () => {
    if (plan)
      guard('deleteMealPlan', () => {
        deletePlan(db, plan.id);
        dropPrepReminder(db);
      });
    goBack();
  };

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
        </View>
        <ScrollView contentContainerStyle={styles.loading} showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <AppText variant="display" accessibilityRole="header">
              Your week
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              Planning around what you can eat
            </AppText>
          </View>
          <PlanSkeleton />
        </ScrollView>
      </Screen>
    );
  }

  if (status === 'error' || !plan) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
        </View>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Your week
          </AppText>
          <AppText color="inkSoft">
            {!plan && status !== 'error'
              ? 'There is no plan yet. Make one from the Kitchen.'
              : errorCode === 'EMPTY'
                ? 'There are no days left this week to plan. Pick other days and try again.'
                : ideasErrorMessage(errorCode)}
          </AppText>
        </View>
        <View style={styles.errorButtons}>
          {lastAction && errorCode !== 'EMPTY' && (
            <Button label="Try again" onPress={() => void generate(lastAction)} />
          )}
          <Button label="Close" variant="secondary" onPress={goBack} />
        </View>
      </Screen>
    );
  }

  const dayMeals = shownDay ? (byDay.get(shownDay) ?? []) : [];
  const prep = prepDishes(plan.meals, today);
  const shopping = buildShoppingList(
    plan.meals,
    plan.choices.useFridge ? listFridgeItems(db).map((item) => item.name) : [],
    getPlanChecks(db, plan.id).own,
    today,
  );
  const unlocked = plan.meals.some((meal) => !meal.locked && !meal.skipped && meal.day >= today);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
          <View style={styles.titleBlock}>
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
              Review the meal plan
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {planSummary(plan.meals, plan.mode)}
            </AppText>
          </View>
        </View>

        <PlanWeekStrip days={days} selected={shownDay} planned={new Set(byDay.keys())} onSelect={setPicked} />

        <View style={styles.day}>
          <AppText variant="section" accessibilityRole="header">
            {dayName}
          </AppText>
          {dayMeals.length === 0 ? (
            <AppText color="inkSoft">Nothing planned for {dayName.toLowerCase()}.</AppText>
          ) : (
            dayMeals.map((meal) => (
              <PlanMealCard
                key={meal.id}
                slot={meal.slot}
                dish={meal.dish}
                locked={meal.locked}
                skipped={meal.skipped}
                onOpen={() => open(meal)}
                onSwap={() => setSwapping(meal)}
                onToggleLock={() => guard('lockMeal', () => setMealLocked(db, meal.id, !meal.locked))}
                onToggleSkip={() => guard('skipMeal', () => setMealSkipped(db, meal.id, !meal.skipped))}
              />
            ))
          )}
        </View>

        <View style={styles.rows}>
          {plan.mode === 'once' && prep.length > 0 && (
            <ListRow
              icon={<ChefHat size={20} color={colors.sageInk} strokeWidth={2} />}
              title="Prep day"
              subtitle={prepSummary(prep, plan.choices.prepMinutes)}
              onPress={() => router.push('/prep-day')}
            />
          )}
          <ListRow
            icon={<ShoppingBasket size={20} color={colors.sageInk} strokeWidth={2} />}
            title="Shopping list"
            subtitle={shoppingSummary(shopping)}
            onPress={() => router.push('/shopping-list')}
          />
        </View>

        <View style={styles.links}>
          {unlocked && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Redo the meals that are not locked"
              onPress={() => void generate('redo')}
              hitSlop={8}
              style={styles.link}>
              <AppText variant="bodyEm" style={styles.underline}>
                Redo the meals that are not locked
              </AppText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start over"
            onPress={startOver}
            hitSlop={8}
            style={styles.link}>
            <AppText variant="bodyEm" color="inkSoft" style={styles.underline}>
              Start over
            </AppText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <Button label={kind ? 'Start my week' : 'Done'} onPress={goBack} />
      </View>

      <SwapSheet
        key={swapping?.id ?? 'none'}
        visible={swapping !== null}
        onClose={() => setSwapping(null)}
        title={
          swapping
            ? `Swap ${dayNameOf(days, swapping.day)} ${slotLabel(swapping.slot).toLowerCase()}`
            : 'Swap'
        }
        load={loadAlternatives}
        onPick={pick}
      />
    </Screen>
  );
}

function dayNameOf(days: readonly { key: string; name: string }[], key: string): string {
  return days.find((day) => day.key === key)?.name ?? '';
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s1 },
  titleBlock: { flex: 1, gap: 4 },
  content: { gap: space.s3, paddingBottom: space.s3 },
  loading: { gap: space.s4, paddingBottom: space.s4 },
  heading: { gap: space.s1, marginBottom: space.s2 },
  day: { gap: space.s1_5 },
  rows: { gap: space.s1 },
  links: { alignItems: 'center', gap: space.s1 },
  link: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  footer: { paddingTop: space.s1, paddingBottom: space.s3 },
  errorButtons: { gap: space.s1, marginTop: space.s2 },
});
