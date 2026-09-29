import { Minus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  /** Read-only display (e.g. the History detail sheet): announced as plain text, not a checkbox. */
  readOnly?: boolean;
  /** Shows a minus button on the chip that calls this (used to remove a symptom from a saved entry). */
  onRemove?: () => void;
};

/** A symptom you either have or don't: tap to toggle. There is no severity rating. */
export function SymptomChip({ label, selected, onToggle, readOnly, onRemove }: Props) {
  const colors = useColors();
  const colorStyle = selected
    ? { backgroundColor: colors.sageTint, borderColor: colors.sage }
    : { backgroundColor: colors.surface, borderColor: colors.hairline };

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
          hitSlop={6}
          style={({ pressed }) => [styles.minus, { opacity: pressed ? 0.6 : 1 }]}>
          <Minus size={16} color={colors.sageInk} strokeWidth={2.8} />
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

  return (
    <Pressable disabled={readOnly} onPress={onToggle} {...roleProps} style={[styles.chip, colorStyle]}>
      <AppText style={[styles.label, { color: selected ? colors.sageInk : colors.ink }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    justifyContent: 'center',
    minHeight: minTouchTarget,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  label: { ...typography.bodyEm, fontSize: 15, lineHeight: 20 },
  removable: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 6, paddingVertical: 6 },
  minus: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFFB3',
  },
});
