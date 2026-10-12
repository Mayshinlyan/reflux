import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { BEDTIME_OPTIONS, formatClock } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { fontFamily, minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';

type Props = {
  visible: boolean;
  /** Current bedtime, "HH:MM". */
  value: string;
  onChoose: (bedtime: string) => void;
  onClose: () => void;
  /** Line under the title, e.g. how late meals are flagged. */
  note?: string;
  saveFailed?: boolean;
};

/** Bedtimes from 8:00 PM to 2:00 AM in half-hour steps, in a bottom sheet (Settings and onboarding). */
export function BedtimeSheet({ visible, value, onChoose, onClose, note, saveFailed }: Props) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" accessibilityRole="header">
        Bedtime
      </AppText>
      {note ? (
        <AppText color="inkSoft" style={styles.note}>
          {note}
        </AppText>
      ) : null}
      <View accessibilityRole="radiogroup">
        {BEDTIME_OPTIONS.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={formatClock(option)}
              accessibilityState={{ checked: selected }}
              onPress={() => onChoose(option)}
              style={[styles.option, { borderBottomColor: colors.hairline }]}>
              <AppText
                style={[
                  styles.optionText,
                  selected && { color: colors.clayInk, fontFamily: fontFamily.extrabold },
                ]}>
                {formatClock(option)}
              </AppText>
              {selected && <Check size={18} color={colors.clayInk} strokeWidth={2.6} />}
            </Pressable>
          );
        })}
      </View>
      {saveFailed && (
        <AppText color="redInk" style={styles.error}>
          {friendlyMessages.INTERNAL}
        </AppText>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 4, marginBottom: space.s2, fontSize: 15, lineHeight: 21 },
  option: {
    minHeight: Math.max(minTouchTarget, 52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 16 },
  error: { marginBottom: space.s1 },
});
