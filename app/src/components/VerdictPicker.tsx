import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useColors, verdictColors } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

import { AppText } from './AppText';
import { VERDICT_ICONS, VERDICT_LABELS } from './VerdictBadge';

/** Best to worst. "Good" is only ever set by hand. */
const CHOICES: AppVerdict[] = ['good', 'ok', 'caution', 'trigger'];

/** One verdict as a pill: its icon and label in its own colours, with an optional trailing chevron. */
function Pill({
  verdict,
  chevron,
  outlined,
}: {
  verdict: AppVerdict;
  chevron?: boolean;
  outlined?: boolean;
}) {
  const colors = useColors();
  const { fg, bg } = verdictColors[verdict];
  const Icon = VERDICT_ICONS[verdict];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors[bg], borderColor: outlined ? colors.sageInk : 'transparent' },
      ]}>
      <Icon size={16} color={colors[fg]} strokeWidth={2} />
      <AppText variant="label" style={{ color: colors[fg] }}>
        {VERDICT_LABELS[verdict]}
      </AppText>
      {chevron && <ChevronDown size={16} color={colors[fg]} strokeWidth={2} />}
    </View>
  );
}

/**
 * Figma 15a (Edit meal): the verdict as a pill with a chevron inside it. Tapped, it opens the four choices in
 * place, the current one outlined; choosing one closes it. Centred, like the rest of the page.
 */
export function VerdictPicker({
  value,
  onChange,
}: {
  value: AppVerdict;
  onChange: (verdict: AppVerdict) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Verdict, ${VERDICT_LABELS[value]}`}
        accessibilityState={{ expanded: false }}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Pill verdict={value} chevron />
      </Pressable>
    );
  }
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Verdict" style={styles.list}>
      {CHOICES.map((choice) => (
        <Pressable
          key={choice}
          accessibilityRole="radio"
          accessibilityLabel={VERDICT_LABELS[choice]}
          accessibilityState={{ checked: choice === value }}
          hitSlop={4}
          onPress={() => {
            onChange(choice);
            setOpen(false);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <Pill verdict={choice} outlined={choice === value} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  list: { alignItems: 'center', gap: 8 },
});
