import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { friendlyMessages } from '@/lib/errors';
import { fontFamily, minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { OptionRow } from './OptionRow';

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
  /**
   * `list` (default): plain rows with a check on the chosen one. `cards`: a Gaegu title and filled rows with a
   * radio, the chosen one in clay tint (Figma "Option row", 08b).
   */
  variant?: 'list' | 'cards';
  /** Small caption under the rows (`cards` only). */
  footnote?: string;
  /** Anything extra under the rows, e.g. a notice with a button. */
  footer?: ReactNode;
};

/** A bottom sheet with one radio row per option; choosing a row saves it and closes the sheet. */
export function OptionSheet({
  visible,
  title,
  note,
  options,
  value,
  onChoose,
  onClose,
  saveFailed,
  variant = 'list',
  footnote,
  footer,
}: Props) {
  const colors = useColors();
  const cards = variant === 'cards';
  return (
    <BottomSheet visible={visible} onClose={onClose} tone={cards ? 'bg' : 'surface'}>
      <AppText variant={cards ? 'displaySmall' : 'title'} accessibilityRole="header">
        {title}
      </AppText>
      {note ? (
        <AppText color="inkSoft" style={cards ? styles.cardsNote : styles.note}>
          {note}
        </AppText>
      ) : null}
      <View accessibilityRole="radiogroup" style={cards && styles.cardsGroup}>
        {options.map((option) => {
          const selected = option.value === value;
          if (cards) {
            return (
              <OptionRow
                key={option.value}
                label={option.label}
                selected={selected}
                onPress={() => onChoose(option.value)}
              />
            );
          }
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
      {footnote ? (
        <AppText variant="caption" color="inkMuted" style={styles.footnote}>
          {footnote}
        </AppText>
      ) : null}
      {footer}
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
  cardsNote: { marginTop: space.s1 },
  cardsGroup: { marginTop: space.s2, gap: space.s1 },
  footnote: { marginTop: space.s1 },
  error: { marginBottom: space.s1 },
});
