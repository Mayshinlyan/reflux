import { Minus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onPress?: () => void;
  /**
   * 'toggle' = a multi-select tag (checkbox); 'radio' = one choice out of several; 'filter' = one of a
   * set of filters (tab); 'button' = opens something.
   */
  role?: 'toggle' | 'radio' | 'filter' | 'button';
  readOnly?: boolean;
  /** Shows a minus button on the chip that calls this (used to remove a tag from a saved entry). */
  onRemove?: () => void;
  /** Set when the tag sits inside a `surface` card: it then rests on `surface2` so it stays visible. */
  onCard?: boolean;
};

/** Small pill for lifestyle tags and filter rows. Selected = clay tint, per the style guide. */
export function TagChip({ label, selected, onPress, role = 'toggle', readOnly, onRemove, onCard }: Props) {
  const colors = useColors();
  // Filled, never outlined: selected = clay tint, otherwise surface (surface2 on a card).
  const colorStyle = {
    backgroundColor: selected ? colors.clayTint : onCard ? colors.surface2 : colors.surface,
  };

  // The label and the minus are separate accessibility elements, so a screen reader can reach
  // both ("Stress" and the button "Remove Stress").
  if (onRemove) {
    return (
      <View style={[styles.tag, styles.removable, colorStyle]}>
        <AppText accessible accessibilityRole="text" style={[styles.label, { color: colors.clayInk }]}>
          {label}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={10}
          style={({ pressed }) => [
            styles.minus,
            { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Minus size={16} color={colors.clayInk} strokeWidth={2.8} />
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable
      disabled={readOnly}
      onPress={onPress}
      accessibilityRole={
        role === 'filter' ? 'tab' : role === 'button' ? 'button' : role === 'radio' ? 'radio' : 'checkbox'
      }
      accessibilityLabel={label}
      accessibilityState={
        role === 'filter' ? { selected } : role === 'button' ? undefined : { checked: selected }
      }
      hitSlop={4}
      style={({ pressed }) => [styles.tag, colorStyle, { opacity: pressed ? 0.85 : 1 }]}>
      <AppText numberOfLines={1} style={[styles.label, { color: selected ? colors.clayInk : colors.ink }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    // A long name stays one line and ends in "…" instead of growing into a tall pill.
    maxWidth: '100%',
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  label: { ...typography.label, fontSize: 14, fontFamily: typography.bodyEm.fontFamily },
  // Same size as the removable symptom chips so the two rows line up.
  removable: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4, paddingVertical: 3 },
  minus: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
