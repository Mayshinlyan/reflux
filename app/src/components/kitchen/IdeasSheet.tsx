import { Check, ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import {
  type CuisineKey,
  CUISINES,
  cuisineLabel,
  MAX_SERVES,
  MIN_SERVES,
  RECIPE_TIMES,
  type RecipeTime,
} from '@/constants/cuisines';
import { skipsLine } from '@/lib/kitchenCopy';
import { minTouchTarget, radius, space, useColors } from '@/theme';

export type IdeasChoices = { cuisine: CuisineKey; time: RecipeTime; serves: number; want: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Where the choices start: the last ones used. */
  initial: Omit<IdeasChoices, 'want'>;
  /** The "I don't eat" list, so the sheet can say what is skipped. */
  skipped: readonly string[];
  onSubmit: (choices: IdeasChoices) => void;
};

/** The cuisine menu shows about six and a half rows, so it is clear that it scrolls. */
const MENU_MAX_HEIGHT = 296;
const OPTION_HEIGHT = 44;

/**
 * "What are you craving?" (Figma row 29b, 29b2): the cuisine as a dropdown that opens in place, how long you have,
 * how many it serves, and ingredients you would like to use. Get ideas hands the choices over. Give it a new `key`
 * each time it opens so it starts from the last choices with an empty ingredients field.
 */
export function IdeasSheet({ visible, onClose, initial, skipped, onSubmit }: Props) {
  const colors = useColors();
  const [cuisine, setCuisine] = useState(initial.cuisine);
  const [time, setTime] = useState(initial.time);
  const [serves, setServes] = useState(initial.serves);
  const [want, setWant] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const skips = skipsLine(skipped);

  return (
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cuisine, ${cuisineLabel(cuisine)}`}
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen((open) => !open)}
          style={[styles.row, { backgroundColor: colors.surface }]}>
          <AppText style={styles.rowLabel}>Cuisine</AppText>
          <AppText variant="bodyEm">{cuisineLabel(cuisine)}</AppText>
          {menuOpen ? (
            <ChevronUp size={20} color={colors.inkMuted} strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color={colors.inkMuted} strokeWidth={2} />
          )}
        </Pressable>
        {menuOpen && (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Cuisine"
            style={[styles.menu, { backgroundColor: colors.surface }]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {CUISINES.map((option) => {
                const selected = option.key === cuisine;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setCuisine(option.key);
                      setMenuOpen(false);
                    }}
                    style={[styles.option, selected && { backgroundColor: colors.sageTint }]}>
                    <AppText
                      variant={selected ? 'bodyEm' : 'body'}
                      color={selected ? 'sageInk' : 'ink'}
                      style={styles.rowLabel}>
                      {option.label}
                    </AppText>
                    {selected && <Check size={18} color={colors.sageInk} strokeWidth={2} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={[styles.row, { backgroundColor: colors.surface }]}>
          <AppText style={styles.rowLabel}>Ready in</AppText>
          <SegmentedControl options={RECIPE_TIMES} value={time} onChange={setTime} />
        </View>

        <View style={[styles.row, { backgroundColor: colors.surface }]}>
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

        <TextField
          label="Ingredients to use"
          hideLabel
          value={want}
          onChangeText={setWant}
          placeholder="Ingredients to use (optional)"
          maxLength={200}
          returnKeyType="done"
        />
      </View>

      {skips ? (
        <AppText variant="caption" color="inkMuted">
          {skips}
        </AppText>
      ) : null}
      <Button label="Get ideas" onPress={() => onSubmit({ cuisine, time, serves, want })} />
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
  menu: { maxHeight: MENU_MAX_HEIGHT, borderRadius: radius.md, overflow: 'hidden', paddingVertical: 4 },
  option: {
    height: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
  },
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
