import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { cardEdge, type ColorToken, minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';
import { SwipeToDelete } from './SwipeToDelete';

type Props = {
  label: string;
  /** A second line under the name; leave it out when it would only repeat the page's title. */
  caption?: string;
  icon: LucideIcon;
  /** The kind's colour: the icon tile and the icon (food honey, symptoms and lifestyle clay, medication sage). */
  tint: ColorToken;
  ink: ColorToken;
  onPress: () => void;
  /** When set, swiping the row left reveals a Delete button that calls this (like Favorite foods). */
  onDelete?: () => void;
};

/**
 * One item on a list page (Figma row 25 and 26): a filled `surface` card with an icon tile, the name and an optional
 * caption. A tap opens the item, and a swipe left deletes it. Usual symptoms, Lifestyle factors and Foods to avoid
 * use it.
 */
export function ListCard({ label, caption, icon: Icon, tint, ink, onPress, onDelete }: Props) {
  const colors = useColors();
  const card = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      // Swiping isn't possible with a screen reader, so offer the same action from its actions menu.
      accessibilityActions={onDelete ? [{ name: 'delete', label: 'Delete' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDelete?.();
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        !onDelete && styles.gap,
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
  if (!onDelete) return card;
  return (
    <SwipeToDelete label={label} onDelete={onDelete} style={styles.gap}>
      {card}
    </SwipeToDelete>
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
  },
  gap: { marginBottom: space.s1_5 },
  icon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: typography.button,
});
