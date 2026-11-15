import { Leaf, Shuffle, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { RecipeArt } from '@/components/kitchen/RecipeArt';
import { type PlanSlot, slotLabel } from '@/constants/mealPlan';
import { lookFor } from '@/lib/recipeLook';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';
import type { PlanDish } from '@/types/mealPlan';

/** The picture across the top of a meal card (Figma P1). */
const ART_HEIGHT = 150;

type Props = {
  slot: PlanSlot;
  dish: PlanDish;
  skipped: boolean;
  /** Opens the dish as a recipe page. */
  onOpen: () => void;
  onSwap: () => void;
  onToggleSkip: () => void;
};

/**
 * One meal of the plan (Figma "meal planning flow" D3 and P1): the dish's picture across the top of the card (the
 * drawn art for now; a real photo can take its place), its slot, the dish, a line on why it fits, and two quiet
 * actions. A skipped meal (eating out) is dimmed, reads "Eating out", and is left out of the prep day and shopping list.
 */
export function PlanMealCard({ slot, dish, skipped, onOpen, onSwap, onToggleSkip }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slotLabel(slot)}, ${dish.title}${skipped ? ', skipped' : ''}`}
        accessibilityHint="Opens the recipe"
        onPress={onOpen}
        style={skipped && styles.skipped}>
        <RecipeArt look={lookFor(dish)} height={ART_HEIGHT} square />
        <View style={styles.body}>
          <AppText variant="label" color="inkMuted">
            {slotLabel(slot)}
          </AppText>
          <AppText variant="displaySmall">{dish.title}</AppText>
          {skipped ? (
            <AppText variant="subtitle" color="inkSoft">
              Eating out
            </AppText>
          ) : (
            <View style={styles.why}>
              <Leaf size={16} color={colors.sageInk} strokeWidth={2} />
              <AppText variant="subtitle" color="inkSoft" style={styles.whyText} numberOfLines={2}>
                {dish.why}
              </AppText>
            </View>
          )}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {!skipped && <Action icon={Shuffle} label="Swap" onPress={onSwap} />}
        <Action icon={X} label={skipped ? 'Add back' : 'Skip'} onPress={onToggleSkip} />
      </View>
    </View>
  );
}

function Action({
  icon: Icon,
  label,
  active = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={(minTouchTarget - 20) / 2}
      style={styles.action}>
      <Icon size={16} color={active ? colors.sageInk : colors.inkSoft} strokeWidth={2} />
      <AppText variant="label" style={{ color: active ? colors.sageInk : colors.inkSoft }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  skipped: { opacity: 0.6 },
  body: { gap: space.s1, paddingHorizontal: space.s2, paddingTop: space.s1_5 },
  why: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s1 },
  whyText: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: space.s3,
    minHeight: 28,
    alignItems: 'center',
    paddingHorizontal: space.s2,
    paddingTop: space.s1,
    paddingBottom: space.s2,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
