import type { ReactNode } from 'react';
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
};

/** A labelled single-line text input in the app's style (the mockup's `.field-label` + input). */
export function TextField({ label, hint, hideLabel = false, accessory, ...input }: Props) {
  const colors = useColors();
  const box = { backgroundColor: colors.surface, borderColor: colors.hairline };
  return (
    <View style={styles.wrap}>
      {!hideLabel && (
        <AppText variant="label" color="inkSoft" style={styles.label}>
          {hint ? `${label} ${hint}` : label}
        </AppText>
      )}
      <View style={[styles.box, box]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, input.multiline && styles.multiline, { color: colors.ink }]}
        />
        {accessory && <View style={styles.accessory}>{accessory}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md },
  input: {
    ...typography.body,
    fontSize: 16,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  accessory: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
});
