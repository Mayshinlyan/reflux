import { CalendarDays, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { cardEdge, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

/**
 * Today's "Your week with Bellie / Your list is ready" row (Figma 42d): a calendar tile, two lines and a chevron,
 * built like the entry rows under it. It opens the report and goes away once the report has been opened.
 */
export function ReportRow({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Your week with Bellie. Your list is ready"
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
        <CalendarDays size={20} color={colors.clayInk} strokeWidth={2} />
      </View>
      <View style={styles.main}>
        <AppText variant="bodyEm">Your week with Bellie</AppText>
        <AppText variant="caption" color="inkSoft">
          Your list is ready
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.inkSoft} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: space.s1_5,
    minHeight: 54,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 },
});
