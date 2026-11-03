import { Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { type CuisineKey, MAX_SERVES, MIN_SERVES, RECIPE_TIMES, type RecipeTime } from '@/constants/cuisines';
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
 * "What are you craving?" (Figma row 37): the cuisine as a strip of illustrated tiles that scrolls sideways, how long you have,
 * how many it serves, and ingredients you would like to use. Get ideas hands the choices over. Give it a new `key`
 * each time it opens so it starts from the last choices with an empty ingredients field.
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
  const hasFridge = fridgeCount > 0;
  const useFridge = hasFridge && fridgeOn;
  const skips = skipsLine(skipped);

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
        <CuisineStrip value={cuisine} onChange={setCuisine} />

        <View style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <AppText style={styles.rowLabel}>Ready in</AppText>
          <SegmentedControl options={RECIPE_TIMES} value={time} onChange={setTime} />
        </View>

        <View style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <AppText style={styles.rowLabel}>Serves</AppText>
          <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
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
          <View style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText style={styles.rowLabel}>Use my fridge</AppText>
            <Toggle accessibilityLabel="Use my fridge" value={useFridge} onValueChange={setFridgeOn} />
          </View>
        )}

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
      <Button label="Get ideas" onPress={() => onSubmit({ cuisine, time, serves, want, useFridge })} />
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
      style={[styles.step, { backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 }]}>
      <Icon size={16} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

const STEP = 32;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  title: { flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rows: { gap: space.s1, marginBottom: space.s2 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingLeft: space.s2,
    paddingRight: space.s1 + 4,
    borderRadius: radius.md,
  },
  rowLabel: { flex: 1 },
  skips: { marginBottom: space.s1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: radius.pill },
  step: {
    width: STEP,
    height: STEP,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { width: 28, textAlign: 'center' },
});
