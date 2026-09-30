import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { VERDICT_LABELS } from '@/components/VerdictBadge';
import { useDb } from '@/db/DatabaseProvider';
import {
  createSavedFood,
  listSavedFoods,
  logSavedFood,
  MAX_SAVED_FOOD_NAME,
  removeSavedFood,
  renameSavedFood,
  type StoredSavedFood,
} from '@/db/repositories/savedFoods';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

/** How long a row says "Logged ✓" (and ignores taps) after a one-tap log, so a double-tap can't log twice. */
const LOGGED_FLASH_MS = 2500;

type Form = { mode: 'add' } | { mode: 'edit'; id: number };

/**
 * "My foods": meals saved for one-tap logging. Tap Log to add one to the diary as eaten now (with the
 * verdict it was saved with, no new analysis); tap a food to rename or remove it; "Add a food" saves a
 * new one by name. Foods are also saved from History, with "Save to My foods".
 */
export default function MyFoodsScreen() {
  const colors = useColors();
  const db = useDb();
  const toast = useToast();

  const [foods, setFoods] = useState<StoredSavedFood[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [justLogged, setJustLogged] = useState<ReadonlySet<number>>(new Set());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState('');

  const reload = useCallback(() => {
    try {
      setFoods(listSavedFoods(db));
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
  const closeForm = () => setForm(null);
  const openAdd = () => {
    setName('');
    setForm({ mode: 'add' });
  };
  const openEdit = (food: StoredSavedFood) => {
    setName(food.mealName);
    setForm({ mode: 'edit', id: food.id });
  };

  const logOnce = (food: StoredSavedFood) => {
    // `disabled` only applies after a re-render, so two taps in the same instant must be caught here.
    if (timers.current.has(food.id)) return;
    try {
      logSavedFood(db, food.id);
    } catch (error) {
      logger.error('logSavedFood', error);
      Alert.alert("Couldn't log", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(`${food.mealName} logged`);
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
  };

  const save = () => {
    if (form === null || !trimmedName) return;
    try {
      if (form.mode === 'add') createSavedFood(db, trimmedName);
      else renameSavedFood(db, form.id, trimmedName);
    } catch (error) {
      logger.error(form.mode === 'add' ? 'createSavedFood' : 'renameSavedFood', error);
      Alert.alert("Couldn't save", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(form.mode === 'add' ? `${trimmedName} added` : 'Changes saved');
    setForm(null);
    reload();
  };

  const confirmRemove = () => {
    if (form?.mode !== 'edit') return;
    const id = form.id;
    Alert.alert(
      `Remove ${trimmedName || 'this food'}?`,
      'It leaves your list, but past meals stay in History.',
      [
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
            setForm(null);
            reload();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackHeader title="My foods" />
        {loadFailed && foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            {`${friendlyMessages.INTERNAL} Your foods are still on this phone.`}
          </AppText>
        ) : foods.length === 0 ? (
          <AppText color="inkSoft" style={styles.empty}>
            Add the foods you eat often, or save a meal from History, then log each one with a single tap.
          </AppText>
        ) : (
          foods.map((food) => {
            const done = justLogged.has(food.id);
            return (
              <View
                key={food.id}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${food.mealName}`}
                  onPress={() => openEdit(food)}
                  style={styles.info}>
                  <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                    <Utensils size={18} color={colors.clayInk} strokeWidth={2.2} />
                  </View>
                  <View style={styles.text}>
                    <AppText style={styles.foodName} numberOfLines={2}>
                      {food.mealName}
                    </AppText>
                    <AppText variant="caption" color="inkSoft">
                      {food.overallVerdict ? VERDICT_LABELS[food.overallVerdict] : 'No verdict'}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={done ? `${food.mealName} logged` : `Log ${food.mealName}`}
                  accessibilityState={{ disabled: done }}
                  disabled={done}
                  onPress={() => logOnce(food)}
                  style={({ pressed }) => [
                    styles.logButton,
                    { backgroundColor: done ? colors.sageInk : colors.sageTint, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <AppText style={[styles.logText, { color: done ? colors.ctaInk : colors.sageInk }]}>
                    {done ? 'Logged ✓' : 'Log'}
                  </AppText>
                </Pressable>
              </View>
            );
          })
        )}
        <Pressable accessibilityRole="button" onPress={openAdd} style={styles.add}>
          <AppText style={[styles.addText, { color: colors.clayInk }]}>+ Add a food</AppText>
        </Pressable>
      </ScrollView>

      <BottomSheet visible={form !== null} onClose={closeForm}>
        <AppText variant="title" accessibilityRole="header">
          {form?.mode === 'edit' ? 'Edit food' : 'Add a food'}
        </AppText>
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
        {form?.mode === 'edit' && (
          <View style={styles.secondary}>
            <Button label="Remove from my list" variant="quietDanger" onPress={confirmRemove} />
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  empty: { marginBottom: space.s2, lineHeight: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.s1,
    paddingLeft: space.s1,
    paddingRight: space.s1,
    marginBottom: space.s1,
  },
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
  sheetField: { marginTop: space.s2, marginBottom: space.s1 },
  secondary: { marginTop: space.s1 },
});
