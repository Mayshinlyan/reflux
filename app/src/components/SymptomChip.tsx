import { Minus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { pillStyle, radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  /** Read-only display (e.g. the History detail sheet): announced as plain text, not a checkbox. */
  readOnly?: boolean;
  /** Shows a minus button on the chip that calls this (used to remove a symptom from a saved entry). */
  onRemove?: () => void;
  /** Set when the chip sits inside a `surface` card: it then rests on `surface2` so it stays visible. */
  onCard?: boolean;
};

/** A symptom you either have or don't: tap to toggle. There is no severity rating. */
export function SymptomChip({ label, selected, onToggle, readOnly, onRemove, onCard }: Props) {
  const colors = useColors();
  // Selected is light green with a 1px olive outline; unselected is white with the soft edge (surface2 and no
  // visible edge inside a card).
  const colorStyle = pillStyle(colors, selected, onCard);

  // The label and the minus are separate accessibility elements, so a screen reader can reach
  // both ("Heartburn" and the button "Remove Heartburn").
  if (onRemove) {
    return (
      <View style={[styles.chip, styles.removable, colorStyle]}>
        <AppText accessible accessibilityRole="text" style={[styles.label, { color: colors.sageInk }]}>
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
          <Minus size={16} color={colors.sageInk} strokeWidth={2} />
        </Pressable>
      </View>
    );
  }

  const roleProps = readOnly
    ? ({ accessible: true, accessibilityRole: 'text', accessibilityLabel: label } as const)
    : ({
        accessibilityRole: 'checkbox',
        accessibilityLabel: label,
        accessibilityState: { checked: selected },
      } as const);
  const labelColor = selected ? colors.sageInk : colors.ink;

  return (
    <Pressable
      disabled={readOnly}
      onPress={onToggle}
      {...roleProps}
      hitSlop={3}
      style={({ pressed }) => [styles.chip, colorStyle, { opacity: pressed ? 0.85 : 1 }]}>
      <AppText style={[styles.label, { color: labelColor }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  label: { ...typography.button, fontFamily: typography.bodyEm.fontFamily },
  removable: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4, paddingVertical: 3 },
  minus: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
