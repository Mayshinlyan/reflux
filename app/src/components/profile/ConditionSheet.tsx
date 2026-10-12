import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { ConditionChoices } from '@/components/ConditionChoices';
import type { ConditionKey } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Change what you're managing (Figma 06b). Choosing a card saves it and closes the sheet.
 * Give it a new `key` each time it opens so an old error doesn't linger.
 */
export function ConditionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [saveFailed, setSaveFailed] = useState(false);

  const choose = (condition: ConditionKey) => {
    try {
      update('condition', condition);
    } catch (error) {
      logger.error('saveCondition', error);
      setSaveFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Condition
      </AppText>
      <ConditionChoices value={settings.condition} onChoose={choose} />
      {saveFailed && (
        <AppText color="redInk" style={styles.error}>
          {friendlyMessages.INTERNAL}
        </AppText>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  error: { marginTop: space.s1 },
});
