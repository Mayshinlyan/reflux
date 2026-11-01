import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { MAX_CUSTOM_SYMPTOM, customSymptomLabel } from '@/constants/symptomItems';
import { isCustomTag, tagKeyFromText } from '@/constants/lifestyleTags';
import { useDb } from '@/db/DatabaseProvider';
import { createSavedSymptom } from '@/db/repositories/savedSymptoms';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Add a lifestyle factor of your own (Figma row 26, 26b): one field and Add. It becomes a chip under "What's going
 * on?" when you log. Something that already is a built-in chip (Stress) is not saved twice.
 * Give it a new `key` each time it opens so the field starts empty.
 */
export function AddLifestyleSheet({
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
    const key = tagKeyFromText(draft);
    if (!key) return;
    if (!isCustomTag(key)) {
      setMessage('That one is already a chip.');
      return;
    }
    try {
      createSavedSymptom(db, customSymptomLabel(key), 'lifestyle');
    } catch (error) {
      logger.error('createSavedSymptom', error);
      setMessage(friendlyMessages.INTERNAL);
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
        Add a lifestyle
      </AppText>
      <TextField
        label="Lifestyle"
        hideLabel
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setMessage(null);
        }}
        placeholder="e.g. Skipped breakfast"
        maxLength={MAX_CUSTOM_SYMPTOM}
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
  title: { marginBottom: space.s2 },
  message: { marginBottom: space.s1 },
});
