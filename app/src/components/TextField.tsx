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
> & {
  label: string;
  /** Shown after the label, e.g. "(optional)". */
  hint?: string;
};

/** A labelled single-line text input in the app's style (the mockup's `.field-label` + input). */
export function TextField({ label, hint, ...input }: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="inkSoft" style={styles.label}>
        {hint ? `${label} ${hint}` : label}
      </AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSoft}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.hairline, color: colors.ink },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  input: {
    ...typography.body,
    fontSize: 16,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
