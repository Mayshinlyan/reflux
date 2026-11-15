import { Check, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import { CUISINES, type CuisineKey, cuisineLabel } from '@/constants/cuisines';
import {
  MAX_PLAN_CUISINES,
  PLAN_MODES,
  PLAN_SLOTS,
  type PlanChoices,
  type PlanMode,
  type PlanSlot,
  PREP_TIMES,
} from '@/constants/mealPlan';
import { itemsLine, updatedLine } from '@/lib/fridge';
import { skipsLine } from '@/lib/kitchenCopy';
import { cardEdge, minTouchTarget, radius, selectedEdge, selectedFill, space, useColors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing, so the next screen can open without clashing with it. */
  onDismissed?: () => void;
  /** Where the choices start: the last ones used. */
  initial: PlanChoices;
  /** What the saved fridge holds. With nothing in it the row says so and offers the way to fill it. */
  fridge: { count: number; updatedAt: string | null };
  /** The "Foods to avoid" list, so the sheet can say what is skipped. */
  skipped: readonly string[];
  /** "Add items" on an empty fridge: the page closes this sheet and opens the fridge screen. */
  onAddFridge: () => void;
  onSubmit: (choices: PlanChoices) => void;
};

/** Monday first, as the plan week runs; the values are JS weekdays (0 = Sunday). */
const DAYS = [
  { weekday: 1, letter: 'M', name: 'Monday' },
  { weekday: 2, letter: 'T', name: 'Tuesday' },
  { weekday: 3, letter: 'W', name: 'Wednesday' },
  { weekday: 4, letter: 'T', name: 'Thursday' },
  { weekday: 5, letter: 'F', name: 'Friday' },
  { weekday: 6, letter: 'S', name: 'Saturday' },
  { weekday: 0, letter: 'S', name: 'Sunday' },
] as const;

/** "Korean", "Korean +1": the cuisines picked, as one short value for the row. */
export function cuisinesValue(cuisines: readonly CuisineKey[]): string {
  const first = cuisines[0] ? cuisineLabel(cuisines[0]) : 'Any';
  return cuisines.length > 1 ? `${first} +${cuisines.length - 1}` : first;
}

/**
 * "Plan your week" (Figma "meal planning flow" B): the few choices a week plan needs, all prefilled from last time.
 * Days (tap one off for eating out or travelling), meals, cuisines (the row opens a list to tick up to four), whether
 * to use the fridge, how you cook (once, or daily) and, for cook once, how long the prep session may be. Give it a new
 * `key` each time it opens so it starts from the last choices.
 */
export function PlanSetupSheet({
  visible,
  onClose,
  onDismissed,
  initial,
  fridge,
  skipped,
  onAddFridge,
  onSubmit,
}: Props) {
  const colors = useColors();
  const [weekdays, setWeekdays] = useState(initial.weekdays);
  const [meals, setMeals] = useState(initial.meals);
  const [cuisines, setCuisines] = useState(initial.cuisines);
  const [mode, setMode] = useState<PlanMode>(initial.mode);
  const [prep, setPrep] = useState(String(initial.prepMinutes));
  const [fridgeOn, setFridgeOn] = useState(initial.useFridge);
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const hasFridge = fridge.count > 0;
  const skips = skipsLine(skipped);

  const toggleDay = (weekday: number) =>
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.length > 1
          ? current.filter((day) => day !== weekday)
          : current
        : [...current, weekday],
    );
  const toggleMeal = (slot: PlanSlot) =>
    setMeals((current) =>
      current.includes(slot)
        ? current.length > 1
          ? current.filter((item) => item !== slot)
          : current
        : PLAN_SLOTS.map((item) => item.value).filter((item) => item === slot || current.includes(item)),
    );
  /** "Any" stands alone; otherwise up to four, and unticking the last one falls back to "Any". */
  const toggleCuisine = (key: CuisineKey) =>
    setCuisines((current) => {
      if (key === 'any') return ['any'];
      const without = current.filter((item) => item !== 'any');
      if (without.includes(key)) return without.length > 1 ? without.filter((item) => item !== key) : ['any'];
      return without.length >= MAX_PLAN_CUISINES ? without : [...without, key];
    });

  const submit = () =>
    onSubmit({
      weekdays: DAYS.map((day) => day.weekday).filter((weekday) => weekdays.includes(weekday)),
      meals,
      cuisines,
      mode,
      prepMinutes: Number(prep),
      useFridge: hasFridge && fridgeOn,
    });

  const fridgeLine = fridge.updatedAt
    ? `${itemsLine(fridge.count)}, ${updatedLine(fridge.updatedAt).replace(/^./, (c) => c.toLowerCase())}`
    : itemsLine(fridge.count);

  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} tone="bg">
      <View style={styles.header}>
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
          Plan your week
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={(minTouchTarget - 36) / 2}
          style={[styles.close, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.rows}>
        <View style={[styles.card, styles.days, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <AppText>Days</AppText>
          <View style={styles.dayRow}>
            {DAYS.map((day) => {
              const on = weekdays.includes(day.weekday);
              return (
                <Pressable
                  key={day.weekday}
                  accessibilityRole="checkbox"
                  accessibilityLabel={day.name}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleDay(day.weekday)}
                  hitSlop={2}
                  style={[
                    styles.dayCircle,
                    on
                      ? { backgroundColor: colors.cta }
                      : { backgroundColor: colors.surface, ...cardEdge(colors) },
                  ]}>
                  <AppText variant="bodyEm" style={{ color: on ? colors.ctaInk : colors.inkMuted }}>
                    {day.letter}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <AppText style={styles.rowLabel}>Meals</AppText>
          <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
            {PLAN_SLOTS.map((slot) => {
              const on = meals.includes(slot.value);
              return (
                <Pressable
                  key={slot.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={slot.label}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleMeal(slot.value)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.segment, on && { backgroundColor: colors.surface }]}>
                  <AppText variant="label" color={on ? 'ink' : 'inkSoft'}>
                    {slot.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Cuisine, ${cuisinesValue(cuisines)}`}
            accessibilityState={{ expanded: cuisineOpen }}
            onPress={() => setCuisineOpen((open) => !open)}
            style={styles.row}>
            <AppText style={styles.rowLabel}>Cuisine</AppText>
            <AppText variant="bodyEm">{cuisinesValue(cuisines)}</AppText>
            {cuisineOpen ? (
              <ChevronUp size={20} color={colors.inkMuted} strokeWidth={2} />
            ) : (
              <ChevronDown size={20} color={colors.inkMuted} strokeWidth={2} />
            )}
          </Pressable>
          {cuisineOpen && (
            <View style={[styles.cuisines, { borderTopColor: colors.edge }]}>
              {CUISINES.map((cuisine) => {
                const on = cuisines.includes(cuisine.key);
                return (
                  <Pressable
                    key={cuisine.key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={cuisine.label}
                    accessibilityState={{ checked: on }}
                    onPress={() => toggleCuisine(cuisine.key)}
                    style={[
                      styles.cuisine,
                      {
                        backgroundColor: selectedFill(colors, on, 'transparent'),
                        ...selectedEdge(colors, on),
                      },
                    ]}>
                    <AppText variant="small" color={on ? 'ink' : 'inkSoft'}>
                      {cuisine.label}
                    </AppText>
                    {on && <Check size={14} color={colors.sageInk} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {hasFridge ? (
          <View style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <View style={styles.rowLabel}>
              <AppText>Use my fridge</AppText>
              <AppText variant="caption" color="inkMuted">
                {fridgeLine}
              </AppText>
            </View>
            <Toggle accessibilityLabel="Use my fridge" value={fridgeOn} onValueChange={setFridgeOn} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fridge is empty. Add items"
            onPress={onAddFridge}
            style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText style={styles.rowLabel}>Fridge is empty</AppText>
            <AppText variant="bodyEm" color="sageInk">
              Add items
            </AppText>
          </Pressable>
        )}

        <View style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <AppText style={styles.rowLabel}>Cooking</AppText>
          <SegmentedControl compact options={PLAN_MODES} value={mode} onChange={setMode} />
        </View>

        {mode === 'once' && (
          <View style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText style={styles.rowLabel}>Prep time</AppText>
            <SegmentedControl compact options={PREP_TIMES} value={prep} onChange={setPrep} />
          </View>
        )}
      </View>

      <AppText variant="caption" color="inkMuted" style={styles.note}>
        {skips ? `${skips} ` : ''}Gentle on reflux.
      </AppText>

      <Button label="Make my plan" onPress={submit} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rows: { gap: space.s1, marginBottom: space.s1 },
  card: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    paddingVertical: 8,
  },
  rowLabel: { flex: 1 },
  days: { padding: space.s2, gap: space.s1_5 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill },
  segment: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  cuisines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s1,
    padding: space.s2,
    borderTopWidth: 1,
  },
  cuisine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: space.s1_5,
    borderRadius: radius.pill,
  },
  note: { marginBottom: space.s2 },
});
