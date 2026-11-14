import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import type { Ref } from 'react';

import { AppText } from '@/components/AppText';
import { cardEdge, minTouchTarget, radius, space, type Palette, useColors } from '@/theme';

type Props = {
  icon: LucideIcon;
  /** The round icon's tint and ink, e.g. `lavender` for `lavenderTint` and `lavenderInk`. */
  tone: 'lavender' | 'honey';
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Lets the app tour spotlight the row (see `useTourTarget`). */
  targetRef?: Ref<ViewInstance>;
};

const TONES = {
  lavender: { tint: 'lavenderTint', ink: 'lavenderInk' },
  honey: { tint: 'honeyTint', ink: 'honeyInk' },
} as const satisfies Record<Props['tone'], { tint: keyof Palette; ink: keyof Palette }>;

/** A Profile row (Figma G6a): a tinted round icon, a title with one quiet line under it, a chevron. */
export function ProfileLinkRow({ icon: Icon, tone, title, subtitle, onPress, targetRef }: Props) {
  const colors = useColors();
  return (
    <Pressable
      ref={targetRef}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, ...cardEdge(colors), opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors[TONES[tone].tint] }]}>
        <Icon size={22} color={colors[TONES[tone].ink]} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyEm">{title}</AppText>
        <AppText variant="caption" color="inkSoft">
          {subtitle}
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
    gap: space.s2,
    minHeight: minTouchTarget + space.s3,
    borderRadius: radius.lg,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1_5,
  },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
