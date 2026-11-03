import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { typography, useColors } from '@/theme';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'maxLength' | 'placeholder'> & {
  label: string;
  /** Centre the name over its line, like the title on the entry page. */
  centered?: boolean;
};

/**
 * Figma "15a Edit meal": a name edited in place. It looks like the page title with a line under it, and the
 * line turns to the focus colour while typing. A long name wraps; "done" closes the keyboard.
 */
export function NameField({ label, centered = false, ...input }: Props) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, { borderBottomColor: focused ? colors.clay : colors.inkSoft }]}>
      <TextInput
        {...input}
        multiline
        scrollEnabled={false}
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSoft}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, centered && styles.centered, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 2 },
  input: { ...typography.hero, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 6 },
  centered: { textAlign: 'center' },
});
