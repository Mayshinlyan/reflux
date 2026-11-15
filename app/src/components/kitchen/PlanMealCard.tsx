import { Leaf, Lock, Shuffle, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { type PlanSlot, slotLabel } from '@/constants/mealPlan';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';
import type { PlanDish } from '@/types/mealPlan';

type Props = {
  slot: PlanSlot;
  dish: PlanDish;
  locked: boolean;
  skipped: boolean;
  /** Opens the dish as a recipe page. */
  onOpen: () => void;
  onSwap: () => void;
  onToggleLock: () => void;
  onToggleSkip: () => void;
};

/**
 * One meal of the plan (Figma "meal planning flow" D): its slot, the dish, a line on why it fits, and three quiet
 * actions. A locked meal is kept when the plan is redone. A skipped meal (eating out) is dimmed and a redo leaves it.
 */
export function PlanMealCard({
  slot,
  dish,
  locked,
  skipped,
  onOpen,
  onSwap,
  onToggleLock,
  onToggleSkip,
}: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${slotLabel(slot)}, ${dish.title}${skipped ? ', skipped' : ''}`}
        accessibilityHint="Opens the recipe"
        onPress={onOpen}
        style={[styles.main, skipped && styles.skipped]}>
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
      </Pressable>
      <View style={styles.actions}>
        {!skipped && <Action icon={Shuffle} label="Swap" onPress={onSwap} />}
        {!skipped && (
          <Action icon={Lock} label={locked ? 'Locked' : 'Lock'} active={locked} onPress={onToggleLock} />
        )}
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
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  skipped: { opacity: 0.6 },
  main: { gap: space.s1 },
  why: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s1 },
  whyText: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.s3, minHeight: 28, alignItems: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
