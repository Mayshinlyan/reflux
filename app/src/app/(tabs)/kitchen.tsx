import { router, useFocusEffect } from 'expo-router';
import { Bookmark, CalendarDays, ChevronRight, Refrigerator } from 'lucide-react-native';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { FeedbackButton, feedbackButtonClearance } from '@/components/FeedbackButton';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { FridgeRow } from '@/components/kitchen/FridgeRow';
import { PillButton } from '@/components/kitchen/PillButton';
import { PlanSetupSheet } from '@/components/kitchen/PlanSetupSheet';
import { PlanWeekStrip } from '@/components/kitchen/PlanWeekStrip';
import { TodayPlanCard } from '@/components/kitchen/TodayPlanCard';
import { Screen } from '@/components/Screen';
import { useTourTarget } from '@/components/tour/TourContext';
import type { PlanChoices } from '@/constants/mealPlan';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listAvoidFoods } from '@/db/repositories/avoidFoods';
import { fridgeUpdatedAt, listFridgeItems } from '@/db/repositories/fridgeItems';
import { getCurrentPlan, type StoredMeal, type StoredPlan } from '@/db/repositories/mealPlans';
import { listSavedRecipes } from '@/db/repositories/savedRecipes';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { planWeek, planSummary } from '@/lib/mealPlan';
import { setRecipeDraft } from '@/lib/recipeDraft';
import { cardEdge, radius, space, useColors } from '@/theme';

/**
 * Kitchen: planning the week (Figma "meal planning flow" A and F). With no plan, one card and one button open the
 * set-up sheet, and the plan is made on the page that follows. With a plan for the current week it is "this week":
 * today's meals, the week, a way back into the plan, and Saved and My fridge. Saved recipes and the fridge scan keep
 * working as before; only the recipe ideas became the week plan.
 */
export default function KitchenScreen() {
  const colors = useColors();
  const db = useDb();
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  // The app tour spotlights the plan card (or the plan row once there is a plan) and the fridge.
  const planTarget = useTourTarget('plan');
  const fridgeTarget = useTourTarget('fridge');
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [fridge, setFridge] = useState<{ count: number; updatedAt: string | null }>({
    count: 0,
    updatedAt: null,
  });
  const [asking, setAsking] = useState(false);
  // Bumped on every open, so the sheet starts from the last choices.
  const [opened, setOpened] = useState(0);
  // What to do once the sheet has finished closing: a second screen can't be pushed under a sheet still sliding away.
  const afterClose = useRef<'make' | 'fridge' | null>(null);

  const reload = useCallback(() => {
    try {
      setPlan(getCurrentPlan(db));
      setSavedCount(listSavedRecipes(db).length);
      setSkipped(listAvoidFoods(db).map((food) => food.name));
      setFridge({ count: listFridgeItems(db).length, updatedAt: fridgeUpdatedAt(db) });
    } catch (error) {
      logger.error('loadKitchen', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const today = todayKey();
  // A plan is "this week" until its Sunday has passed; after that the Kitchen asks for a new one.
  const current = plan && today <= addDays(plan.weekStart, 6) ? plan : null;

  const openAsk = () => {
    afterClose.current = null;
    setOpened((count) => count + 1);
    setAsking(true);
  };

  const submit = (choices: PlanChoices) => {
    // Opens as you left it next time. A failed save only means the sheet opens on the old choices.
    try {
      update('planChoices', choices);
    } catch (error) {
      logger.error('savePlanChoices', error);
    }
    afterClose.current = 'make';
    setAsking(false);
  };
  const addFridge = () => {
    afterClose.current = 'fridge';
    setAsking(false);
  };
  const dismissed = () => {
    const next = afterClose.current;
    afterClose.current = null;
    if (next === 'fridge') router.push('/fridge');
    if (next === 'make') router.push({ pathname: '/plan', params: { make: 'new' } });
  };

  const openMeal = (meal: StoredMeal) => {
    setRecipeDraft({
      recipe: meal.dish,
      cuisine: current?.choices.cuisines.find((key) => key !== 'any') ?? 'any',
      prep: { keepsDays: meal.dish.keepsDays, mode: current?.mode ?? 'daily' },
    });
    router.push('/recipe');
  };

  const todayMeals = (current?.meals ?? []).filter((meal) => meal.day === today && !meal.skipped);
  // A plan made at the weekend starts on Monday: until then there is no "today" in it.
  const startsLater = current !== null && today < current.weekStart;
  const dayName = current ? (planWeek(current.weekStart).find((day) => day.key === today)?.name ?? '') : '';

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        // The Feedback pill floats over the lower right, so the last row scrolls up past it.
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(tabBarClearance(insets.bottom), feedbackButtonClearance(insets.bottom)) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Kitchen
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            {current ? (startsLater ? 'Next week' : 'This week') : 'What shall we cook?'}
          </AppText>
        </View>

        {current ? (
          <>
            {!startsLater && <TodayPlanCard dayName={dayName} meals={todayMeals} onOpen={openMeal} />}
            <PlanWeekStrip
              days={planWeek(current.weekStart)}
              selected={today}
              planned={new Set(current.meals.filter((meal) => !meal.skipped).map((meal) => meal.day))}
              onSelect={() => router.push('/plan')}
            />
            <View ref={planTarget}>
              <ListRow
                icon={<CalendarDays size={20} color={colors.sageInk} strokeWidth={2} />}
                title="Meal plan"
                subtitle={planSummary(current.meals, current.mode)}
                onPress={() => router.push('/plan')}
              />
            </View>
            <View style={styles.pills}>
              <View style={styles.fill}>
                <PillButton
                  icon={<Bookmark size={24} color={colors.ink} strokeWidth={2} />}
                  label="Saved"
                  accessibilityLabel="Saved recipes"
                  accessibilityHint="Opens the list of your saved recipes"
                  onPress={() => router.push('/saved-recipes')}
                />
              </View>
              <View ref={fridgeTarget} style={styles.fill}>
                <PillButton
                  icon={<Refrigerator size={24} color={colors.ink} strokeWidth={2} />}
                  label="My fridge"
                  accessibilityLabel="My fridge"
                  accessibilityHint="Opens your fridge list"
                  onPress={() => router.push('/fridge')}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardText}>
                  <AppText variant="displaySmall">Plan your week</AppText>
                  <AppText variant="subtitle" color="inkSoft">
                    Meals that go easy on your belly, made from what you have.
                  </AppText>
                </View>
                <Belly mood="happy" size={120} />
              </View>
              <View ref={planTarget}>
                <Button label="Plan my week" onPress={openAsk} />
              </View>
            </View>

            <ListRow
              icon={<Bookmark size={20} color={colors.sageInk} strokeWidth={2} />}
              title="Saved recipes"
              subtitle={savedCount === 1 ? '1 recipe' : `${savedCount} recipes`}
              onPress={() => router.push('/saved-recipes')}
            />

            <View style={styles.section}>
              <AppText variant="section" accessibilityRole="header">
                My fridge
              </AppText>
              <View ref={fridgeTarget}>
                <FridgeRow
                  count={fridge.count}
                  updatedAt={fridge.updatedAt}
                  onPress={() => router.push('/fridge')}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <FeedbackButton />

      <PlanSetupSheet
        key={`plan-${opened}`}
        visible={asking}
        onClose={() => setAsking(false)}
        onDismissed={dismissed}
        initial={settings.planChoices}
        fridge={fridge}
        skipped={skipped}
        onAddFridge={addFridge}
        onSubmit={submit}
      />
    </Screen>
  );
}

/** A white row with a green icon tile, a title and a line under it, that opens something (Saved recipes, Meal plan). */
function ListRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={[styles.listRow, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={[styles.tile, { backgroundColor: colors.sageTint }]}>{icon}</View>
      <View style={styles.fill}>
        <AppText variant="bodyEm">{title}</AppText>
        <AppText variant="caption" color="inkMuted">
          {subtitle}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.inkMuted} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2, gap: space.s4 + space.s1 },
  heading: { gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s4, paddingHorizontal: space.s3, gap: space.s3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  cardText: { flex: 1, gap: space.s1 },
  pills: { flexDirection: 'row', gap: space.s2 },
  fill: { flex: 1 },
  section: { gap: space.s1_5 },
  listRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    padding: space.s1_5,
    borderRadius: radius.md,
  },
  tile: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
