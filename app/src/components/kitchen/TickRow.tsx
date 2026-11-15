import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouchTarget, space, useColors } from '@/theme';

type Props = {
  label: string;
  /** A line under the label (a prep step's dish). */
  caption?: string;
  /** Right-aligned, in `ink-muted` (an item's amount). */
  trailing?: string;
  checked: boolean;
  /** A round tick for steps to do in order, a square one for things to buy. */
  shape: 'circle' | 'box';
  /** A hairline above it, for every row but the first of a card. */
  divider?: boolean;
  onToggle: () => void;
};

/**
 * One row of the prep day or the shopping list (Figma "meal planning flow" E2 and E3): a 24pt tick (outlined when
 * off, olive when on), the text, and the text struck through and muted once ticked. The whole row is the target.
 */
export function TickRow({ label, caption, trailing, checked, shape, divider = false, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
      <View
        style={[
          styles.tick,
          shape === 'circle' ? styles.circle : styles.box,
          checked ? { backgroundColor: colors.cta } : { borderWidth: 1.5, borderColor: colors.inkSoft },
        ]}>
        {checked && <Check size={16} color={colors.ctaInk} strokeWidth={2.5} />}
      </View>
      <View style={styles.text}>
        <AppText style={checked ? styles.done : undefined} color={checked ? 'inkMuted' : 'ink'}>
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" color="inkMuted">
            {caption}
          </AppText>
        ) : null}
      </View>
      {trailing ? (
        <AppText variant="caption" color="inkMuted">
          {trailing}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    paddingVertical: space.s1,
  },
  tick: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  circle: { borderRadius: 12 },
  box: { borderRadius: 7 },
  text: { flex: 1 },
  done: { textDecorationLine: 'line-through' },
});
