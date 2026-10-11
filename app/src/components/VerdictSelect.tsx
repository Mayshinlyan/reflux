import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fontFamily, minTouchTarget, radius, space, useColors, verdictColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';
import { VERDICT_ICONS, VERDICT_LABELS } from './VerdictBadge';

/** Best to worst. "OK" is only ever set by hand. */
const CHOICES: AppVerdict[] = ['good', 'ok', 'caution', 'trigger'];

/**
 * A verdict dropdown. Closed, it is one row with the current verdict. Open, that row becomes the list of
 * choices in place (not a second modal, since it lives in a sheet). Both look the same: plain icon and
 * label, with a check on the current choice. Choosing one closes it.
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
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="inkSoft" style={styles.label}>
        Verdict
      </AppText>
      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        {open ? (
          <View accessibilityRole="radiogroup" accessibilityLabel="Verdict">
            {CHOICES.map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityLabel={VERDICT_LABELS[choice]}
                accessibilityState={{ checked: choice === value }}
                onPress={() => {
                  onChange(choice);
                  setOpen(false);
                }}
                style={styles.row}>
                <VerdictOption verdict={choice} />
                {choice === value && <Check size={18} color={colors.inkSoft} strokeWidth={2.4} />}
              </Pressable>
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Verdict, ${VERDICT_LABELS[value]}`}
            accessibilityState={{ expanded: false }}
            onPress={() => setOpen(true)}
            style={styles.row}>
            <VerdictOption verdict={value} />
            <ChevronDown size={20} color={colors.inkSoft} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** A verdict as the dropdown shows it, closed or open: its colored icon and label, no pill. */
function VerdictOption({ verdict }: { verdict: AppVerdict }) {
  const colors = useColors();
  const Icon = VERDICT_ICONS[verdict];
  const color = colors[verdictColors[verdict].fg];
  return (
    <View style={styles.option}>
      <Icon size={18} color={color} strokeWidth={2.4} />
      <AppText style={[styles.optionText, { color }]}>{VERDICT_LABELS[verdict]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  box: { borderRadius: radius.md, overflow: 'hidden' },
  // Matches the text fields above it (52 high, 14 in).
  row: {
    minHeight: Math.max(minTouchTarget, 52),
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.s1 },
  optionText: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22 },
});
