import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { ConditionChoices } from '@/components/ConditionChoices';
import { Button } from '@/components/Button';
import { toggleCondition } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Change what you're managing (Figma 06b). Pick all that apply, then Save.
 * Give it a new `key` each time it opens so an old error doesn't linger.
 */
export function ConditionSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [conditions, setConditions] = useState(settings.conditions);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = () => {
    try {
      update('conditions', conditions);
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
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        Condition
      </AppText>
      <ConditionChoices
        value={conditions}
        onToggle={(key) => setConditions((current) => toggleCondition(current, key))}
      />
      <View style={styles.footer}>
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
        <Button label="Save" onPress={save} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  footer: { marginTop: space.s3 },
  error: { marginBottom: space.s1 },
});
