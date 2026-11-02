import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { IdeasPanel, type IdeasStatus } from '@/components/kitchen/IdeasPanel';
import { type IdeasChoices, IdeasSheet } from '@/components/kitchen/IdeasSheet';
import { RecipeRow } from '@/components/kitchen/RecipeRow';
import { Screen } from '@/components/Screen';
import { type CuisineKey, isCuisineKey, isRecipeTime } from '@/constants/cuisines';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listAvoidFoods } from '@/db/repositories/avoidFoods';
import { listSavedRecipes, type StoredRecipe } from '@/db/repositories/savedRecipes';
import { getSetting } from '@/db/repositories/settings';
import { AppError, type ErrorCode } from '@/lib/errors';
import { buildRecipeRequest, countRound, roundsLeft, roundsToday, todayKey } from '@/lib/kitchen';
import { lookForRound } from '@/lib/recipeLook';
import { logger } from '@/lib/logger';
import { parseWanted } from '@/lib/recipe';
import { setRecipeDraft } from '@/lib/recipeDraft';
import { fetchRecipeIdeas } from '@/services/relayClient';
import { radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

type Results = { status: IdeasStatus; cuisine: CuisineKey; recipes: Recipe[]; errorCode?: ErrorCode };

/**
 * Kitchen: recipe ideas that go easy on your belly (Figma row 29a, 29j, 29k). A "Cook something" card opens the
 * choices sheet; the ideas come back three at a time to swipe through, and one opens as a full recipe page. Saved
 * recipes are listed under it. After 10 rounds in a day the card says the kitchen is closed until tomorrow.
 */
export default function KitchenScreen() {
  const colors = useColors();
  const db = useDb();
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState<StoredRecipe[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  // Bumped on every open, so the sheet starts from the last choices with an empty ingredients field.
  const [opened, setOpened] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  // What the ideas sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [results, setResults] = useState<Results>({ status: 'loading', cuisine: 'any', recipes: [] });
  const running = useRef<AbortController | null>(null);
  const lastChoices = useRef<IdeasChoices | null>(null);
  // Dishes already shown since the sheet's choices were made, so "Generate more" gives new ones.
  const shown = useRef<string[]>([]);
  // Opening a recipe waits for the sheet to finish closing, so the page isn't pushed under a closing modal.
  const openAfterClose = useRef(false);
  // Likewise, "Get ideas" waits for the choices sheet to close before asking and opening the ideas sheet.
  const pendingAsk = useRef<IdeasChoices | null>(null);

  const reload = useCallback(() => {
    try {
      setSaved(listSavedRecipes(db));
      setSkipped(listAvoidFoods(db).map((food) => food.name));
    } catch (error) {
      logger.error('loadKitchen', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const left = roundsLeft(settings.kitchenRounds, todayKey());
  const closed = left === 0;

  const openAsk = () => {
    // Starting over drops an ask still waiting for the old sheet to close, so a cancelled one never runs later.
    pendingAsk.current = null;
    setOpened((count) => count + 1);
    setAsking(true);
  };

  const run = async (choices: IdeasChoices, more: boolean) => {
    lastChoices.current = choices;
    if (!more) shown.current = [];
    const controller = new AbortController();
    running.current = controller;
    setResults({ status: 'loading', cuisine: choices.cuisine, recipes: [] });
    setPanelOpen(true);
    try {
      // Built inside the try: if the phone's own lists can't be read, that is a failed round, not a silent one.
      const request = buildRecipeRequest(db, {
        cuisine: choices.cuisine,
        time: choices.time,
        serves: choices.serves,
        want: parseWanted(choices.want),
        conditions: settings.conditions,
        shown: shown.current,
      });
      const fetched = await fetchRecipeIdeas(request, controller.signal);
      if (controller.signal.aborted) return;
      // The day's round number, read fresh (the closure's copy may be old), picks the pictures: the three ideas get
      // three different looks, and the next round starts on a different one.
      const round = roundsToday(getSetting(db, 'kitchenRounds'), todayKey());
      const recipes = fetched.map((recipe, index) => ({ ...recipe, look: lookForRound(round, index) }));
      shown.current = [...shown.current, ...recipes.map((recipe) => recipe.title)];
      // A round counts once it worked; a failed one never does.
      try {
        update('kitchenRounds', countRound(getSetting(db, 'kitchenRounds'), todayKey()));
      } catch (error) {
        logger.error('countKitchenRound', error);
      }
      setResults({ status: 'ready', cuisine: choices.cuisine, recipes });
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.error('fetchRecipeIdeas', error);
      setResults({
        status: 'error',
        cuisine: choices.cuisine,
        recipes: [],
        errorCode: error instanceof AppError ? error.code : 'INTERNAL',
      });
    }
  };

  const submit = (choices: IdeasChoices) => {
    // Opens as you left it next time. A failed save only means the sheet opens on the old choices.
    try {
      update('kitchenCuisine', choices.cuisine);
      update('kitchenTime', choices.time);
      update('kitchenServes', choices.serves);
    } catch (error) {
      logger.error('saveKitchenChoices', error);
    }
    // The ideas sheet opens only once this one has finished closing: a second sheet can't open on top of one that
    // is still sliding away (on an iPhone it never appears, and the screen looks stuck).
    pendingAsk.current = choices;
    setAsking(false);
  };
  const afterAsk = () => {
    const choices = pendingAsk.current;
    if (!choices) return;
    pendingAsk.current = null;
    void run(choices, false);
  };

  const stop = () => {
    running.current?.abort();
    setPanelOpen(false);
  };
  const closePanel = () => (results.status === 'loading' ? stop() : setPanelOpen(false));
  const cook = (recipe: Recipe) => {
    setRecipeDraft({ recipe, cuisine: results.cuisine });
    openAfterClose.current = true;
    setPanelOpen(false);
  };
  const afterPanel = () => {
    if (!openAfterClose.current) return;
    openAfterClose.current = false;
    router.push('/recipe');
  };
  const retry = () => {
    if (lastChoices.current) void run(lastChoices.current, true);
  };
  const more = () => {
    if (lastChoices.current && !closed) void run(lastChoices.current, true);
  };

  const initial = {
    cuisine: isCuisineKey(settings.kitchenCuisine) ? settings.kitchenCuisine : 'any',
    time: isRecipeTime(settings.kitchenTime) ? settings.kitchenTime : '40',
    serves: settings.kitchenServes,
  } as const;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Kitchen
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            What shall we cook?
          </AppText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardText}>
              <AppText variant="displaySmall">{closed ? 'Kitchen is closed' : 'Cook something'}</AppText>
              <AppText variant="subtitle" color="inkSoft">
                {closed
                  ? 'Bellie is back with fresh ideas tomorrow.'
                  : 'Ideas that go easy on your belly, from what you like.'}
              </AppText>
            </View>
            <Belly mood={closed ? 'okay' : 'happy'} size={72} />
          </View>
          <Button label={closed ? 'Back tomorrow' : 'Get ideas'} disabled={closed} onPress={openAsk} />
        </View>

        <View style={styles.section}>
          <AppText variant="section" accessibilityRole="header">
            Saved recipes
          </AppText>
          {saved.length === 0 ? (
            <AppText variant="subtitle" color="inkMuted">
              Recipes you save will show up here.
            </AppText>
          ) : (
            saved.map((item) => (
              <RecipeRow
                key={item.id}
                recipe={item.recipe}
                onPress={() => router.push({ pathname: '/recipe', params: { saved: String(item.id) } })}
              />
            ))
          )}
        </View>
      </ScrollView>

      <IdeasSheet
        key={`ask-${opened}`}
        visible={asking}
        onClose={() => setAsking(false)}
        onDismissed={afterAsk}
        initial={initial}
        skipped={skipped}
        onSubmit={submit}
      />
      <BottomSheet visible={panelOpen} onClose={closePanel} onDismissed={afterPanel} tone="bg">
        <IdeasPanel
          status={results.status}
          cuisine={results.cuisine}
          recipes={results.recipes}
          errorCode={results.errorCode}
          canMore={!closed}
          onStop={stop}
          onClose={closePanel}
          onCook={cook}
          onMore={more}
          onRetry={retry}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2, gap: space.s4 },
  heading: { gap: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s3 - 4, gap: space.s2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.s1 + 4 },
  cardText: { flex: 1, gap: 4 },
  section: { gap: space.s1 + 4 },
});
