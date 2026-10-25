import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { MAX_CUSTOM_SYMPTOM } from '@/constants/symptomItems';
import { radius, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  /** What the chip does, for screen readers and the field: "Add your own to Chest". */
  label: string;
  placeholder: string;
  /** Called with what was typed (not yet tidied) when return is pressed. Nothing happens for blank text. */
  onAdd: (text: string) => void;
  /** Called when the field opens, so the screen can scroll it into view above the keyboard. */
  onOpen?: () => void;
};

/**
 * The first chip of a group (Figma 03k): a "+" that turns into a text field in place. Return adds what was
 * typed to that group; leaving the field without pressing return drops it.
 */
export function InlineAddChip({ label, placeholder, onAdd, onOpen }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const close = () => {
    setOpen(false);
    setDraft('');
  };
  const submit = () => {
    const text = draft;
    close();
    if (text.trim()) onAdd(text);
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setOpen(true);
          onOpen?.();
        }}
        hitSlop={3}
        style={({ pressed }) => [
          styles.chip,
          styles.plus,
          { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
        ]}>
        <AppText style={[styles.plusText, { color: colors.clayInk }]}>+</AppText>
      </Pressable>
    );
  }

  return (
    <TextInput
      autoFocus
      value={draft}
      onChangeText={setDraft}
      onSubmitEditing={submit}
      onBlur={close}
      placeholder={placeholder}
      placeholderTextColor={colors.inkSoft}
      accessibilityLabel={label}
      maxLength={MAX_CUSTOM_SYMPTOM}
      autoCapitalize="sentences"
      returnKeyType="done"
      style={[
        styles.chip,
        styles.field,
        { backgroundColor: colors.surface, borderColor: colors.clay, color: colors.ink },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 38, borderRadius: radius.pill },
  plus: { width: 38, alignItems: 'center', justifyContent: 'center' },
  plusText: { ...typography.bodyEm, fontSize: 20, lineHeight: 24 },
  // Filled like the other chips; the ring is the one functional stroke, as on the text fields.
  field: {
    ...typography.bodyEm,
    fontSize: 14.5,
    minWidth: 150,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
});
