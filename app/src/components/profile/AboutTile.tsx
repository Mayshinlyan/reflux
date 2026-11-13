import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { cardEdge, radius, space, type Palette, useColors } from '@/theme';

export type TileTone = 'lavender' | 'honey' | 'rose' | 'clay' | 'sky' | 'mint';

const TONES = {
  lavender: { tint: 'lavenderTint', ink: 'lavenderInk' },
  honey: { tint: 'honeyTint', ink: 'honeyInk' },
  rose: { tint: 'roseTint', ink: 'roseInk' },
  clay: { tint: 'clayTint', ink: 'clayInk' },
  sky: { tint: 'skyTint', ink: 'skyInk' },
  mint: { tint: 'mintTint', ink: 'mintInk' },
} as const satisfies Record<TileTone, { tint: keyof Palette; ink: keyof Palette }>;

type Props = {
  icon: LucideIcon;
  tone: TileTone;
  label: string;
  onPress: () => void;
};

/** One big tile on About you (Figma G6b): a large tinted round icon and the name, on a card. */
export function AboutTile({ icon: Icon, tone, label, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.surface, ...cardEdge(colors), opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors[TONES[tone].tint] }]}>
        <Icon size={44} color={colors[TONES[tone].ink]} strokeWidth={1.75} />
      </View>
      <AppText variant="bodyEm" style={styles.centre}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1_5,
    borderRadius: radius.lg,
    paddingVertical: space.s3,
    paddingHorizontal: space.s1,
  },
  icon: { width: 88, height: 88, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  centre: { textAlign: 'center' },
});
