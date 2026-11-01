import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useSettings } from '@/db/DatabaseProvider';
import { USER_NAME_MAX } from '@/db/repositories/settings';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Edit what the app calls you (Figma 06a). An empty name is fine; Today then greets without one.
 * Give it a new `key` each time it opens so it starts from the saved name.
 */
export function NameSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings.userName);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = () => {
    try {
      update('userName', draft);
    } catch (error) {
      logger.error('saveName', error);
      setSaveFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  return (
    // On the page `bg`, so the field's `surface` fill shows as a box before it is focused.
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <TextField
        label="Your name"
        value={draft}
        onChangeText={setDraft}
        placeholder="Your name"
        maxLength={USER_NAME_MAX}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {saveFailed && (
        <AppText color="redInk" style={styles.error}>
          {friendlyMessages.INTERNAL}
        </AppText>
      )}
      <Button label="Save" onPress={save} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ error: { marginBottom: space.s1 } });
