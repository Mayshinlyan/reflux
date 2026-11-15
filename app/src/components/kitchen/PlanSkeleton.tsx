import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { cardEdge, radius, space, useColors } from '@/theme';

const DAYS = 7;
const CARDS = 3;

/**
 * While the plan is being made (Figma "meal planning flow" C): Bellie, a green "Planning your week" badge, and the
 * shape of the week to come, a row of seven circles and three meal cards, in the soft tan the app uses for skeletons.
 * It is the same idea as the skeleton on a meal check, so a wait feels honest rather than blank.
 */
export function PlanSkeleton() {
  const colors = useColors();
  const bar = { backgroundColor: colors.surface2 };
  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Planning your week">
      <View style={styles.top}>
        <Belly mood="happy" size={96} />
        <View style={[styles.badge, { backgroundColor: colors.sageTint }]}>
          <AppText variant="label" color="sageInk">
            Planning your week
          </AppText>
        </View>
      </View>
      <View style={styles.days}>
        {Array.from({ length: DAYS }, (_, i) => (
          <View key={i} style={[styles.day, bar]} />
        ))}
      </View>
      <View style={styles.cards}>
        {Array.from({ length: CARDS }, (_, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <View style={[styles.lineShort, bar]} />
            <View style={[styles.lineLong, bar]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s4 },
  top: { alignItems: 'center', gap: space.s2 },
  badge: { paddingHorizontal: space.s2, paddingVertical: space.s1 - 2, borderRadius: radius.pill },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 40, height: 40, borderRadius: radius.pill },
  cards: { gap: space.s2 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  lineShort: { width: 112, height: 12, borderRadius: 6 },
  lineLong: { width: '65%', height: 16, borderRadius: 8 },
});
