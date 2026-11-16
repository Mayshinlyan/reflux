import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { cardEdge, radius, space, useColors } from '@/theme';

type Props = { icon: ReactNode; title: string; subtitle: string; onPress: () => void };

/** A white row with a green icon tile, a title and a line under it, that opens something (Saved recipes, Shopping list, Prep day). */
export function ListRow({ icon, title, subtitle, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={[styles.tile, { backgroundColor: colors.sageTint }]}>{icon}</View>
      <View style={styles.text}>
        <AppText variant="bodyEm">{title}</AppText>
        <AppText variant="caption" color="inkMuted">
          {subtitle}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.inkMuted} strokeWidth={2} />
    </Pressable>
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
  tile: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
