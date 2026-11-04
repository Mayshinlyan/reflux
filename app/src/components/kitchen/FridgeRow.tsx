import { Refrigerator } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PRESS_SHRINK, usePressScale } from '@/hooks/usePressScale';
import { fridgeIsStale, itemsLine, updatedLine } from '@/lib/fridge';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  /** How many things the saved fridge holds; 0 when there is none yet. */
  count: number;
  /** When it was last scanned (an ISO time); null with no fridge. */
  updatedAt: string | null;
  onPress: () => void;
  /** Tests pin the clock. */
  now?: Date;
};

/**
 * The Kitchen's "My fridge" row (Figma 29a, 29a2, 29k). With a fridge: how many things and when it was updated; after
 * a week the line asks "Update your fridge?" and the pill turns green (no notification). Without one: an invitation.
 * The whole row opens My fridge.
 */
export function FridgeRow({ count, updatedAt, onPress, now }: Props) {
  const colors = useColors();
  const press = usePressScale(PRESS_SHRINK);
  const has = count > 0 && updatedAt !== null;
  const stale = has && fridgeIsStale(updatedAt, now);
  const title = has ? itemsLine(count) : 'Add your fridge';
  const line = !has
    ? 'Snap a photo and Bellie lists it.'
    : stale
      ? 'Update your fridge?'
      : updatedLine(updatedAt, now);
  const action = has ? 'Update' : 'Add';
  const loud = stale || !has;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`My fridge, ${title}. ${line}`}
        accessibilityHint="Opens your fridge list"
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <View style={[styles.icon, { backgroundColor: colors.sageTint }]}>
          <Refrigerator size={22} color={colors.sageInk} strokeWidth={2} />
        </View>
        <View style={styles.text}>
          <AppText numberOfLines={1}>{title}</AppText>
          <AppText variant="caption" color="inkSoft" numberOfLines={2}>
            {line}
          </AppText>
        </View>
        <View style={[styles.pill, { backgroundColor: loud ? colors.cta : colors.sageTint }]}>
          <AppText variant="label" style={{ color: loud ? colors.ctaInk : colors.sageInk }}>
            {action}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    padding: space.s1_5,
    borderRadius: radius.md,
  },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  pill: {
    minHeight: minTouchTarget - 10,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
