import { Pressable, StyleSheet } from 'react-native';

import { minTouchTarget, radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  /** Read-only display (e.g. the History detail sheet): announced as plain text, not a checkbox. */
  readOnly?: boolean;
};

/** A symptom you either have or don't: tap to toggle. There is no severity rating. */
export function SymptomChip({ label, selected, onToggle, readOnly }: Props) {
  const colors = useColors();

  const roleProps = readOnly
    ? ({ accessible: true, accessibilityRole: 'text', accessibilityLabel: label } as const)
    : ({
        accessibilityRole: 'checkbox',
        accessibilityLabel: label,
        accessibilityState: { checked: selected },
      } as const);

  return (
    <Pressable
      disabled={readOnly}
      onPress={onToggle}
      {...roleProps}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.sageTint, borderColor: colors.sage }
          : { backgroundColor: colors.surface, borderColor: colors.hairline },
      ]}>
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
});
