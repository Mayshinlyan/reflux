import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radius, space, useColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';
import { VERDICT_LABELS, VerdictBadge } from './VerdictBadge';

/** Best to worst. "OK" is only ever set by hand. */
const CHOICES: AppVerdict[] = ['good', 'ok', 'caution', 'trigger'];

/**
 * A verdict dropdown: one row showing the current verdict, which opens in place to the four choices
 * (not a second modal, since it lives in a sheet). Choosing one closes it.
 */
export function VerdictSelect({
  value,
  onChange,
}: {
  value: AppVerdict;
  onChange: (verdict: AppVerdict) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="inkSoft" style={styles.label}>
        Verdict
      </AppText>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Verdict, ${VERDICT_LABELS[value]}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((current) => !current)}
          style={styles.row}>
          <VerdictBadge verdict={value} />
          <Chevron size={20} color={colors.inkSoft} strokeWidth={2.2} />
        </Pressable>
        {open &&
          CHOICES.map((choice) => (
            <Pressable
              key={choice}
              accessibilityRole="radio"
              accessibilityLabel={VERDICT_LABELS[choice]}
              accessibilityState={{ checked: choice === value }}
              onPress={() => {
                onChange(choice);
                setOpen(false);
              }}
              style={[styles.row, styles.option, { borderTopColor: colors.hairline }]}>
              <VerdictBadge verdict={choice} />
              {choice === value && <Check size={18} color={colors.inkSoft} strokeWidth={2.4} />}
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    minHeight: minTouchTarget + 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  option: { borderTopWidth: StyleSheet.hairlineWidth },
});
