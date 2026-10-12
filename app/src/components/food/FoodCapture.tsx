import { Camera } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { radius, space, useColors } from '@/theme';

type Props = {
  heading: string;
  fieldLabel: string;
  placeholder: string;
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onPickPhoto: () => void;
  maxLength: number;
  notice?: ReactNode;
  /** The Quick log row, between the heading and the photo card. */
  quickLog?: ReactNode;
};

/** Figma "03b Food: capture": a heading, one big photo card, "or", and a text field. */
export function FoodCapture({
  heading,
  fieldLabel,
  placeholder,
  text,
  onChangeText,
  onSubmit,
  onPickPhoto,
  maxLength,
  notice,
  quickLog,
}: Props) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <AppText variant="display" accessibilityRole="header">
          {heading}
        </AppText>
        <AppText variant="voice" color="inkSoft">
          Snap a photo or describe it. We&apos;ll check it for you.
        </AppText>
      </View>
      {quickLog}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take or choose a photo"
        onPress={onPickPhoto}
        style={({ pressed }) => [
          styles.photo,
          { backgroundColor: colors.surface2, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Camera size={32} color={colors.inkSoft} strokeWidth={2} />
        <AppText variant="bodyEm">Take or choose a photo</AppText>
        <AppText variant="caption" color="inkSoft">
          Good light helps
        </AppText>
      </Pressable>
      <AppText variant="caption" color="inkSoft" style={styles.or}>
        or
      </AppText>
      <TextField
        label={fieldLabel}
        value={text}
        onChangeText={onChangeText}
        placeholder={placeholder}
        maxLength={maxLength}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {notice}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s3 },
  heading: { gap: space.s2, paddingBottom: space.s1 },
  photo: {
    height: 200,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  or: { textAlign: 'center' },
});
