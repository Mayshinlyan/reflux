import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useDb } from '@/db/DatabaseProvider';
import { createAvoidFood, MAX_AVOID_FOODS, MAX_AVOID_NAME } from '@/db/repositories/avoidFoods';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Add a food you never eat (Figma row 29h): one field and Add. The Kitchen skips it in every recipe. Give it a new
 * `key` each time it opens so the field starts empty.
 */
export function AddAvoidSheet({
  visible,
  onClose,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const db = useDb();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const add = () => {
    if (draft.trim().length === 0) return;
    try {
      createAvoidFood(db, draft);
    } catch (error) {
      logger.error('createAvoidFood', error);
      setMessage(
        error instanceof Error && error.message === 'The list is full'
          ? `That's the most we can keep: ${MAX_AVOID_FOODS} foods. Remove one first.`
          : friendlyMessages.INTERNAL,
      );
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onAdded();
    onClose();
  };

  return (
    // On the page `bg`, so the field's `surface` fill shows as a box before it is focused (like the feedback sheet).
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        Add a food
      </AppText>
      <TextField
        label="Food you don't eat"
        hideLabel
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setMessage(null);
        }}
        placeholder="e.g. Peanuts"
        maxLength={MAX_AVOID_NAME}
        returnKeyType="done"
        onSubmitEditing={add}
      />
      {message && (
        <AppText color="redInk" style={styles.message}>
          {message}
        </AppText>
      )}
      <Button label="Add" onPress={add} disabled={draft.trim().length === 0} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s1 },
  message: { marginBottom: space.s1 },
});
