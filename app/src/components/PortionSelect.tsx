import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fontFamily, minTouchTarget, radius, space, useColors } from '@/theme';
import type { Portion } from '@/types/analysis';

import { AppText } from './AppText';

const CHOICES: { value: Portion; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'regular', label: 'Regular' },
  { value: 'large', label: 'Large' },
];

/**
 * How much was eaten. Same dropdown as the verdict one: closed, it is one row with the current choice;
 * open, that row becomes the list in place, with a check on the current choice. Choosing one closes it.
 */
export function PortionSelect({
  value,
  onChange,
  hideLabel = false,
}: {
  value: Portion;
  onChange: (portion: Portion) => void;
  /** When the screen already has its own "Portion" heading above. */
  hideLabel?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const current = CHOICES.find((choice) => choice.value === value) ?? CHOICES[1];
  return (
    <View style={styles.wrap}>
      {!hideLabel && (
        <AppText variant="label" color="inkSoft" style={styles.label}>
          Portion
        </AppText>
      )}
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        {open ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Portion">
            {CHOICES.map((choice, index) => (
              <Pressable
                key={choice.value}
                accessibilityRole="radio"
                accessibilityLabel={choice.label}
                accessibilityState={{ checked: choice.value === value }}
                onPress={() => {
                  onChange(choice.value);
                  setOpen(false);
                }}
                // A hairline between the options, as in Figma.
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline },
                  { opacity: pressed ? 0.85 : 1 },
                ]}>
                <AppText style={[styles.optionText, { color: colors.ink }]}>{choice.label}</AppText>
                {choice.value === value && <Check size={18} color={colors.inkSoft} strokeWidth={2.4} />}
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Portion, ${current.label}`}
            accessibilityState={{ expanded: false }}
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
            <AppText style={[styles.optionText, { color: colors.ink }]}>{current.label}</AppText>
            <ChevronDown size={20} color={colors.inkSoft} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  // A hairline edge like the Eaten field, so the dropdown shows against the sheet it sits in.
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: Math.max(minTouchTarget, 52),
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22 },
});
