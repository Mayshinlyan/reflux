import { ChefHat, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  /** "Prep day today", "Prep day Sunday". */
  title: string;
  /** "3 dishes, about 2 hours". */
  subtitle: string;
  onPress: () => void;
};

/**
 * The prep day on the Kitchen page (Figma "meal planning flow" F2): one honey banner that opens the prep day. It is
 * there from the plan until the cooking is marked done, and says whether the cooking is today or still to come.
 */
export function PrepBanner({ title, subtitle, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityHint="Opens the prep day"
      onPress={onPress}
      style={[styles.banner, { backgroundColor: colors.honeyTint }]}>
      <View style={styles.icon}>
        <ChefHat size={20} color={colors.honeyInk} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyEm">{title}</AppText>
        <AppText variant="caption" color="inkSoft">
          {subtitle}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.honeyInk} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    borderRadius: radius.md,
    paddingHorizontal: space.s1_5,
    paddingVertical: space.s1,
  },
  icon: {
    width: minTouchTarget - 4,
    height: minTouchTarget - 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  text: { flex: 1 },
});
