import { Pressable, StyleSheet } from 'react-native';

import { radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected: boolean;
  onPress?: () => void;
  /** 'toggle' = a multi-select tag (checkbox); 'filter' = one of a set of filters (tab); 'button' = opens something. */
  role?: 'toggle' | 'filter' | 'button';
  readOnly?: boolean;
};

/** Small pill for lifestyle tags and filter rows. Selected = clay tint, per the style guide. */
export function TagChip({ label, selected, onPress, role = 'toggle', readOnly }: Props) {
  const colors = useColors();
  return (
    <Pressable
      disabled={readOnly}
      onPress={onPress}
      accessibilityRole={role === 'filter' ? 'tab' : role === 'button' ? 'button' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={
        role === 'filter' ? { selected } : role === 'button' ? undefined : { checked: selected }
      }
      hitSlop={4}
      style={[
        styles.tag,
        selected
          ? { backgroundColor: colors.clayTint, borderColor: colors.clay }
          : { backgroundColor: colors.surface, borderColor: colors.hairline },
      ]}>
      <AppText style={[styles.label, { color: selected ? colors.clayInk : colors.inkSoft }]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  label: { ...typography.label, fontSize: 14, fontFamily: typography.bodyEm.fontFamily },
});
