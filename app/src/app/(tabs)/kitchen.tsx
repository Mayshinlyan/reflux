import { router, useFocusEffect } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { FeedbackButton, feedbackButtonClearance } from '@/components/FeedbackButton';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { AiIdeasButton } from '@/components/kitchen/AiIdeasButton';
import { FridgeRow } from '@/components/kitchen/FridgeRow';
import { IdeasPanel, type IdeasStatus } from '@/components/kitchen/IdeasPanel';
import { type IdeasChoices, IdeasSheet } from '@/components/kitchen/IdeasSheet';
import { PillButton } from '@/components/kitchen/PillButton';
import { SavedCarousel } from '@/components/kitchen/SavedCarousel';
import { Screen } from '@/components/Screen';
import { useTourTarget } from '@/components/tour/TourContext';
import { type CuisineKey, isCuisineKey, isRecipeTime } from '@/constants/cuisines';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listAvoidFoods } from '@/db/repositories/avoidFoods';
import { fridgeUpdatedAt, listFridgeItems } from '@/db/repositories/fridgeItems';
import { listSavedRecipes, type StoredRecipe } from '@/db/repositories/savedRecipes';
import { getSetting } from '@/db/repositories/settings';
import { AppError, type ErrorCode } from '@/lib/errors';
import { buildRecipeRequest, countRound, roundsLeft, roundsToday, todayKey } from '@/lib/kitchen';
import { lookForRound } from '@/lib/recipeLook';
import { logger } from '@/lib/logger';
import { parseWanted } from '@/lib/recipe';
import { setRecipeDraft } from '@/lib/recipeDraft';
import { fetchRecipeIdeas } from '@/services/relayClient';
import { cardEdge, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

type Results = { status: IdeasStatus; cuisine: CuisineKey; recipes: Recipe[]; errorCode?: ErrorCode };

/**
 * Kitchen: recipe ideas that go easy on your belly (Figma rows 29 and 38). With saved recipes, they are the cards
 * to swipe, with "Saved" (the full list) and "AI Ideas" under them; with none, a "Cook something" card opens the
 * choices sheet. The ideas come back three at a time to swipe through, and one opens as a full recipe page. "AI
 * Ideas" counts the ideas not looked at yet, and starts a fresh round once they were. After 10 rounds in a day the
 * kitchen is closed until tomorrow.
 */
export default function KitchenScreen() {
  const colors = useColors();
  const db = useDb();
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  // The app tour spotlights the ideas button (the pill, or "Get ideas" before anything is saved) and the fridge row.
  const ideasTarget = useTourTarget('aiIdeas');
  const fridgeTarget = useTourTarget('fridge');
  const [saved, setSaved] = useState<StoredRecipe[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [fridge, setFridge] = useState<{ count: number; updatedAt: string | null }>({
    count: 0,
    updatedAt: null,
  });
  const [asking, setAsking] = useState(false);
  // Bumped on every open, so the sheet starts from the last choices with an empty ingredients field.
  const [opened, setOpened] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  // What the ideas sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [results, setResults] = useState<Results>({ status: 'loading', cuisine: 'any', recipes: [] });
  const running = useRef<AbortController | null>(null);
  // Leaving the tab (or wiping all data) must not let a late answer write back into the settings.
  useEffect(() => () => running.current?.abort(), []);
  const lastChoices = useRef<IdeasChoices | null>(null);
  // Dishes already shown since the sheet's choices were made, so "Generate more" gives new ones.
  const shown = useRef<string[]>([]);
  // Opening a recipe waits for the sheet to finish closing, so the page isn't pushed under a closing modal.
  const openAfterClose = useRef(false);
  // Likewise, "Get ideas" waits for the choices sheet to close before asking and opening the ideas sheet.
  const pendingAsk = useRef<IdeasChoices | null>(null);
  const openFridgeAfterAsk = useRef(false);
  // True while the ideas sheet shows a round brought back with "AI Ideas"; closing that one clears the count.
  const lookedBack = useRef(false);

  const reload = useCallback(() => {
    try {
      setSaved(listSavedRecipes(db));
      setSkipped(listAvoidFoods(db).map((food) => food.name));
      setFridge({ count: listFridgeItems(db).length, updatedAt: fridgeUpdatedAt(db) });
    } catch (error) {
      logger.error('loadKitchen', error);
    }
  }, [db]);
  useFocusEffect(reload);

  const initial = {
    cuisine: isCuisineKey(settings.kitchenCuisine) ? settings.kitchenCuisine : 'any',
    time: isRecipeTime(settings.kitchenTime) ? settings.kitchenTime : '40',
    serves: settings.kitchenServes,
    useFridge: settings.kitchenUseFridge,
  } as const;
  const ideasCount = settings.kitchenIdeas?.recipes.length ?? 0;
  // Ideas made but not opened yet; once the sheet was opened and closed, "AI Ideas" starts fresh with no count.
  const waiting = settings.kitchenIdeas && !settings.kitchenIdeas.seen ? ideasCount : 0;

  const left = roundsLeft(settings.kitchenRounds, todayKey());
  const closed = left === 0;
  // Closed for the day with no ideas waiting: "AI Ideas" has nothing to offer until tomorrow.
  const backTomorrow = closed && waiting === 0;

  const openAsk = () => {
    // Starting over drops an ask still waiting for the old sheet to close, so a cancelled one never runs later.
    pendingAsk.current = null;
    setOpened((count) => count + 1);
    setAsking(true);
  };

  const run = async (choices: IdeasChoices, more: boolean) => {
    lastChoices.current = choices;
    lookedBack.current = false;
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
        useFridge: choices.useFridge,
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
      // Kept, so "AI Ideas" can bring this round back after the sheet is closed or the app restarted.
      try {
        update('kitchenIdeas', { cuisine: choices.cuisine, recipes, seen: false });
      } catch (error) {
        logger.error('saveKitchenIdeas', error);
      }
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
      // With no fridge the sheet can only say "off", which says nothing about what they prefer.
      if (fridge.count > 0) update('kitchenUseFridge', choices.useFridge);
    } catch (error) {
      logger.error('saveKitchenChoices', error);
    }
    // The ideas sheet opens only once this one has finished closing: a second sheet can't open on top of one that
    // is still sliding away (on an iPhone it never appears, and the screen looks stuck).
    pendingAsk.current = choices;
    setAsking(false);
  };
  // "Add items" in the empty-fridge row closes the sheet, then opens the fridge screen once it has finished closing.
  const addFridge = () => {
    pendingAsk.current = null;
    openFridgeAfterAsk.current = true;
    setAsking(false);
  };
  const afterAsk = () => {
    if (openFridgeAfterAsk.current) {
      openFridgeAfterAsk.current = false;
      router.push('/fridge');
      return;
    }
    const choices = pendingAsk.current;
    if (!choices) return;
    pendingAsk.current = null;
    void run(choices, false);
  };

  const stop = () => {
    running.current?.abort();
    setPanelOpen(false);
  };
  /**
   * The ideas shown when they were made leave the count on "AI Ideas"; once they were brought back and closed (or one
   * was opened), the count goes and the next tap asks for a fresh round.
   */
  const markSeen = () => {
    const last = settings.kitchenIdeas;
    if (!lookedBack.current || !last || last.seen || results.status !== 'ready') return;
    try {
      update('kitchenIdeas', { ...last, seen: true });
    } catch (error) {
      logger.error('markKitchenIdeasSeen', error);
    }
  };
  const closePanel = () => {
    if (results.status === 'loading') return stop();
    markSeen();
    setPanelOpen(false);
  };
  const cook = (recipe: Recipe) => {
    markSeen();
    setRecipeDraft({ recipe, cuisine: results.cuisine });
    openAfterClose.current = true;
    setPanelOpen(false);
  };
  const afterPanel = () => {
    if (!openAfterClose.current) return;
    openAfterClose.current = false;
    router.push('/recipe');
  };
  /** Looks back at the last round: free, it asks nothing of the AI and does not count as a round. */
  const lookBack = () => {
    const last = settings.kitchenIdeas;
    if (!last) return;
    // After a restart there are no choices to ask again with, so they are rebuilt from how the sheet was left.
    lastChoices.current ??= {
      cuisine: last.cuisine,
      time: initial.time,
      serves: initial.serves,
      want: '',
      useFridge: initial.useFridge && fridge.count > 0,
    };
    if (shown.current.length === 0) shown.current = last.recipes.map((recipe) => recipe.title);
    lookedBack.current = true;
    setResults({ status: 'ready', cuisine: last.cuisine, recipes: last.recipes });
    setPanelOpen(true);
  };
  const retry = () => {
    if (lastChoices.current) void run(lastChoices.current, true);
  };
  const more = () => {
    if (lastChoices.current && !closed) void run(lastChoices.current, true);
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        // The Feedback pill floats over the lower right, so the last saved recipe scrolls up past it.
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
            What shall we cook?
          </AppText>
        </View>

        {saved.length > 0 ? (
          <View style={styles.savedBlock}>
            <SavedCarousel
              items={saved}
              onOpen={(id) => router.push({ pathname: '/recipe', params: { saved: String(id) } })}
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
              <View ref={ideasTarget} style={styles.fill}>
                <PillButton
                  icon={<Belly mood="happy" size={28} />}
                  label={backTomorrow ? 'Back tomorrow' : 'AI Ideas'}
                  count={waiting}
                  disabled={backTomorrow}
                  accessibilityLabel={
                    backTomorrow ? 'Back tomorrow' : waiting > 0 ? `AI Ideas, ${waiting}` : 'AI Ideas'
                  }
                  accessibilityHint={
                    waiting > 0 ? 'Shows the ideas Bellie made last time' : 'Asks Bellie for new recipe ideas'
                  }
                  onPress={waiting > 0 ? lookBack : openAsk}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <View style={styles.cardTop}>
              <View style={styles.cardText}>
                <AppText variant="displaySmall">{closed ? 'Kitchen is closed' : 'Cook something'}</AppText>
                <AppText variant="subtitle" color="inkSoft">
                  {closed
                    ? 'Bellie is back with fresh ideas tomorrow.'
                    : 'Ideas that go easy on your belly, from what you have.'}
                </AppText>
              </View>
              <Belly mood={closed ? 'okay' : 'happy'} size={72} />
            </View>
            <View style={styles.buttons}>
              <View ref={ideasTarget} style={styles.fill}>
                <Button
                  label={closed ? 'Back tomorrow' : ideasCount > 0 ? 'New ideas' : 'Get ideas'}
                  disabled={closed}
                  onPress={openAsk}
                />
              </View>
              {ideasCount > 0 && (
                <View style={styles.fill}>
                  <AiIdeasButton count={ideasCount} onPress={lookBack} />
                </View>
              )}
            </View>
          </View>
        )}

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
      </ScrollView>

      <FeedbackButton />

      <IdeasSheet
        key={`ask-${opened}`}
        visible={asking}
        onClose={() => setAsking(false)}
        onDismissed={afterAsk}
        initial={initial}
        fridgeCount={fridge.count}
        onAddFridge={addFridge}
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
  savedBlock: { gap: space.s1 },
  pills: { flexDirection: 'row', gap: space.s2 },
  buttons: { flexDirection: 'row', gap: space.s1 + 2 },
  fill: { flex: 1 },
  section: { gap: space.s1 + 4 },
});
