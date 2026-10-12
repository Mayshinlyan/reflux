import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { type DimensionValue, Pressable, StyleSheet, View } from 'react-native';

import { fontFamily, minTouchTarget, radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the choice is for, read by screen readers ("Show"). */
  label: string;
  width?: DimensionValue;
};

/**
 * Figma "Select": the same dropdown as the portion and verdict ones. Closed, it is one row with the current
 * choice and a chevron; open, that row becomes the list in place with a check on the current choice. Choosing
 * one closes it.
 */
export function Select<T extends string>({ options, value, onChange, label, width = 150 }: Props<T>) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <View style={[styles.box, { width, backgroundColor: colors.surface, borderColor: colors.hairline }]}>
      {open ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
          {options.map((option, index) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
              <AppText style={styles.text}>{option.label}</AppText>
              {option.value === value && <Check size={18} color={colors.inkSoft} strokeWidth={2.4} />}
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${current?.label}`}
          accessibilityState={{ expanded: false }}
          onPress={() => setOpen(true)}
          style={styles.row}>
          <AppText style={styles.text}>{current?.label}</AppText>
          <ChevronDown size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A hairline edge like the other dropdowns, so it shows against the page.
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: Math.max(minTouchTarget, 48),
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22 },
});
