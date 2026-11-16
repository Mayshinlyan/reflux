import { ChevronDown, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import type { CuisineKey } from '@/constants/cuisines';
import {
  MAX_PLAN_CUISINES,
  PLAN_MODES,
  PLAN_SLOTS,
  type PlanChoices,
  type PlanMode,
  type PlanSlot,
  PREP_TIMES,
  prepWeekday,
  WEEK_DAYS,
} from '@/constants/mealPlan';
import { itemsLine, updatedLine } from '@/lib/fridge';
import { cardEdge, minTouchTarget, radius, selectedEdge, space, useColors } from '@/theme';

import { CuisineStrip } from './CuisineStrip';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing, so the next screen can open without clashing with it. */
  onDismissed?: () => void;
  /** Where the choices start: the last ones used. */
  initial: PlanChoices;
  /** What the saved fridge holds. With nothing in it the row says so and offers the way to fill it. */
  fridge: { count: number; updatedAt: string | null };
  /** "Add items" on an empty fridge: the page closes this sheet and opens the fridge screen. */
  onAddFridge: () => void;
  onSubmit: (choices: PlanChoices) => void;
};

const DAYS = WEEK_DAYS;

/** "Sunday": the name of a weekday. */
const dayName = (weekday: number): string => DAYS.find((day) => day.weekday === weekday)?.name ?? 'Sunday';

/**
 * "Plan your week" (Figma "meal planning flow" B): the few choices a week plan needs, all prefilled from last time.
 * The cuisines (the illustrated strip on top: tap up to four), days (tap one off for eating out or travelling), meals, whether
 * to use the fridge, how you cook (once, or daily) and, for cook once, how long the prep session may be and which day
 * to cook on (a honey pill that opens the list of days, Figma "meal planning flow" B5 and B6). Give it a new
 * `key` each time it opens so it starts from the last choices.
 */
export function PlanSetupSheet({
  visible,
  onClose,
  onDismissed,
  initial,
  fridge,
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
  const [prepDay, setPrepDay] = useState(prepWeekday(initial));
  const [prepDayOpen, setPrepDayOpen] = useState(false);
  const hasFridge = fridge.count > 0;

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
      prepDay,
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
        {/* First, straight on the sheet and running to its edges (Figma B8 and B9). */}
        <CuisineStrip value={cuisines} onToggle={toggleCuisine} />

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

        {mode === 'once' && (
          <View style={[styles.card, styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText style={styles.rowLabel}>Prep day</AppText>
            {/* Honey, not olive: it is the day you cook, not one of the days you eat from the plan. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Prep day, ${dayName(prepDay)}`}
              accessibilityHint="Opens the list of days"
              onPress={() => setPrepDayOpen(true)}
              hitSlop={4}
              style={[styles.dayPill, { backgroundColor: colors.honeyTint }]}>
              <AppText variant="bodyEm" style={{ color: colors.honeyInk }}>
                {dayName(prepDay)}
              </AppText>
              <ChevronDown size={18} color={colors.honeyInk} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      </View>

      <Button label="Make my plan" onPress={submit} />

      <BottomSheet visible={prepDayOpen} onClose={() => setPrepDayOpen(false)} tone="bg">
        <View style={styles.header}>
          <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
            Prep day
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the list of days"
            onPress={() => setPrepDayOpen(false)}
            hitSlop={(minTouchTarget - 36) / 2}
            style={[styles.close, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <X size={18} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </View>
        <View accessibilityRole="radiogroup" style={styles.rows}>
          {DAYS.map((day) => {
            const on = day.weekday === prepDay;
            return (
              <Pressable
                key={day.weekday}
                accessibilityRole="radio"
                accessibilityLabel={day.name}
                accessibilityState={{ checked: on }}
                onPress={() => {
                  setPrepDay(day.weekday);
                  setPrepDayOpen(false);
                }}
                style={[
                  styles.card,
                  styles.row,
                  {
                    backgroundColor: on ? colors.sageTint : colors.surface,
                    ...(on ? selectedEdge(colors, true) : cardEdge(colors)),
                  },
                ]}>
                <AppText variant={on ? 'bodyEm' : 'body'}>{day.name}</AppText>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
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
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
  },
});
