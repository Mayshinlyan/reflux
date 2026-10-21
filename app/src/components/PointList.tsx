import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

export type Point = { icon: LucideIcon; title: string; body: string };

/** A short list of points: a tan icon circle, a title and a line under it (privacy, the onboarding recap). */
export function PointList({ points }: { points: readonly Point[] }) {
  const colors = useColors();
  return (
    <View style={styles.list}>
      {points.map(({ icon: Icon, title, body }) => (
        <View key={title} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.surface2 }]}>
            <Icon size={20} color={colors.ink} strokeWidth={2} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyEm">{title}</AppText>
            <AppText variant="caption" color="inkSoft">
              {body}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  icon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
