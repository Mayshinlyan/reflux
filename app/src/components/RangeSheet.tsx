import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { type Period, type PeriodChoice, samePeriod } from '@/lib/range';
import { minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';

type Props = {
  visible: boolean;
  /** "Choose a week" / "Choose a month". */
  title: string;
  choices: PeriodChoice[];
  current: Period;
  onPick: (period: Period) => void;
  onClose: () => void;
};

/** Figma "04e Range sheet": the weeks or months to look at, newest first, with a check on the shown one. */
export function RangeSheet({ visible, title, choices, current, onPick, onClose }: Props) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        {choices.map((choice) => {
          const selected = samePeriod(choice.period, current);
          return (
            <Pressable
              key={choice.period.startKey}
              accessibilityRole="radio"
              accessibilityLabel={`${choice.title}, ${choice.label}`}
              accessibilityState={{ checked: selected }}
              onPress={() => onPick(choice.period)}
              style={styles.row}>
              <View style={styles.check}>
                {selected && <Check size={20} color={colors.ink} strokeWidth={2.4} />}
              </View>
              <AppText variant={selected ? 'bodyEm' : 'body'} style={styles.rowTitle}>
                {choice.title}
              </AppText>
              <AppText color="inkSoft">{choice.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: Math.max(minTouchTarget, 52),
    paddingHorizontal: 4,
  },
  check: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1 },
});
