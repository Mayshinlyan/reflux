import { type ReactNode, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'maxLength'
  | 'autoCapitalize'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'multiline'
> & {
  label: string;
  /** Shown after the label, e.g. "(optional)". */
  hint?: string;
  /** Keeps the label for screen readers only, when the placeholder already says it. */
  hideLabel?: boolean;
  /** Small controls (e.g. icon buttons) inside the right edge of the input. */
  accessory?: ReactNode;
  /** Height of a `multiline` input when empty (default 88); the feedback sheet uses 112 (Figma 19). */
  minHeight?: number;
  /** Sits in a list of rows (Kitchen sheet): the row's soft edge, its 16pt inset, and no margin below. */
  card?: boolean;
};

/** A labelled single-line text input in the app's style (the mockup's `.field-label` + input). */
export function TextField({
  label,
  hint,
  hideLabel = false,
  accessory,
  minHeight,
  card = false,
  ...input
}: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  // Filled with the soft edge every card and row has (1.5pt here, so the focus ring is the same width); focusing swaps it for the clay ring.
  const box = { backgroundColor: colors.surface, borderColor: focused ? colors.clay : colors.edge };
  return (
    <View style={card ? styles.wrapCard : styles.wrap}>
      {!hideLabel && (
        <AppText variant="label" color="inkSoft" style={styles.label}>
          {hint ? `${label} ${hint}` : label}
        </AppText>
      )}
      <View style={[styles.box, card && styles.boxCard, box]}>
        <TextInput
          {...input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkSoft}
          style={[
            styles.input,
            card && styles.inputCard,
            input.multiline && styles.multiline,
            input.multiline && minHeight ? { minHeight } : null,
            { color: colors.ink },
          ]}
        />
        {accessory && <View style={styles.accessory}>{accessory}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  wrapCard: { marginBottom: 0 },
  label: { marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md },
  boxCard: { borderRadius: radius.lg },
  input: {
    ...typography.small,
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 12.5,
    paddingVertical: 11.5,
  },
  inputCard: { minHeight: 56, paddingHorizontal: space.s2 + 4 - 1.5 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  accessory: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
});
