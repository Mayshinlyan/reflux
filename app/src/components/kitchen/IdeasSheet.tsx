import { Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import {
  type CuisineKey,
  DEFAULT_CUISINE,
  DEFAULT_SERVES,
  DEFAULT_TIME,
  DEFAULT_USE_FRIDGE,
  MAX_SERVES,
  MIN_SERVES,
  RECIPE_TIMES,
  type RecipeTime,
} from '@/constants/cuisines';
import { skipsLine } from '@/lib/kitchenCopy';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

import { CuisineStrip } from './CuisineStrip';

export type IdeasChoices = {
  cuisine: CuisineKey;
  time: RecipeTime;
  serves: number;
  want: string;
  /** Build the ideas from what is in the saved fridge. Always false when the fridge is empty. */
  useFridge: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has finished closing, so the next sheet can open without clashing with it. */
  onDismissed?: () => void;
  /** Where the choices start: the last ones used. */
  initial: Omit<IdeasChoices, 'want'>;
  /** How many things the saved fridge holds. With none, the "Use my fridge" row is left out. */
  fridgeCount: number;
  /** The "Foods to avoid" list, so the sheet can say what is skipped. */
  skipped: readonly string[];
  onSubmit: (choices: IdeasChoices) => void;
};

/**
 * "What are you craving?" (Figma row 37, the Airbnb-style form): the cuisine as a strip of round illustrated tiles
 * straight on the sheet, then one card holding how long you have, how many it serves and whether to use the fridge,
 * then an ingredients field. Every control is one tap away. Clear all puts the choices back to their defaults and
 * Get ideas hands them over. Give it a new `key` each time it opens so it starts from the last choices with an
 * empty ingredients field.
 */
export function IdeasSheet({
  visible,
  onClose,
  onDismissed,
  initial,
  fridgeCount,
  skipped,
  onSubmit,
}: Props) {
  const colors = useColors();
  const [cuisine, setCuisine] = useState(initial.cuisine);
  const [time, setTime] = useState(initial.time);
  const [serves, setServes] = useState(initial.serves);
  const [fridgeOn, setFridgeOn] = useState(initial.useFridge);
  const [want, setWant] = useState('');
  // Bumped by Clear all so the strip opens again on the cuisine it was reset to.
  const [stripKey, setStripKey] = useState(0);
  const hasFridge = fridgeCount > 0;
  const useFridge = hasFridge && fridgeOn;
  const skips = skipsLine(skipped);

  const clearAll = () => {
    setCuisine(DEFAULT_CUISINE);
    setTime(DEFAULT_TIME);
    setServes(DEFAULT_SERVES);
    setFridgeOn(DEFAULT_USE_FRIDGE);
    setWant('');
    setStripKey((key) => key + 1);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} tone="bg">
      <View style={styles.header}>
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.title}>
          What are you craving?
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={(minTouchTarget - 36) / 2}
          style={[styles.close, { backgroundColor: colors.surface }]}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.rows}>
        <CuisineStrip key={stripKey} value={cuisine} onChange={setCuisine} />

        <View style={[styles.group, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <View style={styles.row}>
            <AppText style={styles.rowLabel}>Ready in</AppText>
            <SegmentedControl compact options={RECIPE_TIMES} value={time} onChange={setTime} />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.edge }]} />

          <View style={styles.row}>
            <AppText style={styles.rowLabel}>Serves</AppText>
            <View style={styles.stepper}>
              <StepButton
                label="Fewer servings"
                icon={Minus}
                disabled={serves <= MIN_SERVES}
                onPress={() => setServes((count) => Math.max(MIN_SERVES, count - 1))}
              />
              <AppText variant="bodyEm" accessibilityLabel={`${serves} servings`} style={styles.count}>
                {serves}
              </AppText>
              <StepButton
                label="More servings"
                icon={Plus}
                disabled={serves >= MAX_SERVES}
                onPress={() => setServes((count) => Math.min(MAX_SERVES, count + 1))}
              />
            </View>
          </View>

          {/* With nothing in the fridge there is nothing to switch on: the row waits until a fridge is saved. */}
          {hasFridge && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.edge }]} />
              <View style={styles.row}>
                <AppText style={styles.rowLabel}>Use my fridge</AppText>
                <Toggle accessibilityLabel="Use my fridge" value={useFridge} onValueChange={setFridgeOn} />
              </View>
            </>
          )}
        </View>

        <TextField
          label="Ingredients to use"
          hideLabel
          value={want}
          onChangeText={setWant}
          placeholder="Ingredients to use (optional)"
          maxLength={200}
          returnKeyType="done"
          card
        />
      </View>

      {skips ? (
        <AppText variant="caption" color="inkMuted" style={styles.skips}>
          {skips}
        </AppText>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all"
          onPress={clearAll}
          hitSlop={8}
          style={styles.clear}>
          <AppText variant="bodyEm" style={styles.clearText}>
            Clear all
          </AppText>
        </Pressable>
        <View style={styles.cta}>
          <Button label="Get ideas" onPress={() => onSubmit({ cuisine, time, serves, want, useFridge })} />
        </View>
      </View>
    </BottomSheet>
  );
}

function StepButton({
  label,
  icon: Icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: typeof Plus;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={(minTouchTarget - STEP) / 2}
      style={[styles.step, { backgroundColor: colors.surface2, opacity: disabled ? 0.5 : 1 }]}>
      <Icon size={18} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

const STEP = 40;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rows: { gap: space.s1_5, marginBottom: space.s1 },
  // One card for the three settings, like Airbnb's "Who?" card: rows split by hairlines inset from the edge.
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingLeft: space.s2 + 4,
    paddingRight: space.s2,
    paddingVertical: 8,
  },
  rowLabel: { flex: 1 },
  divider: { height: 1, marginHorizontal: space.s2 + 4 },
  skips: { marginBottom: space.s1_5 },
  // No outer pill: two plain tan circles with the number between, as in the Figma.
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5 },
  step: {
    width: STEP,
    height: STEP,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { width: 24, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clear: { minHeight: minTouchTarget, justifyContent: 'center', flexShrink: 1, marginRight: space.s1 },
  clearText: { textDecorationLine: 'underline' },
  cta: { minWidth: 172 },
});
