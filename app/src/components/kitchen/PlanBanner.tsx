import { Check, ChefHat, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouchTarget, radius, space, useColors } from '@/theme';

type Props = {
  /** "Prep day today", "Prep day Sunday", "Review your meal plan". */
  title: string;
  /** "3 dishes, about 2 hours", "5 meals, 3 dishes to prep". */
  subtitle: string;
  /** Honey for the prep day, sage for reviewing the plan. */
  tone: 'honey' | 'sage';
  /** What a screen reader says a tap does. */
  hint: string;
  onPress: () => void;
};

/**
 * A banner row on the Kitchen page (Figma "meal planning flow" F2 and F4): the honey prep day banner, there from the
 * plan until the cooking is marked done, and the green "Review your meal plan" banner, there from the moment the plan
 * is made until it has been looked over. An icon in a white circle, a title and a line, and a chevron.
 */
export function PlanBanner({ title, subtitle, tone, hint, onPress }: Props) {
  const colors = useColors();
  const honey = tone === 'honey';
  const ink = honey ? colors.honeyInk : colors.sageInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.banner, { backgroundColor: honey ? colors.honeyTint : colors.sageTint }]}>
      <View style={styles.icon}>
        {honey ? (
          <ChefHat size={20} color={ink} strokeWidth={2} />
        ) : (
          <Check size={20} color={ink} strokeWidth={2} />
        )}
      </View>
      <View style={styles.text}>
        <AppText variant="bodyEm">{title}</AppText>
        <AppText variant="caption" color="inkSoft">
          {subtitle}
        </AppText>
      </View>
      <ChevronRight size={20} color={ink} strokeWidth={2} />
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
