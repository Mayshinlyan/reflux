import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { friendlyMessages } from '@/lib/errors';
import { fontFamily, minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';

export type Option = { value: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  /** Line under the title, e.g. what the choice changes. */
  note?: string;
  options: readonly Option[];
  value: string;
  onChoose: (value: string) => void;
  onClose: () => void;
  saveFailed?: boolean;
};

/** A bottom sheet with one radio row per option; choosing a row saves it and closes the sheet. */
export function OptionSheet({ visible, title, note, options, value, onChoose, onClose, saveFailed }: Props) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {note ? (
        <AppText color="inkSoft" style={styles.note}>
          {note}
        </AppText>
      ) : null}
      <View accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChoose(option.value)}
              style={[styles.option, { borderBottomColor: colors.hairline }]}>
              <AppText
                style={[
                  styles.optionText,
                  selected && { color: colors.clayInk, fontFamily: fontFamily.extrabold },
                ]}>
                {option.label}
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
