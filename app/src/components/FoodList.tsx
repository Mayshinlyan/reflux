import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { MealResultCard } from '@/components/MealResultCard';
import { MealTimeSheet, pickTimeAndroid } from '@/components/MealTimeSheet';
import { Screen } from '@/components/Screen';
import { SwipeToDelete } from '@/components/SwipeToDelete';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { VERDICT_LABELS } from '@/components/VerdictBadge';
import { useDb } from '@/db/DatabaseProvider';
import { listDiaryFoodLogs } from '@/db/repositories/food';
import {
  listSavedFoods,
  logSavedFood,
  MAX_SAVED_FOOD_NAME,
  removeSavedFood,
  renameSavedFood,
  type StoredSavedFood,
} from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';
import { friendlyMessages } from '@/lib/errors';
import { formatTime, localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import { formatMealTime } from '@/lib/mealTime';
import { currentTimeZone } from '@/lib/time';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

/** How long a row says "Logged ✓" (and ignores taps) after a one-tap log, so a double-tap can't log twice. */
const LOGGED_FLASH_MS = 2500;
const DAY_MS = 86_400_000;

/** What has been eaten today, per meal name (lower case): how many times and when last. */
type EatenToday = Map<string, { count: number; lastAt: string; tz: string }>;

function loadEatenToday(db: AppDb): EatenToday {
  const now = new Date();
  const tz = currentTimeZone();
  const today = localDayKey(now.toISOString(), tz);
  const meals = listDiaryFoodLogs(db, {
    from: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
    to: new Date(now.getTime() + DAY_MS).toISOString(),
  });
  const eaten: EatenToday = new Map();
  for (const meal of meals) {
    if (localDayKey(meal.loggedAt, meal.tz) !== today) continue;
    const key = meal.mealName.toLowerCase();
    // Meals come oldest first, so the last one seen is the most recent.
    eaten.set(key, { count: (eaten.get(key)?.count ?? 0) + 1, lastAt: meal.loggedAt, tz: meal.tz });
  }
  return eaten;
}

/**
 * "Log food" when there are saved foods: "Quick Log" as cards. Log asks when it was eaten (now,
 * or earlier in the past week), then logs it with the verdict it was saved with, no new analysis. Tap a food
 * to rename, re-check or remove it, or swipe it left to delete. "Log a new food" checks one from a photo or a
 * description; the result can be logged as eaten, saved to this list, or both.
 */
export function FoodList() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();

  const [foods, setFoods] = useState<StoredSavedFood[]>([]);
  const [eaten, setEaten] = useState<EatenToday>(new Map());
  const [loadFailed, setLoadFailed] = useState(false);
  const [justLogged, setJustLogged] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // The food whose Log was tapped, while the "When did you eat this?" sheet is open (iPhone).
  const [logging, setLogging] = useState<StoredSavedFood | null>(null);

  const [editing, setEditing] = useState<StoredSavedFood | null>(null);
  // What the sheet shows. Not cleared on close, so the sheet keeps its content while it slides away.
  const [sheetFood, setSheetFood] = useState<StoredSavedFood | null>(null);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    try {
      setFoods(listSavedFoods(db));
      setEaten(loadEatenToday(db));
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadSavedFoods', error);
      setLoadFailed(true);
    }
  }, [db]);
  useFocusEffect(reload);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const trimmedName = name.trim();
  const closeForm = () => setEditing(null);
  const openEdit = (food: StoredSavedFood) => {
    setName(food.mealName);
    setEditing(food);
    setSheetFood(food);
  };

  /** "Log a new food": the photo/text check. */
  const addFood = () => router.push({ pathname: '/log/food', params: { check: '1' } });

  const checkFood = () => {
    if (!editing) return;
    const id = editing.id;
    // Keep a rename typed before tapping here; the checked food keeps that name.
    if (trimmedName && trimmedName !== editing.mealName) {
      try {
        renameSavedFood(db, id, trimmedName);
      } catch (error) {
        logger.error('renameSavedFood', error);
      }
    }
    setEditing(null);
    router.push({ pathname: '/log/food', params: { myFood: '1', food: String(id) } });
  };

  /** Log was tapped: ask when it was eaten first. */
  const askWhen = (food: StoredSavedFood) => {
    if (Platform.OS === 'android') pickTimeAndroid(new Date(), (at) => logOnce(food, at));
    else setLogging(food);
  };

  /** Logs the food at `at`, or right now when `at` is null. */
  const logOnce = (food: StoredSavedFood, at: Date | null) => {
    // `disabled` only applies after a re-render, so two taps in the same instant must be caught here.
    if (timers.current.has(food.id)) return;
    try {
      logSavedFood(db, food.id, at?.toISOString());
    } catch (error) {
      logger.error('logSavedFood', error);
      Alert.alert("Couldn't log", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // An earlier meal doesn't show under "Eaten today", so the toast says when it was logged for.
    toast(at ? `${food.mealName} logged for ${formatMealTime(at, new Date())}` : `${food.mealName} logged`);
    setJustLogged((current) => new Set(current).add(food.id));
    timers.current.set(
      food.id,
      setTimeout(() => {
        timers.current.delete(food.id);
        setJustLogged((current) => {
          const next = new Set(current);
          next.delete(food.id);
          return next;
        });
      }, LOGGED_FLASH_MS),
    );
    reload();
  };

  const save = () => {
    if (!editing || !trimmedName) return;
    try {
      renameSavedFood(db, editing.id, trimmedName);
    } catch (error) {
      logger.error('renameSavedFood', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast('Changes saved');
    setEditing(null);
    reload();
  };

  /** From the edit sheet or a left swipe on a row: asks first, then takes the food off the list. */
  const confirmRemove = (id: number, label: string) => {
    Alert.alert(`Remove ${label || 'this food'}?`, 'It leaves your list, but past meals stay in History.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          try {
            removeSavedFood(db, id);
          } catch (error) {
            logger.error('removeSavedFood', error);
            Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
            return;
          }
          toast('Removed from your list');
          setEditing(null);
          reload();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackHeader title="Log food" />
        {loadFailed && foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your foods are still on this phone.`}
          </AppText>
        ) : foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            Add the foods you eat often, or save a meal from History, then log each one with a single tap.
          </AppText>
        ) : (
          <>
            <AppText variant="label" color="inkSoft" accessibilityRole="header" style={styles.heading}>
              Quick Log
            </AppText>
            {foods.map((food) => {
              const today = eaten.get(food.mealName.toLowerCase());
              const done = justLogged.has(food.id);
              return (
                <SwipeToDelete
                  key={food.id}
                  label={food.mealName}
                  style={styles.row}
                  onDelete={() => confirmRemove(food.id, food.mealName)}>
                  <View
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${food.mealName}`}
                      // Swiping isn't possible with a screen reader, so offer Delete from its actions menu.
                      accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
                      onAccessibilityAction={(event) => {
                        if (event.nativeEvent.actionName === 'delete') confirmRemove(food.id, food.mealName);
                      }}
                      onPress={() => openEdit(food)}
                      style={styles.info}>
                      {food.photoUri ? (
                        <Image source={{ uri: food.photoUri }} style={styles.icon} contentFit="cover" />
                      ) : (
                        <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                          <Utensils size={18} color={colors.clayInk} strokeWidth={2.2} />
                        </View>
                      )}
                      <View style={styles.text}>
                        <AppText style={styles.foodName} numberOfLines={2}>
                          {food.mealName}
                        </AppText>
                        <AppText variant="caption" color="inkSoft">
                          {food.overallVerdict ? VERDICT_LABELS[food.overallVerdict] : 'No verdict'}
                          {today
                            ? ` · Eaten today ${formatTime(today.lastAt, today.tz)}${today.count > 1 ? ` (${today.count}×)` : ''}`
                            : ''}
                        </AppText>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={done ? `${food.mealName} logged` : `Log ${food.mealName}`}
                      accessibilityState={{ disabled: done }}
                      disabled={done}
                      onPress={() => askWhen(food)}
                      style={({ pressed }) => [
                        styles.logButton,
                        {
                          backgroundColor: done ? colors.sageInk : colors.sageTint,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <AppText style={[styles.logText, { color: done ? colors.ctaInk : colors.sageInk }]}>
                        {done ? 'Logged ✓' : 'Log'}
                      </AppText>
                    </Pressable>
                  </View>
                </SwipeToDelete>
              );
            })}
          </>
        )}
        <Pressable accessibilityRole="button" onPress={addFood} style={styles.add}>
          <AppText style={[styles.addText, { color: colors.clayInk }]}>+ Log a new food</AppText>
        </Pressable>
      </ScrollView>

      <MealTimeSheet
        visible={logging !== null}
        question="When did you eat this?"
        confirmLabel="Log it"
        onConfirm={(at) => {
          const food = logging;
          setLogging(null);
          if (food) logOnce(food, at);
        }}
        onClose={() => setLogging(null)}
      />

      <BottomSheet visible={editing !== null} onClose={closeForm}>
        {/* The saved verdict first, like a meal in History; editing sits below it. */}
        <AppText variant="title" accessibilityRole="header" style={styles.sheetTitle}>
          {sheetFood?.mealName}
        </AppText>
        {sheetFood?.photoUri ? (
          <Image
            source={{ uri: sheetFood.photoUri }}
            style={styles.sheetPhoto}
            contentFit="cover"
            accessibilityLabel="Your food photo"
          />
        ) : null}
        {sheetFood?.analysis ? (
          <MealResultCard analysis={sheetFood.analysis} showTitle={false} />
        ) : (
          <AppText color="inkSoft">No verdict yet.</AppText>
        )}
        <View style={styles.sheetField}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. oatmeal with banana"
            maxLength={MAX_SAVED_FOOD_NAME}
            returnKeyType="done"
            onSubmitEditing={save}
          />
        </View>
        <Button label="Save" onPress={save} disabled={!trimmedName} />
        <View style={styles.secondary}>
          {/* A photo or a description goes through the verdict flow; the food keeps its name. */}
          <Button
            label={sheetFood?.overallVerdict ? 'Check again' : 'Get a verdict'}
            variant="secondary"
            onPress={checkFood}
          />
          <Button
            label="Remove from my list"
            variant="quietDanger"
            onPress={() => editing && confirmRemove(editing.id, trimmedName)}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  heading: { marginBottom: space.s1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.s1,
    paddingLeft: space.s1,
    paddingRight: space.s1,
  },
  // On the swipe container, not the card, so the revealed Delete button is exactly the card's height.
  row: { marginBottom: space.s1 },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: minTouchTarget,
    padding: 4,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  foodName: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: 'Nunito_700Bold' },
  logButton: {
    minWidth: 76,
    minHeight: minTouchTarget,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logText: { ...typography.label, fontSize: 14, fontFamily: 'Nunito_800ExtraBold' },
  add: { minHeight: minTouchTarget, justifyContent: 'center', paddingVertical: space.s1 },
  addText: { ...typography.bodyEm, fontSize: 15, fontFamily: 'Nunito_700Bold' },
  sheetTitle: { marginBottom: space.s1 },
  sheetPhoto: { width: '100%', height: 180, borderRadius: radius.lg, marginBottom: space.s1 },
  sheetField: { marginTop: space.s2, marginBottom: space.s1 },
  secondary: { marginTop: space.s1, gap: space.s1 },
});
