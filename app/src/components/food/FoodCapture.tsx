import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { minTouchTarget, space, useColors } from '@/theme';

type Props = {
  heading: string;
  /** Read by screen readers only; the heading already asks the question. */
  fieldLabel: string;
  placeholder: string;
  text: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  maxLength: number;
  notice?: ReactNode;
  /** The favorite foods as one row of chips under the field. */
  chips?: ReactNode;
  /** The suggestions under the field (Figma row 20); they stand in for the chips while typing. */
  suggestions?: ReactNode;
  /** Asked to scroll the field to the top when the suggestions appear, so they clear the keyboard. */
  onRevealField?: (y: number) => void;
};

/**
 * Figma "21a Food: capture": a heading and one field. The camera and photos buttons sit inside the field, so a
 * photo is one tap and nothing sits between it and its verdict.
 */
export function FoodCapture({
  heading,
  fieldLabel,
  placeholder,
  text,
  onChangeText,
  onSubmit,
  onTakePhoto,
  onChoosePhoto,
  maxLength,
  notice,
  chips,
  suggestions,
  onRevealField,
}: Props) {
  const colors = useColors();
  const fieldY = useRef(0);
  const hasSuggestions = suggestions != null;
  useEffect(() => {
    if (hasSuggestions) onRevealField?.(fieldY.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the list appears, not when the callback changes
  }, [hasSuggestions]);
  return (
    <View style={styles.wrap}>
      <AppText variant="display" accessibilityRole="header" style={styles.heading}>
        {heading}
      </AppText>
      <View onLayout={(event) => (fieldY.current = event.nativeEvent.layout.y)}>
        <TextField
          label={fieldLabel}
          hideLabel
          value={text}
          onChangeText={onChangeText}
          placeholder={placeholder}
          maxLength={maxLength}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          accessory={
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
                onPress={onTakePhoto}
                style={styles.icon}>
                <Camera size={20} color={colors.inkSoft} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
                onPress={onChoosePhoto}
                style={styles.icon}>
                <ImageIcon size={20} color={colors.inkSoft} strokeWidth={2} />
              </Pressable>
            </>
          }
        />
        {suggestions != null ? <View style={styles.suggestions}>{suggestions}</View> : chips}
      </View>
      {notice}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s1 },
  heading: { paddingBottom: space.s1 },
  icon: { width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  // The field keeps 16 below it; the list sits 8 under the field (Figma 20a).
  suggestions: { marginTop: -space.s1 },
});
