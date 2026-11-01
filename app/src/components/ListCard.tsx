import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { cardEdge, type ColorToken, minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  /** A second line under the name; leave it out when it would only repeat the page's title. */
  caption?: string;
  icon: LucideIcon;
  /** The kind's colour: the icon tile and the icon (food honey, symptoms and lifestyle clay, medication sage). */
  tint: ColorToken;
  ink: ColorToken;
  onPress: () => void;
};

/**
 * One item on a list page (Figma row 25 and 26): a filled `surface` card with an icon tile, the name and an optional
 * caption. A tap opens the item. Usual symptoms and Lifestyle use it.
 */
export function ListCard({ label, caption, icon: Icon, tint, ink, onPress }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, ...cardEdge(colors), opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors[tint] }]}>
        <Icon size={20} color={colors[ink]} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <AppText style={styles.name} numberOfLines={2}>
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" color="inkSoft">
            {caption}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    minHeight: minTouchTarget,
    borderRadius: radius.lg,
    padding: space.s1,
    marginBottom: space.s1_5,
  },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: typography.button,
});
