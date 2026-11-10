import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { cardEdge, type ColorToken, radius, space, useColors } from '@/theme';

import { AppText } from '../AppText';

type Props = {
  icon: LucideIcon;
  tint: ColorToken;
  ink: ColorToken;
  title: string;
  body: string;
};

/**
 * A short note on a white card: a round icon tile and a bold title, then one line (Figma 42b, the same header as
 * "Why it's gentle" and "Belly tip" on a recipe).
 */
export function ReportNote({ icon: Icon, tint, ink, title, body }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors[tint] }]}>
          <Icon size={20} color={colors[ink]} strokeWidth={2} />
        </View>
        <AppText variant="section" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
      </View>
      <AppText>{body}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1 + 4 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
});
