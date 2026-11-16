import { router, useFocusEffect } from 'expo-router';
import { Bookmark, Refrigerator, ShoppingBasket } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { FeedbackButton, feedbackButtonClearance } from '@/components/FeedbackButton';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { FridgeRow } from '@/components/kitchen/FridgeRow';
import { ListRow } from '@/components/kitchen/ListRow';
import { PillButton } from '@/components/kitchen/PillButton';
import { PlanSetupSheet } from '@/components/kitchen/PlanSetupSheet';
import { PlanWeekStrip } from '@/components/kitchen/PlanWeekStrip';
import { PrepBanner } from '@/components/kitchen/PrepBanner';
import { TodayPlanCard } from '@/components/kitchen/TodayPlanCard';
import { Screen } from '@/components/Screen';
import { useTourTarget } from '@/components/tour/TourContext';
import { type PlanChoices, prepWeekday } from '@/constants/mealPlan';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { fridgeUpdatedAt, listFridgeItems } from '@/db/repositories/fridgeItems';
import { getCurrentPlan, type StoredMeal, type StoredPlan } from '@/db/repositories/mealPlans';
import { getPlanChecks } from '@/db/repositories/planChecks';
import { listSavedRecipes } from '@/db/repositories/savedRecipes';
import { todayKey } from '@/lib/kitchen';
import { addDays } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { planWeek, prepDateFor } from '@/lib/mealPlan';
import { prepDay, prepDayName, prepDishes, prepSummary } from '@/lib/prep';
import { weekLine } from '@/lib/planToday';
import { setRecipeDraft } from '@/lib/recipeDraft';
import { buildShoppingList, shoppingSummary } from '@/lib/shopping';
import { planWeekResult, weekIsEnding } from '@/lib/weekResult';
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
  // How the plan's week went once it is ending: planned meals logged, and the dishes that sat well.
  const [result, setResult] = useState<{ logged: number; well: number; wellTitles: string[] } | null>(null);
  // What the shopping row says, and whether the prep day was marked done (the banner goes then).
  const [extra, setExtra] = useState<{ shopping: string; prepDone: boolean } | null>(null);
  // The day of the week strip whose meals show in the card; today until another is tapped.
  const [picked, setPicked] = useState<string | null>(null);
  const [fridge, setFridge] = useState<{ count: number; updatedAt: string | null }>({
    count: 0,
    updatedAt: null,
  });
  const [asking, setAsking] = useState(false);
  // Bumped on every open, so the sheet starts from the last choices.
  const [opened, setOpened] = useState(0);
  // What to do once the sheet has finished closing: a second screen can't be pushed under a sheet still sliding away.
  const afterClose = useRef<'make' | 'fridge' | null>(null);

  const lastPlan = useRef<number | null>(null);

  const reload = useCallback(() => {
    try {
      const latest = getCurrentPlan(db);
      setPlan(latest);
      // A new plan starts on its own day again, not on a day picked in the old one.
      if ((latest?.id ?? null) !== lastPlan.current) {
        lastPlan.current = latest?.id ?? null;
        setPicked(null);
      }
      setResult(latest && weekIsEnding(latest, todayKey()) ? planWeekResult(db, latest) : null);
      setSavedCount(listSavedRecipes(db).length);
      const fridgeItems = listFridgeItems(db);
      setFridge({ count: fridgeItems.length, updatedAt: fridgeUpdatedAt(db) });
      // The shopping row and the prep banner: if they cannot be worked out, the rest of the page still shows.
      try {
        if (latest) {
          const checks = getPlanChecks(db, latest.id);
          const names = latest.choices.useFridge ? fridgeItems.map((item) => item.name) : [];
          setExtra({
            shopping: shoppingSummary(buildShoppingList(latest.meals, names, checks.own, todayKey())),
            prepDone: checks.prep.has('done'),
          });
        } else {
          setExtra(null);
        }
      } catch (error) {
        logger.error('loadKitchenExtras', error);
        setExtra(null);
      }
    } catch (error) {
      logger.error('loadKitchen', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const today = todayKey();
  // A plan is "this week" until its Sunday has passed; after that the Kitchen asks for a new one.
  const current = plan && today <= addDays(plan.weekStart, 6) ? plan : null;
  // From Saturday on, the next week is offered (Figma "meal planning flow" H), above what is left of this one.
  const ending = plan !== null && weekIsEnding(plan, today);

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
  const repeatWhatWorked = () => router.push({ pathname: '/plan', params: { make: 'new', repeat: '1' } });
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

  // A plan made on a Saturday starts on Sunday: until then there is no "today" in it.
  const startsLater = current !== null && today < current.weekStart;
  const weekDays = current ? planWeek(current.weekStart) : [];
  // The picked day (today to begin with, or the first day of a week still to come) and what is on it.
  const shownDay =
    picked && weekDays.some((day) => day.key === picked)
      ? picked
      : weekDays.some((day) => day.key === today)
        ? today
        : (weekDays[0]?.key ?? today);
  const shownName = weekDays.find((day) => day.key === shownDay)?.name ?? '';
  const shownMeals = (current?.meals ?? []).filter((meal) => meal.day === shownDay && !meal.skipped);

  // The prep day: shown until the cooking is marked done, honey on the strip and in one banner (Figma F2).
  const prepList = current && current.mode === 'once' ? prepDishes(current.meals, today) : [];
  const prepDate =
    current && current.mode === 'once' ? prepDateFor(current.weekStart, prepWeekday(current.choices)) : null;
  const cookDay = current ? prepDay(current.weekStart, today, prepWeekday(current.choices)) : today;
  const showPrep = current !== null && prepList.length > 0 && extra !== null && !extra.prepDone;

  const repeat = ending && result !== null && result.wellTitles.length > 0 ? result : null;
  // The card that asks for a week: "Plan your week" with no plan, "Plan next week" once this one is ending.
  const askCard = (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <AppText variant="displaySmall">{ending ? 'Plan next week' : 'Plan your week'}</AppText>
          <AppText variant="subtitle" color="inkSoft">
            {repeat
              ? weekLine(repeat.logged, repeat.well)
              : 'Meals that go easy on your belly, made from what you have.'}
          </AppText>
        </View>
        <Belly mood="happy" size={120} />
      </View>
      <View ref={planTarget} style={styles.cardButtons}>
        {repeat ? (
          <>
            <Button label="Repeat what worked" onPress={repeatWhatWorked} />
            <Button label="Start over" variant="secondary" onPress={openAsk} />
          </>
        ) : (
          <Button label="Plan my week" onPress={openAsk} />
        )}
      </View>
    </View>
  );

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
            {ending
              ? 'A new week is coming'
              : current
                ? startsLater
                  ? 'Next week'
                  : 'This week'
                : 'What shall we cook?'}
          </AppText>
        </View>

        {current ? (
          <>
            <View ref={planTarget}>
              <PlanWeekStrip
                days={weekDays}
                selected={shownDay}
                planned={new Set(current.meals.filter((meal) => !meal.skipped).map((meal) => meal.day))}
                prepDay={prepDate}
                onSelect={setPicked}
              />
            </View>
            {ending && askCard}
            {showPrep && (
              <PrepBanner
                title={cookDay === today ? 'Prep day today' : `Prep day ${prepDayName(cookDay)}`}
                subtitle={prepSummary(prepList, current.choices.prepMinutes)}
                onPress={() => router.push('/prep-day')}
              />
            )}
            <TodayPlanCard
              title={shownDay === today ? 'Today' : shownName}
              isToday={shownDay === today}
              meals={shownMeals}
              onOpen={openMeal}
              onEdit={() => router.push('/plan')}
            />
            <ListRow
              icon={<ShoppingBasket size={20} color={colors.sageInk} strokeWidth={2} />}
              title="Shopping list"
              subtitle={extra?.shopping ?? ''}
              onPress={() => router.push('/shopping-list')}
            />
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
            {askCard}

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
        onAddFridge={addFridge}
        onSubmit={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2, gap: space.s4 + space.s1 },
  heading: { gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s4, paddingHorizontal: space.s3, gap: space.s3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  cardText: { flex: 1, gap: space.s1 },
  cardButtons: { gap: space.s1_5 },
  pills: { flexDirection: 'row', gap: space.s2 },
  fill: { flex: 1 },
  section: { gap: space.s1_5 },
});
