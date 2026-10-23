import { Lightbulb } from 'lucide-react-native';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/**
 * Bellie's ideas for next time (Figma 02f, 04a.4): a `sage-tint` box with a light bulb and "Tips" on top and
 * each tip as a plain line under it.
 */
export function TipsCard({ tips, style }: { tips: readonly string[]; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.sageTint }, style]}>
      <View style={styles.title}>
        <Lightbulb size={22} color={colors.honey} strokeWidth={2} />
        <AppText variant="sectionSm">Tips</AppText>
      </View>
      {tips.map((tip) => (
        <AppText key={tip} variant="small">
          {tip}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.s2, gap: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
